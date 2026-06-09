---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Not started
AUTHOR: Claude (Opus 4.7)
SCOPE: Phase 5 — capture the deletability decision for `user_table_views`.
       Either a one-line comment on migration 0010 or a new migration
       adding `deleted_at`.
EFFORT: ~5 min (decision), ~15 min if a migration is needed
BUCKET: Now
DEPENDS_ON: none
RELATED:
  - `planning/code-reviews/2026-06-07/backend-data-structure-review.md` §2.4
  - `backend/alembic/versions/20260518_0010_user_table_views.py`
  - `decisions.md` (D2)
---

# Phase 5 — `user_table_views` deletability

## Goal

Convert latent ambiguity into a recorded decision. Either document that
rows are never deleted (reset-only), or add `deleted_at` plus a
filtered uniqueness index now while the table is empty/small.

## Background

Review §2.4: `user_table_views` (migration 0010) has no `deleted_at`.
Every other soft-deleted table in the schema does. Either choice is
fine; what is not fine is leaving the decision unmade.

## Decision

Record D2 in `decisions.md` before writing code. Look at the
`user_table_views` repository and any call site that "removes" a view
(if there is one). If "remove" is implemented as "reset to default",
the answer is reset-only. If there is or will be a "delete saved view"
button in the UI, the answer is deletable.

If unclear, default to **reset-only** — `user_table_views` is a UI
state cache; deletion as a first-class operation is unusual for that
shape, and adding the column later is cheap as long as the table stays
small.

## Branch A — reset-only

1. Open `backend/alembic/versions/20260518_0010_user_table_views.py`.
2. Add a short comment block at the top of the migration body:

   ```python
   # NOTE: user_table_views is upsert/reset-only. Rows are never
   # deleted; "remove" means reset to default. No deleted_at column
   # is needed.
   ```

3. `make ci` (will pass; only a comment changed).
4. Record D2 = reset-only in `decisions.md` with one sentence of
   reasoning.

## Branch B — deletable

1. Generate migration:

   ```bash
   cd backend && uv run alembic revision -m "user_table_views_deleted_at"
   ```

   Number it next in sequence (e.g. `0021_user_table_views_deleted_at`).
2. Migration body:

   ```python
   op.add_column(
       "user_table_views",
       sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
   )
   # If a uniqueness index exists, drop and recreate it as a partial
   # index filtered on deleted_at IS NULL, matching the pattern used by
   # ix_project_status_items_project_order etc.
   op.drop_index("uq_user_table_views_user_table", "user_table_views")
   op.create_index(
       "uq_user_table_views_user_table",
       "user_table_views",
       ["user_id", "table_id"],
       unique=True,
       postgresql_where=sa.text("deleted_at IS NULL"),
   )
   ```

   Read migration 0010 first to confirm actual index names and shape;
   the snippet above is a sketch.

3. Update `user_table_views` repository to filter
   `WHERE deleted_at IS NULL` on every read; treat "delete" as setting
   `deleted_at = now()`.
4. Add a test for soft-delete behavior in
   `backend/tests/features/.../test_user_table_views.py`.
5. `make ci`.
6. Record D2 = deletable in `decisions.md` with the reason (e.g.
   "frontend will expose a 'delete saved view' action").

## Files touched

- Branch A: `backend/alembic/versions/20260518_0010_user_table_views.py`
  (comment only).
- Branch B: new migration, repository for `user_table_views`, possibly
  one new test.

## Verification

- Branch A: visual review of the new comment, CI green.
- Branch B: migration round-trips, new test passes, CI green.

## Risks

- **Choosing wrong**: if the team later wants the other branch, both
  reversals are cheap (add a column then is no harder than now). The
  cost being avoided here is *not the choice* — it is leaving the
  question latent.

## Done when

- `decisions.md` D2 marked accepted, CI green, `STATUS.md` updated.
