---
DATE: 2026-07-20
TIME: 17:50 EDT
STATUS: Active
AUTHOR: Claude with Ed May
SCOPE: Current state of the modal-consistency refactor.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./CATALOG.md
---

# Status — Modal Consistency Refactor

**State:** Planning complete. No implementation started. No app code changed.

## Done

- Static audit of all ~50 modal components (58 instances) via 9-agent fan-out →
  `CATALOG.md`.
- Three-tier conformance model + recurring-defect quantification → `PRD.md`.
- Modal contract **ratified by Ed 2026-07-20**: canonical footer Cancel / drop
  header Close; footer always `DialogActions`; specific labels; shared box with
  resize handle when oversized; backdrop-click off for forms / on for viewers.
- Phased plan → `PLAN.md`.

## Next step

Phase 00 (shared-component upgrades) — **unblocked, ready to start.** Both
former blockers are decided (see `decisions.md` D-2, D-3).

## Blockers / decisions

None outstanding. Contract ratified (D-1); multi-action footer shape decided
(D-2, `extraActions` slot); Radix family disposition decided (D-3, keep + conform).

## Verification approach

Static audit only so far. Implementation phases each add: focused RTL tests for
touched modals, `make format`, `make ci` for substantial phases, and a live
browser screenshot (`agent-browser.mjs`) of each touched modal checked against
the contract. Reachability varies (some modals need selected rows / admin /
draft state) — screenshot the reachable ones, code-verify the rest.

## Notes

- `working/modal-consistency-catalog.md` was the scratch draft; the tracked copy
  is `CATALOG.md` here. The scratch copy can be deleted.
