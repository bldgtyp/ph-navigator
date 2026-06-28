---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Deferred (v2.0 — post-MVP)
AUTHOR: Codex (for Ed May)
SCOPE: State tracker for public account recovery and transactional email.
RELATED:
  - README.md
  - PRD.md
  - ../../features/admin-user-management/STATUS.md
---

# STATUS - Public Account Recovery / Email Delivery

**State:** Deferred / post-MVP. No code, no schema beyond the MVP
`account_tokens` foundation, no schedule.

## Where Things Stand

- Admin User Management MVP will create the `account_tokens` foundation,
  invite/reset completion routes, and admin-generated one-time links.
- Public "Forgot password" is deliberately out of the MVP because Ed and John
  can recover accounts through an admin-generated reset link or bootstrap
  command.
- Transactional email provider setup is deliberately out of MVP; manual link
  delivery is acceptable for two internal users.
- Durable public rate limiting is deferred because there is no public reset
  endpoint in the MVP.

## Trigger

Promote this packet when any of these become true:

- manual invite/reset link delivery is annoying or error-prone;
- more than Ed/John need normal account recovery;
- external/client/certifier accounts are being planned;
- compliance or support expectations require user-visible email notices.

## Dependencies

- Admin User Management MVP's token table and invite/reset completion flows.
- A chosen transactional email provider and verified sending domain.
- A durable rate-limit storage strategy or platform control for public
  internet-facing endpoints.

## Next Step If Promoted

1. Choose provider: Resend, Postmark, SMTP, or another production path.
2. Define rate-limit storage and dimensions: normalized email, IP, action, and
   optionally user id.
3. Promote this folder to `planning/features/` and write phase plans.

## Verification

None — nothing built.
