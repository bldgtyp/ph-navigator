---
DATE: 2026-06-21
TIME: 10:20 EDT
STATUS: Deferred
AUTHOR: Claude (for Ed May)
SCOPE: Deferred evaluation items left over from the shipped v1 Table CSV
       Download feature (parent-level DataTable "Download CSV" affordance).
RELATED:
  - planning/archive/dated/2026-06-21/table-csv-download/PRD.md (§6 Open questions, §5 Non-goals)
  - context/technical-requirements/data-table.md (§ Download CSV)
  - frontend/src/shared/ui/data-table/lib/export/csv.ts
---

# Table CSV Download — Follow-ups

The v1 **Table CSV Download** feature shipped (archived at
[`planning/archive/dated/2026-06-21/table-csv-download/`](../../archive/dated/2026-06-21/table-csv-download/README.md)):
every DataTable exposes a built-in "Download CSV" overflow item that exports
the current view as RFC-4180 / UTF-8-BOM CSV, with single-select labels,
formula text, and active-system number-units values.

This folder collects the items intentionally deferred out of v1 scope, for
later evaluation against real usage. None are blocking; each shipped with a
safe v1 default. See `PRD.md` for the per-item contract and `STATUS.md` for
the current call on each.

## Read order

1. `PRD.md` — the deferred items, each with its v1 default and the
   alternative to evaluate.
2. `STATUS.md` — current disposition and the trigger that would promote each
   item into active work.
