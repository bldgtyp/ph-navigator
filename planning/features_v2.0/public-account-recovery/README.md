---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Deferred (v2.0 — post-MVP)
AUTHOR: Codex (for Ed May)
SCOPE: Router for public account recovery and transactional account email.
RELATED:
  - PRD.md
  - STATUS.md
  - ../../archive/dated/2026-06-29/admin-user-management/
  - ../../archive/dated/2026-06-28/v2-production-rollout/
---

# Public Account Recovery / Email Delivery

## Purpose

Capture the account-recovery scope intentionally removed from the
Admin User Management MVP: public self-service "Forgot password",
transactional invite/reset emails, provider setup, durable internet-facing rate
limits, and account lifecycle notices.

The MVP keeps the durable token/account-state foundation and admin-generated
reset links. This packet adds the public/email layer later, when the app has
more than the near-term Ed/John internal user set or when manual link delivery
becomes operational friction.

## Read Order

1. `STATUS.md` - current state, trigger, dependencies.
2. `PRD.md` - behavior/security contract.
3. `planning/archive/dated/2026-06-29/admin-user-management/` - the MVP foundation this builds
   on.

## Status

Deferred / post-MVP. Do not block the Ed/John production rollout on this packet.
