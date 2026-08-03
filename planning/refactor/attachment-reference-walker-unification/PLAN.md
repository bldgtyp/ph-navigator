---
DATE: 2026-08-03
TIME: 15:17 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Unify project-document attachment row traversal and lookup behind one
  contract-derived adapter registry.
RELATED:
  - ./STATUS.md
  - ../../../context/DATA_STORAGE.md
  - ../../../context/technical-requirements/attachments.md
---

# Plan — Attachment reference walker unification

## Constraints

- `ATTACHMENT_FIELDS` remains the closed security allowlist. Adapter discovery
  must not make a field or table anonymously readable.
- Ordinary project-document tables take their persisted path from
  `TableContract`; adding a contract-backed attachment table must not require a
  walker branch.
- `project_frames`, `project_glazings`, and nested `assembly_segments` keep
  explicit adapters because their document shapes are not ordinary direct
  contract paths.
- Bare row lists and `{field_defs, rows}` envelopes remain readable.

## Phases

| Phase | Scope | Status |
| --- | --- | --- |
| 01 | Contract-derived adapter authority and irregular adapters | Complete |
| 02 | Shared mutation row lookup and duplicate-code removal | Next |
| 03 | Full verification, stable docs, and archive closeout | Pending |

## Required verification

- Focused registry/reachability tests cover all registered attachment fields,
  contract path derivation, irregular adapters, and both accepted row shapes.
- Asset service tests prove attach/detach mutation uses the shared adapters.
- Anonymous reads, reference validation, orphan protection, and bulk download
  remain driven exclusively by `list_asset_references` plus
  `ATTACHMENT_FIELDS`.
- `make format` and `make ci` pass before closeout.
