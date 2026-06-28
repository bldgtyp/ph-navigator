---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Admin/public HTTP routes, backend authorization gates, and OpenAPI contracts.
RELATED:
  - ../PRD.md
  - backend/features/auth/routes.py
  - backend/features/access/user_capabilities.py
  - backend/features/shared/errors.py
---

# Phase 04 - API / Authorization

## Goal

Expose the backend services through narrow HTTP routes with deny-by-default
authorization and predictable error contracts.

## Implementation Tasks

1. Add admin router under `/api/v1/admin/users`.
2. Add public auth routes:
   - `POST /api/v1/auth/password-reset/request`;
   - `POST /api/v1/auth/password-reset/complete`;
   - `POST /api/v1/auth/invite/complete`;
   - `POST /api/v1/auth/reauth`.
3. Add request/response Pydantic models with `extra="forbid"`.
4. Add `require_user_capability(user, ADMIN_USERS_MANAGE)` to every admin route.
5. Add fresh-admin re-auth dependency for sensitive routes.
6. Ensure normal users get 403, anonymous callers get 401, and public reset
   request always gets generic copy.
7. Extend `/api/v1/auth/session` or add a capability/session endpoint so the
   frontend can hide admin navigation without making it authoritative.
8. Preserve consistent API error envelopes and request IDs.

## Route Target

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users/invite`
- `POST /api/v1/admin/users/{user_id}/resend-invite`
- `POST /api/v1/admin/users/{user_id}/password-reset`
- `POST /api/v1/admin/users/{user_id}/deactivate`
- `POST /api/v1/admin/users/{user_id}/reactivate`
- `PATCH /api/v1/admin/users/{user_id}/capabilities`
- `PATCH /api/v1/admin/users/{user_id}/staff`
- `GET /api/v1/admin/users/{user_id}/audit`

## Verification

- Backend route tests:
  - anonymous cannot call admin routes;
  - normal user cannot call admin routes;
  - inactive user cannot call routes;
  - admin can call allowed routes;
  - missing fresh-auth marker fails sensitive routes;
  - CSRF/origin guard applies to unsafe admin routes;
  - public reset response does not reveal account existence.
- OpenAPI snapshot/drift test if this repo has one.
- `make ci` at phase close.

## Exit Criteria

- HTTP surface exists and is deny-by-default.
- Frontend can discover admin affordance state.
- Public and admin routes have focused test coverage.
