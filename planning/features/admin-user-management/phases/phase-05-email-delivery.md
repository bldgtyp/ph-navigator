---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Transactional email provider, templates, local/test outbox, and delivery runbook.
RELATED:
  - ../PRD.md
  - ../STATUS.md
  - context/ENVIRONMENT.md
  - render.yaml
---

# Phase 05 - Email Delivery

## Goal

Deliver invite/reset/account notices through a production-safe mailer while
keeping local/test runs deterministic and free of accidental real email.

## Implementation Tasks

1. Choose provider and configure domain authentication:
   - SPF/DKIM/DMARC as required by the provider;
   - production secrets in Render/1Password, never committed.
2. Add mailer abstraction:
   - provider-backed implementation for production;
   - local/test outbox implementation;
   - failure mode that records/send-fails without consuming tokens.
3. Add templates:
   - invite;
   - invite resent;
   - password reset;
   - password reset completed;
   - account deactivated/reactivated;
   - admin capability changed, if useful.
4. Generate links from configured canonical frontend base URL, never request
   `Host`.
5. Prefer URL fragments for raw account tokens so static-host request logs do
   not receive token query strings.
6. Add delivery audit/status fields if needed for admin troubleshooting.
7. Document provider setup and resend/break-glass behavior in
   `context/ENVIRONMENT.md`.

## Verification

- Unit tests for template rendering with token redaction.
- Integration tests with fake/local outbox.
- Manual staging smoke: invite/reset email appears in test mailbox or provider
  sandbox, link completes the flow.
- `make ci` at phase close.

## Exit Criteria

- Invite/reset emails can be sent in staging/production.
- Local/test never sends real email.
- Failed delivery does not consume tokens.
- Production setup steps are documented.
