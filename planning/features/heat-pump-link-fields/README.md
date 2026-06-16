---
DATE: 2026-06-16
TIME: 12:14 EDT
STATUS: Active - planning
AUTHOR: Codex
SCOPE: Heat Pumps DataTables link-field correction for Units - Indoor and
  related reverse-link surfaces.
RELATED:
  - planning/features/heat-pump-link-fields/PRD.md
  - planning/features/heat-pump-link-fields/STATUS.md
  - context/user-stories/30-tables-equipment.md
  - planning/archive/heat-pumps/PRD.md
  - planning/archive/heat-pumps/decisions.md
---

# Heat Pump Link Fields

## Scope

Correct the Heat Pumps DataTable semantics where installed unit rows
point at other project records:

- `Units - Indoor`.`Equipment` links to `Equipment - Indoor`.
- `Units - Indoor`.`Outdoor unit` links to `Units - Outdoor`.
- `Units - Indoor`.`Rooms` remains a link to `Rooms`.
- The referenced side must expose the relationship so a user can see
  both ends of the link.

This feature starts with `Units - Indoor`, but includes the minimum
target-table surfaces needed for parity with the existing `Rooms` link.

## Current Finding

Ed's domain read is correct: `indoor_equip_id` and `outdoor_unit_id`
are not single-select vocabularies. They are first-class references to
rows in sibling Heat Pumps tables.

The reason they render as single-select today is frontend-local:
`indoor-unit-columns.tsx` builds synthetic `FieldDef.options` from the
target rows and marks both fields as `single_select`. That reuses the
single-select pill/popover renderer without changing the persisted
backend shape.

`Rooms` renders differently because `served_room_ids` is already exposed
to the DataTable as `field_type: "linked_record"` with
`target_table_path: ["rooms"]`, and `IndoorUnitsTable.tsx` supplies
`buildLinkedRecordOps` for room chips, picker candidates, and pill
clicks.

## Read Order

1. `PRD.md` - behavior contract and architecture decision.
2. `STATUS.md` - current state, next step, blockers.
3. `phases/phase-01-audit-and-decision.md` - confirm native-FK link
   architecture before implementation.
4. `phases/phase-02-indoor-unit-link-rendering.md` - convert the two
   Units - Indoor fields to linked-record UI while preserving storage.
5. `phases/phase-03-reverse-link-surfaces.md` - add referenced-side
   visibility on Equipment - Indoor and Units - Outdoor.
6. `phases/phase-04-verification-closeout.md` - tests, browser smoke,
   docs pass.

## Non-Goals

- No broad Heat Pumps rewrite.
- No immediate migration of Heat Pumps rows into generic
  `TableContract` / `field_defs` storage unless Phase 01 rejects the
  native-FK approach.
- No changes to manufacturer, model type, refrigerant, install type, or
  other real single-select vocabularies.
- No changes to `linked_erv_unit_id` unless Phase 01 explicitly decides
  to pull that field into the same native-link UI pattern.
