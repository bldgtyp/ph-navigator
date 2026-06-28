---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Cookie posture and unsafe admin mutation protection for the MVP.
RELATED:
  - ../PRD.md
  - ../research.md
  - ../reviews/2026-06-27-security-use-case-review.md
  - backend/config.py
  - backend/main.py
  - frontend/src/shared/api/client.ts
---

# Phase 01 - Session / Origin / CSRF

## Goal

Make credentialed unsafe admin methods safe enough for the MVP user-management
surface.

## Implementation Tasks

1. Cookie posture:
   - test production-domain shape locally or in staging for
     `www.ph-nav.com` -> `api.ph-nav.com` with `SameSite=Lax`;
   - if it works, update production rollout/env docs to use Lax;
   - if it does not, document why and keep `SameSite=None` only with Origin /
     custom-header protection.
2. Unsafe admin mutation guard:
   - add middleware or route dependency for unsafe methods;
   - require trusted `Origin` for credentialed browser requests;
   - require an app-only custom header/token for unsafe API requests;
   - exempt true bearer-token MCP routes only if they do not depend on cookies.
3. Frontend client:
   - add the required custom header in `fetchJson` / `fetchBlob`;
   - keep multipart upload behavior intact.
4. Tests:
   - unsafe cookie-auth request from untrusted Origin fails;
   - missing custom header fails;
   - trusted app request passes.

Deferred:

- public reset/invite-resend rate limiting belongs to
  `planning/features_v2.0/public-account-recovery/`.
- fresh admin re-auth belongs to
  `planning/features_v2.0/account-security-hardening/`.

## Verification

- Backend focused tests for Origin/custom-header behavior.
- Frontend API-client tests if header logic is test-covered locally.
- `make ci` at phase close if code lands.

## Exit Criteria

- Admin mutations cannot be driven by a cross-site form or hostile credentialed
  browser request.
- Production rollout cookie setting is updated or consciously paired with the
  MVP mutation guard.
