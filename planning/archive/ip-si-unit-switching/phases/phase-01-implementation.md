---
DATE: 2026-05-26
TIME: 18:44 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Implement the IP/SI unit-switching foundation from
       `planning/features/ip-si-unit-switching/PRD.md`: per-user preference
       API, project-header toggle, shared frontend unit helpers, first
       catalog/window consumers, and browser verification.
RELATED:
  - planning/features/ip-si-unit-switching/PRD.md
  - context/PRD.md
  - context/technical-requirements/frontend-viewer-units.md
  - context/UI_UX.md
  - context/user-stories/00-foundation-shell.md
  - context/user-stories/10-windows.md
  - context/user-stories/20-envelope.md
  - context/user-stories/40-model-viewer.md
  - context/CODING_STANDARDS.md
  - backend/features/auth/
  - frontend/src/features/auth/
  - frontend/src/features/project_document/components/VersionControlsMenus.tsx
  - frontend/src/features/catalogs/
  - frontend/src/features/windows/
---

# Plan 32 - IP/SI Unit Switching Implementation

## 1. Goal

Land the unit-system foundation before advanced builder work depends on
physical numeric fields.

After this plan is complete:

- authenticated users have a persisted `SI` or `IP` preference on their
  user row;
- public viewers get a local browser fallback;
- the project header exposes a compact IP/SI segmented control;
- toggling units re-renders converted display values without changing
  the project document or draft state;
- initial catalog/window physical values consume shared frontend unit
  helpers;
- future Window Builder, Assembly Builder, and Model viewer work can
  reuse the same preference state and helper modules.

The implementation must preserve the PRD rule: backend, REST, MCP,
downloads, catalog storage, project documents, drafts, JSON-Patch
values, and calculations remain SI canonical.

## 2. Preconditions

- [ ] Start from a clean enough typecheck/test baseline. If the active
      custom-field/table-schema reshaping work is still intentionally
      red, either finish that first or isolate this plan on a branch
      whose expected failures are documented before implementation.
- [ ] Confirm current Alembic head and create the units migration after
      it.
- [ ] Confirm the auth/session tests are green before changing the
      session payload.
- [ ] Confirm current project-header controls still live in
      `frontend/src/features/project_document/components/VersionControlsMenus.tsx`.
- [ ] Confirm catalog editor/list pages still use
      `frontend/src/features/catalogs/components/form-helpers.ts` for
      number parse/display.

## 3. Binding Constraints

1. **No backend display conversion.** Do not branch API, MCP, download,
   or document responses by `users.units_preference`.
2. **Preference write only touches the current user.** Updating units
   must not write project drafts, project versions, catalog rows, table
   views, or MCP token rows.
3. **Custom numbers stay unitless.** Do not add unit dimensions to
   runtime custom fields, formulas, or generic DataTable `number`
   fields in this plan.
4. **Equipment legacy IP fields stay out of scope.** Fields such as
   `flow_gpm` already encode IP semantics. Do not pretend they are SI.
5. **Unit system is not display format.** The header toggle chooses
   `SI` or `IP`; Window Builder choices such as `mm`, `cm`, `in`,
   `ft-in`, or fractional inches are separate preferences for a later
   dimensions-panel phase.
6. **Focused helper API.** Feature code calls named quantity helpers
   such as `formatLengthFromMm` and `formatUValueFromWm2K`, not a
   generic "convert any unit to any unit" helper.
7. **Active editors are stable.** If units are toggled while a numeric
   input is focused, do not rewrite the user's in-progress draft string.
8. **Viewer mode works without auth.** Public viewers can toggle units
   locally; anonymous toggles must not call the authenticated preference
   endpoint.

## 4. Phase 1 - Backend User Preference API

### 4.1 Scope

- [ ] Add `users.units_preference`.
- [ ] Extend auth/session models and repository reads.
- [ ] Add the current-user preference update route.
- [ ] Audit-log preference changes.
- [ ] Keep all project/document/catalog endpoints SI-only.

### 4.2 Target Files

```text
backend/alembic/versions/<new>_user_units_preference.py
backend/features/auth/models.py
backend/features/auth/repository.py
backend/features/auth/service.py
backend/features/auth/routes.py
backend/tests/...auth/session/preference tests...
```

Use the existing auth feature because it already owns `UserPublic`,
session hydration, and current-user route dependencies.

### 4.3 Implementation Checklist

- [ ] Add migration:
      - `units_preference text NOT NULL DEFAULT 'SI'`.
      - check constraint `units_preference IN ('SI', 'IP')`.
- [ ] Add `UnitSystem = Literal["SI", "IP"]` in auth models or a narrow
      shared auth type.
- [ ] Extend `UserPublic` with `units_preference`.
- [ ] Update `get_user_by_email`, `get_user_by_email_for_update`,
      `get_user_by_id`, and `upsert_user` return columns.
- [ ] Add `UserPreferencesUpdateRequest` with
      `units_preference: UnitSystem`.
- [ ] Add repository function:
      `update_user_units_preference(conn, user_id, units_preference)`.
- [ ] Add service function that:
      - reads the current value;
      - updates the row;
      - logs `auth.units_preference.updated` with before/after values;
      - returns updated `AuthSessionResponse` using the current
        `expires_at`.
- [ ] Add `PATCH /api/v1/auth/preferences`.
- [ ] Ensure invalid values return Pydantic/FastAPI 422.
- [ ] Ensure unauthenticated callers return 401.

### 4.4 Backend Tests

- [ ] Migration/default test or repository test proves existing/new
      users default to `SI`.
- [ ] `GET /api/v1/auth/session` includes `user.units_preference`.
- [ ] `PATCH /api/v1/auth/preferences` persists `IP`, then `SI`.
- [ ] Invalid value returns 422 and does not mutate the row.
- [ ] Anonymous request returns 401.
- [ ] Audit-log row includes before/after details.
- [ ] A project document fetch/download test proves values remain SI and
      response shape is unchanged except for auth session payload.

### 4.5 Phase Gate

Commands:

```bash
cd backend
uv run alembic upgrade head
uv run pytest tests/test_auth*.py
uv run ty check
```

Adjust the targeted pytest path to the actual auth test filenames.

## 5. Phase 2 - Frontend Preference State And Toggle

### 5.1 Scope

- [ ] Add frontend auth types/API for the new preference payload.
- [ ] Add unit-preference provider/store.
- [ ] Add authenticated server persistence.
- [ ] Add anonymous local-storage fallback.
- [ ] Render the IP/SI segmented control in the project header.
- [ ] Prove toggling does not dirty project drafts.

### 5.2 Target Files

```text
frontend/src/features/auth/types.ts
frontend/src/features/auth/api.ts
frontend/src/features/auth/hooks.ts
frontend/src/lib/units/types.ts
frontend/src/lib/units/preference.tsx
frontend/src/lib/units/index.ts
frontend/src/features/project_document/components/UnitSystemToggle.tsx
frontend/src/features/project_document/components/VersionControls.tsx
frontend/src/features/project_document/components/VersionControlsMenus.tsx
frontend/src/features/projects/routes/ProjectShell.tsx
frontend/src/app/providers.tsx
frontend/src/App.css
frontend/src/features/project_document/version-controls.css
```

If implementation finds a better feature boundary, keep the public
imports stable through `frontend/src/lib/units/index.ts`.

### 5.3 Implementation Checklist

- [ ] Extend `User` and `AuthSession` types with
      `units_preference: "SI" | "IP"`.
- [ ] Add `updateUnitsPreference(next: UnitSystem)` API client for
      `PATCH /api/v1/auth/preferences`.
- [ ] Add a mutation hook that updates `authQueryKeys.session` on
      success.
- [ ] Add `UnitPreferenceProvider` around the app in
      `AppProviders`.
- [ ] Preference hydrate order:
      - authenticated session value when present;
      - `localStorage["phn.units_preference"]` for anonymous users;
      - `SI` default.
- [ ] In authenticated mode, optimistically update UI and then persist
      to the server.
- [ ] On preference update failure, show a non-blocking inline/toast
      error and roll back to the last confirmed server value.
- [ ] In anonymous mode, update local storage only.
- [ ] Add `UnitSystemToggle` as a compact two-button segmented control.
- [ ] Place the toggle at the right side of `VersionShellControls`,
      after save/actions controls, matching `context/UI_UX.md`.
- [ ] Keep the toggle enabled for:
      - unlocked editor versions;
      - locked editor versions;
      - public viewer mode.
- [ ] Public viewer controls currently use the viewer branch in
      `VersionControls`; make sure that branch includes the toggle.
- [ ] Add CSS for compact segmented-control state without disturbing
      existing Save/version controls.
- [ ] Ensure toggle clicks do not call any draft/table write mutation.

### 5.4 Frontend Tests

- [ ] Provider hydrates from authenticated session.
- [ ] Provider hydrates from local storage when no session exists.
- [ ] Authenticated toggle calls `PATCH /api/v1/auth/preferences` and
      updates the session query cache.
- [ ] Anonymous toggle does not call the API and writes local storage.
- [ ] Failed authenticated update rolls back or clearly marks failure.
- [ ] `VersionShellControls` renders accessible `IP` and `SI` buttons.
- [ ] Toggle remains visible in viewer controls.
- [ ] Toggling does not invoke `save`, `saveAs`, draft `PATCH`, or
      table-slice replace mutations.

### 5.5 Phase Gate

Commands:

```bash
cd frontend
pnpm test
pnpm run build
pnpm run format
```

## 6. Phase 3 - Shared Unit Helpers

### 6.1 Scope

Create the reusable conversion foundation without wiring every future
surface. Start with helpers needed by current catalogs/window values and
near-term builders.

### 6.2 Target Files

```text
frontend/src/lib/units/types.ts
frontend/src/lib/units/format.ts
frontend/src/lib/units/length.ts
frontend/src/lib/units/area.ts
frontend/src/lib/units/volume.ts
frontend/src/lib/units/thermal.ts
frontend/src/lib/units/airflow.ts
frontend/src/lib/units/pressure.ts
frontend/src/lib/units/power.ts
frontend/src/lib/units/temperature.ts
frontend/src/lib/units/index.ts
frontend/src/lib/units/*.test.ts
```

Only add helper files whose functions are actually implemented and
tested in this phase. It is acceptable to defer pressure/power if no
consumer lands in Phase 4, but keep the module roster in the plan for
future builders.

### 6.3 Helper API Checklist

- [ ] Define `UnitSystem = "SI" | "IP"`.
- [ ] Define shared format options:
      - `unitSystem`;
      - `fractionDigits`;
      - `showUnit`;
      - optional `empty` fallback.
- [ ] Define parse result:
      `{ ok: true; valueSi: number } | { ok: false; code; message }`.
- [ ] Add length helpers:
      - `formatLengthFromMm`;
      - `parseLengthToMm`;
      - `formatAreaFromM2`;
      - `formatVolumeFromM3`.
- [ ] Add thermal helpers:
      - `formatUValueFromWm2K`;
      - `formatRValueFromM2KPerW`;
      - `formatLinearPsiFromWmK`;
      - `formatConductivityFromWmK`;
      - optional explicit `formatRPerInFromConductivityWmK`.
- [ ] Add material helpers:
      - `formatDensityFromKgM3`;
      - `formatSpecificHeatFromJKgK` if the catalog page renders it.
- [ ] Add airflow helpers only when the first consumer lands:
      - `formatAirflowFromM3H`;
      - `formatAirflowFromM3S`.
- [ ] Add temperature helper with offset conversion, not factor-only
      math.
- [ ] Make formatting deterministic and locale-independent for tests.
- [ ] Return blank/emdash handling from wrapper options, not from
      conversion functions.

### 6.4 Fixture Requirements

Add direct tests for at least:

- [ ] `25.4 mm = 1 in`.
- [ ] `304.8 mm = 1 ft`.
- [ ] `1 m2 = 10.7639104167 ft2`.
- [ ] `1 m3 = 35.3146667215 ft3`.
- [ ] `1 W/(m2-K) = 0.1761101838 Btu/(h-ft2-F)`.
- [ ] `1 m2-K/W = 5.678263337 h-ft2-F/Btu`.
- [ ] `1 W/(m-K) = 0.577789317 Btu/(h-ft-F)`.
- [ ] `1 kg/m3 = 0.06242796 lb/ft3`.
- [ ] `1 m3/h = 0.588577779 cfm`.
- [ ] `0 deg C = 32 deg F`.

Use tolerances tighter than UI display precision.

### 6.5 Phase Gate

Commands:

```bash
cd frontend
pnpm test -- units
pnpm test
pnpm run build
```

Adjust the focused test pattern to the final Vitest file names.

## 7. Phase 4 - First Consumers

### 7.1 Scope

Wire enough real UI to prove the foundation works before handing it to
Window Builder and Assembly Builder.

Initial consumers:

- catalog list pages;
- catalog editor modals;
- Windows frame/glazing picker values already visible in the current
  Windows tab;
- any existing window value displays that show `width_mm`,
  `u_value_w_m2k`, `psi_g_w_mk`, `psi_install_w_mk`, or `g_value`.
- any Assembly Builder UI that exists by the time this phase lands,
  especially material previews/cards and thermal labels.

### 7.2 Target Files

```text
frontend/src/features/catalogs/components/form-helpers.ts
frontend/src/features/catalogs/components/MaterialEditorModal.tsx
frontend/src/features/catalogs/components/FrameTypeEditorModal.tsx
frontend/src/features/catalogs/components/GlazingTypeEditorModal.tsx
frontend/src/features/catalogs/routes/MaterialsCatalogPage.tsx
frontend/src/features/catalogs/routes/FrameTypesCatalogPage.tsx
frontend/src/features/catalogs/routes/GlazingTypesCatalogPage.tsx
frontend/src/features/windows/components/CatalogPickerSlot.tsx
frontend/src/features/windows/components/...window value display components...
frontend/src/features/windows/lib.ts
frontend/src/features/catalogs/__tests__/... NEW/UPDATED
frontend/src/features/windows/__tests__/... NEW/UPDATED
```

### 7.3 Catalog Checklist

- [ ] Replace generic `formatNumber` for physical values with unit
      helpers:
      - material conductivity;
      - material density;
      - material specific heat if present;
      - frame width;
      - frame U-value;
      - frame glass-edge psi;
      - frame install psi;
      - glazing U-value.
- [ ] Keep `g_value`, emissivity, SHGC-like values unitless.
- [ ] Catalog table headers update by active unit system.
- [ ] Catalog editor labels update by active unit system.
- [ ] Catalog editor seed values are converted from SI to display units.
- [ ] Catalog editor submit converts display input back to canonical SI.
- [ ] Empty strings still submit `null`.
- [ ] Invalid numeric input still disables submit or surfaces the
      current modal validation behavior.
- [ ] No catalog API payload field names change.

### 7.4 Windows Checklist

- [ ] Frame/glazing picker cards render physical values through unit
      helpers.
- [ ] Local override tracking still compares canonical SI values.
- [ ] Refresh-from-catalog diff/review still compares canonical SI
      values; if it displays values, display labels follow the active
      unit system.
- [ ] `g_value` remains unitless.
- [ ] No `window_types` draft write happens from toggling alone.

### 7.5 DataTable Deferral Note

Do not retrofit the generic shared DataTable number path in this phase.
The first unit-aware DataTable column should be added when a concrete
built-in physical table column needs it. The consuming feature should
own a non-persisted quantity descriptor; custom `number` fields remain
unitless.

### 7.6 Assembly Builder Handoff Checklist

Plan 32 does not need to build the Assembly Builder, but it must leave a
foundation that the Assembly Builder plans can consume without local
conversion code.

- [ ] Length helpers support layer `thickness_mm`, segment `width_mm`,
      and `steel_stud_spacing_mm` display/input.
- [ ] Thermal helpers support effective U-value, effective R-value,
      conductivity / lambda, and explicit `R/in` from conductivity.
- [ ] Material helpers support density and specific heat display/input.
- [ ] Active editor behavior is documented and tested well enough that
      Assembly Builder modals can keep focused input strings stable
      across unit toggles.
- [ ] Helper APIs are exported through `frontend/src/lib/units/index.ts`
      so Assembly Builder imports do not reach into helper internals.
- [ ] Assembly Builder phase docs identify every physical UI surface
      that must consume these helpers.

### 7.7 Tests

- [ ] Catalog list renders SI labels by default.
- [ ] Toggle to IP updates catalog labels and displayed values.
- [ ] Editing a material/frame/glazing value in IP sends canonical SI
      in the mutation payload.
- [ ] Empty physical inputs still produce `null`.
- [ ] Unitless values are not converted.
- [ ] Window picker values update on toggle.
- [ ] Toggling units does not mutate refresh override flags.

### 7.8 Phase Gate

Commands:

```bash
cd frontend
pnpm test -- catalogs
pnpm test -- windows
pnpm test
pnpm run build
pnpm run format
```

Adjust focused test patterns to actual filenames.

## 8. Phase 5 - Browser Acceptance And Docs Closeout

### 8.1 Browser Scenarios

Run against a local dev server first. If this is intended to close a
roadmap slice, repeat the meaningful checks against staging/Render.

- [ ] Editor opens a project workspace.
- [ ] Header shows `SI` active by default for a fresh user.
- [ ] Save state is clean.
- [ ] Toggle SI to IP.
- [ ] Catalog/window physical values visibly change.
- [ ] Save state remains clean.
- [ ] Reload; authenticated IP preference persists.
- [ ] Toggle IP back to SI; reload; SI persists.
- [ ] Lock/open a locked version; toggle still works.
- [ ] Open public viewer route in a clean browser context.
- [ ] Viewer toggle works and persists only in local storage.
- [ ] Network panel or Playwright request log confirms anonymous viewer
      does not call `PATCH /api/v1/auth/preferences`.
- [ ] Project JSON download after toggling still contains SI canonical
      field names and values.
- [ ] If Assembly Builder routes exist, toggle units there and verify
      layer/segment labels, material values, and thermal labels update
      without creating a draft or changing canvas proportions.

### 8.2 E2E/Test Additions

Prefer a focused Playwright spec if the existing E2E setup is stable:

```text
frontend/e2e/unit-system-toggle.spec.ts
```

Assertions:

- [ ] logged-in preference persists through reload;
- [ ] anonymous viewer preference is local-only;
- [ ] draft summary/save state is unchanged by toggling;
- [ ] project JSON remains SI canonical.

If backend tests reset auth tables, reseed before browser checks:

```bash
make seed-dev-user
```

### 8.3 Docs Closeout

- [ ] If implementation matches the PRD exactly, leave stable
      `context/` docs alone and record completion only in this plan.
- [ ] If route names, fallback behavior, or helper API shape differs
      from the PRD, update:
      - `planning/features/ip-si-unit-switching/PRD.md`;
      - `context/technical-requirements/frontend-viewer-units.md`;
      - `context/UI_UX.md` if header placement changed;
      - relevant user-story text if behavior changed.
- [ ] Grep for stale claims that unit switching is still unimplemented.
- [ ] Record any conversion-factor or active-editor lessons in this
      plan's "Lessons Learned" section before marking complete.

## 9. Full Verification Matrix

Backend:

```bash
cd backend
uv run alembic upgrade head
uv run ruff check .
uv run ty check
uv run pytest
```

Frontend:

```bash
cd frontend
pnpm test
pnpm run build
pnpm run format
```

Browser:

```bash
make dev
make e2e
```

If `make e2e` is too broad or blocked by unrelated environment issues,
run the focused Playwright spec and document the blocker.

## 10. Rollout Order

Implement in this order:

1. [ ] Backend API and session payload.
2. [ ] Frontend preference provider and toggle with no consumers beyond
       a visible state change.
3. [ ] Unit helper modules with fixture tests.
4. [ ] Catalog list/editor consumers.
5. [ ] Windows visible-value consumers.
6. [ ] Browser acceptance.
7. [ ] Docs closeout.

Do not start Assembly Builder or Window Builder dimension parsing on top
of this until steps 1-3 are green. Do not mark this plan complete until
at least one real physical-value consumer proves the toggle is more than
stored preference plumbing.

## 11. Deferred Work

- [ ] Window Builder dimension format preferences:
      `window_builder_dim_format_si` and
      `window_builder_dim_format_ip`.
- [ ] Generic unit-aware DataTable built-in column descriptors.
- [ ] Runtime custom-field unit dimensions.
- [ ] Formula unit algebra.
- [ ] Equipment schema cleanup for legacy IP-named fields such as
      `flow_gpm`.
- [ ] Model viewer info-panel unit descriptor implementation.
- [ ] Assembly Builder implementation itself; this plan provides helper
      readiness and handoff gates, while the Assembly Builder phase docs
      own the actual envelope UI consumers.

## 12. Lessons Learned

Append during implementation:

- [ ] Preference API route/name final decision.
- [ ] Whether optimistic toggle rollback or local-only failure state felt
      better in browser testing.
- [ ] Any conversion-factor corrections compared with V1.
- [ ] Any active-editor behavior surprises.
- [ ] Any stale context/story docs found during closeout.
