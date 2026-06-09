---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Active — plan drafted, no phases started.
AUTHOR: Claude (Opus 4.7)
RELATED: `README.md`, `PRD.md`
---

# Status — Backend Hygiene Pass

## Current state

Plan drafted from `planning/code-reviews/2026-06-07/backend-data-structure-review.md`.
No code changes yet.

Verified line counts at planning time (2026-06-09):

```
1602 backend/features/project_document/document.py
1046 backend/features/mcp/tools.py
 716 backend/features/assets/service.py
 713 backend/features/mcp/server.py
 697 backend/features/projects/service.py
 857 backend/features/project_document/formula/evaluator.py
 626 backend/features/project_document/mutations/type_conversion.py
 571 backend/features/project_document/tables/rooms.py
```

`document.py` has grown from 1,358 → 1,602 lines since the review was
written; Phase 6 is correspondingly more valuable.

## Phase ledger

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Schema housekeeping migration | Not started | Single Alembic migration |
| 2 | Extract `empty_project_document` | Not started | Prereq for Phase 6 |
| 3 | REST action-URL style | Not started | Pick the style at phase start |
| 4 | Service docstring pass | Not started | Independent |
| 5 | `user_table_views` decision | Not started | Doc-only or new migration |
| 6 | Split `project_document/document.py` | Not started | Largest phase; depends on Phase 2 |
| 7 | Split `mcp/tools.py` by family | Not started | Independent |
| 8 | Unify `users.is_active` → `deleted_at` | Not started | Last; touches auth |

## Next step

Execute Phase 1 (`phases/phase-01-schema-audit-fks.md`). Lowest risk,
single migration, sets the pattern for treating this as a sequence of
small green-CI commits.

## Blockers

None.

## Verification status

No phase has been verified yet. Closeout gate (`make format`,
`make ci`) is required at the end of each phase.

## Follow-ups (out of this pass)

These were identified during planning but are not in scope:

- `project_document/formula/evaluator.py` (857), `mutations/type_conversion.py`
  (626), `tables/rooms.py` (571) all exceed the 600-line soft limit but
  were not in the review's prioritised list. Reconsider after Phase 6
  lands.
- Pagination on catalog list endpoints (watch — Materials Catalog PRD).
- Auth pipeline SQL round-trip consolidation
  (`planning/features/auth-session-perf/`).
- `project_version_drafts` audit columns (watch — multi-user drafts).
- `assets/service.py` and `mcp/server.py` seam-look on next visit.
