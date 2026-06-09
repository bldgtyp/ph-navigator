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

(none yet)
