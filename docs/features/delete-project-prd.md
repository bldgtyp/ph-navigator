---
DATE: 2026-05-26
TIME: 19:24 EDT
STATUS: DRAFT FEATURE PRD - project soft-delete, restore, and hard-delete
AUDIENCE: Future coding agents implementing PH-Navigator V2
SCOPE: Dashboard mass-delete UX, REST/MCP project deletion contracts,
       90-day restore window, hard-delete cleanup, and current backend
       data-ownership review.
RELATED:
  - context/PRD.md §4 (access model), §6 (data model), §10 (MCP)
  - context/technical-requirements/data-model.md §6.1, §6.2, §6.5
  - context/technical-requirements/llm-mcp-schema.md §10.3
  - context/UI_UX.md
  - backend/features/projects/
  - backend/features/mcp/
  - backend/features/assets/
  - backend/features/project_document/
  - frontend/src/features/projects/routes/Dashboard.tsx
  - frontend/src/features/projects/components/ProjectList.tsx
---

# PH-Navigator V2 - Delete Project Feature PRD

## 1. Why this doc exists

PH-Navigator V2 can create and edit project shells, but it does not yet
have a first-class way to remove projects from the dashboard or clean up
dev/test data. The current access model also makes project deletion the
only v1 mechanism for revoking public read access to a project URL:
there are no per-share-link rows to revoke.

This feature adds:

- dashboard project selection with a bulk delete button;
- a 90-day soft-delete window for normal mistakes and public URL
  revocation;
- a deliberate hard-delete path for dev database cleanup and final
  physical cleanup;
- MCP parity for project-scoped deletion operations that make sense
  under the current project-scoped token model.

The implementation must be complete across relational rows, JSONB
project-document bodies, drafts, MCP tokens, DataTable preferences,
uploaded R2 files, asset jobs, and future project-owned tables.

## 2. Product Goal

Editors can select one or more projects on `/dashboard`, click Delete,
confirm the destructive action, and remove those projects from the
dashboard immediately. The default action is soft-delete: project rows
are tombstoned for 90 days, project routes stop resolving, public
viewers lose access, MCP tools stop seeing the project, and all child
data remains restorable.

Hard-delete is not exposed in the normal dashboard UX. It is an
admin/dev cleanup capability, available through backend tooling and MCP
with explicit confirmation. It permanently removes the project row, all
database children, all document-owned entities stored in saved
versions/drafts, and all R2 objects under the project's storage prefix.

## 3. Current Backend Ownership Review

### 3.1 Project root

`projects` is the root relational row. It already has `deleted_at`; all
normal project reads use `deleted_at IS NULL` through
`backend/features/projects/repository.py`.

Current important columns:

- `id`
- `name`
- `bt_number`
- `owner_id`
- `active_version_id`
- `last_saved_at`
- `created_at`
- `updated_at`
- `deleted_at`

Needed additions:

- `deleted_by UUID NULL REFERENCES users(id) ON DELETE SET NULL`
- `hard_delete_after TIMESTAMPTZ NULL`

`hard_delete_after` is set to `deleted_at + interval '90 days'` for
normal soft deletes. Restore clears both fields. Hard-delete does not
depend on the timestamp when explicitly requested by an editor.

Do not make `bt_number` reusable after soft-delete. The existing unique
constraint intentionally keeps BT numbers reserved. Hard-delete is the
only path that frees a BT number.

### 3.2 Relational child tables

Current project-owned relational tables:

| Table | Project relationship | Soft-delete behavior | Hard-delete behavior |
|---|---|---|---|
| `project_versions` | `project_id REFERENCES projects(id) ON DELETE CASCADE` | Preserve all rows. Hidden by project tombstone. | Delete through project cascade. Contains saved JSON bodies. |
| `project_version_drafts` | `version_id REFERENCES project_versions(id) ON DELETE CASCADE` | Preserve all user/MCP drafts for restore. | Delete through version cascade. Contains draft JSON bodies. |
| `project_status_items` | `project_id REFERENCES projects(id) ON DELETE CASCADE` | Preserve rows, including item-level `deleted_at`. | Delete through project cascade. |
| `mcp_tokens` | `project_id REFERENCES projects(id) ON DELETE CASCADE` | Preserve token rows; project access fails while project is deleted. | Delete through project cascade. |
| `user_table_views` | `project_id REFERENCES projects(id) ON DELETE CASCADE` | Preserve user table preferences. | Delete through project cascade. |
| `project_assets` | `project_id REFERENCES projects(id) ON DELETE CASCADE` | Preserve rows and R2 object keys. | Delete through project cascade after object manifest is captured. |
| `project_jobs` | `project_id REFERENCES projects(id) ON DELETE CASCADE`; `result_asset_id REFERENCES project_assets(id)` | Preserve job rows. | Delete with project. Delete job rows before asset rows if not relying on a single parent cascade. |

Canonical docs also mention `user_project_preferences` and
`project_hbjson_files`; these are not present in current migrations.
The implementation should still include them in the project-owned table
audit before coding because they are likely future additions.

`user_action_log` is not a project-owned child table. It stores
project ids inside JSON `details`, so hard-delete must not cascade it.
Deletion and restore should append audit events there.

### 3.3 Document-owned project data

Assemblies, layers, segments, project materials, windows, rooms,
thermal bridges, equipment, custom field registries, and single-select
options currently live inside `project_versions.body` and
`project_version_drafts.body` as JSONB. There are no separate backend
tables for these entities today.

Implication:

- Soft-delete only tombstones the `projects` row.
- Restore revives every saved version and every unsaved draft exactly
  as it was at delete time.
- Hard-delete of `project_versions` and `project_version_drafts`
  deletes all assemblies, records, files references, windows, rooms,
  pumps, future ERVs/fans, thermal bridges, custom fields, and option
  lists because those entities are embedded in the JSONB bodies.

### 3.4 File/object ownership

`project_assets` is the canonical row for R2-backed files. Document
bodies reference assets by `asset_id`.

Current object keys are under:

```text
projects/{project_id}/assets/{asset_id}/file.{ext}
projects/{project_id}/assets/{asset_id}/thumb.png
projects/{project_id}/assets/_orphaned/{asset_id}/{filename}
```

Soft-delete must not move or delete objects because restore requires
existing asset references to keep working.

Hard-delete must remove every object under
`projects/{project_id}/assets/`, including thumbnails, export bundles,
pending uploads, failed uploads, and previously orphaned objects. The
current R2 client only deletes individual object keys; this feature
needs a prefix-list + batch-delete helper or an equivalent storage
method.

## 4. Behavior

### 4.1 Soft-delete

Soft-delete is the default from browser and MCP.

Rules:

- Requires editor auth for REST/dashboard.
- Requires `project:write` for MCP.
- Sets `projects.deleted_at = now()`.
- Sets `projects.deleted_by = user.id`.
- Sets `projects.hard_delete_after = now() + interval '90 days'`.
- Updates `projects.updated_at = now()`.
- Does not delete child rows.
- Does not delete or move R2 objects.
- Does not rewrite saved version bodies or drafts.
- Dashboard list filters exclude deleted projects.
- Direct REST/project-shell/public-viewer reads for a soft-deleted
  project return `410 Gone` with error code `project_deleted`.
- MCP active-project reads return structured `project_deleted` when
  the scoped project is soft-deleted, except for the restore tool.
- Appends `project_soft_delete` to `user_action_log` with project id,
  BT number, name, child counts, and hard-delete deadline.

Idempotency:

- Repeating soft-delete on an already-deleted project returns success
  with `already_deleted: true` when the caller is an authenticated
  editor using a deleted-aware endpoint.
- Normal public/view routes return `410 Gone` when the project exists
  but is soft-deleted; unknown ids remain `404 project_not_found`.

### 4.2 Restore / undelete

Restore is available until `hard_delete_after`.

Rules:

- Requires editor auth.
- Clears `projects.deleted_at`, `projects.deleted_by`, and
  `projects.hard_delete_after`.
- Updates `projects.updated_at = now()`.
- Restores dashboard visibility.
- Restores public URL readability.
- Restores MCP access for still-active tokens because project access no
  longer fails the `deleted_at IS NULL` check.
- Appends `project_restore` to `user_action_log`.

Out of scope for v1:

- Restoring a hard-deleted project.
- Partial restore of one version, one draft, or one attachment.

### 4.3 Hard-delete

Hard-delete permanently removes the project and all owned data.

Rules:

- Requires admin/dev backend tooling or MCP; no normal dashboard
  control exposes hard-delete.
- Requires `project:write` plus an explicit confirmation token for MCP.
- Should be available for active or soft-deleted projects, but the
  admin tool or MCP call must make the destructive nature obvious.
- Soft-deletes the project first if it is still active, so any failure
  during physical cleanup leaves the project hidden rather than
  publicly readable with missing files.
- Captures a deletion manifest before deleting database rows:
  project metadata, child row counts, asset ids, object keys,
  thumbnail keys, job ids, and version ids.
- Deletes R2 objects under `projects/{project_id}/assets/`.
- Deletes relational rows through a single project delete or explicit
  ordered deletes.
- Appends `project_hard_delete` to `user_action_log` with summary
  counts and storage cleanup result.

Recommended deletion order when not relying on a single parent cascade:

1. Lock project row with `SELECT ... FOR UPDATE`.
2. If active, set the normal soft-delete fields.
3. Capture manifest and child counts.
4. Delete R2 objects by prefix, recording failures.
5. Stop on storage partial failure; leave the project soft-deleted and
   retryable.
6. Delete `project_jobs`.
7. Delete `project_assets`.
8. Delete `mcp_tokens`.
9. Delete `user_table_views`.
10. Delete `project_status_items`.
11. Delete `project_version_drafts` through versions or explicitly.
12. Delete `project_versions`.
13. Delete `projects`.

If storage deletion partially fails, return structured partial-failure
details and keep enough manifest data in the audit log to retry cleanup
manually. For dev cleanup, a hard-delete that removes DB rows but leaves
R2 objects is not acceptable as a silent success.

## 5. REST API Contract

### 5.1 Single-project soft-delete

```http
POST /api/v1/projects/{project_id}:delete
```

Use a POST action endpoint rather than a DELETE request with a body so
the confirmation contract is explicit and consistent across clients.

Request body:

```json
{
  "confirm": true
}
```

Response:

```json
{
  "project_id": "uuid",
  "mode": "soft",
  "deleted_at": "2026-05-26T23:24:00Z",
  "hard_delete_after": "2026-08-24T23:24:00Z",
  "already_deleted": false,
  "counts": {
    "versions": 3,
    "drafts": 2,
    "status_items": 12,
    "assets": 18,
    "jobs": 1,
    "mcp_tokens": 2,
    "table_views": 4
  }
}
```

### 5.2 Bulk soft-delete

```http
POST /api/v1/projects:bulk-delete
```

Request:

```json
{
  "project_ids": ["uuid-1", "uuid-2"],
  "confirm": true
}
```

Response:

```json
{
  "mode": "soft",
  "items": [
    {
      "project_id": "uuid-1",
      "ok": true,
      "deleted_at": "2026-05-26T23:24:00Z",
      "hard_delete_after": "2026-08-24T23:24:00Z",
      "counts": {}
    },
    {
      "project_id": "uuid-2",
      "ok": false,
      "error_code": "project_deleted",
      "message": "Project was already deleted."
    }
  ]
}
```

Bulk hard-delete is intentionally not part of the normal dashboard/API
surface. Use the admin/dev script or MCP hard-delete tool for physical
cleanup.

### 5.3 Deleted project list

```http
GET /api/v1/projects/deleted
```

Returns soft-deleted projects owned by the current dashboard user,
ordered by newest `deleted_at`. Include `hard_delete_after` and child
counts so the UI can show what will be permanently removed.

### 5.4 Restore

```http
POST /api/v1/projects/{project_id}:restore
```

Response returns the normal `ProjectDetail`.

Implementation note: this route must use a deleted-aware repository
lookup. The current `require_project_access` seam cannot see deleted
projects because it calls `get_project_by_id()` with
`deleted_at IS NULL`.

### 5.5 Deleted project reads

Normal project reads should distinguish "unknown id" from "known but
deleted":

```http
GET /api/v1/projects/{project_id}
```

Deleted response:

```json
{
  "error_code": "project_deleted",
  "message": "Project was deleted.",
  "recoverability": "restore",
  "details": {
    "project_id": "uuid",
    "deleted_at": "2026-05-26T23:24:00Z",
    "hard_delete_after": "2026-08-24T23:24:00Z"
  }
}
```

HTTP status: `410 Gone`.

### 5.6 Admin/dev hard-delete

Hard-delete is available through backend admin/dev tooling, not the
normal dashboard. Minimum v1 surface:

```text
cd backend && uv run python scripts/delete_project.py --hard <project_id>
```

If an admin REST endpoint is added later, keep it separate from the
normal dashboard routes, require exact project name + BT number
confirmation, and return `storage.deleted_object_count` plus
`storage.failed_object_keys`.

## 6. MCP Contract

The current MCP design is project-scoped: a token sees exactly one
project. This feature should not introduce workspace/all-project MCP
tokens just to support cleanup.

Add these tools:

```text
delete_project(project_id)
restore_project(project_id)
hard_delete_project(project_id, confirm_project_name, confirm_bt_number)
```

Rules:

- All tools require the token's `project_id` to match the argument.
- `delete_project` is soft-delete only and requires `project:write`.
- `hard_delete_project` requires `project:write` and exact project
  name + BT number confirmation.
- `restore_project` can only work if token validation still succeeds
  and the token is still project-scoped to the deleted project. This
  means token authentication must remain independent from project
  visibility; the deleted-aware restore service then checks scope and
  restores the project without using the active-only
  `project_access_or_error` helper. **Decision 2026-05-26: MCP restore
  is allowed.**
- No MCP bulk-delete in v1 because project-scoped tokens cannot see
  multiple projects.

Structured MCP errors:

- `project_delete_not_found`
- `project_delete_already_deleted`
- `project_delete_confirmation_required`
- `project_delete_hard_confirmation_mismatch`
- `project_deleted`
- `project_restore_expired`
- `project_hard_delete_storage_partial_failure`

## 7. Dashboard UX

### 7.1 Project selection

Update `ProjectList` so each project row has a checkbox/check-mark
control in the first column.

Requirements:

- The checkbox must not trigger row navigation.
- Row click/link behavior remains available on the rest of the row.
- Add a select-all checkbox in the project-list heading.
- Keep selection state in `Dashboard`, not inside each row, so it can
  drive a bulk action.
- Clear selection after successful delete or list refresh.

### 7.2 Bulk delete button

When one or more projects are selected, show a Delete button near the
project section heading or page heading.

Button copy:

- `Delete` when one selected.
- `Delete 4 projects` when multiple selected.

The modal must show:

- selected project count;
- project names and BT numbers;
- soft-delete deadline: "Can be restored for 90 days";
- no hard-delete option in the normal dashboard modal.

Dashboard delete is soft-delete only. Hard-delete is admin/dev tooling
or MCP only.

### 7.3 Recently deleted surface

Minimum v1 restore UX:

- Add a `Recently deleted` toggle or secondary section on the dashboard.
- Show soft-deleted projects with `deleted_at` and `hard_delete_after`.
- Provide Restore. Do not expose Permanently delete in the normal
  dashboard.

If this is too much for the first implementation pass, the REST restore
endpoint may ship before dashboard restore, but the plan must not call
the 90-day window complete without a user-accessible restore path.

## 8. Backend Implementation Plan

### Phase 1 - Schema and repository foundation

- Add Alembic migration for `projects.deleted_by` and
  `projects.hard_delete_after`.
- Add deleted-aware repository helpers:
  - `get_project_by_id_including_deleted`
  - `list_deleted_projects_for_owner`
  - `soft_delete_project`
  - `restore_project`
  - `delete_project_hard`
  - `project_delete_counts`
  - `project_storage_manifest`
- Add Pydantic request/response models for delete, bulk delete,
  restore, and deleted-project list.
- Add unit tests around child-count collection and soft-delete
  idempotency.

### Phase 2 - REST services and routes

- Add `POST /api/v1/projects/{project_id}:delete`.
- Add `POST /api/v1/projects:bulk-delete`.
- Add `GET /api/v1/projects/deleted`.
- Add `POST /api/v1/projects/{project_id}:restore`.
- Log `project_soft_delete`, `project_restore`, and
  `project_hard_delete`.
- Confirm existing active-project routes return `410 Gone` /
  `project_deleted` for soft-deleted projects and 404 for unknown ids.

### Phase 3 - Hard-delete storage cleanup

- Extend `R2Client` with prefix listing and batch deletion.
- Hard-delete all objects under `projects/{project_id}/assets/`.
- Include thumbnails, export bundles, failed/pending uploads, and
  `_orphaned` objects.
- Add dry-run and hard-delete support in a backend script for dev
  cleanup:
  `cd backend && uv run python scripts/delete_project.py --dry-run <id>`
  and `cd backend && uv run python scripts/delete_project.py --hard <id>`.
- Add tests with fake storage verifying DB rows and object keys are
  both removed.

### Phase 4 - Dashboard bulk-selection UX

- Add project-row checkboxes and select-all.
- Add bulk Delete button.
- Add confirmation modal.
- Wire soft-delete mutation and list invalidation.
- Add Recently deleted list/restore controls.
- Add React tests for selection, navigation isolation, modal copy,
  soft-delete success, and absence of normal hard-delete controls.

### Phase 5 - MCP tools

- Add tool implementations in `backend/features/mcp/tools.py`.
- Register tool stubs in `backend/features/mcp/server.py`.
- Add Pydantic result models if the current dict responses are not
  precise enough.
- Add MCP tests for:
  - project-scoped soft-delete with `project:write`;
  - read-only token rejection;
  - project-boundary rejection;
  - hard-delete confirmation mismatch;
  - soft-deleted project disappearing from `list_projects`;
  - restore behavior.

## 9. Verification Gates

Backend:

- `cd backend && uv run pytest tests/test_projects.py tests/test_mcp.py`
- Add focused tests for soft-delete, restore, hard-delete, and bulk
  partial failures.
- Add a migration test or manual `uv run alembic upgrade head`.

Frontend:

- `cd frontend && pnpm test`
- Add dashboard component tests for checkboxes, selected count, delete
  modal, absence of hard-delete controls, and row-link isolation.
- Run `pnpm run format` after edits.

End-to-end:

- `make smoke`
- `make e2e` or a focused Playwright spec:
  1. create two projects;
  2. select both on `/dashboard`;
  3. soft-delete;
  4. verify they disappear;
  5. open Recently deleted;
  6. restore one;
  7. verify the still-deleted project route returns `410 Gone`;
  8. verify restored project opens.

Storage:

- In fake storage, assert no object keys remain under
  `projects/{project_id}/assets/` after hard-delete.
- In real/dev R2, hard-delete should report deleted/failed object
  counts.

## 10. Resolved Decisions

Resolved 2026-05-26:

1. **MCP restore is allowed.** A project-scoped token with
   `project:write` may restore its own soft-deleted project through a
   deleted-aware restore path.
2. **Hard-delete is admin/MCP only.** Do not expose hard-delete in the
   normal dashboard UX. Use it for dev DB cleanup and rare admin
   cleanup, not routine project management.
3. **No automatic purge in v1.** The 90-day timestamp is retained for
   policy and UI clarity, but physical hard-delete is manual.
4. **`user_action_log.details` is enough for v1 hard-delete manifests.**
   No dedicated `project_deletion_runs` table is required now.
5. **Deleted project reads return `410 Gone`.** Unknown ids remain
   `404 project_not_found`; known soft-deleted ids return
   `410 project_deleted`.

## 11. Implementation Notes

- Keep all project-scoped route access through the existing
  `require_project_access` seam for normal active-project routes.
- Deleted-aware routes must not reuse the active-only access helper
  until after they have resolved the tombstoned project.
- Do not traverse or mutate document JSON during soft-delete.
- Do not rely on JSON references for hard-delete cleanup; delete the
  entire project storage prefix.
- Hard-delete must not delete catalog rows. Catalog values copied into
  project documents disappear with versions/drafts; global catalog
  source rows remain.
- Future project-owned tables must either use
  `project_id REFERENCES projects(id) ON DELETE CASCADE` or be added to
  the explicit hard-delete audit before shipping.
