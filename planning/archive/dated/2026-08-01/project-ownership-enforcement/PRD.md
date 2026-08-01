---
DATE: 2026-08-01
TIME: 10:14 EDT
STATUS: Archived — implemented and verified on branch
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Behavior contract for project-ownership enforcement at the access seam.
RELATED: ./README.md, ./decisions.md, ./STATUS.md, ./phases/,
  backend/features/projects/access.py, backend/features/access/capabilities.py,
  context/technical-requirements/
---

# PRD — Project-ownership enforcement

## 1. Problem

`capabilities_for` (`backend/features/access/capabilities.py:87`) resolves a
`UserPrincipal` to `MEMBER_CAPS` — `project.view`, `project.edit`,
`project.view.private_metadata`, every export, and `catalog.edit` — for **any**
signed-in user. Those capabilities are global, but project routes use them to
gate project-scoped access. The module docstring already flags this:
"scope-aware resolution against a specific project/team arrives with tenancy
(Phase 5)."

Consequences, all verified (see `README.md` § Evidence):

| Actor | Dashboard list | `GET /projects/{id}` | `PATCH /projects/{id}` | Delete |
| --- | --- | --- | --- | --- |
| Owner | own only | 200 | 200 | 200 |
| **Signed-in stranger** | own only | **200, unredacted** | **200, write lands** | 404 |
| Anonymous | 401 | 200, redacted | 401 | 401 |

Ownership is enforced in exactly one helper, `_ensure_project_owner`
(`backend/features/projects/service.py:592`), called from three places:
`delete_project`, `restore_project`, `hard_delete_project`. Nothing else.

Note the seam never gates **view** mode at all: `require_project_access` only
calls `require_capability(access, PROJECT_EDIT)` when `mode == "edit"`
(`access.py:101`). Read access is ungated by construction.

## 2. Target behavior

A signed-in user may reach a project if and only if they **own it** or hold the
all-projects capability. Everyone else gets `404 project_not_found`.

| Actor | `GET` | `PATCH` / writes | Delete / restore / hard-delete |
| --- | --- | --- | --- |
| Owner | 200 | 200 | 200 |
| Admin (`projects.access.all`) | 200 | 200 | **404** (unchanged, §D-4) |
| Signed-in stranger | **404** | **404** | 404 |
| Anonymous | 200, redacted | 401 | 401 |

**The anonymous row is unchanged.** Preserving it is an acceptance criterion,
not a side effect — it is the public client-viewer contract.

## 3. The change

### 3.1 New capability key

```python
# capabilities.py
# Reach any project regardless of ownership. Derived — never granted directly —
# from the bldgtyp cross-tenant staff flag, or (as a dated bridge) from the
# Admin preset. See planning/archive/dated/2026-08-01/project-ownership-enforcement/
# decisions.md §D-3; the Admin clause is deleted when teams land.
PROJECT_ACCESS_ALL = "projects.access.all"
```

Resolved in `capabilities_for`: a `UserPrincipal` resolves `PROJECT_ACCESS_ALL`
when **`principal.is_staff` is true, or `ADMIN_USERS_MANAGE` is among its
grants**.

`users.is_staff` is the reserved cross-tenant flag — the migration that
introduced it
(`backend/alembic/versions/20260627_0003_access_capability_foundation.py:11`)
names it "bldgtyp cross-tenant flag", and
`planning/features_v2.0/access-capability-enforcement/PRD.md` §3 assigns
cross-tenant reach to `staff`, **not** to `admin` (which is a *team* admin
there). Deriving from `admin.users.manage` alone would design in a demotion for
the Admin preset the day teams arrive (§D-3).

The `ADMIN_USERS_MANAGE` half is a bridge, because `is_staff` has no admin UI —
its only write path is `backend/scripts/manage_user_access.py`.

**Note on `is_staff` today:** it is currently inert. `capabilities_for`
references it only in the early-return guard at `capabilities.py:98`, and both
branches return `MEMBER_CAPS` for a staff user with no grants — so setting the
flag changes nothing observable right now. This refactor gives it its first real
effect. Verify that no test asserts the current no-op behavior.

### 3.2 The seam

In `require_project_access`, after the principal is built and before the
`ProjectAccess` is returned, reject a signed-in principal with no relationship
to the project:

```python
if isinstance(principal, UserPrincipal) and not _may_reach_project(principal, project_row):
    raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
```

`_may_reach_project` is true when `project_row["owner_id"] == principal.user.id`
or `PROJECT_ACCESS_ALL in capabilities_for(principal)`.

Placed *before* the mode branch so it covers view and edit alike. The
`ViewerPrincipal` branch is deliberately untouched.

### 3.3 The MCP sibling

`project_access_for_user` (`access.py:106`) builds a `ProjectAccess` outside the
FastAPI dependency flow for MCP bearer tokens acting as their issuer. It must
apply the same check, or MCP becomes the bypass. Phase 3 verifies that a token
issued by user A cannot reach user B's project.

### 3.4 Error semantics

`404 project_not_found`, not 403 — matching the existing `_ensure_project_owner`
choice. A 403 confirms the project exists to someone who should not know that.
Anonymous callers keep today's 401/redaction behavior.

## 3.5 Forward compatibility with teams

`multi-tenant-teams` §3 states the target predicate:

> Caller may access project *P* if **(a)** `P.owner_id == caller.id`, **or**
> **(b)** caller is an **admin** of `P.team_id`.

`_may_reach_project` implements (a) plus a global escape hatch. Write it as
ordered independent clauses so (b) is an insertion, not a rewrite.

`projects.team_id` **already exists** — nullable, no FK, NULL on every row,
meaning "legacy/bldgtyp-internal" per its migration docstring. Do not add,
backfill, or read it here. Just do not write a predicate that would have to be
torn up to accept it. (§D-7.)

## 4. Out of scope

- Per-project membership / sharing (deferred Phase 5 tenancy — `teams`,
  `team_members`, the `projects.team_id` FK, `project_shares`, the `certifier`
  principal, scoped `team`/`project` grant resolution).
- The per-project `access_mode` column from the 2026-06-27 review — which
  project is *publicly* reachable by link is a separate question (§D-5).
- Changing what an admin may **delete** (§D-4).
- The dashboard listing query — that is the dependent feature's job.
- Gating catalog writes. Any signed-in user can write the shared catalogs today
  (`MEMBER_CAPS` includes `CATALOG_EDIT`); that is deliberate live behavior, and
  only the *docs* describing it are stale. Phase 4 corrects the docs and nothing
  else (§D-8).

## 5. Acceptance criteria

1. Signed-in stranger gets 404 on `GET`, `PATCH`, and a representative sample of
   the project-reachable HTTP surface.
2. Owner behavior is byte-identical to today across the same sample.
3. Admin (holding `ADMIN_USERS_MANAGE`) reads and writes any project.
4. **Anonymous regression guard**: `GET` returns 200 with `client`,
   `phius_dropbox_url`, and `owner_display_name` redacted and
   `access_mode == "viewer"`; `PATCH` returns 401.
5. An MCP token issued by user A returns 404 against user B's project.
6. Destructive routes keep owner-only semantics; no new admin delete power.
7. `make ci` green, including the existing
   `test_dashboard_list_is_filtered_to_owner`.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| A real workflow depends on cross-user reach (dev seed, agent-browser fixture, MCP) | Phase 1 lands tests first; Phase 3 runs `make agent-browser-ready` + `make smoke-mcp-local` before merge |
| A route bypasses the seam and stays open | Phase 3 inventories every registered project feature module and the shared access unit; current counts and every verdict live in `implementation-report.md` |
| Silent breakage of the public viewer | Criterion 4 is a dedicated regression test, not a manual check |
| Production data where projects were created by the "wrong" owner | The production `projects.owner_id` distribution remains an explicit pre-deploy operator query; **Ed's call** whether any re-assignment is needed |
