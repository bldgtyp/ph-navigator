---
DATE: 2026-05-12
TIME: 14:30 EDT
STATUS: Review of TB-01 (Sign-In to Empty Dashboard) uncommitted changes.
AUTHOR: Claude (code-review)
SCOPE: Code review against TB-01 scope as outlined in
       planning/ROADMAP.html. Reviewed only the
       uncommitted working-tree changes; not a completeness audit
       against the full MVP.
RELATED: planning/ROADMAP.html (TB-01 row),
         context/PRD.md §13 (Auth),
         context/technical-requirements/stack-auth-migration.md §13,
         context/technical-requirements/api.md §9.2a,
         context/user-stories/00-foundation-shell.md (US-0, US-1.5).
---

# TB-01 Code Review — Sign-In to Empty Dashboard

## Files Reviewed

Backend (new / modified):
- `backend/alembic/versions/20260512_0002_auth_sessions.py`
- `backend/features/auth/{__init__,models,passwords,repository,service,routes}.py`
- `backend/features/shared/{__init__,errors,middleware}.py`
- `backend/scripts/seed_user.py`
- `backend/tests/test_auth.py`
- `backend/main.py`, `backend/config.py`, `backend/.env.example`,
  `backend/pyproject.toml`

Frontend (modified):
- `frontend/src/App.tsx`, `App.test.tsx`, `App.css`, `api.ts`
- `frontend/index.html`, `frontend/public/favicon.svg`
- `frontend/tests/e2e/health.spec.ts`

Infra:
- `.github/workflows/ci.yml`, `Makefile`

## Verdict

The slice is well-structured and faithful to the layered raw-SQL +
Pydantic pattern. Tests cover the right surface (single-active-session,
generic failure, expiry, origin check). The findings below are triaged
by severity. Two HIGH items are real and should be addressed before
TB-02 ships staging; the rest are tracked follow-ups.

---

## HIGH

### H1 — Timing oracle on failed login leaks valid emails
`backend/features/auth/service.py:78-92`

```python
if user_row is None or not user_row["is_active"] or not verify_password(...):
```

With Argon2id at `time_cost=3, memory_cost=64 MB`, verify is ~80–150 ms.
Unknown emails short-circuit and return in single-digit ms; known
emails wait for the hash. An attacker can enumerate seeded editor
emails by timing. Standard mitigation: always run `verify_password`
against a fixed dummy hash on the lookup-miss branch, and decide
success/failure from a boolean computed after both branches.

### H2 — `/api/health` violates the API versioning policy
`backend/main.py:40-46`

`context/technical-requirements/api.md §9.1` is a hard rule:
"No unversioned routes. `/api/foo` does not exist; only
`/api/v1/foo`." TB-00 left this in place; TB-01 still ships it. Either
delete the route (preferred — `/api/v1/health` already exists in
`features/system/routes.py`) or move it under `/api/v1/`. The
"backward-compatible" comment is misleading: no client outside V2's
own frontend has ever called the unversioned route.

### H3 — Frontend redirects on every 401 instead of opening an in-place re-auth modal
`frontend/src/App.tsx:38-53`

`context/user-stories/00-foundation-shell.md` US-0 #11–13 calls the
401-handling pattern out as MVP-required: idle expiry, device-collision,
and mid-edit expiry must open an in-place sign-in modal so editor state
survives. Current code lumps all errors into a `Navigate to /sign-in`,
throwing away tab context. The backend already distinguishes
`not_authenticated` / `session_expired` / `session_invalidated`; the
frontend discards the distinction. Acceptable for TB-01 (no editor
state yet), but flag this — TB-02/TB-04 onward will need the modal
pattern.

---

## MEDIUM

### M1 — Dead config fields invite confusion
`backend/config.py:26, 44`

`session_secret_key` and `fernet_secret_key` are declared with
insecure defaults and exposed in `.env.example`, but nothing reads
them. Sessions are cookie-pointers to DB rows; no signing happens. A
reviewer will assume cookies are signed because the field exists.
Either delete the fields and their `.env.example` entries, or add a
comment naming the slice that will introduce them.

### M2 — `SELECT … FOR UPDATE` on every authenticated request
`backend/features/auth/service.py:142-190`,
`backend/features/auth/repository.py:108`

Each authenticated request locks the session row inside a transaction
that performs `touch_session`. Multi-tab requests serialize on the
same row. US-Concurrency #1 explicitly supports multi-tab editing —
expect contention from TB-04 onward. Consider `FOR NO KEY UPDATE`
or a non-locking read + conditional `UPDATE … WHERE invalidated_at
IS NULL` (sliding-expiry update is racy-safe).

### M3 — Argon2 verify runs inside the session transaction
`backend/features/auth/service.py:77-132`

The `with transaction()` block opens a DB connection, then performs a
~100 ms Argon2 verify before inserts/updates. The connection is held
for verify duration. Move verify above the transaction: lookup →
verify → start transaction → invalidate/create session.

### M4 — `client_ip` won't survive Render's proxy
`backend/features/auth/service.py:29-30`

`request.client.host` returns the proxy IP behind Render's L7
balancer. TB-02 deploys to staging; the audit log becomes useless
without parsing `X-Forwarded-For` against a trust boundary. Tag for
TB-02.

### M5 — `seed_user` has no environment guard
`backend/scripts/seed_user.py`, `Makefile:94-95`

`make seed-dev-user` hardcodes `--password "password"` and the
repository uses `ON CONFLICT … DO UPDATE SET password_hash =
EXCLUDED.password_hash, is_active = true`. Run against staging/prod
by mistake and it silently resets a real editor's password and
re-enables a disabled account. Add an `environment != "production"`
guard, or refuse to run when overriding `is_active=false`.

### M6 — `test_auth.py` silently skips when DB is unavailable
`backend/tests/test_auth.py:23`

`pytest.skip(...)` makes the entire auth contract suite optional.
CI's new `services: postgres` block hides this, but a future
maintainer can break the migration step and tests still pass green.
Prefer hard fail when `DATABASE_URL` is set and unreachable; allow
skip only when `DATABASE_URL` is unset.

### M7 — No structured application logs wired up
`backend/main.py`

PRD §13.1 day-1 requirement: "JSON application logs with
`request_id`, `user_id`, `project_id`, and `version_id` when
available." Audit events land in `user_action_log` (good), but
Uvicorn's default text logger is still in use for app logs. TB-01 *is*
the slice that introduces request-id propagation; a JSON formatter
wired to `request.state.request_id` belongs here. Either add to TB-01
follow-up or split into TB-01.1.

---

## LOW

### L1 — Wrong type annotations on auth dependencies
`backend/features/auth/routes.py:19, 31`

`tuple[UserPublic, object]` should be `tuple[UserPublic, datetime]`.

### L2 — Redundant defensive casts
`backend/features/auth/service.py:38`

`UUID(str(row["id"]))`, `str(row["email"])`, `str(row["display_name"])`
— psycopg with `dict_row` already returns `UUID` and `str` for these
columns.

### L3 — Forward-compatible access-check seam not introduced
`backend/features/auth/routes.py:19`

US-1.5 commits to a `require_project_access(project_id, mode)`
dependency *on day 1*. TB-01 has no project routes, but a one-off
`require_current_user` is now in place. TB-02 will need to compose
or replace it. A short note in `features/auth/__init__.py` pointing
future work at US-1.5 prevents the seam from being missed.

### L4 — Logout shape is non-idiomatic
`backend/features/auth/routes.py:36-41`

`response.status_code = 204; return response` works but
`return Response(status_code=204)` after cookie-clearing is clearer.

### L5 — Origin middleware rejects requests with no Origin header
`backend/features/shared/middleware.py:23-34`

`origin not in cors_origins_list` is True when `origin is None`.
Correct for browser writes. Any non-browser client doing POST without
Origin (curl, future server-to-server hook) will be 403'd. PRD §13
puts MCP on Bearer tokens via a separate transport, so probably
fine — make the intent explicit in a comment so it isn't "fixed"
later.

### L6 — Dead `.app-shell` CSS class
`frontend/src/App.css:1-12`

Not referenced from `App.tsx`. Delete.

### L7 — Frontend `requestId()` fallback collides
`frontend/src/api.ts:47-52`

`req-${Date.now()}` collides on parallel calls in the same ms — and
`fetchServiceStatus` issues two concurrent fetches. Use
`crypto.getRandomValues(...)` or `Math.random().toString(36)`.
Cosmetic.

### L8 — Frontend never reads `expires_at`
`frontend/src/api.ts`, `frontend/src/App.tsx`

Returned by `/api/v1/auth/session` and `/api/v1/auth/login`, ignored
on the client. Fine for TB-01; flag for TB-04+'s keepalive/expiry
logic (US-0 #9, #11).

---

## What's correctly in scope and well-done

- DB schema (`20260512_0002_auth_sessions.py`): correct
  `uq_sessions_one_active_per_user` partial unique index,
  `lower(email)` unique index, JSONB action-log with `created_at`
  index, FK cascade on session→user, FK SET NULL on action-log→user.
- Argon2id default with Pydantic-Settings exposure of cost
  parameters — matches PRD §13.
- Failed-login audit commits **before** raising 401 (per the TB-01
  lessons-learned entry — well-caught during implementation).
- Single-active-session test verifies
  `count(*) WHERE invalidated_at IS NULL == 1`.
- Origin-policy enforcement is implemented as middleware *in addition
  to* CORS — matches PRD §13's "SameSite=Lax is defense-in-depth,
  not the whole CSRF policy."
- Generic "Email or password is incorrect" message; field-level
  errors are not leaked.
- Frontend uses `autocomplete="email"` and
  `autocomplete="current-password"` per US-0 #3.
- CI provisions a Postgres service and runs `alembic upgrade head`
  before pytest — correctly upgraded for TB-01's DB-backed tests.

---

## Recommendations, in priority order

1. **Fix H1** (constant-time login) before TB-02 ships staging.
   Trivial change, real CVE category.
2. **Fix H2** (drop `/api/health`) — one-line removal; keeps the
   versioning rule honest from day one.
3. **Decide M1** (`session_secret_key` / `fernet_secret_key`):
   delete or document. Prevents future readers from assuming cookies
   are signed.
4. **Refactor M3** (verify outside the transaction) — small change,
   real connection-pool win.
5. **Note H3 / L8 in the TB-01 follow-up section of the roadmap** —
   flag that the in-place session-expiry modal is owed before the
   first editor surface lands.
6. **Add the `client_ip` proxy-header decision to TB-02's scope**
   (M4) so the audit log isn't useless on Render.
7. Everything else can land as opportunistic cleanups in TB-02.

---

## Resolution — 2026-05-12

Ed confirmed the triage: fix the TB-01 auth/security and small cleanup
items now; defer comments that depend on project routes, staging, or
editable project state to the slices where they first matter.

### Addressed now

- **H1 / M3:** Login now verifies a real or dummy Argon2id hash before
  opening the write transaction, so unknown emails do not short-circuit
  and DB connections are not held during password verification.
- **H2:** Removed the unversioned `/api/health` route; `/api/v1/health`
  remains the only health endpoint.
- **M1:** Removed unused `session_secret_key`; documented
  `fernet_secret_key` as future at-rest encryption only, not session
  cookie signing.
- **M5:** `seed_user` now refuses to run outside local environments.
- **M6:** Auth DB tests now fail if the DB/schema is unavailable instead
  of skipping.
- **L1 / L4 / L5 / L6 / L7:** Cleaned auth dependency typing, logout
  response shape, Origin middleware intent comment, dead CSS, and
  frontend request-id fallback.
- **Extra:** Root route now sends an already-authenticated editor to
  `/dashboard`.

### Deferred with slice owner

- **H3 / L8:** In-place re-auth modal and `expires_at` handling remain
  deferred, but should gate the first editable project surface
  (TB-03/TB-04) and be revisited during stale-draft work in TB-06.
- **M2:** Session-row locking/contention belongs with TB-06 same-editor
  tabs and stale-draft boundaries.
- **M4:** Proxy-aware client IP belongs with TB-02 Render staging.
- **M7:** JSON application logs belong with TB-02 staging/ops wiring.
- **L3:** `require_project_access(project_id, mode)` belongs with
  TB-02, where project-scoped routes first exist.

### Simplify pass — 2026-05-12

Ran the repo `simplify` skill after the initial review fixes. Additional
cleanup landed:

- Locked the user row during login's invalidate/create-session swap so
  parallel logins cannot race the one-active-session partial unique
  index.
- Replaced the placeholder dummy Argon2 string with a valid dummy hash
  so unknown-user login attempts do real Argon2 verification work.
- Removed dead TB-00 frontend health/status client types and functions.
- Switched test DB writes to the `transaction()` helper.
- Replaced raw dashboard anchor with React Router `Link` and
  `URLSearchParams` parsing with `useSearchParams()`.
- Cached CORS origin membership as a `frozenset`.

Still deferred intentionally:

- Shared frontend auth/query provider. TB-01's local `useEffect` auth
  guard is acceptable for the empty dashboard; TB-02/TB-03 should avoid
  duplicating this pattern as more server state lands.
- Duplicate session fetch on authenticated `/` -> `/dashboard`. This is
  harmless now and should be folded into the shared auth/query provider.
- Action-log constants/typed payload helpers and repeated test fixtures.
  Worth revisiting once the next auth/project action types exist.

### Docs pass — 2026-05-12

Corrected stable docs to match the implemented TB-01 values instead of
the earlier phase-target wording:

- `context/ENVIRONMENT.md` now records the actual local auth seed,
  `phn_session` cookie name, Argon2 settings, CORS origins, and the
  fact that backend auth tests clear seeded users.
- `context/technical-requirements/api.md` now records the concrete auth
  route behavior, request-id propagation, cookie flags, and current
  route-level frontend guard.
- `context/technical-requirements/stack-auth-migration.md` now records
  the migration/table/index names and separates implemented TB-01 ops
  from deferred owners: JSON app logs in TB-02, idempotency handling in
  the first idempotent project/draft write slice, proxy-aware client IP
  in TB-02, and session-row contention review in TB-06.
- `context/technical-requirements/data-model.md` now reflects the
  actual TB-01 auth schema: UUID users, `display_name`, `is_active`,
  `expires_at`, `invalidation_reason`, text IP storage, `details`
  JSONB, and the concrete index names from the migration.
