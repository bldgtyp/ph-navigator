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
  - PLAN.md
  - phases/phase-01-backend-external-id.md
  - phases/phase-02-backend-import-pipeline.md
  - phases/phase-03-frontend-overflow-menu.md
  - phases/phase-04-verification-docs.md
  - ../materials-catalog-datatable/PRD.md
---

# Materials Catalog — JSON Import / Export

Adds **Export JSON** (download / backup) and **Import JSON…**
(upload / seed / restore / bulk-extend) to the Materials Catalog
page. Both actions live behind the DataTable toolbar's "More view
actions" overflow popover.

## Read order

1. `PRD.md` — product contract, file format, behavior.
2. `STATUS.md` — current state and next step.
3. `PLAN.md` — sequencing rationale, branching, phase map.
4. `phases/phase-01-backend-external-id.md`
5. `phases/phase-02-backend-import-pipeline.md`
6. `phases/phase-03-frontend-overflow-menu.md`
7. `phases/phase-04-verification-docs.md`

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
