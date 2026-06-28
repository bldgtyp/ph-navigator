---
DATE: 2026-06-27
TIME: 16:34 EDT
STATUS: Active
AUTHOR: Claude (for Ed May)
SCOPE: Live status + open decisions for the new PH-Navigator V1 production rollout.
RELATED:
  - ./PLAN.md
  - ./README.md
  - ../admin-user-management/STATUS.md
  - ../../features_v2.0/public-account-recovery/STATUS.md
  - ../../features_v2.0/account-security-hardening/STATUS.md
---

# Status — PH-Navigator V1 Production Rollout

**State:** Phase 0 staging/admin rehearsal, Phase 1 production infra, and the
Phase 2 public domain cutover are complete at the Render/DNS/network layer
(2026-06-28). Render account, V0 hosting, domain/DNS setup, naming policy, and
cost-sizing facts are mapped and verified. The production R2 bucket/CORS/
lifecycle work is complete, production R2 credentials are stored in Apple
Passwords, and the paid production Blueprint created the DB/API/static services.
The Phase 2 custom-domain Blueprint sync is live on commit `fa40334c`; public
API CORS/CSRF negative checks pass on `api.ph-nav.com`, and the signed-in
browser `SameSite=Lax` `/admin/users` smoke passed on
`https://www.ph-nav.com` against `https://api.ph-nav.com`.

**Gate update (2026-06-27):** the admin-user-management MVP is **built and tested
end-to-end** (Phases 00–06, `make ci` green); the production-verification gate
is now cleared. See "Production-readiness gate".

## Production-readiness gate

The paid Phase 1 production environment now exists after Ed's explicit Blueprint
apply confirmation. Do not proceed to production account lifecycle, DNS cutover,
or GitHub repo canonicalization until the Admin User Management gate progresses
through the audited production rehearsal. The gate's two-user MVP capability is
**built** in `planning/features/admin-user-management/` (Phases 00–06,
`make ci` green):

- ✅ invite-only user creation;
- ✅ admin-generated reset links without temporary admin-set passwords;
- ✅ minimal admin user dashboard;
- ✅ user deactivation/reactivation;
- ✅ `admin.users.manage` capability enforcement;
- ✅ Origin + `X-PHN-CSRF` guard on unsafe admin mutations (production defaults
  to `SameSite=Lax`);
- ✅ last-admin lockout protection;
- ✅ audit logging for sensitive user actions.

**Gate cleared (2026-06-28):** the production-verification checklist is complete.
It ran as a discrete rollout step (see `PLAN.md` → "Gate — Admin user
management" and the admin-user-management Phase 06 doc). The staging,
prod-onrender, and custom-domain browser smokes are complete:

- [x] Set staging/prod env `ACCOUNT_TOKEN_SECRET` + `FRONTEND_BASE_URL`
      (staging service set and redeployed; production Blueprint applied with
      both values, then synced on `41c522bc` so production `FRONTEND_BASE_URL`
      points at the Phase 1 prod Render URL).
- [x] Rehearse the full lifecycle on staging / prod-onrender URLs (bootstrap
      + Ed sign-in + test-user invite → reset → deactivate/reactivate →
      grant/revoke → audit complete on staging; production backend bootstrap
      + Ed browser sign-in + disposable test-user lifecycle complete).
- [x] Confirm cookie/Origin/CSRF on the real `www → api` split origin (public
      API guard negatives pass; signed-in browser cookie smoke passed).
- [x] Browser smoke `/admin/users` (staging admin/normal-user smoke complete;
      production admin/normal-user smoke complete).

Not part of this rollout gate at all: public self-service reset, transactional
email, durable reset/invite-resend rate limiting, fresh admin re-authentication,
MFA/passkeys, external users, richer IAM, and audit export — tracked in
`planning/features_v2.0/`.

With this gate clear, Phase 3 repo canonicalization can proceed after the
remaining production-smoke housekeeping (notably production upload/R2 CORS
cleanup) is handled.

## Decisions — settled (2026-06-27)

1. ✅ **Fresh data, no migration** — new V1 launches empty; existing projects
   stay on legacy V0 at `v0.ph-nav.com` and get recreated in V1 as we go.
2. ✅ **`api.ph-nav.com`** — V1 backend gets its own subdomain; prod blueprint
   targets it (and fixes the `VITE_API_BASE_URL`/MCP naming wrinkle).
3. ✅ **Budget** — approved to pay for V1's own paid Postgres + always-on web
   service. V0 currently uses `Basic-256mb` Postgres with 1 GB disk and a
   `Standard` 1 CPU / 2 GB backend; V1 should use paid Postgres and an
   intentionally chosen always-on web tier.
4. ✅ **V0 home** — `v0.ph-nav.com`.
5. ✅ **Repo names after cutover** — legacy repo becomes `ph-navigator_v0`; new
   repo takes over canonical `ph-navigator`; future product versions are normal
   releases inside that repo, not new repos.
6. ✅ **Future naming policy** — canonical URLs/repos/folders stay unversioned;
   only deprecated generations get numbered aliases. `/api/v1` remains the API
   contract version and is not tied to the product generation name.

## Cost-sizing facts from Render screenshots (2026-06-27)

- `ph_navigator` (V0 prod DB): `Basic-256mb` + `Basic-256mb Disk (1GB)`;
  current month-to-date datastore charge shown as `$5.67`.
- `ph-navigator-backend` (V0 web): `Standard`, `1 CPU`, `2 GB`; current
  month-to-date service charge shown as `$22.49`.
- For V1: start with the smallest paid Postgres (`Basic-256mb`, 1 GB disk) and
  choose the web tier intentionally. Matching V0's `Standard` tier is safer;
  starting smaller is acceptable only if Render performance/availability gates
  are checked during Phase 1.

## Step 1 completion

Complete as of 2026-06-27. No additional assumptions need confirmation before
the admin-user-management gate. The only tier choice deferred into execution is
whether V1 web should match V0 `Standard` immediately or prove a smaller paid
always-on tier during Phase 1 smoke/performance checks.

## Execution surface (who does what)

The work splits into two surfaces:

- **In-repo (Claude can do now, no dashboard):**
  - Author/update `render.prod.yaml` (paid DB + always-on web, Phase 1 prod
    Render URLs first, later `api.ph-nav.com` / `www.ph-nav.com`, consistent
    MCP naming, prod secrets as `sync: false`).
  - Stage the one-line V0 CORS change (`https://v0.ph-nav.com`) in the V0 repo.
  - Add the GitHub repo rename/reorg choreography to the rollout phase plan.
  - Update `context/ENVIRONMENT.md` with a "Render production" section (Phase 4).
- **Dashboard / DreamHost (needs Ed; browser extension not paired this session
  — use screenshots):**
  - Resume/suspend services; apply the blueprint; create the R2 prod bucket +
    CORS; enter prod secrets; add/move custom domains; edit DNS records; run the
    audited first-admin bootstrap after Admin User Management lands; seed climate
    data.

## Next concrete step

Decisions are settled (above), the admin-user-management capability is built,
and the staging admin lifecycle rehearsal plus non-admin product smoke are
complete. Production DB/API/static services are live, and the Phase 2 custom
domain retarget/cutover is complete: `www.ph-nav.com` serves V1,
`ph-nav.com` redirects to `www`, `api.ph-nav.com` is healthy/ready, and
`v0.ph-nav.com` still serves V0 with V0 backend CORS. The remaining manual gate
is Ed signing in on `https://www.ph-nav.com` so the `SameSite=Lax`
`www.ph-nav.com` → `api.ph-nav.com` browser `/admin/users` and unsafe-mutation
smoke can finish.
Do not delete the old V1 `*-staging` trio yet; it is Phase 4 cleanup after
production smoke, DNS cutover, and repo reconnect verification. Suspending the
staging services can be considered earlier if cost needs to be reduced, but
deletion should wait until the fallback/debug surface is no longer useful.
The next concrete rollout step is production upload/R2 smoke on `www.ph-nav.com`,
then remove the temporary `ph-navigator-web.onrender.com` CORS origin from the
prod R2 bucket before Phase 3 repo canonicalization.

No open Step 1 decisions remain.

## Verification log

- 2026-06-27 22:03 EDT — Staging API deploy `dep-d907r3b7uimc7395d27g` failed
  because the existing empty DB still recorded removed Alembic revision
  `20260624_0043` after the migration squash. With no staging data to preserve,
  reset the staging DB schema via Render `psql`, removed the temporary Codex DB
  allow-list entry afterward, and redeployed `dep-d90800r7uimc7395h7k0` on
  commit `0af3d95d`. Alembic replayed baseline `20260624_0001` through head
  `20260627_0004`; `https://ph-navigator-v2.onrender.com/api/v1/health` and
  `/api/v1/ready` both returned 200 (`db:true`).
- 2026-06-27 22:12 EDT — Upgraded staging DB
  `ph-navigator-v2-staging-db` (`dpg-d8o46uhkh4rs73ebvvgg-a`) in place from
  Render `free` to `basic_256mb` with 1 GB disk. Render now reports
  `status=available`, `expiresAt=null`, and only Ed's `38.89.128.28/32` DB
  allow-list entry is present. During the resize the running API's DB pool
  timed out (`psycopg_pool.PoolTimeout` on `/api/v1/ready`); restarting staging
  API service `ph-navigator-v2-api-staging` (`srv-d81op9vlk1mc73b1kk50`)
  restored `/api/v1/health` and `/api/v1/ready` to 200 (`db:true`). The API
  service remains on web `free`; Render one-off jobs are blocked on this plan,
  and CLI SSH reached Render but failed with `Permission denied (publickey)`.
- 2026-06-27 22:18 EDT — Marked Phase 0 staging infra tasks complete in
  `PLAN.md` (resume/reset/upgrade/health-ready). Added staging Blueprint entries
  for `FRONTEND_BASE_URL=https://ph-navigator-v2-staging.onrender.com` and
  `ACCOUNT_TOKEN_SECRET` (`sync:false`); still pending Dashboard/Blueprint sync
  and a service-env bootstrap path. Static staging frontend returned HTTP 200.
- 2026-06-27 22:25 EDT — Set `FRONTEND_BASE_URL` and generated
  `ACCOUNT_TOKEN_SECRET` directly on staging API service
  `srv-d81op9vlk1mc73b1kk50` through the Render Dashboard; deploy
  `dep-d908ao3sq97s7394phkg` went live from commit `0af3d95d`.
  `/api/v1/health` and `/api/v1/ready` both returned 200 (`db:true`). Dashboard
  Shell then confirmed the next blocker: Shell access is not supported on free
  instance types; the modal lists Shell/SSH/one-off jobs behind upgrade.
- 2026-06-27 22:30 EDT — Staging API was upgraded to Render web `starter`
  (512 MB / 0.5 CPU) and service-updated deploy `dep-d908csho3t8c73c12g60`
  went live. `/api/v1/health` and `/api/v1/ready` returned 200. One-off job
  `job-d908dr6gvqtc7399k4b0` ran
  `uv run python -m scripts.bootstrap_admin --email ed@example.com --display-name 'Ed May'`,
  succeeded, created/repaired Ed's invited admin account, and granted
  `admin.users.manage`. The one-time invite link was opened in the default
  browser, not copied into this planning doc.
- 2026-06-27 22:43 EDT — Completed the staging admin-user lifecycle rehearsal.
  Ed signed in as the bootstrapped admin and `/admin/users` showed the `Users`
  nav plus the user dashboard. Invited `codex-staging-test@example.com`,
  completed its invite in an isolated browser, generated and completed an
  admin reset link, deactivated/reactivated the account, completed the
  reactivation reset link, granted and revoked Admin, and verified the audit
  modal contains `admin_user_invited`, `account_invite_completed`,
  `admin_reset_link_generated`, `password_reset_completed`,
  `admin_user_deactivated`, `admin_user_reactivated`,
  `admin_capability_granted`, and `admin_capability_revoked`. Final test-user
  state is `Active / User`; direct `/admin/users` as that user returns
  `Not authorized` / `You do not have permission to manage users.`
- 2026-06-27 22:43 EDT — Confirmed staging split-origin cookie/CSRF behavior.
  Browser admin writes succeeded from
  `https://ph-navigator-v2-staging.onrender.com` to
  `https://ph-navigator-v2.onrender.com`; curl negative checks returned
  `csrf_header_missing` when `X-PHN-CSRF` was absent from a trusted Origin and
  `origin_not_allowed` for `https://evil.test` even with the header. The
  production `www.ph-nav.com` → `api.ph-nav.com` check remains pending because
  those services/domains do not exist yet.
- 2026-06-27 22:47 EDT — During the reset/reactivation rehearsal, reusing the
  same `/reset#token=...` tab for a second token left the prior `Password set`
  UI mounted. Fixed `AccountCompletePage` so the completion form remounts on
  `mode + token`, added a regression test for same-tab second reset links, and
  ran `pnpm run test -- src/features/auth/routes/__tests__/AccountCompletePage.test.tsx`
  from `frontend/`; the command completed the full frontend Vitest suite green
  (`208` files, `1954` tests). Targeted ESLint and Prettier checks passed for
  the touched auth files, and `make frontend-dev-check` passed (existing
  repo-wide Fast Refresh warnings only).
- 2026-06-27 23:04 EDT — Staging non-admin product smoke passed.
  Created project `STG-20260627-2250 - Codex Staging Smoke`, edited it through
  Project settings to `Codex Staging Smoke Updated`, and read the staging DB
  back as `STG-20260627-2250 - Codex Staging Smoke Updated` for project
  `ec58eec4-2d9f-40a0-99a2-018521d6e225`. After Ed signed back into staging,
  the manual Model upload succeeded: `ph_nav_v2_example` uploaded through the
  browser UI and rendered in the Model viewer at the same project route. No new
  staging boot/secret blocker surfaced; carry the known production
  Blueprint/R2/custom-domain work into Phase 1.
- 2026-06-27 23:12 EDT — Drafted production Blueprint
  `render.prod.yaml`: `ph-navigator-db` (`basic-256mb`, 1 GB, PostgreSQL 16,
  Ohio), `ph-navigator-api` (`standard`, Python, `api.ph-nav.com` env), and
  `ph-navigator-web` (static, `www.ph-nav.com` / apex env). Secrets and
  account-identifying R2 values are `sync:false`; production bucket target is
  `ph-navigator-prod`. `render blueprints validate ./render.prod.yaml -o json`
  returned `valid:true` with three create actions.
- 2026-06-27 23:18 EDT — Created and configured Cloudflare R2 bucket
  `ph-navigator-prod` in account `f9d264cceb6b9b13ad80ff784318975f`
  (Phtools@bldgtyp.com). Bucket creation returned ENAM + Standard storage;
  managed `r2.dev` public access is disabled. CORS allows
  `https://www.ph-nav.com`, `https://ph-nav.com`, and temporary
  `https://ph-navigator-web.onrender.com` for `PUT`, `GET`, and `HEAD`, with
  `ETag` exposed and max age `3600`. Fixed the orphan-object key shape to
  `projects/_orphaned/{project_id}/{asset_id}/{filename}`, then set lifecycle
  on both `ph-navigator-prod` and `ph-navigator-v2-dev`: abort multipart
  uploads after 7 days and delete only `projects/_orphaned/` objects after
  90 days. The previous dev lifecycle rule's broad `projects/` delete filter
  is no longer present. Remaining R2 task at this point: mint/store prod S3
  credentials.
- 2026-06-27 23:25 EDT — Credential handoff preflight complete. `op` is not
  installed/available in the Codex shell, `OP_SERVICE_ACCOUNT_TOKEN` and
  `RENDER_API_KEY` are unset, and `render services -o json` shows only V0
  production plus V1 staging resources; V1 production services have not been
  created yet. Keep the R2 credential subtask open until Ed creates the
  Cloudflare R2 token and stores the one-time Secret Access Key in Apple Passwords.
- 2026-06-27 23:35 EDT — Ed confirmed production R2 credentials are created
  and stored in Apple Passwords. Marked the R2 bucket/CORS/lifecycle/credential-prep
  item complete. The values still need to be entered into Render when the
  production Blueprint is applied.
- 2026-06-27 23:37 EDT — Blueprint secret preflight: Render will also prompt for
  `FERNET_SECRET_KEY` and `ACCOUNT_TOKEN_SECRET` because they are `sync:false`
  in `render.prod.yaml`. `FERNET_SECRET_KEY` must be a
  Fernet key generated with
  `uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
  `ACCOUNT_TOKEN_SECRET` should be a high-entropy random secret; it keys
  invite/reset token hashes.
- 2026-06-27 23:42 EDT — Ed generated the production `FERNET_SECRET_KEY` and
  `ACCOUNT_TOKEN_SECRET`. Local env check found no `MAPTILER_API_KEY` in
  `backend/.env`, `backend/.env.example`, `frontend/.env.local`, or
  `frontend/.env.example`; Ed confirmed there is no existing MapTiler key in
  Render either. Removed `MAPTILER_API_KEY` from `render.prod.yaml` so Blueprint
  apply does not prompt for it. Address geocoding will use the Census fallback.
- 2026-06-27 23:49 EDT — Committed and pushed production apply prep to
  `origin/main` at `23e19c2e`. `render.prod.yaml` validates (`valid:true`) and
  creates `ph-navigator-db`, `ph-navigator-api`, and `ph-navigator-web`. Render
  Dashboard apply should use repo `bldgtyp/ph-navigator-v2`, branch `main`, and
  **Blueprint Path** `render.prod.yaml`.
- 2026-06-27 23:58 EDT — Started the Render Dashboard Blueprint apply. Selected
  repo `bldgtyp/ph-navigator-v2`, branch `main`, set **Blueprint Path** to
  `render.prod.yaml`, and confirmed the review changed from staging
  associations to creating `ph-navigator-db`, `ph-navigator-api`, and
  `ph-navigator-web` (`$31.30/month` estimate shown). Entered the fixed
  non-secret `R2_ACCOUNT_ID` and `R2_ENDPOINT_URL` fields. Pending manual
  secret entry from Apple Passwords: `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `FERNET_SECRET_KEY`, and `ACCOUNT_TOKEN_SECRET`.
- 2026-06-28 00:05 EDT — Ed entered all remaining production secrets and clicked
  **Deploy Blueprint**. Render created `ph-navigator-db`
  (`dpg-d909olr7uimc7396sls0-a`, `basic_256mb`, Ohio, available),
  `ph-navigator-api` (`srv-d909p1b7uimc7396t580`,
  `https://ph-navigator-api.onrender.com`), and `ph-navigator-web`
  (`srv-d909olr7uimc7396slr0`, `https://ph-navigator-web.onrender.com`).
  Deploy `dep-d909p1r7uimc7396t6c0` for the API and deploy
  `dep-d909om37uimc7396smbg` for the static site both reached `live` on commit
  `7aa208f`. `GET /api/v1/health` returned 200; `GET /api/v1/ready` returned
  200 with `db:true` and `pool_min=2`/`pool_max=10`; the static site returned
  HTTP 200. Recent Render error-log query for both services returned no rows.
- 2026-06-28 00:12 EDT — Found a Phase 1/Phase 2 URL mismatch after the initial
  production apply: `render.prod.yaml` still pointed `FRONTEND_BASE_URL`,
  `VITE_API_BASE_URL`, CORS, and MCP URL/host/origin env at future custom
  domains (`www.ph-nav.com` / `api.ph-nav.com`) even though DNS cutover is a
  later Phase 2 gate. Patched the Blueprint back to the prod Render hosts
  (`https://ph-navigator-web.onrender.com` and
  `https://ph-navigator-api.onrender.com`) before production admin bootstrap.
  Requires one Blueprint sync/redeploy before using invite/reset links.
- 2026-06-28 00:17 EDT — Synced the Phase 1 URL-env Blueprint correction after
  commit `41c522bc`. Render reports API deploy `dep-d909ujn7f7vs73cgf79g`
  (`srv-d909p1b7uimc7396t580`) and web deploy `dep-d909ujn7f7vs73cgf7b0`
  (`srv-d909olr7uimc7396slr0`) are `live`, both triggered by `blueprint_sync`
  from `Retarget prod blueprint to Render smoke URLs`. The served static bundle
  `/assets/index-CWJJsIH8.js` contains
  `https://ph-navigator-api.onrender.com` and no `https://api.ph-nav.com`.
  `GET /api/v1/health` returned 200; `GET /api/v1/ready` returned 200 with
  `db:true`, `pool_min=2`, and `pool_max=10`; the static root returned HTTP
  200. Render error-log queries for the API and web services over the deploy
  window returned no rows.
- 2026-06-28 00:23 EDT — Confirmed the workspace now has three active V1
  production Blueprint resources (`ph-navigator-api`, `ph-navigator-web`,
  `ph-navigator-db`) plus the older V1 staging trio in the `PH-Navigator`
  project (`ph-navigator-v2-api-staging`, `ph-navigator-v2-staging`,
  `ph-navigator-v2-staging-db`). Keep staging until Phase 4 cleanup; it is now
  paid (`starter` API and `basic_256mb` DB), so suspend can be considered for
  cost control, but deletion waits until production smoke/DNS/repo verification
  is complete.
- 2026-06-28 00:28 EDT — Ran production first-admin bootstrap on
  `ph-navigator-api` (`srv-d909p1b7uimc7396t580`) with one-off job
  `job-d90a1bjtqb8s73fjsrm0`; the job succeeded. Opened the one-time link in
  Chrome without storing or copying the raw token into docs/chat. Follow-up
  read-only verification job `job-d90a5dr7uimc73976220` confirmed
  `ed@example.com` exists, is active, has `password_set=true`, and holds
  `admin.users.manage`. Browser reload currently lands on the sign-in form, so
  Ed sign-in and `/admin/users` production smoke remain next.
- 2026-06-28 00:34 EDT — Production browser sign-in reached the app shell as
  `Ed May`, but authenticated reads failed immediately afterward:
  `POST /api/v1/auth/login` returned 200, then `/api/v1/auth/session`,
  `/api/v1/projects`, `/api/v1/projects/deleted`, and `/api/v1/admin/users`
  returned `401 not_authenticated`. Cause: Phase 1 runs the frontend and API
  on two sibling `onrender.com` hosts, which are cross-site to browsers, while
  `render.prod.yaml` still set `SESSION_COOKIE_SAMESITE=lax`. Patch the
  production Blueprint to temporary `SESSION_COOKIE_SAMESITE=none`, sync, have
  Ed sign in again, then rerun `/admin/users` and the lifecycle rehearsal.
- 2026-06-28 00:41 EDT — Synced the Phase 1 cookie correction after commit
  `08e134ff`. Render reports API deploy `dep-d90aaj77f7vs73cgltkg` is `live`
  on `08e134ff` (`Fix prod onrender session cookie`); the static deploy remains
  live on `41c522bc` because no static-site config changed. `GET /api/v1/health`
  returned 200; `GET /api/v1/ready` returned 200 with `db:true`. Read-only
  one-off job `job-d90abmbtqb8s73fk5li0` confirmed
  `{"session_cookie_samesite":"none","environment":"production"}`. Next: Ed
  signs in again so Chrome receives a fresh `SameSite=None` session cookie,
  then rerun `/admin/users` and the production lifecycle rehearsal.
- 2026-06-28 00:47 EDT — Ed signed in again after the cookie correction.
  Production `/admin/users` now renders authenticated admin content instead of
  `401 not_authenticated`: the page shows `Account: Ed May`, the `Invite user`
  button, and row `Ed May / ed@example.com / Active / Admin`. Render logs for
  `/api/v1/admin/users` over the verification window returned no 401 rows.
  Production normal-user block and test-user lifecycle smoke remain pending.
- 2026-06-28 00:59 EDT — Completed the production onrender admin-user
  lifecycle smoke with disposable account `codex-prod-smoke@example.com`.
  Admin UI actions created the invite, generated an admin reset link,
  deactivated/reactivated the user, granted and revoked Admin, and performed a
  final cleanup deactivation so the account is left `Inactive / User`. Invite
  and reset completions were redeemed through the public completion endpoints
  with trusted `Origin: https://ph-navigator-web.onrender.com` and
  `X-PHN-CSRF: 1`; a no-Origin completion attempt was rejected with
  `origin_not_allowed`, confirming the production guard path. An isolated
  browser context signed in as the disposable user and verified `/admin/users`
  shows `Not authorized` / `You do not have permission to manage users.`
  UI audit contained `admin_user_invited`, `account_invite_completed`,
  `admin_reset_link_generated`, `password_reset_completed`,
  `admin_user_deactivated`, `admin_user_reactivated`,
  `admin_capability_granted`, and `admin_capability_revoked`. Read-only Render
  job `job-d90aju6rnols73egvh30` confirmed final DB state:
  `exists=true`, `is_active=false`, `password_set=true`, `capabilities=[]`,
  with the same audit action set.
- 2026-06-28 01:12 EDT — Pre-staged Phase 2 Render custom domains without
  moving public traffic. Added `api.ph-nav.com` to V1 API service
  `ph-navigator-api` (`srv-d909p1b7uimc7396t580`); Render shows
  `Waiting for DNS` / `Waiting for Verification` and requests CNAME host `api`
  target `ph-navigator-api.onrender.com`. Added `v0.ph-nav.com` to V0 static
  service `ph-navigator` (`srv-cv6sj8t2ng1s7380ljpg`); Render shows
  `Waiting for DNS` / `Waiting for Verification` and requests CNAME host `v0`
  target `ph-dash-frontend.onrender.com`. `dig` still shows
  `www.ph-nav.com` on V0 and no `api`/`v0` records. DreamHost is not signed in
  in Chrome, so DNS edits remain manual before Blueprint retarget and final
  `SameSite=Lax` cookie/CSRF smoke.
- 2026-06-28 08:27 EDT — Completed Phase 2 pre-cutover domain staging. Ed added
  DreamHost records CNAME `api` -> `ph-navigator-api.onrender.com`, CNAME `v0`
  -> `ph-dash-frontend.onrender.com`, and existing apex ALIAS still targets the
  V0 static service. Render verified `api.ph-nav.com`; `GET
  https://api.ph-nav.com/api/v1/health` returned 200 and `GET /api/v1/ready`
  returned 200 with `db:true`. Render verified `v0.ph-nav.com`;
  `https://v0.ph-nav.com` returned 200 serving the V0 static bundle. Updated the
  V0 repo (`bldgtyp/ph-navigator`) on `main` commit `01e72fe` to add
  `https://v0.ph-nav.com` to FastAPI CORS and legacy `backend/cors.json`; manual
  V0 backend deploy `dep-d90h51gk1i2s73fm4li0` is live and CORS preflight from
  `Origin: https://v0.ph-nav.com` now returns 200 with
  `access-control-allow-origin: https://v0.ph-nav.com`. Public `www` still
  points at V0; final Blueprint retarget and `www` move remain pending.
- 2026-06-28 09:00 EDT — Completed the Phase 2 production Blueprint retarget
  and public domain cutover at the Render/DNS/network layer. Patched
  `render.prod.yaml` to final custom-domain values:
  `VITE_API_BASE_URL=https://api.ph-nav.com`,
  `FRONTEND_BASE_URL=https://www.ph-nav.com`,
  `CORS_ORIGINS=https://www.ph-nav.com,https://ph-nav.com`, MCP issuer/resource
  URLs on `https://api.ph-nav.com`, `MCP_ALLOWED_HOSTS=api.ph-nav.com`,
  `MCP_ALLOWED_ORIGINS=https://www.ph-nav.com,https://ph-nav.com`, and
  `SESSION_COOKIE_SAMESITE=lax`. `render blueprints validate ./render.prod.yaml
  -o json` returned `valid:true`; Blueprint sync deployed API
  `dep-d90h9go0697c73cossf0` and web `dep-d90h9go0697c73cosscg` live on commit
  `fa40334c`. The V1 static bundle served from `https://www.ph-nav.com`
  references `https://api.ph-nav.com` and not the old Render API URL. Render
  custom-domain ownership moved `www.ph-nav.com` + apex `ph-nav.com` from V0
  static service `srv-cv6sj8t2ng1s7380ljpg` to V1 static service
  `srv-d909olr7uimc7396slr0`; V0 retains only `v0.ph-nav.com`. DreamHost now
  has CNAME `www` -> `ph-navigator-web.onrender.com`, CNAME `api` ->
  `ph-navigator-api.onrender.com`, CNAME `v0` ->
  `ph-dash-frontend.onrender.com`, and ALIAS `@` ->
  `ph-navigator-web.onrender.com`. All three DreamHost nameservers answer
  `www.ph-nav.com CNAME ph-navigator-web.onrender.com`; Render verified both
  `www.ph-nav.com` and `ph-nav.com` and issued certificates. HTTP checks:
  `https://www.ph-nav.com` returned 200, `https://ph-nav.com` returned 301 to
  `https://www.ph-nav.com/`, `https://v0.ph-nav.com` returned 200,
  `GET https://api.ph-nav.com/api/v1/health` returned 200, and `GET /ready`
  returned 200 with `db:true`. CORS preflight from
  `Origin: https://www.ph-nav.com` to `https://api.ph-nav.com` returned 200
  with `access-control-allow-origin: https://www.ph-nav.com`; the same preflight
  from `https://evil.test` returned 400 `Disallowed CORS origin`. Recent API
  logs only showed the expected signed-out `401 not_authenticated` from opening
  `/admin/users` before Ed signed in on the new domain. Browser smoke remains
  pending Ed sign-in on `https://www.ph-nav.com`.
- 2026-06-28 09:09 EDT — Confirmed production custom-domain CSRF guard
  negatives directly against `https://api.ph-nav.com`: trusted
  `Origin: https://www.ph-nav.com` without `X-PHN-CSRF` returned 403
  `csrf_header_missing`; trusted origin with `X-PHN-CSRF: 1` but no browser
  session reached auth and returned 401 `not_authenticated`; untrusted
  `Origin: https://evil.test` with the header returned 403 `origin_not_allowed`.
  The signed-in `www.ph-nav.com` browser cookie/admin smoke remains pending.
- 2026-06-28 09:13 EDT — Confirmed signed-in custom-domain browser smoke after
  Ed signed in as `ed@example.com` on `https://www.ph-nav.com`. Browser DOM at
  `/admin/users` showed `Account: Ed May`, the `Invite user` button, row
  `Ed May / ed@example.com / Active / Admin`, and the disposable
  `Codex Prod Smoke / codex-prod-smoke@example.com / Inactive / User` row.
  Render logs on `srv-d909p1b7uimc7396t580` showed `POST /api/v1/auth/login`
  200, `OPTIONS /api/v1/admin/users` 200, and `GET /api/v1/admin/users` 200
  from Ed's browser IP, proving the real `www.ph-nav.com` -> `api.ph-nav.com`
  `SameSite=Lax` cookie path.
- 2026-06-27 — DNS: `www`→V0 static (200), apex→Render anycast→301 www;
  `api`/`v0` absent. Dashboard: 1 project, V0=Production (paid PG16, Ohio),
  new app=Staging (3 services suspended by Ed), Hobby workspace. Render free-Postgres
  cap = 1/workspace (paid unlimited) — confirms two DBs coexist.
- 2026-06-27 — Ed screenshots confirmed V0 backend tier (`Standard`, 1 CPU /
  2 GB) and V0 DB tier (`Basic-256mb`, 1 GB disk). Step 1 assumptions locked.

## Notes / wrinkles to fix in prod blueprint

- Production `render.prod.yaml` now uses the final Phase 2 custom-domain hosts:
  `www.ph-nav.com` / apex for the frontend and `api.ph-nav.com` for API/MCP.
  The Phase 1 `onrender.com` hosts remain reachable as Render subdomains but
  are no longer the production env targets.
- Product/repo naming now differs from the local checkout name until the rename
  phase completes: legacy app = V0, new app = V1, current local folder still
  `ph-navigator-v2`.
- Production account seeding must not reuse local/staging credentials. Verified
  2026-06-27 that `seed_user.py`, `seed_dev_db.py`, agent fixture seeds, and
  catalog seed scripts refuse production after the catalog-script guard fix.
- Admin user management is now a hard MVP gate, tracked separately in
  `planning/features/admin-user-management/`. Initial prod account creation no
  longer proceeds as the normal rollout path; production launch waits for
  bootstrap, invite, admin reset-link, deactivate/reactivate, admin-grant, and
  audit flows to meet the gate. Public reset/email and hardening are v2.0
  follow-ups.
