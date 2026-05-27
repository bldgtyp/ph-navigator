---
DATE: 2026-05-26
TIME: 15:30 ET
STATUS: BACKEND COHORT LANDED 2026-05-26 (P4.1 + P4.2). Frontend
        (P4.3, P4.4) bundles with the deferred Phase 1c frontend
        reshape — useTableSchema doesn't yet consume `body.tables.
        <table>.field_defs`, so the data-table-level identifier
        deletion would land inert until that lands too. Backend
        artifacts: `record_id` formula seed on Rooms
        (`concat({Number}, " — ", {Name})`); `record_id` seed on
        Pumps replacing the Phase-1b `tag` entry (display_name "Tag");
        module-load assertions in `tables/rooms.py` + `tables/
        pumps.py`; `_require_exactly_one_record_id` validator in
        `document.py::ProjectDocumentV1.validate_document_
        references`; `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 4`
        with `schema_version: Literal[4]` (rejects v3 bodies);
        `reject_reserved_field_key` guard on `apply_add_field` +
        `apply_duplicate_field`; `empty_project_document` seeds
        Rooms + Pumps field_defs verbatim so the validator never
        fires zero-record_id on a fresh document. `uv run ty check
        features/` clean. Plan-30 superseded. Frontend P4.3 / P4.4
        / P4.5 docs + Playwright + backend test rewrites all remain.
AUTHOR: Claude (Opus 4.7)
SCOPE: Promote the pinned identifier column from a prop-driven
       synthetic to a real persisted FieldDef whose `field_key` is
       `"record_id"`. Delete `IdentifierConfig<TRow>`,
       `IDENTIFIER_COLUMN_ID`, `IDENTIFIER_HEADER_LABEL`, and the
       synthetic-column branch in `lib/identifier/resolve.ts`. Wire
       pinning, hide/reorder suppression, and the duplicate-warning
       chip off `field_key === "record_id"`. Replace Pumps' `tag`
       column end-to-end with `record_id`.
RELATED:
  - docs/plans/2026-05-26/editable-fields/plan-31-customizable-fields-prd.md (master PRD, §P4.3, §P5.1, §P5.2)
  - docs/plans/2026-05-26/editable-fields/_complete/plan-31-phase-1a-lock-model.md
  - docs/plans/2026-05-26/editable-fields/_complete/plan-31-phase-1b-persistence-reshape.md (predecessor)
  - docs/plans/2026-05-26/editable-fields/_complete/plan-30-datatable-identifier-column.md (superseded for identifier semantics)
  - context/technical-requirements/data-table.md (Identifier Column section to rewrite)
  - frontend/src/shared/ui/data-table/types.ts
  - frontend/src/shared/ui/data-table/lib/identifier/resolve.ts
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/components/GridHeader.tsx
  - frontend/src/shared/ui/data-table/lib/view/sanitize.ts
  - frontend/src/features/equipment/components/RoomsTable.tsx
  - frontend/src/features/equipment/components/PumpsTable.tsx
  - frontend/src/features/equipment/lib.ts
  - frontend/src/features/equipment/lib/roomsFormulaRegistry.ts
  - backend/features/project_document/document.py
  - backend/features/project_document/tables/contracts.py
  - backend/features/project_document/tables/rooms.py
---

# Plan 31 — Phase 2 — `record_id` As A Real Field

## P0. Phase Intent

Retire the Plan-30 `IdentifierConfig<TRow>` prop. Add a `record_id`
FieldDef to every project-document table's seed; the renderer pins
whichever FieldDef has `field_key === "record_id"` to slot 0. The
duplicate-warning chip, hide/reorder suppression, formula-style
identifier (Rooms), and direct-text identifier (Pumps) all derive
from the same FieldDef pipeline that the rest of the grid uses.

Pumps `tag` is removed from the row model and replaced by
`record_id`. Existing project documents (pre-deploy) are rebuilt
with `record_id` carrying the value `tag` held. The frontend
identifier-resolution helpers in `lib/identifier/resolve.ts` retire
except for the duplicate-detection utilities.

The phase delivers M3 from the master PRD (collapse the special-case
synthetic column) and unlocks Phase 3's user-driven type changes on
`record_id` (text ↔ formula).

## P1. Preconditions

- Phase 1b shipped: `TableFieldDef` persists, `RoomRow` / `PumpRow`
  reshaped, fingerprint algorithm extended, schema version at 3.
- Phase 1a's `"record_id"` slug guard is in place (a custom field
  cannot land with `field_key: "record_id"`).
- Q-F2, Q-F3, Q-F11 confirmed (PRD-resolved).
- Existing test suite green; no in-flight refactors of
  `DataTable.tsx`, `GridHeader.tsx`, or the identifier-resolve module.

## P2. Scope

### P2.1 In scope

1. Seed `record_id` FieldDef on Rooms (formula default `"{Number} — {Name}"`,
   `display_name: "Record-ID"`, locked `["display_name", "delete",
   "duplicate"]`).
2. Seed `record_id` FieldDef on Pumps (plain `text` / `short_text`,
   `display_name: "Tag"` per Q-F11, locked `["display_name", "delete",
   "duplicate"]`).
3. Replace Pumps' `tag` column with `record_id` end-to-end:
   - `PumpRow` loses the `tag` typed column (already deferred from
     Phase 1b — `tag` survived 1b so it could rename cleanly here).
   - Stored row values: every existing `tag` migrates into
     `custom_values["record_id"]` under the v3 → v4 upgrade pass.
   - `sortedPumps` fallback `tag ?? use ?? id` → `record_id ?? use ?? id`.
   - `applyWriteToPump` accepts writes to `record_id`, not `tag`.
   - `validatePumpsPayload`, `pumpsTableFieldDefs`, every test
     fixture that names `tag`.
4. Delete identifier abstractions from
   `frontend/src/shared/ui/data-table/`:
   - `IdentifierConfig<TRow>` type union.
   - `IDENTIFIER_COLUMN_ID` constant (`"__record_id__"`).
   - `IDENTIFIER_HEADER_LABEL` constant.
   - `applyIdentifierConfig` (the resolve function).
   - The `kind: "field"` / `kind: "computed"` / `kind: "field-broken"`
     resolution types.
   - The synthetic identifier FieldDef helper.
   - View-state whitelist entry for `__record_id__` in
     `sanitizeViewStateForSchema`.
5. Keep (retarget) the duplicate-detection helpers:
   - `computeIdentifierDuplicates` → rename to
     `computeRecordIdDuplicates`, retargeted at "the row of the
     FieldDef whose `field_key === 'record_id'`".
   - `describeDuplicateRows` keeps its name and shape.
6. `DataTable.tsx` pinning logic: pin the FieldDef whose
   `field_key === "record_id"` to slot 0 regardless of
   `view.columnOrder`. Drop the `identifier` prop entirely.
7. `GridHeader.tsx` / cell renderers: drop synthetic-column
   special cases. `record_id` renders through the normal
   computed / text pipeline based on its `field_type`.
8. Backend invariant: on document write, every custom-field-capable
   table's FieldDef list must contain **exactly one** entry with
   `field_key === "record_id"`. Zero or many → structured error.
9. Module-load assertion in every table contract module: when
   `TableFieldRegistry` (renamed `CustomFieldCapability`) is
   instantiated, assert the seed FieldDef list contains `record_id`.
   Same pattern as `_missing_formula_type_keys` in `tables/rooms.py`.
10. Wire Rooms' `record_id` formula through the existing formula
    evaluator. The `roomsFormulaRegistry` module — which today
    distinguishes `origin: "core" | "custom"` for the Plan-17
    formula registry — drops the `origin: "core"` short-circuit;
    the generic resolver handles both built-in and custom formula
    fields uniformly. `roomsFormulaRegistry` becomes a thin helper
    and may be inlined or deleted.
11. `RoomsTable.tsx` deletes `ROOMS_IDENTIFIER` (the
    `IdentifierConfig` literal).
12. `PumpsTable.tsx` deletes `PUMPS_IDENTIFIER`.
13. Bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` from 3 to 4.
    Upgrade pass: synthesize `record_id` FieldDef per table; for
    Pumps, copy `tag` → `custom_values["record_id"]` per row.
14. Update `context/technical-requirements/data-table.md`
    "Identifier Column" section to describe the new pinning rule
    (FieldDef-driven, no IdentifierConfig).
15. Update `context/UI_UX.md §1.7` if it references the synthetic
    identifier column or `IdentifierConfig`.

### P2.2 Out of scope (deferred)

- User-driven `field_type` change on `record_id` (formula → text,
  text → formula, etc.) through the modal → Phase 3.
- Conversion-matrix `formula` entries → Phase 3.
- Catalog-table `record_id` seeds → Phase 4.
- Window-types / Fans / ERVs / Thermal-bridges `record_id` seeds →
  Phase 4.
- "Duplicate record" right-click action → Phase 5.

## P3. Rules & Constraints

1. **`"record_id"` is reserved.** Custom fields cannot use it as
   `field_key`. Backend rejects on write. Frontend rejects on
   submit. (Phase 1a already shipped this guard; Phase 2 doubles
   down by depending on it.)
2. **Exactly one per table.** Zero `record_id` FieldDefs = structured
   error on document write. Two = same. The validator runs after
   any schema-mutation that touches the FieldDef list (add /
   duplicate / delete — though duplicate / delete are locked on
   `record_id` itself by the lock list, the validator is the
   defensive net).
3. **Module-load assertion in every table contract module** catches
   "developer added a new table and forgot `record_id`" at import
   time. Tests assert the assertion fires on a tampered fixture.
4. **Pinning rule is `field_key === "record_id"`, not header label,
   not `display_name`.** Display names (`"Tag"`, `"Record-ID"`,
   future per-feature labels) carry domain meaning; pinning never
   depends on them.
5. **Duplicate warning chip never blocks.** Two rows with the same
   `record_id` value still save. The chip is advisory only — same
   contract as Plan-30 D14 / `data-table.md` Identifier Column rules.
6. **Pre-deploy posture** continues. Phase 2 is one more
   schema-version bump with a one-shot upgrade pass. No v3 reader.
7. **`record_id`'s `display_name` is locked by default but lockable
   off** per feature. The renderer pins by `field_key`, so a
   feature author who unlocks `display_name` on `record_id` is
   only letting users rename the header; pinning is unaffected.
8. **No `formula` lock on `record_id`** in Phase 2 — the formula
   editor remains locked because the conversion-matrix work that
   would let the user change `record_id` from formula → text lives
   in Phase 3. Phase 2 ships `record_id` with its seed formula
   intact and read-only. Phase 3 unlocks formula editing.

## P4. Workstreams

### P4.1 Backend seed updates

- `tables/rooms.py`: add `record_id` to the seed FieldDef list,
  with the formula default `"{Number} — {Name}"`. Module-load
  assertion.
- Pumps contract module (the equivalent of `tables/rooms.py` for
  pumps — same pattern): add `record_id` seed, module-load
  assertion.
- `validate_document_references`: add the "exactly one
  `record_id`" check per table.

### P4.2 Backend row reshape

- `PumpRow` loses `tag`.
- Upgrade pass: each existing `pump.tag` becomes
  `pump.custom_values["record_id"]`.
- Bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` to 4. Reject v3
  bodies.

### P4.3 Frontend identifier deletion

- Delete `IdentifierConfig<TRow>` from `types.ts`.
- Delete `IDENTIFIER_COLUMN_ID`, `IDENTIFIER_HEADER_LABEL` from
  `types.ts`.
- Delete `applyIdentifierConfig` and the synthetic helpers in
  `lib/identifier/resolve.ts`.
- Retain `computeIdentifierDuplicates` (rename to
  `computeRecordIdDuplicates`) and `describeDuplicateRows`. Move
  into a smaller `lib/recordId.ts` module if it tidies imports.
- Drop the `__record_id__` whitelist entry in
  `lib/view/sanitize.ts`.
- `DataTable.tsx`: drop the `identifier` prop and all consumers of
  it; pin by `field_key === "record_id"`.
- `RoomsTable.tsx` / `PumpsTable.tsx`: drop the `ROOMS_IDENTIFIER` /
  `PUMPS_IDENTIFIER` constants and the `identifier=` prop on
  `<DataTable>`.
- Pumps frontend `applyWriteToPump`, `sortedPumps`, etc. retarget
  `tag` → `record_id`.

### P4.4 Formula registry simplification

- `buildRoomsFormulaRegistry`: drop the `origin: "core" | "custom"`
  short-circuit. Built-in formula fields and custom formula fields
  flow through the same code path.
- If after this simplification `roomsFormulaRegistry.ts` is just a
  thin call-through, inline it into `RoomsTable.tsx` or delete it.

### P4.5 Docs

- `context/technical-requirements/data-table.md` "Identifier Column"
  section: rewrite to describe the FieldDef-driven pinning rule.
  Note that `IdentifierConfig` retired.
- `context/UI_UX.md §1.7`: scrub references to the synthetic
  identifier.
- `docs/plans/2026-05-26/editable-fields/_complete/plan-30-datatable-identifier-column.md`
  STATUS header: mark superseded by Phase 2 (or move to
  `docs/REMOVED.md` per the project convention).

## P5. Evaluation Method

### Backend
- **Module-load test:** instantiate each table's `TableFieldRegistry`
  with a seed list missing `record_id`; assert the module-load
  assertion fires.
- **Validator tests:**
  - Document with two `record_id` entries → structured error.
  - Document with zero `record_id` entries → structured error.
- **Upgrade-pass test:** load a Phase-1b fixture with Pumps `tag`
  values; run the v3 → v4 upgrade; assert every `tag` value lives
  in `custom_values["record_id"]`.
- **Schema-version-rejection test:** v3 body rejected with
  structured error.

### Frontend
- **Type check** clean after `IdentifierConfig` deletion.
- **Pinning test:** render `RoomsTable` / `PumpsTable`; the first
  column is whichever FieldDef has `field_key === "record_id"`,
  regardless of `view.columnOrder`.
- **Hide/reorder suppression test:** the user cannot hide or
  reorder `record_id` (delete/duplicate already locked by lock list).
- **Duplicate chip test:**
  - Rooms with two rows where `{Number} — {Name}` produces the
    same value → chip renders on both.
  - Pumps with two rows whose `record_id` value matches → chip
    renders on both.
  - Empty / whitespace identifier values do not warn.
- **Formula evaluator test:** Rooms' `record_id` value updates
  when `Number` or `Name` changes (existing formula-evaluator
  contract; the new wiring just routes through the generic
  resolver).
- **View-state sanitize test:** persisted view states with
  `"__record_id__"` entries silently drop on load (because the
  whitelist is gone). Build a fixture for this and assert.

### End-to-end
- Playwright: open a Rooms project. Confirm "Record-ID" column is
  pinned. Rename a room's `Number`; the `Record-ID` value updates
  live.
- Playwright: open a Pumps project. Confirm "Tag" column is
  pinned (header label is "Tag", not "Record-ID"). Edit a tag;
  the value persists.
- Playwright: type the same tag into two rows; both rows show the
  duplicate-warning chip.

## P6. Success Criteria (Gating)

Phase 2 is done when **all** of the following are true:

1. `IdentifierConfig`, `IDENTIFIER_COLUMN_ID`,
   `IDENTIFIER_HEADER_LABEL`, and `applyIdentifierConfig` no longer
   exist anywhere in the source tree.
2. The `identifier` prop is gone from `DataTableProps<TRow>`. Every
   table page that previously passed it is updated.
3. `PumpRow.tag` no longer exists. The frontend has no remaining
   reference to `pump.tag`.
4. Rooms and Pumps each have a `record_id` seed FieldDef with the
   shapes from PRD §P5.1 / §P5.2.
5. The pinned leading column on every grid is determined by
   `field_key === "record_id"`.
6. Every custom-field-capable table contract module has a
   module-load assertion that the seed contains `record_id`.
   Tampered seed → ImportError at module load.
7. `validate_document_references` rejects documents with zero or
   many `record_id` entries per table.
8. `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION == 4`. v3 bodies
   rejected.
9. `roomsFormulaRegistry`'s `origin: "core"` short-circuit is gone.
   Built-in formula fields and custom formula fields share the
   same code path.
10. `context/technical-requirements/data-table.md` Identifier Column
    section rewritten; mentions FieldDef-driven pinning, not
    `IdentifierConfig`.
11. `docs/plans/2026-05-26/editable-fields/_complete/plan-30-datatable-identifier-column.md`
    marked superseded.
12. The duplicate-warning chip works for both formula-derived
    Rooms identifiers and direct-text Pumps identifiers.
13. Full test suite green; Playwright smoke passes.

## P7. Risks & Mitigations

- **Risk:** A consumer references `IDENTIFIER_COLUMN_ID` somewhere
  unexpected (e.g. an older test fixture, a styling rule).
  - **Mitigation:** `grep -r "IDENTIFIER_COLUMN_ID\|__record_id__"`
    before merging. TypeScript catches the constant-deletion
    cases.
- **Risk:** A view-state record with `"__record_id__"` in
  `columnWidths` or `sort` persists across the cutover, causing
  silent drops on load.
  - **Mitigation:** `sanitizeViewStateForSchema` drops the
    `__record_id__` entries cleanly. Add a Vitest test that
    feeds a pre-cutover view-state into the post-cutover
    sanitizer and confirms the entries are dropped without error.
- **Risk:** Pumps' `tag → record_id` rename is missed in a
  subtle path (e.g. CSV export, MCP `get_table`).
  - **Mitigation:** grep for `\.tag\b` in the Pumps domain
    (`pumps`, `PumpRow`, `pumpsTable`) and review every match.
- **Risk:** The module-load assertion fires for a table contract
  that has not yet adopted `record_id` (e.g. a stub Fans contract
  added but never seeded).
  - **Mitigation:** Phase 2 only ships `record_id` on Rooms +
    Pumps. The assertion lives on `TableFieldRegistry`, which is
    only instantiated for tables that opt in. Stub tables that
    have not opted in have no registry instance and no assertion.
    Phase 4 owns the rollout to remaining tables.
- **Risk:** Existing Plan-30 tests (`identifier.test.ts`,
  `columnHeaderDoubleClick.test.tsx`) reference deleted constants.
  - **Mitigation:** rewrite those tests to assert the new pinning
    rule. Move them to `recordId.test.ts` if the name no longer
    reflects what they cover.

## P8. Out-Of-Band Considerations

- `docs/REMOVED.md` should be updated to route any reader who
  reaches plan-30 to the new identifier semantics.
- The Pumps domain stakeholder (Ed) should confirm the seed
  `display_name: "Tag"` matches expectations before merge — the
  existing identifier display already says "Record-ID" on Pumps as
  of Plan-30 Phase B, so Phase 2 is a UX change in the user-
  visible header label. (Q-F11 already resolved this.)

## P9. Follow-Ups Out Of This Phase

- Phase 3 unlocks user-driven type change on `record_id` (formula
  ↔ text) and extends the conversion matrix to cover formula.
- Phase 4 adds `record_id` seeds to the remaining tables (catalog
  tables, Window-Types, Fans, ERVs, Thermal Bridges).
- Phase 5 (optional) adds the "Duplicate record" right-click
  context-menu action (deferred from Plan-30).
