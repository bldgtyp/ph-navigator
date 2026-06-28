---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Deferred (v2.0 — post-MVP)
AUTHOR: Codex (for Ed May)
SCOPE: Product/security contract for public account recovery and account email.
RELATED:
  - README.md
  - STATUS.md
  - ../../features/admin-user-management/PRD.md
---

# PRD - Public Account Recovery / Email Delivery

## Goal

Add the public and email-based account lifecycle layer on top of the
Admin User Management MVP foundation:

- self-service "Forgot password" from sign-in;
- transactional invite/reset/account-notice emails;
- provider-backed production delivery with local/test outbox;
- durable public rate limiting;
- generic reset responses that do not reveal whether an email exists.

## Scope

### Public Password Reset

Routes:

- `POST /api/v1/auth/password-reset/request`
- `POST /api/v1/auth/password-reset/complete`

Requirements:

- response is generic for existing and non-existing emails;
- response timing should not reveal whether the email exists;
- rate-limit per normalized email, IP, and action;
- do not deactivate, lock, or otherwise mutate the account until a valid token
  is presented;
- use the MVP account-token table with keyed hashes, single-use semantics, and
  short expiry;
- require normal sign-in after reset completion.

### Transactional Email

Provider:

- choose and document provider: Resend, Postmark, SMTP, or another production
  path;
- configure SPF/DKIM/DMARC as required;
- store production secrets in Render/Apple Passwords, never git.

Mailer abstraction:

- provider-backed implementation for production;
- local/test outbox implementation;
- failure mode that records/send-fails without consuming tokens.

Templates:

- invite;
- invite resent;
- password reset;
- password reset completed;
- account deactivated/reactivated;
- admin capability changed, if useful.

Link handling:

- generate links from configured canonical frontend base URL, never request
  `Host`;
- prefer URL fragments for raw account tokens so static-host request logs do
  not receive token query strings;
- never log or persist raw tokens.

### Rate Limiting

Durable rate limiting is required for public reset and invite resend:

- dimensions: normalized email, IP, action, and optionally user id;
- storage: DB-backed table, Redis/platform equivalent, or another durable
  production control;
- throttled public reset responses remain generic.

## Non-Goals

- Public signup.
- Social/OAuth login.
- MFA/passkeys.
- Team/external-user account management.
- Replacing the Admin User Management MVP dashboard.

## Acceptance Criteria

1. A user can request reset from the sign-in page without account enumeration.
2. Reset email is sent through the configured provider in staging/production.
3. Local/test environments use an outbox and never send real email.
4. Reset tokens expire, cannot be reused, and are not logged.
5. Failed delivery does not consume the token.
6. Public reset and invite resend are durably rate-limited.
7. `make ci` passes with focused backend/frontend coverage.
