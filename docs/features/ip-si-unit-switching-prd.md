---
DATE: 2026-05-26
TIME: 18:37 EDT
STATUS: DRAFT FEATURE PRD - IP/SI unit switching API and display foundation
AUDIENCE: Future coding agents implementing PH-Navigator V2
SCOPE: Per-user units preference API, project-header toggle, frontend
       unit-helper foundation, display/input conversion contracts, and
       the initial retrofit path for existing numeric surfaces.
RELATED:
  - context/PRD.md
  - context/technical-requirements/frontend-viewer-units.md
  - context/UI_UX.md
  - context/user-stories/00-foundation-shell.md
  - context/user-stories/10-windows.md
  - context/user-stories/20-envelope.md
  - context/user-stories/40-model-viewer.md
  - context/technical-requirements/data-model.md
  - ../ph-navigator/frontend/src/features/project_view/_components/UnitSystemToggle.tsx
  - ../ph-navigator/frontend/src/features/project_view/_contexts/UnitSystemContext.tsx
  - ../ph-navigator/frontend/src/features/project_view/_hooks/useUnitConversion.tsx
  - ../ph-navigator/frontend/src/formatters/Unit.Converter.ts
  - ../ph-navigator/frontend/src/formatters/Unit.ConversionFactors.ts
---

# PH-Navigator V2 - IP/SI Unit Switching Feature PRD

## 1. Why this doc exists

The IP/SI unit toggle is a foundation feature, not a visual preference
to bolt onto the Assembly Builder, Window Builder, or Model viewer after
those surfaces exist. Those features will all expose physical quantities:
U-values, R-values, psi-values, material conductivity, frame widths,
window row/column dimensions, layer thicknesses, areas, volumes,
airflows, pressures, and equipment capacities. If each feature builds
its own unit handling, PHN will quickly accumulate inconsistent
rounding, ambiguous edit semantics, and hard-to-audit server payloads.

V2 already has the hard architectural decision in place:

- all stored, transported, downloaded, computed, and MCP-visible values
  are SI canonical;
- IP/SI conversion is frontend display/input behavior only;
- the user preference is per-user as `users.units_preference`;
- TypeScript should use focused quantity-specific helpers under
  `frontend/src/lib/units/`, using V1 as research precedent but not as
  an import path or blind constants source.

This PRD turns those decisions into an implementable feature contract.
It should be completed before advanced builder work relies on physical
numeric fields.

## 2. Product Goal

Editors and public viewers can switch between SI and IP display modes
from the project header. The switch must immediately re-render physical
numeric values in the active project workspace without changing the
project document, creating a draft, altering server-side calculations,
or changing API/MCP/download payload units.

For authenticated users, the preference persists across sessions as a
server-side user setting. For unauthenticated viewers, the preference is
local to the browser because there is no user row to update.

The result is a shared units foundation that later Window, Envelope,
Equipment, Catalog, and Model surfaces can consume without re-solving
unit conversion.

## 3. Existing Decisions To Preserve

### 3.1 SI is canonical everywhere outside the React display layer

SI-only applies to:

- `project_versions.body` and `project_version_drafts.body`;
- REST request and response bodies;
- JSON-Patch `op.value` payloads;
- catalog tables;
- project and table JSON downloads;
- MCP tool inputs and outputs;
- backend calculations and validation.

Field names must continue to carry their canonical SI unit when the
field has physical units, for example `width_mm`, `u_value_w_m2k`,
`psi_g_w_mk`, `conductivity_w_mk`, `density_kg_m3`, and
`airflow_m3h`.

### 3.2 The backend never converts for a user preference

Do not add request headers, query parameters, route variants, or user
preference branches that cause the backend to return IP values. A
request to update `users.units_preference` changes only the user's UI
preference. It does not change document values.

### 3.3 Custom number fields remain unitless in v1

`context/technical-requirements/data-model.md` intentionally defers
unit dimensions for runtime custom number fields. This feature must not
silently infer units for custom `number` fields, formula outputs, or
generic DataTable number cells. Those values render as plain numbers
until a later custom-field unit-dimension feature explicitly designs
that contract.

### 3.4 Unit system and display format are separate

The project-header toggle chooses the system: `SI` or `IP`.

Some builders need a second preference for format inside a system. The
Window Builder dimensions panel is the known example: SI can display as
`mm`, `cm`, or `m`; IP can display as decimal inches, decimal feet,
feet-and-inches, or fractional inches. Those format selectors are not
the same feature as the project-header IP/SI toggle.

This feature may reserve preference names for future format selectors,
but it should not block the foundation work on full Window Builder
format UI.

## 4. Users And Modes

### 4.1 Editors

Editors are authenticated BLDGTYP users. They can:

- see the IP/SI toggle in the project header;
- switch units in any project workspace tab;
- have the preference persisted to their user account;
- edit converted numeric inputs, where a feature-specific parser exists,
  with the frontend converting back to SI before draft/API writes.

Unit toggling does not require an unlocked project version. Locked
versions stay read-only, but unit display is still switchable.

### 4.2 Public viewers

Public viewers are unauthenticated users with a project URL. They can:

- see the same project workspace routes as editors;
- use the IP/SI toggle for display;
- persist the preference only in browser local storage.

Public viewer toggling never attempts a write to the user-preference
API because there is no authenticated user. If the viewer later signs
in, the server-side preference becomes authoritative after session
hydrate.

### 4.3 MCP and API clients

MCP and REST clients always receive and send SI values. The unit
preference API is only a UI preference endpoint for authenticated users;
it is not part of the document-editing or MCP-write contract.

## 5. Scope

### 5.1 In Scope

- Add `users.units_preference` with allowed values `SI` and `IP`,
  default `SI`.
- Extend authenticated session payloads so the frontend can hydrate the
  user's current preference.
- Add a current-user preference update API.
- Add a frontend unit-preference provider/store with authenticated
  server hydration and anonymous/local fallback.
- Add the project-header IP/SI segmented control.
- Create focused TypeScript unit helpers under `frontend/src/lib/units/`.
- Port V1 conversion precedent as tests and implementation guidance,
  verifying every factor before use.
- Add display/input contracts for typed physical quantities.
- Provide the first implementation hooks for current physical surfaces:
  catalog lists/editors, Window-type frame/glazing values, future
  builder dimensions, and Model info-panel fields.
- Ensure toggling units does not create or dirty a project draft.
- Add backend, frontend, and browser-level verification gates.

### 5.2 Out Of Scope For This Feature

- Backend-side conversion based on user preference.
- IP values in document JSON, table JSON, MCP, or catalog responses.
- Full Python `PH_units` port.
- A generic "convert any unit to any unit" dependency.
- Runtime custom-field unit dimensions.
- Formula unit algebra.
- Full Window Builder dimension-format selector UI.
- Reworking existing equipment fields whose names already encode IP
  semantics, such as `flow_gpm`. Those are legacy/debt fields until the
  Equipment feature designs its canonical SI names.
- Migrating saved project documents.
- Changing V1.

## 6. Backend Contract

### 6.1 Database

Add a migration after the current head:

```sql
ALTER TABLE users
ADD COLUMN units_preference text NOT NULL DEFAULT 'SI';

ALTER TABLE users
ADD CONSTRAINT users_units_preference_allowed
CHECK (units_preference IN ('SI', 'IP'));
```

The default is `SI` to match current behavior and the PRD. Existing user
rows become `SI` on migration.

### 6.2 Pydantic models

Add a narrow unit-system type:

```python
UnitSystem = Literal["SI", "IP"]
```

Extend `UserPublic`:

```python
class UserPublic(BaseModel):
    id: UUID
    email: EmailStr
    display_name: str
    units_preference: UnitSystem
```

All auth repository reads that hydrate `UserPublic` must select
`units_preference`.

### 6.3 API routes

Existing route:

```http
GET /api/v1/auth/session
```

Continue returning:

```json
{
  "user": {
    "id": "...",
    "email": "ed@example.com",
    "display_name": "Ed",
    "units_preference": "SI"
  },
  "expires_at": "..."
}
```

New route:

```http
PATCH /api/v1/auth/preferences
Content-Type: application/json

{ "units_preference": "IP" }
```

Response:

```json
{
  "user": {
    "id": "...",
    "email": "ed@example.com",
    "display_name": "Ed",
    "units_preference": "IP"
  },
  "expires_at": "..."
}
```

Rules:

- Requires the normal editor session cookie.
- Rejects anonymous requests with 401.
- Rejects invalid values with 422.
- Updates only the current authenticated user's row.
- Logs a `user_action_log` entry, for example
  `auth.units_preference.updated`, with before/after values.
- Does not touch sessions except normal sliding-expiration behavior
  already owned by auth.
- Does not touch projects, project versions, drafts, catalog rows, or
  MCP tokens.

### 6.4 Repository and service shape

Keep this in the auth feature unless a broader user-preferences feature
already exists by implementation time:

- `features/auth/models.py`: request/response models.
- `features/auth/repository.py`: raw SQL getter/updater.
- `features/auth/service.py`: current-user preference workflow and
  audit logging.
- `features/auth/routes.py`: `PATCH /preferences`.

The route is small enough that adding a separate `users` feature would
be premature unless other user-profile settings land at the same time.

## 7. Frontend Contract

### 7.1 Unit preference state

Add a shared preference layer that exposes:

```typescript
export type UnitSystem = "SI" | "IP";

export type UnitPreferenceState = {
  unitSystem: UnitSystem;
  source: "server" | "local" | "default";
  setUnitSystem: (next: UnitSystem) => void;
  toggleUnitSystem: () => void;
};
```

Behavior:

- Default to `SI`.
- Hydrate from authenticated session when available.
- In unauthenticated Viewer mode, hydrate from local storage.
- Persist anonymous/local fallback under a namespaced key such as
  `phn.units_preference`.
- In authenticated mode, update UI immediately and persist to the
  server in the background.
- On successful server update, update the auth session query cache.
- On failed server update, show a concise non-blocking error and either
  roll back to the last confirmed server value or mark the state as
  local-only for the current tab. The implementation should choose one
  behavior and test it; silent failure is not acceptable.

V1 precedent used `localStorage` only in `UnitSystemContext`. V2 keeps
that as the anonymous fallback, not the authenticated source of truth.

### 7.2 Project-header toggle

The toggle belongs in the project header controls, adjacent to the
version/dropdown/save controls described in `context/UI_UX.md`.

UI contract:

- Render as a compact segmented control with `IP` and `SI` labels.
- Expose keyboard and screen-reader state through normal button or
  radio-group semantics.
- Include a tooltip such as "Display units: SI" / "Display units: IP".
- Stay enabled on locked versions and in public Viewer mode.
- Do not appear in non-project top-level pages unless that page renders
  physical project quantities. Catalog manager pages can read the same
  preference without duplicating the control in their first slice.

Interaction:

- Toggle re-renders numeric display immediately.
- Toggle does not refetch the project document.
- Toggle does not create a draft or dirty state.
- Toggle may call the preference API in authenticated mode, but display
  must not wait on that API roundtrip.

### 7.3 Units module shape

Create focused helpers under:

```text
frontend/src/lib/units/
```

Recommended files:

```text
types.ts
preference.tsx
format.ts
length.ts
area.ts
volume.ts
thermal.ts
airflow.ts
pressure.ts
power.ts
temperature.ts
index.ts
```

Public APIs should be quantity-specific and explicit:

```typescript
formatLengthFromMm(valueMm, options)
parseLengthToMm(input, options)
formatAreaFromM2(valueM2, options)
formatUValueFromWm2K(valueWm2K, options)
formatRValueFromM2KPerW(valueM2KPerW, options)
formatLinearPsiFromWmK(valueWmK, options)
formatConductivityFromWmK(valueWmK, options)
formatAirflowFromM3H(valueM3H, options)
formatAirflowFromM3S(valueM3S, options)
parseAirflowToM3H(input, options)
```

Avoid exposing V1's generic `convertValue(value, fromUnit, toUnit)` as
the main application API. A small internal factor table is fine, but
feature code should call named quantity helpers so reciprocal and
domain-specific quantities stay explicit.

### 7.4 Parse result shape

All editable parsers should return structured results:

```typescript
type UnitParseResult =
  | { ok: true; valueSi: number }
  | {
      ok: false;
      code: "empty" | "invalid_number" | "unsupported_unit" | "negative" | "zero" | "out_of_range";
      message: string;
    };
```

The caller decides whether empty input maps to `null`, `0`, or a
validation error. Do not bake row-default semantics into the unit
helpers.

### 7.5 Active edit behavior

When a user toggles units while a numeric editor is open:

- Do not rewrite the draft string under the cursor.
- Surrounding committed cells may re-render immediately.
- The active editor should keep the user's typed value until commit or
  cancel.
- On commit, parse according to the editor's visible unit context and
  convert to SI before writing.
- Feature-specific parsers may accept explicit unit suffixes like
  `2.5 in` or `50 mm`; API payloads still send a number in the
  canonical SI field unit.

This avoids the "I was typing and the app rewrote my input" failure
mode.

## 8. Quantity Roster And Display Rules

This roster is the initial target. Add helpers only when a real surface
needs them, but use these names and conventions when it does.

| Quantity | Canonical field examples | SI display | IP display | Notes |
|---|---|---|---|---|
| Length | `width_mm`, `thickness_mm`, `row_heights_mm` | `mm`, `cm`, or `m` by context | `in`, `ft`, `ft-in`, or fractional `in` by context | Unit system is global; exact dimension format can be a per-builder preference. |
| Area | `area_m2`, `floor_area_m2` | `m2` | `ft2` | Positive linear conversion. |
| Volume | `volume_m3`, `net_volume_m3` | `m3` | `ft3` | Positive linear conversion. |
| U-value | `u_value_w_m2k` | `W/(m2-K)` | `Btu/(h-ft2-F)` | Do not round so hard that PH targets become ambiguous. |
| R-value | derived or `r_value_m2k_w` | `m2-K/W` | `h-ft2-F/Btu` or `R-#` label | Usually derived as `1 / U` for assemblies. Keep reciprocal semantics explicit. |
| Linear psi-value | `psi_g_w_mk`, `psi_install_w_mk` | `W/(m-K)` | `Btu/(h-ft-F)` | Same linear conductance conversion as W/m-K. |
| Conductivity | `conductivity_w_mk` | `W/(m-K)` | `Btu/(h-ft-F)` and/or `R/in` | Material UX often wants `R/in`; expose it as a named helper, not as generic conductivity. |
| Density | `density_kg_m3` | `kg/m3` | `lb/ft3` | Catalog material helper. |
| Specific heat | `specific_heat_j_kgk` | `J/(kg-K)` | `Btu/(lb-F)` | Future material/helper field. |
| Airflow | `airflow_m3h`, `supply_air_m3s` | `m3/h` or `m3/s` by wire contract | `cfm` | Model viewer uses `m3/s` on wire; some equipment tables may use `m3/h`. Keep separate helpers. |
| Pressure | `pressure_pa` | `Pa` | `in. w.c.` where useful | Blower-door references may remain Pa even in IP mode if the domain convention demands it. |
| Power/capacity | `power_w`, `capacity_w` | `W` or `kW` | `Btu/h` | Only add when equipment surfaces require it. |
| Temperature | `temperature_c` | `deg C` | `deg F` | Offset conversion; never implement as a simple factor-only helper. |
| SHGC / g-value | `g_value`, `shgc` | unitless | unitless | No conversion. |
| ACH50 | `ach50` | `1/h` | `1/h` | No conversion; suffix/label only. |
| iCFA | `icfa_m2` if canonicalized | `m2` | `ft2` | Use the area helper; preserve the domain label `iCFA`. |

## 9. Display/Input Integration Rules

### 9.1 Display-only fields

For simple display cells, cards, labels, and info panels:

- read SI value from API/document state;
- call the quantity helper with the current `unitSystem`;
- render a number plus unit suffix;
- treat `null` and `undefined` as blank or `-` according to the
  local component's existing empty-state pattern.

### 9.2 Editable fields

For editable physical values:

- seed the editor from the SI value converted to the current display
  unit;
- on commit, parse the displayed input;
- convert to canonical SI;
- write the SI number to the existing draft/API path.

The server must receive the same shape it would have received in an
SI-only UI.

### 9.3 DataTable integration

The shared DataTable currently treats `number` as unitless. Preserve
that default.

When a built-in physical column needs conversion, prefer a render-time
descriptor on the consuming column definition first, for example:

```typescript
{
  id: "width_mm",
  fieldKey: "width_mm",
  header: "Width",
  accessor: (row) => row.width_mm,
  unit: { quantity: "length", canonical: "mm" }
}
```

Implementation may place that descriptor on `DataTableColumnDef` rather
than persisted `FieldDef` to avoid implying custom-field unit support.
If a later implementation chooses `FieldDef`, it must keep the field
non-user-mutable for built-ins and keep custom numbers unitless.

Filtering and aggregations need care:

- Sorting is safe for positive linear conversions because order is
  preserved.
- Numeric filters for converted built-ins should interpret user-entered
  filter values in the active display unit and compare after converting
  to canonical SI.
- Aggregation display should aggregate canonical values and then format
  the result for linear quantities.
- Reciprocal/derived values such as R-value from U-value should not use
  generic number aggregation without an explicit domain decision.

### 9.4 Catalog and picker surfaces

Catalog APIs stay SI. Catalog list pages, editor modals, and bookshelf
pickers should use the shared unit helpers for physical values:

- Materials: conductivity and density.
- Frame types: width, U-value, glass-edge psi, install psi.
- Glazing types: U-value; `g_value` remains unitless.

Catalog editor modals must convert input back to SI before submit. They
must not change the catalog API contract.

### 9.5 Window Builder dimension surfaces

Window Builder dimensions use `row_heights_mm` and `column_widths_mm`.
This feature should provide the length parse/format helpers needed by
US-WIN-10, but the full dimensions panel can land with the Window
Builder slice.

Known future preferences:

- `users.window_builder_dim_format_si`
- `users.window_builder_dim_format_ip`

Do not add these columns in the foundation slice unless the dimensions
panel is implemented at the same time.

### 9.6 Envelope Builder surfaces

Envelope Builder should use this foundation for:

- layer thickness in `thickness_mm`;
- material conductivity in `conductivity_w_mk`;
- displayed R-value / U-value summaries;
- segment widths and proportional canvas labels;
- future thermal-bridge psi-value display.

The Assembly Builder must not hard-code SI labels the way V1's material
detail modal did.

### 9.7 Model viewer surfaces

The Model viewer info panel should declare per-field unit descriptors,
as already sketched in `context/user-stories/40-model-viewer.md`.
The renderer reads the same preference state and applies the same
helpers.

The `/model_data` endpoint remains SI canonical. For example, if the
viewer wire contract uses `m3/s` for ventilation, the frontend converts
that to CFM for IP display.

## 10. V1 Precedent And What Changes In V2

### 10.1 Keep from V1

V1 gives useful precedent:

- `UnitSystemContext.tsx` establishes a simple `SI | IP` context.
- `UnitSystemToggle.tsx` proves the header toggle mental model.
- `useUnitConversion.tsx` distinguishes display conversion from
  conversion back to SI.
- `Unit.Converter.ts` and `Unit.ConversionFactors.ts` provide a small
  factor-table shape and a starting roster.

### 10.2 Change for V2

V2 changes the implementation contract:

- Authenticated preference persists in Postgres, not only
  `localStorage`.
- Anonymous viewer preference is local fallback only.
- Helpers are quantity-specific, not generic unit-pair conversions as
  the public API.
- Thermal reciprocal quantities are verified with fixtures before use.
- Display/input conversion is part of reusable frontend infrastructure,
  not local to one feature folder.
- The project header toggle must fit the V2 workbench shell, not carry
  over the V1 MUI switch styling.

### 10.3 Conversion-factor caveat

Do not copy V1 constants blindly. Lift the factor roster and tests as
precedent, then verify every factor against known fixtures.

Minimum fixture examples:

- `25.4 mm = 1 in`
- `304.8 mm = 1 ft`
- `1 m2 = 10.7639104167 ft2`
- `1 m3 = 35.3146667215 ft3`
- `1 W/(m2-K) = 0.1761101838 Btu/(h-ft2-F)`
- `1 m2-K/W = 5.678263337 h-ft2-F/Btu`
- `1 W/(m-K) = 0.577789317 Btu/(h-ft-F)`
- `1 kg/m3 = 0.06242796 lb/ft3`
- `1 m3/h = 0.588577779 cfm`
- `0 deg C = 32 deg F`

Use tolerances appropriate to display precision, but keep internal
round-trip tests stricter than UI formatting.

## 11. Acceptance Criteria

### 11.1 Backend

1. Migration adds `users.units_preference` with default `SI`, not null,
   and an allowed-value check.
2. Existing users migrate to `SI`.
3. `GET /api/v1/auth/session` returns `user.units_preference`.
4. `PATCH /api/v1/auth/preferences` persists `SI` or `IP` for the
   current authenticated user and returns the updated session payload.
5. Invalid values return 422.
6. Anonymous preference updates return 401.
7. Preference changes write a `user_action_log` entry with before/after
   values.
8. No project document, draft, catalog, download, or MCP endpoint
   changes its numeric unit contract.

### 11.2 Frontend preference and toggle

1. The project header renders an IP/SI segmented control for editors and
   public viewers.
2. Authenticated users hydrate from `user.units_preference`.
3. Anonymous viewers hydrate from `phn.units_preference` or default SI.
4. Toggling immediately updates unit display without waiting for a
   network roundtrip.
5. Authenticated toggles persist to the preference API and update the
   session query cache.
6. Anonymous toggles never call the preference API and persist locally.
7. Toggling units never marks the project draft dirty.
8. Locked versions and Viewer mode still allow unit switching.
9. Keyboard and screen-reader behavior is covered by component tests.

### 11.3 Units library

1. Focused helpers exist under `frontend/src/lib/units/`.
2. Helpers cover the first real quantity families needed by current and
   next builder surfaces: length, area, volume, U/R/psi/conductivity,
   density, airflow, pressure, power, and temperature as they become
   consumed.
3. Parse helpers return structured success/error results.
4. Formatting helpers make precision and suffix explicit.
5. Round-trip tests cover display to SI to display for each implemented
   quantity.
6. Reciprocal thermal helpers have direct fixture tests.
7. No generic custom number field is converted by default.

### 11.4 Initial consumer behavior

1. Catalog physical values render through unit helpers.
2. Catalog editor modals submit canonical SI after editing in the active
   display system.
3. Window frame/glazing picker values render through unit helpers.
4. Future Window Builder dimensions can reuse the length parser without
   reworking preference state.
5. Future Envelope Builder layer/material/R-value surfaces can reuse the
   thermal helpers without reworking preference state.
6. Future Model viewer info fields can use unit descriptors without
   adding a second preference store.

### 11.5 Verification gates

Backend:

```bash
cd backend && uv run pytest
cd backend && uv run ty check
```

Frontend:

```bash
cd frontend && pnpm test
cd frontend && pnpm run build
cd frontend && pnpm run format
```

Browser check:

- Open a project as an editor.
- Toggle SI to IP and back in the project header.
- Confirm displayed physical values change and Save state remains
  clean.
- Reload and confirm authenticated preference persists.
- Open a public viewer route in a clean browser context.
- Toggle units and confirm no authenticated preference request is made.

## 12. Suggested Implementation Phases

### Phase 1 - User preference API

- Add migration and model changes.
- Extend auth repository/service/session payload.
- Add `PATCH /api/v1/auth/preferences`.
- Add backend tests for default, update, invalid value, and anonymous
  rejection.

### Phase 2 - Unit preference state and toggle shell

- Add frontend preference provider/store.
- Add authenticated and anonymous hydration.
- Add API mutation and cache update.
- Add compact project-header segmented control.
- Verify the toggle does not dirty drafts.

### Phase 3 - Units helper foundation

- Add quantity-specific helper modules.
- Port V1 factor tests and add fixture tests for thermal reciprocal
  quantities.
- Add parse/format result types.
- Add local examples for length, U-value, R-value, conductivity,
  density, and airflow.

### Phase 4 - First consumers

- Retrofit catalog list/editor/picker surfaces that already expose
  physical quantities.
- Add unit-aware display hooks for Window-type values already on screen.
- Add extension points for future DataTable physical built-ins without
  converting custom number fields.

### Phase 5 - Browser acceptance and doc closeout

- Add a Playwright check for authenticated persistence and anonymous
  local fallback.
- Confirm no project draft changes are produced by toggling.
- Update stable `context/technical-requirements/frontend-viewer-units.md`
  only if implementation materially changes the contract in this PRD.

## 13. Risks

- **Silent backend conversion.** Any backend conversion based on user
  preference violates the PRD and creates unit ambiguity for MCP and
  downloads.
- **Thermal reciprocal mistakes.** U-value, R-value, conductivity, and
  R/in are easy to invert incorrectly. Use direct fixture tests.
- **Custom-field overreach.** Unit dimensions for runtime custom
  numbers are useful, but they are not this feature. Do not make
  custom-field schema changes here.
- **Active editor churn.** Rewriting a focused input on toggle will
  feel broken. Keep active draft strings stable.
- **Mixed legacy fields.** Some current equipment fields have IP names
  such as `flow_gpm`. Do not pretend those are SI. Either leave them
  unitless for now or migrate them in an Equipment-specific schema
  decision.
- **Format confusion.** `SI` vs `IP` is not the same as `mm` vs `cm` or
  `in` vs `ft-in`. Keep system preference and per-builder display
  format preferences separate.

## 14. Open Questions

1. **Endpoint path.** This PRD proposes
   `PATCH /api/v1/auth/preferences` because the current auth feature
   owns session/current-user state. If a broader user-profile feature
   lands first, the route can move to that feature while keeping the
   same request/response semantics.
2. **Anonymous viewer persistence.** This PRD proposes browser-local
   persistence only. That is the only viable option without public
   user rows.
3. **Catalog manager toggle placement.** Catalog pages may need the same
   preference, but they do not necessarily need a visible duplicate
   toggle in their first slice. The project header is the first required
   placement.
4. **Equipment legacy units.** `flow_gpm` and similar equipment values
   need an explicit Equipment feature decision before conversion.
5. **Window Builder format persistence.** Q-WIN-9 leans per-user
   `window_builder_dim_format_si` and `window_builder_dim_format_ip`,
   but those columns should wait for the dimensions panel unless the
   implementation naturally includes them.

## 15. Definition Of Done

This feature is done when:

- the current authenticated user has a persisted `SI` or `IP`
  preference;
- the project header toggle uses that preference and works in editor,
  locked, and viewer contexts;
- anonymous viewers get local fallback behavior;
- the shared units library has fixture-backed conversions for the
  physical quantities already used by current UI surfaces and the next
  builder surfaces;
- initial physical displays are converted through shared helpers;
- toggling units does not mutate project documents or dirty drafts;
- tests prove API persistence, frontend state behavior, conversion
  round-trips, and at least one browser-level toggle flow.

