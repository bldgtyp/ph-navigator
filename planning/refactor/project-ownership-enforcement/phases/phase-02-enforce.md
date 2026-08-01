---
DATE: 2026-08-01
TIME: 09:38 EDT
STATUS: Complete
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Phase 2 — enforce ownership at the project access seam.
RELATED: ../PRD.md, ../decisions.md, ./phase-01-reproduce.md, ./phase-03-sweep.md
---

# Phase 2 — Enforce

Turn Phase 1's four red cases green without turning anything else red.

## Files

| File | Change |
| --- | --- |
| `backend/features/access/capabilities.py` | Add `PROJECT_ACCESS_ALL`; derive it from `ADMIN_USERS_MANAGE` in `capabilities_for` |
| `backend/features/projects/access.py` | Add `_may_reach_project`; call it in `require_project_access` and `project_access_for_user` |

Two files. If the diff grows past that, something is being done at the wrong
altitude — stop and re-read `decisions.md` §D-6.

## 2.1 Capability key

```python
# Reach any project regardless of ownership. Derived, never granted directly:
# from users.is_staff (the reserved bldgtyp cross-tenant flag) or — as a dated
# bridge until teams land — from the Admin preset. See planning/refactor/
# project-ownership-enforcement/decisions.md §D-3.
PROJECT_ACCESS_ALL = "projects.access.all"
```

In `capabilities_for`, in the `UserPrincipal` branch, add `PROJECT_ACCESS_ALL`
when `principal.is_staff` **or** `ADMIN_USERS_MANAGE in
principal.granted_capabilities`.

**Watch the early return at `capabilities.py:98`:**

```python
if not principal.granted_capabilities and not principal.is_staff:
    return MEMBER_CAPS
```

A staff user with no grants currently takes the *second* path and still gets
plain `MEMBER_CAPS` — which is why `is_staff` is observably inert today. The new
derivation must sit on the path that actually runs for **both** a staff-only
user and a granted admin. The cleanest fix is to compute the derived set once
after the guard rather than bolting it onto one branch.

Confirm no existing test asserts that `is_staff` has no effect — this change
gives the flag its first real behavior.

`PROJECT_ACCESS_ALL` will now appear in `/api/v1/auth/session` `capabilities`
for admins and staff, since that endpoint returns
`sorted(global_capabilities_for_user(user))`. That is intended — the dependent
feature reads it.

## 2.1b Set `is_staff` for current admins

One-time, using the existing script — no migration:

```bash
cd backend && uv run python -m scripts.manage_user_access set-staff --email <admin-email>
```

Local/test first; production is Ed's call and should happen **with** the deploy,
not before it. Until it runs, admins still resolve the capability through the
`ADMIN_USERS_MANAGE` bridge clause, so nothing breaks if it is deferred.

## 2.2 The seam

In `require_project_access`, after the `with connection()` block that builds
`principal` and `project`, before the `mode == "edit"` branch:

```python
if isinstance(principal, UserPrincipal) and not _may_reach_project(principal, project_row):
    raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
```

```python
def _may_reach_project(principal: UserPrincipal, project_row: Mapping[str, Any]) -> bool:
    """Owner, or a principal holding `projects.access.all`.

    Anonymous never reaches here — `ViewerPrincipal` is filtered by the caller.
    Ordered independent clauses: the team clause from `multi-tenant-teams` §3
    ("caller is an admin of P.team_id") inserts here as a third branch without
    disturbing the other two. `projects.team_id` already exists (nullable, NULL
    everywhere, no FK) — do not read it yet.
    """
    if project_row["owner_id"] == principal.user.id:
        return True
    return PROJECT_ACCESS_ALL in capabilities_for(principal)
```

Three things to get right:

1. **Placement is before the mode branch**, so it covers view *and* edit. Read
   access is currently ungated at the seam (`access.py:101` only gates edit);
   this is the line that closes that.
2. **`ViewerPrincipal` must not be affected.** The `isinstance` guard is the
   whole anonymous contract — Phase 1 case 9 proves it.
3. **`project_row` is already in scope** and already selects `owner_id`
   (`repository.py:22`). No new query. Keep the check inside the existing
   `with connection()` block or pass the row out — do not open a second
   connection; the existing code comments at `access.py:73` explain why.

## 2.3 The MCP sibling

`project_access_for_user` (`access.py:106`) constructs a `ProjectAccess`
directly. Apply the same predicate there. It receives a `ProjectSummary`, not
the raw row, and `ProjectSummary` has no `owner_id` — either fetch the row or
pass `owner_id` in. Fetching inside the existing `with connection()` block is
the smaller change.

Leaving this out makes MCP a complete bypass of the fix.

## 2.4 Ordering against the 410-deleted branch

`require_project_access` raises `410 project_deleted` before any ownership
consideration today. After the fix, a **stranger** hitting a deleted project
would learn it once existed. Put the ownership check **before** the deleted
check so strangers get a uniform 404.

Owners keep the 410 + restore affordance — that path is unchanged for them.

## Exit criteria

- Phase 1 cases 1 and 2 now 404; cases 3–10 unchanged.
- `uv run ty` clean.
- `make ci` green.
- Diff touches two files.

## Completion evidence

Completed 2026-08-01. The behavior change is confined to the two planned
production files. Test/docs-pass updates also removed temporary Phase 1
comments and adapted three user-scoped view-state tests so the second user has
legitimate staff reach.

```text
uv run pytest tests/test_project_access_ownership.py -q  # 11 passed
uv run pytest <3 view-state regressions> ... -q          # 14 passed with ownership suite
uv run ty check                                          # pass
make format                                              # no changes
make ci                                                  # pass; backend 1752 passed, 7 skipped
```

Simplify findings addressed: reused the production capability constant and
staff test helper, retained the ordinary-member fast return, and kept the
intentional centralized project re-fetch in `project_access_for_user` instead
of widening three caller contracts.
