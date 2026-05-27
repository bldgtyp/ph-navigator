---
DATE: 2026-05-26
TIME: 19:36 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: REST project lifecycle endpoints, soft-delete, restore, deleted
       list, and `410 project_deleted` behavior.
RELATED:
  - docs/features/delete-project-prd.md
  - docs/plans/2026-05-26/delete-project/phase-01-schema-repository-lifecycle.md
  - backend/features/projects/routes.py
  - backend/features/projects/access.py
  - backend/features/projects/service.py
  - backend/features/auth/repository.py
---

# Phase 2 - REST Soft-Delete, Restore, And 410

## Goal

Expose the normal project lifecycle API. After this phase, editors can
soft-delete projects, bulk soft-delete projects, list recently deleted
projects, and restore deleted projects. Direct reads for a known
soft-deleted project return `410 project_deleted`; unknown ids remain
`404 project_not_found`.

## In Scope

- `POST /api/v1/projects/{project_id}:delete`
  - soft-delete only;
  - requires editor auth;
  - idempotent for already-deleted projects;
  - returns delete timestamp, `hard_delete_after`, and child counts.
- `POST /api/v1/projects:bulk-delete`
  - soft-delete only;
  - per-item success/error response;
  - partial failure allowed and structured.
- `GET /api/v1/projects/deleted`
  - returns current user's soft-deleted dashboard projects;
  - includes child counts and `hard_delete_after`.
- `POST /api/v1/projects/{project_id}:restore`
  - deleted-aware route;
  - requires editor auth;
  - rejects restore after the 90-day window.
- Update normal project access behavior:
  - active project routes still work;
  - known soft-deleted projects return HTTP `410 Gone` with
    `error_code = project_deleted`;
  - unknown ids return `404 project_not_found`.
- Audit events:
  - `project_soft_delete`;
  - `project_restore`.

## Out Of Scope

- Hard-delete.
- Dashboard checkbox UX.
- MCP tools.
- Automatic purge jobs.

## Constraints

- Keep the dashboard list query active-only.
- Do not expose hard-delete on the normal REST/dashboard API.
- Deleted-aware routes must not rely on `require_project_access` until
  after they resolve the deleted project.
- Preserve public-readable active project URLs.

## Workstreams

### Service Layer

Add service functions that own:

- permission checks;
- deleted-aware lookup;
- 90-day restore-window policy;
- idempotency policy;
- audit logging;
- response shaping.

### Access Seam

Teach the project access seam enough lifecycle awareness to return 410
for deleted projects without spreading inline lifecycle checks across
routes.

### Structured Errors

Add or reuse the common API error helper for:

- `project_deleted` with recoverability `restore`;
- `project_restore_expired`;
- `project_delete_confirmation_required`;
- `project_not_found`.

If the current error envelope has no `recoverability`, include it in
`details` rather than widening the global contract in this phase.

## Tests

Add or extend backend tests for:

- soft-delete hides a project from `GET /api/v1/projects`;
- direct `GET /api/v1/projects/{id}` returns `410 project_deleted`;
- unknown id still returns 404;
- bulk soft-delete succeeds for multiple projects and reports per-item
  deleted/already-deleted/not-found states;
- restore clears lifecycle fields and makes the project visible again;
- restore after `hard_delete_after` fails;
- public viewer reads get 410 for deleted projects;
- audit rows are written for soft-delete and restore.

Suggested commands:

```bash
cd backend
uv run pytest tests/test_projects.py
uv run pytest tests/test_mcp.py
```

## Success Criteria

1. REST lifecycle endpoints are implemented and tested.
2. Active project behavior is unchanged.
3. Deleted project reads produce `410 project_deleted` consistently.
4. Restore works without touching project-document JSON.
