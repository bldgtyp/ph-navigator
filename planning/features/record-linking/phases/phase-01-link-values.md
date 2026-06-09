---
DATE: 2026-06-08
TIME: planning
STATUS: Phase 1 backend complete; frontend standalone primitives +
        FieldConfigModal integration + `useRowFocusHighlight` hook +
        backend changeType e2e pytest complete (second pass
        2026-06-08); data-table dispatch (GridBody render +
        useGridEdit editor + DataTable `linkedRecordOps` prop)
        complete (third pass 2026-06-08); RoomsTable column accessor
        + `linkedRecordOps` prop pass-through + `buildLinkedRecordOps`
        helper + `tableFieldToFieldDef` linked_record_config mapping
        complete (fourth pass 2026-06-08); RoomsPage builder
        invocation + EquipmentPageBody `?tab`/`?focus` URL seeding +
        PumpsTableSlot focus highlight complete (fifth pass
        2026-06-08) — the rooms→pumps add/link/navigate loop is now
        closed end-to-end. P4.4 fill/paste/undo + linked_record write
        routing into `custom_links` complete (sixth pass 2026-06-08).
        **Current audit 2026-06-09:** Phase 1.b §A1–§A7 and §B1–§B7
        are implemented with focused regression tests, but Phase 1 is
        not Complete / user-shippable yet. Missing closeout: fix the
        linked_record deleteField `custom_links` cleanup bug, record a
        browser smoke / e2e for the canonical Rooms→Pumps loop. The
        current `make format` / `make ci` gate is green. Live next
        steps are tracked in `../STATUS.md`.
AUTHOR: Ed May (with Claude)
SCOPE: First user-facing slice: a `linked_record` custom field type
       that editors can add through the field-config modal, link
       through a record-picker, and unlink through the picker or pill
       ⌫. No inverse view, no rollups, no cycle detection.
RELATED:
  - planning/features/record-linking/PRD.md §4 (Phase 1), §5, §6, §7
  - planning/features/record-linking/PRD.md §11 Q11–Q25 (locked
    implementation decisions for this phase)
  - planning/features/record-linking/options.md §5
  - context/technical-requirements/data-model.md §6.3, §6.6.3
  - context/technical-requirements/data-table.md
  - backend/features/project_document/custom_fields.py
  - backend/features/project_document/document.py
  - backend/features/project_document/tables/contracts.py
  - backend/features/project_document/tables/rooms.py + every other
    FieldDef-capable table (the `RowWithCustomFields` mixin sweep)
  - backend/features/project_document/mutations/{models.py,
    field_ops.py, type_conversion.py}
  - frontend/src/shared/ui/data-table/types.ts (CellWrite, WriteOp)
  - frontend/src/shared/ui/data-table/lib/customFieldMutations.ts
---

# Record-linking Phase 1 — Link values

## P0. Why this slice

Phase 1 makes `linked_record` a first-class custom field type with
the **complete write path** end-to-end:

- editors add the field through the existing field-config modal;
- the picker reads the target table's rows and writes a list of ids
  into a new `custom_links: dict[str, list[str]]` bag on the source
  row;
- the cell renders a pill list; clicking a pill navigates to the
  target row in the target table;
- fill-handle / paste / MCP / undo / save / Save-As all work the
  same as any other field type.

Phase 1 itself owns **no inverse view** — Phase 2 owns that. The
current checkout now has active Phase 2 WIP for read-only inverse
columns, but the source-side Phase 1 editing path should still stand
on its own. Phase 1 is not done until the linked-field delete cleanup,
browser smoke / e2e evidence, and current full CI gate are closed.

## P1. Source review notes

Use `PRD.md` as the canonical contract. Every decision needed to
implement Phase 1 is already resolved in §11 Q11–Q25. Do NOT
re-litigate:

- **Wire shape.** `CellWrite.value` already typed `unknown`; the
  linked-record value is `string[]`. Backend dispatch routes by the
  resolved `FieldDef.field_type` — no new `WriteOp` variant, no new
  cell-write op kind on the frontend. (Q11)
- **changeType.** Going to or from `linked_record` wipes the row
  entry on both bag sides for that `field_key`. Mutation summary
  reports the cleared row count. (Q12)
- **Editing `target_table_path`.** Rejected at the schema-mutation
  validator with a clear error message. Editor must delete + re-add
  to retarget. `max_links` is freely editable. (Q13)
- **`link_targetable` flag.** New field on `TableContract`,
  defaults `True`. (Q15)
- **Bag exclusivity.** A `field_key` appears in `custom_values`
  XOR `custom_links` based on `field_type`. Validator rejects
  co-existence. (Q16)
- **Picker UX defaults.** `record_id` + `display_name`, substring
  search on `record_id`, sort by `record_id` ascending, virtualize
  past 100 rows. (Q17)
- **Pill fallback.** Empty `record_id` falls back to the row id
  rendered muted/italic. (Q18)
- **Pill click navigation.** `?focus=<row_id>` query param + a
  transient highlight class on mount. Reuses existing routing. (Q19)
- **Pill ordering.** Insertion order, no manual reorder. (Q20)
- **Fill-handle / paste.** Fill copies the full id list. Paste
  between matching `target_table_path` succeeds; mismatched paths
  reject. Stringified pill text rejected. (Q24)
- **MCP dedupe.** Validator silently dedupes within-cell duplicates;
  cap violations hard-fail. (Q25)

If implementation friction surfaces a question not answered by §11,
escalate as a `decisions.md` entry; do not solve it inline in code
without a PRD update.

## P2. Acceptance — Phase 1 done when

**Status as of 2026-06-09 audit** — see `../STATUS.md` for the live tracker:

| # | Item | State |
|---|---|---|
| 1 | enum + JSON-Schema-side wire shape | ✅ enum + `custom_links` row shape shipped; JSON-Schema export regen pending if a generated artifact is shipped (P4.6) |
| 2 | modal exposes "Linked Record" + target + cardinality | ✅ `FieldConfigSectionLinkedRecord` integrated into `FieldConfigModal`; Save gated on target pick; Q13 target-lock honored in-place |
| 3 | save round-trip through schema-mutation pipeline | ✅ add / edit / changeType path works; deleteField has a known `custom_links` cleanup bug tracked below |
| 4 | picker UX (search, sort, virtualize, columns) | ✅ `LinkedRecordPicker` rendered by `GridBody` in edit mode; mode derived from `linked_record_config.max_links`; candidates supplied via `linkedRecordOps[fieldKey].candidates` |
| 5 | pill list renders picked rows w/ fallback | ✅ `LinkedRecordCell` rendered by `GridBody` in read mode; resolver supplied via `linkedRecordOps[fieldKey].resolve`; RoomsTable column accessor + `buildLinkedRecordOps` helper land the consumer-side path; `tableFieldToFieldDef` now propagates `linked_record_config` from persisted config |
| 6 | pill click → `?focus=<row_id>` highlight | ✅ Rooms→Pumps page wiring complete via `EquipmentPageBody` URL seeding, active-tab selection, and `PumpsTableSlot` focus highlight |
| 7 | ⌫ unlink | ✅ `LinkedRecordCell.onPillUnlink` shipped; picker re-Confirm with the pill removed is the editor-side unlink path. (Direct Backspace-on-focused-pill while in read mode is not yet bound to a cell-write — see Deferred.) |
| 8 | save/save-as/discard + JSON download round-trip | ✅ backend pydantic round-trip clean; download path inherits the mixin |
| 9 | validator (target resolution, retarget, cap, dedupe, orphan strip, bag exclusivity) | ✅ all shipped — `_validate_rows_custom_links` + `_validate_linked_record_field_defs` + `bundle.py` retarget guard |
| 10 | `changeType` wipes both bag sides + summary count | ✅ `linked_record_wipe` policy + `_apply_linked_record_wipe` |
| 11 | fill / paste / stringified-paste reject | ✅ shipped (sixth pass) — `applyWriteToRoom` routes linked_record writes via `setCustomLink`; `coerceFieldValue` parses JSON id lists, dedupes, drops empties, enforces `max_links`, rejects stringified pill text |
| 12 | MCP `linked_ids` payloads | ✅ inherits via `RowWithCustomFields` + mutation enum admission |
| 13 | `erv_unit_ids` retirement + `schema_version` 4 → 5 | ✅ shipped end-to-end (RoomRow, validator, constants, ~13 backend fixtures, frontend types + RoomsTable + equipment lib) |
| 14 | `RowWithCustomFields` mixin across `*Row`s | ✅ all 9 row models inherit |
| 15 | `_validate_rows_custom_links` wired per table | ✅ wired on every FieldDef-capable table |
| 16 | `make ci` green; vitest + pytest add coverage | ✅ focused backend / frontend regression suites pass; current checkout `make format` left files unchanged and `make ci` is green |
| 17 | linked_record deleteField removes stored links | ❌ current backend leaves `custom_links[field_key]` on rows after deleting the FieldDef and returns `422 invalid_project_document`; fix in `field_ops.py` / `guards.py` |
| 18 | browser smoke / e2e evidence | ❌ no recorded MCP smoke, screenshots, clip, or reusable `frontend/tests/e2e/` spec yet for the canonical Rooms→Pumps loop |

Legend: ✅ shipped · ⚠️ partially complete / blocked by current closeout · ❌ missing next step

1. The `CustomFieldType` enum admits `linked_record` and the JSON
   Schema export includes it as a field type and includes the
   `custom_links` row shape.
2. The field-config modal exposes "Linked Record" as a type option.
   Selecting it surfaces a target-table dropdown that lists every
   `TableContract` where `link_targetable=True` and `table_path`
   differs from the current table. A Single / Multiple cardinality
   toggle defaults to Single.
3. Editor can save a new linked-record field through the existing
   schema-mutation pipeline. The field appears as an empty column.
4. Clicking a linked-record cell opens the record-picker modal.
   Picker lists target rows by `record_id` (+ `display_name` if
   present), virtualizes past 100 rows, supports substring search
   on `record_id` (case-insensitive, normalized).
5. Editor picks one or more rows (radio for single, checkbox for
   multi) and confirms. The cell renders the picked rows as a pill
   list using the target's `record_id` (or the row id muted/italic
   on empty `record_id`).
6. Pill click navigates to the target table with `?focus=<row_id>`
   and the destination row scrolls into view with a transient
   highlight class.
7. ⌫ on a pill in editor mode removes it from the cell; confirming
   the picker without that pill saves the change.
8. Save / Save-As / Discard round-trip the new `custom_links` bag
   cleanly. JSON download includes `custom_links`; re-uploading the
   download round-trips through the validator.
9. The validator:
   - rejects an `addField` whose `target_table_path` doesn't resolve
     or whose target contract is not `link_targetable` or whose
     target equals the field's own `table_path`;
   - rejects an `editField` that changes `target_table_path` on an
     existing linked_record field (Q13);
   - rejects a row whose `custom_links[field_key]` exceeds
     `max_links`;
   - silently dedupes within-cell duplicate ids (Q25);
   - silently strips orphan ids on save against the current draft
     snapshot (Q5 amendment);
   - rejects a row whose `field_key` appears in both `custom_values`
     and `custom_links` (Q16).
10. `changeType` to/from `linked_record` (in either direction) wipes
    the row entry on both bag sides for that `field_key` on every
    row in the same transaction; the mutation response includes the
    cleared row count.
11. Fill-handle drag copies the source cell's full id list to every
    destination cell. Paste between linked-record cells of matching
    `target_table_path` succeeds; mismatched paths reject at draft
    sync with `422 invalid_cell_value`. Stringified-text paste into
    a linked-record cell rejects.
12. MCP cell-write tool admits `linked_ids: string[]` payloads;
    bulk MCP writes share the per-cell validator pipeline.
13. `RoomRow.erv_unit_ids: list[str]` is deleted along with its
    validator rule, `ROOMS_TYPED_COLUMN_FIELD_KEYS`,
    `ROOMS_TYPED_COLUMN_FORMULA_TYPES`, every fixture / factory /
    seed referencing it, and the document `schema_version` bumps
    from 4 → 5.
14. `RowWithCustomFields` Pydantic mixin owns both `custom_values`
    and `custom_links` with their default factories; all nine
    `*Row` models inherit from it.
15. `_validate_rows_custom_links` exists alongside
    `_validate_rows_custom_values` and is called once per
    FieldDef-capable table in `validate_document_references`.
16. All `make ci` gates green; Vitest + pytest add coverage for the
    new field type.

## P3. Backend work

### P3.1 — `CustomFieldType.linked_record` and coercion

`backend/features/project_document/custom_fields.py`:

- Add `linked_record = "linked_record"` to the `CustomFieldType`
  enum.
- Add a `coerce_link_value` helper that validates a `list[str]`
  payload: each id matches a configured id pattern, the list does
  not exceed `max_links`, within-list duplicates are deduped
  silently. Returns the cleaned `list[str]`.
- `coerce_custom_value` raises if called with `linked_record` —
  link values do not flow through the scalar bag.
- Add `validate_link_config` (mirrors `validate_number_config`):
  asserts `config.target_table_path` is a non-empty tuple/list of
  strings and `config.max_links` is `1` or `None`. Called from
  `TableFieldDef.validate_config`.

### P3.2 — `RowWithCustomFields` mixin + `custom_links` on every row

`backend/features/project_document/document.py`:

- Define `RowWithCustomFields(BaseModel)` carrying:
  ```python
  custom_values: dict[str, CustomValue] = Field(default_factory=dict)
  custom_links:  dict[str, list[str]]  = Field(default_factory=dict)
  ```
- Refit `RoomRow`, `PumpRow`, `FanRow`, `ElectricHeaterRow`,
  `VentilatorRow`, `HotWaterHeaterRow`, `HotWaterTankRow`,
  `ApplianceRow`, `ThermalBridgeRow`, `ApertureRow` (and any other
  `*Row` model that today carries `custom_values`) to inherit from
  the mixin instead of declaring `custom_values` inline.
- Bump `schema_version: Literal[5]` and update
  `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` accordingly.

### P3.3 — `_validate_rows_custom_links` + validator wiring

`backend/features/project_document/document.py`:

- Add `_validate_rows_custom_links(table_label, row_label, rows,
  field_defs_by_key, target_resolver)` — mirrors the existing
  `_validate_rows_custom_values`. Per-row:
  - reject if any `field_key` appears in both bags (Q16);
  - reject if a `field_key` in `custom_links` has no `linked_record`
    FieldDef;
  - reject if the cell's `field_type` says `linked_record` but
    `target_table_path` does not resolve (defensive);
  - reject if `len(ids) > max_links`;
  - dedupe within-cell silently;
  - silently strip orphan ids against the snapshot's target table
    contents (Q5 amendment — pass the current document as the
    snapshot).
- Wire the helper into `validate_document_references` once per
  FieldDef-capable table, immediately after the existing
  `_validate_rows_custom_values` call.
- Add a per-FieldDef pass that validates `linked_record` field defs:
  `target_table_path` resolves through `tables.registry`, target
  contract is `link_targetable`, target is not self.

### P3.4 — Schema-mutation surface

`backend/features/project_document/mutations/`:

- `models.py`: extend `AddFieldMutation`, `ChangeTypeMutation`, and
  `EditFieldBundleMutation` to validate `field_type =
  "linked_record"` payloads. `config` on add/edit must carry
  `target_table_path` (list of strings) and may carry `max_links`
  (`1` or `null`).
- `field_ops.py`: `apply_add_field` admits the new type, calls
  `validate_link_config`, and seeds the field with empty
  `custom_links[field_key] = []` on every existing row in the
  table.
- `type_conversion.py`:
  - `_try_coerce_for_change_type` returns `None` when source or
    target is `linked_record` (i.e. no in-place conversion; row
    entry wipes on both bag sides).
  - `apply_change_type` walks every row of the target table and,
    when `field_type` is changing **to** `linked_record`, deletes
    `row.custom_values.pop(field_key, None)` and sets
    `row.custom_links[field_key] = []`; when changing **away
    from** `linked_record`, it deletes `row.custom_links.pop
    (field_key, None)`. Returns the cleared-row count in the
    standard summary envelope.
- A new `editField` guard rejects any mutation whose `before`
  field is `linked_record` and whose `after.config
  .target_table_path` differs from `before.config.target_table_path`
  (Q13). Error code: `linked_record_retarget_not_supported`.

### P3.5 — `TableFieldRegistry` accessors + `link_targetable`

`backend/features/project_document/tables/contracts.py`:

- Add `link_targetable: bool = True` field to `TableContract`
  (after `field_registry`, keeping the default-after-non-default
  dataclass rule satisfied — `link_targetable` is defaulted, so
  ordering is fine).
- Add to `TableFieldRegistry`:
  ```python
  read_row_links:  Callable[[object], dict[str, list[str]]]
  set_row_links:   Callable[[object, dict[str, list[str]]], object]
  ```
  Each FieldDef-capable per-table `tables/<name>.py` wires these
  to `row.custom_links` getter/setter the same way the existing
  pair targets `custom_values`.

### P3.6 — Erv-unit-ids retirement

In one commit alongside the `schema_version` bump:

- Delete `RoomRow.erv_unit_ids` declaration.
- Delete the validator's `if room.erv_unit_ids: raise ValueError`
  branch.
- Remove `"erv_unit_ids"` from `ROOMS_TYPED_COLUMN_FIELD_KEYS` and
  `ROOMS_TYPED_COLUMN_FORMULA_TYPES`.
- `grep -rn "erv_unit_ids"` and purge every test fixture, factory,
  seed, and JSON fixture reference. Acceptance: zero hits in
  `backend/` and `frontend/` after the change.

### P3.7 — Repository / store untouched

The new bag rides existing per-table JSON columns. `repository.py`
and `store.py` need no changes — the row Pydantic model handles
serialization through the existing `model_dump()` path.

### P3.8 — MCP tools

`backend/features/project_document/mcp/` (or wherever the existing
MCP cell-write + schema-mutation tools live):

- The cell-write MCP tool admits `value: string[]` payloads when
  the resolved FieldDef is `linked_record`. The validator pipeline
  (P3.3) silently dedupes and returns dropped-orphan ids in the
  `warnings` envelope.
- The schema-mutation MCP tool admits `field_type:
  "linked_record"` on `addField` and `changeType`. Rejects
  `editField` changes to `target_table_path` with
  `linked_record_retarget_not_supported`.
- No new MCP tools (per Q9).

## P4. Frontend work

### P4.1 — Field-config modal target-table picker

`frontend/src/shared/ui/data-table/lib/customFieldMutations.ts` and
the modal component(s) under `frontend/src/shared/ui/data-table/
components/FieldConfigModal*`:

- `FieldType` (or equivalent union) widens by one to admit
  `linked_record`.
- When the modal's type picker selects "Linked Record":
  - render a target-table dropdown populated from the document's
    `TableContract` manifest, filtered to entries where
    `link_targetable=true` and `table_path != current`;
  - render a Single / Multiple cardinality toggle (radio: Single
    is default);
  - validate target_table_path is set before allowing Save.
- On save, emit a `schemaMutation` `WriteOp` with the new
  field_type and `config = { target_table_path, max_links }`.

### P4.2 — Cell renderer (pill list)

Add `frontend/src/shared/ui/data-table/fields/linkedRecord/` (or
the closest current field-renderer pattern):

- `LinkedRecordCell.tsx` renders a horizontal pill list. Each
  pill shows the linked row's `record_id` resolved through a
  shared `useTargetRowDisplay` hook that:
  - looks up the row in the target table slice (already in
    TanStack Query cache);
  - returns `record_id` when present and non-empty;
  - returns the row id rendered muted/italic when `record_id` is
    empty/null.
- Pill click dispatches a route change to the target table with
  `?focus=<row_id>`. Reuse the existing route helper used by the
  side-panel "open in table" gesture.
- Read-only / viewer mode disables ⌫ on pills and disables click-
  to-open-picker but keeps pill navigation active.

### P4.3 — Cell editor (modal record-picker)

`frontend/src/shared/ui/data-table/fields/linkedRecord/Picker.tsx`:

- Reuses the catalog-picker modal shell (whichever component the
  Materials picker uses today — confirm during implementation).
- Columns: `record_id`, target's `display_name` field if the
  target's FieldDefs declare one.
- Search input: case-insensitive substring on `record_id`. Search
  uses the document's existing `normalizeDisplayName` for the
  comparison.
- Sort: `record_id` ascending.
- Virtualization: past 100 rows, switch to a virtualized list
  (existing virtualization primitive — pick during impl).
- Single vs multi:
  - single → radio buttons; selecting one and Confirming closes
    and writes;
  - multi → checkboxes; Confirm writes the full selection.
- On Confirm, emit a `cell` `WriteOp` with the deduped, capped
  `string[]` payload.
- On Cancel, drop changes.

### P4.4 — Fill, paste, undo

Existing draft-buffer code under
`frontend/src/shared/ui/data-table/lib/`:

- `fill` path: when the source cell is a `linked_record` cell,
  copy the full `string[]` payload to every destination cell.
  Destination FieldDef must equal source's (i.e. same field on
  different rows — already enforced by current fill semantics).
- `paste` path: detect linked_record source and destination; if
  `target_table_path` matches, write the same `string[]` payload.
  Otherwise reject with a draft-sync-level `422
  invalid_cell_value`. Plain-text paste into a linked_record cell
  rejects.
- `undo` / redo: the existing `cell` op carries the inverse
  payload as a `string[]`. No new code path needed.

### P4.5 — `?focus=` highlight

The destination table (e.g. Pumps when a Rooms pill clicks
through) reads the `focus` query param on mount, scrolls to the
matching row, and applies a `data-focus="true"` attribute for
~1.5s before removing it. Css transient highlight class.
Implementation lives wherever the table-route component currently
handles initial scroll / row selection.

### P4.6 — JSON Schema regeneration

If the frontend ships a generated JSON Schema (e.g. for MCP),
regenerate after backend P3.x lands and commit the updated
artifact.

## P5. Tests

### Backend (pytest)

- `tests/test_custom_fields.py`:
  - `linked_record` admitted in `CustomFieldType` and `coerce_link
    _value` accepts a valid `string[]`, dedupes duplicates, raises
    over-cap.
  - `validate_link_config` accepts valid configs, raises on missing
    `target_table_path`, raises on non-bool `max_links` values.
- `tests/test_document_validation.py`:
  - rooms with a valid `custom_links` bag pass validation;
  - rooms with `custom_links[cf_x]` pointing at non-existent pump
    are stripped silently and the save succeeds;
  - rooms with `field_key` in both `custom_values` and
    `custom_links` fails with `invalid_project_document`;
  - linked_record FieldDef whose `target_table_path` is self fails;
  - linked_record FieldDef whose `target_table_path` is a non-
    `link_targetable` contract fails.
- `tests/test_schema_mutations.py`:
  - `addField(field_type=linked_record)` succeeds and seeds empty
    `custom_links[field_key]` on every row;
  - `changeType(number → linked_record)` clears
    `custom_values[field_key]` and seeds `custom_links[field_key]
    = []` on every row; summary reports cleared count;
  - `changeType(linked_record → text)` clears `custom_links
    [field_key]` and leaves `custom_values` untouched;
  - `editField` that changes `target_table_path` is rejected
    with `linked_record_retarget_not_supported`;
  - `editField` that changes `max_links` from `1` to `null`
    succeeds and does not touch row data.
- `tests/test_table_views.py`:
  - per-table slice replace accepts a payload with `custom_links`;
  - re-reading the slice round-trips the bag.

### Frontend (Vitest)

- `LinkedRecordCell.test.tsx`: renders pills with `record_id` and
  with empty-record-id fallback; click dispatches the right
  route; ⌫ on focused pill emits an unlink `cell` write.
- `Picker.test.tsx`: search filters by substring, virtualizes past
  100 rows, single/multi affordances work, Cancel drops changes,
  Confirm emits a deduped capped payload.
- `customFieldMutations.test.ts`: linked_record schema mutation
  payloads round-trip; modal validates `target_table_path` is
  set before Save.
- `fill.test.ts` / `paste.test.ts`: fill copies full id list;
  paste between matching target_table_path succeeds; mismatched
  paths reject; plain-text paste rejects.

### Browser smoke (Playwright MCP)

- Editor opens Rooms, adds a "Pump" linked-record field targeting
  Pumps, picks one Pump on Room 101, saves. Re-opens, sees pill,
  clicks pill, lands on Pumps with row highlighted.
- Editor adds a second pump on Room 101 in multi mode, saves.
- Editor changes the field's `max_links` from null back to 1 in
  the field-config modal; existing 2-pump cell on Room 101
  triggers a validation error at save time (per P3.4 — confirm
  the chosen UX is "warn at edit time, hard-fail at save"; if a
  pre-save check is preferred, document the decision in
  `decisions.md`).
- Editor deletes a Pump that is linked from a Room; saves;
  on re-open the orphan pill is gone (Q5 silent strip).

## P6. Out of scope

- **Inverse view** on the target table — Phase 2.
- **Cross-table ETag invalidation** — Phase 2.
- **Rollups / `linked_from(...)`** — Phase 3.
- **Document-level formula cycle detection** — Phase 3.
- **"Pump A is already on 3 other rooms" hint inside the picker** —
  Phase 2 polish.
- **Optional "Pump A removed; unlinked from 3 rooms" toast on
  delete** — Phase 2 polish.
- **Catalog-record linking** (separate field type — see PRD
  non-goal).
- **Self-link support** (PRD Q2 / Q22 — deferred).
- **Manual pill drag-to-reorder** (PRD Q20 — deferred).

## P7. Done definition

Phase 1 is mergeable when:

- the acceptance checklist (P2) passes locally;
- `make ci` is green;
- the Phase 1 browser smoke (P5) is recorded as evidence in
  `planning/features/record-linking/assets/` (screenshots or a
  short clip);
- no `erv_unit_ids` references remain anywhere in the repo;
- `schema_version` is 5 everywhere it appears (document, fixtures,
  schema export, frontend type, MCP tool schemas).
