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
  `planning/features/admin-user-management/`. Do not create the real paid V1
  production environment, move public domains, or canonicalize repos until that
  feature reaches the agreed production-ready threshold.
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
- **Public repo**: every secret stays `sync: false` in Render / 1Password,
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

## 2. Current state (verified 2026-06-27, Render dashboard + live DNS/HTTP)

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

Plus one dead legacy service `ph-ep-runner` (suspended ~2yr) — delete during cleanup.

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
   gate. Preferred production posture is proving `SameSite=Lax` works for
   `www.ph-nav.com` -> `api.ph-nav.com`; if `SameSite=None; Secure` remains,
   it must be paired with explicit CSRF/origin protection before admin
   mutations ship.
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

- [ ] Set prod env: `ACCOUNT_TOKEN_SECRET` and `FRONTEND_BASE_URL` (sync:false).
- [ ] Rehearse the full lifecycle on staging / prod-onrender URLs: bootstrap Ed
      (`scripts.bootstrap_admin --confirm-production`), invite a test user,
      complete the invite, generate + complete a reset link,
      deactivate/reactivate, grant/revoke Admin, and inspect audit rows.
- [ ] Confirm cookie/Origin/CSRF on the real split-origin shape
      (`www.ph-nav.com` → `api.ph-nav.com`): `SameSite=Lax` holds and unsafe
      `/api/v1/admin/` writes require a trusted Origin + `X-PHN-CSRF`.
- [ ] Browser smoke `/admin/users` (admin sees the nav + page; a normal user is
      blocked).

When every box is checked, mark the gate cleared in `STATUS.md` and archive the
admin-user-management packet. If the rehearsal surfaces real rework (e.g.
`SameSite=Lax` fails and split-origin auth needs redesign), spin that out as its
own feature rather than expanding this checklist.

Allowed before this gate clears: Phase 0 staging sanity checks, prod blueprint
drafting, and docs/runbook work. Not allowed: Phase 1 paid production apply,
production user creation, DNS cutover, or GitHub repo canonicalization.

### Phase 0 — Sanity check on free infra (cheap, optional but recommended)
**Why:** confirm the new app actually boots end-to-end (migrations, R2, auth, MCP)
before paying for prod infra.
1. Resume the three suspended `*-staging` services in Render.
2. Confirm `/api/v1/health` and `/api/v1/ready` go green; load the static site;
   sign in; exercise one project read/write; confirm an R2 signed-URL upload.
3. Note any boot/secret gaps to fix before Phase 1.
**Verify:** `https://ph-navigator-v2-staging.onrender.com` returns 200 and a
logged-in project view renders.
**Then:** re-suspend or leave running until Phase 1; either way it's retired in Phase 4.

### Phase 1 — Stand up V1 Production (on onrender URLs first, no domain yet)
1. **R2 prod bucket**: create `ph-navigator-prod` (private, ENAM). Add the
   90-day orphan lifecycle rule. Set browser CORS to include
   `https://www.ph-nav.com` (and temporarily the prod static's onrender URL for
   pre-cutover testing). Mint prod R2 credentials → 1Password.
2. **Prod blueprint**: author `render.prod.yaml` from `render.yaml` with:
   - DB `plan: free` → **paid Basic-256mb** + 1 GB disk, prod name + Ohio.
   - Web `plan: free` → **paid always-on** (match V0 `Standard` 1 CPU / 2 GB
     unless Phase 1 intentionally proves a smaller tier is enough), prod name +
     Ohio.
   - Env values retargeted (initially to the prod onrender hosts, then to the
     custom domains in Phase 2): `CORS_ORIGINS`, `VITE_API_BASE_URL`,
     `MCP_ISSUER_URL`, `MCP_RESOURCE_SERVER_URL`, `MCP_ALLOWED_HOSTS`,
     `MCP_ALLOWED_ORIGINS`, `ENVIRONMENT=production`, `R2_BUCKET=ph-navigator-prod`,
     `SESSION_COOKIE_SECURE=true`, and the admin-user-management Phase 01
     cookie/CSRF decision (`SESSION_COOKIE_SAMESITE=lax` if verified; otherwise
     `none` paired with CSRF middleware).
   - `FRONTEND_BASE_URL=https://www.ph-nav.com` (canonical base for invite/reset
     links; never the request Host).
   - Secrets (`R2_*`, `FERNET_SECRET_KEY`, `MAPTILER_API_KEY`,
     `ACCOUNT_TOKEN_SECRET`) `sync: false`. `ACCOUNT_TOKEN_SECRET` keys the
     invite/reset token hashes (admin-user-management); without it a DB-only
     reader could forge tokens from stolen hashes.
3. **Apply** the blueprint → new prod services build; Alembic runs on start.
4. **Bootstrap first production admin**: use the audited Admin User Management
   bootstrap path to create/repair Ed's initial admin and issue an invite/reset
   link. Then invite John and any test account through `/admin/users`. Do **not**
   use the local/staging seed convention `ed@example.com` / `password` or
   `codex@example.com` / `password` on the prod DB, and do not manually seed
   reusable production passwords as the normal account lifecycle.
5. **Seed reference data**: seed/license the climate reference bundles into R2 +
   DB (on-demand, per ENVIRONMENT.md).
6. **Smoke** on the prod onrender URLs: health/ready, login, project CRUD,
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
2. **V1 API domain**: add `api.ph-nav.com` to the V1 prod web service; create
   the CNAME at DreamHost → V1 web's Render target; wait for Render TLS.
3. Repoint V1 env to final hosts: `VITE_API_BASE_URL=https://api.ph-nav.com`,
   `CORS_ORIGINS=https://www.ph-nav.com` (+ apex if not redirected), MCP URLs →
   `https://api.ph-nav.com`; rebuild V1 static + redeploy V1 API. Update R2 CORS
   to drop the temporary onrender origin.

Cutover (brief window):
4. In Render, **remove** `www.ph-nav.com` + apex `ph-nav.com` from V0's static
   service; **add** both to the V1 prod static service.
5. At DreamHost: point `www` CNAME → V1 static's Render target; keep apex A
   records on Render's anycast (DreamHost has no clean apex ALIAS) — Render
   re-issues the apex→www redirect for the V1 service.
6. Wait for DNS propagation + Render TLS issuance on the V1 service.
**Verify:** `https://www.ph-nav.com` and `https://ph-nav.com` serve V1 with a
valid cert; login + a project flow work end-to-end; `https://v0.ph-nav.com`
still serves V0.
**Rollback:** re-add `www`/apex to V0's static + revert the `www` CNAME — V0 is
back at root within a propagation cycle.

### Phase 3 — GitHub repo rename/reorg
Run after the production URL cutover is verified, so domain/infra issues and
GitHub rename issues are isolated.

1. Freeze deploys briefly; make sure both repos have clean `main` branches and
   no unpushed release-critical commits.
2. Rename the legacy GitHub repo:
   `bldgtyp/ph-navigator` → `bldgtyp/ph-navigator_v0`.
3. Rename the new GitHub repo:
   current new-app repo (`bldgtyp/ph-navigator-v2`, or whatever exact remote is
   active at that point) → `bldgtyp/ph-navigator`.
4. Update local clone folder names when convenient:
   `../ph-navigator` → `../ph-navigator_v0`; this checkout
   `../ph-navigator-v2` → `../ph-navigator`.
5. Check Render's GitHub connections for both stacks. If webhook/repo redirects
   did not update cleanly, reconnect:
   - V0 services → `bldgtyp/ph-navigator_v0`
   - V1 services → `bldgtyp/ph-navigator`
6. Update durable docs that still refer to "V2" as the product/repo name:
   `CLAUDE.md`, `AGENTS.md` if needed, `context/README.md`,
   `context/GLOSSARY.md`, and Render/environment docs.
7. Trigger or observe one no-op deploy on V1 and one V0 backend/static redeploy
   from the renamed repos so webhook routing is verified.

**Verify:** GitHub URLs, local `origin` remotes, Render deploy links, and docs
all point at V0=`ph-navigator_v0` and V1=`ph-navigator`. `www.ph-nav.com`,
`api.ph-nav.com`, and `v0.ph-nav.com` still work after the rename.

**Rollback:** GitHub repo renames can be reversed, but do not rely on this as an
instant production rollback. If app availability breaks, first disable
auto-deploy/reconnect the affected Render service to the correct repo; use DNS
rollback only if the served app itself regressed.

### Phase 4 — Retire old staging + tidy
1. Delete the three `*-staging` services and the free staging DB (the
   workspace's free-Postgres slot frees up).
2. Delete the dead `ph-ep-runner` legacy service.
3. Fold the final prod values into `context/ENVIRONMENT.md` (new "Render
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

**DNS (DreamHost):** add `v0` CNAME → V0 static; add `api` CNAME → V1 web; flip
`www` CNAME → V1 static; keep apex A-records on Render anycast (rebind service).

**Render custom domains:** add `v0.ph-nav.com` to V0 static; add
`api.ph-nav.com` to V1 web; move `www.ph-nav.com`+apex from V0 static to V1 static.
