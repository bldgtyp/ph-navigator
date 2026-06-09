---
DATE: 2026-06-09
TIME: 14:45
STATUS: DRAFT — Phase 1 outline. Depends on Phase 0 backend
        foundation being merged.
AUTHOR: Ed May (with Claude)
SCOPE: Frontend page for the HP Equipment — Outdoor DataTable.
       Establishes the nested-tab UX primitive that Phases 2–4
       reuse and pins down conditional column visibility.
RELATED:
  - planning/features/heat-pumps/PRD.md §4.2, §5.1–5.3, §5.5–5.6
  - context/user-stories/30-tables-equipment.md US-EQ-7, US-EQ-8
  - context/technical-requirements/data-table.md (DataTable contract)
  - context/technical-requirements/attachments.md (AttachmentCell)
  - planning/features/heat-pumps/phases/phase-00-backend-foundation.md
---

# Heat Pumps — Phase 1: HP Equipment — Outdoor DataTable

## Why this slice

Phase 0 ships the backend; this slice ships the first user-
visible page and establishes UX patterns the remaining four
pages inherit. By the end:

- The "Heat Pumps" sub-tab is visible in the Equipment tab strip,
  and its nested-tab strip exists with all four leaf-tab labels
  (only the Outdoor Equipment leaf is wired in this phase).
- A user can land on
  `/projects/{id}/equipment/heat-pumps/equipment-outdoor`, see
  the DataTable, add / edit / delete rows, and inspect the row-
  detail modal.
- The 20-field column set is implemented with PRD §5.3 default
  visibility (legacy SEER/EER/HSPF hidden by default). Column
  visibility is always-visible per D-HP-20 — every performance
  column is rendered with empty cells on rows whose discriminator
  doesn't apply.
- The shared `<AttachmentCell>` is wired to
  `datasheet_asset_ids[]`.
- The `paired_indoor_equip_id` picker (per D-HP-22) is fully wired
  on the outdoor row-detail modal, including an inline
  **"Create new indoor equipment"** shortcut that opens a minimal
  indoor-equip create modal. Phase 2 then ships the full
  indoor-equip page reusing the same modal as its main authoring
  surface.
- Pickers (other than the paired-indoor one above) and Phius
  export action are stubbed (button visible, triggers a
  "coming in Phase 5" toast).
- Nested-tab visual treatment pinned via D-HP-25: smaller / lighter
  shadcn `Tabs` variant (`size="sm"` or equivalent) for the inner
  strip; Phase 1 ships a screenshot of the rendered nested strip
  in its verification ledger for Ed eyeball-confirm before Phase 2
  inherits the styling. If Ed flags the hierarchy as too-flat,
  Phase 1 tightens the size delta or escalates to Variant B (panel
  frame) per D-HP-25 iteration path.

Phase 1 does **not** ship the other three leaf pages, the ERV /
Rooms / outdoor-unit pickers, or the Phius CSV export. Those land
in Phases 2–5.

## Acceptance — Phase 1 done when

1. **Sub-tab visible.** "Heat Pumps" appears in the Equipment
   sub-tab strip in the position from US-EQ-1 (between ERVs and
   Pumps). Clicking it routes to `…/heat-pumps`, which redirects
   to `…/heat-pumps/equipment-outdoor`.
2. **Nested strip.** The four nested leaf-tab labels render
   (`Equipment — Outdoor`, `Equipment — Indoor`, `Units — Outdoor`,
   `Units — Indoor`); only the Outdoor Equipment leaf navigates
   to a real page in this phase. The other three leaves render a
   "Coming in Phase 2/3" empty state.
3. **DataTable.** The HP Equipment — Outdoor page renders the
   `<ProjectDataTable>` primitive (US-Builder-Tables criterion 1)
   bound to `tables.equipment.heat_pump_outdoor_equip[]`. Default
   sort by `model_number` ascending via `naturalSortCompare`.
4. **20-field column set.** All 20 fields per PRD §4.2 are
   declared in the `columnDef` array. Single-select columns
   (`manufacturer`, `system_family`, `refrigerant`) use the
   user-defined single-select primitive (US-Builder-Tables §16);
   `heating_data_type` and `cooling_data_type` are hard enums
   (per D-HP-17) rendered as a fixed three-value dropdown;
   `paired_indoor_equip_id` is an FK picker (per D-HP-22) pulling
   from `heat_pump_indoor_equip[]` with an inline "Create new
   indoor equipment" shortcut. The picker cell displays the
   resolved indoor `model_number`.
5. **Default visibility.** PRD §5.3 default-visible set renders;
   the rest are hidden in the column-visibility overflow until
   the user toggles them on. Per-row "active" cells for the
   performance columns render empty when the row's discriminator
   doesn't apply — no per-row column-visibility logic
   (per D-HP-20).
6. **Add / edit / delete.** Hand-enter (per US-Builder-Tables
   criterion 7); row-detail modal opens on click (criterion 8);
   destructive delete dialog (criterion 10). All mutations route
   through the draft buffer; one JSON-Patch per row op
   (criterion 15).
7. **Inline cell edit** (criterion 9) on simple-typed columns
   (numbers, short text).
8. **`<AttachmentCell>`** renders in the `datasheet_asset_ids[]`
   column and accepts drag-drop uploads per the existing
   attachments contract.
9. **Phius export button stubbed.** "Export to Phius HP
   Estimator…" entry in the overflow `⋯` menu next to "Download
   as JSON"; **disabled when the equip table is empty** per
   PRD §6.3; otherwise clicking it shows a "Coming in Phase 5"
   toast.
10. **Empty state** per PRD §5.6.
11. **Locked-version + Viewer rendering** per US-Builder-Tables
    criterion 13.
12. **Tests.** Vitest coverage for the page-mount, column-def
    render, modal interaction, and mutation paths. Playwright MCP
    smoke test of the happy-path add-edit-delete flow.
13. `make ci` passes; `make frontend-dev-check` passes.

## Out of scope for Phase 1

- HP Equipment — Indoor page (Phase 2).
- HP Units — Outdoor / Indoor pages (Phase 3).
- `linked_erv_unit_id`, `served_room_ids[]` pickers (Phase 4).
- ERV reverse-lookup surface (Phase 4).
- Phius CSV generation, pre-export validation, MCP tools (Phase 5).
- Cross-table referential integrity beyond the single
  `heat_pump_outdoor_equip` table (Phase 3).

## Implementation outline

### Step 1: Nested-tab UX primitive

`frontend/src/features/equipment/heat-pumps/HeatPumpsLayout.tsx`:

- Renders the four-leaf nested `Tabs` strip using shadcn `Tabs` at
  `size="sm"` (or equivalent smaller variant) per D-HP-25, placed
  directly below the outer Equipment-tab strip with a small visual
  gap so the level break is unambiguous. Selected inner tab uses
  the same color emphasis family as the outer selection at the
  smaller scale.
- Routes per PRD §5.2.
- Wraps child routes; each leaf renders into the layout's outlet.

### Step 2: Equipment — Outdoor page

`frontend/src/features/equipment/heat-pumps/routes/EquipmentOutdoorPage.tsx`:

- Mounts `<ProjectDataTable tableKey="heat_pump_outdoor_equip"
  …>` with the column definitions from step 3.
- Wires draft-buffer mutations through the existing equipment
  hooks.

### Step 3: Column definitions

`frontend/src/features/equipment/heat-pumps/outdoor-equip-columns.ts`:

- 20 `DataTableColumnDef` entries per PRD §4.2.
- Default-visibility per PRD §5.3.
- Conditional column logic per the OPQ-1 decision (see Step 7).

### Step 4: Row-detail modal

`frontend/src/features/equipment/heat-pumps/components/OutdoorEquipRowModal.tsx`:

- Fields grouped by section (Identity / Heating perf / Cooling
  perf / Documents / Notes).
- The Heating perf section conditionally shows COPs fields when
  `heating_data_type=cops` and HSPF2 when `hspf2`. Same for
  Cooling.
- Legacy fields (`hspf`, `seer`, `eer`) live under a collapsed
  "Legacy ratings (reference only)" expander.
- Validation on save — required fields and numeric ranges.

### Step 5: AttachmentCell binding

Existing `<AttachmentCell>` mounted on
`datasheet_asset_ids[]` column. No new component code.

### Step 5b: Paired-indoor-equip picker + inline-create modal

`frontend/src/features/equipment/heat-pumps/components/PairedIndoorEquipPicker.tsx`:

- Single-select FK picker against `heat_pump_indoor_equip[]`,
  display formatter shows `model_number` (and `manufacturer` if
  present in a secondary line). Empty list shows the inline-create
  shortcut prominently.
- Inline "Create new indoor equipment" shortcut at the bottom of
  the picker opens `IndoorEquipCreateModal` (a minimal version of
  the modal Phase 2 ships as `IndoorEquipRowModal`). On save the
  new indoor row's id is returned to the picker and selected.

`frontend/src/features/equipment/heat-pumps/components/IndoorEquipCreateModal.tsx`:

- Minimal create-only modal for the inline-create flow. Phase 2
  generalizes this into `IndoorEquipRowModal` (full create + edit
  + read modes). Keep both files in the same directory so Phase 2
  can fold the minimal version in.
- Fields: the required indoor-equip fields per PRD §4.3
  (`manufacturer`, `model_type`, `model_number`, `install_type`)
  plus the most-likely-used optional fields (`nominal_tons`,
  `cooling_btuh`, `heating_btuh_47f`). Other fields land in
  Phase 2's full editor.

### Step 6: Phius export stub

`frontend/src/features/equipment/heat-pumps/lib/phius-export-stub.ts`:

- Hook into the overflow `⋯` menu's items prop with a new
  "Export to Phius HP Estimator…" entry whose handler shows a
  toast: "Phius export ships in Phase 5."
- Real implementation lands in Phase 5; the stub guarantees the
  menu shape exists.

### Step 7: Tests

`frontend/src/features/equipment/heat-pumps/__tests__/`:

- `EquipmentOutdoorPage.test.tsx` — page mount, empty state,
  column-def render.
- `OutdoorEquipRowModal.test.tsx` — required-field validation,
  numeric-range validation, conditional section render based on
  discriminator.
- `NestedTabNav.test.tsx` — leaf-tab routing.
- Playwright MCP smoke: add-edit-delete one row, attach a
  datasheet PDF.

## Verification

1. `make format` clean; `make ci` and `make frontend-dev-check`
   both pass.
2. Playwright MCP run captures screenshots: empty state, populated
   table, row-detail modal with both discriminator paths visible,
   `<AttachmentCell>` populated, overflow menu showing the Phius
   stub.
3. Backend integration confirmed: add a row → reload page → row
   persists (i.e. the draft buffer + Phase 0 service / repository
   round-trip works end-to-end).
4. Visual differentiation of the nested tab strip vs the parent
   strip per D-HP-25 — screenshot captured in this phase's
   verification ledger; Ed eyeball-confirms before Phase 2
   inherits.

## Risks

- **Nested shadcn `Tabs` styling.** First time PHN uses nested
  `Tabs`. D-HP-25 pins the smaller-variant approach as the
  starting point; if rendering shows the size delta isn't enough
  to read as subordinate, the D-HP-25 iteration path is to tighten
  the delta first, then escalate to Variant B (panel frame) only
  if A + tightening both fail. Screenshot in the verification
  ledger triggers the Ed eyeball-confirm.
- **Backend / frontend handshake on draft-buffer paths.** The
  existing draft-buffer subsystem in V2 has not yet handled
  `tables.equipment.heat_pump_*` paths in production usage. Phase 0
  acceptance includes this end-to-end check; Phase 1 confirms in
  the browser.
