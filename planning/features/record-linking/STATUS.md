---
DATE: 2026-06-08
TIME: -
STATUS: Phase 1 backend + frontend primitives complete; FieldConfigModal
        integration, `useRowFocusHighlight`, backend changeType e2e
        pytest landed in second pass; GridBody linked_record dispatch +
        `useGridEdit.commitLinkedRecord` + DataTable `linkedRecordOps`
        prop landed in third pass; RoomsTable column accessor +
        `linkedRecordOps` prop pass-through + `buildLinkedRecordOps`
        helper + `tableFieldToFieldDef` linked_record_config mapping
        landed in fourth pass; RoomsPage builder invocation +
        EquipmentPageBody `?tab`/`?focus` URL seeding + PumpsTableSlot
        `useRowFocusHighlight` wiring landed in fifth pass — the
        rooms→pumps add/link/navigate loop is now closed end-to-end.
        Sixth pass (2026-06-08): P4.4 fill/paste/undo —
        `applyWriteToRoom` now routes linked_record writes through new
        `setCustomLink` helper into `custom_links` (was incorrectly
        landing in `custom_values`); `coerceFieldValue` parses JSON id
        lists for paste and rejects stringified pill text per Q24.
        Seventh pass (2026-06-09): attempted the Playwright MCP smoke
        — sign-in / project create / add Pump worked, but the full
        Rooms→field-add→picker→pill-click→focus loop is friction-heavy
        interactively; paused and routed the smoke to a future
        re-runnable `frontend/tests/e2e/` spec (or a dedicated MCP
        session). Same session ran `/simplify xhigh` against the
        working-tree diff and surfaced 15 defects (7 blockers, 8
        cleanup) → `phases/phase-01.b-integration-fixes.md`. Phase 1
        is NOT user-shippable until §A1–§A7 land. Remaining:
        Phase 1.b blockers, then Playwright smoke (P4.6 JSON Schema
        regen is a no-op — no generated artifact shipped today).
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

### Landed this session (2026-06-08, fifth pass)

Three coordinated wirings close the rooms→pumps add/link/navigate loop.
`make format` + `make ci` both green; frontend vitest 1477 passed across
142 files (was 1477 / 142 with three test files updated to wrap
`<RoomsPage>` in `MemoryRouter` for the new `useNavigate()` call).

- [x] **RoomsPage page-level builder** — `RoomsPage` now fetches the
  Pumps slice unconditionally via `usePumpsSliceQuery` (hooks can't be
  conditional; cache hit when the user has just left the equipment
  page). `RoomsPageBody` calls `buildLinkedRecordOps<PumpRow>` inside a
  `useMemo` keyed by `pumpsSlice` + `controller.tableSchema.fieldDefs`
  + `navigate` + `project.id`, projects each pump's `record_id` via
  `customTextValueOrNull` (so a missing record_id falls through to the
  row-id pill fallback at render time instead of rendering as blank),
  and wires `onPillClick` to
  `navigate("/projects/<pid>/equipment?tab=pumps&focus=<rowId>")`.
  Pumps loading or error → `linkedRecordOps` is `undefined` and pills
  render via row-id fallback. The ops Map is passed into
  `RoomsTableSlot`.
- [x] **EquipmentPageBody URL seeding** — `useSearchParams` reads
  `?tab=<key>` (lazy `useState` initializer matches against
  `EQUIPMENT_TABS`; falls back to `"ventilators"` for unknown values)
  and `?focus=<row_id>` (passed straight through to `PumpsTableSlot`).
  In-page tab clicks stay local — `setActiveTab` does not push back to
  the URL (the existing UX never did, and doing so would fight the
  pill-click navigation that brought the user here).
- [x] **PumpsTableSlot focus highlight** — accepts a `focusRowId?:
  string | null` prop, owns a `useRef<HTMLDivElement>` for the slot
  container, calls `useRowFocusHighlight({ containerRef, rowId:
  focusRowId ?? null })`, and wraps `PumpsTable` in the container `<div
  ref={containerRef}>`. The hook scrolls the matching `<tr
  data-row-id>` into view and clears `data-focus` after 1.5s.

### Landed this session (2026-06-08, fourth pass)

- [x] **RoomsTable linked_record column accessor** — `customColumns`
  branches on `field_type === "linked_record"` and projects
  `row.custom_links?.[fieldKey] ?? EMPTY_LINK_IDS` (stable empty array
  identity to avoid render cascades). GridBody owns rendering + editing
  via `DataTable.linkedRecordOps`; the accessor only feeds sort / filter
  / group with the id list.
- [x] **`linkedRecordOps` prop pass-through on RoomsTable +
  RoomsTableSlot** — both layers accept and forward the `ReadonlyMap<
  fieldKey, LinkedRecordCellOps>` so a future page-level owner can build
  it from whichever target slice each field points at.
- [x] **`buildLinkedRecordOps` generic helper** — new
  `frontend/.../fields/linkedRecord/buildLinkedRecordOps.ts` (exported
  from the data-table public surface). Takes a target-table slice
  (`targetRows` + `getRowId` + `getRecordId` + optional `getDisplayName`
  + optional `onPillClick`) plus `fieldDefs` + `targetTablePath`, and
  emits the per-fieldKey ops Map for every linked_record field whose
  target matches. Pre-indexes by rowId so the resolver is O(1) per pill
  render. Callers with multiple target tables call once per target and
  merge.
- [x] **`tableFieldToFieldDef` linked_record_config mapping** —
  `useTableSchema.ts` now reads `persisted.config.target_table_path` +
  `persisted.config.max_links` for `linked_record` fields and emits the
  typed `linked_record_config` slot on the runtime `FieldDef`. Defensive
  parsing matches backend `validate_link_config`: array of strings →
  target_table_path; positive finite number → max_links; everything else
  collapses to safe defaults (empty path → no candidates, null max →
  multi). Closes a real gap — without this the data-table dispatch
  layer's `fieldDef?.linked_record_config?.max_links` was always
  undefined regardless of persisted state.
- [x] **Tests** — `buildLinkedRecordOps.test.ts` (5: filtering by target
  path, resolver hit / null-recordId / unknown rowId, displayName
  passthrough, onPillClick forwarding, empty Map when no fields target
  the path). `RoomsTable.linkedRecord.test.tsx` (3: pill labels via
  resolver, fallback render with no ops, pill-click → onPillClick).

### Landed this session (2026-06-08, third pass)

- [x] **`GridBody` cell-render dispatch** — `renderCellContent` now renders `LinkedRecordCell` (read mode) and `LinkedRecordPicker` (edit mode) for `field_type === "linked_record"` cells; cell value is coerced to a `string[]` via a defensive `toLinkedIdList` (non-array → empty). The picker's mode is derived from `linked_record_config.max_links` (`1 → single`, otherwise multi).
- [x] **`useGridEdit` editor wiring** — `getFieldEditor` now returns `{kind: "linked_record"}`; new `EditorState` variant `{kind: "linked_record"}` (the picker owns its internal draft); new `commitLinkedRecord(ids)` method dedupes, enforces the max-links cap, compares against `originalValue`, and dispatches a `cell` `WriteOp` + inverse. The generic `commit()` path is a noop for linked_record (only reachable today via `insertRowBelow`).
- [x] **`DataTable.linkedRecordOps` prop** — new `ReadonlyMap<fieldKey, LinkedRecordCellOps>` prop keyed by linked-record FieldDef. Each entry carries `candidates` (for the picker), `resolve` (for pill display), and `onPillClick` (for navigation). Plumbed through `DataTable.tsx` → `GridBody.tsx`. New public types `LinkedRecordCellOps` + `LinkedRecordCellCandidate` exported from the data-table index.
- [x] **Tests** — `useGridEdit.test.ts` +5 (start opens stateless editor; commitLinkedRecord deduped dispatch; same-ids noop; over-cap invalid; no-write-handler noop). `GridBody.test.tsx` +4 (read-mode pill render via resolver; empty caption; pill click invokes consumer hook; double-click opens picker). `useGridKeyboard.test.ts` mock extended with `commitLinkedRecord`.

### Landed this session (2026-06-08, second pass)

- [x] **`FieldConfigModal` integration** — `FieldConfigSectionLinkedRecord` rendered when `draftType === "linked_record"`; modal owns `linkedRecordTargetPath` / `linkedRecordMaxLinks` draft state, seeded from `source.linked_record_config` on open. Save is gated until a target is picked when converting *into* `linked_record` (Q13: target dropdown locked on an existing linked_record field; only `max_links` is editable in place). `dispatchBundle` payload emits `linkedRecordTargetPath` / `linkedRecordMaxLinks` only when meaningful (type-change or in-place cardinality edit). `buildNextConfigForFieldTypeChange` writes `config.target_table_path` + `config.max_links` accordingly and throws if a type-change into linked_record arrives without a target (defense in depth — the modal disables Save first).
- [x] **`?focus=<row_id>` highlight (P4.5)** — Standalone `useRowFocusHighlight` hook (`hooks/useRowFocusHighlight.ts`) + transient `[data-row-id][data-focus="true"]` CSS animation. Exported from the data-table public surface; consumers (route components) own the `useSearchParams` read and pass `containerRef` + `rowId`. Hook scrolls the matching `<tr>` into view and clears the `data-focus` attribute after 1.5s.
- [x] **Backend e2e changeType pytest** — `TestChangeTypeDispatcher` covers `linked_record → short_text` requires-ack + ack-clears-both-bags, `short_text → linked_record` wipes existing `custom_values`, and the clean (`cleared_row_count == 0`) path through `apply_schema_mutation`.

### Landed this session (2026-06-08, sixth pass)

- [x] **P4.4 — fill / paste / undo** — `applyWriteToRoom` now routes
  any write whose `field_type === "linked_record"` through the new
  `setCustomLink` helper (`shared/ui/data-table/lib/customFieldAccessor.ts`),
  landing the `string[]` payload in `row.custom_links[fieldKey]`
  instead of `row.custom_values` (the prior third-pass commit and
  fifth-pass cell write both silently violated the backend's bag-
  exclusivity rule). The fill plan already emits the accessor's
  `string[]`, so fill copies the full id list end-to-end with the
  routing fix. Paste rides the same write path; `coerceFieldValue`
  now matches `linked_record` and parses the JSON-serialized id list
  emitted by `formatClipboardValue`, dedupes, drops empties, enforces
  `max_links`, and rejects anything else (stringified pill text,
  malformed JSON, non-array JSON) with a clear message — closing PRD
  §11 Q24 on the frontend side; cross-target validation stays at
  draft-sync per PRD. Undo/redo inherit the routing fix because the
  inverse op already carries the prior `string[]` payload from the
  accessor.
- [x] **Tests** — `roomsPayloadFromCellWrites` linked_record routing
  (2: writes land in `custom_links`; written `[]` clears the bag);
  `coerceFieldValue` linked_record paste (6: round-trip JSON accepts;
  dedupe + empty drop; blank clears; stringified pill text rejects;
  non-array JSON rejects; over-cap on `max_links=1` rejects).

### Phase 1.b — Integration fixes (NEW, 2026-06-09)

`/simplify xhigh` review on 2026-06-09 surfaced 15 defects in the
working-tree diff. Seven are **must-fix blockers** that prevent the
Rooms↔Pumps loop from working in a real browser despite `make ci`
green (unit suite stubs the wiring exercised by the blockers).
Captured as `phases/phase-01.b-integration-fixes.md` — §A1–§A7
blockers, §B1–§B8 lower-priority hardening. Phase 1 is NOT
user-shippable until §A lands.

### Deferred — next session

- [ ] **Phase 1.b §A1–§A7** — see
  `phases/phase-01.b-integration-fixes.md`. Blockers for shipping
  Phase 1 to users.
- [ ] **P4.6** — JSON Schema regen (no generated artifact shipped
  today; will need an update if/when one is added).
- [ ] **Other-target page wiring** — when a non-Pumps target table
  becomes a link target (e.g. Ventilators), apply the same RoomsPage /
  EquipmentPageBody pattern: fetch target slice, build ops per target,
  merge when a page hosts multiple link targets, plumb `focusRowId`
  through the corresponding `*TableSlot`. The Rooms↔Pumps pair is the
  reference implementation.
- [ ] **Playwright MCP browser smoke** for the canonical Rooms ↔ Pumps
  add/link/navigate/orphan-strip flow (recorded under `assets/`).
  Attempted interactively in the seventh-pass session — sign-in,
  project creation, and `Add pump` on the empty Pumps tab all worked
  end-to-end, but each subsequent UI step (find Save Version, dodge
  the beforeunload guard on tab switch, walk the FieldConfigModal
  through linked_record + target_table_path, drive the picker, click
  the pill, capture the focus highlight) cost many Playwright MCP
  calls per step. Per Ed's call, paused before consuming further token
  budget on what is fundamentally evidence gathering; revisit either
  by codifying the same flow as a `frontend/tests/e2e/` Playwright
  spec (re-runnable via `make e2e`) or by recording the MCP run in a
  dedicated session.

## Phase 2 — Inverse view

**NOT STARTED.** Blocked on Phase 1 data-table integration landing.

## Phase 3 — Rollups

**NOT STARTED.** Blocked on Phase 2.
