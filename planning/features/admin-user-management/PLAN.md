---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Implementation sequence for admin user management.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
  - ./research.md
---

# Plan - Admin User Management

## Phase Sequence

Detailed phase handoffs live under `phases/`. Phases 00-07 are blocking for the
production rollout; Phase 08 is deferred hardening.

| Phase | File | Goal | Blocks rollout? |
| --- | --- | --- | --- |
| 00 | `phases/phase-00-decisions-threat-model.md` | Lock decisions, threat model, and production gate | Yes |
| 01 | `phases/phase-01-session-csrf-rate-limits.md` | Cookie/CSRF posture and public-auth abuse controls | Yes |
| 02 | `phases/phase-02-schema-bootstrap.md` | Account lifecycle schema, token storage, and first-admin bootstrap | Yes |
| 03 | `phases/phase-03-backend-services.md` | Backend services for invite/reset/deactivate/grants/audit | Yes |
| 04 | `phases/phase-04-api-authorization.md` | Admin/public API routes with backend authorization gates | Yes |
| 05 | `phases/phase-05-email-delivery.md` | Transactional email provider and local/test outbox | Yes |
| 06 | `phases/phase-06-frontend-flows.md` | Admin UI and invite/reset frontend pages | Yes |
| 07 | `phases/phase-07-production-rehearsal.md` | Production rehearsal, runbook, and rollout unblock | Yes |
| 08 | `phases/phase-08-hardening.md` | MFA/passkeys, richer IAM, cleanup jobs | No |

## Blocking Definition

The production rollout may continue through cheap staging/infra rehearsal, but
must not cut over `www.ph-nav.com` until all Phase 00-07 exit criteria are met:

1. Ed has an audited production bootstrap path.
2. Ed can invite John through `/admin/users`.
3. John can complete invite and sign in normally.
4. Ed can trigger reset, deactivate/reactivate, and grant/revoke admin on a test
   account.
5. Reset/invite tokens are hashed, single-use, expiring, and not logged.
6. Unsafe credentialed admin mutations have CSRF/origin protection or the
   production cookie is proven on `SameSite=Lax`.
7. Public reset has rate limiting and generic responses.
8. Last-admin lockout protection is transactionally tested.
9. Sensitive actions write audit rows.
10. `make ci` passes.

## API Surface Target

Admin routes under `/api/v1/admin/users`:

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users/invite`
- `POST /api/v1/admin/users/{user_id}/resend-invite`
- `POST /api/v1/admin/users/{user_id}/password-reset`
- `POST /api/v1/admin/users/{user_id}/deactivate`
- `POST /api/v1/admin/users/{user_id}/reactivate`
- `PATCH /api/v1/admin/users/{user_id}/capabilities`
- `PATCH /api/v1/admin/users/{user_id}/staff`
- `GET /api/v1/admin/users/{user_id}/audit`

Public/auth routes:

- `POST /api/v1/auth/password-reset/request`
- `POST /api/v1/auth/password-reset/complete`
- `POST /api/v1/auth/invite/complete`
- `POST /api/v1/auth/reauth`

Authorization:

- add `ADMIN_USERS_MANAGE = "admin.users.manage"` to the capability namespace;
- add a backend dependency such as `require_user_capability(user, ADMIN_USERS_MANAGE)`;
- reject unauthenticated with 401 and unauthorized with 403;
- never rely on frontend route guards alone.

## Schema Direction

Prefer a single durable `account_tokens` table for invite/reset/bootstrap links:

```text
account_tokens
  id uuid pk
  user_id uuid fk users(id) on delete cascade
  token_type text check in ('invite', 'password_reset')
  token_hash text unique not null
  created_by uuid null fk users(id) on delete set null
  created_at timestamptz not null default now()
  expires_at timestamptz not null
  consumed_at timestamptz null
  revoked_at timestamptz null
  request_ip text null
  request_user_agent text null
```

User schema must support invited users without an authenticatable placeholder
password. Preferred direction:

- allow `users.password_hash` to be nullable;
- add `users.password_set_at timestamptz`;
- derive `active`, `invited`, and `inactive` from `deleted_at`,
  `password_set_at`, and active invite token state;
- keep historical user rows instead of deleting/recreating them.

## Follow-Up Boundary

MFA/passkeys, richer team/project roles, certifier/client user accounts, and
shared audit exports are important but not required to unblock the two-user
production rollout. They become blockers before broad external/client access.
