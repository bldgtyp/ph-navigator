---
DATE: 2026-05-26
TIME: 19:36 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: MCP project lifecycle tools for soft-delete, restore, and
       confirmed hard-delete.
RELATED:
  - planning/features/delete-project/PRD.md
  - planning/features/delete-project/phases/phase-02-rest-soft-delete-restore-410.md
  - planning/features/delete-project/phases/phase-03-hard-delete-admin-storage-cleanup.md
  - context/technical-requirements/llm-mcp-schema.md
  - backend/features/mcp/
---

# Phase 5 - MCP Project Delete, Restore, And Hard-Delete

## Goal

Expose project lifecycle operations through MCP while preserving the v1
project-scoped token model. A token can soft-delete, restore, or
confirmed-hard-delete only its own project. There is no MCP bulk-delete
because a project-scoped token cannot see multiple projects.

## In Scope

- MCP tools:
  - `delete_project(project_id)`;
  - `restore_project(project_id)`;
  - `hard_delete_project(project_id, confirm_project_name,
    confirm_bt_number)`.
- Tool result models or precise dict responses for:
  - soft-delete response;
  - restore response;
  - hard-delete manifest/storage summary.
- Deleted-project behavior:
  - `list_projects()` returns an empty project list for a soft-deleted
    project-scoped token;
  - active read tools return structured `project_deleted`;
  - `restore_project` remains callable with the soft-deleted
    project-scoped token.
- Hard-delete uses the Phase 3 service and exact project name + BT
  number confirmation.
- Structured MCP errors:
  - `project_deleted`;
  - `project_delete_not_found`;
  - `project_delete_already_deleted`;
  - `project_delete_confirmation_required`;
  - `project_delete_hard_confirmation_mismatch`;
  - `project_restore_expired`;
  - `project_hard_delete_storage_partial_failure`.

## Out Of Scope

- Workspace/global MCP tokens.
- MCP bulk-delete.
- Anonymous MCP access.
- Dashboard hard-delete.

## Constraints

- All tools require token `project_id` to match the argument.
- `delete_project` and `restore_project` require `project:write`.
- `hard_delete_project` requires `project:write` plus exact
  confirmation.
- Restore must not use `project_access_or_error`, because that helper
  resolves active projects only.
- Token authentication remains independent from active project
  visibility so restore can work after soft-delete.

## Workstreams

### Tool Implementations

Add `tool_delete_project`, `tool_restore_project`, and
`tool_hard_delete_project` in `backend/features/mcp/tools.py`.

Prefer calling project lifecycle service functions over duplicating SQL
or storage behavior in MCP code.

### Server Registration

Register thin stubs in `backend/features/mcp/server.py`, matching the
current MCP wiring style.

### Deleted Read Behavior

Update existing MCP read helpers so deleted projects produce the PRD
behavior:

- `list_projects()` returns `projects: []`;
- `get_project`, `list_versions`, `list_status_items`,
  `get_document`, `get_table`, asset tools, and custom-field tools
  return or raise structured `project_deleted`.

### Hard-Delete Safety

Require both:

- exact project name;
- exact BT number.

Return a structured manifest summary. Never return token hashes or
secret material.

## Tests

Extend MCP tests for:

- read-only token cannot delete;
- token cannot delete another project id;
- `delete_project` soft-deletes the scoped project;
- `list_projects` returns empty after soft-delete;
- active read tools surface `project_deleted`;
- `restore_project` works after soft-delete;
- `hard_delete_project` rejects mismatched name or BT number;
- `hard_delete_project` deletes DB rows and storage through the Phase 3
  fake storage path;
- hard-delete partial storage failure surfaces structured error.

Suggested commands:

```bash
cd backend
uv run pytest tests/test_mcp.py tests/test_projects.py
```

## Success Criteria

1. MCP lifecycle tools match REST/admin behavior.
2. MCP restore is implemented and tested.
3. Hard-delete is confirmation-gated and project-scoped.
4. Deleted project read behavior is consistent and structured.
