---
DATE: 2026-08-03
TIME: 16:06 EDT
STATUS: Complete
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

## Completion evidence

- Attach/detach now obtains the live raw row through
  `find_attachment_row`; the duplicate `features.assets.downloads.find_row`
  implementation and legacy walker wrappers are removed.
- Live-row mutation is pinned for contract-backed pumps, unregistered project
  frames, and nested assembly segments.
- API coverage preserves `404 document_row_not_found` for a missing target row.
- Focused registry/reachability/service/envelope suite: `84 passed`.
- Focused Ruff and ty checks: passed.
- `make format`: passed.
- `make ci`: passed (`1828` backend tests passed, `7` skipped; `2396` frontend
  tests passed across `263` files; production build passed).
- `graphify update .`: completed with no tracked graph delta.
- `simplify`: passed; lazy iteration fix applied.
- `docs-pass`: stable storage and attachment-security docs updated.
