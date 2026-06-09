---
DATE: 2026-06-09
TIME: 12:45
STATUS: ✅ IMPLEMENTED — merged in commit `399d4e6`.
        See `../STATUS.md` Phase 3 row for the verification ledger
        and the deliberate Phase 4 carry-overs.
AUTHOR: Ed May (with Claude)
SCOPE: Frontend pages for both HP Units — Outdoor and HP Units —
       Indoor DataTables. Introduces the equip-picker primitive
       (instance row → its equipment "type" row) and the first
       cross-table referential-integrity surfaces (outdoor unit ↔
       indoor unit).
RELATED:
  - planning/features/heat-pumps/PRD.md §4.4, §4.5, §4.6, §5.5
  - context/user-stories/30-tables-equipment.md US-EQ-10, US-EQ-11
  - planning/features/heat-pumps/phases/phase-01-equipment-outdoor-page.md
  - planning/features/heat-pumps/phases/phase-02-equipment-indoor-page.md
---

# Heat Pumps — Phase 3: HP Units — Outdoor and Indoor DataTables

## Why this slice

Phases 1–2 shipped the "type" tables. Phase 3 ships the "instance"
tables that point back at them. By the end:

- Both `…/heat-pumps/units-outdoor` and `…/heat-pumps/units-indoor`
  navigate to real pages (replacing Phase 1 stubs).
- A user can add / edit / delete outdoor and indoor unit
  instances, picking from the catalog rows defined in Phases 1–2.
- The indoor unit row references an outdoor unit (1:N from the
  outdoor side), establishing the first cross-table FK on the HP
  side.
- `tag` uniqueness is enforced within each unit table (case-
  insensitive trim, with auto-suffix `(2)`, `(3)` on add and
  rejection on rename collision — mirrors US-EQ-2 / US-EQ-4).
- Referential integrity per PRD §4.6 is wired and tested for the
  HP-internal links (the ERV / Rooms links land in Phase 4).

## Acceptance — Phase 3 done when

1. **Outdoor Units page** renders the DataTable bound to
   `tables.equipment.heat_pump_outdoor_units[]` with all 6 fields
   per PRD §4.4. Default sort by `tag` ascending via
   `naturalSortCompare`.
2. **Indoor Units page** renders the DataTable bound to
   `tables.equipment.heat_pump_indoor_units[]` with all 9 fields
   per PRD §4.5. Default sort by `tag` ascending.
3. **`tag` is the Record-ID** per US-Builder-Tables on both tables.
   Required; unique within table (trim + case-insensitive); on
   duplicate add: auto-suffix `(2)` / `(3)`; on duplicate rename:
   rejected with toast.
4. **Outdoor-equip picker** on the Outdoor Units row-detail
   modal: required single-select pulling `heat_pump_outdoor_equip[]`
   rows. Inline "Create new outdoor equipment" shortcut at the
   bottom of the picker opens the Equipment — Outdoor row-detail
   modal in "create" state; on save, the new equip row is selected
   automatically.
5. **Indoor-equip picker** on the Indoor Units row-detail modal:
   same shape, pulling `heat_pump_indoor_equip[]`.
6. **Outdoor-unit picker** on the Indoor Units row-detail modal:
   optional single-select pulling `heat_pump_outdoor_units[]`. If
   no outdoor units exist yet, the picker is disabled with helper
   text "Add an outdoor unit first in Units — Outdoor."
7. **Referential integrity rules** from PRD §4.6 enforced:
   - Deleting an outdoor-equip row with ≥1 referencing outdoor
     unit: blocked, error dialog lists tags.
   - Deleting an indoor-equip row with ≥1 referencing indoor unit:
     blocked, error dialog lists tags.
   - Deleting an outdoor unit with ≥1 referencing indoor unit:
     **pre-delete confirmation dialog** (per D-HP-19) lists the
     affected indoor tags and asks to confirm; on confirm,
     cascade-null `outdoor_unit_id` on those indoor units. No
     post-delete toast — the dialog is the user notification.
8. **Building zone single-select** on Outdoor Units uses the
   project's `tables.rooms[*].building_zone` option list (shared
   across tables — same option_id space).
9. **Floor level single-select** on Indoor Units uses the project's
   `tables.rooms[*].floor_level` option list (shared).
10. **`area_served`** on Indoor Units accepts free text.
11. **`served_room_ids[]` and `linked_erv_unit_id`** fields exist
    in the row-detail modal **disabled** (greyed) with a
    "Configured in Phase 4" badge. The underlying data shape
    accepts and round-trips the values (since Phase 0 ships
    storage support) — only the UI binding is gated.
12. Empty states per PRD §5.6 (with secondary lines pointing to
    the equip tables when those are empty).
13. Locked-version + Viewer rendering inherited.
14. Vitest coverage; Playwright MCP smoke tests for each unit
    page.
15. `make ci` passes.

## Out of scope

- ERV cross-link (Phase 4).
- `served_room_ids[]` picker UX wiring (Phase 4).
- Rooms-side referential integrity (Phase 4).
- Phius export (Phase 5).
- "Add unit from outdoor-equip detail page" inverse-shortcut (post-v1).

## Implementation outline

### Step 1: Outdoor Units page

`frontend/src/features/equipment/heat-pumps/routes/UnitsOutdoorPage.tsx`:

- Mounts `<ProjectDataTable tableKey="heat_pump_outdoor_units" …>`.
- Replaces the Phase 1 stub.

### Step 2: Indoor Units page

`frontend/src/features/equipment/heat-pumps/routes/UnitsIndoorPage.tsx`:

- Mounts `<ProjectDataTable tableKey="heat_pump_indoor_units" …>`.
- Replaces the Phase 1 stub.

### Step 3: Equip-picker primitive

`frontend/src/features/equipment/heat-pumps/components/EquipPicker.tsx`:

- Generic single-select picker parameterized by source table key
  (`heat_pump_outdoor_equip` or `heat_pump_indoor_equip`) and
  display-name formatter.
- "Create new <X>" inline shortcut opens the matching row-detail
  modal from Phase 1 / Phase 2 in create mode; on save, returns
  the new row's id to the parent picker and selects it.

### Step 4: Outdoor-unit picker (used by indoor unit modal)

`frontend/src/features/equipment/heat-pumps/components/OutdoorUnitPicker.tsx`:

- Single-select pulling `heat_pump_outdoor_units[]` by `tag`.
- Disabled with helper text when source list is empty.

### Step 5: Tag uniqueness

`frontend/src/features/equipment/heat-pumps/lib/tag-uniqueness.ts`:

- Reuses the uniqueness helper from US-EQ-2 (`number`) / US-EQ-4
  (`name`). Auto-suffix on add; rejection on rename. Shared utility
  between both unit pages.

### Step 6: Referential integrity wiring

The backend service (Phase 0) already implements the rules. Phase 3
ensures the frontend surfaces them correctly per D-HP-19:

- On 409 from delete (blocked): show a structured error dialog
  listing the referencing rows. (Existing error-handling pattern
  from US-EQ-2 delete.)
- On cascade-null delete: a **two-step UI flow**. The user clicks
  Delete → frontend issues a `?dry-run=true` request → backend
  returns the `affected_indoor_units[]` preview list → frontend
  opens a confirmation dialog
  ("Deleting HP-17 will clear the outdoor link on 12 indoor units:
  AHU-17B, AHU-17C, …  Continue?") → on confirm, frontend issues
  the real delete. The Phase 0 service module needs a `dry_run`
  flag on the delete endpoint to support this — flag for Phase 0
  scope amendment.

### Step 7: ERV / Rooms field stubs

Indoor Units row-detail modal includes `served_room_ids[]` and
`linked_erv_unit_id` as visible-but-disabled fields with a small
"Configured in Phase 4" pill. Backend storage accepts the values
already (Phase 0); the UI gate is purely cosmetic.

### Step 8: Tests

- `UnitsOutdoorPage.test.tsx`, `UnitsIndoorPage.test.tsx` — page
  mount, column-def render.
- `EquipPicker.test.tsx` — render, selection, inline-create flow.
- `OutdoorUnitPicker.test.tsx` — render, empty-list disable.
- `tag-uniqueness.test.ts` — auto-suffix on add, rejection on
  rename, case-insensitive comparison.
- Referential-integrity integration tests against the Phase 0
  backend.
- Playwright MCP smoke tests: add one outdoor unit, add one
  indoor unit pointing to it, verify cascade-null on outdoor
  delete.

## Verification

1. `make format` clean; `make ci` passes.
2. Playwright MCP screenshots: each unit page populated with ≥3
   rows; row-detail modal showing pickers and disabled Phase 4
   fields.
3. Manual delete-cascade walkthrough on the dev DB:
   - Create outdoor equip A, outdoor unit U1 → A, indoor unit
     I1 → U1.
   - Attempt to delete A → blocked.
   - Delete U1 → I1's `outdoor_unit_id` is null; toast appears.
   - Delete I1, then U1, then A → all succeed.

## Risks

- **Inline-create-from-picker UX.** First time PHN nests a
  row-detail modal inside another row-detail modal (via the
  picker). Modal stacking must be visually correct and keyboard-
  accessible. Mitigation: prototype in Step 3 against the existing
  shadcn `Dialog` modal-on-modal behavior; if stacking is ugly,
  fall back to a side-panel pattern. Pin decision in this phase.
- **Cascade-null preview round-trip.** Per D-HP-19 the
  confirmation dialog needs the affected-rows list *before* the
  user confirms. Phase 0 must ship a `?dry-run=true` flag on the
  delete endpoint that returns the cascade-preview payload
  without mutating. Scope amendment to Phase 0 — confirm before
  Phase 0 starts.
- **Building zone + floor level option-list sharing.** Existing
  rooms-table options are the source-of-truth. Mitigation: the
  single-select primitive (US-Builder-Tables §16) already keys
  options by `<table>.<column>`, but PHN needs to support
  *cross-table* option sharing. If that primitive doesn't exist,
  Phase 3 either adds it (small primitive bump) or duplicates the
  option list on first use. Resolve in Step 1.
