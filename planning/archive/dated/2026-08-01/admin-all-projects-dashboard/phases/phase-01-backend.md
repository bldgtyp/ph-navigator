---
DATE: 2026-08-01
TIME: 10:41 EDT
STATUS: Complete — backend contract implemented and verified
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Phase 1 — backend listing, owner fields, ordering.
RELATED: ../PRD.md, ../decisions.md, ./phase-02-frontend.md
---

# Phase 1 — Backend

## 1.1 Repository

Add alongside `list_projects_for_owner` (`backend/features/projects/repository.py:26`):

```sql
SELECT {PROJECT_COLUMNS}, projects.owner_id,
       users.display_name AS owner_display_name
FROM projects
JOIN users ON users.id = projects.owner_id
WHERE projects.deleted_at IS NULL
ORDER BY users.display_name ASC, projects.bt_number DESC
```

The `JOIN users` pattern already exists at `repository.py:76` and `:89` — match
it rather than inventing a variant.

Check whether `list_projects_for_owner` filters `deleted_at IS NULL` or relies
on a view; mirror whatever it does so the two lists agree on what "live" means.

Own-group-first (§D-4) is applied in the service, not SQL — it depends on the
requesting user, and keeping it out of the query keeps the query reusable.

## 1.2 Service

`list_dashboard_projects(user)` (`service.py:85`) branches:

```python
caps = global_capabilities_for_user(user)
if PROJECT_ACCESS_ALL in caps:
    rows = repository.list_all_projects(conn)
    # own group first, then alphabetical by owner display name
    ...
    return ProjectListResponse(projects=[...], grouped=True)
rows = repository.list_projects_for_owner(conn, user.id)
return ProjectListResponse(projects=[...], grouped=False)
```

`global_capabilities_for_user` opens its own connection
(`user_capabilities.py:42`). Resolve capabilities **before** opening the
listing connection, or the request holds two at once — the same trap
`access.py:73` documents.

## 1.3 Model change — do this first, carefully

**Before editing `ProjectSummary`, enumerate every construction site.**

```bash
grep -rn "ProjectSummary(" backend/ --include='*.py' | grep -v __pycache__
grep -rn "ProjectSummary.model_validate" backend/ --include='*.py' | grep -v __pycache__
grep -rn "def project_summary" -A 25 backend/features/projects/service.py
```

The one that will bite: `backend/features/projects/access.py:95` builds the
model from a dict comprehension filtered to fields present on the row. A
**required** `owner_id` silently disappears from that dict if the row lacks it,
and Pydantic then raises at a call site far from this change.

Decision rule:
- If **every** site's row carries `owner_id` → make it required (`owner_id: UUID`).
- If any does not → either widen that query to select it (preferred), or fall
  back to `owner_id: UUID | None = None` and note the weakening in
  `decisions.md`.

`owner_display_name: str | None = None` is optional regardless — it comes from a
`JOIN` that most paths do not perform.

`ProjectSummary` has `extra="forbid"`, so adding fields is safe against
unexpected input but every *producer* must be checked. Also confirm the
`_derive_display_name` model validator is unaffected.

## 1.4 Redaction check

`get_project_detail` already nulls `owner_display_name` for viewer mode
(`service.py:466`). Confirm the new `ProjectSummary` fields cannot reach an
anonymous or viewer-mode response through any other path — the dashboard list
route requires a session, but assert it rather than assume it (PRD criterion 6).

## 1.5 Tests

In `backend/tests/test_projects.py`:

- `test_dashboard_list_is_filtered_to_owner` — **must pass untouched.**
- New: admin sees all projects, `grouped is True`, ordering is own-group-first
  then alphabetical, then `bt_number` desc within a group.
- New: non-admin gets `grouped is False` and no foreign projects.
- New: `owner_display_name` populated for every row in the admin response.

Admin fixture: create the user then `ensure_global_grant` for
`admin.users.manage`, as in `backend/tests/test_access_user_grants.py`.

## Exit criteria

- `uv run ty` clean.
- `make ci` green.
- Existing owner-filter test untouched and passing.

## Implementation result

- `ProjectSummary.owner_id` is required. Every repository row that constructs
  a summary now carries `owner_id`; no nullable fallback was needed.
- Admin listing uses one `projects`/`users` join, returns
  `owner_display_name`, and preserves server-owned ordering. A stable service
  sort moves the requesting owner's group first.
- Non-admin listing remains owner-filtered and returns `grouped: false`.
- Viewer-mode project detail continues to serialize
  `owner_display_name: null`.

## Verification — 2026-08-01

- `uv run pytest tests/test_projects.py tests/test_access_resolver.py -q` —
  **30 passed**.
- `uv run ty check` — **passed**.
- `uv run ruff format --check features/projects tests/test_projects.py tests/test_access_resolver.py`
  — **passed**.
- `uv run ruff check features/projects tests/test_projects.py tests/test_access_resolver.py`
  — **passed**.
- `make format` — **passed; no files changed**.
- `make ci` — **passed**: backend **1,756 passed / 7 skipped**; frontend
  **2,365 passed**; production build and all structural guards green.
