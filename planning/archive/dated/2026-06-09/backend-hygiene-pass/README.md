---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Complete — all 8 phases merged to main (#13, commit 51dcd77). Archived 2026-06-09.
AUTHOR: Claude (Opus 4.7) per Ed's request, based on
        `planning/code-reviews/2026-06-07/backend-data-structure-review.md`.
SCOPE: Backend-only hygiene pass: schema FK consistency + index, module
       splits, REST style unification, docstring pass on transactional
       services, and a deferred soft-delete unification. No new product
       behavior. Frontend is out of scope.
RELATED:
  - `planning/code-reviews/2026-06-07/backend-data-structure-review.md`
  - `context/CODING_STANDARDS.md` (600-line soft limit, layering rules)
  - `backend/features/project_document/`
  - `backend/features/projects/service.py`
  - `backend/features/mcp/tools.py`
  - `backend/alembic/versions/20260526_0011_project_assets_and_jobs.py`
  - `backend/alembic/versions/20260512_0003_projects.py`
---

# Backend Hygiene Pass

## What this is

A single tracked feature folder for the punch lists in the 2026-06-07
backend data-structure review. The review's headline is that the backend
is in good shape — layer discipline holds, timestamps are timezone-aware,
the error envelope is uniform, gzip + pooling are wired. The findings
collected here are the cheap-now / annoying-later items that the review
asked us to fold into a pre-deploy hygiene pass.

Two of the modules called out have grown since the review was written:

- `backend/features/project_document/document.py` — **1,602 lines**
  (was 1,358 on 2026-06-07; the soft limit is 600).
- `backend/features/mcp/tools.py` — 1,046 lines (unchanged).
- `backend/features/projects/service.py` — 697 lines.

That growth is exactly the failure mode the review flagged. The split
phases below are higher priority for that reason.

## Phase map

Read phases in numeric order. Phases 1–5 are the "do now" pre-deploy
pass; phases 6–8 are the "do next" sprint hygiene. Phases are mostly
independent — only Phase 2 should land before Phase 5, because Phase 5's
file split assumes the `empty_project_document` extraction is already
done. Phase 8 is intentionally last; it is the only one that touches a
user-facing model.

| # | File | Bucket | Effort | Touches |
|---|------|--------|--------|---------|
| 1 | `phases/phase-01-schema-audit-fks.md` | Now | ~30 min | one Alembic migration |
| 2 | `phases/phase-02-extract-empty-document.md` | Now | ~30 min | `projects/service.py`, new `project_document/templates.py` |
| 3 | `phases/phase-03-rest-action-style.md` | Now | ~30 min | `projects/routes.py`, `assets/routes.py`, `backend/README.md` |
| 4 | `phases/phase-04-service-docstrings.md` | Now | ~45 min | `auth/service.py`, `projects/service.py`, `catalogs/materials/service.py`, `assets/service.py` |
| 5 | `phases/phase-05-user-table-views-decision.md` | Now | ~5 min | migration 0010 comment OR new column migration |
| 6 | `phases/phase-06-split-document-models.md` | Soon | ~2–3 h | `project_document/document.py` → multi-file split |
| 7 | `phases/phase-07-split-mcp-tools.md` | Soon | ~1 h | `mcp/tools.py` → `mcp/tools/` package |
| 8 | `phases/phase-08-unify-soft-delete.md` | Soon | ~1–2 h | `users` table, `auth` repo, one migration |

Total: ~2.5 h for Now (phases 1–5), ~5 h for Soon (phases 6–8).

## Out of scope

These review items are explicitly **not** in this plan:

- **Pagination on catalog list endpoints** — review section 4 marks this
  Watch; trigger is "any catalog over 1,000 rows". Track in the
  Materials Catalog PRD. Carried over from 2026-06-04.
- **Auth pipeline SQL round-trips** — review section 4 marks this Watch;
  trigger is real measured contention. See `planning/features/auth-session-perf/`.
- **`assets/service.py` (716) and `mcp/server.py` (713)** — at the soft
  limit but not over it. Review section 1d says "leave alone, look for a
  seam next time you're in either". No phase scheduled.
- **`project_document/formula/evaluator.py` (857)**,
  **`mutations/type_conversion.py` (626)**, **`tables/rooms.py` (571)**
  — all over the soft limit but were not called out in the review's
  prioritised list. Note them in `STATUS.md` under "follow-ups"; do not
  split speculatively in this pass.
- **`project_version_drafts` audit columns** — review section 2.5 says
  "flag, don't fix" until concurrent multi-user draft editing becomes a
  real feature. Captured as a Watch item; no phase.

## Verification

Every phase must end with the project's standard closeout gate:

1. `make format` from repo root
2. `make ci` from repo root (must be green before reporting done)

Phase-specific verification (migration tests, route smoke tests,
docstring lint where applicable) is called out per-phase.

## Status

See `STATUS.md`.
