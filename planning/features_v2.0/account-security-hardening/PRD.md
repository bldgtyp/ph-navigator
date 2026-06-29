---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Deferred (v2.0 — post-MVP)
AUTHOR: Codex (for Ed May)
SCOPE: Product/security contract for post-MVP account-security hardening.
RELATED:
  - README.md
  - STATUS.md
  - ../../archive/dated/2026-06-29/admin-user-management/PRD.md
---

# PRD - Account Security Hardening

## Goal

Strengthen PH-Navigator account security after the Admin User Management MVP is
in place and the user/support surface justifies more assurance.

## Candidate Increments

### Fresh Admin Re-Authentication

Add a short fresh-auth marker for sensitive admin actions:

- reset-link generation;
- deactivate/reactivate;
- grant/revoke `admin.users.manage`;
- `catalog.edit` / `is_staff` changes if those are later exposed.

Likely route:

- `POST /api/v1/auth/reauth`

Acceptance:

- fresh-auth expires after a short window;
- stale or missing fresh-auth rejects sensitive actions;
- fresh-auth events are audited without logging passwords.

### MFA / Passkeys

Add stronger authenticators for admin accounts before broad external access:

- passkeys or TOTP;
- recovery codes or secondary authenticators;
- enrollment/revocation audit events;
- break-glass recovery policy.

### Session / Device Inventory

Expose and manage active sessions if the app moves beyond the current
single-active-session model:

- list current sessions/devices;
- revoke selected sessions;
- detect suspicious new-device or geo/IP changes if useful.

### Alerts And Cleanup

Add operational hardening around account-token lifecycle:

- suspicious reset/invite pattern alerts;
- automated expired-token cleanup;
- admin notification emails for high-risk changes, if email delivery exists.

### Audit Export

Add export/reporting for account audit data:

- CSV or admin report export;
- filters by user/action/date;
- no secrets, tokens, or session ids.

## Non-Goals

- Public account recovery/email provider setup; that is
  `planning/features_v2.0/public-account-recovery/`.
- Teams, tenants, certifier/client accounts; those are
  `planning/features_v2.0/multi-tenant-teams/` and
  `planning/features_v2.0/access-capability-enforcement/`.
- Replacing the Admin User Management MVP.

## Acceptance Boundary

This packet is intentionally not one monolithic feature. When promoted, choose
one hardening increment and write a focused phase plan around it. Fresh admin
re-auth is the likely first candidate because it is smaller than MFA and does
not require external users.
