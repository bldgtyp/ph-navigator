---
DATE: 2026-08-01
TIME: 09:44 EDT
STATUS: Active — Phase 3 complete
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers for project-ownership enforcement.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/
---

# Status

## State

**Phase 3 complete.** Project reach is owner-or-`projects.access.all` for
signed-in REST and MCP principals, and the full project route surface has been
verified on-seam. Anonymous read-only access is unchanged.

Done 2026-08-01:
- Reproduced the cross-user read/write gap against the local test database with
  a two-user probe (throwaway test, removed; results transcribed into
  `README.md` § Evidence).
- Reproduced the anonymous path separately and confirmed it is **working as
  designed** — read-only, private metadata redacted, writes 401. Scoped out
  (`decisions.md` §D-5).
- Established the blast radius: 96 gated endpoints across 18 feature modules,
  all funnelling through `require_project_access`.
- Found the only existing ownership check — `_ensure_project_owner`, three call
  sites, all destructive.
- D-1..D-6 accepted by Ed.
- Added `backend/tests/test_project_access_ownership.py`: four intentional
  failures (stranger GET/PATCH plus Admin/staff capability exposure) and seven
  green preservation cases (owner, dashboard filtering, elevated read/write,
  elevated delete denial, and anonymous read-only redaction).
- Phase 1 simplify pass split actor setup into targeted fixtures, avoiding
  repeated password hashing and 44 eager logins; reuse and efficiency reviews
  found no remaining issue. Ruff and `ty` are clean.
- Added `PROJECT_ACCESS_ALL`, derived for `is_staff` and the interim Admin
  preset; enforced it with ownership in `require_project_access` before the
  deleted-project branch and in `project_access_for_user`.
- Updated sidebar/table view-state isolation tests so their second actor holds
  legitimate all-project reach; ordinary signed-in strangers now correctly
  receive 404 before per-user view state is considered.
- Phase 2 simplify/docs passes complete. `make format` changed nothing and
  `make ci` passed (`1752 passed`, `7 skipped` backend; frontend tests and
  production build green).
- Audited every registered project feature module and all 103 current
  project-reachable HTTP operations. All route modules are on-seam; the three
  project destructive operations intentionally remain stricter and owner-only.
- The deeper MCP sweep found metadata/list tools that checked token scope but
  did not re-check issuer ownership. Phase 3 routed those reads through
  `project_access_for_token` and added structured `project_not_found` mapping.
- Added six stranger probes across document, apertures, envelope, model data,
  signed asset URLs, and status, plus the stale cross-user MCP-token case. The
  ownership suite is green at 13 tests.
- `make smoke-mcp-local`, `make agent-browser-ready`, and an authenticated
  `agent-browser.mjs` load of the task-owned fixture all passed. See
  `implementation-report.md` for the module verdict table and evidence.
- **Reviewed against the three deferred v2.0 packets**
  (`access-capability-enforcement`, `account-security-hardening`,
  `multi-tenant-teams`). Result: the seam choice and the access predicate line
  up exactly; the gap is already owned by `multi-tenant-teams` R1 and this is
  its owner-half done early (§D-7); one real conflict found and resolved — v2.0
  reserves cross-tenant reach for `staff`, not `admin`, so the derivation is now
  `is_staff OR admin.users.manage` (§D-3). Added §D-7, §D-8; amended §D-3, §D-4,
  §D-5, §D-6.

## Next step

**Phase 4** — `phases/phase-04-docs.md`. Fold the shipped ownership contract
into canonical access/public-viewer docs, correct the deferred v2.0 packets,
then run the final simplify/docs/format/CI closeout.

## Blockers

None.

## Open questions for Ed

1. **Production owner distribution.** Before this deploys, Ed must run and
   review `SELECT owner_id, count(*) FROM projects WHERE deleted_at IS NULL
   GROUP BY owner_id` on production. It was not run during Phase 3 because no
   production access was authorised; this remains a pre-deploy operator gate,
   not an implementation blocker.
2. **Setting `is_staff` in production** (Phase 2 §2.1b) — a one-time script run
   per admin account. Not urgent: the `admin.users.manage` bridge clause keeps
   admins working without it. Ed's call, alongside the deploy.

## Verification

Phase 1 evidence:

```text
cd backend
uv run ruff check tests/test_project_access_ownership.py  # pass
uv run ty check                                           # pass
uv run pytest tests/test_project_access_ownership.py -q  # 4 failed, 7 passed (expected)
```

Phase 2 evidence:

```text
uv run pytest tests/test_project_access_ownership.py -q  # 11 passed
make format                                               # no changes
make ci                                                   # pass
```

Per PRD §5. The two that matter most and are easiest to skip:

- Criterion 4, the **anonymous regression guard** — the public viewer breaking
  silently is the most likely way this refactor causes damage.
- Criterion 5, the **MCP path** — `project_access_for_user` is a second entry
  point into the same `ProjectAccess`; fixing only the FastAPI dependency leaves
  a bypass.

## Dependents

Both are blocked on Phase 2 being merged.

1. **`planning/features/admin-all-projects-dashboard/`** — needs
   `PROJECT_ACCESS_ALL` to exist.
2. **`planning/features/agent-access-kit/`** Phase 01 (user-scoped MCP tokens)
   — its §D-6 gates on this refactor, and its cross-user tests explicitly ride
   **this plan's Phase 1 fixtures**. Two consequences:
   - Phase 1's test file is a **published contract**, not private scaffolding.
     Name the fixtures deliberately and do not reshape them casually.
   - Its §D-14 now matches our §D-2 (`404 project_not_found` /
     `recoverability: "refresh"`, not `403 forbidden`) — it originally
     specified the opposite in three places. Aligned 2026-08-01.

Note for Phase 3 §3.3: agent-access-kit introduces a **second MCP principal
type** (user-scoped tokens, authorizing every project their user can reach).
Our MCP verification covers today's per-project tokens only. Whoever builds
that phase inherits the same seam requirement — `project_access_for_user` must
stay the single path, and a user token must never widen beyond its issuer.
