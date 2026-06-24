---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Implemented — shipped in #13 (commit 51dcd77).
AUTHOR: Claude (Opus 4.7)
SCOPE: Phase 1 — one Alembic migration. Audit-FK ON DELETE consistency
       + `project_jobs.result_asset_id` index.
EFFORT: ~30 min
BUCKET: Now
DEPENDS_ON: none
RELATED:
  - `planning/code-reviews/2026-06-07/backend-data-structure-review.md`
    §2.2, §2.3, §5.1
  - `backend/alembic/versions/20260512_0003_projects.py`
  - `backend/alembic/versions/20260526_0011_project_assets_and_jobs.py`
---

# Phase 1 — Schema housekeeping migration

## Goal

One Alembic migration that:

1. Adds explicit `ON DELETE SET NULL` to every audit FK
   (`created_by`, `updated_by`, `deleted_by`) that does not already
   have it. The policy is "audit columns never block a user-delete";
   this matches `projects.deleted_by` set in migration 0003.
2. Adds the missing index on `project_jobs.result_asset_id`.

## Background

From the review:

```python
# 0003_projects.py — explicit
op.create_foreign_key(
    "fk_projects_deleted_by", "projects", "users",
    ["deleted_by"], ["id"], ondelete="SET NULL",
)

# 0011_project_assets_and_jobs.py — implicit RESTRICT
sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
sa.ForeignKeyConstraint(["deleted_by"], ["users.id"]),
```

Same column name, different cascade behavior. Users are never
hard-deleted today, so neither path fires — making this exactly the
right time to align the policy before anyone learns the inconsistency
the hard way.

## Pre-work

1. From repo root: `docker compose up -d db` then `cd backend && uv run alembic upgrade head`.
2. Enumerate every audit FK with implicit RESTRICT. The review names
   `project_assets` and `project_jobs`; sweep the whole schema for the
   full list. Quick check:

   ```bash
   psql -h localhost -U postgres -d phn_v2 -c "
   SELECT con.conrelid::regclass AS table, con.conname, con.confdeltype, a.attname
   FROM pg_constraint con
   JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
   WHERE con.contype = 'f'
     AND a.attname IN ('created_by','updated_by','deleted_by')
   ORDER BY con.conrelid::regclass::text, a.attname;
   "
   ```

   Anything with `confdeltype = 'a'` (no action) is implicit RESTRICT
   and needs to be fixed.

3. Confirm no existing index on `project_jobs.result_asset_id`:

   ```bash
   psql -h localhost -U postgres -d phn_v2 -c "
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'project_jobs' AND indexdef LIKE '%result_asset_id%';
   "
   ```

## Steps

1. Generate a migration:

   ```bash
   cd backend && uv run alembic revision -m "audit_fks_set_null_and_result_asset_index"
   ```

   Slug it `0020_audit_fks_set_null_and_result_asset_index.py` to match
   the existing numbering convention.

2. Write the migration body. For each audit FK that needs fixing:

   ```python
   op.drop_constraint("fk_project_assets_created_by", "project_assets", type_="foreignkey")
   op.create_foreign_key(
       "fk_project_assets_created_by",
       "project_assets", "users",
       ["created_by"], ["id"],
       ondelete="SET NULL",
   )
   ```

   Repeat per (table, column) from the enumeration above. Add the
   index:

   ```python
   op.create_index(
       "ix_project_jobs_result_asset",
       "project_jobs",
       ["result_asset_id"],
   )
   ```

3. Write the downgrade. Drop+recreate each FK with no `ondelete=`
   (restoring implicit RESTRICT). Drop the index. Be explicit so the
   round trip is symmetric — do not raise `NotImplementedError` here;
   this is a reversible housekeeping change, not a destructive flatten.

4. Run forward and reverse:

   ```bash
   cd backend && uv run alembic upgrade head
   cd backend && uv run alembic downgrade -1
   cd backend && uv run alembic upgrade head
   ```

5. Re-run the `pg_constraint` query — every audit FK should now show
   `confdeltype = 'n'` (SET NULL).

## Files touched

- New: `backend/alembic/versions/2026XXXX_0020_audit_fks_set_null_and_result_asset_index.py`

## Verification

- `make ci` green from repo root.
- Migration round-trips (`upgrade head` → `downgrade -1` → `upgrade head`).
- `pg_constraint` confirms every audit FK is `SET NULL`.
- `pg_indexes` confirms `ix_project_jobs_result_asset` exists.

## Risks

- **Constraint name drift.** Migration 0011 may have used auto-generated
  constraint names rather than explicit ones. Read the migration
  before assuming names; if names are auto-generated, query
  `pg_constraint` for them and reference the actual names.
- **Other migrations may have added new audit FKs** since 0011 (e.g.
  the assemblies / apertures features). The `pg_constraint` sweep is
  what catches them — do not rely on the review's enumeration alone.

## Done when

- One commit on a feature branch, CI green, `STATUS.md` updated to
  mark Phase 1 complete, and decisions / follow-ups (if any audit FKs
  were intentionally not aligned) recorded in `decisions.md`.
