---
DATE: 2026-05-26
TIME: 19:36 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Admin/dev hard-delete, R2 prefix cleanup, deletion manifest, and
       script workflow.
RELATED:
  - docs/features/delete-project-prd.md
  - docs/plans/2026-05-26/delete-project/phase-01-schema-repository-lifecycle.md
  - backend/features/assets/
  - backend/features/projects/
  - backend/scripts/
---

# Phase 3 - Hard-Delete Admin And Storage Cleanup

## Goal

Add the physical cleanup path for dev database cleanup and rare admin
maintenance. Hard-delete is not a normal dashboard feature. It must
remove the database project graph and every R2 object under the
project's storage prefix, or fail loudly with enough manifest data to
retry cleanup.

## In Scope

- Project hard-delete service function reusable by script and MCP.
- R2 client support for:
  - list objects by prefix;
  - delete multiple object keys;
  - report per-key failures.
- Delete all objects under:
  - `projects/{project_id}/assets/`.
- Include normal assets, thumbnails, export bundles, failed/pending
  uploads, and `_orphaned` objects.
- Capture hard-delete manifest in `user_action_log.details`, including:
  - project id, name, BT number;
  - child counts;
  - version ids;
  - asset ids;
  - object keys;
  - deleted object count;
  - failed object keys.
- Backend script:
  - `cd backend && uv run python scripts/delete_project.py --dry-run <id>`;
  - `cd backend && uv run python scripts/delete_project.py --hard <id>`;
  - optional exact `--confirm-name` and `--confirm-bt-number` flags if
    useful for local safety.

## Out Of Scope

- Dashboard hard-delete controls.
- Automatic purge after `hard_delete_after`.
- Dedicated `project_deletion_runs` table.
- Cross-project cleanup.

## Constraints

- If hard-delete is requested for an active project, soft-delete it
  first. If storage cleanup then fails, the project remains hidden and
  retryable.
- Do not delete database rows if storage prefix deletion partially
  fails, unless an explicit future force mode is designed.
- Do not trust JSON asset references as the cleanup source. Delete by
  project storage prefix.
- `user_action_log` must survive hard-delete.
- Catalog tables are global and must not be touched.

## Workstreams

### Storage Adapter

Extend `backend/features/assets/storage_r2.py` with small S3-shaped
helpers:

- `list_object_keys(prefix: str) -> list[str]`;
- `delete_objects(object_keys: list[str]) -> DeleteObjectsResult`.

Keep the protocol fakeable for tests.

### Hard-Delete Service

Implement a transaction-aware flow:

1. Resolve and lock the project deleted-aware.
2. Soft-delete if active.
3. Capture manifest and child counts.
4. Delete R2 objects by prefix.
5. Stop on storage partial failure and log failure details.
6. Delete database children or delete the project row with verified
   cascades.
7. Log `project_hard_delete` with manifest and storage summary.

### Script

The script should print JSON for dry-runs and applied deletes so it can
be copied into issue notes or terminal logs.

## Tests

Add focused backend tests with fake storage for:

- dry-run reports child counts and object keys without deleting rows;
- active project hard-delete first tombstones the project;
- successful hard-delete deletes database rows and storage keys;
- storage partial failure leaves the project soft-deleted and database
  rows intact;
- `user_action_log` retains the hard-delete manifest;
- unknown project id fails cleanly.

Suggested commands:

```bash
cd backend
uv run pytest tests/test_projects.py tests/test_assets_service.py
```

## Success Criteria

1. Dev cleanup can hard-delete a project from CLI.
2. No object keys remain under the project prefix after successful
   hard-delete.
3. Database child rows are gone after successful hard-delete.
4. Partial storage failure is visible, retryable, and not a silent DB
   cleanup success.
