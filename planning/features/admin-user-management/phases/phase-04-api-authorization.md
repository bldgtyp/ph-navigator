---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Complete
AUTHOR: Codex (for Ed May)
SCOPE: MVP admin/auth HTTP routes, backend authorization gates, and OpenAPI contracts.
RELATED:
  - ../PRD.md
  - backend/features/auth/routes.py
  - backend/features/access/user_capabilities.py
  - backend/features/shared/errors.py
---

# Phase 04 - API / Authorization

## Goal

Expose the MVP backend services through narrow HTTP routes with deny-by-default
authorization and predictable error contracts.

## Implementation Tasks

1. Add admin router under `/api/v1/admin/users`.
2. Add auth token-completion routes:
   - `POST /api/v1/auth/reset/complete`;
   - `POST /api/v1/auth/invite/complete`.
3. Add request/response Pydantic models with `extra="forbid"`.
4. Add `require_user_capability(user, ADMIN_USERS_MANAGE)` to every admin route.
5. Ensure normal users get 403 and anonymous callers get 401.
6. Extend `/api/v1/auth/session` or add a capability/session endpoint so the
   frontend can hide admin navigation without making it authoritative.
7. Preserve consistent API error envelopes and request IDs.
8. If reset/invite links are manually shown in the admin UI, ensure raw tokens
   appear only in create responses and are never returned by list/detail routes.

## Route Target

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users/invite`
- `POST /api/v1/admin/users/{user_id}/reset-link`
- `POST /api/v1/admin/users/{user_id}/deactivate`
- `POST /api/v1/admin/users/{user_id}/reactivate`
- `PATCH /api/v1/admin/users/{user_id}/admin`
- `GET /api/v1/admin/users/{user_id}/audit`

## Verification

- Backend route tests:
  - anonymous cannot call admin routes;
  - normal user cannot call admin routes;
  - inactive user cannot call routes;
  - admin can call allowed routes;
  - Origin/custom-header guard applies to unsafe admin routes;
  - raw links are only returned from create/reset-link responses.
- OpenAPI snapshot/drift test if this repo has one.
- `make ci` at phase close.

## Exit Criteria

- MVP HTTP surface exists and is deny-by-default.
- Frontend can discover admin affordance state.
- Admin routes have focused test coverage.

## Outcome (2026-06-27)

- `features/admin/routes.py` exposes the full surface under `/api/v1/admin`
  (`GET /users`, `POST /users/invite`, `POST /users/{id}/reset-link`,
  `POST /users/{id}/deactivate`, `POST /users/{id}/reactivate`,
  `PATCH /users/{id}/admin`, `GET /users/{id}/audit`), wired into `main.py`.
- `require_admin` dependency resolves the session cookie (401 anonymous) then
  requires `admin.users.manage` (403 signed-in non-admin) — deny-by-default,
  never trusting the frontend. Combined with the Phase 01 guard, unsafe admin
  routes also require a trusted Origin + `X-PHN-CSRF`.
- Public completion routes `POST /api/v1/auth/invite/complete` and
  `POST /api/v1/auth/reset/complete` accept the raw token in the JSON body
  (`AccountCompletionRequest`, password `min_length=8`) and return 204; the user
  then signs in normally.
- `/api/v1/auth/session` (and login/preferences) now return `capabilities` so
  the frontend can hide admin nav; authorization stays server-side.
- All request/response models use `extra="forbid"`. Raw invite/reset links
  appear only in the invite/reset-link/reactivate create responses, never in
  list or audit reads (asserted in tests).
- No OpenAPI snapshot test exists in this repo, so none to update.
- Tests: `backend/tests/test_admin_routes.py` (12) — anonymous 401, normal-user
  403, admin 200, session capability exposure, missing-CSRF 403, invite→
  complete→sign-in, link-not-in-list, deactivate/reactivate, last-admin demote
  guard, audit without secrets, invalid-token 400, short-password 422.
