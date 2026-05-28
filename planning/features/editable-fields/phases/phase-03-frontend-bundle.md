---
DATE: 2026-05-26
TIME: 22:00 ET
STATUS: IN PROGRESS — foundation slice landed 2026-05-26 (commit
        `891d1c6` on `worktree-plan-31-frontend-bundle`). P2.1
        useTableSchema reshape, P2.2 custom_values row shape, and P2.3
        record_id pinning landed 2026-05-27. Four follow-up slices
        remain.
AUTHOR: Claude (Opus 4.7)
SCOPE: Frontend cascade for Plan-31 Phases 1c, 2, and 3, deferred
       across earlier sessions while backend Phases 1b / 1c / 2 / 3
       landed. Migrates the frontend off the v2 wire shape
       (`slice.custom_fields`, typed-column `RoomRow.number` /
       `PumpRow.tag`) onto the v4 wire shape (`slice.field_defs`,
       mixed-storage `custom_values`).
RELATED:
  - planning/features/editable-fields/PRD.md (master PRD)
  - planning/features/editable-fields/archive/complete/plan-31-phase-3-built-in-type-changes.md (predecessor; backend cohort)
  - planning/features/editable-fields/archive/complete/plan-31-phase-2-record-id-field.md (Phase 2 backend)
  - planning/features/editable-fields/archive/complete/plan-31-phase-1c-rename-cascade-and-fixtures.md (Phase 1c backend)
  - context/technical-requirements/data-model.md §6.6
  - context/technical-requirements/data-table.md
  - backend/features/project_document/custom_fields.py (TableFieldDef)
  - backend/features/project_document/tables/rooms.py / pumps.py (slice shape)
  - backend/features/project_document/tables/_fingerprint.py (v2 algorithm)
---

# Plan 31 — Phase 3 Frontend Bundle

## P0. Phase Intent

Backend Phases 1b → 3 landed across earlier sessions. Each backend
commit deferred the frontend cascade rather than block on it. The
result is a frontend that has drifted significantly from the backend
wire shape:

- **v2 wire (frontend currently expects):**
  `slice.custom_fields: CustomFieldDef[]`, each FieldDef carries `id`
  as identity; `RoomRow.number / name / num_people / num_bedrooms` are
  typed columns; `PumpRow.tag / use / manufacturer / model / volts /
  horse_power / wattage / flow_gpm / runtime_khr_yr` are typed columns;
  pinning the leftmost column uses an `IdentifierConfig` abstraction;
  the type picker is unconditionally disabled on built-ins (Phase 1a
  hard rule).

- **v4 wire (backend currently emits):**
  `slice.field_defs: TableFieldDef[]` — one merged stream of built-in +
  custom entries keyed by `field_key`; mutable-type built-in values
  live in `row.custom_values`; `record_id` is a reserved `field_key`
  driving leftmost pinning; built-in `field_type` changes are allowed
  unless `"field_type"` appears in the FieldDef's lock list.

This plan rolls the frontend through that migration in
session-bounded slices. Each slice is a single commit and produces a
clean checkpoint that the next session can resume from.

## P1. Preconditions

- Phase 3 backend cohort merged or available on a base branch — done
  (`worktree-plan-31-phase-3-bundle` at `c93fce2`, three commits ahead
  of `origin/main`).
- Frontend foundation slice landed — done (commit `891d1c6` below).
- No conflicting frontend work in flight on the worktree branch.

## P2. Slice Inventory

### P2.0 Foundation — LANDED 2026-05-26 (`891d1c6`)

Shipped:
- `CustomFieldDef` reshaped to backend `TableFieldDef`: `field_key` is
  identity (drops `id`), `origin: "built_in" | "custom"` added.
  `CustomFieldDef` kept as a deprecation alias for the 67 existing
  importers; new code uses `TableFieldDef`.
- `slice.custom_fields` → `slice.field_defs` on `RoomsSlice` and
  `RoomsReplacePayload`; added `field_defs` on `PumpsSlice` +
  `PumpsReplacePayload` to match backend `PumpsSliceResponse`.
- `useTableSchema` internals rekeyed `customField.id` → `.field_key`;
  options lookup variable renamed (`optionsByFieldId` →
  `optionsByFieldKey`).
- `computeTableSchemaFingerprint` v1 → v2 (byte-matches
  `backend/.../tables/_fingerprint.py`). Payload now
  `{version, fields: [{field_key, field_type}]}` over the merged FieldDef
  stream. Internal synthesis from `coreFieldDefs.custom_field_type`
  bridges until #28 collapses the split.
- Production callers in `equipment/lib.ts` + `RoomsPage.tsx` migrated.
- Known-broken at this checkpoint: 11 frontend test files + `App.test.tsx`
  + `lib.ts` per-table FieldDef builders + `useSliceTableController`
  internals + every consumer of typed `RoomRow.number` / `PumpRow.tag`.

### P2.1 Slice — useTableSchema reshape (#28 / #10) — LANDED 2026-05-27

Collapse `useTableSchema`'s two-input contract into a single
`fieldDefs: TableFieldDef[]` input fed straight from `slice.field_defs`.

Touch points:
- `frontend/src/shared/ui/data-table/hooks/useTableSchema.ts` —
  signature change, internal merging removed, fingerprint synthesizer
  goes away.
- `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`
  — adapt the `customFields:` param to pass the slice's `field_defs`
  through directly.
- `frontend/src/features/equipment/lib.ts` — `roomsTableFieldDefs` /
  `pumpsTableFieldDefs` no longer used as primary; the per-table seed
  becomes a render-time overlay registry (locks, display_name,
  options binding, `custom_field_type` mapping) that layers onto the
  wire `field_defs` by `field_key`.
- `frontend/src/features/equipment/routes/RoomsPage.tsx` — pass
  `slice.field_defs` directly; drop `fingerprintCoreFieldKeys` and
  `coreFieldDefs` props.
- Built-in render overlay: introduce a small `roomsFieldOverlay:
  Record<string, Partial<FieldDef>>` keyed by `field_key`. Keys carry
  the non-wire bits (display_name, locks, options reference,
  required, read_only, defaultOptionId).

Verification:
- The `useTableSchema` unit test must still pass with the simpler
  input shape.
- Rooms page renders correctly with the persisted backend FieldDef
  list; column headers come from `field_def.display_name` (not the
  hardcoded built-in seed).

Shipped:
- `useTableSchema` now accepts one persisted `fieldDefs:
  TableFieldDef[]` stream, computes the v2 fingerprint directly from
  that stream, derives built-in/custom identity from `origin`, and
  layers render-only metadata through a `fieldOverlay` map keyed by
  `field_key`.
- Rooms and Pumps pass `slice.field_defs` directly through
  `useSliceTableController`; the old `coreFieldDefs`,
  `fingerprintCoreFieldKeys`, and `customFields` controller inputs are
  gone.
- Rooms/Pumps render overlays now carry locks, required/read-only
  state, and option-list bindings. Column headers read from the
  persisted FieldDefs.
- Frontend table field keys are split from option-list namespace keys
  for Rooms/Pumps (`floor_level` vs `rooms.floor_level`,
  `device_type` vs `pumps.device_type`) so direct backend FieldDefs can
  bind to existing option maps.

Closeout verification:
- `cd frontend && pnpm exec vitest run
  src/shared/ui/data-table/__tests__/useTableSchema.test.ts` — passed
  (8 tests).
- `cd frontend && pnpm exec eslint <changed slice files>` — passed.
- `cd frontend && pnpm exec tsc -b --pretty false` — still fails only
  in the known downstream test/fixture layer (`custom_fields`, old
  `id`, old `coreFieldDefs/customFields` harness wiring), matching the
  accepted cascade state before P2.6.

### P2.2 Slice — Row-shape migration to mixed-storage (#11) — LANDED 2026-05-27

`RoomRow.number / name / num_people / num_bedrooms` and
`PumpRow.tag / use / manufacturer / model / volts / horse_power /
wattage / flow_gpm / runtime_khr_yr` all move to `row.custom_values`.

Touch points (size: 38 RoomRow + 25 PumpRow typed-column reads):
- `frontend/src/features/equipment/types.ts` — `RoomRow` /
  `PumpRow` type shapes reshape to match backend. `custom:
  Record<string, unknown>` renames to `custom_values: Record<string,
  CustomValue>`.
- `frontend/src/features/equipment/components/RoomsTable.tsx` /
  `PumpsTable.tsx` — every cell accessor reads through
  `getCustomValue(row, field_key)`.
- `frontend/src/features/equipment/lib.ts` — `buildEmptyRoomRow` /
  `buildEmptyPumpRow` write defaults via `setCustomValue` for the
  mutable-type fields.
- Every fixture and test that constructs a row literal.

Verification:
- Rooms page round-trips a saved value through `custom_values`.
- Pumps page (when wired) likewise.
- Playwright smoke: open Rooms, edit a `number` cell, save, reload,
  see the value.

Shipped:
- `RoomRow.number / name / num_people / num_bedrooms` and
  `PumpRow.record_id / use / manufacturer / model / volts /
  horse_power / wattage / flow_gpm / runtime_khr_yr` now read/write
  through `custom_values`.
- Equipment table accessors, validation, sorting, modal labels,
  payload normalization, row builders, and formula row-value helpers
  were migrated to shared custom-value accessors.
- Known-broken remains limited to the deferred test fixture layer until
  §P2.6.

### P2.3 Slice — IdentifierConfig deletion + record_id pinning (#29 / #18) — LANDED 2026-05-27

Delete the `IdentifierConfig<TRow>` abstraction and the synthetic
identifier resolver. Pinning the leftmost column is keyed off
`field_key === "record_id"`.

Touch points:
- `frontend/src/shared/ui/data-table/types.ts` — delete
  `IdentifierConfig` type, `IDENTIFIER_COLUMN_ID` constant,
  `IDENTIFIER_HEADER_LABEL` constant. Replace with a single rule on
  the renderer.
- `frontend/src/shared/ui/data-table/lib/identifier/resolve.ts` —
  delete entirely.
- `frontend/src/shared/ui/data-table/__tests__/identifier.test.ts` +
  `identifierColumn.test.tsx` — rewrite or delete (the pinning rule
  is now a one-liner — fold its test into the renderer's suite).
- `frontend/src/features/equipment/components/PumpsTable.tsx` —
  delete `PUMPS_IDENTIFIER` constant; pinning falls out of the
  `record_id` FieldDef from the backend.
- `frontend/src/shared/ui/data-table/DataTable.tsx` (or wherever the
  leftmost-column pin logic lives) — replace the IdentifierConfig
  read with `fieldDefs.find((f) => f.field_key === "record_id")`.

Verification:
- Rooms + Pumps both pin the right column based purely on the
  backend's persisted `record_id` FieldDef.
- Duplicate-value chip (Phase 2 visual) shows on duplicated record_id
  values.

Shipped:
- Deleted the `IdentifierConfig<TRow>` public prop and removed the
  synthetic `__record_id__` constants / resolver path. Pinning now
  derives from the real column whose `fieldKey === "record_id"`.
- Rooms renders a real `record_id` formula column from
  `rows_computed`; Pumps pins the real `record_id` custom_values
  column.
- Duplicate-value chips now scan the rendered `record_id` column
  accessor for both direct text values and formula/computed values.
- View sanitization and paste handling no longer whitelist or skip a
  synthetic identifier column.
- Follow-up simplify pass centralized `RECORD_ID_FIELD_KEY`, shared the
  Rooms computed-column builder, removed stale synthetic-identifier CSS
  / comments, and made duplicate-chip metadata compact for large
  duplicate groups.
- Closeout verification:
  `pnpm exec vitest run src/shared/ui/data-table/__tests__/identifier.test.ts src/shared/ui/data-table/__tests__/identifierColumn.test.tsx`
  passed (17 tests); eslint on touched files passed; filtered
  production typecheck produced no non-test errors. Full frontend
  typecheck still fails in the known stale fixture layer deferred to
  §P2.6.

### P2.4 Slice — Small wins (#30, #31, #32) — LANDED 2026-05-27

Three isolated edits that can land in one commit:

- **#30 roomsFormulaRegistry simplification:**
  `frontend/src/features/equipment/lib/roomsFormulaRegistry.ts` —
  the registry currently maps column-side `field_key`s to formula-side
  `field_id`s via `ROOMS_FORMULA_FIELD_ID_BY_COLUMN_KEY`. With the
  unified `field_key` identity, the registry collapses to a pass-through
  filter of `fieldDefs`. Delete the mapping table.

- **#31 conversion matrix formula entries:**
  `frontend/src/shared/ui/data-table/lib/typeConversionMatrix.ts` —
  mirror the backend `CONVERSION_MATRIX` from
  `backend/.../mutations/models.py`. Five primitive→formula entries
  (`discard_then_author`) plus five formula→primitive entries
  (lossless / lossy / create_options per the backend table). Verify
  parity by counting (10 new keys, matrix size grows by 10).

- **#32 modal hard-rule removal:**
  `frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx:365`
  — drop the `isBuiltInField(fieldDef)` condition from
  `fieldTypeLocked`. Built-ins are now retypeable unless `"field_type"`
  is in their `locked` list (which is the unified rule for customs
  too). Adjust
  `__tests__/FieldConfigModal.locks.test.tsx:39` to assert the new
  behavior.

Verification:
- Type picker opens on built-in number / short_text fields; remains
  disabled on locked built-ins (`floor_level`, `icfa_factor`,
  `building_zone`, etc.).
- Backend round-trip of a Rooms `number` → `long_text` retype succeeds
  end-to-end.

Shipped:
- Deleted `ROOMS_FORMULA_FIELD_ID_BY_COLUMN_KEY`; Rooms formula
  registry now uses FieldDef `field_key` as the formula `field_id`.
- Mirrored backend formula conversion policies in the frontend matrix:
  five primitive-to-formula `discard_then_author` entries and five
  formula-to-primitive snapshot entries. Focused tests assert the 25
  total matrix entries and the 10 formula edges.
- Removed the modal's built-in-only type lock rule; the type picker now
  follows only the FieldDef `locked` list. Focused modal tests cover
  unlocked and locked built-ins.
- Verification run: focused FieldConfigModal lock tests, focused
  conversion/preflight tests, eslint on touched frontend files, and the
  filtered production typecheck passed. The old Rooms formula acceptance
  fixture file still fails on the known stale `custom_fields` /
  `roomsTableFieldDefs` layer; leave it for §P2.6.

### P2.5 Slice — Catalog refresh skip (#33) — LANDED 2026-05-27

Refresh-from-catalog (US-WIN-11) must skip fields whose project-side
`field_type` no longer matches the catalog-side type. Backend already
enforces the skip (Phase 3 §P4.7); frontend needs the UX signal.

Touch points (under-spec — needs investigation):
- `frontend/src/features/windows/refresh/RefreshDialog.tsx` — render
  a skip row for mismatched fields.
- `frontend/src/features/windows/refresh/lib.ts` — extend
  `defaultRefreshSelection()` to mark mismatched fields as skipped.

Spec gap: backend response shape for "field skipped" needs to be
checked. Likely a separate sublist in the refresh-preview payload.
Investigate before writing the slice.

Investigation result:
- The predecessor Phase 3 plan specifies the intended per-field flag
  as `skip_reason: "field_type_changed"`; the refresh response model
  now accepts that optional field so frontend fixtures match the API
  contract.

Shipped:
- Frontend refresh types accept optional
  `RefreshFieldDelta.skip_reason: "field_type_changed"`.
- `defaultRefreshSelection()` leaves skipped fields as `"keep"`;
  `canApplyRefresh()` disables all-skipped drift slots; and
  `applyRefreshSelection()` refuses to write skipped fields even if a
  caller passes `"update"`.
- `RefreshDialog` renders skipped rows with an explanatory note and
  disables both radio controls for that field.
- Verification run: focused refresh lib/dialog tests and eslint on the
  touched refresh files passed.
- Simplify follow-up removed redundant `"skip"` selection state, made
  formula-discard preflight single-pass, and added the optional
  backend `RefreshFieldDelta.skip_reason` response field to keep the
  frontend type aligned with the API contract.

### P2.6 Slice — Test rewrites (#34 / #12)

The deferred backend + frontend test fixture rewrites:
- Backend schema-mutation fixture rewrite landed 2026-05-27:
  `backend/tests/test_project_document_schema_mutations.py` now builds
  through `empty_project_document`, uses `TableFieldDef.field_key`, and
  asserts against `field_defs` / `custom_values`. Verification:
  `cd backend && uv run pytest tests/test_project_document_schema_mutations.py -q`
  (56 passed) and `uv run ruff check
  tests/test_project_document_schema_mutations.py`.
- Frontend equipment payload helper fixture rewrite landed 2026-05-27:
  `frontend/src/features/equipment/lib.test.ts` now builds Rooms test
  rows with `field_defs` / `custom_values` and keeps the focused module
  green. Verification: `cd frontend && pnpm exec vitest run
  src/features/equipment/lib.test.ts` (28 passed) and `pnpm exec eslint
  src/features/equipment/lib.test.ts`.
- Backend reserved-slug guard fixture rewrite landed 2026-05-27:
  `backend/tests/test_custom_fields_reserved_slug_guard.py` now asserts
  the custom-only guard contract in `mutations.guards`, while allowing
  the built-in `record_id` `TableFieldDef` seed. Verification:
  `cd backend && uv run ruff check
  tests/test_custom_fields_reserved_slug_guard.py`, `uv run ty check
  tests/test_custom_fields_reserved_slug_guard.py`, and `uv run pytest
  tests/test_custom_fields_reserved_slug_guard.py -q` (4 passed).
- Backend custom-field contract fixture rewrite landed 2026-05-27:
  `backend/tests/test_project_document_custom_fields.py` now asserts the
  current `field_registry` / `field_defs` / one-argument fingerprint
  contract and seeds documents through `empty_project_document`.
  Verification: `cd backend && uv run ruff check
  tests/test_project_document_custom_fields.py`, `uv run ty check
  tests/test_project_document_custom_fields.py`, and `uv run pytest
  tests/test_project_document_custom_fields.py -q` (6 passed).
- Frontend equipment fixture cleanup continued 2026-05-27:
  `frontend/src/features/equipment/testing/testFixtures.ts` now
  centralizes v4 Rooms/Pumps fixtures, and the equipment table tests
  use `field_defs`, `custom_values`, `record_id` built-in field defs,
  and custom `field_key` references.
- Backend and shared test cleanup continued 2026-05-27:
  stale MCP, project-document, default-fill, pumps, schema-mutation,
  phase-1, phase-2, phase-4, data-table, and table-slice fixtures were
  migrated away from `custom_fields`, row `.custom`, and typed mutable
  built-in columns. Shared backend field-def assertions now live in
  `backend/tests/project_document_helpers.py`.
- Runtime fix included 2026-05-27:
  `backend/features/mcp/helpers.py` now reads MCP custom-field helper
  responses from `field_defs`, filtering custom fields by
  `field_key`.
- Simplify follow-up included 2026-05-27:
  frontend equipment tests now reuse the production Rooms/Pumps
  built-in FieldDef compatibility lists, shared E2E short-text field
  creation lives in `frontend/tests/e2e/_helpers.ts`, and backend tests
  share required empty v4 Rooms/Pumps table scaffolding through
  `backend/tests/project_document_helpers.py`.

Approach: rewrite-in-place per test module. Don't try to land all
remaining frontend fixtures in one commit; group by module and ship
per-module commits.

### P2.7 Slice — Verification (#36 / #14)

Final pass:
- `make typecheck` clean on backend and frontend. Status 2026-05-27:
  backend Ty and frontend TypeScript clean.
- `make test` clean on backend and frontend. Status 2026-05-27:
  backend 415 passed, 1 skipped; frontend 948 passed.
- `make smoke` clean. Status 2026-05-27: clean.
- Playwright smoke: Rooms + Pumps round-trip on a live browser. Status
  2026-05-27: clean on the local worktree dev stack:
  `E2E_BASE_URL=http://localhost:5174 pnpm exec playwright test
  tests/e2e/editable-fields-roundtrip.spec.ts --project=chromium`.
- Runtime fix included 2026-05-27: Pumps row insert/delete/cell-write
  payload builders now preserve `field_defs`, matching Rooms and
  preventing backend 422s during browser "Add pump" / edit flows.

Then rebase the whole bundle onto `origin/main` (resolving the
`planning/features/editable-fields/archive/complete/plan-31-phase-3-built-in-type-changes.md` move
conflict — main moved the file to `editable-fields/` while my branch
modified the old path). Merge to main.

## P3. Rules & Constraints

1. **Each slice is a single commit on `worktree-plan-31-frontend-bundle`.**
   No half-finished slices left on the branch.
2. **Slices may leave the typecheck broken at the consumer layer
   until §P2.6 finishes.** The user explicitly accepted this when
   approving the foundation slice. Each slice's commit message must
   list the known-broken consumers so the next session has a clean
   resume point.
3. **No row-shape migration before useTableSchema reshape.** Order
   matters: §P2.1 lands the wire-shape consumption pattern, then
   §P2.2 migrates the row literals. Reversing would force two
   migrations on every row consumer.
4. **No IdentifierConfig deletion before §P2.2.** The pinning rule
   needs `field_key === "record_id"` to be a real FieldDef in the
   merged stream; that's contingent on §P2.1.
5. **Catalog refresh skip is independent.** Slice §P2.5 can land any
   time after §P2.1.

## P4. Risks & Mitigations

- **Risk:** Backend cohort hasn't merged to main yet — main has
  uncommitted WIP (`20-envelope.md`, `PRD.md`, a
  file move) that conflicts with the Phase 3 doc rewrite.
  - **Mitigation:** the frontend bundle branches from the Phase 3
    worktree, not from main. The whole bundle (BE + FE) merges to
    main together at the end. User handles or commits main's WIP
    before the merge.

- **Risk:** A slice's known-broken consumers fester for sessions and
  someone (next session, or me on resume) forgets which slice owns
  the cleanup.
  - **Mitigation:** each slice's commit message names the
    known-broken modules. The phase plan doc tracks slice status.
    Sessions resume from the most recent landed commit.

- **Risk:** Test rewrites (§P2.6) discover behavior gaps the earlier
  slices left.
  - **Mitigation:** §P2.6 is gated by §P2.1–P2.4. Bugs surfaced in
    §P2.6 land as new commits on the same branch, not as fixes
    folded into older commits.

## P5. Success Criteria (Gating)

Bundle is "done" when:
1. All seven slices landed (§P2.1–P2.7).
2. `make typecheck` clean.
3. `make test` clean.
4. `make smoke` clean.
5. Playwright smoke green for Rooms + Pumps.
6. Bundle merged to `origin/main`.

## P6. Session Cadence

Estimated 3–5 sessions:
- Session 1 (this session, 2026-05-26): foundation slice (§P2.0) ✓.
- Session 2: §P2.1 useTableSchema reshape + §P2.4 small wins.
- Session 3: §P2.2 row-shape migration (the biggest individual slice).
- Session 4: §P2.3 IdentifierConfig deletion + §P2.5 catalog refresh.
- Session 5: §P2.6 test rewrites + §P2.7 verification + merge.

Adjust per session capacity.
