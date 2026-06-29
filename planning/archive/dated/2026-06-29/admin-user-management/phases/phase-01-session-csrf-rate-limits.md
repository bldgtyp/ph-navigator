---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Complete
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

## Outcome (2026-06-27)

- **Cookie posture:** `Settings.session_cookie_samesite` already defaults to
  `lax` and `session_cookie_secure` is true outside dev/test/local, so the
  preferred production posture is the code default. The production rollout PLAN
  already sets `SESSION_COOKIE_SAMESITE=lax`. Staging verification of the
  `www -> api` shape is a Phase 06 rehearsal step, but the gate does not depend
  on it because the custom-header guard ships unconditionally.
- **Origin guard:** already enforced for all mutating `/api/` requests in
  `features/shared/middleware.py` (rejects any `Origin` outside the CORS
  allow-list with `origin_not_allowed`). Refactored into `_reject_unsafe_request`
  for clarity.
- **Custom-header guard:** added an app-only `X-PHN-CSRF` requirement on the
  `/api/v1/admin/` surface (`csrf_header_missing` on absence). Header name is the
  `Settings.csrf_header_name` field. Scoped to the admin surface because the
  global Origin guard already protects the other ~57 mutating endpoints and a
  global header requirement would churn the whole suite for no added security.
- **Frontend:** `fetchApiResponse` now sends `X-PHN-CSRF: 1` on every request
  (multipart uploads keep browser-set `Content-Type`). Constant
  `CSRF_HEADER_NAME` mirrors the backend setting.
- **Tests:** `backend/tests/test_csrf_guard.py` (missing header → 403; present
  header passes the guard; untrusted origin rejected first; non-admin route not
  header-gated; safe method skipped). `frontend/src/shared/api/client.test.ts`
  (header + request id sent; multipart untouched).
