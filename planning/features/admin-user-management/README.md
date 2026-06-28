---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Router for the near-term Admin User Management MVP planning packet.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./research.md
  - ./reviews/2026-06-27-security-use-case-review.md
  - ../v2-production-rollout/PLAN.md
  - ../../features_v2.0/public-account-recovery/
  - ../../features_v2.0/account-security-hardening/
  - ../../features_v2.0/access-capability-enforcement/
  - ../../features_v2.0/multi-tenant-teams/
---

# Admin User Management MVP

## Purpose

Define the near-term production user-control feature for PH-Navigator V1
(current local repo: `ph-navigator-v2`): audited first-admin bootstrap,
invite-only Ed/John account creation, admin-generated reset links, user
revocation/reactivation, `admin.users.manage` grants, minimal audit evidence,
and the production rollout unblock path.

This is still a planning packet only. No implementation has started.

This feature is a **production-rollout prerequisite**, but only for the
two-person internal MVP threshold described here. Broader account recovery,
email delivery, MFA/passkeys, richer IAM, external users, certifier/client
accounts, and audit exports are split into deferred `features_v2.0/` packets.

## Read Order

1. `STATUS.md` - current state, MVP/deferred split, next step, blockers.
2. `PRD.md` - near-term behavior and security contract.
3. `PLAN.md` - implementation sequence.
4. `reviews/2026-06-27-security-use-case-review.md` - security review with MVP
   split addendum.
5. `research.md` - OWASP/NIST guidance and current-code findings.
6. `phases/` - phase-specific MVP implementation plans.

## Phase Map

| Phase | Goal | Status |
| --- | --- | --- |
| 00 | Lock MVP decisions, threat model, rollout gate, and deferred-feature links | Complete |
| 01 | Cookie/Origin/CSRF posture for credentialed admin mutations | Complete |
| 02 | Account lifecycle schema, token storage, and bootstrap command | Complete |
| 03 | Backend MVP account-token and user-admin services | Complete |
| 04 | Admin/API authorization contracts for MVP routes | Planned |
| 05 | Minimal admin dashboard and invite/reset-link frontend flows | Planned |
| 06 | Production rehearsal, runbook, and rollout unblock | Planned |

## Deferred Feature Packets

- `planning/features_v2.0/public-account-recovery/` - public forgot-password,
  transactional email provider/templates, durable public rate limiting, and
  email-based account notices.
- `planning/features_v2.0/account-security-hardening/` - fresh admin re-auth,
  MFA/passkeys, session/device inventory, suspicious activity alerts, automated
  token cleanup, and audit export.
- `planning/features_v2.0/access-capability-enforcement/` - broader
  capability/role enforcement, certifier/client share principals, and richer IAM
  once the external-user trigger exists.
- `planning/features_v2.0/multi-tenant-teams/` - teams, tenants, external
  members, and the cross-tenant access boundary.

## Current Recommendation

Complete Phases 00-06 before executing the production rollout. The only manual
operator action that should remain is the audited, one-time bootstrap of the
first admin account; normal Ed/John account creation, reset-link generation,
deactivation/reactivation, and admin grant/revoke flows should be exercised
through the app before `www.ph-nav.com` is cut over.
