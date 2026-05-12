---
DATE: 2026-05-12
TIME: 19:30 EDT
STATUS: Review of TB-04 (Minimal Project Document and Rooms Draft) uncommitted changes.
AUTHOR: Claude (code-review)
SCOPE: Code review of the uncommitted working-tree changes against
       the TB-04 scope as outlined in
       docs/plans/01_IMPLEMENTATION-ROADMAP.md. Not a completeness
       audit against the final app or US-EQ-2 full surface.
RELATED: docs/plans/01_IMPLEMENTATION-ROADMAP.md (TB-04 row),
         context/PRD.md §6, §8,
         context/CODING_STANDARDS.md,
         context/technical-requirements/data-model.md (ProjectDocumentV1),
         context/technical-requirements/save-versioning.md (draft lifecycle, ETag),
         context/technical-requirements/api.md §9.4–9.5,
         context/technical-requirements/data-table.md,
         context/user-stories/30-tables-equipment.md (US-Builder-Tables, US-EQ-1, US-EQ-2).
---

# TB-04 Code Review — Minimal Project Document and Rooms Draft

## Files Reviewed

Modified:
- `backend/features/projects/models.py`
- `backend/main.py`
- `docs/plans/01_IMPLEMENTATION-ROADMAP.md`
- `frontend/src/App.css`
- `frontend/src/App.test.tsx`
- `frontend/src/features/projects/components/ProjectTabContent.tsx`
- `frontend/tests/e2e/health.spec.ts`
- `frontend/vite.config.ts`

Added:
- `backend/alembic/versions/20260512_0005_project_version_drafts.py`
- `backend/features/project_document/{__init__,models,repository,routes,service}.py`
- `backend/tests/test_project_document.py`
- `frontend/src/features/equipment/{api,hooks,lib,lib.test,types}.ts`
- `frontend/src/features/equipment/components/{RoomsTable,RoomModal}.tsx`
- `frontend/src/features/equipment/routes/EquipmentTab.tsx`
- `frontend/src/shared/ui/DataTable.tsx`

## Verdict

**Solid TB-04 tracer.** The lazy-draft path, ETag guards, and document
validation match `save-versioning.md` §8.3/§8.5. Tests, types, and
feature layout are clean. A handful of contract divergences from the
canonical context docs are worth surfacing before TB-05 builds on them.

---

## High-priority issues

### H1. URL shape diverges from `technical-requirements/api.md` §9.4–9.5

Spec mandates explicit `versions/{vid}` scoping and table-name
parameterization:

- Saved read: `GET /api/v1/projects/{pid}/versions/{vid}/document/tables/{name}`
- Draft replace: `PUT /api/v1/projects/{pid}/versions/{vid}/draft/tables/{name}`

Implementation collapses both into
`GET|PUT /api/v1/projects/{pid}/document/rooms`
(`backend/features/project_document/routes.py:13,19,24`):

- Active version is derived implicitly from
  `project.active_version_id` (`service.py:117`).
- Read/draft selection is server-controlled, not client-controlled.
- `rooms` is hardcoded into the path instead of being a `{name}`
  parameter.

This will hurt as soon as TB-05 introduces version switching,
locked-version reads, or other tables (Windows in TB-08, Assemblies in
TB-10). Recommend resolving now — either update `api.md` to match the
simpler shape used here (justified, since the URL is smaller and avoids
a class of "stale vid" mistakes), or restructure routes to match the
spec. Don't let the gap calcify.

### H2. `RoomsSliceReplaceRequest` can silently wipe option lists on partial writes

`backend/features/project_document/models.py:21-28`: the
`model_validator` does `setdefault(key, [])` for both `ROOM_OPTION_KEYS`.
Combined with `apply_rooms_replace` overwriting those keys wholesale
(`service.py:139-140`), a client that PUTs `rooms: [...]` without
`single_select_options` will wipe the existing `rooms.floor_level` /
`rooms.building_zone` options for the project — destroying the user's
option vocabulary.

The browser path always sends the full options list via `cloneOptions`,
but MCP (TB-04b / TB-17) and any future scripted client will hit this.
Choose one of:

- Make `single_select_options` a required field (no `setdefault`);
  reject when missing.
- Treat the body as a PATCH semantic where omitted option keys are not
  touched.
- Document the all-or-nothing whole-slice contract explicitly in the
  route docstring and add a test that asserts "omitted options preserve
  existing".

Pair this with `save-versioning.md` §8.3's note: *"Table/entity
JSON-Patch operations must be guarded with stable-id `test` ops before
mutating array positions."* The replace-table path is the explicit
bypass, but the wipe-by-omission risk isn't called out anywhere.

### H3. Equipment URL contract not honored

`context/user-stories/30-tables-equipment.md` §US-EQ-1 (and Q-EQ-2
resolution, L416): `/projects/{id}/equipment` must redirect to
`/projects/{id}/equipment/rooms`, and each sub-tab gets its own
deep-linkable URL.

Implementation: sub-tab navigation is a row of CSS buttons in
`EquipmentTab.tsx:69-85` with no routing; only Rooms exists, the rest
are `disabled`. For a TB-04 scope this is acceptable as a placeholder,
but the lessons-log / follow-up should call this out so TB-05 / TB-08
don't entrench the no-route pattern.

---

## Medium-priority issues

### M1. DataTable primitive vs `technical-requirements/data-table.md` contract

The spec mandates TanStack Table v8 + `@tanstack/react-virtual` +
shadcn primitives, with `fieldDefs`, `columnDefs`, controlled `view`,
`onWrite`, `density`, `tintTheme`, `unitContext`, `attachmentRenderer`,
multi-cell select, ⌘C-as-TSV, keyboard nav, and frozen first column
(`data-table.md` "Component Shape", `30-tables-equipment.md`
US-Builder-Tables criteria 1–6).

Shipped: a 64-line plain `<table>` with a row-click callback
(`shared/ui/DataTable.tsx`). The lessons log explicitly defers this
("intentionally a small render primitive until the full keyboard/paste
contract is extracted"), so this is acknowledged. Flag: the file is
named `DataTable` and lives at `shared/ui/`, which is the exact name
the canonical contract uses. When TB-05 or a follow-up introduces the
real TanStack primitive, you'll either have a name collision or a quiet
API break. Consider renaming the current one `RoomsListTable` or
`TablePrimitiveStub` to keep the canonical name free for the real
component.

### M2. Dead defensive branch in service layer

`service.py:60-61` raises `not_authenticated` when `access.user is
None`, but the route uses `require_project_edit_access` which already
calls `current_user_from_request` and raises 401 unconditionally
(`features/projects/access.py:50`, `features/auth/service.py:167`). The
`access.user` field is non-`None` whenever the dependency resolves
successfully in edit mode. Either drop the branch or change
`ProjectAccess.user` to be `UserPublic` (not `UserPublic | None`) for
edit-mode instances and let the type system enforce it.

### M3. No `Idempotency-Key` plumbing

`api.md` §9.5 says *"All mutating REST writes accept `Idempotency-Key`.
Replay semantics: scope = (user_id, route, key); TTL = 24 hours."* The
PUT route doesn't accept it and there's no idempotency table /
middleware yet. This is probably correct deferral for TB-04 (no Save
action yet that benefits from replay), but it should be tracked in the
Decision Queue or in TB-05 `Includes`.

### M4. Whole-document re-validation on every Rooms write

`apply_rooms_replace` (`service.py:135-142`) calls `validate_document`
on the entire serialized body. This re-validates pre-existing
assemblies, project_materials, window_types, etc. Today those tables
are all empty `list[dict[str, object]]`, so it's cheap. Once TB-08 /
TB-10 add real validators for window_types and assemblies, every Rooms
write will pay for validating those too — and worse, may fail a Rooms
write because of pre-existing junk in another slice. Consider either:

- Validate only the rooms+options sub-shape on write, full body on
  read.
- Make sure slice writers can't fail on unrelated-slice validation.

Worth noting in TB-04 Lessons before TB-08 lands.

### M5. ID generation entropy & format

`lib.ts:11-14`:
`globalThis.crypto?.randomUUID?.() ?? \`${Date.now()}-${Math.random()}\``
— fallback gives a low-entropy, predictable string. After
`replace(/[^A-Za-z0-9]/g, "")` it's just digits. Not security-sensitive
(these are document keys, not tokens), but spec says ULID; you're using
UUID-hex without hyphens. Either accept the divergence (and update
docs) or generate ULIDs (`ulid` npm package, ~1 KB) so the spec stays
honest. Drop the fallback — if `crypto.randomUUID` is missing, you're
in a non-secure context and should fail loudly.

### M6. Cache invalidation on auth boundary

TB-03.5 lessons (roadmap line 484) explicitly note: *"auth-sensitive
feature queries should either use access-mode-aware keys or participate
in the auth-boundary refresh/clear policy; otherwise public caches can
survive editor login."* The new `roomsQueryKeys.slice(projectId)`
(`hooks.ts:6-8`) is *not* access-mode-aware and isn't refreshed /
cleared by the auth-boundary policy. This is the same bug TB-03.5 fixed
for project queries. Verify and either bump the key or hook it into
`onSignedIn` / `onSignedOut`.

### M7. RoomModal swallows save errors when close happens mid-await

`EquipmentTab.tsx:37-43`: `saveRoom` calls
`replaceRoomsMutation.mutateAsync` and on success closes the modal. On
error it bubbles up to the modal's `try/catch`
(`RoomModal.tsx:50-54`). `setIsSaving(false)` is only set on error,
which is benign today (parent closes the modal on success), but if
anything ever fails to close the modal the button stays disabled.
Minor, but easy to harden.

---

## Low-priority / nits

- **`features/projects/models.py` is now 239 lines** mixing project
  DTOs, document validators, room-row schema, single-select options,
  and Pydantic validators. Soft cap per `CODING_STANDARDS.md` is 300,
  but it's also conceptually two features (project metadata + project-
  document body). Once Windows / Assemblies arrive, this will explode.
  Plan to move `ProjectDocumentV1` / `RoomRow` / `SingleSelectOption` /
  `ROOM_OPTION_KEYS` to `features/project_document/document.py` (or
  similar) so domain stays with the feature that writes it. Currently
  `project_document` imports its core types *from* `projects.models`,
  which inverts the dependency.

- **`apply_rooms_replace` uses `body.model_dump` → `dict` mutate →
  `validate_document`**: works, but it's a round-trip. Prefer building
  a `ProjectDocumentV1.model_copy(update={...})` with explicit
  `tables.rooms` and `single_select_options` replacements, which keeps
  types narrow and skips re-parsing JSON-encoded values.

- **`RoomModal.tsx:43-46`** raises a generic "already exists" toast —
  spec says auto-suffix `(2)`, `(3)` for **duplicate-row** action only,
  so rejecting hand-entered conflicts is correct. Don't change. (Just
  flagging that the duplicate-row affordance isn't in this slice.)

- **`tests/test_project_document.py:24-29`**: `TRUNCATE ...
  project_version_drafts, project_versions, projects, users` — table
  order in a comma-separated TRUNCATE doesn't matter (Postgres handles
  CASCADE), but two identical TRUNCATE blocks (setup+teardown) hurt
  readability. Move to a shared fixture.

- **`frontend/tests/e2e/health.spec.ts`** is now a monolithic flow
  covering sign-in, status, equipment in one test, named
  `health.spec.ts`. Rename and/or split when TB-05 adds Save flows.

- **CSS**: `equipment-panel` (App.css:394) duplicates `status-panel`'s
  grid+gap. Fold to a shared class or leave; minor.

- **Lessons log entry for TB-04** says "shared DataTable path is
  intentionally a small render primitive". Be explicit that this is
  *not* the canonical `<DataTable>` from `data-table.md` and that the
  canonical name is reserved — otherwise a future reader sees "shared
  DataTable already exists" and reuses it.

---

## What's correctly aligned (worth keeping)

- `project_version_drafts` schema matches `save-versioning.md` §8.3
  exactly, including `updated_via` enum with CHECK constraint and
  `last_patched_at` index.
- Lazy draft creation, `If-Match-Version` for first write, `If-Match`
  for subsequent writes — matches §8.5.
- `FOR UPDATE` on both `project_versions` and `project_version_drafts`
  inside one transaction — correct concurrency posture.
- Pydantic single-select duplicate-id, duplicate-label (casefolded +
  trimmed), and missing-option-ref validation — directly enforces
  US-EQ-2 criterion 2 + Q-EQ-2.1.
- Public-viewer write rejection covered by the access dependency, not
  handled ad-hoc in the route.
- Origin-check middleware already covers `PUT /api/v1/projects/{pid}/
  document/rooms` — no per-route CSRF work needed.
- Frontend feature layout (`features/equipment/{api,hooks,lib,types,
  routes,components}`) matches `CODING_STANDARDS.md` §"Required
  Frontend Shape".
- TanStack Query mutation `onSuccess` writes the response into the
  cache (`hooks.ts:23`) — saves a refetch, matches the TB-03.5 lessons
  pattern.

---

## Summary of recommended actions before TB-05

1. **Resolve the API URL shape divergence** (H1) — either update
   `api.md` or the routes.
2. **Close the option-wipe footgun** (H2) — required-field or PATCH
   semantics.
3. **Reserve the `DataTable` name** (M1) — rename the stub.
4. **Decide on the auth-boundary cache policy** for `roomsQueryKeys`
   (M6) before TB-05's Save introduces stale-save risk.
5. **Move `ProjectDocumentV1` / `RoomRow` out of `features/projects/
   models.py`** (nit, but the inversion hurts navigation).

Items M2–M5 and M7 can ride along with TB-05 cleanup.

## Resolution Pass — 2026-05-12 19:20 EDT

Addressed before TB-05:
- H1: Rooms endpoints now use explicit version-scoped saved/draft table
  routes: `/versions/{vid}/document/tables/rooms` for saved reads and
  `/versions/{vid}/draft/tables/rooms` for editor draft read/replace.
- H2: Rooms replace requests now require both
  `rooms.floor_level` and `rooms.building_zone` option lists; missing
  lists fail validation instead of wiping stored vocabulary.
- M1: The temporary table renderer is now `TablePrimitiveStub`, leaving
  the canonical `DataTable` name free for the later TanStack/grid
  contract.
- M6: Auth sign-in invalidates Rooms queries, and sign-out removes them,
  matching the TB-03.5 auth-boundary cache rule.
- Ownership nit: `ProjectDocumentV1`, `RoomRow`,
  `SingleSelectOption`, and room option constants moved to
  `features/project_document/document.py`.

Still deferred:
- H3: Equipment sub-tab routes remain deferred; record under TB-05/TB-18
  before adding more Equipment tables.
- M3: `Idempotency-Key` remains deferred to Save/Save As in TB-05.
- M4: Whole-document validation remains acceptable for this tracer but
  should be revisited before Windows/Assemblies validators land.
- M5: UUID-derived row/option ids remain accepted for now; ULID purity is
  deferred.
- M2/M7: Remaining service/test-scope hardening can ride with TB-05
  cleanup.

## Simplify Pass — 2026-05-12 19:19 EDT

Resolved after the first implementation pass:
- `upsert_draft()` now returns only `draft_etag`, avoiding a full draft
  JSONB round-trip after every Rooms write.
- `apply_rooms_replace()` now uses typed Pydantic copy/update paths
  before final document validation, instead of mutating raw nested
  document dictionaries.
- Frontend room option keys are centralized in `features/equipment/types.ts`;
  the no-op `required` parameter was removed from option upsert logic.
- `EquipmentTab` now uses one discriminated modal state instead of
  parallel `isAdding`/`editingRoom` state.
- `RoomModal` now reuses the shared `errorMessage()` helper.
- `RoomsTable` memoizes sorted rows, option label maps, and column
  definitions.
- `.equipment-panel` now shares the `.status-panel` layout rule.

Still deferred from simplify review:
- Moving shared project literals such as `CertificationProgram` out of
  `features/projects/models.py`; this is a cross-feature boundary cleanup
  best done with the next document-model ownership pass.
- Consolidating repeated backend test helpers into `tests/conftest.py`;
  useful once TB-05 adds more draft/version tests.
- Splitting the broad e2e health flow into smaller specs; do this before
  Save/Discard expands the draft workflow coverage.
- Reworking full-document hashing/validation into slice-specific
  projection; defer until more document tables exist and the hot path is
  measurable.
