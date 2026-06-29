---
DATE: 2026-06-27
TIME: 16:34 EDT
STATUS: Complete / archived discovery
AUTHOR: Claude (for Ed May)
SCOPE: Detailed, verified discovery behind the new PH-Navigator V1 production rollout — Render account state, V0 hosting/domain, V1 deploy readiness, and the evidence for each.
RELATED:
  - ./PLAN.md
  - ./STATUS.md
  - context/PRODUCTION_DEPLOYMENT.md
  - context/ENVIRONMENT.md
  - render.prod.yaml
  - render.yaml
  - V0 repo: ~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator
---

# Discovery & Verification — PH-Navigator V1 Production Rollout

> Archived 2026-06-28. This file preserves the discovery evidence gathered
> before and during rollout. Current production facts live in
> `context/PRODUCTION_DEPLOYMENT.md`.

This is the durable record of how the setup was discovered and verified during
rollout. Everything below was initially verified on **2026-06-27** via the
Render dashboard (Ed's screenshots), live DNS/HTTP probes, and reads of both
repos. Where an earlier inference was wrong, the correction is called out.

> Public-repo note: V0's `backend/alembic.ini` contains a hard-coded **local
> dev** Postgres credential (localhost:5432). It is intentionally **not**
> reproduced here. Production secrets live only in Render + Apple Passwords.

---

## 1. Render account & workspace

- Workspace: **"Ed May's Workspace"**, plan **Hobby**, **1 member** (Ed only).
- A single Render **project** named **PH-Navigator** (URL
  `dashboard.render.com/project/prj-d0mcajhr0fns73bkq7gg`) holds everything,
  split into two environment groups: **Production** (legacy V0) and **Staging**
  (new V1, under old `v2` service names).
- Early screenshots suggested one leftover **ungrouped** service:
  `ph-ep-runner:latest` — Docker image, Ohio, **suspended by Ed ~2 years ago**.
  Phase 4 later verified no active/preview Render resource named
  `ph-ep-runner` was present.

### Free-Postgres policy (the "two databases" question)
Verified against Render docs (2026):
- **One *free* Postgres per workspace**; 1 GB; **expires 30 days** after
  creation; 14-day grace to upgrade, then deleted with its data.
- **Paid Postgres instances are unlimited.**
- ⇒ V0 (paid) + a new V1 paid DB coexist with **no conflict**. The fear that we
  "can't have two databases at once" is unfounded — it only ever applied to the
  *free* tier.
- Sources: render.com/docs/free · render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90 · render.com/docs/postgresql-refresh

---

## 2. V0 — live production (the "Production" env group)

### Services (display name → type, region, status)
| Service | Type | Region | Status | Canonical onrender host |
| --- | --- | --- | --- | --- |
| `ph-navigator-backend` | Python 3 web | **Ohio** | Deployed | `ph-dash-0cye.onrender.com` |
| `ph-navigator` | Static site | Global CDN | Deployed | `ph-dash-frontend.onrender.com` |
| `ph_navigator` | PostgreSQL 16 | **Ohio** | Available | (internal) |

**Naming reconciliation:** the repo READMEs call these `ph-dash-0cye` /
`ph-dash-frontend`. Those are the **original Render-assigned hostnames** (note
the random `-0cye` suffix). The services were later **renamed** (display names
`ph-navigator-backend` / `ph-navigator`), but Render keeps the original
hostname, which is why DNS still targets `ph-dash-frontend.onrender.com` and the
site serves fine. Same service, two names.

**DB is paid:** `ph_navigator` is 3 months old and "Available". A free DB
expires at 30 days, so it must be a **paid** instance → permanent, safe.

### Deployment mechanics
- **No `render.yaml` in the V0 repo** — V0 is configured manually in the Render
  dashboard. Auto-deploys from GitHub (`github.com/bldgtyp/ph-navigator`).
- Backend build `pip install -r requirements.txt`; start
  `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Frontend (react-scripts) build `npm install && npm run build`, publish `build/`.
- Stack: FastAPI + **SQLAlchemy 2.0 ORM** + Alembic; React 19 + MUI; npm.

### Auth (domain-relevant)
- **JWT in `localStorage`** (key `token`), `HS256`, 60-min expiry, username +
  password (just Ed + John). No OAuth, **no cookies** → no cookie-domain config.
- `localStorage` is **origin-bound**: moving V0 to `v0.ph-nav.com` simply means
  users re-login there; tokens don't and needn't transfer.

### Domain-sensitive code (what changes when V0 moves to v0.ph-nav.com)
- **CORS allow-list**: `backend/config.py` `CORS_ORIGINS` — currently includes
  `http://localhost:3000`, `https://ph-tools.github.io`,
  `https://bldgtyp.github.io`, `https://ph-dash-frontend.onrender.com`,
  `https://ph-dash-0cye.onrender.com`, `https://www.ph-nav.com`.
  → **Add `https://v0.ph-nav.com`**, redeploy. (Can drop `www` once V1 owns it.)
- **Frontend API base URL**: env `REACT_APP_API_URL`, with a hard-coded fallback
  in `frontend/src/data/constants.json`:
  `RENDER_API_BASE_URL = https://ph-dash-0cye.onrender.com/`. The V0 backend
  keeps its onrender URL, so **no frontend change is required**.
- **GCS browser CORS**: `backend/cors.json` lists allowed origins for Google
  Cloud Storage uploads — add `https://v0.ph-nav.com` if browser uploads are used.
- External integrations: **AirTable** (material + aperture bases, tokens
  Fernet-encrypted) and a **Google Cloud Storage** bucket (`GCP_BUCKET_NAME`).

---

## 3. V1 — deploy readiness at discovery time (later deleted)

The `*-staging` stack below existed at the start of rollout. Phase 4 later
deleted the staging DB, staging API, staging static site, and empty Staging
environment group after production was verified.

### Services (currently suspended by Ed, 2 days ago)
| Service | Type | Region | Status |
| --- | --- | --- | --- |
| `ph-navigator-v2-staging-db` | PostgreSQL 16 | Ohio | Suspended (free) |
| `ph-navigator-v2-api-staging` | Python 3 web | Ohio | Suspended (free) |
| `ph-navigator-v2-staging` | Static site | Global | Suspended (free) |

**Correction:** an earlier guess was "free DB expired." Not so — **Ed manually
suspended all three** 2 days ago. They resume cleanly.

### Blueprint (`render.yaml`, committed, staging-only)
- DB `ph-navigator-v2-staging-db`: **free**, Ohio, PG16; `DATABASE_URL`
  auto-wired to the API via `fromDatabase` (no copy/paste).
- API `ph-navigator-v2-api-staging`: **free**, Ohio, Python; health
  `/api/v1/health`; build `pip install uv && uv sync --frozen --no-dev`; start
  `export GIT_SHA=$RENDER_GIT_COMMIT && uv run alembic upgrade head && uv run
  uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Static `ph-navigator-v2-staging`: Vite build to `dist`, SPA rewrite `/* →
  /index.html`.
- **Naming wrinkle to fix in prod:** `VITE_API_BASE_URL` and the MCP URLs point
  at `ph-navigator-v2.onrender.com`, but the API *service* is
  `ph-navigator-v2-api-staging`. Prod blueprint should target `api.ph-nav.com`
  consistently and should not carry the `v2` product name into final prod
  resources.

### Stack & config (this repo)
- FastAPI (Python 3.11, **uv**), **raw psycopg pool, no ORM in app code**;
  Alembic for migrations; uvicorn (no gunicorn). Entry `backend/main.py`.
- Settings: Pydantic `BaseSettings` in `backend/config.py` — all prod-relevant
  knobs are fields/env vars (no hard-coded URLs): `database_url` (+ pool sizes),
  `cors_origins`, R2 (`r2_account_id/access_key_id/secret_access_key/bucket/
  endpoint_url`), `fernet_secret_key`, session cookie (`name/samesite/secure/
  lifetime`), Argon2 params, MCP issuer/resource URLs + allowlists, `maptiler_api_key`.
- Auth differs from V0: **session cookie** (`phn_session`) + **Argon2**
  passwords (not JWT/localStorage).
- Object store: **MinIO** locally → **Cloudflare R2** in prod (boto3,
  signed-URL-only, private bucket). Prod bucket to create:
  `ph-navigator-prod`. Browser R2 CORS must list the prod web origin.
- Frontend: Vite + React 19 + TS + plain CSS; pnpm; `VITE_API_BASE_URL` is the
  only client-exposed knob; SPA served as a static site.
- CI: `.github/workflows/ci.yml` (lint/type/migrate/test/build); **no deploy
  step** — Render Blueprint apply is manual.
- Health endpoints: `/api/v1/health`, `/api/v1/ready` (DB + pool, used by Render
  health check), `/api/v1/version`.

---

## 4. Domain & DNS (live probes)

Nameservers: **DreamHost** (`ns1/2/3.dreamhost.com`) — DNS edits happen there.

| Record | Value | Meaning |
| --- | --- | --- |
| `ph-nav.com` (apex) A | `216.24.57.8`, `216.24.57.9` | Render anycast; 301→`www` |
| `www.ph-nav.com` CNAME | `ph-dash-frontend.onrender.com` → `gcp-us-west1-1.origin.onrender.com` → cloudflare | V0 static site |
| `api.ph-nav.com` | — | does not exist yet |
| `v0.ph-nav.com` | — | does not exist yet |

HTTP probes:
- `https://www.ph-nav.com` → **200** (V0). `https://ph-nav.com` → 200, redirects
  to `www`.
- `https://ph-dash-0cye.onrender.com/api/` → 404 (route-level; backend is up).
- `https://ph-navigator-v2-staging.onrender.com` and
  `https://ph-navigator-v2.onrender.com` → **503** (because Ed suspended them).
- All fronted by **Render's built-in Cloudflare** (`server: cloudflare`).

**Region note / correction:** the `gcp-us-west1-1` seen in the `www` CNAME is
only the **static-site CDN origin**. V0's backend + Postgres are in **Ohio**
(dashboard), same region as V1. Earlier "legacy app is us-west/Oregon" was wrong.

DreamHost has no clean apex ALIAS/ANAME, which is why the apex uses A-records to
Render's anycast today — keep that pattern through the cutover; only the owning
Render service changes.

---

## 5. Net conclusions feeding the plan

1. Two paid Postgres can coexist on Hobby → V1 gets its own paid DB. ✅
2. V0 and V1 are architecturally independent (different schema, auth, object
   store) → **no shared DB/storage; no auto-migration**. Fresh-start V1. ✅
3. The cutover is small: move `www`+apex from V0 static → V1 static, add
   `api.ph-nav.com` (V1 web) + `v0.ph-nav.com` (V0 static), edit DNS at
   DreamHost, add one CORS origin to V0, set V1 prod env values.
4. Everything is Ohio; V1 config is fully externalized (no hard-coded URLs), so
   prod is a blueprint + env-value exercise, not a code rewrite.
5. Cost is the only real commitment: a paid V1 DB + always-on web (~$13–26/mo).

See **PLAN.md** for the phased execution and **STATUS.md** for live state.
