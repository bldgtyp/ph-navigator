---
DATE: 2026-06-24
TIME: 00:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Product and data contract for DataTable record status tracking.
RELATED: planning/archive/data-table-status-field/README.md, planning/archive/data-table-status-field/PLAN.md
---

# PRD - DataTable Status Field

## Goal

Each targeted DataTable row has a first-class built-in `Status` field so the future splash-page dashboard can report how much of the project record set is complete, still needed, blocked by a question, or intentionally not applicable.

## Field Contract

- Field key: `status`
- Display name: `Status`
- Type: `single_select`
- Origin: `built_in`
- Storage: row `custom_values.status`, not a new typed Pydantic row column.
- Default: `opt_status_needed`
- Option labels, in order:
  - `Complete`
  - `Needed`
  - `Question`
  - `N/A`

## Option Contract

Use the same semantic palette as Envelope / Materials status:

| New option | Existing Materials semantic | Proposed id | Meaning |
|---|---|---|---|
| Complete | `complete` | `opt_status_complete` | Record has all required data / documentation for dashboard accounting. |
| Needed | `missing` | `opt_status_needed` | Work remains; this replaces the Materials label `Missing` for these DataTable records. |
| Question | `question` | `opt_status_question` | Record needs a decision or clarification. |
| N/A | `na` | `opt_status_na` | Record intentionally does not apply or should not count as remaining work. |

Implementation note: the user-facing label is `Needed`, but visual color should map to the existing Materials `missing` color token / semantic because this is the same incomplete-work state with a better dashboard label.

## Tables In Scope

| Surface | Backend table key / path | FieldDef source |
|---|---|---|
| Thermal Bridges | `thermal_bridges` | `THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS` |
| Heat Pumps: Outdoor Equipment | `equipment.heat_pumps.outdoor_equip` / `heat_pumps_outdoor_equip` | `OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS` |
| Heat Pumps: Indoor Equipment | `equipment.heat_pumps.indoor_equip` / `heat_pumps_indoor_equip` | `INDOOR_EQUIP_BUILT_IN_FIELD_DEFS` |
| Pumps | `equipment.pumps` / `pumps` | `PUMPS_BUILT_IN_FIELD_DEFS` |
| Fans | `equipment.fans` / `fans` | `FANS_BUILT_IN_FIELD_DEFS` |
| Hot Water Heaters | `equipment.hot_water_heaters` / `hot_water_heaters` | `HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS` |
| Hot Water Tanks | `equipment.hot_water_tanks` / `hot_water_tanks` | `HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS` |
| Electric Heaters | `equipment.electric_heaters` / `electric_heaters` | `ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS` |
| Appliances | `equipment.appliances` / `appliances` | `APPLIANCES_BUILT_IN_FIELD_DEFS` |

## Acceptance Criteria

- New empty projects include built-in `status` FieldDefs for all in-scope tables.
- The built-in field is editable in the existing DataTable single-select cell path.
- Each in-scope table exposes a namespaced status option list, e.g. `pumps.status`, `thermal_bridges.status`, `heat_pumps_outdoor_equip.status`.
- Seeded rows carry `custom_values.status` so the local dev project visibly exercises all four statuses across the target tables.
- Validation rejects unknown status option ids through the existing single-select option validation.
- The field participates in filter, sort, group, CSV/export, and row-detail behavior through shared DataTable machinery without table-specific UI forks.
- Heat Pump Outdoor Equipment and Indoor Equipment receive the field; Heat Pump Outdoor Units and Indoor Units remain out of scope.
- Local dev DB is reset and reseeded after implementation with the repo-owned reset pipeline.

## Non-Goals

- Do not build the splash-page dashboard in this refactor.
- Do not add `status` to Rooms, Space Types, Ventilators, Apertures, Envelope assemblies, or Heat Pump unit-instance tables.
- Do not replace Envelope / Materials `specification_status` with this DataTable field.
- Do not rename the existing Materials `Missing` label during this work.
