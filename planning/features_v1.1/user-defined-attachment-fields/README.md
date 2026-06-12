---
DATE: 2026-06-12
TIME: 17:05 EDT
STATUS: Deferred
AUTHOR: Codex
SCOPE: Router for the v1.1 candidate to allow user-defined attachment fields in DataTables.
RELATED:
  - PRD.md
  - STATUS.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/attachments.md
  - planning/features/attachments/phases/phase-05-polish-v11-candidates.md
---

# User-Defined Attachment Fields

## Read Order

1. `STATUS.md` for the current deferred state and revisit trigger.
2. `PRD.md` for the feature outline, constraints, and implementation scope.
3. `context/technical-requirements/data-table.md` and
   `context/technical-requirements/attachments.md` for the current v1
   contract.

## Summary

Current v1 DataTables support hard-coded PHN attachment fields, but user
created fields cannot use `attachment` as a field type. This v1.1
candidate tracks the work needed to make attachment columns
user-authorable without breaking asset lifecycle, versioning, bulk
download, MCP, or document validation.

