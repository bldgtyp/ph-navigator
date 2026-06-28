---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Lock decisions, threat model, and rollout gate before implementation.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
  - ../reviews/2026-06-27-security-use-case-review.md
  - ../../v2-production-rollout/STATUS.md
---

# Phase 00 - Decisions / Threat Model

## Goal

Turn the planning packet into a locked implementation contract and make the
production-rollout dependency explicit.

## Decisions To Lock

1. Email provider: Postmark, Resend, SMTP, or another provider.
2. Token lifetimes: proposed invite 7 days, reset 30 minutes, fresh admin re-auth
   10 minutes.
3. Role presets: `User`, `Admin`, and whether `Catalog Admin` appears as a
   first-pass preset or lower-level capability control.
4. Cookie/CSRF path: prefer production `SameSite=Lax` if verified; otherwise
   keep `SameSite=None` only with CSRF middleware.
5. MFA/passkeys: explicitly deferred until Phase 08 / before external accounts.

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

- unauthenticated internet user probing reset/invite endpoints;
- authenticated normal user attempting admin endpoints;
- browser-based CSRF from a malicious site;
- stale or compromised staff account;
- DB-only reader who sees token hashes;
- operator mistake during production bootstrap.

Security goals:

- no user enumeration from public reset;
- no admin mutation from untrusted origins;
- no admin-visible temporary passwords;
- no reusable or logged account-recovery token;
- no last-admin lockout;
- immediate session/MCP-token revocation on deactivate/reset;
- durable audit trail for sensitive lifecycle changes.

## Implementation Tasks

1. Update `planning/features/v2-production-rollout/STATUS.md` and `PLAN.md` so
   admin-user-management is a blocker after infrastructure rehearsal.
2. Confirm the decisions above in `STATUS.md`.
3. Add any accepted decision notes to `PRD.md`.
4. Check whether `context/ENVIRONMENT.md` needs an early note that production
   account lifecycle is blocked pending this feature.

## Verification

- Docs-only: `git diff --check`.
- No code gates in this phase.

## Exit Criteria

- Open decisions are either settled or assigned to a later phase with an owner.
- Production rollout docs say this feature is blocking.
- Phase 01 can start without re-litigating cookie/CSRF direction.
