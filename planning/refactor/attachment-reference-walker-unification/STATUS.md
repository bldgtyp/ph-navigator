---
DATE: 2026-08-03
TIME: 11:13 EDT
STATUS: Deferred — scoped follow-up; no implementation started
AUTHOR: Codex with Ed May
SCOPE: Remove hand-maintained attachment row traversal without losing support
  for irregular project-document tables.
RELATED:
  - ../../../context/DATA_STORAGE.md
  - ../../archive/dated/2026-08-03/public-attachment-access/STATUS.md
---

# Status — Attachment reference walker unification

## Why this exists

`iter_rows_for_raw_tables` is a guarded hand-written mapping. It now tolerates
both bare lists and `{field_defs, rows}` envelopes, but adding a document table
or changing its shape still requires manual synchronization. Attach/detach also
has a separate row-lookup path in `features.assets.downloads.find_row`.

## Deferred scope

1. Derive direct-table mappings where a project-document `TableContract`
   already owns the table path.
2. Add contracts or explicit adapters for unregistered `project_frames` and
   `project_glazings`; give the registered, nested `assembly_segments` path an
   explicit flattening adapter.
3. Consolidate read/reference traversal and mutation row lookup behind one
   tested adapter contract without widening anonymous asset access.
4. Preserve the schema-derived registration/reachability guards and the
   list/envelope shape pin introduced by Public Attachment Access.

## Done when

- Adding a contract-backed attachment table requires no new walker branch.
- Irregular-table adapters are explicit and independently tested.
- Anonymous reads, reference validation, orphan protection, bulk download, and
  attach/detach share the same table-shape authority.

No work is authorized in this packet; it is the durable follow-up for the next
time attachment traversal or table contracts change.
