---
DATE: 2026-05-26
TIME: 18:00 ET
STATUS: P4.1 BACKEND CASCADE LANDED (2026-05-26) — `uv run ty check
        features/` reports 0 errors across `features/project_document/**`
        and the rest of `features/**`. Remaining: P4.2 backend tests
        (~101 ty errors in `tests/*.py`), P4.3 frontend reshape, P4.4
        frontend tests, P4.5 docs, then alias drop. No new wire-format
        change; all decisions already locked by Phase 1b. Pre-deploy
        posture preserved.
AUTHOR: Claude (Opus 4.7)
SCOPE: Finish what Phase 1b started. Phase 1b reshaped the canonical
       types (`TableFieldDef`, `RoomRow`, `PumpRow`,
       `RoomsTableEnvelope.field_defs`, `PumpsTableEnvelope`,
       `TableFieldRegistry`, fingerprint v2, audit-log kinds) and
       bumped `schema_version` to 3. Phase 1c rides the new shapes
       through every remaining caller, rewrites the fixture/test
       surface, and lands the frontend reshape so the full test suite
       returns to green.
RELATED:
  - docs/plans/2026-05-26/editable-fields/plan-31-customizable-fields-prd.md (master PRD)
  - docs/plans/2026-05-26/editable-fields/_complete/plan-31-phase-1a-lock-model.md
  - docs/plans/2026-05-26/editable-fields/_complete/plan-31-phase-1b-persistence-reshape.md
  - backend/features/project_document/formula/resolver.py
  - backend/features/project_document/formula/evaluator.py
  - backend/features/project_document/mutations/{bundle,field_ops,options_ops,guards,formula_ops,type_conversion,dispatcher}.py
  - backend/features/project_document/schema_mutations.py
  - backend/features/project_document/drafts.py
  - backend/tests/test_project_document*.py
  - backend/tests/test_mcp*.py
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
  - frontend/src/features/equipment/**
---

# Plan 31 — Phase 1c — Rename Cascade & Fixture Rewrites

## P0. Phase Intent

Phase 1b landed the v3 backbone but left ~45 backend type-check errors
and a widely-red test suite by design (per session-scope decision).
Phase 1c is a focused mechanical pass to drive those numbers to zero:

1. Rename every caller from the v2 capability/field/row member names
   to the v3 names.
2. Rewrite every backend test fixture to the v3 wire shape.
3. Land the frontend reshape: `useTableSchema` accepts a single
   FieldDef list, lock-list overlay applies at load, fingerprint algo
   mirrors backend `v2` tag.
4. Update every frontend feature page (RoomsTable, PumpsTable,
   EquipmentPage, RoomModal, RoomDialogStack, etc.) so row accessors
   read from `custom_values` for mutable-type fields.
5. Rewrite every frontend test fixture.
6. Run typecheck + tests + smoke until green.

No new architectural decisions. No wire-format change. The PRD §P3
principles and Q-F1–Q-F13 answers are unchanged; this is execution.

## P1. Preconditions

- Phase 1b backbone shipped: every canonical type lives at its v3
  shape, schema_version pinned at 3, audit-log map renamed, docs
  updated. Verifiable by `uv run python -c "from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION; assert CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION == 3"`.
- The transitional aliases shipped in Phase 1b are still in place:
  `CustomFieldDef = TableFieldDef`, `CustomFieldCapability =
  TableFieldRegistry`, `TableFieldDef.id` (property → `field_key`),
  `TableContract.custom_fields` (property → `field_registry`). Phase
  1c removes these aliases as the cascade lands.
- Dev DB acknowledged as throw-away.

## P2. Scope

### P2.1 In scope

#### P2.1.1 Backend cascade rename

Every caller using v2 capability member names migrates to v3 names.
This is a mechanical rewrite; the renames are 1:1.

| v2 (old) | v3 (new) |
|---|---|
| `capability.read_custom_fields(body)` | `capability.read_field_defs(body)` |
| `capability.replace_custom_fields(body, fields)` | `capability.replace_field_defs(body, fields)` |
| `capability.read_row_custom(row)` | `capability.read_row_custom_values(row)` |
| `capability.set_row_custom(row, dict)` | `capability.set_row_custom_values(row, dict)` |
| `capability.core_field_keys` | `capability.field_keys` |
| `capability.core_display_names` | walk persisted `body.tables.<table>.field_defs` |
| `capability.required_core_select_fields` | `capability.required_field_keys` |
| `capability.core_option_key_by_field_id` | `capability.built_in_option_key_by_field_key` |
| `capability.read_core_option_value` | `capability.read_built_in_option_value` |
| `capability.set_core_option_value` | `capability.set_built_in_option_value` |
| `capability.core_field_value_for_formula` | `capability.field_value_for_formula` |
| `capability.core_field_type_for_formula` | `capability.field_type_for_formula` |
| `field.id` (on `CustomFieldDef`) | `field.field_key` (on `TableFieldDef`) |
| `row.custom` (on `RoomRow`/etc.) | `row.custom_values` |
| `body.tables.rooms.custom_fields` | `body.tables.rooms.field_defs` |
| `body.tables.equipment.pumps` (list) | `body.tables.equipment.pumps.rows` |
| `room.number`, `room.name`, `room.num_people`, `room.num_bedrooms` | `room.custom_values["<key>"]` (mutable-type built-ins) |
| `pump.tag`, `pump.use`, `pump.manufacturer`, `pump.model`, `pump.volts`, `pump.horse_power`, `pump.wattage`, `pump.flow_gpm`, `pump.runtime_khr_yr` | `pump.custom_values["<key>"]` |
| `RoomsSliceReplaceRequest.custom_fields` | `.field_defs` |
| `RoomsSliceResponse.custom_fields` | `.field_defs` |
| `CustomFieldDef` (type import) | `TableFieldDef` |
| `CustomFieldCapability` (type import) | `TableFieldRegistry` |

Files to cascade:

- `backend/features/project_document/formula/resolver.py` — drops
  `origin: "core"` branch (built-in vs custom is no longer a meaningful
  split in the data layer; the formula registry classifies entries by
  whether the FieldDef's `field_type` is `formula` vs the others, not
  by where the value lives).
- `backend/features/project_document/formula/evaluator.py` — `.id` →
  `.field_key`, `read_row_custom_values`, `read_field_defs`.
- `backend/features/project_document/mutations/bundle.py` — full
  rename of every capability call, `.id`, `core_display_names`-driven
  duplicate-name guard rewrites to walk persisted `field_defs`.
- `backend/features/project_document/mutations/field_ops.py` — same.
- `backend/features/project_document/mutations/options_ops.py` —
  `is_custom` flag flips to `in_custom_values` (already renamed at the
  `options.py` callee in Phase 1b); call sites update.
- `backend/features/project_document/mutations/guards.py` — same.
- `backend/features/project_document/mutations/formula_ops.py` —
  `.id` / display-name registry rewrites.
- `backend/features/project_document/mutations/type_conversion.py` —
  same.
- `backend/features/project_document/mutations/dispatcher.py` — same.
- `backend/features/project_document/schema_mutations.py` — same.
- `backend/features/project_document/drafts.py` — audit-log kind
  string literals: any place that hard-codes
  `"project_version_custom_field_*"` updates to
  `"project_version_field_*"`.
- `backend/features/project_document/diff.py` — references to
  `custom_fields` / `custom` keys in diff payloads.
- `backend/features/project_document/downloads.py` — JSON export
  shape switches from `custom_fields` to `field_defs`.
- `backend/features/project_document/refresh.py` — catalog refresh
  reads through typed columns only (mutable-type fields no longer
  carry catalog provenance; see PRD §P5.3 + §D1).
- `backend/features/mcp/{tools,server,helpers,models}.py` — MCP write
  surface accepts/emits the v3 envelope shape and renamed audit kinds.
- `backend/features/schemas/routes.py` — published JSON Schema reshape
  (mutable-type built-ins advertise the `custom_values` union shape).
- `backend/features/project_document/options.py` — already updated
  the `find_cells_referencing_option` flag in Phase 1b; ensure all
  call sites pass the new kwarg name.

After this pass, drop the transitional aliases:

- `custom_fields.py`: remove `CustomFieldDef`, `CUSTOM_FIELD_ID_PATTERN`,
  `CUSTOM_FIELD_KEY_MAX`, `CUSTOM_FIELD_DISPLAY_NAME_MAX`,
  `CUSTOM_FIELD_DESCRIPTION_MAX`, `mint_custom_field_id`,
  `TableFieldDef.id` property.
- `tables/contracts.py`: remove `CustomFieldCapability`,
  `TableContract.custom_fields` property.
- `mutations/models.py`: remove the `CustomFieldDef = TableFieldDef`
  alias.
- `tables/rooms.py`: remove `rooms_custom_fields` alias.

The cascade is done when `uv run ty check features/project_document`
reports zero errors and no source file imports `CustomFieldDef` or
`CustomFieldCapability` from `features.project_document.*`.

#### P2.1.2 Backend fixture / test rewrites

Every fixture / test that constructs a project body:

- Bumps `schema_version` literal from `2` to `3`.
- Rewrites `RoomRow(...)` to drop `number`/`name`/`num_people`/
  `num_bedrooms` kwargs and put those values in `custom_values`.
- Rewrites `PumpRow(...)` to drop `tag`/`use`/`manufacturer`/`model`/
  `volts`/`horse_power`/`wattage`/`flow_gpm`/`runtime_khr_yr` kwargs
  and put those values in `custom_values`.
- Rewrites `RoomsTableEnvelope(custom_fields=..., rows=...)` to
  `RoomsTableEnvelope(field_defs=..., rows=...)`.
- Rewrites `equipment.pumps=[PumpRow(...), ...]` to
  `equipment.pumps=PumpsTableEnvelope(field_defs=..., rows=[...])`.
- Test fixtures that construct `CustomFieldDef(id=..., field_key=...)`
  use `TableFieldDef(field_key=..., origin="custom", ...)` instead;
  the advisory slug drops out.
- Test fixtures that pre-seed built-in FieldDefs use
  `ROOMS_BUILT_IN_FIELD_DEFS` / `PUMPS_BUILT_IN_FIELD_DEFS` from
  feature code (do not duplicate the seed).
- Audit-log kind string-literal assertions update to drop
  `_custom_field_`.
- Additional wire-vocabulary renames discovered during the P4.1
  cascade (test fixtures must match — these are NOT in the §P2.1.1
  rename table because they're inside error/audit payloads):
  - `editOptions` audit payload key `is_custom` → `in_custom_values`
    (see `mutations/options_ops.py`).
  - Reason code `required_core_select_delete_without_replacement` →
    `required_built_in_select_delete_without_replacement` (same file,
    `custom_field_option_list_invalid` envelope).
  - `colliding_field_origin` envelope value `"core"` → `"built_in"`
    in `custom_field_duplicate_name` errors (see
    `mutations/guards.py`); mirrors `TableFieldDef.origin`. Frontend
    tests that key off the literal `"core"` need updating too.

Files (every backend test under `backend/tests/test_project_document*`,
`test_mcp*`, `test_schemas.py`, `test_projects.py`,
`test_assets_registry.py`, `test_table_views.py`):

- `test_project_document.py`
- `test_project_document_pumps.py`
- `test_project_document_window_types.py`
- `test_project_document_custom_fields.py`
- `test_project_document_custom_fields_phase_1.py`
- `test_project_document_custom_fields_phase_2.py`
- `test_project_document_custom_fields_phase_4.py`
- `test_project_document_default_option_fill.py`
- `test_project_document_schema_mutations.py`
- `test_project_document_schema_mutation_endpoint.py`
- `test_project_document_refresh.py`
- `test_custom_fields_reserved_slug_guard.py`
- `test_mcp.py`
- `test_mcp_custom_fields.py`
- `test_schemas.py`
- `test_projects.py`
- `test_table_views.py`
- `test_catalogs.py` / `_glazing_types` / `_frame_types` — only if
  they construct project bodies (catalog tables aren't field-config-
  capable, so likely no change beyond `schema_version` bumps in
  fixtures).

Pumps tests get the most reshape: `body.tables.equipment.pumps`
becomes a `PumpsTableEnvelope`, so every `equipment.pumps[0]`
becomes `equipment.pumps.rows[0]`, and pump field values move into
`custom_values`.

Phase 1c also adds new tests required by Phase 1b's success criteria:

- Round-trip test: build a v3 body with both built-in mutable-type
  values (`custom_values["number"] = "101"`) and a custom field;
  save → load; assert byte-equivalence.
- Fingerprint stability: rename a built-in field's `display_name`,
  assert fingerprint unchanged; change a built-in's `field_type`,
  assert fingerprint changed.
- Fingerprint FE/BE byte-equivalence: hand-built fixture loaded by
  both `compute_table_schema_fingerprint` (Python) and
  `computeTableSchemaFingerprint` (TS) yields the same hex digest.
- v2-body rejection: posting a body with `schema_version: 2` returns
  a structured `invalid_project_document` error.
- Catalog-origin enforcement: catalog-sourced value on a locked-type
  field accepts; on a mutable-type field rejects.

#### P2.1.3 Frontend `useTableSchema` reshape

- Drops the `coreFieldDefs` argument. Callers pass the loaded
  `field_defs` list straight through (built-ins + customs in seed
  order).
- Drops the separate `customFields` argument too — there's one list
  now.
- The lock-list overlay is applied at the hook layer: feature code
  passes a `seedLocks: Record<string, FieldLockKey[]>` keyed by
  `field_key`, and `useTableSchema` merges it onto each persisted
  FieldDef at render time.
- `computeTableSchemaFingerprint` mirrors the backend v2 algorithm
  byte-for-byte: payload is `{version: "v2", fields: [{field_key,
  field_type}, ...]}`, JSON-stringified with no key sorting and
  no whitespace, hashed via SHA-256 / hex.
- Drops the `CustomFieldDef` TS type from
  `hooks/useTableSchema.ts` — callers consume `TableFieldDef` via the
  shared type module (mirror of backend `TableFieldDef`).
- Drops the v2 `CustomFieldDef.id` → `FieldDef.field_key` mapping;
  the persisted FieldDef already carries `field_key`.

#### P2.1.4 Frontend feature pages

Every page that reads from a row's typed property now reads from
`custom_values`:

- `frontend/src/features/equipment/components/RoomsTable.tsx` —
  row accessors `(row) => row.number` → `(row) =>
  row.custom_values?.number`. Same for `name`, `num_people`,
  `num_bedrooms`. `floor_level`, `building_zone`, `icfa_factor`
  stay as typed columns.
- `frontend/src/features/equipment/components/PumpsTable.tsx` —
  every `(pump) => pump.tag` etc. routes through `custom_values`.
  `device_type`, `phase`, `link`, `notes` stay typed.
- `frontend/src/features/equipment/components/RoomModal.tsx`,
  `RoomDialogStack.tsx`, `ConfirmDeleteRoomDialog.tsx` — detail
  modals read row values via the new accessors.
- `frontend/src/features/equipment/lib/roomMutationCallbacks.ts`,
  `pumpsController.ts`, `roomsController.ts`,
  `buildEmptyRoomRow.ts`, `buildEmptyPumpRow.ts` — every payload-
  build helper writes through `custom_values`.
- `frontend/src/features/equipment/lib.ts` —
  `validatePumpsPayload`, `applyWriteToPump`,
  `roomsTableFieldDefs`, `pumpsTableFieldDefs` are now seed-only
  (locked overlays + display defaults). Persisted FieldDefs win for
  attribute values.
- `frontend/src/features/equipment/lib/roomsFormulaRegistry.ts` —
  drops the `origin: "core"` short-circuit; the persisted FieldDef
  list (built-in + custom) flows through one code path.
- `frontend/src/features/equipment/types.ts` — `RoomRow` and
  `PumpRow` mirror the v3 backend shapes.
- `frontend/src/features/equipment/routes/RoomsPage.tsx`,
  `EquipmentPage.tsx` — wire `useTableSchema` with the persisted
  FieldDef list + seed locks.

#### P2.1.5 Frontend test rewrites

Every frontend test fixture constructs v3 rows. Same shape rewrites
as backend fixtures (no `number` typed prop; values in `custom_values`).

Files:

- `frontend/src/features/equipment/lib.test.ts`
- `frontend/src/features/equipment/__tests__/*.test.tsx` (Rooms +
  Pumps schema editor, custom field, formula field, locked
  indicator, paste, fill, row insert, etc.)
- `frontend/src/shared/ui/data-table/__tests__/*` — any test that
  constructs FieldDef fixtures expecting the v2 `core/custom` split.

### P2.2 Out of scope

- Adding the actual `record_id` FieldDef entry → Phase 2.
- Renaming Pumps `tag` → `record_id` → Phase 2.
- `IdentifierConfig` / `IDENTIFIER_COLUMN_ID` / `resolve.ts` retirement
  → Phase 2.
- User-driven `field_type` changes (the type picker stays disabled by
  Phase 1a's hard rule) → Phase 3.
- Conversion-matrix `formula` entries → Phase 3.
- Catalog tables' seed FieldDef lists → Phase 4.
- Full Pumps schema-mutation capability → Phase 2 / 4 (Phase 1b is
  storage-only).
- A v2→v3 upgrade function (per the Phase 1b scope answer; dev DBs
  rebuild).

## P3. Rules & Constraints

1. **Mechanical renames only.** No architectural decisions; if a rule
   isn't already in the master PRD or Phase 1b's STATUS frontmatter,
   it's out of scope.
2. **No new wire-format change.** The Phase 1b `schema_version: 3`
   wire shape is final. Phase 1c doesn't bump it.
3. **Transitional aliases come down at the end.** Do the cascade
   first, removing each old alias only after the last caller is
   migrated. This keeps each commit / push compiling.
4. **Fingerprint algorithm stability under reorderings.** The payload
   shape is `{version, fields: [{field_key, field_type}]}` with seed
   order preserved. JSON serialization is no-key-sort, no-whitespace.
   Adding a new custom field appends to the list and changes the
   digest.
5. **Domain validators stay frozen.** Locked-type fields keep their
   typed-column validators. Mutable-type fields run only through
   `coerce_custom_value` — domain invariants on retypeable fields
   (like `num_people: ge=0`) are gone, as Q-F13 accepted.
6. **Audit-log kind string literals.** Every emit site and every test
   string-comparison switches to the renamed kinds. No back-compat
   reader on the audit log either.

## P4. Workstreams

### P4.1 Backend cascade

Work file-by-file in dependency order:

1. `formula/resolver.py` (closest to the data layer).
2. `formula/evaluator.py`.
3. `mutations/guards.py`, `mutations/options_ops.py`,
   `mutations/formula_ops.py`, `mutations/type_conversion.py`,
   `mutations/dispatcher.py`.
4. `mutations/field_ops.py`, `mutations/bundle.py`.
5. `schema_mutations.py`.
6. `drafts.py`, `diff.py`, `downloads.py`, `refresh.py`.
7. `mcp/*.py`.
8. `schemas/routes.py` (JSON Schema regeneration).
9. Remove transitional aliases.

After each layer, run `uv run ty check
features/project_document/<layer>` and prove the layer is clean
before moving on.

### P4.2 Backend tests

After P4.1 is clean:

1. Rewrite fixtures table-by-table:
   - Rooms fixtures first (highest test count).
   - Pumps fixtures (mostly `body.tables.equipment.pumps.rows`).
   - MCP fixtures.
   - Schemas / projects / table_views fixtures.
2. Update string-literal assertions on audit-log kinds.
3. Add the new tests required by Phase 1b §P5 (round-trip,
   fingerprint stability, byte-equivalence, v2 rejection,
   catalog-origin).

Iterate `uv run pytest` until green.

### P4.3 Frontend reshape

1. Rewrite `hooks/useTableSchema.ts`:
   - New args shape: `{tableKey, fieldDefs, seedLocks?,
     singleSelectOptions?}`.
   - Mirror backend fingerprint algo + version tag.
   - Drop the `CustomFieldDef` type re-export.
2. Reshape `frontend/src/features/equipment/types.ts` so `RoomRow` /
   `PumpRow` carry `custom_values: Record<string, …>` instead of the
   typed properties for mutable-type fields.
3. Rewrite every feature page row accessor.
4. Rewrite payload builders (`roomMutationCallbacks.ts`,
   `pumpsController.ts`, etc.).
5. Drop the `origin: "core"` short-circuit in
   `roomsFormulaRegistry.ts`.

### P4.4 Frontend tests

After P4.3 is clean:

1. Rewrite fixtures in each test file (mechanical).
2. Run `pnpm run typecheck` then `pnpm test`. Iterate to green.

### P4.5 Docs

- `context/UI_UX.md §1.7` — header double-click trigger note (Phase
  1a follow-up not yet absorbed).
- `context/technical-requirements/data-table.md` — update the
  FieldDef sketch + lock-glyph section so the document matches the
  shipped code.
- `context/technical-requirements/llm-mcp-schema.md` — note the
  mutable-type built-in JSON Schema regression (already in
  data-model.md §6.6.8; this is a cross-link).
- `context/PRD.md §10.5` — schema-evolution event entry pointing at
  Phase 1b + 1c.

## P5. Evaluation Method

- `make typecheck` — zero errors across backend and frontend.
- `make test-backend` — green.
- `make test-frontend` — green.
- `make smoke` — clean rebuild of local DB, smoke pipeline passes.
- `make e2e` — Playwright Rooms + Pumps regression tests pass.
- Manual MCP smoke: `cd backend && uv run python scripts/smoke_mcp_read.py`
  returns the v3 envelope shape for Rooms and Pumps.
- Manual frontend smoke (Playwright MCP): open Rooms project, paste a
  value into the `Number` column, save, reload, assert the value
  round-trips through `custom_values`.

## P6. Success Criteria (Gating)

Phase 1c is done when **all** of the following are true:

1. `uv run ty check` reports zero errors in
   `features/project_document/**` and the rest of `features/**` that
   touches the project document.
2. `make test-backend` is green; all fixtures are v3-shaped.
3. `make test-frontend` is green; all fixtures are v3-shaped;
   `useTableSchema` consumes a single FieldDef list with a
   seed-locks overlay.
4. The transitional aliases (`CustomFieldDef`,
   `CustomFieldCapability`, `TableFieldDef.id`,
   `TableContract.custom_fields`, `rooms_custom_fields`,
   `CUSTOM_FIELD_ID_PATTERN`, `CUSTOM_FIELD_KEY_MAX`,
   `CUSTOM_FIELD_DISPLAY_NAME_MAX`, `CUSTOM_FIELD_DESCRIPTION_MAX`,
   `mint_custom_field_id`) are removed; no source under
   `backend/features/` or `frontend/src/` imports them.
5. The fingerprint algorithm matches FE/BE byte-for-byte on a hand-
   built fixture (one test per table).
6. `make smoke` passes after a clean rebuild of the local DB.
7. Playwright Rooms + Pumps regression tests pass.
8. A user can rename a built-in field (e.g. `num_people` → "People
   Count") through the modal; the rename survives Save and project
   reload (re-verifies Phase 1a's user-visible flow against
   persisted v3 storage).
9. A v2-shaped body posted to any REST or MCP endpoint is rejected
   with a structured `invalid_project_document` error.
10. The published JSON Schema regeneration advertises mutable-type
    built-in fields as the `custom_values` union shape and keeps
    locked-type fields at their tight types.

## P7. Risks & Mitigations

- **Risk:** A caller is missed in the cascade rename and silently
  reverts to a transitional alias at runtime.
  - **Mitigation:** drop the aliases at the end of Phase 1c (P2.1.1
    last step). The type checker will flag every site that still
    imports them.
- **Risk:** Fingerprint mismatch between frontend and backend after
  the algorithm rebase.
  - **Mitigation:** golden-file test on a hand-built fixture, run
    in both Vitest and pytest with the same JSON-serialization
    inputs. Diff the hex digests directly.
- **Risk:** A test fixture gets updated to v3 wire shape but mis-
  attributes which field is mutable-type. Mutable-type fields belong
  in `custom_values`; locked-type fields belong in typed columns.
  - **Mitigation:** the `ROOMS_MUTABLE_BUILT_IN_FIELD_KEYS` /
    `PUMPS_MUTABLE_BUILT_IN_FIELD_KEYS` frozensets in `document.py`
    are the source of truth. A test fixture that lands a value in the
    wrong slot fails `validate_document_references`.
- **Risk:** Frontend `useTableSchema` reshape changes the hook's
  output shape and breaks downstream memoization keys in
  `<DataTable>`.
  - **Mitigation:** the returned `TableSchema` object's surface stays
    the same (`{fieldDefs, schemaFingerprint, ...}`); only the inputs
    change. Add a Vitest test that asserts the shape.
- **Risk:** Audit-log kind string-literal mismatch between emit and
  test.
  - **Mitigation:** rename via a grep-once-update-once pass; the
    `AUDIT_KIND_BY_MUTATION` map is the source of truth and every
    emit site reads through it.
- **Risk:** A MCP / OpenAPI consumer hard-codes the v2 audit-log
  kinds or envelope shape and quietly breaks at the wire boundary.
  - **Mitigation:** document the rename in `data-model.md §6.6` and
    `llm-mcp-schema.md`; the schema endpoints surface the renamed
    kinds. There is no production consumer to worry about (pre-deploy
    posture).

## P8. Out-Of-Band Considerations

- Phase 1c is large but mechanical. Recommend splitting the actual
  PRs into:
    1. Backend cascade rename + tests green.
    2. Frontend cascade rename + tests green.
    3. Final alias drop + doc absorption.
  Each PR keeps the suite green at its merge boundary.
- The transitional aliases are explicitly load-bearing during Phase
  1c — keep them until the cascade is complete to avoid mid-merge
  breakage.

## P9. Follow-Ups Out Of This Phase

- Phase 2 picks up `record_id` as a real field and retires
  `IdentifierConfig`.
- Phase 3 lifts the type-picker hard rule and extends the conversion
  matrix for `formula`.
- A future plan may add per-document Pydantic row models (PRD §P7
  out-of-scope reminder); not in any current phase.
