---
DATE: 2026-08-01
TIME: 09:24 EDT
STATUS: Complete
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Phase 1 — land failing tests that characterise the gap.
RELATED: ../PRD.md, ../decisions.md, ./phase-02-enforce.md
---

# Phase 1 — Reproduce

Goal: a test file that **fails on `main`** for every case the fix must change,
and **passes on `main`** for every case the fix must preserve. The fix is done
when this file is green and nothing else went red.

## Deliverable

`backend/tests/test_project_access_ownership.py`.

A new file rather than an addition to `test_projects.py` — this is an access
contract, and it should be findable as one.

## Test matrix

Three actors against one project owned by `ed@example.com`.

| # | Actor | Call | Expected after fix | On `main` today |
| --- | --- | --- | --- | --- |
| 1 | stranger | `GET /projects/{id}` | 404 | 200 (**fails**) |
| 2 | stranger | `PATCH /projects/{id}` | 404 | 200 (**fails**) |
| 3 | stranger | `GET /projects` | `[]` | `[]` (passes) |
| 4 | owner | `GET /projects/{id}` | 200 | 200 (passes) |
| 5 | owner | `PATCH /projects/{id}` | 200 | 200 (passes) |
| 6 | admin | `GET /projects/{id}` | 200 | 200 (passes) |
| 7 | admin | `PATCH /projects/{id}` | 200 | 200 (passes) |
| 8 | admin | `POST /projects/{id}/delete` | 404 (§D-4) | 404 (passes) |
| 9 | anonymous | `GET /projects/{id}` | 200, redacted | 200, redacted (passes) |
| 10 | anonymous | `PATCH /projects/{id}` | 401 | 401 (passes) |

Cases 3–10 are the regression guard. They must be written even though they pass
today — the point is that they keep passing.

Case 9 asserts specifically: `client is None`, `phius_dropbox_url is None`,
`owner_display_name is None`, `access_mode == "viewer"`.

## Fixtures

- Reuse the `clean_project_tables` truncation pattern from
  `backend/tests/test_projects.py:25`.
- `signed_in_client()` there hardcodes `ed@example.com`; generalise to
  `signed_in_client(email)` or add a local helper. Prefer a local helper —
  don't reshape the existing test module in this phase.
- Admin actor: create the user, then insert the `admin.users.manage` global
  grant via `features.access.repository.ensure_global_grant`, mirroring
  `backend/tests/test_access_user_grants.py`.
- **Staff actor:** add a fifth actor set via
  `auth_repository.set_user_is_staff(conn, user.id, True)` (pattern in
  `backend/tests/catalog_helpers.py:21`). Per §D-3 both `is_staff` and the Admin
  preset must resolve `projects.access.all`, so cases 6–8 need a staff twin.
  Today `is_staff` is inert, so the staff twin fails exactly where the admin one
  does — that is the point.

## Notes

- The project-create response nests under `project`; read the id defensively.
- Every mutating request needs `headers={"Origin": ORIGIN}` or CSRF rejects it.
- Mark the four expected-to-fail cases with a comment naming Phase 2, but do
  **not** `xfail` them — they should be visibly red until the fix lands.

## Exit criteria

- Cases 1, 2 red on `main`; 3–10 green on `main`.
- `make ci` otherwise unchanged.
- Committed on the refactor branch before any change to `access.py`.

## Completion evidence

Completed 2026-08-01 on `codex/project-ownership-enforcement` before any
`access.py` change.

```text
uv run ruff check tests/test_project_access_ownership.py  # pass
uv run ty check                                           # pass
uv run pytest tests/test_project_access_ownership.py -q  # 4 failed, 7 passed
```

The four expected failures are stranger GET/PATCH and missing
`projects.access.all` in Admin/staff session payloads. The other seven collected
cases pass, including the anonymous redaction contract. The simplify pass
replaced an eager all-actor fixture with targeted fixtures; no canonical
`context/` update is due until the behavior changes in Phase 2.
