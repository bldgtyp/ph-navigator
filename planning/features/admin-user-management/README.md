---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Router for the admin user-management planning packet.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./research.md
  - ./reviews/2026-06-27-security-use-case-review.md
  - ../v2-production-rollout/PLAN.md
---

# Admin User Management

## Purpose

Define the production user-control feature for the new PH-Navigator V1
(current local repo: `ph-navigator-v2`): admin-visible user list, invite/create
user, self-service and admin-triggered password reset, user revocation,
role/capability grants, audit visibility, and the production bootstrap path.

This is a planning packet only. No implementation has started.

This feature is now a **production-rollout prerequisite**. The production
rollout plan must not proceed past infrastructure rehearsal until the blocking
phases here are implemented and verified.

## Read Order

1. `STATUS.md` - current state, next step, blockers.
2. `PRD.md` - user-facing behavior and security contract.
3. `PLAN.md` - implementation sequence.
4. `reviews/2026-06-27-security-use-case-review.md` - review findings and
   use-case coverage.
5. `research.md` - OWASP/NIST guidance and current-code findings.
6. `phases/` - phase-specific implementation plans.

## Phase Map

| Phase | Goal | Status |
| --- | --- | --- |
| 00 | Lock decisions, threat model, and rollout gate | Planned |
| 01 | Session-cookie, CSRF, and public auth abuse controls | Planned |
| 02 | Account lifecycle schema, token storage, and bootstrap command | Planned |
| 03 | Backend account-token and user-admin services | Planned |
| 04 | Admin/public API with authorization gates and audit logging | Planned |
| 05 | Transactional email delivery and templates | Planned |
| 06 | Admin dashboard and invite/reset frontend flows | Planned |
| 07 | Production rehearsal, runbook, and rollout unblock | Planned |
| 08 | Post-rollout hardening: MFA/passkeys and broader IAM | Deferred |

## Current Recommendation

Complete Phases 00-07 before executing the production rollout. The only manual
operator action that should remain is the audited, one-time bootstrap of the
first admin account; normal Ed/John account creation, reset, revoke, and admin
grant flows should be exercised through the app before `www.ph-nav.com` is
cut over.
