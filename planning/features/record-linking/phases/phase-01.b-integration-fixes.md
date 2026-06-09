---
DATE: 2026-06-09
TIME: planning
STATUS: Implemented / in review — §A1–§A7 and §B1–§B7 have fixes
        landed with focused regression tests. §B8 is deferred to
        Phase 2 polish. This punch list is not fully merge-complete
        because no Phase 1 browser smoke / e2e evidence is recorded.
        Current `make format` left files unchanged and `make ci` is
        green. Post-review backend bug: deleteField
        for linked_record must strip `custom_links[field_key]`.
AUTHOR: Ed May (with Claude)
SCOPE: Follow-on fix list for Phase 1 record-linking. Closes the gap
       between "primitives + tests green" and "Rooms↔Pumps loop
       actually works in a browser." No new feature scope; corrects
       wiring, prop plumbing, lifecycle, and bag-routing bugs in the
       code landed across the first–sixth passes of
       `phase-01-link-values.md`.
RELATED:
  - planning/features/record-linking/phases/phase-01-link-values.md
    (the parent phase whose acceptance gates this list closes)
  - planning/features/record-linking/STATUS.md (seventh-pass note)
  - planning/features/record-linking/PRD.md §11 Q13, Q18, Q19, Q24
  - frontend/src/features/equipment/routes/RoomsPage.tsx
  - frontend/src/features/equipment/routes/EquipmentPageBody.tsx
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx
  - frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
  - frontend/src/shared/ui/data-table/fields/linkedRecord/Picker.tsx
  - frontend/src/shared/ui/data-table/hooks/useRowFocusHighlight.ts
  - frontend/src/shared/ui/data-table/hooks/useGridEdit.ts
  - frontend/src/shared/ui/data-table/lib/customFieldAccessor.ts
  - frontend/src/shared/ui/data-table/lib/customFieldMutations.ts
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
  - frontend/src/shared/ui/data-table/lib/paste/tsv.ts
  - frontend/src/features/equipment/lib.ts
  - frontend/src/shared/ui/data-table/fields/linkedRecord/buildLinkedRecordOps.ts
---

# Phase 1.b — Integration fixes

The first-pass through sixth-pass work on `phase-01-link-values.md`
landed every primitive (cell, picker, accessor, picker draft state,
fill/paste/undo routing, focus-highlight hook, RoomsPage→Pumps
builder, EquipmentPageBody URL seeding) and turned `make ci` green.
A xhigh `/simplify` review on 2026-06-09 then walked the diff with 9
finder angles and verified the top items end-to-end against backend
canonical shapes and current call sites.

Original result: **the Phase 1 user-facing loop did not work in a
real browser** despite green CI. The unit suite stubbed field defs,
target-table shapes, and modal props that the actual call sites
either mismatched or omitted.

Follow-up audit 2026-06-09: the §A blockers and §B cleanup items
through §B7 are implemented and covered by focused regression tests.
The remaining closeout gates are the linked_record deleteField
cleanup bug and browser smoke / e2e evidence. Current `make format`
left files unchanged and `make ci` is green.

The items below are grouped by severity. §A1–§A7 are **must-fix
blockers** — Phase 1 cannot ship without them. §B1–§B8 are
**lower-priority cleanup / hardening** that should ride alongside or
land in a follow-up sweep.

## A. Must-fix blockers

These break the canonical Rooms↔Pumps add/link/navigate flow and
defeat the entire phase even though every unit test passes.

### A1 — `RoomsPage.targetTablePath` shape mismatch — ✅ COMPLETE

- **File**: `frontend/src/features/equipment/routes/RoomsPage.tsx:156`
- **Defect**: `RoomsPage` builds the linked-record ops Map with
  `targetTablePath: [PUMPS_TABLE_NAME]` = `["pumps"]`. The backend
  canonical path for the pumps table is `["equipment", "pumps"]`
  (verified against
  `backend/tests/test_project_document_linked_record.py` which
  hard-codes the 2-segment path everywhere it asserts).
- **Failure**: `buildLinkedRecordOps` calls
  `pathsEqual(["pumps"], persisted ["equipment", "pumps"])` which
  returns `false`, so no field's entry lands in the result Map.
  Every linked_record pill on Rooms renders with row-id fallback and
  the picker shows an empty candidate list — users cannot link a
  pump.
- **Fix**: Change the literal to `["equipment", "pumps"]`. Better:
  add a `PUMPS_TARGET_TABLE_PATH = ["equipment", "pumps"] as const`
  in `frontend/src/features/equipment/types.ts` adjacent to
  `PUMPS_TABLE_NAME` (or replace the latter where it's used as a
  path segment vs a display key) and import the path constant
  everywhere the routing decision is encoded — including future
  Ventilators/Fans target tables. Add an end-to-end test that walks
  `roomsSlice` → `buildLinkedRecordOps` → ops Map non-empty against
  a backend-shaped FieldDef fixture.

### A2 — `DataTable.tsx` does not forward `linkedRecordTargets` to `FieldConfigModal` — ✅ COMPLETE

- **File**: `frontend/src/shared/ui/data-table/DataTable.tsx:1372-1392`
- **Defect**: The `<FieldConfigModal ... />` invocation omits the
  `linkedRecordTargets` prop. `FieldConfigModal` falls back to
  `EMPTY_LINKED_RECORD_TARGETS`, so `FieldConfigSectionLinkedRecord`
  renders an empty target-table dropdown and Save stays disabled
  (modal correctly gates Save on a non-null target).
- **Failure**: User opens Field Config on any column to convert it
  to `linked_record` (or edits an existing one). Dropdown is empty.
  User cannot configure a linked_record target through the in-grid
  edit modal — the only UI surface integrated in the second pass.
- **Fix**: Thread `linkedRecordTargets` into `DataTableProps`,
  forward it through the FieldConfigModal invocation, and have
  `RoomsTable` / `RoomsTableSlot` / `RoomsPage` supply the actual
  list of link-targetable tables (today: Pumps; later: every table
  whose backend contract has `link_targetable=True`). The page-level
  source of truth for "what targets exist" is the project schema —
  derive the list there and pass it through. Add a test that opens
  the modal and asserts the dropdown is populated.

### A3 — `CreateFieldConfigModal` has no `linked_record` branch — ✅ COMPLETE

- **File**: `frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx`
- **Defect**: `CreateFieldConfigModal` (the in-grid "+" affordance
  for adding a new field) has zero mentions of `linkedRecordTargets`
  or `FieldConfigSectionLinkedRecord`. Users cannot create a
  `linked_record` field through the only "add field" UI exposed on
  the Rooms grid.
- **Failure**: A Phase-1 user has no UI path to create a
  linked_record field at all. Combined with §A2, even the workaround
  of "create a text field then convert" is broken.
- **Fix**: Mirror the FieldConfigModal integration (second pass)
  into `CreateFieldConfigModal`: add "Linked record" to the type
  picker, render `FieldConfigSectionLinkedRecord` when selected,
  gate Save on a non-null target, accept and forward
  `linkedRecordTargets`. The add path can lock in the target on
  creation (Q13 already locks edits); the create modal is a
  greenfield draft, so no in-place edit conflicts apply. Add a
  matching create-path test alongside the existing
  `FieldConfigModal.test.tsx` cases.

### A4 — `LinkedRecordPicker` draft is reset on every parent render — ✅ COMPLETE

- **Files**:
  - `frontend/src/shared/ui/data-table/fields/linkedRecord/Picker.tsx:59-66`
  - `frontend/src/shared/ui/data-table/components/GridBody.tsx:550`
- **Defect**: `GridBody` passes
  `selectedIds={toLinkedIdList(cellValue)}` to the picker, allocating
  a fresh array on every render. `LinkedRecordPicker`'s reset effect
  has `[open, selectedIds]` in its deps and the body
  `setDraftIds([...selectedIds]); setSearch("");`. While the picker
  is open, every parent re-render (typing in search, toggling a
  checkbox, hover-induced re-render) fires the effect and wipes the
  user's draft + search input.
- **Failure**: User opens picker, ticks pump A → state change →
  re-render → draft reverts to the original cell ids; user can never
  complete a multi-select or type-filter the list.
- **Fix**: Two coordinated changes are required:
  1. In `GridBody.renderCellContent`, memoize the linked id list per
     `(rowId, fieldKey)` so the array identity is stable across
     renders when the underlying cell value hasn't changed
     (`useMemo` keyed by a fingerprint, or use the `originalValue`
     snapshot from the editor state).
  2. In `LinkedRecordPicker`, change the reset effect to only fire
     on the closed → open transition. Track `open` in a `useRef`
     and run the seed once on the rising edge, not on every
     `selectedIds` reference change.
  Add a test that opens the picker, calls `toggle()` and asserts the
  draft persists across a parent re-render.

### A5 — `useRowFocusHighlight` cold-start race — ✅ COMPLETE

- **File**: `frontend/src/shared/ui/data-table/hooks/useRowFocusHighlight.ts:32-49`
- **Defect**: The effect runs once on mount; if `controller.viewLoading`
  is still true when it runs, `container.querySelector(...)` returns
  null and the effect early-returns. Effect deps
  `[containerRef, rowId, dependencyKey, durationMs]` don't change
  when rows later mount, so the highlight never fires.
- **Failure**: User clicks a Rooms→Pumps pill → lands on
  `/equipment?tab=pumps&focus=pmp_x`. PumpsTable is in its loading
  placeholder. Hook runs, can't find the row, returns. Slice
  resolves, rows render, but the hook never re-runs. PRD Q19
  silently fails on every cold navigation.
- **Fix**: Either (a) gate the hook on a `mountedRowsKey` derived
  from `controller.rows.length` (or a "view ready" flag) and pass
  it through `dependencyKey` so the effect re-runs when rows
  arrive; or (b) replace the one-shot `querySelector` with a
  `MutationObserver` scoped to the container that watches for the
  target row appearing. (a) is simpler and matches the existing
  `dependencyKey` API — `PumpsTableSlot` would pass
  `dependencyKey={controller.viewReady ? "ready" : "loading"}` (or
  the rows count). Add a test that mounts the hook with the row
  absent, then later inserts the row, and asserts the highlight
  fires.

### A6 — `useRowFocusHighlight` selector matches pill buttons — ✅ COMPLETE

- **File**: `frontend/src/shared/ui/data-table/hooks/useRowFocusHighlight.ts:36`
- **Defect**: The selector `[data-row-id="..."]` matches both `<tr>`
  rows (`GridBody.tsx:306`) AND `LinkedRecordCell` pill `<button>`s
  (`LinkedRecordCell.tsx:77`). `querySelector` returns the first
  match in document order, so any focus rowId that also appears as a
  pill in an earlier row aims the scroll/highlight at the pill.
- **Failure**: On Pumps with `?focus=pmp_b`, an earlier row pmp_a
  has a cross-link cell containing a pill with `data-row-id="pmp_b"`
  (e.g. a backup-pump reference). The pill `<button>` is found
  before the `<tr>` → `scrollIntoView` centers the button →
  `data-focus` is applied to the button. The actual row is never
  highlighted.
- **Fix**: Scope the selector to `tr[data-row-id="..."]`. Add a
  test where the container has both a pill and a row with the same
  id, and assert the row is the highlight target.

### A7 — `EquipmentPageBody.activeTab` ignores subsequent `?tab=` URL changes — ✅ COMPLETE

- **File**: `frontend/src/features/equipment/routes/EquipmentPageBody.tsx:232`
- **Defect**: `activeTab` is seeded by
  `useState<EquipmentTabKey>(() => { ...searchParams.get("tab")... })`.
  The lazy initializer runs once at mount. Subsequent navigations
  that change `?tab=` without unmounting EquipmentPageBody (same
  route segment, only search-params change) keep the previous tab.
  `focusRowId` IS reactive (read directly from `searchParams` each
  render), so it gets forwarded to the wrong slot.
- **Failure**: User clicks Rooms→Pumps pill A
  (`?tab=pumps&focus=pmp_x`), lands on Pumps. Navigates back to
  Rooms, clicks pill B targeting a different sub-table
  (`?tab=fans&focus=fan_y`). EquipmentPageBody component instance is
  reused; `activeTab` stays `"pumps"`. Fans tab never mounts; focus
  highlight aims at a hidden table.
- **Fix**: Reconcile `activeTab` with `searchParams.get("tab")` on
  every render — either drop local state entirely and derive
  `activeTab` from `searchParams` (with a `setActiveTab` that
  writes back to the URL via `setSearchParams({tab, focus})` for
  in-page clicks), or keep local state and add a `useEffect` that
  syncs `setActiveTab(searchParams.get("tab"))` when the URL tab
  param changes. The first is cleaner and removes the dual-source-of-
  truth problem entirely. Add a test that re-renders with a new
  `searchParams` and asserts `activeTab` updates.

## B. Lower-priority cleanup and hardening

These don't block the canonical loop but each is a real defect that
should be addressed before the feature stops being "new."

### B1 — `insertRowBelow → commit()` drops linked_record picker draft — ✅ COMPLETE

- **File**: `frontend/src/shared/ui/data-table/DataTable.tsx:439`
- **Defect**: `insertRowBelow` awaits `edit.commit()` when an editor
  is open. For a linked_record editor, `planCommit` returns
  `{kind:"noop"}`; `commit()` resolves true; the row insert proceeds
  and the picker draft is silently discarded.
- **Failure**: User opens picker, selects two pumps, presses
  Shift-Enter to insert a row. Picks are lost without warning;
  picker stays mounted on the old rowId.
- **Fix**: Either (a) route the picker's pending draft through
  `commitLinkedRecord` from inside the `commit()` dispatch when
  `editor.kind === "linked_record"`, or (b) explicitly cancel the
  editor (with a user-visible affordance) before the insert.
  Option (a) matches the principle that "commit" should commit.
  Long-term, fold `commit` and `commitLinkedRecord` into a single
  commit method that dispatches on `editor.kind` (also referenced
  in §B8 altitude).

### B2 — Legacy `custom_values` data not migrated when reading linked_record cells — ✅ COMPLETE

- **File**: `frontend/src/shared/ui/data-table/hooks/useGridEdit.ts:481`
- **Defect**: `initialEditorState`'s linked_record branch ignores
  `initialValue`. `planLinkedRecord` then diffs the user's picks
  against `originalValue = []`, so a row whose ids live in
  `custom_values` (legacy pre-third-pass data) treats every Confirm
  as additive while the stale `custom_values` entry persists.
- **Failure**: A row with
  `custom_values[cf_pumps] = ["pmp_a"]` and empty `custom_links`
  opens the picker with no selection. User picks `pmp_b`; the
  dispatched write is an additive `[pmp_b]` into `custom_links`.
  The orphan `custom_values` entry persists — backend rejects
  with `bag_exclusivity_violation` on save unless it strips on its
  side.
- **Fix**: Two complementary moves: (1) on the read path, the
  accessor for linked_record columns should prefer `custom_links`
  but, when absent, fall back to reading from `custom_values` and
  flag the row as "needs migration"; (2) on the write path, route
  the migration as part of the cell write — clear the stale
  `custom_values` entry whenever a write lands in `custom_links`
  for the same field_key (see also §B3). Cover with a test that
  seeds a row in `custom_values`, opens the editor, picks a new id,
  and asserts both bags are correct post-commit.

### B3 — `setCustomLink` does not clear stale `custom_values[fieldKey]` — ✅ COMPLETE

- **File**: `frontend/src/shared/ui/data-table/lib/customFieldAccessor.ts:46-58`
- **Defect**: `setCustomLink` writes to `custom_links` but never
  deletes the corresponding `custom_values[fieldKey]` entry. After a
  type-change from text→linked_record (before the next backend
  refetch), a local cell write leaves both bags populated.
- **Failure**: Field cf_x was `short_text` with
  `row.custom_values.cf_x = "foo"`. Schema mutation converts cf_x to
  `linked_record`. Before refetch, a local write through
  `setCustomLink` puts ids into `custom_links.cf_x` but leaves
  `custom_values.cf_x = "foo"`. UI shows two values for one field;
  backend rejects on save.
- **Fix**: In `setCustomLink`, also remove any existing
  `custom_values[fieldKey]` entry. Mirror in `setCustomValue` —
  remove any existing `custom_links[fieldKey]` entry. Bag
  exclusivity is the accessor's invariant to preserve; document the
  reasoning inline. Cover with a test for both directions.

### B4 — Type-change away from linked_record leaves orphan `custom_links` rows — ✅ COMPLETE (backend wipe already handles it; frontend invariant now documented inline)

- **File**: `frontend/src/shared/ui/data-table/lib/customFieldMutations.ts:492`
- **Defect**: Changing a field AWAY from `linked_record` strips
  `target_table_path` and `max_links` from `nextConfig` but emits no
  instruction to clear the existing `custom_links[fieldKey]` on
  every row.
- **Failure**: User retypes `cf_pumps` from `linked_record` to
  `short_text`. Mutation payload: `field_type="short_text"`,
  `config={}`. Rows still hold `custom_links.cf_pumps=["pmp_a"]`.
  UI now reads `custom_values.cf_pumps` (empty) and renders empty
  cells; orphan link data persists until manually scrubbed.
- **Fix**: Confirm against backend `linked_record_wipe` policy (per
  `phase-01-link-values.md` P3.4) whether the wipe already runs on
  `linked_record → *` direction. If yes, the frontend is fine —
  document the invariant. If no, add the wipe trigger to the
  schema-mutation payload (parallel to the
  `linked_record → linked_record` retarget guard). Backend pytest
  to confirm round-trip.

### B5 — `applyWritesToRoom` rebuilds `linkedFieldKeys` per call — ✅ COMPLETE

- **File**: `frontend/src/features/equipment/lib.ts:2786-2820`
- **Defect**: `linkedFieldKeys = new Set(fieldDefs.filter(...).map(...))`
  is computed inside `applyWritesToRoom` on every payload-build
  call instead of consulting the existing `fieldKeyFieldDefMap`
  indexer or threading the set down from `useTableSchema` (where
  `customFieldKeys` is already derived).
- **Failure**: On a 500-row Rooms table with 30 field_defs, a
  paste touching one cell allocates a fresh Set and walks fieldDefs
  once per call. Cost is small per write but scales with
  fieldDefs × rooms.length on batched writes. More importantly,
  the per-write recomputation is a latent reuse + altitude smell:
  bag-routing belongs on the FieldDef, not in a one-off Set
  threaded through the equipment feature.
- **Fix**: Short-term — derive `linkedFieldKeys` once in
  `useTableSchema` alongside `customFieldKeys` and pass it through
  the controller; or switch to a `fieldDefsByKey.get(fieldKey)?.field_type === "linked_record"`
  lookup using the existing `fieldKeyFieldDefMap`. Long-term — see
  §B8.

### B6 — `useTableSchema` accepts empty `target_table_path` silently — ✅ COMPLETE

- **File**: `frontend/src/shared/ui/data-table/hooks/useTableSchema.ts:218`
- **Defect**: Defensive parsing accepts
  `{target_table_path: []}` as valid (`Array.isArray` ✓,
  `.every(is string)` ✓), so a corrupt/half-written config surfaces
  in the UI as an empty picker with no error trail.
- **Failure**: Backend returns a partial `linked_record_config`
  (e.g. mid-migration). `useTableSchema` produces
  `linked_record_config={target_table_path: [], max_links: null}`.
  `buildLinkedRecordOps`' `pathsEqual([], any)` → false; picker
  mounts with empty candidates; user confirms an empty selection.
  Corrupt config has no diagnostic.
- **Fix**: Treat an empty `target_table_path` as a hard parse
  failure — return `linked_record_config: null` (or surface an
  error in the schema fingerprint) so the field renders in an
  obviously-broken state, not a silently-empty one. Backend
  `validate_link_config` already rejects this shape; the frontend
  defensive code should match.

### B7 — `buildLinkedRecordOps.resolve` collapses orphan and missing-recordId visually — ✅ COMPLETE

- **File**: `frontend/src/shared/ui/data-table/fields/linkedRecord/buildLinkedRecordOps.ts:55-72`
- **Defect**: `resolve(rowId)` returns `null` only when the rowId
  isn't in the index. An existing target row with a null `recordId`
  returns `{recordId: null}`. `LinkedRecordCell` renders the
  row-id fallback in both cases — orphan-link (deleted/missing
  target) is visually indistinguishable from live-link-without-
  record_id.
- **Failure**: User can't tell "this pill points at a pump that no
  longer exists" from "this pill points at a pump with no record_id
  set yet." Q5's silent-strip and Q18's row-id fallback collide.
- **Fix**: Differentiate the two states in `LinkedRecordCell`
  rendering — e.g. a distinct visual treatment for orphan pills
  (`resolve(rowId) === null`) such as italic + tooltip "linked
  record no longer exists," versus the row-id fallback for the
  no-record_id case. Optionally surface orphan count on the cell
  for editor-mode discoverability.

### B8 — External clipboard copy emits raw JSON id list — ⏸ DEFERRED to Phase 2 polish (PRD §11 Q24 only specifies in-grid round-trip; external copy is not in Phase 1 scope)

- **File**: `frontend/src/shared/ui/data-table/lib/paste/tsv.ts:22`
- **Defect**: `formatClipboardCellValue`'s dispatch table omits a
  `linked_record` case. External copy (⌘C → Excel) round-trips
  through the default `formatClipboardValue`, which emits
  `JSON.stringify(ids)` — opaque internal-id arrays instead of
  human-readable pill labels.
- **Failure**: User copies a linked_record cell to Excel and sees
  `["pmp_a","pmp_b"]`. In-grid round-trip works (PRD Q24); external
  copy doesn't.
- **Fix**: Add a `linked_record` branch in `formatClipboardCellValue`
  that resolves ids through the `LinkedRecordCellOps.resolve` (when
  available) and emits a comma-separated list of record_ids /
  row-id fallbacks. Decision needed first: is external copy
  in-scope for Phase 1, or deferred? PRD §11 Q24 names the in-grid
  round-trip explicitly; external copy is not stated. Recommend:
  defer if scope-tight, file as Phase 2 polish. Documented either
  way.

## Out of scope for §1.b

These came up during the review but belong elsewhere:

- **Altitude refactors** (registry-driven `renderCell` / `renderEditor`
  hooks, `setCustomCell` unification, `commit` dispatch on
  `editor.kind`, page-level `useLinkedRecordOps` hook, shared
  `useTabFromUrl`). These are real and would simplify future field
  types; they don't block §A. Park them as a Phase-2 architecture
  prep note.
- **Playwright MCP browser smoke** (per `STATUS.md` deferred list).
  Now that §A1–§A7 are implemented, the smoke can exercise the loop;
  run it after the deleteField cleanup fix so the evidence corresponds
  to a shippable checkout.
- **`commitLinkedRecord` and `commit` consolidation** — covered by
  §B1's fix sketch; keeping the wider altitude refactor out of
  this list.

## Acceptance for §1.b

§1.b is mergeable when:

- [x] §A1–§A7 each have a fix landed and a regression test that
  would have failed before the fix.
- [x] §B1–§B7 are fixed and regression-tested.
- [x] §B8 is explicitly deferred to Phase 2 polish.
- [x] `make ci` is green for the current checkout. Current audit:
  `make format` left files unchanged and `make ci` passed on
  2026-06-09.
- [ ] A manual MCP smoke or Playwright e2e spec demonstrates: add
  linked_record field on Rooms via `+`; pick target = Pumps; save;
  double-click Rooms cell; pick a pump; save row; click pill → land
  on Pumps with the row scrolled into view and the focus highlight
  visible; back to Rooms; second pill click on a different sub-table
  switches sub-tab and focuses the right row.
- [ ] Linked-record deleteField cleanup bug is fixed and regression-
  tested: deleting the FieldDef must also remove
  `custom_links[field_key]` from source rows.

## Origin

This punch list was produced by `/simplify xhigh` against the
working-tree diff on 2026-06-09. The review ran 9 parallel finder
angles (line-by-line, removed-behavior, cross-file tracer,
language-pitfalls, wrapper/dispatch, reuse, simplification,
efficiency, altitude) and verified the top correctness items
against backend canonical shapes (`["equipment", "pumps"]`),
current call sites (`DataTable.tsx` ↔ `FieldConfigModal`,
`CreateFieldConfigModal`), and React render semantics (picker
draft reset, focus-highlight cold start).

The previous closeout summary in `STATUS.md` (seventh pass) noting
"`make ci` green; Phase 1 code complete" was accurate as a CI
statement and incomplete as a shippability statement. §A items are
the difference between those two.
