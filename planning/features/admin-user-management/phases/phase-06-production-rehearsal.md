---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Implementation complete; manual staging rehearsal pending (Ed)
AUTHOR: Codex (for Ed May)
SCOPE: Production rehearsal, MVP account lifecycle runbook, and rollout unblock.
RELATED:
  - ../README.md
  - ../STATUS.md
  - ../../v2-production-rollout/PLAN.md
  - ../../v2-production-rollout/STATUS.md
  - context/ENVIRONMENT.md
---

# Phase 06 - Production Rehearsal / Rollout Unblock

## Goal

Prove the MVP feature in the environment shape that production rollout will use
and hand `v2-production-rollout` a clean unblock checklist.

## Implementation Tasks

1. Add account lifecycle runbook to `context/ENVIRONMENT.md`:
   - first-admin bootstrap;
   - invite John;
   - generate reset link;
   - deactivate/reactivate;
   - grant/revoke admin;
   - revoke stale sessions/MCP tokens;
   - break-glass recovery.
2. Rehearse on staging or prod-onrender URL before DNS cutover:
   - bootstrap Ed admin;
   - invite John/test user;
   - complete invite;
   - generate and complete admin reset link;
   - deactivate/reactivate;
   - grant/revoke Admin;
   - inspect audit rows.
3. Verify cookie/Origin/CSRF behavior on the actual deployment origin shape.
4. Update `planning/features/v2-production-rollout/STATUS.md` when unblocked.
5. Run closeout:
   - simplify skill;
   - docs-pass skill;
   - `make format`;
   - `make ci`;
   - graphify update if code changed.

## Verification

- Manual smoke evidence recorded in this feature `STATUS.md`.
- `make ci` green.
- Production rollout docs reference the MVP gate as complete/unblocked.

## Exit Criteria

- Ed can bootstrap and manage production users without manual password seeding.
- All sensitive MVP actions are audited.
- `v2-production-rollout` can proceed to production cutover.

## Outcome (2026-06-27)

**Implementation + automated rehearsal: complete.**

- Account-lifecycle runbook added to `context/ENVIRONMENT.md` ("Admin
  user-management runbook (production)"): first-admin bootstrap/break-glass,
  invite John, generate reset link, deactivate/reactivate, grant/revoke admin,
  revoking stale sessions/MCP tokens, and the cookie/CSRF/secret posture.
- `scripts.bootstrap_admin` verified runnable (`--help`; production requires
  `--confirm-production`).
- The Phase 02–05 test suites are the automated end-to-end rehearsal: they
  exercise bootstrap → invite → complete → sign-in, admin reset link + session
  invalidation, deactivate (revokes sessions + MCP tokens) / reactivate,
  grant/revoke with transactional last-admin protection, CSRF/Origin rejection,
  and deny-by-default authorization. `make ci` green.
- Production rollout docs updated: the MVP gate's **implementation** is complete;
  see `../../v2-production-rollout/STATUS.md`.

## Production-Onrender Rehearsal (2026-06-28)

**Staging and prod-onrender manual rehearsal: complete.**

- Staging rehearsal completed the full lifecycle with a disposable test user:
  bootstrap, invite completion, admin reset-link completion,
  deactivate/reactivate, Admin grant/revoke, non-admin block, and audit rows.
- Production onrender rehearsal completed the same lifecycle with
  `codex-prod-smoke@example.com`; final state is inactive/non-admin.
- Production onrender invite/reset completions required trusted
  `Origin: https://ph-navigator-web.onrender.com` plus `X-PHN-CSRF: 1`; a
  no-Origin completion attempt returned `origin_not_allowed`.
- Read-only Render job `job-d90aju6rnols73egvh30` confirmed the disposable
  production account exists, is inactive, has a password set, has no active
  Admin capability, and has all required audit actions.

**Remaining (manual, require DNS/custom-domain staging):**

1. Add DreamHost DNS records for the Render-pre-staged domains:
   CNAME `api` -> `ph-navigator-api.onrender.com` and CNAME `v0` ->
   `ph-dash-frontend.onrender.com`; wait for Render verification/TLS.
2. Verify cookie/Origin/CSRF on the real split-origin deployment shape
   (`www.ph-nav.com` → `api.ph-nav.com`), confirming `SameSite=Lax`.
3. Re-run a small `/admin/users` browser smoke after custom-domain cutover if
   the frontend/API URLs change.

Because the real custom-domain cookie/CSRF shape is still unverified, this
packet stays in active planning (not archived); the rollout gate's *code* and
prod-onrender rehearsal are ready, while the Phase 2 custom-domain verification
is still open.
