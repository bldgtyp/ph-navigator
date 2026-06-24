---
DATE: 2026-06-24
TIME: 11:30 EDT
STATUS: Complete
AUTHOR: Claude
SCOPE: Product and data contract for extending the built-in `status` field to the three remaining Datasheet-bearing tables.
RELATED: planning/archive/data-table-status-field-addendum/README.md, planning/archive/data-table-status-field-addendum/PLAN.md, planning/archive/data-table-status-field/PRD.md
---

# PRD — DataTable Status Field Addendum

## Goal

Bring the built-in `Status` single-select to the three Datasheet-bearing
DataTable records the original refactor deferred, so that **every table with a
`Datasheet` slot reports documentation completeness** for the future splash-page
dashboard.

## Field contract (identical to the original)

No new contract is introduced. The three new tables adopt the exact field from
`backend/features/project_document/tables/_status_field.py`:

- Field key: `status`; display name: `Status`; type: `single_select`;
  origin: `built_in`.
- Storage: row `custom_values.status` (not a typed Pydantic column).
- Option list under the namespaced key `<table_label>.status`.
- Options, in order: `Complete` (`opt_status_complete`), `Needed`
  (`opt_status_needed`), `Question` (`opt_status_question`), `N/A`
  (`opt_status_na`).
- Default for new rows: `opt_status_needed` ("Needed").
- Colors mirror the Materials / report-status palette (`--report-status-*`).

## Tables in scope

| Surface | Backend table key / validation label | FieldDef source |
|---|---|---|
| Ventilators | `ventilators` | `VENTILATORS_BUILT_IN_FIELD_DEFS` |
| Heat-Pump Outdoor Units | `equipment.heat_pumps.outdoor_units` / `heat_pumps_outdoor_units` | `OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS` |
| Heat-Pump Indoor Units | `equipment.heat_pumps.indoor_units` / `heat_pumps_indoor_units` | `INDOOR_UNITS_BUILT_IN_FIELD_DEFS` |

After this change, `STATUS_TABLE_NAMES` grows from 9 to 12 entries.

## Explicit Non-Goal reversal

The original PRD listed these tables as Non-Goals:

> Do not add `status` to … Ventilators … or Heat Pump unit-instance tables.
> Heat Pump Outdoor Units and Indoor Units remain out of scope.

**This addendum intentionally reverses that decision.** The original split
Heat-Pump *Equipment* leaves (got `status`) from *Unit* leaves (excluded) and
left Ventilators out. The corrected rule is simpler and Datasheet-driven: any
DataTable-backed table that has a `Datasheet` field carries `status`. The
Equipment-vs-Units distinction is not a reason to withhold `status`.

## Acceptance criteria

- New empty projects include the built-in `status` FieldDef for `ventilators`,
  `heat_pumps_outdoor_units`, and `heat_pumps_indoor_units`, each with its
  namespaced `<table_label>.status` option list.
- `STATUS_TABLE_NAMES` contains all 12 tables and the drift-guard test asserts it
  equals the registry contracts that actually carry the status FieldDef.
- The field is editable through the existing single-select cell path on each
  table's DataTable — no table-specific render fork.
- Seeded rows for the three tables carry `custom_values.status`, distributing all
  four statuses so the local dev project visibly exercises them.
- Backend validation rejects unknown status option ids via the existing
  single-select `coerce_custom_value` path (HTTP 422).
- `status` participates in filter, sort, group, CSV/export, and row-detail
  behavior through shared DataTable machinery on all three tables.
- New rows default to `Needed`; duplicate preserves `status`.
- Local dev DB is reset and reseeded with the repo-owned pipeline after
  implementation.
- The nine originally-covered tables are behaviorally unchanged.

## Non-goals (unchanged)

- Do not build the splash-page dashboard here.
- Do not add `status` to Rooms, Space Types, Apertures, or Envelope
  assemblies/Materials.
- Do not replace Envelope/Materials `specification_status` with this field.
- Do not rename the existing Materials `Missing` label.

## Decisions (resolved on the original feature's precedent)

1. **Ventilator row modal — inline column only.** `Status` is exposed as the
   parent-owned inline DataTable column (per the DataTable-uniformity rule);
   `VentilatorRowModal` was **not** modified.
2. **Backfill — new/seeded documents only.** No migration for pre-existing
   persisted documents; the three new fields land on new/seeded documents and
   the local dev reset/reseed. (Same scope as the original feature.)

Ed approved proceeding on both.
