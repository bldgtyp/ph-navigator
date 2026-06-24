---
DATE: 2026-05-26
TIME: 19:36 EDT
STATUS: Proposed phased implementation roadmap.
AUTHOR: Codex
SCOPE: Delete Project implementation plan bundle.
RELATED:
  - planning/features/delete-project/PRD.md
  - context/PRD.md
  - context/technical-requirements/data-model.md
  - context/technical-requirements/llm-mcp-schema.md
  - context/CODING_STANDARDS.md
---

# Delete Project Implementation Plans

This folder breaks `planning/features/delete-project/PRD.md` into
implementation phases. The PRD is the product contract. These plans
describe execution order, scope boundaries, and verification gates.

## Phase Map

| Phase | Plan | Primary Goal | Exit Signal |
|---|---|---|---|
| 1 | `phase-01-schema-repository-lifecycle.md` | Add lifecycle columns, deleted-aware repository helpers, and delete-count contracts. | Backend can identify active, deleted, and unknown projects without route changes. |
| 2 | `phase-02-rest-soft-delete-restore-410.md` | Ship REST soft-delete, bulk soft-delete, restore, deleted list, and `410 project_deleted`. | API tests prove dashboard list hides deleted projects, deleted reads return 410, restore works. |
| 3 | `phase-03-hard-delete-admin-storage-cleanup.md` | Add admin/dev hard-delete service, R2 prefix cleanup, and script. | Dry-run and hard-delete remove DB rows plus project-owned R2 objects, with retryable partial-failure behavior. |
| 4 | `phase-04-dashboard-bulk-soft-delete-restore.md` | Add dashboard row selection, bulk soft-delete modal, and Recently Deleted restore surface. | Browser can bulk soft-delete projects, restore one, and never exposes hard-delete controls. |
| 5 | `phase-05-mcp-project-delete-restore-hard-delete.md` | Add MCP delete/restore/hard-delete tools under project-scoped token rules. | MCP tests prove soft-delete, restore, hard-delete confirmation, and deleted-project behavior. |

## Resolved Decisions

- Normal dashboard delete is soft-delete only.
- Soft-deleted project reads return `410 Gone` with error code
  `project_deleted`; unknown ids remain `404 project_not_found`.
- Restore is available for 90 days through dashboard/REST and MCP.
- Hard-delete is admin/dev tooling plus MCP only, not normal dashboard
  UX.
- There is no automatic purge job in v1.
- Hard-delete manifests live in `user_action_log.details`; no
  dedicated deletion-run table is required for v1.

## Global Constraints

- Do not mutate `project_versions.body` or `project_version_drafts.body`
  during soft-delete.
- Do not hard-delete by chasing JSON asset references. Hard-delete the
  entire project storage prefix.
- Do not delete global catalog rows. Catalog values copied into project
  documents disappear only because project versions/drafts disappear.
- Keep all active project-scoped routes on the existing access seam,
  but teach that seam to distinguish active, deleted, and unknown
  projects where needed.
- Deleted-aware restore and hard-delete paths must not use active-only
  project lookup helpers.
- Future project-owned tables must either have
  `project_id REFERENCES projects(id) ON DELETE CASCADE` or be added to
  the deletion-count and manifest audit before shipping.

## Verification Ladder

Each phase may add narrower checks, but default completion is:

1. `git diff --check`
2. Backend changes:
   - `cd backend && uv run ruff check .`
   - `cd backend && uv run ty check`
   - targeted `uv run pytest ...`
3. Frontend changes:
   - `cd frontend && pnpm run format`
   - `cd frontend && pnpm test -- --run <targeted tests>`
   - `cd frontend && pnpm run build`
4. Integrated changes:
   - `make test`
   - `make typecheck`
   - `make lint`
   - `make smoke`
5. Browser-visible changes require a local browser/Playwright smoke
   before the phase is complete.

## Progress Ledger

| Phase | Status | Evidence |
|---|---|---|
| 1 | completed | Migration and repository lifecycle helpers implemented; feature-scoped Ruff/Ty pass. |
| 2 | completed | REST soft-delete, bulk-delete, deleted list, restore, and `410 project_deleted` covered by `tests/test_projects.py`. |
| 3 | completed | Hard-delete service, R2 prefix cleanup helper, and `scripts/delete_project.py` implemented; storage cleanup covered by focused backend tests. |
| 4 | completed | Dashboard selection, soft-delete modal, Recently Deleted restore, and deleted-link shell state implemented; Vitest/build/lint plus local browser smoke pass. |
| 5 | completed | MCP soft-delete, restore, and hard-delete tools implemented; focused MCP tests and feature-scoped Ty pass. |
