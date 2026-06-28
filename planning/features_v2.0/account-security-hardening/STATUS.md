---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Deferred (v2.0 — post-MVP)
AUTHOR: Codex (for Ed May)
SCOPE: State tracker for account-security hardening.
RELATED:
  - README.md
  - PRD.md
  - ../../features/admin-user-management/STATUS.md
---

# STATUS - Account Security Hardening

**State:** Deferred / post-MVP. No code, no schema, no schedule.

## Where Things Stand

- Admin User Management MVP will add admin capability checks, account tokens,
  reset/invite completion, session/MCP revocation, last-admin protection, and
  audit rows.
- Fresh admin re-auth was judged good practice but too much for the Ed/John MVP.
- MFA/passkeys, session inventory, audit export, suspicious activity alerts, and
  automated token cleanup are useful later hardening, not current rollout gates.

## Trigger

Promote this packet before:

- broad external/client access;
- tenant/team membership;
- certifier accounts;
- more than the Ed/John internal admin group;
- contractual security controls;
- routine support by people other than Ed/John.

## Dependencies

- Admin User Management MVP account-token and audit foundations.
- Public account recovery/email delivery if hardening relies on email notices or
  authenticator recovery flows.
- Access-capability enforcement if hardening depends on richer roles.

## Next Step If Promoted

1. Choose the first hardening increment: fresh admin re-auth is the likely
   smallest standalone step.
2. Promote this folder to `planning/features/` and split into phases.
3. Re-check OWASP/NIST guidance and current code before implementation.

## Verification

None — nothing built.
