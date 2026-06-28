---
DATE: 2026-06-27
TIME: 16:34 EDT
STATUS: Active
AUTHOR: Claude (for Ed May)
SCOPE: Phased plan to deploy the new PH-Navigator V1 to production, cut the root domain over to it, relocate legacy V0 to v0.ph-nav.com, and rename the GitHub repos so the new app becomes canonical.
RELATED:
  - ./README.md
  - ./STATUS.md
  - ../admin-user-management/STATUS.md
  - context/ENVIRONMENT.md
  - render.yaml
---

# PH-Navigator V1 — Production Rollout Plan

## 1. Goal & guardrails

- **Production-readiness gate:** this rollout is blocked behind
  `planning/features/admin-user-management/`. The paid Phase 1 Render
  production environment now exists after Ed's explicit apply confirmation; do
  not proceed to production account lifecycle, public DNS cutover, or repo
  canonicalization until the admin verification checklist reaches the agreed
  production-ready threshold.
- **Promote new V1 to the root domain**: `www.ph-nav.com` + apex `ph-nav.com`.
- **Relocate legacy V0** to `v0.ph-nav.com`; keep it fully running in parallel,
  indefinitely, until Ed decides to decommission.
- **No data migration** V0→V1 (incompatible schemas; V1 is a fresh start).
  Existing project data stays accessible on V0 at `v0.ph-nav.com`.
- **Repo canonicalization:** the legacy repo currently named `ph-navigator`
  becomes `ph-navigator_v0`; this new repo currently named `ph-navigator-v2`
  becomes canonical `ph-navigator`.
- **Versioning model:** after this rollout, product versions/releases happen
  inside the canonical `ph-navigator` repo; future versions do not get new repos
  just because the app version changes.
- **Two-user blast radius** (Ed + John). Short cutover downtime is acceptable;
  optimize for simplicity over zero-downtime engineering.
- **Public repo**: every secret stays `sync: false` in Render / Apple Passwords,
  never committed.

## 1.1 Nomenclature

Use these names everywhere in rollout work:

| Term | Meaning during this rollout |
| --- | --- |
| **V0** | Legacy PH-Navigator app, currently live at root and currently in repo `bldgtyp/ph-navigator` |
| **V1** | New PH-Navigator app, currently checked out locally as `ph-navigator-v2` and planned to take over `bldgtyp/ph-navigator` |
| **`v0.ph-nav.com`** | Deprecated-but-live URL for V0 after cutover |
| **`www.ph-nav.com` / `ph-nav.com`** | Canonical V1 frontend |
| **`api.ph-nav.com`** | Canonical V1 backend API |

## 1.2 Future naming/versioning policy

The rollout should leave us with a stable naming scheme that does not force a
repo/domain rename every time the product version changes:

- **Canonical names stay unversioned:** `bldgtyp/ph-navigator`,
  local folder `ph-navigator`, `www.ph-nav.com`, `ph-nav.com`,
  `api.ph-nav.com`, Render services `ph-navigator-web`,
  `ph-navigator-api`, and `ph-navigator-db`.
- **Deprecated generations get numbered aliases:** the old app becomes V0
  because it is being displaced. Use `ph-navigator_v0` and `v0.ph-nav.com`.
  If a future rewrite ever displaces this V1, then this app can become
  `ph-navigator_v1` / `v1.ph-nav.com` at that future cutover.
- **Temporary replacement candidates should be named as temporary:** use names
  like `ph-navigator-next`, `next.ph-nav.com`, or a Render staging/preview
  service while proving a replacement. The cutover plan must either retire those
  names or rename them to the canonical names.
- **API route versions are contract versions, not product generations:**
  `/api/v1` can remain the current API path for the new V1 app. Add `/api/v2`
  only if a future breaking API contract must coexist with `/api/v1`.
- **Release versions live inside the repo:** use package/app versions, Git tags,
  GitHub releases, changelogs, and migration versions for normal evolution.
  Do not create new repos/domains for ordinary major/minor product releases.

## 2. Initial state (verified 2026-06-27, Render dashboard + live DNS/HTTP)

Single Render project **PH-Navigator** · workspace "Ed May's Workspace"
(**Hobby**, 1 member) · everything in **Ohio**.

**`Production` env group = V0 (LIVE):**

| Service (display) | Type | Region | Notes |
| --- | --- | --- | --- |
| `ph-navigator-backend` | Python 3 web | Ohio | canonical host `ph-dash-0cye.onrender.com` |
| `ph-navigator` | Static site | Global CDN | canonical host `ph-dash-frontend.onrender.com`; **holds `www`+apex** |
| `ph_navigator` | PostgreSQL 16 | Ohio | **paid** (3mo old, "Available"; free would have expired at 30d) |

**`Staging` env group = new V1 under old `v2` service names (SUSPENDED by Ed, 2 days ago):**

| Service | Type | Region | Status |
| --- | --- | --- | --- |
| `ph-navigator-v2-staging-db` | PostgreSQL 16 | Ohio | Suspended (free tier) |
| `ph-navigator-v2-api-staging` | Python 3 web | Ohio | Suspended (free tier) |
| `ph-navigator-v2-staging` | Static site | Global | Suspended (free tier) |

Early screenshots also suggested one dead legacy service `ph-ep-runner`
(suspended ~2yr); Phase 4 later verified no active/preview Render resource with
that name was present.

**Domain / DNS (DreamHost nameservers):**
- `www.ph-nav.com` → CNAME → V0 static (`ph-dash-frontend.onrender.com`), HTTP 200.
- apex `ph-nav.com` → A records `216.24.57.8/9` (Render anycast) → 301 to `www`.
- `api.ph-nav.com`, `v0.ph-nav.com` → do **not** exist yet.
- TLS / CDN fronted by Render's built-in Cloudflare.

**V0 internals relevant to cutover:** JWT-in-localStorage auth (origin-bound),
CORS allow-list in `backend/config.py`, browser API base URL via
`REACT_APP_API_URL` with a hard-coded fallback in
`frontend/src/data/constants.json` (`https://ph-dash-0cye.onrender.com/`).
V0 backend keeps its onrender URL — it does **not** get a custom domain — so
V0's only required code change is adding the new origin to CORS.

## 3. Database concern — resolved

Render Hobby allows **unlimited paid Postgres**; the only cap is **one free
Postgres** per workspace (1 GB, expires 30 days, 14-day grace). V0's DB is
paid; V1 gets its own paid DB. They coexist with no conflict. The free V1
staging DB is the workspace's single free slot today — it will be replaced by a
paid prod DB (see Phase 1) and the staging one retired.

## 4. Target end-state

| Host | Serves | Render service | Cookie/CORS |
| --- | --- | --- | --- |
| `www.ph-nav.com` + `ph-nav.com` | **V1 frontend** | new V1 prod static | — |
| `api.ph-nav.com` | **V1 backend** | new V1 prod web | Admin Phase 01 cookie/CSRF decision; CORS allow `https://www.ph-nav.com` |
| `v0.ph-nav.com` | **V0 frontend** | existing `ph-navigator` static | V0 backend CORS adds this origin |
| `ph-dash-0cye.onrender.com` | V0 backend (unchanged) | existing `ph-navigator-backend` | — |

V1 backend + paid Postgres in Ohio; V1 static on Render's global CDN. R2 prod
bucket `ph-navigator-prod` with browser CORS allowing `https://www.ph-nav.com`.

## 5. Locked decisions

1. **Data**: V1 launches with **fresh data**; no V0→V1 import. V0 remains the
   system of record for existing projects at `v0.ph-nav.com` until each project
   is (manually) recreated in V1. — *Confirmed 2026-06-27.*
2. **API domain**: give the V1 backend a real subdomain **`api.ph-nav.com`**
   (cleaner than calling an `onrender.com` URL cross-origin; lets us tidy the
   `VITE_API_BASE_URL`/MCP naming wrinkle). Alternative: keep V1 backend on its
   `onrender.com` URL (one fewer DNS record, uglier).
3. **Environment model**: run V1 as a **single production environment** now
   (drop the staging/prod split for V1; reintroduce a staging env later if
   needed). Simplest for a solo team and avoids paying for two V1 DBs.
4. **Session cookie / CSRF**: superseded by the Admin User Management Phase 01
   gate. Phase 1 Render-host smoke uses `SameSite=None; Secure` because
   `ph-navigator-web.onrender.com` -> `ph-navigator-api.onrender.com` is
   cross-site in browsers. Preferred custom-domain production posture remains
   proving `SameSite=Lax` works for `www.ph-nav.com` -> `api.ph-nav.com`; if
   `SameSite=None; Secure` remains after Phase 2, it must be paired with
   explicit CSRF/origin protection before admin mutations ship.
5. **V0 lifetime**: keep V0 at `v0.ph-nav.com` **indefinitely**; no
   decommission date set. Phase 5 is a checklist to run only on Ed's word.
6. **Blueprint strategy**: author a separate **`render.prod.yaml`** (or convert
   `render.yaml`) for the prod services with distinct names
   (`ph-navigator-api`, `ph-navigator-web`, `ph-navigator-db`), paid
   plans, and prod env values. Applying it creates fresh prod services; the old
   `-staging` trio is deleted after cutover.
7. **Repo names**: rename `bldgtyp/ph-navigator` → `bldgtyp/ph-navigator_v0`,
   then rename the current new-app repo → `bldgtyp/ph-navigator`. Update Render
   GitHub connections/webhooks if GitHub redirects are not enough.
8. **Future naming policy**: leave canonical prod names unversioned; reserve
   numbered repo/domain aliases for displaced legacy generations. Keep `/api/v1`
   as the API contract path until a real breaking API contract needs `/api/v2`.

## 6. Phased plan

### Gate — Admin user management
**Why:** production needs an in-app way to add, reset, revoke, and audit users
without relying on local/staging-only scripts or reused seed credentials.

**Build: DONE (2026-06-27).** `planning/features/admin-user-management/` Phases
00–06 are implemented and tested end-to-end (`make ci` green): invite,
admin-generated single-use/expiring reset links (no admin-set passwords),
deactivate/reactivate, Admin grant/revoke, server-side `admin.users.manage`
enforcement, transactional last-admin lockout, Origin + `X-PHN-CSRF` guard,
capability-gated UI, audited bootstrap, and audit logging. Public reset/email,
durable rate limiting, re-auth, MFA, and broader IAM remain deferred in
`planning/features_v2.0/`.

**Gate verification — the discrete step that clears this gate.** The capability
is built; clearing the gate is now a production-verification checklist, run as
part of Phase 0/1 below (not a separate feature). It mirrors
`planning/features/admin-user-management/phases/phase-06-production-rehearsal.md`:

- [ ] Set staging/prod env:
      - [x] Staging API service has `FRONTEND_BASE_URL` and
            `ACCOUNT_TOKEN_SECRET`.
      - [x] Production Blueprint/service has `FRONTEND_BASE_URL` and
            `ACCOUNT_TOKEN_SECRET` before production bootstrap. Initial apply
            supplied both values; follow-up Blueprint sync `41c522bc` retargeted
            `FRONTEND_BASE_URL` to the Phase 1 prod Render frontend until DNS
            cutover.
- [x] Rehearse the full lifecycle on staging / prod-onrender URLs: bootstrap Ed
      (`scripts.bootstrap_admin`; add `--confirm-production` only when
      `ENVIRONMENT=production`), invite a test user, complete the invite,
      generate + complete a reset link, deactivate/reactivate, grant/revoke
      Admin, and inspect audit rows.
      - [x] Bootstrap Ed on staging with `scripts.bootstrap_admin`.
      - [x] Complete Ed's invite and sign in on staging.
      - [x] Invite a test user on staging.
      - [x] Complete test-user invite on staging.
      - [x] Generate + complete a reset link on staging.
      - [x] Deactivate/reactivate on staging.
      - [x] Grant/revoke Admin on staging.
      - [x] Inspect audit rows on staging.
      - [x] Repeat on the production onrender environment before
            public cutover.
      - [x] Bootstrap Ed on production with `scripts.bootstrap_admin
            --confirm-production`; DB verification shows Ed active, password set,
            and `admin.users.manage` present.
      - [x] Complete Ed sign-in on production.
      - [x] Invite a test user on production.
      - [x] Complete test-user invite on production.
      - [x] Generate + complete a reset link on production.
      - [x] Deactivate/reactivate on production.
      - [x] Grant/revoke Admin on production.
      - [x] Inspect audit rows on production.
- [x] Confirm cookie/Origin/CSRF on the real split-origin shape
      (`www.ph-nav.com` → `api.ph-nav.com`): `SameSite=Lax` holds and unsafe
      `/api/v1/admin/` writes require a trusted Origin + `X-PHN-CSRF`.
      - [x] Staging onrender split-origin path works:
            `ph-navigator-v2-staging.onrender.com` successfully performed
            admin writes against `ph-navigator-v2.onrender.com` with cookies +
            `X-PHN-CSRF`; missing header and untrusted Origin were rejected.
      - [x] Production public API guard negatives pass:
            `csrf_header_missing` without `X-PHN-CSRF`,
            `origin_not_allowed` from `https://evil.test`, and trusted origin +
            header reaches auth (`401 not_authenticated`) when no cookie is
            present.
      - [x] Production signed-in browser cookie/admin check passed on
            `www.ph-nav.com`: Ed's browser loaded `/admin/users`, and Render
            logs showed 200 for login, admin CORS preflight, and admin GET.
- [x] Browser smoke `/admin/users` (admin sees the nav + page; a normal user is
      blocked).
      - [x] Staging admin sees `Users` nav/page; staging normal user reaches
            `Not authorized` / `You do not have permission to manage users.`
      - [x] Production admin sees `/admin/users` with `Ed May` /
            `ed@example.com` as `Active` / `Admin`.
      - [x] Production normal user reaches `Not authorized` /
            `You do not have permission to manage users.`

When every box is checked, mark the gate cleared in `STATUS.md`; archive the
admin-user-management packet during rollout closeout. If the rehearsal surfaces real rework (e.g.
`SameSite=Lax` fails and split-origin auth needs redesign), spin that out as its
own feature rather than expanding this checklist.

Gate is cleared as of 2026-06-28. Phase 3 repo canonicalization can proceed
after production upload/R2 CORS cleanup and any desired staging-service
cost-control decision.

### Phase 0 — Sanity check on free infra (cheap, optional but recommended)
**Why:** confirm the new app actually boots end-to-end (migrations, R2, auth, MCP)
before paying for prod infra.
1. [x] Resume the three `*-staging` services in Render.
2. [x] Reset the empty staging DB after the Alembic squash left it pointing at
   removed revision `20260624_0043`.
3. [x] Upgrade staging Postgres in place to `basic_256mb` (`basic-256mb` in
   Blueprint YAML) so the 2026-07-15 free-DB expiry no longer applies.
4. [x] Confirm `/api/v1/health` and `/api/v1/ready` go green after the DB reset
   and paid-plan resize.
5. [x] Apply/sync the staging Blueprint/env update for `FRONTEND_BASE_URL` and
   `ACCOUNT_TOKEN_SECRET`, then redeploy/restart the API.
6. [x] Bootstrap Ed with `scripts.bootstrap_admin` using service env. Required
   upgrading staging API from Render web `free` to `starter` so one-off jobs
   could run.
7. [x] Load the static site (`https://ph-navigator-v2-staging.onrender.com`
   returned HTTP 200).
8. [x] Sign in; exercise one project read/write; confirm an R2 signed-URL
   upload.
   - [x] Project read/write smoke passed on staging: created
         `STG-20260627-2250 - Codex Staging Smoke`, edited it to
         `Codex Staging Smoke Updated`, and read it back from the staging DB
         under project id `ec58eec4-2d9f-40a0-99a2-018521d6e225`.
   - [x] R2/model upload smoke passed manually in the staging UI after signing
         back in: `ph_nav_v2_example` uploaded and rendered in the Model viewer.
9. [x] Note any boot/secret gaps to fix before Phase 1. No new staging blocker
   surfaced; carry the known production Blueprint/R2/custom-domain items into
   Phase 1.
**Verify:** `https://ph-navigator-v2-staging.onrender.com` returns 200 and a
logged-in project view renders.
**Then:** re-suspend or leave running until Phase 1; either way it's retired in Phase 4.

### Phase 1 — Stand up V1 Production (on onrender URLs first, no domain yet)
1. [x] **R2 prod bucket**: create `ph-navigator-prod` (private, ENAM). Add the
   90-day orphan lifecycle rule. Set browser CORS to include
   `https://www.ph-nav.com` (and temporarily the prod static's onrender URL for
   pre-cutover testing). Mint prod R2 credentials → Apple Passwords.
   - [x] Bucket created: `ph-navigator-prod`, ENAM, Standard storage,
         public `r2.dev` access disabled.
   - [x] Browser CORS set for `https://www.ph-nav.com`,
         `https://ph-nav.com`, and temporary
         `https://ph-navigator-web.onrender.com`; methods `PUT`, `GET`,
         `HEAD`; headers `*`; exposed `ETag`; max age `3600`.
   - [x] Lifecycle set to abort multipart uploads after 7 days and delete only
         objects under `projects/_orphaned/` after 90 days. The orphan key shape
         was corrected before applying the rule so production does not inherit
         the older dev bucket's broad `projects/` delete filter.
   - [x] R2 S3 API token minted with **Object Read & Write** scoped to
         `ph-navigator-prod`; Ed stored the one-time Access Key ID and Secret
         Access Key in Apple Passwords. Use
         `R2_ACCOUNT_ID=f9d264cceb6b9b13ad80ff784318975f` and
         `R2_ENDPOINT_URL=https://f9d264cceb6b9b13ad80ff784318975f.r2.cloudflarestorage.com`.
2. [x] **Prod blueprint draft**: author `render.prod.yaml` from `render.yaml`
   with:
   - DB `plan: free` → **paid Basic-256mb** + 1 GB disk, prod name + Ohio.
   - Web `plan: free` → **paid always-on** (match V0 `Standard` 1 CPU / 2 GB
     unless Phase 1 intentionally proves a smaller tier is enough), prod name +
     Ohio.
   - Env values retargeted (initially to the prod onrender hosts, then to the
     custom domains in Phase 2): `CORS_ORIGINS`, `VITE_API_BASE_URL`,
     `MCP_ISSUER_URL`, `MCP_RESOURCE_SERVER_URL`, `MCP_ALLOWED_HOSTS`,
     `MCP_ALLOWED_ORIGINS`, `ENVIRONMENT=production`, `R2_BUCKET=ph-navigator-prod`,
     and the admin-user-management Phase 01 cookie/CSRF decision. Phase 1
     Render-host smoke uses `SESSION_COOKIE_SAMESITE=none`; Phase 2 custom
     domains retarget to `lax` if verified, otherwise `none` remains paired
     with CSRF middleware. `SESSION_COOKIE_SECURE` is derived true by the
     backend when `ENVIRONMENT=production`.
   - Phase 1: `FRONTEND_BASE_URL=https://ph-navigator-web.onrender.com`
     (base for invite/reset links; never the request Host). Phase 2 retargets
     this to `https://www.ph-nav.com` during DNS cutover.
   - Secrets (`R2_*`, `FERNET_SECRET_KEY`, `ACCOUNT_TOKEN_SECRET`)
     `sync: false`. `ACCOUNT_TOKEN_SECRET` keys the
     invite/reset token hashes (admin-user-management); without it a DB-only
     reader could forge tokens from stolen hashes.
     `MAPTILER_API_KEY` is intentionally omitted; PHN falls back to Census
     geocoding without it.
   - Draft complete in `render.prod.yaml` and validated with Render CLI
     (`valid:true`).
3. [x] **Apply** the blueprint → new prod services build; Alembic runs on start.
   In Render Dashboard use `New` → `Blueprint`, select
   `bldgtyp/ph-navigator-v2`, branch `main`, and set **Blueprint Path** to
   `render.prod.yaml`.
   Enter the Apple Passwords-backed production secret values when Render prompts for
   `sync:false` env vars, including `R2_ACCOUNT_ID`, `R2_ENDPOINT_URL`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `FERNET_SECRET_KEY`,
   and `ACCOUNT_TOKEN_SECRET`.
   Created `ph-navigator-db`, `ph-navigator-api`, and `ph-navigator-web` on
   commit `7aa208f`; API and static deploys reached `live`; API health/ready and
   static root returned 200.
4. [x] **Sync Phase 1 URL env**: apply the `render.prod.yaml` correction that
   keeps pre-cutover production on `https://ph-navigator-web.onrender.com` and
   `https://ph-navigator-api.onrender.com` for `FRONTEND_BASE_URL`,
   `VITE_API_BASE_URL`, CORS, and MCP URL/host/origin env. Do this before
   generating invite/reset links or browser-smoke testing the production static
   site.
   Synced on commit `41c522bc`: API deploy `dep-d909ujn7f7vs73cgf79g` and web
   deploy `dep-d909ujn7f7vs73cgf7b0` are live; the static bundle contains
   `https://ph-navigator-api.onrender.com`; health/ready/static root return 200.
5. [x] **Bootstrap first production admin**: use the audited Admin User Management
   bootstrap path to create/repair Ed's initial admin and issue an invite/reset
   link. Then invite John and any test account through `/admin/users`. Do **not**
   use the local/staging seed convention `ed@example.com` / `password` or
   `codex@example.com` / `password` on the prod DB, and do not manually seed
   reusable production passwords as the normal account lifecycle.
   - [x] Bootstrap job `job-d90a1bjtqb8s73fjsrm0` succeeded.
   - [x] Ed account DB verification: active, password set, and
         `admin.users.manage` present.
   - [x] Browser sign-in as Ed and `/admin/users` admin smoke complete.
   - [x] Disposable production test-user lifecycle complete; final state is
         inactive/non-admin.
6. **Seed reference data**: seed/license the climate reference bundles into R2 +
   DB (on-demand, per ENVIRONMENT.md).
7. **Smoke** on the prod onrender URLs: health/ready, login, project CRUD,
   asset upload/download via signed URL, model viewer, MCP token issue.
**Verify:** prod API `/api/v1/ready` green against the **paid** DB; bootstrap,
invite, admin reset-link, deactivate/reactivate, admin-grant, audit, and full
logged-in flows work on the onrender URLs.

### Phase 2 — Domain cutover (the only user-visible moment)
Pre-stage (no disruption — `www` still serves V0 throughout):
1. **V0 → v0**: add custom domain `v0.ph-nav.com` to V0's `ph-navigator` static
   service; create the matching CNAME at DreamHost → V0 static's Render target.
   Add `https://v0.ph-nav.com` to V0 backend `CORS_ORIGINS` (and `cors.json`
   for GCS if browser uploads are used); redeploy V0 backend. Confirm V0 loads
   at `v0.ph-nav.com`.
   - [x] Render custom domain added to V0 static service
         `srv-cv6sj8t2ng1s7380ljpg`; DNS/TLS verified.
   - [x] DreamHost CNAME: host `v0` → `ph-dash-frontend.onrender.com`.
   - [x] V0 backend CORS redeploy includes `https://v0.ph-nav.com`
         (`dep-d90h51gk1i2s73fm4li0` live from commit `01e72fe`).
   - [x] `https://v0.ph-nav.com` loads V0.
2. **V1 API domain**: add `api.ph-nav.com` to the V1 prod API web service;
   create the CNAME at DreamHost → the V1 API Render target; wait for Render TLS.
   - [x] Render custom domain added to V1 API service
         `srv-d909p1b7uimc7396t580`; DNS/TLS verified.
   - [x] DreamHost CNAME: host `api` → `ph-navigator-api.onrender.com`.
   - [x] Render verifies DNS and issues the `api.ph-nav.com` certificate.
   - [x] `https://api.ph-nav.com/api/v1/health` and `/ready` return 200.
3. Repoint V1 env to final hosts: `VITE_API_BASE_URL=https://api.ph-nav.com`,
   `CORS_ORIGINS=https://www.ph-nav.com` (+ apex if not redirected), MCP URLs →
   `https://api.ph-nav.com`; rebuild V1 static + redeploy V1 API. Keep R2 CORS
   allowing the temporary Render frontend until the custom-domain browser upload
   smoke passes, then drop the temporary onrender origin.
   - [x] Patch/validate/sync `render.prod.yaml` Phase 2 URL values and
         `SESSION_COOKIE_SAMESITE=lax` after `api.ph-nav.com` resolves.
         Commit `fa40334c`; API deploy `dep-d90h9go0697c73cossf0` and web
         deploy `dep-d90h9go0697c73cosscg` are live from Blueprint sync.
   - [x] Verify the static bundle references `https://api.ph-nav.com`.
         `https://www.ph-nav.com` serves `/assets/index-DTLHwExq.js`, which
         references `https://api.ph-nav.com` and not the old Render API URL.
   - [x] Run health/ready and error-log checks after redeploy.
         `GET https://api.ph-nav.com/api/v1/health` and `/ready` returned 200
         (`db:true`). Recent API logs showed only the expected signed-out
         `401 not_authenticated` from opening `/admin/users` before Ed signed
         in on `www`.
   - [x] Drop temporary R2 CORS origin
         `https://ph-navigator-web.onrender.com` after the `www` browser upload
         smoke passes.
         Completed 2026-06-28 after production browser upload smoke on
         `https://www.ph-nav.com`: Cloudflare R2 CORS now allows only
         `https://www.ph-nav.com` and `https://ph-nav.com` for `PUT`, `GET`,
         and `HEAD`, preserving `headers=["*"]`, `exposeHeaders=["ETag"]`, and
         `maxAgeSeconds=3600`.

Cutover (brief window):
4. In Render, **remove** `www.ph-nav.com` + apex `ph-nav.com` from V0's static
   service; **add** both to the V1 prod static service.
   - [x] V0 static `srv-cv6sj8t2ng1s7380ljpg` now retains only
         `v0.ph-nav.com`.
   - [x] V1 static `srv-d909olr7uimc7396slr0` now owns `www.ph-nav.com` and
         apex `ph-nav.com`; Render verified DNS and issued both certificates.
5. At DreamHost: point `www` CNAME → V1 static's Render target and apex `@`
   ALIAS → the same V1 static target. Render re-issues the apex→www redirect
   for the V1 service.
   - [x] DreamHost custom records now include CNAME `www` ->
         `ph-navigator-web.onrender.com` and ALIAS `@` ->
         `ph-navigator-web.onrender.com`; `api` and `v0` remain pointed at their
         existing Render targets.
6. Wait for DNS propagation + Render TLS issuance on the V1 service.
   - [x] All three DreamHost authoritative nameservers answer
         `www.ph-nav.com CNAME ph-navigator-web.onrender.com`; Render shows
         `Verified` / `Certificate Issued` for both `www` and apex.
**Verify:** `https://www.ph-nav.com` and `https://ph-nav.com` serve V1 with a
valid cert; login + a project flow work end-to-end; `https://v0.ph-nav.com`
still serves V0.
   - [x] Network/domain checks: `https://www.ph-nav.com` returns 200,
         `https://ph-nav.com` returns 301 to `www`, `https://v0.ph-nav.com`
         returns 200, trusted CORS from `https://www.ph-nav.com` to
         `https://api.ph-nav.com` is accepted, and `https://evil.test` is
         rejected.
   - [x] Public API CSRF guard negatives against `api.ph-nav.com`:
         `csrf_header_missing`, `origin_not_allowed`, and trusted-origin
         header/no-cookie -> `not_authenticated`.
   - [x] Browser login + `/admin/users` smoke on `www.ph-nav.com` after Ed
         signed in on the new domain.
**Rollback:** re-add `www`/apex to V0's static + revert the `www` CNAME — V0 is
back at root within a propagation cycle.

### Phase 3 — GitHub repo rename/reorg
Run after the production URL cutover is verified, so domain/infra issues and
GitHub rename issues are isolated.

**Status (2026-06-28):** Complete. GitHub repo renames, repo descriptions,
local `origin` remotes, Render service repo URLs, V1 no-op deploys, V0
backend/static redeploys, and public URL checks are verified. Local folder
renames are deferred until this active Codex workspace can be moved safely; that
is not a production gate.

1. [x] Freeze deploys briefly; make sure both repos have clean `main` branches and
   no unpushed release-critical commits.
2. [x] Rename the legacy GitHub repo:
   `bldgtyp/ph-navigator` → `bldgtyp/ph-navigator_v0`.
3. [x] Rename the new GitHub repo:
   current new-app repo (`bldgtyp/ph-navigator-v2`, or whatever exact remote is
   active at that point) → `bldgtyp/ph-navigator`.
4. [ ] Update local clone folder names when convenient:
   `../ph-navigator` → `../ph-navigator_v0`; this checkout
   `../ph-navigator-v2` → `../ph-navigator`.
5. [x] Check Render's GitHub connections for both stacks. If webhook/repo redirects
   did not update cleanly, reconnect:
   - V0 services → `bldgtyp/ph-navigator_v0`
   - V1 services → `bldgtyp/ph-navigator`
6. [x] Update durable docs that still refer to "V2" as the product/repo name:
   `CLAUDE.md`, `AGENTS.md` if needed, `context/README.md`,
   `context/GLOSSARY.md`, and Render/environment docs.
7. [x] Trigger or observe one no-op deploy on V1 and one V0 backend/static redeploy
   from the renamed repos so webhook routing is verified.

**Verify:** GitHub URLs, local `origin` remotes, Render deploy links, and docs
all point at V0=`ph-navigator_v0` and V1=`ph-navigator`. `www.ph-nav.com`,
`api.ph-nav.com`, and `v0.ph-nav.com` still work after the rename.

**Rollback:** GitHub repo renames can be reversed, but do not rely on this as an
instant production rollback. If app availability breaks, first disable
auto-deploy/reconnect the affected Render service to the correct repo; use DNS
rollback only if the served app itself regressed.

### Phase 4 — Retire old staging + tidy
Run only after Phase 1 production smoke, Phase 2 DNS cutover, and Phase 3 repo
rename/reconnect verification are complete. Until then, the `*-staging` trio is
a useful fallback/debug surface; suspend rather than delete if cost needs to be
reduced earlier.

**Status (2026-06-28):** Complete. The old V1 staging DB and two staging
services were deleted; `ph-ep-runner` was not present in the active/preview
Render resource list; final production values are recorded in
`context/ENVIRONMENT.md` and `render.prod.yaml` is already committed.

1. [x] Delete the two `*-staging` services and the staging DB. As of 2026-06-28,
   staging is no longer free: `ph-navigator-v2-api-staging` is `starter` and
   `ph-navigator-v2-staging-db` is `basic_256mb`.
2. [x] Delete or verify absent the dead `ph-ep-runner` legacy service.
3. [x] Fold the final prod values into `context/ENVIRONMENT.md` (new "Render
   production" section) and commit `render.prod.yaml`.

### Phase 5 — V0 decommission (run ONLY on Ed's word; no date)
Checklist for later: snapshot/export V0 Postgres + GCS; export any AirTable
bases still in use; suspend V0 services; after a cooling-off, delete V0
services, the `ph_navigator` DB, and the `v0` DNS record. Keep a final DB dump
in cold storage.

## 7. Cost

V1 prod adds, on top of V0's existing spend:
- Paid Postgres: match V0's `Basic-256mb` + 1 GB disk (screenshot MTD charge:
  `$5.67`, rate shown as `$0.0083/hr` DB + `$0.0004/hr` disk).
- Always-on web: V0 currently uses `Standard`, `1 CPU`, `2 GB` (screenshot MTD
  service charge: `$22.49`). Use this for V1 if we want parity with the known
  working V0 production tier; start smaller only if Phase 1 smoke/performance
  checks are acceptable.
- Static site: **free**.
- R2: pennies at this scale.

**Expected V1 added cost:** roughly the V1 paid Postgres + the chosen always-on
web tier. If matching V0 exactly, expect a higher added cost than the earlier
Starter estimate, but with fewer production-sizing unknowns.

## 8. Risks & mitigations

- **Cutover cert/propagation gap** — brief `www` outage while Render issues the
  V1 cert. Mitigate: pre-stage everything; do the swap when convenient; rollback
  is one DNS/Render revert. Two users, low stakes.
- **Cookie/CORS/CSRF misconfig on split origin** — admin-user-management Phase 01
  chooses the production cookie/CSRF posture. Preferred: prove
  `SameSite=Lax` works for `www.ph-nav.com` -> `api.ph-nav.com`; otherwise keep
  `SameSite=None; Secure` only with explicit CSRF/origin protection. Validate
  login and unsafe admin mutations on the onrender URLs before domains are
  involved.
- **R2 CORS** — browser signed-URL PUT/GET fails if `www.ph-nav.com` isn't in
  the bucket CORS. Set it in Phase 1; verify an upload before cutover.
- **DreamHost apex** — no ALIAS/ANAME; keep apex on Render A-records (anycast)
  exactly as V0 does today; only the owning service changes.
- **GitHub rename/webhook drift** — Render deploy connections may need a manual
  reconnect after repository renames. Mitigate by renaming only after the
  domain cutover is already working, freezing deploys briefly, and verifying a
  no-op deploy from each renamed repo.
- **Data expectations** — if Ed actually needs existing projects in V1 at
  launch, decision §5.1 changes and a migration sub-project is required (not
  scoped here).

## 9. Change checklists (quick reference)

**V1 (this repo/new canonical repo):** `render.prod.yaml`; prod env values
(CORS/VITE/MCP/cookie); R2 prod bucket + CORS; prod secrets in Render; Admin
User Management MVP complete for invite/admin-reset-link/revoke/admin-grant/
audit; audited first admin bootstrap + invite John through the app; climate
seed; GitHub rename to `bldgtyp/ph-navigator`; local/docs cleanup of old `V2`
naming.

**V0 (`~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator` before rename):** add
`https://v0.ph-nav.com` to `backend/config.py` `CORS_ORIGINS` (and `cors.json`
if needed); redeploy. No frontend change required (backend onrender URL is
unchanged). Rename GitHub repo to `bldgtyp/ph-navigator_v0`. Optionally add a
"you're on V0" banner.

**DNS (DreamHost):** add `v0` CNAME → V0 static (`ph-dash-frontend.onrender.com`);
add `api` CNAME → V1 API (`ph-navigator-api.onrender.com`); flip `www` CNAME →
V1 static during cutover; keep apex A-records on Render anycast (rebind service).

**Render custom domains:** add `v0.ph-nav.com` to V0 static; add
`api.ph-nav.com` to V1 API; move `www.ph-nav.com`+apex from V0 static to V1 static.
