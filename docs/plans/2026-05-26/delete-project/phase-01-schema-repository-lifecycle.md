---
DATE: 2026-05-26
TIME: 19:36 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Project lifecycle schema, repository helpers, and deletion-count
       contracts.
RELATED:
  - docs/features/delete-project-prd.md
  - docs/plans/2026-05-26/delete-project/README.md
  - context/technical-requirements/data-model.md
  - backend/features/projects/
  - backend/alembic/versions/
---

# Phase 1 - Schema And Repository Lifecycle

## Goal

Build the backend foundation for project deletion without exposing any
new route, UI, or MCP behavior yet. After this phase, backend code can
distinguish active, soft-deleted, and unknown projects; collect child
counts; and prepare hard-delete manifests.

## In Scope

- Alembic migration adding to `projects`:
  - `deleted_by UUID NULL REFERENCES users(id) ON DELETE SET NULL`;
  - `hard_delete_after TIMESTAMPTZ NULL`.
- Optional supporting index for deleted dashboard lookup, for example
  owner plus deleted timestamp.
- Pydantic models in `backend/features/projects/models.py` for:
  - project lifecycle/deleted metadata;
  - delete request;
  - delete response item;
  - bulk delete response;
  - deleted-project list response;
  - child-count summary;
  - hard-delete storage summary placeholder.
- Repository helpers in `backend/features/projects/repository.py`:
  - `get_project_by_id_including_deleted`;
  - `get_project_lifecycle_by_id`;
  - `list_deleted_projects_for_owner`;
  - `soft_delete_project`;
  - `restore_project`;
  - `project_delete_counts`;
  - `project_storage_manifest`;
  - hard-delete row delete helper, without calling it from routes yet.
- Count all current project-owned tables:
  - `project_versions`;
  - `project_version_drafts`;
  - `project_status_items`;
  - `mcp_tokens`;
  - `user_table_views`;
  - `project_assets`;
  - `project_jobs`.
- Document in code comments or tests that `user_action_log` is not a
  child table and is intentionally retained.

## Out Of Scope

- REST routes.
- Dashboard UI.
- MCP tools.
- R2 prefix deletion.
- Physical hard-delete execution.

## Constraints

- Preserve the existing `bt_number` unique behavior. Soft-deleted
  projects keep their BT numbers reserved.
- Do not change project-document JSON schema in this phase.
- Do not add a `project_deletion_runs` table; v1 uses
  `user_action_log.details`.
- Repository helpers should be narrow raw SQL functions, matching the
  existing project repository style.

## Workstreams

### Migration

Add a migration after the current head. Make the migration additive and
nullable so existing dev/staging data migrates without backfill.

### Lifecycle Lookup

Introduce a deleted-aware lookup that returns enough metadata for:

- active project access;
- `410 project_deleted`;
- restore eligibility;
- hard-delete confirmation.

Do not replace every call site yet. Phase 2 wires route behavior.

### Counts And Manifest

Create one count function that returns a stable object used by soft
delete responses, deleted-project list rows, audit details, and tests.

Create one storage-manifest helper that collects:

- asset ids;
- object keys;
- thumbnail keys from asset metadata;
- job ids and result asset ids.

The manifest can be a plain dict in Phase 1; Phase 3 will consume it.

## Tests

Add focused backend tests covering:

- migration shape if this repo has migration smoke coverage;
- deleted-aware lookup returns active/deleted/unknown correctly;
- child counts include direct and version-derived child rows;
- soft-delete helper sets `deleted_at`, `deleted_by`, and
  `hard_delete_after`;
- restore helper clears those fields;
- `project_delete_counts` handles projects with zero children.

Suggested command:

```bash
cd backend
uv run pytest tests/test_projects.py
```

## Success Criteria

1. `uv run alembic upgrade head` succeeds.
2. Repository tests pass without route/UI changes.
3. The delete-count contract is reusable by REST, MCP, and scripts.
4. Existing active project listing remains unchanged.
