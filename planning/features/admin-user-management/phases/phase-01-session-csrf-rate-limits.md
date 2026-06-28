---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Cookie posture, CSRF defense, and public-auth abuse controls.
RELATED:
  - ../PRD.md
  - ../research.md
  - ../reviews/2026-06-27-security-use-case-review.md
  - backend/config.py
  - backend/main.py
  - frontend/src/shared/api/client.ts
---

# Phase 01 - Session / CSRF / Rate Limits

## Goal

Make credentialed unsafe methods safe enough for admin user-management and
internet-facing reset requests.

## Implementation Tasks

1. Cookie posture:
   - test production-domain shape locally or in staging for
     `www.ph-nav.com` -> `api.ph-nav.com` with `SameSite=Lax`;
   - if it works, update production rollout/env docs to use Lax;
   - if it does not, document why and keep `SameSite=None` only with CSRF
     middleware.
2. CSRF/Origin guard:
   - add middleware or route dependency for unsafe methods;
   - require trusted `Origin` for credentialed browser requests;
   - require an app-only custom header/token for unsafe API requests;
   - exempt true bearer-token MCP routes only if they do not depend on cookies.
3. Frontend client:
   - add the required CSRF/custom header in `fetchJson` / `fetchBlob`;
   - keep multipart upload behavior intact.
4. Rate limiting:
   - add DB-backed or platform-equivalent rate limits for reset request, invite
     resend, invite complete, and reset complete;
   - dimensions: normalized email, IP, action, and optionally user id;
   - return generic public reset responses even when throttled.
5. Tests:
   - unsafe cookie-auth request from untrusted Origin fails;
   - missing CSRF/custom header fails;
   - trusted app request passes;
   - reset request throttles without user enumeration.

## Verification

- Backend focused tests for CSRF/origin/rate-limit behavior.
- Frontend API-client tests if header logic is test-covered locally.
- `make ci` at phase close if code lands.

## Exit Criteria

- Public reset/admin mutations cannot be driven by a cross-site form or hostile
  credentialed browser request.
- Rate limiting is durable enough for Render production and is documented.
- Production rollout cookie setting is updated or consciously paired with CSRF.
