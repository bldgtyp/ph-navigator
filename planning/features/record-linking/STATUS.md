---
DATE: 2026-06-08
TIME: -
STATUS: Phases 1, 1.b, and 2 are complete for the canonical
        Rooms→Pumps source/inverse loop. linked_record deleteField
        link-bag cleanup is fixed; browser/e2e smoke evidence is
        recorded under `assets/e2e/rooms-pumps/`. Current `make
        format` left files unchanged and `make ci` passed on
        2026-06-09. Phase 3 backend rollup parsing/evaluation and
        document-level linked-ref validation / cycle detection are
        implemented; frontend editor completion, perf gate extension,
        and browser smoke remain.
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
- [x] **P3.9 — bug** — `deleteField` for a `linked_record` field strips `custom_links[field_key]` as well as `custom_values[field_key]`; regression coverage lives in `test_project_document_linked_record.py::TestDeleteFieldDispatcher`.

### Frontend — Phase 1 + Phase 1.b implemented for Rooms→Pumps

- [x] **P4.1a** — `FieldType` + `CustomFieldType` unions widened; `linked_record` cases added to every `Record<FieldType, X>` (FieldTypeIcon, HideFieldsPanel, columnWidths, useTableSchema, filterOperators, aggregations, registry); `FieldDef.linked_record_config` slot
- [x] **P4.1b** — `RoomRow.erv_unit_ids` retired across frontend; `custom_links?: Record<string, string[]>` added to every equipment row type; equipment lib + fixtures + RoomsTable ERV column purged
- [x] **P4.1c** — `FIELD_TYPE_CHOICES` widened with "Linked record"; `FieldConfigSectionLinkedRecord` is integrated into both `FieldConfigModal` and `CreateFieldConfigModal`; target selection gates Save; Q13 target lock and cardinality edits are wired.
- [x] **P4.2** — `LinkedRecordCell` pill renderer is wired through `GridBody` read mode, including row-id fallback (Q18), pill navigation (Q19), Backspace/Delete unlink callback, and orphan-vs-missing-recordId treatment.
- [x] **P4.3** — `LinkedRecordPicker` is wired through `GridBody` edit mode and `useGridEdit.commitLinkedRecord`, with substring search, sorted candidates, single/multi mode, dedupe, max-links validation, and stable open-draft behavior.
- [x] **P4.4** — Fill / paste / undo route linked-record `string[]` payloads through `custom_links`; paste accepts JSON id-list round-trips and rejects stringified pill text.
- [x] **P4.5** — Pill click navigation to `?tab=pumps&focus=<row_id>` and `useRowFocusHighlight` are wired and regression-tested for cold-start rows and selector collisions.
- [x] **P4.6 / smoke evidence** — no generated JSON Schema artifact ships today; browser smoke evidence is covered by `frontend/tests/e2e/record-linking-rooms-pumps.spec.ts` and screenshots in `assets/e2e/rooms-pumps/`.

### Tests — added this session

- [x] Backend pytest — `test_project_document_linked_record.py` (17 tests covering enum, helpers, FieldDef validation, orphan strip, self-target / unknown-target / bag co-existence rejection, max-links cap)
- [x] Frontend vitest — `LinkedRecordCell.test.tsx` (6), `Picker.test.tsx` (7), `FieldConfigSectionLinkedRecord.test.tsx` (6)
- [x] Existing tests updated — `coerceCustomFieldType.test.ts` expects the new 48-entry matrix (was 34) and the new formula↔linked_record pairs

### Historical Phase 1 closeout gates

- [x] `/simplify` (round 1) — converted `LINKED_RECORD_TARGET_PATHS` from a labels dict (values unread) to a frozenset of valid tuple paths
- [x] `/simplify` (round 2) — fixed `LinkedRecordPicker` draft staleness on close→reopen with a different `selectedIds`; removed redundant `.trim()` before `normalizeDisplayName`
- [x] `/docs-pass` — one forward-pointer note added to `context/technical-requirements/data-model.md` flagging the v4 → v5 cutover; broader doc sweep deferred until Phases 1–3 merge
- [x] `make format` + `make ci` were green for the landed Phase 1 commit (`a382cb6 Add linked_record field support and UI integration`)
- [x] Current checkout closeout gate — `make format` left files unchanged; `make ci` passed on 2026-06-09 (backend pytest 681 passed / 2 skipped; frontend Vitest 145 files / 1498 tests; production build green).

### Current full-gate test totals
- **Backend pytest**: 682 passed / 2 skipped
- **Frontend Vitest**: 1498 passed across 145 files
- **Full gate**: backend ruff format, ruff lint, ty, alembic, pytest, coverage; frontend Prettier, ESLint, structural guards, Vitest, and production build all green on 2026-06-09

### Verification warnings noticed

- [ ] **Frontend test hygiene** — `make ci` still emits existing React `act(...)` warnings in several frontend suites, including DataTable / table-view state tests and `RoomsTable.customFieldCellWrite.test.tsx`. Non-blocking today, but worth cleaning before the warnings hide a real regression.
- [ ] **Bundle-size hygiene** — Vite still warns that the main JS chunk is larger than 500 kB after minification. Non-blocking for record-linking; track separately if load time becomes a target.

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

### Phase 1.b — Integration fixes (complete 2026-06-09)

`/simplify xhigh` review on 2026-06-09 surfaced 15 defects in the
working-tree diff. The §A1–§A7 blockers and §B1–§B7 cleanup items are
implemented and covered by focused tests; §B8 (external clipboard copy
format) is explicitly deferred to Phase 3/polish. The remaining
Phase 1.b closeout gates are now closed by the linked-record
deleteField cleanup regression and the canonical Rooms→Pumps e2e
smoke.

### Remaining Phase 1 follow-ups

- [x] **Fix linked_record deleteField bug** — backend delete-field row stripping removes `custom_links[field_key]`; focused regression `cd backend && uv run pytest tests/test_project_document_linked_record.py` passed on 2026-06-09.
- [x] **Record the canonical browser smoke** — reusable Playwright spec added at `frontend/tests/e2e/record-linking-rooms-pumps.spec.ts`: create linked_record field on Rooms, target Pumps, link a pump, reload, click pill, land on Pumps with `?tab=pumps&focus=<row_id>`, and verify inverse column. Screenshots: `assets/e2e/rooms-pumps/01-linked-room-pill.png`, `assets/e2e/rooms-pumps/02-pumps-focus-inverse.png`.
- [ ] **Other-target page wiring** — when a non-Pumps target table becomes a link target (e.g. Ventilators), apply the RoomsPage / EquipmentPageBody reference pattern: fetch target slice, build ops per target, merge maps, and plumb `focusRowId` through the corresponding `*TableSlot`.
- [ ] **Diff / schema acceptance audit** — verify whether JSON Schema export and `custom_links.<field_key>` diff rendering are truly satisfied or should be explicitly deferred / implemented.

## Phase 2 — Inverse view

**Complete for canonical Rooms→Pumps.**

- [x] Backend inverse-view builder — `backend/features/project_document/inverse_view.py` walks declared `linked_record` fields through table contracts, filters target ids against the snapshot being read, and projects `{target_row_id: {source_key: [source_row_id]}}`.
- [x] Slice response overlays — Rooms/Pumps responses expose top-level `inverse_links`, `inverse_link_fields`, and `inverse_links_fingerprint`; JSON table envelopes attach per-row `inverse_links` as a read-only export overlay.
- [x] Fingerprint semantics — table slices continue to use document-level `version_etag` / `draft_etag` for write concurrency; `inverse_links_fingerprint` gives clients/tests a target-table incoming-link hash without pretending the API has per-table ETags.
- [x] Frontend inverse columns — `PumpsTable` appends read-only derived columns from `inverse_link_fields`, registers them with DataTable as read-only text fields for view controls, renders pills via `LinkedRecordCell`, and routes pill clicks to the declared source table path with `?focus=<row_id>`.
- [x] Perf gate — deterministic in-memory fixture (`4000` Rooms × `3` fields, `50` Pumps, plus equipment source tables) with median inverse-build threshold from `backend/tests/baselines/record_linking_perf.json`.
- [x] Focused verification — `uv run pytest tests/test_project_document_inverse_view.py tests/test_record_linking_perf.py`; `uv run ty check ...`; `pnpm exec vitest run src/features/equipment/__tests__/PumpsTable.reuse.test.tsx`; `pnpm exec tsc --noEmit --pretty false`.
- [x] Full closeout gate — `make format` left files unchanged; `make ci` passed on 2026-06-09.
- [x] Browser smoke / e2e evidence — `frontend/tests/e2e/record-linking-rooms-pumps.spec.ts` passed on 2026-06-09; screenshots stored under `assets/e2e/rooms-pumps/`.

## Phase 3 — Rollups

**PARTIALLY IMPLEMENTED — backend rollup read overlay + validator.**

- [x] **P3.1 parser / AST backend slice** — Python formula AST now
  carries `LinkedRef`, `LinkedFromRef`, and `FieldAccess`; parser
  accepts `linked("cf_key")`,
  `linked_from(rooms, "cf_key")`, dotted table paths, and
  `count` / `sum` / `avg` aggregators. Deferred functions
  (`min`, `max`, `array_join`, `count_unique`) raise
  `formula_function_not_supported`. Focused coverage:
  `test_project_document_record_linking_rollups.py`.
- [x] **P3.3 / P3.5 evaluator backend slice** — server read overlays
  compute `count(linked_from(...))`,
  `sum(linked_from(...).<field_key>)`, and cross-table formula-chain
  dependencies using the Phase 2 inverse-link index plus snapshot row
  filtering. The canonical Pumps response now includes
  `rows_computed` for persisted formula `field_defs`.
- [x] **Pumps formula read registry** — `pumps_field_registry` supplies
  formula-facing field/value accessors so Pumps can participate in
  read overlays without enabling nested Pumps schema mutations yet.
- [x] **P3.2 resolver validation hardening** — document formula
  validation now rejects unknown linked target tables and
  non-matching linked fields at author / validate time. `setFormula`
  translates those into `custom_field_formula_unknown_target_table`
  and `custom_field_formula_target_field_not_linked` REST envelopes.
- [x] **P3.4 document-level cycle detector** — `validate_document_
  formula_graph` indexes Rooms + Pumps formula registries, validates
  linked primitives, builds a document-level dependency graph, and
  raises `formula_cycle_detected` with table-qualified cycle paths.
  The legacy Rooms helper delegates to the document-wide pass.
- [ ] **P3.6 perf gate extension** — not yet added.
- [ ] **P4 frontend formula editor primitives/completion** — not yet
  started.
- [ ] **P5 browser smoke for rollup authoring** — not yet recorded.
