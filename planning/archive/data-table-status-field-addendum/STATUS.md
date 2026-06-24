---
DATE: 2026-06-24
TIME: 11:30 EDT
STATUS: Complete
AUTHOR: Claude
SCOPE: Current status for the DataTable Status Field addendum packet.
RELATED: planning/archive/data-table-status-field-addendum/README.md, planning/archive/data-table-status-field-addendum/PLAN.md
---

# Status — DataTable Status Field Addendum

## Current state

State: **Complete** — all five phases done, verified, and committed as
`d8b59f28` on branch `data-table-status-field-addendum` (not yet merged to
main). Built as an addendum to the completed-and-archived
`data-table-status-field` feature; this packet is archived.

Implemented:
- **Backend** — `STATUS_TABLE_NAMES` now lists 12 tables; `ventilators.py`
  mirrors `fans.py` (status FieldDef + slice option + response/diff emission);
  `heat_pumps.py` unit leaves converted from `NoBuiltInOptions` to
  status-bearing (the orphaned `NoBuiltInOptions` class removed); units replace
  requests now require `single_select_options` (uniform with equip);
  `document.py` carries `VENTILATOR_STATUS_OPTION_KEY`; `templates.py`
  auto-seeds all 12 via `STATUS_TABLE_NAMES`; seeds distribute the four statuses.
- **Frontend** — Ventilators gets `statusColumn` inline + `buildEmptyVentilatorRow`
  default + `VENTILATOR_CUSTOM_VALUE_FIELD_KEYS`/compat/clone wiring; the two HP
  unit column files add `statusFieldDef`/`statusColumnDef`; unit row-builders
  apply `withStatusDefault`; live tables pass `slice.single_select_options`.
- **Tests** — ventilators + HP-units status round-trip tests, drift guard at 12,
  three frontend status-render tests; existing fixtures/tests updated for the
  now-required ventilator/unit status options.

Verification (all green): `make check-backend` (1063+ passed), full frontend
`vitest` (197 files / 1889 passed), `make frontend-dev-check` (format/lint/tsc/
build). Live: `make db-reset-dev` + reseed (`database ok`); API smoke shows
`status` FieldDef + 4 options + seeded values on `ventilators`,
`heat_pumps_outdoor_units`, `heat_pumps_indoor_units`; live PUT round-trip
persisted across reload; Ventilators Status column renders in-browser with all
four colored pill values + aggregation footer. HP units verified via API smoke +
new render tests + shared-path parity (browser tab-switch not exercised due to a
displaced-session read-only state; not a code issue).

Reconnaissance is done and confirms the request precisely. A `datasheet`-field
audit of `backend/features/project_document/tables/` shows exactly three
Datasheet-bearing tables still lack `status`: `ventilators`,
`heat_pumps_outdoor_units`, `heat_pumps_indoor_units` — the same three Ed named.
All required machinery (the `_status_field.py` helper, the `<table>.status`
option-key namespace, the frontend `lib/statusColumn.ts` and
`heat-pumps/status-column.ts` helpers, the `STATUS_TABLE_NAMES` drift guard, the
reset/reseed pipeline) already exists from the original feature; this packet adds
three tables to that proven path with no new abstractions.

Verified facts driving the plan:
- `VentilatorsTable.tsx` builds its `columns` array exactly like `PumpsTable.tsx`
  (just without `statusColumn`), so the ventilator column is a one-line insert.
- `ventilators.py` already carries a built-in single-select (`inside_outside`),
  so `pumps.py` (`device_type` + `status`) is the right copy source.
- `heat_pumps.py` unit leaves are `NoBuiltInOptions` today; the equip leaves
  (`OutdoorEquipOptions` / `IndoorEquipOptions`) are the template to mirror, and
  the generic `_read/_set_status_aware_option_value` seam is already wired.
- `heat-pumps/status-column.ts` (`statusFieldDef` / `statusColumnDef`) is already
  leaf-agnostic; the unit column files just need to call it like the equip files.

## Next step

None for this packet. The only remaining git step is merging branch
`data-table-status-field-addendum` to main (the user's call). The deferred
backfill of pre-existing documents is tracked separately in
`planning/features/datatable-status-backfill/`.

## Open questions

Both resolved on the original feature's precedent (Ed approved proceeding):

1. Ventilator row modal — **inline column only**; `VentilatorRowModal` was not
   modified (matches the DataTable-uniformity rule).
2. Backfill — **new/seeded documents only**; no migration for existing persisted
   documents. The deferred backfill decision (all 12 status tables) is tracked
   separately in `planning/features/datatable-status-backfill/`.

## Verification

- `make check-backend` green (1063+ passed); drift-guard test green at 12 tables.
- Full frontend `vitest` green (197 files / 1889 passed); `make
  frontend-dev-check` green (format/lint/tsc/build).
- Live `make db-reset-dev` + reseed (`database ok`); API smoke (as
  `ed@example.com`) shows `status` FieldDef + 4 options + seeded values on
  `ventilators`, `heat_pumps_outdoor_units`, `heat_pumps_indoor_units`; live PUT
  round-trip persisted across reload; Ventilators Status column renders in-browser
  with all four pill values + aggregation footer.
- `make ci` to be run as the final closeout gate.
