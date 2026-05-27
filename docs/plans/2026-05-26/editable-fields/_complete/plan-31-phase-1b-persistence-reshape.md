---
DATE: 2026-05-26
TIME: 15:30 ET
STATUS: BACKBONE LANDED (2026-05-26). Backend types/models reshaped,
        schema_version=3, audit-log kinds renamed, docs updated. Phase
        1b's wire-format and architectural decisions are final.
        Mechanical follow-on work (cascade rename through callers,
        fixture rewrites, frontend reshape, transitional-alias drop)
        is tracked in
        `docs/plans/2026-05-26/editable-fields/_complete/plan-31-phase-1c-rename-cascade-and-fixtures.md`.
        Type-check is currently red (~45 errors) and test suite is
        widely red by design until Phase 1c lands. Transitional
        aliases (`CustomFieldDef`, `CustomFieldCapability`,
        `TableFieldDef.id`, `TableContract.custom_fields`,
        `rooms_custom_fields`, etc.) shipped to keep imports working
        across the cutover; Phase 1c removes them.
        DEPS: Phase 1a complete + PRD acceptance
        (`docs/plans/2026-05-26/editable-fields/plan-31-customizable-fields-prd.md`).
        Wire-format reshape; bumps document schema version 2 → 3.
        Pre-deploy, no back-compat reader.
AUTHOR: Claude (Opus 4.7)
SCOPE: Move every built-in FieldDef into the document. Migrate
       `CustomFieldDef` → `TableFieldDef` as a unified per-table
       registry. Shed mutable-type row columns into the `custom_values`
       bag. Reshape `CustomFieldCapability` so "core vs custom" stops
       being a meaningful distinction. Rename audit-log kinds to drop
       the `_custom_field_` namespace. Update the published JSON Schema
       and the `data-model.md` contract.
RELATED:
  - docs/plans/2026-05-26/editable-fields/plan-31-customizable-fields-prd.md (master PRD, §P0.1, §P2.3, §P4.2)
  - docs/plans/2026-05-26/editable-fields/_complete/plan-31-phase-1a-lock-model.md (predecessor)
  - context/technical-requirements/data-model.md §6.6
  - context/technical-requirements/save-versioning.md
  - context/technical-requirements/llm-mcp-schema.md
  - backend/features/project_document/document.py
  - backend/features/project_document/custom_fields.py
  - backend/features/project_document/tables/contracts.py
  - backend/features/project_document/tables/rooms.py
  - backend/features/project_document/mutations/models.py
  - backend/features/project_document/store.py
  - backend/features/project_document/validation.py
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
---

# Plan 31 — Phase 1b — Persistence Reshape

## P0. Phase Intent

Land the document-shape change the master PRD §P2.3 requires.
Persist every built-in FieldDef as a `TableFieldDef` entry in the
per-table registry alongside custom fields. Move mutable-type built-in
values out of typed Pydantic row columns into the unified
`custom_values` bag (renamed from `custom`). Reshape `CustomFieldCapability`
so it stops modeling a core / custom dichotomy that the data no
longer carries. Bump the document schema version from 2 to 3 — no
v2 reader survives.

This is the heaviest single phase in the rollout. The PRD acknowledges
this explicitly in §P0.1; the pre-deploy / clean-rebuild posture
(§P3.6) is what makes the cost acceptable.

## P1. Preconditions

- Phase 1a shipped: every `read_only_schema` reference deleted, the
  lock model lives on `FieldDef.locked`, the `"record_id"` slug
  guard rejects offending writes.
- Phase 1a tests green; no in-flight refactors of the table
  contracts or the schema-mutation pipeline.
- Q-F6, Q-F9, Q-F10, Q-F12, Q-F13 confirmed (PRD-resolved).
- Dev DB acknowledged as throw-away — anyone with local Phase 1a
  data understands they will rebuild on phase boundary.

## P2. Scope

### P2.1 In scope

1. New Pydantic model `TableFieldDef` in
   `backend/features/project_document/custom_fields.py` (or its
   successor module) with the shape from PRD §P4.2.
2. `CustomFieldDef` → `TableFieldDef` migration: every model field
   rename, every serializer touchpoint, every test fixture.
3. Drop the advisory `field_key` slug on custom fields. `field_key`
   is the identity slot for both built-in (`"number"`) and custom
   (`cf_*`) — matches the existing frontend convention.
4. Each per-table envelope (e.g. `RoomsTableEnvelope`) now stores
   `field_defs: list[TableFieldDef]` (renamed from `custom_fields`).
   New built-in entries land with `origin: "built_in"`; existing
   custom entries land with `origin: "custom"`.
5. Row-model reshape per PRD §P5.1 / §P5.2:
   - `RoomRow` retains only locked-type columns + plumbing
     (`floor_level`, `building_zone`, `icfa_factor`, `erv_unit_ids`,
     `catalog_origin`, `notes`) + the renamed bag (`custom_values`).
   - `PumpRow` retains only locked-type columns (`device_type`,
     `phase`, `link`, `notes`) + `datasheet_asset_ids` + `custom_values`.
   - Mutable-type fields (`number`, `name`, `num_people`,
     `num_bedrooms` on Rooms; `use`, `manufacturer`, `model`,
     `volts`, `horse_power`, `wattage`, `flow_gpm`,
     `runtime_khr_yr` on Pumps; Pumps' `tag` survives this phase
     so Phase 2 can rename it cleanly to `record_id`) live in
     `custom_values`.
6. `row.custom` → `row.custom_values` rename across the codebase.
7. `CustomFieldCapability` reshape in
   `backend/features/project_document/tables/contracts.py`:
   - `core_field_keys` → `field_keys`.
   - `core_display_names` removed (display names now live on
     persisted FieldDefs).
   - `required_core_select_fields` → `required_field_keys`.
   - `core_field_value_for_formula` → `field_value_for_formula`;
     reads through both typed columns and `custom_values` based on
     the FieldDef's `field_type`.
   - `core_field_type_for_formula` → `field_type_for_formula`;
     reads the persisted FieldDef list.
   - `read_core_option_value` / `set_core_option_value` →
     `read_field_option_value` / `set_field_option_value`.
   - Capability instance renames: `rooms_custom_fields` →
     `rooms_field_registry` (or similar; pick one name and apply
     uniformly).
8. `validate_document_references` rewrites to walk the persisted
   FieldDef list, *not* hard-coded constants. `ROOMS_CORE_DISPLAY_NAMES`
   in `document.py` is removed; its uniqueness check derives from
   the loaded FieldDef list. The validator continues to enforce
   option-list references for single-select fields (Phase 1a's
   constraints don't change here).
9. `ROOMS_CORE_FORMULA_TYPES` and the helper functions
   (`_read_rooms_core_field_for_formula`,
   `_rooms_core_field_type_for_formula`) become pass-throughs over
   the persisted FieldDef list, or are removed entirely if the new
   capability accessors cover them.
10. Audit-log kind renames in `mutations/models.py::AUDIT_KIND_BY_MUTATION`:
    `project_version_custom_field_*` → `project_version_field_*`.
11. Schema fingerprint algorithm (`computeTableSchemaFingerprint`)
    includes every persisted FieldDef (built-in + custom), keyed by
    `field_key` + `field_type`, ordered by seed order then by
    creation order for customs. Both the frontend
    (`hooks/useTableSchema.ts`) and the backend
    (`tables/_fingerprint.py`) must agree to the byte.
12. `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` bumps from 2 to 3.
    `ProjectDocumentV1.schema_version: Literal[3]`. No v2 reader.
13. `context/technical-requirements/data-model.md §6.6` updated: the
    "Core fields stay strongly typed in the row model" rule is
    superseded. Document the new mixed-storage rule, the JSON
    Schema regression, and the `TableFieldDef` shape.
14. Published JSON Schema regenerated: mutable-type built-in fields
    no longer advertise `integer >= 0` etc. — they advertise the
    union `CustomValue = str | int | float | bool | None` per the
    `custom_values` bag.
15. Frontend `useTableSchema` consumes the persisted FieldDef list
    directly (no separate `coreFieldDefs` argument; feature code
    passes the persisted list straight through). The seed-vs-loaded
    decision moves into the feature's load-time hook.
16. Seed defaults flow from FieldDef.default through
    `coerce_custom_value` into row `custom_values` on first save.

### P2.2 Out of scope (deferred)

- Adding the actual `record_id` FieldDef entry on Rooms / Pumps →
  Phase 2.
- Renaming Pumps `tag` → `record_id` → Phase 2.
- Deleting `IdentifierConfig` / `IDENTIFIER_COLUMN_ID` / `resolve.ts`
  synthetic branch → Phase 2.
- User-driven `field_type` changes through the modal → Phase 3.
  Phase 1a's "type-picker disabled on built-ins regardless of lock"
  hard rule stays in place.
- Conversion-matrix `formula` entries → Phase 3.
- Catalog tables' seed FieldDef lists → Phase 4.

## P3. Rules & Constraints

1. **Pre-deploy posture.** No v2 reader. A document tagged
   `schema_version: 2` fails fast with a structured error pointing
   at the version-bump expectation. Dev databases get rebuilt.
2. **No silent inject-on-load.** Built-in field additions to an
   existing document are explicit upgrades through the service
   layer (PRD §P4.2.3 / Q-F12). The Phase 1b cutover itself counts
   as one such upgrade: a one-shot conversion that synthesizes the
   built-in FieldDef list on every existing project under the new
   schema version. Stored row values are migrated by the same
   pass — for each mutable-type built-in, copy the column value
   into `custom_values[field_key]`, then strip the column.
3. **Identity carrier is `field_key` (Q-F10).** No `id` slot
   introduced on `TableFieldDef`. The advisory `field_key` slug on
   custom fields is removed cleanly — no rename, no shim.
4. **Locks remain frontend-only (Q-F9).** `TableFieldDef` has no
   `locked` column. Backend services that need lock awareness read
   from the per-table capability registry at request time.
5. **`origin` is persisted** so feature code can find "the built-in
   entry for `field_key='number'`" without re-matching by key.
6. **Catalog-origin only on locked-type fields.** Mutable-type
   built-ins do not accept catalog-sourced values. The bookshelf-
   picker pipeline (US-WIN-11) targets typed columns only.
   `catalog_origin` validators in Phase 1b enforce this on document
   write.
7. **One semantic gesture = one undo entry** continues to hold for
   the schema-mutation pipeline. Phase 1b touches the *shape* of
   the persisted mutations payload, not the gesture-per-undo
   contract.
8. **Audit-log renames are wire-breaking on the activity log.** The
   `user_action_log` table accumulates entries with the new kinds;
   any query / dashboard that filters by the old `_custom_field_*`
   keys (none in v1) must be updated. There is no audit-log
   back-compat reader.
9. **Fingerprint stability tests are the gate for view-state
   regression.** Any change to the fingerprint serialization breaks
   persisted user view state across the cutover, but that is
   acceptable in the dev-only world.

## P4. Workstreams

### P4.1 Data model

- Define `TableFieldDef`.
- Rename `CustomFieldDef` → `TableFieldDef` everywhere it appears.
- Reshape `RoomsTableEnvelope`, `EmptyEquipmentTables` (Pumps shell),
  and any other table envelope to carry `field_defs:
  list[TableFieldDef]`.
- Strip the advisory `field_key` slug on custom-field models.
- Row-model rewrites: `RoomRow`, `PumpRow`, and any test fixtures.
- `row.custom` → `row.custom_values` everywhere.

### P4.2 Capability + validation

- `CustomFieldCapability` rename / reshape (per P2.1 item 7).
- Capability accessors rewrite to read from the persisted FieldDef
  list.
- `validate_document_references` rewrite (item 8).
- `ROOMS_CORE_DISPLAY_NAMES` removal (item 8).
- Formula-type helper simplification (item 9).

### P4.3 Schema version bump + upgrade

- Bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` to 3.
- `ProjectDocumentV1.schema_version: Literal[3]`.
- Write a one-shot upgrade function used by:
  - Dev seed scripts.
  - Existing project bodies when they round-trip through
    `validate_document` / `store.py::project_version_from_…`.
  - Tests that load v2 fixtures (each test fixture migrates to v3).
- The upgrade function:
  1. Reads the v2 body.
  2. Synthesizes the per-table FieldDef list from the v2
     `custom_fields` array + the feature seed for built-ins.
  3. Copies mutable-type column values into `custom_values`.
  4. Rewrites the body shape (envelope rename, row reshape).
  5. Re-runs `validate_document` against the v3 contract.

### P4.4 Audit-log renames

- Rename `AUDIT_KIND_BY_MUTATION` entries.
- Update every audit-emit site.
- Update any dashboard / SQL fixture that references the old names.

### P4.5 Fingerprint algorithm

- Extend `computeTableSchemaFingerprint` to include built-in entries.
- Mirror the change byte-for-byte in `tables/_fingerprint.py` and
  in `frontend/.../hooks/useTableSchema.ts`.
- Test round-trip: backend digest equals frontend digest on a
  hand-built fixture.

### P4.6 Frontend `useTableSchema`

- Stop accepting `coreFieldDefs` as a separate argument; feature
  consumers pass the loaded FieldDef list straight through.
- Apply the seed-derived `locked` arrays as a render-time overlay
  (Phase 1a infrastructure).
- Update every feature page (`RoomsPage`, `PumpsTable`, future
  catalog managers) that calls `useTableSchema`.

### P4.7 Docs

- `context/technical-requirements/data-model.md §6.6`: rewrite the
  "Core fields stay strongly typed in the row model" rule. Document
  the new mixed-storage shape (locked-type columns + `custom_values`
  bag). Note the JSON Schema regression. Add a `TableFieldDef`
  shape block matching PRD §P4.2.
- `context/technical-requirements/save-versioning.md §8.3`: add a
  note that v3 documents reject incoming v2 payloads.
- `context/PRD.md §10.5`: document the schema-evolution event;
  reference the Phase 1b plan for detail.

## P5. Evaluation Method

### Backend
- **Round-trip test:** start from a Phase 1a v2 fixture, run the
  upgrade function, save the v3 body, load it back, assert
  byte-equivalence with the synthesized v3 fixture.
- **Validator tests:**
  - Old: `ROOMS_CORE_DISPLAY_NAMES`-driven duplicate check.
  - New: walks the FieldDef list. Test that adding a custom field
    that collides with a built-in's display name still rejects.
- **Fingerprint stability tests:**
  - Same FieldDef list → same fingerprint across reorderings of
    the dict.
  - Adding a new custom field changes the fingerprint.
  - Renaming a built-in's `display_name` does *not* change the
    fingerprint (display name is not part of the digest).
  - Changing a built-in's `field_type` does change the fingerprint.
- **Catalog-origin tests:**
  - Catalog-sourced value lands in a locked-type column. ✅
  - Catalog-sourced value targets a mutable-type field. ❌ (rejected).
- **Schema-version-bump test:**
  - Posting a `schema_version: 2` body to `/api/v1/...` returns a
    structured `document_schema_version_unsupported` error.

### Frontend
- **Type check** clean.
- **`useTableSchema` unit test:** loaded FieldDef list flows through
  unchanged; lock-list overlay applied per seed.
- **Round-trip render test:** render `RoomsTable` from a v3
  fixture and confirm the grid shows the same columns / values as
  Phase 1a.
- **Persistence test:** save / load a project; built-in FieldDef
  customizations (renames, descriptions) survive.

### End-to-end
- Playwright: create a new project, open Rooms, rename `Name` to
  "Bedroom Name" via the modal, save, reload, confirm the rename
  persists.
- Playwright: paste data into a built-in `number` column that lives
  in `custom_values` and confirm the value round-trips.

## P6. Success Criteria (Gating)

Phase 1b is done when **all** of the following are true:

1. `TableFieldDef` is the sole field-config model. `CustomFieldDef`
   no longer exists; nothing references it.
2. `RoomRow` / `PumpRow` carry only the locked-type columns +
   plumbing + `custom_values`. The mutable-type columns (`number`,
   `name`, `num_people`, `num_bedrooms`, etc.) are removed.
3. `CustomFieldCapability` is renamed (e.g.
   `TableFieldRegistry` / `rooms_field_registry`) and its `core_*`
   members are removed or renamed per P2.1.
4. `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION == 3`.
5. `ProjectDocumentV1.schema_version: Literal[3]` enforced; v2
   bodies rejected.
6. `validate_document_references` walks the persisted FieldDef list.
   `ROOMS_CORE_DISPLAY_NAMES` is gone.
7. Audit-log kinds renamed; no `_custom_field_` remains in the
   audit-emit code path.
8. Schema fingerprint includes built-in entries and matches between
   frontend / backend on a hand-built fixture (one byte-equivalence
   test per table).
9. Published JSON Schema regenerated; mutable-type built-in fields
   advertise the `custom_values` shape; locked-type fields keep
   their tight types.
10. `context/technical-requirements/data-model.md` §6.6 rewritten;
    the "Core fields stay strongly typed" rule is gone.
11. A user can rename a built-in field (e.g. `num_people` → "People
    Count") through the modal; the rename survives Save and
    project reload. (Re-test of Phase 1a's user-visible flow against
    persisted storage.)
12. The full test suite passes; no v2 fixtures remain except
    those explicitly testing the rejection path.
13. `make smoke` passes after a clean rebuild of the local DB.

## P7. Risks & Mitigations

- **Risk:** A consumer reads `room.number` directly without going
  through `custom_values`. Silent runtime error.
  - **Mitigation:** TypeScript / Pydantic type signatures catch
    most. Add a Vitest test that asserts `room.number` is no
    longer a typed attribute on `RoomRow`.
- **Risk:** Schema fingerprint mismatch between frontend and
  backend after the algorithm extension.
  - **Mitigation:** golden-file test on a hand-built fixture, run
    in both Vitest and pytest with the same JSON serialization
    inputs.
- **Risk:** The upgrade function silently drops a value during the
  v2 → v3 migration of mutable-type columns.
  - **Mitigation:** explicit per-row round-trip test fixture for
    every mutable-type built-in.
- **Risk:** Catalog-origin enforcement on mutable-type fields
  breaks an in-flight catalog refresh test.
  - **Mitigation:** catalog refresh flows only target locked-type
    fields in Phase 1b. Phase 4 (catalog rollout) covers the full
    suite of catalog-coordinated tests.
- **Risk:** JSON Schema regression catches LLM / MCP users
  off-guard.
  - **Mitigation:** document the regression in `data-model.md` and
    in the LLM-MCP schema doc. The OpenAPI / JSON Schema endpoints
    surface the new shape; LLM agents querying the schema get the
    accurate view of mutable-type fields.

## P8. Out-Of-Band Considerations

- Phase 1b is the largest single phase in the rollout. Recommend
  landing it on a clean working branch with a dedicated PR.
- Dev DB recreation is required; communicate this in the merge
  commit so other dev environments rebuild.
- The schema-version bump is a forcing function for any downstream
  fixture (`fixtures/*.json`, golden files in tests). Inventory and
  migrate every fixture before merging.

## P9. Follow-Ups Out Of This Phase

- Phase 2 picks up the persisted `record_id` field and retires
  `IdentifierConfig`.
- Phase 3 lifts the Phase 1a hard rule that disables the type
  picker on built-ins.
- A future plan may add per-document Pydantic row models (PRD §P7
  out-of-scope reminder); not in any current phase.
