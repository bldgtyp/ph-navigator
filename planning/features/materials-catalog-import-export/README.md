---
DATE: 2026-06-03
TIME: 21:15 EDT
STATUS: Active — PRD locked; open questions resolved; ready for
        phased implementation plan.
AUTHOR: Claude (Opus 4.7)
SCOPE: Materials Catalog JSON import (upload) and JSON export
       (download), surfaced through the DataTable "More view
       actions" overflow menu.
RELATED:
  - PRD.md
  - STATUS.md
  - ../materials-catalog-datatable/PRD.md
---

# Materials Catalog — JSON Import / Export

Adds **Export JSON** (download / backup) and **Import JSON…**
(upload / seed / restore / bulk-extend) to the Materials Catalog
page. Both actions live behind the DataTable toolbar's "More view
actions" overflow popover.

## Read order

1. `PRD.md` — product contract, file format, behavior, open
   questions.
2. `STATUS.md` — current state and next step.
3. Phased plan (`PLAN.md` / `phases/`) — created **after** user
   stories are agreed.

## Scope

- **In**: JSON download of the current catalog; JSON upload with a
  dry-run preview, dedup by stable `external_id`, **Skip-matches**
  conflict behavior (MVP), schema-version upgrade chain that
  converts what it can and blanks what it can't, single-transaction
  commit through a new backend `import/preview` + `import/commit`
  endpoint pair (reusable from a future MCP / CLI caller).
- **Out**: CSV in/out; import/export for Frame / Glazing catalogs;
  field-definition import; attachments / binaries; background or
  scheduled imports; semantic single-undo of a completed import.
