---
DATE: 2026-06-09
TIME: 15:00
STATUS: DRAFT — Phase 4 outline. Depends on Phase 3. Cross-touches
        existing US-EQ-2 (Rooms), US-EQ-4 (ERVs) surfaces.
AUTHOR: Ed May (with Claude)
SCOPE: Wire the `linked_erv_unit_id` and `served_room_ids[]` fields
       on the HP Indoor Units page. Land the US-EQ-4 amendment
       (reverse-lookup badge + column on the ERVs sub-tab). Land
       the rooms-side referential integrity for HP indoor
       references.
RELATED:
  - planning/features/heat-pumps/PRD.md §4.5, §4.6, §5.4
  - planning/features/heat-pumps/decisions.md D-HP-4, D-HP-11
  - context/user-stories/30-tables-equipment.md US-EQ-4 amendment,
    US-EQ-11
---

# Heat Pumps — Phase 4: ERV cross-link and Rooms link

## Why this slice

Phases 1–3 ship a self-contained heat-pump feature. Phase 4 wires
it into the rest of the equipment-tab world — Rooms (via
`served_room_ids[]`) and ERVs (via `linked_erv_unit_id`) — which is
where the real-world workflows get done. By the end:

- The Phase 3 disabled-with-pill `served_room_ids[]` field becomes a
  fully wired multi-select picker.
- The Phase 3 disabled-with-pill `linked_erv_unit_id` field becomes
  a conditional single-select picker that only renders when the
  row's indoor-equip has `install_type = ERV-INTEGRATED` (or its
  user-renamed equivalent).
- The ERVs DataTable gains the "Linked HP indoor" column
  (default-hidden) per the US-EQ-4 amendment.
- The ERV row-detail modal gains the "Linked from HP indoor:
  {tag}" badge with deep-link.
- Cross-table delete cascades wire correctly: ERV deletion nulls
  `linked_erv_unit_id` on referencing HP indoor units; Room
  deletion filters `served_room_ids[]` arrays.

## Acceptance — Phase 4 done when

### On the HP Units — Indoor page

1. **`served_room_ids[]` picker** is a fully functional multi-
   select on the row-detail modal. Source: `tables.rooms[]` formatted
   as `"{number} — {name}"` (matching US-EQ-2 display). Empty
   array allowed; "0 rooms selected" empty-pill display.
2. **`linked_erv_unit_id` picker** is an always-rendered single-
   select on the row-detail modal, regardless of the row's
   `install_type` (per D-HP-23). Placement at the bottom of the
   modal so the field doesn't dominate the editor on the 95%+
   rows that won't use it. OPQ-4 (hidden vs disabled) is moot —
   the picker is just always shown.
3. Source: `tables.equipment.ervs[]` formatted by `name`.
4. The Phase 3 "Configured in Phase 4" pills are removed.

### On the ERVs page (US-EQ-4 amendment)

5. **New column "Linked HP indoor"** added to the ERVs DataTable
   column definitions. Default-hidden. Rendered value is the
   count of HP indoor units whose `linked_erv_unit_id` matches
   this ERV's id. Numeric sort; numeric filter operators.
6. **Modal badge** "Linked from HP indoor: {tag}" appears in the
   ERV row-detail modal header when ≥1 HP indoor unit links to
   this ERV. Multiple tags comma-separated; each is a deep-link
   to the matching indoor unit row on `…/heat-pumps/units-indoor`.
7. Locked-version + Viewer: column + badge render, deep-link works
   (read-only).

### Cross-table delete cascades

8. Deleting an ERV row with ≥1 HP indoor unit linking to it:
   per D-HP-19, a **pre-delete confirmation dialog** lists the
   affected HP indoor `tag` values ("Deleting ERV-N2 will clear
   the linked-ERV reference on 2 HP indoor units: AHU-N2B, AHU-N5.
   Continue?"); on confirm, affected HP indoor rows have
   `linked_erv_unit_id` cleared. No post-delete toast.
9. Deleting a Room row with ≥1 HP indoor unit referencing it via
   `served_room_ids[]`: succeeds; each referencing indoor unit's
   array filters out the deleted id; **no dialog, no toast**
   (silent — same pattern as ERV ↔ rooms direction; the indoor
   unit's identity is unchanged).

### Tests + CI

10. Vitest + integration coverage for every new wire.
11. Playwright MCP smoke: create the integrated-unit flow end to
    end (indoor equip with ERV-INTEGRATED install type → indoor
    unit picking that equip → linked_erv_unit_id picker visible →
    select an ERV row → reload → link persists; ERV-side badge
    visible).
12. `make ci` passes.

## Out of scope

- Bi-directional creation (creating an ERV from the HP-side
  picker). Phase 4 is read-only on the ERV picker; ERVs are
  created on the ERVs sub-tab.
- Per-room reverse view ("which HPs serve this room?"). Captured
  as a v1.1+ candidate; the data is already present via
  reverse-lookup.

## Implementation outline

### Step 1: ~~Discover indoor-equip's install_type~~ — dropped per D-HP-23

The picker is always rendered; no resolver hook needed. This step
collapses to: ensure the ERV picker (Step 2) mounts unconditionally
on the indoor-unit row-detail modal.

### Step 2: ERV picker

`frontend/src/features/equipment/heat-pumps/components/ErvPicker.tsx`:

- Single-select pulling `tables.equipment.ervs[]` rows by `name`.
- Used in the indoor-unit row-detail modal.

### Step 3: Rooms multi-picker

`frontend/src/features/equipment/heat-pumps/components/RoomsMultiPicker.tsx`:

- Multi-select pulling `tables.rooms[]` rows. Display per US-EQ-2
  pattern (`{number} — {name}`).
- Reusable in case Phase 4 needs to surface the picker elsewhere
  (e.g. the "Configured in Phase 4" pill removal in Phase 3
  fields).

### Step 4: ERVs page amendment

`frontend/src/features/equipment/ervs/columns.ts` (existing file
edit):

- Add a new column definition `linked_hp_indoor_count` with a
  rollup formula reading `heat_pump_indoor_units[*].linked_erv_unit_id`
  matches.
- Default-hidden via column-visibility config.

`frontend/src/features/equipment/ervs/components/ErvRowModal.tsx`:

- Add the "Linked from HP indoor" badge to the modal header.
- Each tag is a `<Link>` to the indoor unit row's deep-link URL.

### Step 5: Backend cascade rules

Phase 0 already implements the rules at the service layer (PRD
§4.6). Phase 4 verifies the rules fire on real deletions via the
new UI surfaces:

- Tests for ERV delete → HP indoor `linked_erv_unit_id` null.
- Tests for Room delete → HP indoor `served_room_ids[]` filter.

These should pass against the Phase 0 service module; Phase 4 only
needs to confirm the frontend toast / silent behaviors match the
backend response shape.

### Step 6: US-EQ-2 (Rooms) regression

Rooms delete already cascades to `rooms.erv_unit_ids` per US-EQ-2
criterion 6. Phase 4 adds the parallel cascade to
`heat_pump_indoor_units[*].served_room_ids[]`. Existing US-EQ-2
test must still pass; a new test confirms the HP-side cascade
fires on the same delete.

### Step 7: Tests

- `use-indoor-equip-install-type.test.ts` — resolves option label
  correctly; returns undefined when equip row missing.
- `ErvPicker.test.tsx`, `RoomsMultiPicker.test.tsx` — render +
  selection.
- `ErvRowModal.test.tsx` — badge appears when linked; deep-link
  navigates correctly.
- `IndoorUnitRowModal.test.tsx` — `linked_erv_unit_id` field
  conditional visibility based on install_type label.
- Playwright MCP smoke: full integrated-unit flow per acceptance
  criterion 11.

## Verification

1. `make format` clean; `make ci` passes.
2. Playwright MCP screenshots:
   - Indoor unit row-detail modal with `linked_erv_unit_id` field
     populated (any install type).
   - Indoor unit row-detail modal with `linked_erv_unit_id` field
     empty on a non-integrated install type (always rendered, per
     D-HP-23).
   - ERV row-detail modal with "Linked from HP indoor: AHU-N2B"
     badge.
   - ERVs DataTable with "Linked HP indoor" column toggled on.
3. Manual integrated-unit walkthrough on dev DB:
   - Create ERV row, create indoor equip with ERV-INTEGRATED install,
     create indoor unit picking that equip + that ERV.
   - Open the ERV row → see the badge → click the tag → land on
     the HP indoor row.
   - Delete the ERV → the indoor unit's link clears, toast appears.

## Risks

- ~~**Conditional visibility on install_type label.**~~ Closed
  via D-HP-23: picker is always rendered; no install_type
  resolver, no system-option marker primitive in v1.
- **Cross-feature regression.** Touching `frontend/src/features/equipment/ervs/`
  could break existing US-EQ-4 tests if the column-def shape
  changes. Mitigation: run the existing US-EQ-4 test suite as
  part of Step 4's CI; revert if regressions surface.
- **Deep-link navigation across nested tabs.** Clicking a tag in
  the ERV badge needs to navigate from
  `…/equipment/ervs` to `…/equipment/heat-pumps/units-indoor` and
  scroll the row into view. The nested-tab structure may require
  an explicit `?focus={id}` query param the indoor-unit page reads
  on mount. Mitigation: define the deep-link contract in Step 4 and
  test in Step 7.
