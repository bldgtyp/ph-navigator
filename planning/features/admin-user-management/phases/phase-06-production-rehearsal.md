---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Planned
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
