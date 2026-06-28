---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Lock MVP decisions, threat model, rollout gate, and deferred-feature links.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
  - ../reviews/2026-06-27-security-use-case-review.md
  - ../../v2-production-rollout/STATUS.md
  - ../../../features_v2.0/public-account-recovery/
  - ../../../features_v2.0/account-security-hardening/
---

# Phase 00 - MVP Decisions / Threat Model

## Goal

Turn the planning packet into a locked MVP implementation contract and make the
reduced production-rollout dependency explicit.

## Decisions To Lock

1. Token lifetimes: proposed invite 7 days, admin-generated reset 30 minutes.
2. Manual link handling: show one-time invite/reset links in admin UI, command
   output, or both.
3. Cookie/CSRF path: prefer production `SameSite=Lax` if verified; otherwise
   keep `SameSite=None` only with Origin/custom-header protection.
4. Role presets: MVP includes only `User` and `Admin`.
5. Deferred split:
   - public reset/email/rate limiting -> `features_v2.0/public-account-recovery`;
   - re-auth/MFA/session inventory/audit export -> `features_v2.0/account-security-hardening`;
   - richer IAM/external users -> existing v2.0 access/tenancy packets.

## Threat Model

Assets:

- user credentials and password hashes;
- invite/reset tokens;
- session cookies;
- MCP tokens;
- admin capability grants;
- user/admin audit history;
- project data reachable by an authenticated user.

Primary attackers:

- authenticated normal user attempting admin endpoints;
- browser-based CSRF from a malicious site;
- stale or compromised staff account;
- DB-only reader who sees token hashes;
- operator mistake during production bootstrap or manual link delivery.

Security goals:

- no admin mutation from untrusted origins;
- no admin-visible temporary passwords;
- no reusable or logged account-recovery token;
- no last-admin lockout;
- immediate session/MCP-token revocation on deactivate/reset;
- durable audit trail for sensitive MVP lifecycle changes.

Deferred public-reset goals, including no user enumeration and durable
internet-facing rate limiting, move to `features_v2.0/public-account-recovery/`.

## Implementation Tasks

1. Update `planning/features/v2-production-rollout/STATUS.md` and `PLAN.md` so
   Admin User Management is a blocker only for the MVP threshold.
2. Confirm the decisions above in `STATUS.md`.
3. Add accepted scope decisions to `PRD.md`.
4. Confirm deferred v2.0 packets exist and are linked from this feature.

## Verification

- Docs-only: `git diff --check`.
- No code gates in this phase.

## Exit Criteria

- MVP decisions are settled.
- Deferred work has a named `features_v2.0/` home.
- Production rollout docs say this MVP, not broad IAM/account recovery, is
  blocking.
- Phase 01 can start without re-litigating the cookie/CSRF direction.
