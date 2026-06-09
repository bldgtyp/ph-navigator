---
DATE: 2026-06-09
TIME: 14:50
STATUS: DRAFT — Phase 2 outline. Depends on Phase 1.
AUTHOR: Ed May (with Claude)
SCOPE: Frontend page for the HP Equipment — Indoor DataTable.
       Inherits all UX primitives from Phase 1 (nested tabs,
       conditional column visibility decision, attachment cell,
       Phius export stub if applicable).
RELATED:
  - planning/features/heat-pumps/PRD.md §4.3, §5.6
  - context/user-stories/30-tables-equipment.md US-EQ-9
  - planning/features/heat-pumps/phases/phase-01-equipment-outdoor-page.md
---

# Heat Pumps — Phase 2: HP Equipment — Indoor DataTable

## Why this slice

Phase 1 established the nested-tab UX, column-visibility pattern,
row-detail-modal structure, and `<AttachmentCell>` binding. Phase 2
ships the second leaf page using all of those primitives. By the
end:

- The Indoor Equipment leaf-tab navigates to a real page (replacing
  the Phase 1 "Coming in Phase 2" stub).
- A user can add / edit / delete indoor-equipment rows with the
  full 16-field column set per PRD §4.3.
- The `install_type` single-select is wired with seeded examples
  including `ERV-INTEGRATED` — the value Phase 4 reads to gate the
  `linked_erv_unit_id` picker on indoor unit instances.

## Acceptance — Phase 2 done when

1. Navigating to `…/heat-pumps/equipment-indoor` renders the
   DataTable bound to `tables.equipment.heat_pump_indoor_equip[]`.
2. The 16-field column set per PRD §4.3 is declared. Default-
   visible: `manufacturer`, `model_type`, `model_number`,
   `install_type`, `nominal_tons`, `cooling_btuh`,
   `heating_btuh_47f`, `datasheet_asset_ids`. Hidden by default:
   the rest (`fan_speed_cfm`, `heating_btuh_17f`, `heating_cop`,
   `seer`, `eer`, `hspf`, `notes`).
3. `install_type` single-select column ships with seeded options
   the user can rename: `CASSETTE`, `WALL-MOUNTED`,
   `CONCEALED-DUCTED`, `MULTI-POSITION`, `ERV-INTEGRATED`. Users
   can add/remove/rename options like any single-select.
4. Row-detail modal mirrors Phase 1's structure: Identity /
   Performance / Documents / Notes sections. No conditional
   discriminators on the indoor side.
5. Validation: `model_number` required; numeric fields ≥ 0 when
   non-null; `nominal_tons > 0` when non-null.
6. Empty state per PRD §5.6.
7. Locked-version + Viewer rendering inherited.
8. Vitest coverage; Playwright MCP smoke-test of add-edit-delete.
9. `make ci` passes.

## Out of scope

- All linkages to other tables (instance pages, ERV, rooms) —
  Phases 3 / 4.
- Any per-row preview of "which outdoor equip am I paired with?"
  — that lives on the unit pages (Phases 3 / 4).
- Phius export (indoor data isn't exported anyway — Phase 5).

## Implementation outline

### Step 1: Page wired into the nested layout

`frontend/src/features/equipment/heat-pumps/routes/EquipmentIndoorPage.tsx`:

- Replaces the Phase 1 stub for this leaf.
- Mounts `<ProjectDataTable tableKey="heat_pump_indoor_equip" …>`.

### Step 2: Column definitions

`frontend/src/features/equipment/heat-pumps/indoor-equip-columns.ts`:

- 16 `DataTableColumnDef` entries per PRD §4.3.
- Reuses the field-type helpers built in Phase 1 (single-select,
  numeric, AttachmentCell).

### Step 3: Row-detail modal

`frontend/src/features/equipment/heat-pumps/components/IndoorEquipRowModal.tsx`:

- Mirrors `OutdoorEquipRowModal.tsx` structure from Phase 1.
- No discriminator-based conditional sections — all fields visible
  always.

### Step 4: `install_type` seeded options

The user-defined single-select primitive seeds options *per
project* on first use. Phase 2 adds the helper that bootstraps the
five default options into `single_select_options["heat_pump_indoor_equip.install_type"]`
when the project's option list is empty. User-rename / reorder
post-bootstrap behaves like any other single-select column.

### Step 5: Tests

- `EquipmentIndoorPage.test.tsx` — page mount, column-def render.
- `IndoorEquipRowModal.test.tsx` — required-field validation.
- `install-type-bootstrap.test.ts` — seeded options appear in a
  fresh project; existing options are not overwritten.
- Playwright MCP smoke: add-edit-delete one indoor equip row.

## Verification

1. `make format` clean; `make ci` passes.
2. Playwright MCP screenshots: empty state, populated table, modal
   with all sections.
3. Confirm `install_type` options bootstrap correctly on a fresh
   project (option list pre-populated) AND on an existing project
   that already has user-defined options (the bootstrap is a
   no-op).

## Risks

- **Single-select bootstrap collision.** If a user already created
  a `heat_pump_indoor_equip.install_type` option list before
  Phase 2 ships (unlikely but possible via MCP), the bootstrap
  helper must be idempotent. Mitigation: explicit "skip if
  non-empty" check; tested as Step 5.
- **Naming consistency across `Equipment — Outdoor` and
  `Equipment — Indoor`.** Components should share patterns
  (modal sections, column-def helpers) to avoid drift. Mitigation:
  Phase 1 builds shared helpers in
  `frontend/src/features/equipment/heat-pumps/lib/`; Phase 2 imports
  them rather than copy-pasting.
