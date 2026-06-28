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

**State:** Phase 0 staging/admin rehearsal is complete and Phase 1 prep is
active (2026-06-27). Render account, V0 hosting, domain/DNS setup, naming
policy, and cost-sizing facts are mapped and verified. The production Blueprint
validates, production R2 bucket/CORS/lifecycle work is complete, and production
R2 credentials are stored in Apple Passwords. The next manual gate is Ed's explicit
confirmation to apply the paid production Blueprint.

**Gate update (2026-06-27):** the admin-user-management MVP is **built and tested
end-to-end** (Phases 00–06, `make ci` green); the gate is not yet cleared — it
needs the production-verification checklist below. See "Production-readiness
gate".

## Production-readiness gate

Do not proceed to paid V1 production services, production account creation, DNS
cutover, or GitHub repo canonicalization until the Admin User Management gate
clears. The gate's two-user MVP capability is **built** in
`planning/features/admin-user-management/` (Phases 00–06, `make ci` green):

- ✅ invite-only user creation;
- ✅ admin-generated reset links without temporary admin-set passwords;
- ✅ minimal admin user dashboard;
- ✅ user deactivation/reactivation;
- ✅ `admin.users.manage` capability enforcement;
- ✅ Origin + `X-PHN-CSRF` guard on unsafe admin mutations (production defaults
  to `SameSite=Lax`);
- ✅ last-admin lockout protection;
- ✅ audit logging for sensitive user actions.

**Remaining to clear the gate** is a production-verification checklist, not new
build — it runs as a discrete step inside Phase 0/1 (see `PLAN.md` → "Gate —
Admin user management" and the admin-user-management Phase 06 doc). The staging
rehearsal is complete; production/custom-domain verification is still pending:

- [ ] Set staging/prod env `ACCOUNT_TOKEN_SECRET` + `FRONTEND_BASE_URL`
      (staging service set and redeployed; production env still pending).
- [ ] Rehearse the full lifecycle on staging / prod-onrender URLs (bootstrap
      + Ed sign-in + test-user invite → reset → deactivate/reactivate →
      grant/revoke → audit complete on staging; repeat on production pending).
- [ ] Confirm cookie/Origin/CSRF on the real `www → api` split origin.
- [ ] Browser smoke `/admin/users` (staging admin/normal-user smoke complete;
      production smoke pending).

Not part of this rollout gate at all: public self-service reset, transactional
email, durable reset/invite-resend rate limiting, fresh admin re-authentication,
MFA/passkeys, external users, richer IAM, and audit export — tracked in
`planning/features_v2.0/`.

Allowed before this gate clears: local development, planning, `render.prod.yaml`
drafting, production R2 bucket/CORS/lifecycle prep, and optional Phase 0 staging
sanity checks that do not create the real paid production environment or move
public domains.

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
  - Author `render.prod.yaml` (paid DB + always-on web, prod env values,
    `api.ph-nav.com` / `www.ph-nav.com`, consistent MCP naming, prod secrets as
    `sync: false`).
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
complete. `render.prod.yaml` is drafted and validates with the Render CLI.
Next: prepare the Dashboard Blueprint apply; do not apply paid production
services until Ed explicitly confirms Phase 1 execution. The V1 production
Render services do not exist yet, so Apple Passwords-backed `sync:false` values must
be entered manually during Blueprint apply: `R2_ACCOUNT_ID`, `R2_ENDPOINT_URL`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `FERNET_SECRET_KEY`,
and `ACCOUNT_TOKEN_SECRET`. `MAPTILER_API_KEY` is intentionally omitted because
PHN has no existing MapTiler account/key and falls back to Census geocoding.
Phase 1+ production execution still needs production env values,
production/custom-domain cookie/CSRF, and production `/admin/users` smoke.

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
- 2026-06-27 — DNS: `www`→V0 static (200), apex→Render anycast→301 www;
  `api`/`v0` absent. Dashboard: 1 project, V0=Production (paid PG16, Ohio),
  new app=Staging (3 services suspended by Ed), Hobby workspace. Render free-Postgres
  cap = 1/workspace (paid unlimited) — confirms two DBs coexist.
- 2026-06-27 — Ed screenshots confirmed V0 backend tier (`Standard`, 1 CPU /
  2 GB) and V0 DB tier (`Basic-256mb`, 1 GB disk). Step 1 assumptions locked.

## Notes / wrinkles to fix in prod blueprint

- Staging `render.yaml` points `VITE_API_BASE_URL`/MCP URLs at
  `ph-navigator-v2.onrender.com` while the API service is
  `ph-navigator-v2-api-staging` — make these consistent in `render.prod.yaml`
  (target `api.ph-nav.com`).
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
