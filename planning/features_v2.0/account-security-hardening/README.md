---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Deferred (v2.0 — post-MVP)
AUTHOR: Codex (for Ed May)
SCOPE: Router for account-security hardening beyond the Admin User Management MVP.
RELATED:
  - PRD.md
  - STATUS.md
  - ../../features/admin-user-management/
  - ../public-account-recovery/
  - ../access-capability-enforcement/
---

# Account Security Hardening

## Purpose

Capture the account-security work intentionally deferred from the two-user
Admin User Management MVP: fresh admin re-authentication, MFA/passkeys, recovery
codes, suspicious activity alerts, session/device inventory, automated token
cleanup, and audit export.

The MVP keeps the foundational account-token, admin capability, revocation, and
audit rows. This packet is for stronger assurance once the user base, support
surface, or external access model justifies it.

## Read Order

1. `STATUS.md` - current state, trigger, dependencies.
2. `PRD.md` - hardening candidates and acceptance boundaries.
3. `planning/features/admin-user-management/` - MVP account lifecycle foundation.

## Status

Deferred / post-MVP. Do not block the Ed/John production rollout on this packet.
