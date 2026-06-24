---
DATE: 2026-06-21
TIME: 10:20 EDT
STATUS: Deferred
AUTHOR: Claude (for Ed May)
SCOPE: Disposition ledger for the Table CSV Download follow-up items.
RELATED: ./README.md, ./PRD.md
---

# STATUS — Table CSV Download Follow-ups

## State

`Deferred` — the parent feature shipped in v1 (archived at
`planning/archive/dated/2026-06-21/table-csv-download/`). Everything here is optional; each
item has a safe v1 default in place.

## Disposition

| Item | v1 default | Promote when |
|---|---|---|
| F1 — formula-error cells | `""` | A user reports needing error text visible in an export (e.g. debugging a formula column). |
| F2 — `linked_record` id columns | export accessor output (ids for `accessorValue:"ids"`) | A production table mounts an id-accessor linked column whose export is unreadable. Verify any such column exists first — may be moot. |
| F3 — catalog Export label reconciliation | JSON export + CSV download coexist | Real user confusion between the two catalog menu items is observed. |
| Non-goals (timestamps, project/version filename, CSV-injection, XLSX) | not implemented | A concrete workflow needs one — see PRD § "Explicit v1 non-goals". |

## Next step

None scheduled. Re-evaluate this folder when one of the "Promote when"
triggers above is actually hit; otherwise leave deferred.

## Blockers

None.
