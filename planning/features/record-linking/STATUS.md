---
DATE: 2026-06-08
TIME: -
STATUS: Phase 1 backend + frontend primitives complete; data-table
        integration (GridBody/useGridEdit/equipment-table accessors)
        + Playwright smoke deferred to a follow-up session.
AUTHOR: Ed May (with Claude)
---

# Record-linking — STATUS

Tracks per-phase progress. Step IDs map to `phases/phase-01-link-values.md` P-numbering.

## Phase 1 — Link values

### Backend — complete

- [x] **P3.1** — `CustomFieldType.linked_record`, `coerce_link_value`, `validate_link_config` (`custom_fields.py`)
- [x] **P3.2** — `RowWithCustomFields` mixin + `custom_links: dict[str, list[str]]` on every `*Row`; `schema_version` 4 → 5 (`document.py`)
- [x] **P3.3** — `_validate_rows_custom_links` wired on every FieldDef-capable table (bag exclusivity, max_links cap, silent dedupe, silent orphan strip, self-link rejection, unknown-target rejection)
- [x] **P3.4** — Schema-mutation `linked_record_wipe` policy in `CONVERSION_MATRIX`, `_apply_linked_record_wipe` (changeType wipes both bag sides, returns cleared count, requires `acknowledge_destructive`), retarget guard in `bundle.py`
- [x] **P3.5** — `TableContract.link_targetable: bool = True` + `TableFieldRegistry.read_row_links/set_row_links` wired on `rooms_contract` (other contracts have `field_registry=None` and will wire their accessors when they opt into the schema-editor surface)
- [x] **P3.6** — `RoomRow.erv_unit_ids` retired across backend (RoomRow field, validator branch, `ROOMS_TYPED_COLUMN_*` constants, ~13 backend fixtures)
- [x] **P3.7** — N/A (no repository/store changes; existing JSON columns carry the new bag)
- [x] **P3.8** — MCP path inherits via Pydantic round-trip (rows + `RowWithCustomFields` mixin, mutation enum + config validation)

### Frontend — primitives complete, integration deferred

- [x] **P4.1a** — `FieldType` + `CustomFieldType` unions widened; `linked_record` cases added to every `Record<FieldType, X>` (FieldTypeIcon, HideFieldsPanel, columnWidths, useTableSchema, filterOperators, aggregations, registry); `FieldDef.linked_record_config` slot
- [x] **P4.1b** — `RoomRow.erv_unit_ids` retired across frontend; `custom_links?: Record<string, string[]>` added to every equipment row type; equipment lib + fixtures + RoomsTable ERV column purged
- [x] **P4.1c — partial** — `FIELD_TYPE_CHOICES` widened with "Linked record"; standalone `FieldConfigSectionLinkedRecord` built (target-table dropdown + Single/Multi cardinality + Q13 target lock); `typeConversionMatrix.ts` mirrors backend `linked_record_wipe` policy (14 new pairs). **Modal integration deferred** — the section component is not yet plugged into `FieldConfigModal` itself.
- [x] **P4.2** — Standalone `LinkedRecordCell` pill renderer (`.../fields/linkedRecord/LinkedRecordCell.tsx`) with row-id fallback (Q18), `onPillClick` navigation hook (Q19), Backspace unlink, viewer-mode disable. **GridBody dispatch wiring deferred.**
- [x] **P4.3** — Standalone `LinkedRecordPicker` modal (`.../linkedRecord/Picker.tsx`) with substring search via `normalizeDisplayName` (Q17), `record_id` ascending sort, single/multi mode (Q3), virtualization flag past 100 candidates, draft-resets-on-reopen. **`useGridEdit` editor wiring deferred.**

### Tests — added this session

- [x] Backend pytest — `test_project_document_linked_record.py` (17 tests covering enum, helpers, FieldDef validation, orphan strip, self-target / unknown-target / bag co-existence rejection, max-links cap)
- [x] Frontend vitest — `LinkedRecordCell.test.tsx` (6), `Picker.test.tsx` (7), `FieldConfigSectionLinkedRecord.test.tsx` (6)
- [x] Existing tests updated — `coerceCustomFieldType.test.ts` expects the new 48-entry matrix (was 34) and the new formula↔linked_record pairs

### Closeout gates

- [x] `/simplify` (round 1) — converted `LINKED_RECORD_TARGET_PATHS` from a labels dict (values unread) to a frozenset of valid tuple paths
- [x] `/simplify` (round 2) — fixed `LinkedRecordPicker` draft staleness on close→reopen with a different `selectedIds`; removed redundant `.trim()` before `normalizeDisplayName`
- [x] `/docs-pass` — one forward-pointer note added to `context/technical-requirements/data-model.md` flagging the v4 → v5 cutover; broader doc sweep deferred until Phases 1–3 merge
- [x] `make format` + `make ci` — both green end-to-end

### Final test totals
- **Backend pytest**: 670 passed / 2 skipped (was 653 before this feature)
- **Frontend vitest**: 1449 passed across 139 files (was 1430 / 136)
- All gates green: backend ruff format, ruff lint, ty, alembic, pytest, coverage; frontend prettier, eslint, structural guards, vitest, production build

### Deferred — next session

Wiring the standalone primitives into the live data-table requires multi-thousand-line integration work that doesn't fit the closeout gate of a single session:

- [ ] **`FieldConfigModal` integration** — plug `FieldConfigSectionLinkedRecord` into the modal's type-specific section dispatch, hook it to the schema-mutation builder so save emits a valid `AddFieldMutation` / `EditFieldBundleMutation` with `config = { target_table_path, max_links }`
- [ ] **`GridBody` cell-render dispatch** — render `LinkedRecordCell` when `fieldDef.field_type === "linked_record"`, projecting `row.custom_links[fieldKey]` as the cell value and resolving target rows through a shared `useTargetRowDisplay` hook
- [ ] **`useGridEdit` editor wiring** — `getFieldEditor` returns a `linked_record` editor kind; clicking the cell opens `LinkedRecordPicker`; Confirm emits a `cell` `WriteOp` with the deduped, capped `string[]` payload
- [ ] **Equipment table column accessors** — RoomsTable / PumpsTable / etc. add columns for linked-record FieldDefs that read `row.custom_links[fieldKey]`
- [ ] **P4.4** — Fill (copy full id list) / paste (reject mismatched `target_table_path` with 422) / undo paths
- [ ] **P4.5** — `?focus=<row_id>` route highlight on destination table mount
- [ ] **P4.6** — JSON Schema regen if a generated artifact is shipped
- [ ] **Playwright MCP browser smoke** for the canonical Rooms ↔ Pumps add/link/navigate flow (recorded under `assets/`)
- [ ] **Backend pytest** — `_apply_linked_record_wipe` end-to-end through the mutations dispatcher (changeType into and out of `linked_record`)

## Phase 2 — Inverse view

**NOT STARTED.** Blocked on Phase 1 data-table integration landing.

## Phase 3 — Rollups

**NOT STARTED.** Blocked on Phase 2.
