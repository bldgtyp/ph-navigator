---
DATE: 2026-08-03
TIME: 15:17 EDT
STATUS: Pending
AUTHOR: Codex
SCOPE: Make attach/detach mutation use the same table adapters as reference
  traversal.
RELATED:
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 02 — Mutation unification

## Work

1. Expose adapter-backed row lookup that returns the live raw row for mutation.
2. Route attach/detach through that lookup.
3. Remove the duplicate assembly/direct lookup from asset downloads.
4. Prove ordinary and irregular rows mutate through the shared authority and
   preserve the existing `document_row_not_found` error.

## Exit checks

- Focused asset service and adapter tests pass.
- `simplify`, `docs-pass`, formatting, and applicable backend checks pass.
