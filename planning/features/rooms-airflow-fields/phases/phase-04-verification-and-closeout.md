---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Final verification and documentation closeout for Rooms airflow fields.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 04 - Verification And Closeout

## Goal

Prove the feature works end to end, record evidence, and leave durable docs in
the right places.

## Tasks

- Run focused backend tests for Rooms defaults, stale-document compatibility,
  null round-trip, and schema/fingerprint drift.
- Run focused frontend tests for Rooms/DataTable unit display and clearing.
- Run `make frontend-dev-check` if changes are frontend-visible.
- Browser smoke Spaces / Rooms at `http://localhost:5173` against
  `http://localhost:8000` using `codex@example.com`:
  - fields visible,
  - blank values blank,
  - SI/IP unit switch changes header/display,
  - edit/save/refetch preserves canonical value,
  - clear/save/refetch returns blank.
- Run full `make ci` before marking complete unless Ed scopes closeout down.
- Run `graphify update .` after code changes.
- Run `simplify` and `docs-pass` at closeout if this becomes a full
  implementation run.
- Update `context/technical-requirements/data-table.md` only if this introduces
  a durable new contract beyond existing number-units behavior.

## Completion Criteria

- `STATUS.md` contains exact commands run and results.
- PRD acceptance criteria are checked off or explicitly deferred.
- Any compatibility decision is recorded with rationale.
- No unrelated worktree changes are included.
