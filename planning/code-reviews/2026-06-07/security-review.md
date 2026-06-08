DATE: 2026-06-07
TIME: synthesized from parallel multi-agent review

# Pre-Deploy Security Review — PH-Navigator V2

## Scope and Methodology

Full-codebase security review focused on the frontend and backend ahead of
the first public deploy. Five parallel reviewers covered:

1. Authentication, sessions, passwords, CSRF
2. Authorization & access control
3. Input validation, injection, deserialization, file handling, SSRF
4. Frontend (React/Vite/TypeScript)
5. Infrastructure, configuration, secrets, headers, logging, dependencies

Threat model context (from the user):

- Small app, internal team usage, growing to a small set of external clients
- No truly sensitive data
- Unauthenticated VIEW of project pages is **intentional**; unauthenticated
  WRITE must be impossible
- Goal: standard best practices for any public-facing app of this kind, not
  a hardened high-assurance posture

---

## Executive Summary

The codebase is in **better shape than typical pre-deploy state**, with no
SQL injection vectors, strict Pydantic validation almost everywhere, a real
session-revocation model, correct CSRF posture (Origin allowlist +
SameSite=Lax cookie), good logging redaction, sanitized markdown, no
unsafe deserialization, and no shell/eval surfaces. The frontend uses
cookie-only auth, has no `dangerouslySetInnerHTML`, and the markdown
pipeline is a model implementation.

**However, before going public there are a small number of must-fix items**
that span both functional security (authZ) and operational hygiene
(secrets, headers, rate limits):

### Must fix before deploy (Critical / High)

| # | Area | Issue |
|---|------|-------|
| 1 | Secrets | `seeds/user.json` and `Makefile seed-agent-user` ship the literal password `"password"` |
| 2 | AuthZ | `require_project_edit_access` only checks "is logged in?" — any authenticated user can edit any project (status, document, envelope, apertures, assets, table views, MCP tokens) |
| 3 | AuthZ | `PATCH /projects/{id}` (rename, change BT number, etc.) bypasses even the owner check that delete/restore enforces |
| 4 | AuthZ | Global catalogs (materials, glazing types, frame types) are writable by every authenticated user — no admin role |
| 5 | AuthZ | MCP tokens can be minted by any authenticated user for any project, never expire (no max TTL), survive issuer disable |
| 6 | AuthZ | `GET /assets/{id}/url`, `/download`, `bulk-urls` issue presigned URLs (default TTL 1h) to **unauthenticated** callers — any uploaded asset is effectively world-readable for ≤1h to anyone who guesses or scrapes an asset id |
| 7 | Config | No `Settings` validator: production can boot with empty `fernet_secret_key`, empty R2 creds, default `database_url`, or default `cors_origins` |
| 8 | Config | No security headers middleware (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP / frame-ancestors) |
| 9 | Auth | No login throttling / lockout / per-IP rate limit — Argon2 cost alone is not throttling |
| 10 | Auth | Session has no absolute lifetime cap — a stolen cookie can be renewed forever by polling once per hour |
| 11 | Frontend | PDF preview iframe at `AttachmentCell.tsx:219` has no `sandbox` attribute |
| 12 | Frontend | No Content-Security-Policy defined anywhere |
| 13 | Backend | `Image.MAX_IMAGE_PIXELS` not set in the thumbnailer — decompression-bomb risk on PNG/JPEG uploads |

Everything else (Medium / Low / Info) is hardening, defense-in-depth, or
posture confirmation. Full details below.

---

## Critical

### C-1. Default seed password `"password"` shipped in the repo

- **Files:**
  - `backend/seeds/user.json` (committed): `{"email":"ed@example.com","password":"password"}`
  - `Makefile` target `seed-agent-user`:
    `--email codex@example.com … --password "password"`
  - `backend/scripts/seed_user.py` allows `--allow-staging`
- **Why it matters:** Once the repo is public anyone reading it learns the
  default credential convention. The `_assert_local_dev_database()` guard
  in `seed_dev_db.py:161-167` only fires when `ENVIRONMENT` is set
  correctly; a misconfigured env var = full editor takeover for whoever
  ran the seed. The known pattern (`ed@example.com / password`,
  `codex@example.com / password`) is the first thing an attacker tries.
- **Fix:**
  - Remove the literal `password` field from `seeds/user.json`; require
    `--password` to be passed, or generate a random one per run and
    print it once.
  - Refuse the literal string `"password"` (and a short common-passwords
    list) in `create_or_update_user`.
  - Have `seed_user.py` and `seed_dev_db.py` refuse to run unless
    `settings.environment in {"development","test","local"}`, regardless
    of `--allow-staging`.
  - Rotate immediately on any environment that ever ran with defaults.

### C-2. No per-project authorization — any logged-in user is an editor on every project

- **Files:**
  - `backend/features/projects/access.py:43-66` — `is_editor = (self.user is not None)`
  - Every write route gated by `ProjectEditAccess`
- **Why it matters:** The product allows public read of projects, so the
  only line between viewing a project and editing it is "is there a
  session?" That means any account on the system — yours, a former
  contractor's, the demo agent account — can edit any project, mint MCP
  tokens for any project, attach/delete assets on any project. The
  `projects.owner_id` column exists and is populated; it's just not
  consulted by `require_project_edit_access`.
- **Fix (minimum):** Change `is_editor` to require
  `project.owner_id == user.id`. This is a small change and the schema
  already supports it.
- **Fix (proper):** Add a `project_members(user_id, project_id, role)`
  table and check membership.
- **Coverage matrix** (every endpoint flagged under this finding):

| Method | Path | Currently protected by | Owner-checked? |
|---|---|---|---|
| PATCH | `/projects/{id}` | `ProjectEditAccess` | **NO — see C-3** |
| POST/PATCH/DELETE | `/projects/{id}/status-items*` | `ProjectEditAccess` | NO |
| POST | `/projects/{id}/mcp-tokens` (+ revoke) | `ProjectEditAccess` | NO — see C-5 |
| POST | `/projects/{id}/versions/{v}/draft/envelope/commands` | `ProjectEditAccess` | NO |
| PUT/DELETE | `/projects/{id}/table-views/{key}` | `ProjectEditAccess` | NO |
| PUT/POST/DELETE | `/projects/{id}/versions/{v}/draft/**` | `ProjectEditAccess` | NO |
| POST/PATCH/DELETE | `/projects/{id}/assets/**` | `ProjectEditAccess` | NO |

### C-3. `PATCH /projects/{id}` lacks the owner check that delete/restore enforces

- **File:** `backend/features/projects/routes.py:119-127` →
  `backend/features/projects/service.py:314-366`
- **Why it matters:** `delete_project`, `restore_project`, and
  `hard_delete_project` all call `_ensure_project_owner`. The
  metadata-update path skips it. So any authenticated user can rename
  another user's project, change its `bt_number` (colliding with another
  owner's reservation), edit `phius_number`, `phius_dropbox_url`, etc.
  Almost certainly unintentional — fix is one line.
- **Fix:** Insert `_ensure_project_owner(current_project, user)` after
  the `get_project_by_id` fetch in `update_project_metadata`. Same
  pattern for `patch_version`.

### C-4. Global catalogs writable by any authenticated user

- **Files:**
  - `backend/features/catalogs/materials/routes.py:58-156`
  - `backend/features/catalogs/glazing_types/routes.py:58-156`
  - `backend/features/catalogs/frame_types/routes.py:72-170`
- **Why it matters:** These catalogs are shared across the entire
  installation. Currently any logged-in user can create, edit,
  soft-delete, reactivate, or bulk-import-and-commit catalog records.
  There is no `is_admin` flag on `users`.
- **Fix:** Add `is_admin: bool` (default false) to the `users` table.
  Gate catalog writes behind an admin dependency. Reads can remain
  authenticated-only (or unauthenticated, depending on product).

### C-5. MCP tokens — any logged-in user can mint never-expiring project-write tokens

- **Files:**
  - `backend/features/mcp/routes.py:24-30` — gated by `ProjectEditAccess`
  - `backend/features/mcp/models.py:19-54` — `expires_at: datetime | None = None`
- **Why it matters:** Combines C-2 with three additional weaknesses:
  no max-TTL cap (token can live forever), no fresh-auth step, and
  tokens persist after the issuer is disabled (`authenticate_plaintext_token`
  doesn't re-check `issued_by_user_id` activity). Net: a long-lived
  bearer token can be planted that survives every defensive action short
  of explicit token revocation.
- **Fix:**
  - Fix C-2 first.
  - Enforce a maximum `expires_at` (e.g. 90 days). Reject `None` or
    require an explicit "I understand" flag for never-expiring tokens
    used in unattended scripts.
  - On user disable/delete, cascade-revoke tokens with that user's
    `issued_by_user_id`.
  - Consider requiring password re-confirmation before issuance.

### C-6. Unauthenticated callers can fetch presigned URLs for any project asset (≤1h TTL)

- **Files:**
  - `backend/features/assets/routes.py:83-90` — `GET /assets/bulk-urls`
  - `backend/features/assets/routes.py:125-133` — `GET /assets/{id}/url`, `/download`
  - `backend/config.py:56-57` — preview 15min, download 60min TTLs
- **Why it matters:** Routes use `ProjectViewAccess`, which is
  intentionally unauthenticated. They return presigned R2 GET URLs valid
  for up to an hour. Once a URL is issued, anyone who has it can fetch
  the file. So any asset — drawings, PDFs, anything an editor uploaded —
  is effectively world-readable for up to an hour to anyone who can hit
  the endpoint. Asset IDs are server-generated UUIDs (good — not
  guessable) but the bulk-urls endpoint lets a caller resolve a list of
  ids in one call.
- **Fix (recommended):** Gate `/url`, `/download`, and `bulk-urls`
  behind `require_editor_user` (or require login at minimum). The
  unauthenticated-view model should not extend to original-resolution
  binary downloads.
- **Fix (if anonymous download must stay):** Shorten download TTL to
  60-120s, cap bulk-urls batch size hard, and consider a per-asset
  "public" flag that gates anonymous access.

---

## High

### H-1. No production-time `Settings` validator — production can boot with empty secrets

- **File:** `backend/config.py:51-63`
- **Defaults that silently boot in production:** `r2_account_id=""`,
  `r2_access_key_id=""`, `r2_secret_access_key=""`, `r2_endpoint_url=""`,
  `fernet_secret_key=""`, plus default `database_url` and default
  `cors_origins`.
- **Fix:** Add a Pydantic `model_validator(mode="after")` that raises if
  `environment not in {"development","test","local"}` and any of the
  above is empty or equals its dev default. Same validator should reject
  the literal `cors_origins` default in non-dev.

### H-2. No security-headers middleware

- **File:** `backend/main.py:54-66` — only CORS, GZip, request context
- **Missing:** `Strict-Transport-Security`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: ()`, `Content-Security-Policy: frame-ancestors
  'none'` (the API never renders HTML — `frame-ancestors 'none'` is the
  right default).
- **Fix:** Small `SecurityHeadersMiddleware` that always sets nosniff /
  Referrer-Policy / Permissions-Policy / frame-ancestors; sets HSTS
  (`max-age=63072000; includeSubDomains; preload`) when
  `environment != "development"`. Confirm Render serves the frontend
  origin with HSTS too.

### H-3. No login throttling, lockout, or per-IP rate limit

- **File:** `backend/features/auth/service.py:80-166`, `backend/main.py`
- **Why it matters:** Argon2id at the configured cost is ~hundreds of ms,
  which is brute-force-resistant but **is not throttling**. Combined
  with the Argon2 memory cost (64 MiB) this is also a DoS amplifier —
  an attacker who hammers `/login` exhausts CPU and RAM long before
  they crack anything.
- **Fix:** Add `slowapi` (or equivalent) and apply: 10 failed
  attempts / 15 min per email; 30 attempts / 15 min per IP; 429 with
  `Retry-After`. Also rate-limit `POST /mcp-tokens/*`, asset upload
  init, and unauthenticated GET routes that hit the database.

### H-4. Session has no absolute lifetime cap

- **File:** `backend/features/auth/service.py:30-31, 202-207`
- **Why it matters:** `expires_at` is recomputed on every authenticated
  request, so an attacker who steals a session cookie can keep it alive
  forever by polling once per hour. There is no `absolute_expires_at` and
  `created_at` is not consulted on touch.
- **Fix:** On `current_user_from_request`, refuse to touch sessions older
  than e.g. 7-14 days (use the existing `sessions.created_at`); force
  re-auth past that bound.

### H-5. PDF preview iframe is not sandboxed

- **File:** `frontend/src/features/assets/components/AttachmentCell.tsx:219`
- **Code:** `<iframe title={asset.original_filename} src={asset.preview_url} />`
- **Why it matters:** The iframe loads user-controlled asset URLs. With
  no `sandbox` attribute, the embedded document inherits the parent's
  origin context — including the session cookie. A malicious upload or
  a content-type mismatch becomes a session-level compromise.
- **Fix:** `sandbox=""` (empty — no scripts, no same-origin) plus
  `referrerPolicy="no-referrer"`. Do not add both `allow-scripts` and
  `allow-same-origin`. Combine with serving previews from a cookieless
  subdomain if/when possible.

### H-6. No Content-Security-Policy

- **Files:** `frontend/index.html` (no meta CSP); no response-header CSP
  in `backend/main.py`.
- **Why it matters:** CSP is the strongest defense-in-depth for the
  whole class of issues above (H-5, any future markdown bug, any
  reflected user content). Vite emits hashed bundles, so `script-src
  'self'` is sufficient — no `'unsafe-inline'` needed.
- **Fix:** Define a CSP at the backend response layer (preferred over
  `<meta>`). Starting point:
  ```
  default-src 'self';
  script-src 'self';
  style-src 'self' https://bldgtyp.github.io https://fonts.googleapis.com 'unsafe-inline';
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: <preview-origin>;
  frame-src <preview-origin>;
  connect-src 'self' <api-origin>;
  object-src 'none'; base-uri 'none';
  form-action 'self'; frame-ancestors 'none';
  ```

### H-7. GZipMiddleware on a cookie-authenticated API — BREACH exposure

- **File:** `backend/main.py:62`
- **Why it matters:** BREACH-class attacks become viable when a
  compressed response contains a secret AND reflects user-controlled
  input. The MCP "issue token" endpoint returns a plaintext token in
  the response body once; compressing that response can leak under
  specific conditions. The CSRF Origin allowlist mitigates the primary
  attack path for state changes; the residual risk is on GETs that
  reflect user input alongside long-lived secrets.
- **Fix (minimum):** Disable compression on the MCP token issuance
  response (set `Content-Encoding: identity` or scope GZip away from
  that route). Audit other endpoints that return one-time secrets.

### H-8. Pillow has no `MAX_IMAGE_PIXELS` cap

- **File:** `backend/features/assets/thumbnailer.py:59`
- **Why it matters:** Pillow's default raises a warning, not an error,
  on decompression bombs. A maliciously-crafted small PNG with very
  large declared dimensions balloons memory at decode time, before the
  thumbnailer's 30-second timeout can help.
- **Fix:**
  ```py
  from PIL import Image
  import warnings
  Image.MAX_IMAGE_PIXELS = 25_000_000
  warnings.simplefilter("error", Image.DecompressionBombWarning)
  ```
  Also clamp PDF render scale so output bitmap ≤ 4096×4096 (see M-2).

### H-9. Database connection has no production TLS enforcement

- **File:** `backend/config.py:48`, `backend/database.py:38-42`
- **Why it matters:** Default `database_url` has no `sslmode`; there is
  no validator that requires `sslmode=require` or `verify-full` in
  production. A misconfigured env var leaves traffic to Postgres
  unencrypted.
- **Fix:** In the H-1 validator, enforce `sslmode=require` (or
  `verify-full`) when `environment != "development"`. Or coerce the URL
  in `get_pool()` to append `?sslmode=require` outside dev.

---

## Medium

### M-1. CSRF defense becomes single-pointed if `SameSite=none`

- **File:** `backend/config.py:42`, `backend/features/shared/middleware.py:60-77`
- **Today:** `SameSite=lax` (browser CSRF defense) + Origin allowlist
  on mutating `/api/*` requests = solid.
- **Risk:** `session_cookie_samesite` is configurable to `"none"` and
  tests already exercise that path. With `none`, the entire CSRF
  posture depends on the Origin check.
- **Fix:** Add a comment in `config.py` warning that `"none"` requires
  a CSRF token. Consider rejecting `"none"` unless an explicit
  `csrf_token_strategy` is configured.

### M-2. PDF rasterization is not page-count or scale-bounded

- **File:** `backend/features/assets/thumbnailer.py:50-55`
- **Why:** Renders page 0 only (good), but very large MediaBox values
  produce enormous bitmaps even at scale=1.
- **Fix:** Compute page dimensions; clamp scale so output bitmap is
  ≤ 4096×4096 before resizing.

### M-3. MCP CSRF middleware skips non-`/api/` paths

- **File:** `backend/features/shared/middleware.py:61`
- **Why:** The MCP app is mounted at `/mcp` (`main.py:85`) and bypasses
  the `/api/*` Origin check. MCP uses bearer tokens and FastMCP enforces
  Origin/Host via its own `TransportSecuritySettings`, so this is fine
  today — but a future cookie-auth endpoint mounted outside `/api/`
  would silently lose CSRF protection.
- **Fix:** Either invert the rule (check all mutating requests except
  an explicit allowlist) or document the invariant near both files.

### M-4. MCP `MCP_ALLOWED_HOSTS` and `MCP_ALLOWED_ORIGINS` always include localhost wildcards

- **File:** `backend/config.py:87, 99`
- **Why:** `["localhost:*", "127.0.0.1:*", "[::1]:*"]` is always merged
  in. DNS rebinding protection allows localhost even in production.
- **Fix:** Gate the local entries on
  `settings.environment in {"development","test","local"}`.

### M-5. `_SENSITIVE_KEYS` redaction is exact-match only

- **File:** `backend/logging_config.py:16-30, 133-141`
- **Why:** Common variants like `session_token`, `bearer_token`,
  `r2_secret_access_key`, `set-cookie`, `x-api-key`, `mcp_token`,
  `fernet_secret_key` are NOT redacted (the set has `fernet_key` not
  `fernet_secret_key`, `cookie` not `set-cookie`, `bearer` not
  `bearer_token`).
- **Fix:** Switch to substring/regex matching; explicitly add `set-cookie`,
  `mcp_token`, `r2_secret_access_key`, `fernet_secret_key`,
  `session_token`, `bearer_token`, `x-api-key`.

### M-6. CORS `allow_headers=["*"]`

- **File:** `backend/main.py:54-61`
- **Why:** Finite origin list with credentials is correct, but reflecting
  all headers is broader than needed.
- **Fix:** Restrict to the actual list (`Content-Type`, `If-Match`,
  `X-Request-ID`, etc.).

### M-7. Cookie name lacks `__Host-` prefix

- **File:** `backend/config.py:41`
- **Why:** Once `Secure` + `Path=/` + no `Domain` are in place, the
  cookie qualifies for `__Host-`, which browsers enforce as
  Secure+Path=/+no-Domain (blocks subdomain cookie injection).
- **Fix:** Rename to `__Host-phn_session` in production envs (conditional
  in config so http dev still works).

### M-8. Argon2 dummy-hash parameters can drift from config

- **File:** `backend/features/auth/service.py:80-102`
- **Why:** The `DUMMY_PASSWORD_HASH` used to equalize timing for
  unknown-user lookups is hardcoded against `m=65536,t=3,p=4`. If
  `password_argon2_*` settings are tuned, the dummy hash becomes a
  cheaper verify than the real one — leaks user existence via timing.
- **Fix:** Compute `DUMMY_PASSWORD_HASH = hash_password("dummy")` at
  module import so it always matches current settings.

### M-9. No password complexity / minimum length

- **File:** `backend/features/auth/models.py:27`, `backend/features/auth/service.py:73-77`
- **Why:** `LoginRequest.password` has `min_length=1`;
  `create_or_update_user` accepts any string.
- **Fix:** Add a `Password` type with `min_length=12`, reject the
  top-10k common passwords at create/reset (NOT at login — accept legacy
  passwords there).

### M-10. Open-redirect surface in sign-in `?next=` param

- **File:** `frontend/src/features/auth/routes/SignInPage.tsx:8-9`
- **Why:** `next` is passed unfiltered to `navigate()`. React-Router
  treats absolute URLs as paths, so today this is mostly defanged — but
  any future code that hands it to `window.location.assign` becomes an
  open redirect (or `javascript:` XSS).
- **Fix:** Whitelist same-origin paths before use (must start with `/`,
  not `//`, no scheme prefix).

### M-11. MinIO `CORS_ALLOW_ORIGIN: '*'` default in docker-compose

- **File:** `docker-compose.yml:44`; default root creds `phn_minio /
  phn_minio_local_only`; ports bound on `0.0.0.0`.
- **Why:** Combined with default credentials and 0.0.0.0 bind, a
  developer on an untrusted network (or ngrok-style tunnel) exposes
  object storage immediately.
- **Fix:** Bind to `127.0.0.1:9000:9000`, `127.0.0.1:9001:9001`;
  default `MINIO_API_CORS_ALLOW_ORIGIN` to `http://localhost:5173`.

### M-12. Postgres bound on all interfaces in compose

- **File:** `docker-compose.yml:10-15`
- **Fix:** `127.0.0.1:${POSTGRES_PORT:-5433}:5432`.

### M-13. `MCP env-var token` path exists (currently disabled in prod)

- **File:** `backend/features/mcp/helpers.py:69-84`
- **Why:** `current_token(..., allow_env_token=True)` would
  authenticate from `PHN_MCP_TOKEN` env. Currently disabled because
  `build_mcp_server()` defaults `allow_env_token=False`. A regression
  here silently grants any holder of the env var full access.
- **Fix:** Add a test that asserts the network-mounted server has
  `allow_env_token=False`.

### M-14. `assetDownloadPath` flows into `window.location.href`

- **File:** `frontend/src/features/assets/components/AttachmentRowsTable.tsx:115`
- **Fix:** Have `assetDownloadPath` enforce a leading `/api/v1/...` and
  `encodeURIComponent` its inputs. Add a runtime assertion or branded
  type.

### M-15. Inconsistent `rel="noopener noreferrer"` on user-controlled `target="_blank"` links

- **Files:** `frontend/src/features/assets/components/AttachmentCell.tsx:236`
  and all equipment datasheet anchors
  (`HotWaterTanksTable.tsx:176`, `HotWaterHeatersTable.tsx:192`,
  `PumpsTable.tsx:171`, `AppliancesTable.tsx:179`,
  `ElectricHeatersTable.tsx:97`, `FansTable.tsx:182`,
  `VentilatorsTable.tsx:148`)
- **Why:** Mostly use `rel="noreferrer"`, which implies `noopener` in
  modern browsers — acceptable today, brittle tomorrow. Also, no
  protocol allowlist on `href`.
- **Fix:** Extract the `StatusExternalLink` href-allowlist pattern
  (already proven in `StatusDescription.tsx`) into a shared
  `<ExternalLink>` component used everywhere.

### M-16. `_safe_header_filename` does not emit RFC 6266 filename* for non-ASCII

- **File:** `backend/features/assets/service.py:684-685`
- **Why:** Correctness, not security — but worth fixing while in the area.
- **Fix:** Emit `filename*=UTF-8''<percent-encoded>` for non-ASCII names.

### M-17. Error envelope can echo raw `HTTPException.detail`

- **File:** `backend/features/shared/errors.py:81-88`
- **Why:** For 5xx, library-emitted detail strings can leak internal
  paths. App code uses dict details, so risk is limited to dependencies.
- **Fix:** For 5xx codes, replace `message` with a generic string and
  only log the original.

### M-18. No catch-all exception handler — fallbacks lose `X-Request-ID`

- **File:** `backend/features/shared/middleware.py:83-86`, `backend/main.py`
- **Fix:** Add `app.add_exception_handler(Exception, ...)` returning the
  `ErrorEnvelope` with the request id and logging the traceback.

---

## Low

### L-1. `client_ip` trusts `X-Forwarded-For` blindly

- **File:** `backend/features/shared/http.py:17-30`
- **Fix:** Only honor XFF when the immediate peer is in a configured
  `trusted_proxies` list.

### L-2. No `Max-Length` on stored `User-Agent`

- **File:** `backend/features/auth/service.py:34-35`
- **Fix:** Truncate to 512 chars before insert.

### L-3. No password reset / email verification flow

- **Notes:** Admin-only via CLI is fine. Decide intentionally before
  going public; if you add a flow, mirror the MCP token pattern
  (short-lived single-use, stored as hash, rate-limited).

### L-4. `verify_password` swallows `Argon2Error`

- **File:** `backend/features/auth/passwords.py:23-27`
- **Fix:** Log non-mismatch argon2 errors at WARN so corrupted hashes
  surface.

### L-5. No `check_needs_rehash` on login

- **File:** `backend/features/auth/passwords.py`
- **Fix:** After successful verify, call `ph.check_needs_rehash` and
  silently re-hash if true.

### L-6. `check_bt_number_available` reveals other projects' names

- **File:** `backend/features/projects/routes.py:81-86`
- **Fix:** Return `available: false` without conflict details for
  projects the user does not own.

### L-7. No `Content-Length` cap in middleware

- **File:** `backend/features/shared/middleware.py`
- **Fix:** Reject bodies > N MB in middleware (defense in depth — Render
  config should also enforce).

### L-8. Login-failed audit log doesn't distinguish race-recheck

- **File:** `backend/features/auth/service.py:91-121`
- **Fix:** Use `login_failed_race` action for the race-recheck branch.

### L-9. `extra="allow"` on `AssetMetadata`

- **File:** `backend/features/assets/schemas.py:14`
- **Fix:** Tighten to `extra="forbid"` and enumerate keys, or document
  the trusted-write invariant with a test.

### L-10. String fields without `max_length` on attach/upload requests

- **File:** `backend/features/assets/schemas.py:118-128, 148`
- **Fix:** Add `Field(max_length=200)` to `table_key`, `field_key`,
  `row_id`, `version_id` (UUID pattern), `if_match*` (etag pattern), and
  cap `filename_pattern` (line 148) at e.g. 500 chars.

### L-11. JSON import in catalogs lacks size cap

- **Files:** `frontend/src/features/catalogs/{materials,glazing-types,frame-types}/import_export/ImportDialog.tsx`
- **Fix:** Cap file size before `JSON.parse` (e.g. 5 MB); validate
  shape with Zod before forwarding.

### L-12. MCP token hash has no HMAC pepper

- **File:** `backend/features/mcp/service.py:43-44`
- **Why:** SHA-256 of 256-bit token. DB exfiltration alone cannot
  practically validate tokens (entropy too high). The `fernet_secret_key`
  config field is already declared but unused.
- **Fix (low priority):** Use HMAC-SHA256 with the existing
  `fernet_secret_key` as a pepper.

### L-13. `python-jose` and `passlib` may be unused/vestigial

- **File:** `backend/pyproject.toml:6-27`
- **Why:** Sessions are opaque (not JWT). Argon2 is via `argon2-cffi`,
  not passlib. `python-jose` has algorithm-confusion CVE history.
- **Fix:** Audit usage; remove if unused. Add `pip-audit` to CI.

### L-14. `lucide-react` major version looks unusual

- **File:** `frontend/package.json`
- **Fix:** Verify it's the intended package (not a typosquat).

---

## Info — confirmations of good posture

The following were verified as **correctly implemented** and need no action.
Listing them so future reviewers can skip these areas faster.

- **I-1.** Session ID rotation on login (anti-fixation), invalidation of
  prior sessions, real server-side revocation on logout
  (`features/auth/service.py:125-151, 256-282`; `repository.py:189-203`).
- **I-2.** Session is an opaque UUID4 pointer to a DB row; not a JWT.
- **I-3.** Argon2id parameters meet OWASP minimums
  (`time_cost=3, memory_cost=64 MiB, parallelism=4`).
- **I-4.** CORS uses a finite origin list, no wildcard with credentials.
- **I-5.** CSRF posture: `SameSite=lax` cookie + Origin allowlist on
  mutating `/api/*` requests. Adequate for the threat model.
- **I-6.** MCP tokens are properly bound to a single project and scope-
  checked at every tool call.
- **I-7.** **No SQL injection vectors found.** Every query uses
  parameterized `%(name)s` bindings or psycopg's `sql.SQL` /
  `sql.Identifier` / `sql.Placeholder`. Dynamic UPDATE assignments are
  pre-filtered through frozenset allowlists. `ORDER BY` is always a
  hardcoded constant.
- **I-8.** **No unsafe deserialization.** No `pickle`, `yaml.load`,
  `eval`, `exec`, `marshal`, `xml.etree`, `lxml`. All `json.loads` is
  behind size limits.
- **I-9.** **No SSRF.** No outbound HTTP from user-controlled URLs.
  R2 signed URLs are server-constructed.
- **I-10.** **No subprocess / shell.** PDF and image rendering go
  through in-process libraries (`pypdfium2`, `Pillow`).
- **I-11.** Pydantic strict validation: 213 of 239 `BaseModel` classes
  use `extra="forbid"`; the `extra="allow"`/`"ignore"` cases are
  intentional (catalog row passthroughs, namespaced custom-field keys).
- **I-12.** File upload validation: allowlist on `asset_kind`, size cap,
  per-field content-type allowlist, magic-byte checks for PDF/PNG/JPEG/WEBP
  (`features/assets/service.py:352-393`). Object keys are server-built
  from `project_id` + server-generated `asset_id`; path traversal not
  possible. `_dedupe_path` explicitly strips `..`/`.` segments.
- **I-13.** Logging: redacts a frozenset of sensitive keys; truncates
  large strings at 4096 chars; downgrades `httpx`/`boto3`/`urllib3` to
  WARNING. (See M-5 for the redaction list gap.)
- **I-14.** Frontend auth: cookie-only, `credentials: "include"`. No
  tokens in `localStorage`/`sessionStorage`. All observed `localStorage`
  is benign UI preference state.
- **I-15.** Markdown rendering uses `react-markdown` with `skipHtml`,
  `allowedElements`, `rehype-sanitize` with explicit tag/attribute/
  protocol allowlists, and a re-check of `^https?://` on `<a>` hrefs
  (`features/project_status/components/StatusDescription.tsx`). Model
  implementation — use this pattern elsewhere.
- **I-16.** No `dangerouslySetInnerHTML`, `eval`, `document.write`, or
  `new Function` in production frontend code.
- **I-17.** API base URL is env-injected via Vite (`VITE_API_BASE_URL`),
  defaults to same-origin.
- **I-18.** `BroadcastChannel.postMessage` (not `window.postMessage`),
  so cross-origin concerns don't apply.
- **I-19.** MCP transport DNS-rebinding protection enabled by default
  (`config.py:71`).
- **I-20.** Secrets scan: no live credentials in tracked files. `.env`
  correctly gitignored. The only "secret-like" tracked values are
  intentional weak local-only defaults (and the C-1 seed password).
- **I-21.** Account-enumeration vectors: `/login`, `/preferences`, and
  signup paths all return generic error codes. No enumeration vector
  found.

---

## Recommended ordering for the deploy gate

A pragmatic two-pass plan that matches the small-app / no-truly-sensitive-data
posture you described:

**Pass 1 — Must-fix before the public deploy** (one or two days of work):

1. C-1 — kill the literal `password` seed value
2. C-2 + C-3 — owner check in `require_project_edit_access` AND in
   `update_project_metadata` (one PR)
3. C-4 — add `users.is_admin` and gate catalog writes
4. C-5 — cap MCP token TTL and cascade-revoke on user disable
5. C-6 — require auth on `/assets/{id}/url`, `/download`, `bulk-urls`
   (or shorten TTL drastically + cap bulk)
6. H-1 — `Settings` validator that refuses empty secrets in prod
7. H-2 — security-headers middleware
8. H-5 — add `sandbox=""` to the PDF iframe
9. H-8 — set `Image.MAX_IMAGE_PIXELS`
10. H-9 — enforce `sslmode=require` in prod

**Pass 2 — Strongly recommended before public traffic** (another day):

11. H-3 — login rate limiting (`slowapi`)
12. H-4 — absolute session lifetime cap
13. H-6 — define and ship a CSP
14. H-7 — disable GZip on MCP token issuance route
15. M-5 — tighten `_SENSITIVE_KEYS` redaction to substring matching
16. M-10 — `?next=` allowlist
17. M-11 + M-12 — bind Docker ports to 127.0.0.1, drop MinIO `*` CORS
18. M-15 — shared `<ExternalLink>` component with href allowlist

**Pass 3 — Hardening you can land over the following weeks** without
blocking the deploy: everything else in Medium / Low.

---

## Appendix — files touched by this review

Backend feature modules read: `auth/*`, `projects/*`, `assets/*`,
`mcp/*`, `catalogs/{materials,glazing_types,frame_types}/*`,
`project_document/*`, `project_status/*`, `envelope/*`,
`table_views/*`, `aperture_*/*`, `shared/{middleware,errors,http}.py`.

Backend infra read: `main.py`, `config.py`, `database.py`,
`logging_config.py`, `pyproject.toml`, `seeds/user.json`,
`scripts/seed_*.py`, `alembic.ini`.

Repo-level: `Makefile`, `docker-compose.yml`, `.mcp.json`, `.gitignore`,
`backend/.env.example`, `frontend/.env.example`.

Frontend: `src/` features (auth, assets, catalogs, project_status,
project_document, equipment, table_views), `src/shared/api/client.ts`,
`vite.config.ts`, `index.html`, `package.json`.
