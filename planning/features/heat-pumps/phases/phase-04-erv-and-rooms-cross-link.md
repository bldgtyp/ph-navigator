---
DATE: 2026-06-09
TIME: 17:00
STATUS: ✅ IMPLEMENTED — merged in commit `16bdefe`, 2026-06-09.
        Scope amended 2026-06-09 (see "Scope amendment" section):
        AC #6 modal badge and AC #8 pre-delete dialog descoped to
        Q-HP-FOLLOWUP-7; everything else shipped.
AUTHOR: Ed May (with Claude)
SCOPE: Wire the `linked_erv_unit_id` and `served_room_ids[]` fields
       on the HP Indoor Units page. Add a default-hidden reverse-
       lookup count column on the Ventilators table. Add backend
       cascade rules so deleting a ventilator nulls referencing
       HP `linked_erv_unit_id` and deleting a room filters
       referencing HP `served_room_ids[]`.
RELATED:
  - planning/features/heat-pumps/PRD.md §4.5, §4.6, §5.4
  - planning/features/heat-pumps/decisions.md D-HP-4, D-HP-11
  - context/user-stories/30-tables-equipment.md US-EQ-4 amendment,
    US-EQ-11
---

## Scope amendment (2026-06-09)

Three claims in the original draft turned out to be wrong on
contact with the code; Phase 4 is replanned around what's actually
true. Approach **B** (pickers + silent backend cascades, no
pre-delete dialog, no Ventilator row-detail modal) was approved
by Ed before implementation started.

**False claim #1 — "Phase 0 already implements ERV/Room cascade
rules at the service layer."** Phase 0's HP service only implements
HP-internal cascades (outdoor → outdoor-units, indoor → indoor-units,
outdoor-unit → indoor-unit `outdoor_unit_id` null). The
document validator (`backend/features/project_document/document.py`
lines 562–566) rejects a save with `ValueError("Missing linked ERV
…")` / `ValueError("Missing served room …")` if any HP indoor row
still references a removed ventilator or room. **Fix:** add
cross-table cascades to `apply_ventilators_replace` and
`apply_rooms_replace` (Step 5 in this phase plan).

**False claim #2 — "Rooms delete already cascades to
`rooms.erv_unit_ids` per US-EQ-2 criterion 6."** No
`erv_unit_ids` field exists on rooms anywhere in the backend or
frontend. The ERV ↔ rooms link is a future-direction item, not a
prior implementation we're parallelling. **Fix:** the new HP-side
cascade is just `served_room_ids[]` filter on the HP indoor unit;
nothing on the rooms-side or ventilators-side beyond what was
already in `RoomRow` / `VentilatorRow`.

**False claim #3 — "ERV row-detail modal" (AC #6).** Ventilators
uses inline `DataTable` editing through `onWrite` (whole-slice PUT).
There is no row-detail modal to host an "Linked from HP indoor:
{tag}" badge. **Fix:** AC #6 (modal badge with deep-link) is
descoped to a future phase. The default-hidden count column
(AC #5) ships, which gives users a way to spot linked ERVs without
opening a modal. Tracked as **Q-HP-FOLLOWUP-7** (post-v1):
revisit when / if Ventilators gets a row-detail modal.

**Descoped from this phase (per amendment):**

- AC #6 "Linked from HP indoor" modal badge with deep-link.
- AC #8 pre-delete confirmation dialog with affected-row list
  (silent backend cascade replaces it — matches D-HP-19 spirit
  without requiring a Ventilators row-detail modal or a new
  inline-delete intercept path).

**Still in scope (amended ACs marked ✏️):**

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
4. ✅ The Phase 3 "Configured in Phase 4" pills are removed.

### On the ERVs page (US-EQ-4 amendment)

5. **New column "Linked HP indoor"** added to the Ventilators
   DataTable column definitions. Default-hidden. Rendered value
   is the count of HP indoor units whose `linked_erv_unit_id`
   matches this ventilator's id. Numeric sort; numeric filter
   operators.
6. ✏️ ~~Modal badge~~ **DESCOPED** — Ventilators has no row-detail
   modal. Tracked as Q-HP-FOLLOWUP-7.
7. Locked-version + Viewer: column renders (read-only).

### Cross-table delete cascades

8. ✏️ Deleting an ERV row with ≥1 HP indoor unit linking to it:
   **silent backend cascade** — the next Ventilators slice replace
   that omits the row triggers `apply_ventilators_replace`, which
   nulls `linked_erv_unit_id` on each referencing HP indoor unit
   before validating the document. No pre-delete dialog (descoped
   per scope amendment); the cascade is logged in the response
   slice's draft etag the way any HP-side patch would be.
9. Deleting a Room row with ≥1 HP indoor unit referencing it via
   `served_room_ids[]`: silent backend cascade — the next Rooms
   slice replace that omits the row triggers `apply_rooms_replace`,
   which filters the row id out of every `served_room_ids[]` array
   before validating the document.

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

### Step 2: ERV picker — inline in IndoorUnitRowModal

The picker is small enough to inline in `IndoorUnitRowModal.tsx`
rather than break out a one-shot component:

- `IndoorUnitsTable` calls `useVentilatorsSliceForHp` (a thin
  wrapper around `ventilatorsSliceFeature.useSliceQuery`) and
  passes the resulting `ventilators` array into the modal.
- Modal renders a single-select sorted by record_id ("tag"),
  always rendered per D-HP-23 (no install_type gate). When the
  ventilators list is empty, the picker is disabled with helper
  text "Add an ERV first under Equipment → ERVs."

### Step 3: Rooms multi-picker — inline in IndoorUnitRowModal

Same shape as Step 2 — kept inline for the same reason. Uses
`useRoomsSliceForHp`. Display per US-EQ-2 pattern
(`{number} — {name}` pulled from the room's `custom_values`).
Multi-select; selected ids render as removable chips below the
list.

### Step 4: Ventilators page amendment

`frontend/src/features/equipment/components/VentilatorsTable.tsx`
(actual path — original plan referenced `equipment/ervs/`, which
doesn't exist; ERVs are persisted as "ventilators" throughout
the V2 codebase):

- Add a new column definition `linked_hp_indoor_count` rendering
  the count of HP indoor units linking to this row.
- Surface the count map through `VentilatorsTableSlot.tsx`, which
  fetches the HP slice via `useHeatPumpsQuery` and computes a
  `Map<string, number>` keyed by ventilator id.
- Column is added to the table's default-hidden set so it doesn't
  clutter the default view; users can show it via the column
  visibility menu.

(AC #6 modal badge is descoped — see scope amendment.)

### Step 5: Backend cascade rules (NEW — not in Phase 0)

Phase 0's HP service only cascades HP-internal references. Add
ERV/Room → HP cascade logic to the slice-replace handlers that
own each side of the link:

- `backend/features/project_document/tables/ventilators.py`:
  `apply_ventilators_replace` compares the prior and next
  ventilator ids; for every removed id, null
  `linked_erv_unit_id` on every HP indoor unit that referenced
  it before re-running `validate_document`.
- `backend/features/project_document/tables/rooms.py`:
  `apply_rooms_replace` compares the prior and next room ids;
  for every removed id, drop it from every HP indoor unit's
  `served_room_ids[]` before validation.

Both cascades are silent — no preview, no dialog. The validator
will block-with-422 any payload that introduces a *new* dangling
reference (i.e. a save that names a non-existent ERV or room),
which is the only case left where the user can hit a referential
error in this slice.

### Step 6: Tests

Backend tests (`backend/tests/features/`):

- `test_apply_ventilators_replace_cascades_to_hp_indoor.py`:
  delete a ventilator that an HP indoor unit references → HP
  indoor `linked_erv_unit_id` becomes null; existing indoor unit
  id, tag, and other fields are unchanged.
- `test_apply_rooms_replace_cascades_to_hp_indoor.py`: delete a
  room that an HP indoor unit's `served_room_ids[]` references →
  the id disappears from the array; other ids are unchanged.

### Step 7: Frontend tests

- `IndoorUnitRowModal.test.tsx` — extend existing tests: the ERV
  picker renders all ventilators by name, persists selection, and
  is empty when no ventilators exist; the Rooms picker renders
  all rooms by display label and supports multi-select.
- (No new component-file tests for pickers — they live inline
  in `IndoorUnitRowModal.tsx` to keep the modal cohesive.
  Extraction is fair game if either picker grows beyond ~30
  lines, but neither needs it for v1.)

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
