---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Deferred
AUTHOR: Codex (for Ed May)
SCOPE: Post-rollout account-security hardening candidates.
RELATED:
  - ../PRD.md
  - planning/features_v2.0/access-capability-enforcement/
  - planning/features_v2.0/multi-tenant-teams/
---

# Phase 08 - Later Hardening

## Goal

Record security improvements that are important but not required to unblock the
two-user internal production rollout.

## Candidates

1. MFA or passkeys for admin accounts.
2. Recovery codes or secondary authenticators.
3. Richer team/project roles once tenancy lands.
4. Certifier/client user accounts or account-bound share links.
5. Admin audit export.
6. Automated expired-token cleanup job.
7. Admin alerting for suspicious reset/invite patterns.
8. Account lock or step-up policy after high-risk events.
9. Session-device inventory if multi-session support ever replaces the current
   single-active-session model.

## Trigger

Promote this phase before:

- broad external/client access;
- tenant/team membership;
- certifier accounts;
- more than the Ed/John internal admin group;
- any requirement for contractual security controls beyond the current internal
  tool posture.

## Verification

Not applicable until promoted.
