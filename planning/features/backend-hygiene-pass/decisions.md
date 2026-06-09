---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Active
AUTHOR: Claude (Opus 4.7)
RELATED: `PRD.md`
---

# Decisions — Backend Hygiene Pass

Decisions get appended here as phases land. Format: short title, the
choice made, the reasoning, and the date.

## Pending decisions

These must be made at the start of the named phase.

### D1 — REST action-URL style (Phase 3)

Two styles exist today:

- Google/AIP `:verb` style:
  `POST /projects:bulk-delete`,
  `POST /projects/{id}:delete`,
  `POST /projects/{id}:restore`.
- Slash-verb style:
  `POST /assets/{id}/complete-upload`,
  `POST /assets/{id}/attach`,
  `POST /assets/{id}/detach`.

Pick exactly one and record it here when Phase 3 starts. Then rename
the routes in the other style and update frontend callers in the same
commit. Document the choice in `backend/README.md`.

### D2 — `user_table_views` deletability (Phase 5)

Decide one of:

- **Reset-only**: rows are upserted by `(user_id, table_id)`; "remove"
  means reset to default rather than delete. Add a one-line comment to
  `backend/alembic/versions/20260518_0010_user_table_views.py`
  documenting this and record the choice here.
- **Deletable**: rows can be soft-deleted. Add a new migration that
  introduces `deleted_at timestamptz` and a filtered uniqueness index
  matching the rest of the schema, and record the choice here.

The review marked this as a five-minute design call. Treat it that way
— do not invent middle-ground options.

## Accepted decisions

### D1 — REST action-URL style (Phase 3) — slash-verb

Adopted **slash-verb** style: `POST /resource/{id}/verb-phrase`.

Reasoning: 18 of 21 action routes in the codebase were already slash-verb;
only three routes in `projects/routes.py` used `:verb` style
(`:bulk-delete`, `/{project_id}:delete`, `/{project_id}:restore`).
Cheaper to rename the three than to migrate the rest. Documented in
`backend/README.md`.

Decided: 2026-06-09. Implemented in Phase 3.

### D2 — `user_table_views` deletability (Phase 5) — reset-only via hard-delete

`user_table_views` rows are **hard-deleted** when a user resets a table
view. No `deleted_at` column. No partial index.

Reasoning: the table is a per-user UI-state cache (column widths,
filters) that the frontend fully regenerates on the next save. There is
no audit, recovery, or downstream-reference value in keeping a
tombstone. Hard-delete also keeps reads cheap — every other query
against the table is a (user_id, project_id, table_key) PK lookup.

The schema is correct as-is (migration 0010); the change is a beefed-up
docstring on that migration documenting the policy so the next
soft-delete review doesn't re-flag it.

Decided: 2026-06-09. Implemented in Phase 5.
