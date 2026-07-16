---
DATE: 2026-07-16
STATUS: CANONICAL PRODUCTION DEPLOYMENT RUNBOOK
RELATED:
  - context/ENVIRONMENT.md
  - context/DATA_STORAGE.md
  - context/DEVELOPMENT_WORKFLOW.md
  - render.prod.yaml
  - render.yaml
  - planning/archive/dated/2026-06-28/v2-production-rollout/STATUS.md
---

# PH-Navigator Production Deployment

This is the current source of truth for live PH-Navigator infrastructure after
the 2026-06 production rollout. Prefer this file over older planning notes when
working on Render, DNS, R2, auth/cookie settings, MCP URLs, or production deploy
workflow.

## Quick Reference

| Surface | Current value |
|---|---|
| Canonical app | `https://www.ph-nav.com` |
| Apex | `https://ph-nav.com` redirects to `https://www.ph-nav.com/` |
| API | `https://api.ph-nav.com` |
| Runtime MCP endpoint | `https://api.ph-nav.com/mcp` |
| Legacy V0 | `https://v0.ph-nav.com` |
| Current repo | `https://github.com/bldgtyp/ph-navigator` |
| Legacy V0 repo | `https://github.com/bldgtyp/ph-navigator_v0` |
| Production Blueprint | `render.prod.yaml` |
| Deploy trigger | "Deploy Production" GitHub Actions workflow (`.github/workflows/deploy.yml`) — auto-deploy is OFF |
| Optional staging Blueprint | `render.yaml` |
| Production object store | Cloudflare R2 bucket `ph-navigator-prod` |
| Local/dev object store | MinIO bucket `ph-navigator-v2-dev` |
| Optional staging object store | R2 bucket `ph-navigator-v2-dev` if staging is recreated |

`ph-navigator-v2` is now only a historical rewrite-generation name and may
remain in local folder names, dev database names, local bucket names, and older
planning docs. Current production product, repo, and service names are
unversioned.

## Active Render Stack

All live resources are in the Render project **PH-Navigator**. After old staging
cleanup on 2026-06-28, the project has only the **Production** environment
(`evm-d0mcajhr0fns73bkq7h0`) plus ungrouped Blueprint resources. There is no
active Render staging stack.

### Current PH-Navigator

| Resource | Render name | ID | Notes |
|---|---|---|---|
| Frontend static site | `ph-navigator-web` | `srv-d909olr7uimc7396slr0` | Static Render service, root `frontend`, public hosts `www.ph-nav.com`, `ph-nav.com`, and `ph-navigator-web.onrender.com`. |
| Backend API | `ph-navigator-api` | `srv-d909p1b7uimc7396t580` | Python web service, root `backend`, custom host `api.ph-nav.com`, Render host `ph-navigator-api.onrender.com`, plan `standard`, region Ohio. |
| Database | `ph-navigator-db` | `dpg-d909olr7uimc7396sls0-a` | Render PostgreSQL 16, database `ph_navigator`, region Ohio, plan `basic_256mb`, 1 GB disk. |

`ph-navigator-web` and `ph-navigator-api` track
`https://github.com/bldgtyp/ph-navigator` on branch `main` with **auto-deploy
off** (`autoDeployTrigger: "off"` in `render.prod.yaml` and in each service's
dashboard settings). A push or merge to `main` does NOT deploy; the "Deploy
Production" GitHub Actions workflow is the only deploy trigger. `main` must
still stay deployable — the next deploy always ships its latest commit.

### Legacy V0

V0 remains live by design. Do not delete or mutate it unless Ed explicitly asks
for V0 work.

| Resource | Render name | ID | Notes |
|---|---|---|---|
| V0 frontend | `ph-navigator` | `srv-cv6sj8t2ng1s7380ljpg` | Static site for `https://v0.ph-nav.com`; Render host `ph-dash-frontend.onrender.com`; repo `bldgtyp/ph-navigator_v0`. |
| V0 backend | `ph-navigator-backend` | `srv-cv6sgggfnakc738g81ag` | Python web service; Render host `ph-dash-0cye.onrender.com`; repo `bldgtyp/ph-navigator_v0`. |
| V0 database | `ph_navigator` | `dpg-d0mcb46mcj7s7396geo0-a` | Render PostgreSQL 16, plan `basic_256mb`. |

## Deleted Staging Stack

The temporary staging stack used for rollout rehearsal was deleted after
production was verified:

| Deleted resource | ID |
|---|---|
| `ph-navigator-v2-staging-db` | `dpg-d8o46uhkh4rs73ebvvgg-a` |
| `ph-navigator-v2-api-staging` | `srv-d81op9vlk1mc73b1kk50` |
| `ph-navigator-v2-staging` | `srv-d81oqhgg4nts738a4e50` |
| Empty Staging environment | `evm-d81om93eo5us73fkqpqg` |

`render.yaml` is retained only as a dormant Blueprint for a future rehearsal or
debug surface. If staging is recreated, expect to re-enter all `sync: false`
secrets and re-seed synthetic data. Do not assume the old staging URLs are live.

## DNS And Domains

DreamHost DNS points the public hostnames at Render:

| DNS name | Target |
|---|---|
| `www.ph-nav.com` | CNAME `ph-navigator-web.onrender.com` |
| `ph-nav.com` | ALIAS `ph-navigator-web.onrender.com` |
| `api.ph-nav.com` | CNAME `ph-navigator-api.onrender.com` |
| `v0.ph-nav.com` | CNAME `ph-dash-frontend.onrender.com` |

Render owns TLS/cert verification for the custom domains. The production app
expects browser traffic from `www.ph-nav.com` or `ph-nav.com` to call
`api.ph-nav.com`.

## Production Blueprint

`render.prod.yaml` is the committed production infrastructure contract. It
contains only non-secret values because this repo is public. Secrets and
account-identifying values stay `sync: false` and are entered in Render from
Apple Passwords:

- `R2_ACCOUNT_ID`
- `R2_ENDPOINT_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `FERNET_SECRET_KEY`
- `ACCOUNT_TOKEN_SECRET`

`DATABASE_URL` is wired from the `ph-navigator-db` database block with
`fromDatabase`; do not paste database credentials into the Blueprint or local
`.env` files.

Key production env values:

| Key | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `APP_VERSION` | `0.1.0` |
| `LOG_FORMAT` | `json` |
| `LOG_LEVEL` | `INFO` |
| `VITE_API_BASE_URL` | `https://api.ph-nav.com` |
| `CORS_ORIGINS` | `https://www.ph-nav.com,https://ph-nav.com` |
| `SESSION_COOKIE_NAME` | `phn_session` |
| `SESSION_COOKIE_SAMESITE` | `lax` |
| `FRONTEND_BASE_URL` | `https://www.ph-nav.com` |
| `MCP_ISSUER_URL` | `https://api.ph-nav.com` |
| `MCP_RESOURCE_SERVER_URL` | `https://api.ph-nav.com/mcp` |
| `MCP_ENABLE_DNS_REBINDING_PROTECTION` | `true` |
| `MCP_ALLOWED_HOSTS` | `api.ph-nav.com` |
| `MCP_ALLOWED_ORIGINS` | `https://www.ph-nav.com,https://ph-nav.com` |
| `R2_BUCKET` | `ph-navigator-prod` |

Project Location search needs no geocoder secret. Town/locality lookup uses the
bundled Census Gazetteer index and street-address lookup uses the keyless live
Census geocoder.

Backend start command:

```bash
export GIT_SHA="$RENDER_GIT_COMMIT" &&
uv run alembic upgrade head &&
uv run uvicorn main:app --host 0.0.0.0 --port $PORT
```

The service runs migrations on deploy before uvicorn starts. Do not add
data-seeding work to the normal start command.

## Auth, Cookies, CORS, And CSRF

Production uses the custom-domain split:

- Frontend: `https://www.ph-nav.com`
- API: `https://api.ph-nav.com`

Both are same-site under `ph-nav.com`, so the production session cookie uses
`SameSite=Lax` plus `Secure` (derived from `ENVIRONMENT=production`). The
temporary Phase 1 `onrender.com` smoke used `SameSite=None`; do not restore that
for normal custom-domain production.

Mutating `/api/` browser requests must include a trusted `Origin` from
`CORS_ORIGINS`. Unsafe `/api/v1/admin/` mutations also require the app-only
`X-PHN-CSRF` header. The frontend API client sends that header; cross-site
markup cannot set it without passing CORS preflight.

First-admin bootstrap is the only production operator account command:

```bash
cd backend
uv run python -m scripts.bootstrap_admin \
  --email ed@example.com \
  --display-name "Ed May" \
  --confirm-production
```

Run it from Render Shell / one-off job or another deliberate production
operator environment. It prints a one-time invite/reset link and never sets a
reusable password.

Local/staging seed scripts such as `seed_user` and `seed_dev_db` refuse
production. Do not bypass those guards.

## Object Storage

Production assets and climate bundles live in the private Cloudflare R2 bucket
`ph-navigator-prod`.

Production R2 settings:

- Region/storage class: ENAM / Standard.
- Public `r2.dev` access: disabled.
- Browser CORS: only `https://www.ph-nav.com` and `https://ph-nav.com` for
  `PUT`, `GET`, and `HEAD`.
- Temporary `https://ph-navigator-web.onrender.com` CORS origin was removed
  after the 2026-06-28 public-domain upload smoke.
- Multipart upload abort: 7 days.
- Orphan lifecycle: delete `projects/_orphaned/*` after 90 days.

Backend-controlled key patterns:

```text
projects/{project_id}/assets/{asset_id}/file.{ext}
projects/{project_id}/assets/{asset_id}/thumb.png
projects/_orphaned/{project_id}/{asset_id}/{filename}
climate/{provider}/{version}/dataset.json
derived/{...}
```

Use `ph-navigator-v2-dev` only for local MinIO and optional recreated staging.
Do not point local dev at `ph-navigator-prod` except for an explicit,
time-boxed production smoke with exported credentials.

Climate reference data is app-wide and idempotent per `(provider, version)`.
Publish bundles to the same bucket the target service reads, then seed via:

```bash
cd backend
uv run python -m features.climate.seeding --all
```

For production, run that command in the `ph-navigator-api` Render environment so
it uses the internal `DATABASE_URL` and production R2 env. For optional staging,
run it in the recreated `ph-navigator-v2-api-staging` environment.

## Runtime MCP

PH-Navigator exposes its own project-scoped MCP server at
`https://api.ph-nav.com/mcp`. It is not the same thing as Codex MCP connectors.
Runtime MCP clients use project-scoped bearer tokens issued from the app.

Production MCP settings are:

- issuer: `https://api.ph-nav.com`
- resource server: `https://api.ph-nav.com/mcp`
- DNS rebinding protection: enabled
- allowed host: `api.ph-nav.com`
- allowed origins: `https://www.ph-nav.com,https://ph-nav.com`

Repo-local `.mcp.json` currently defines only the Playwright MCP helper for
browser testing. There is no committed Render or Cloudflare MCP connector.
Render operations use the Render dashboard, Render CLI, or Render API with an
operator-held token.

## Deployment Workflow

Auto-deploy is off; the "Deploy Production" GitHub Actions workflow
(`.github/workflows/deploy.yml`) is the only production deploy trigger. It is
started by Ed — manual dispatch from `main`, or pushing a `v*` tag on the tip
of `main` — never by an agent.

Default workflow:

1. Branch from current `main`, usually `codex/<short-task>`.
2. Iterate locally and push the feature branch only when useful for review or
   backup.
3. Keep `main` deploy-ready. Do not push tiny WIP commits directly to `main`.
4. Aggregate coherent work into one reviewed merge/squash/fast-forward to
   `main`. Merging does not deploy.
5. When ready to ship (one merge or a bundle of them), trigger Deploy
   Production: `git tag v0.x.y && git push origin v0.x.y` from the tip of
   `main`, or GitHub → Actions → "Deploy Production" → Run workflow.
6. The workflow gates on the ref being the tip of `main` and on the required
   CI checks passing, fires both Render deploy hooks pinned to the exact
   commit (`&ref=<sha>`), then polls `/api/v1/version` until `git_sha` matches
   and smoke-checks the public surfaces. Watch it finish green; spot-check
   with the commands below.

The workflow needs two repo secrets, `RENDER_DEPLOY_HOOK_API` and
`RENDER_DEPLOY_HOOK_WEB` — the deploy-hook URLs from each service's Render
dashboard (Settings → Deploy Hook). Deploy-hook URLs let anyone who has them
trigger a deploy: store them in Apple Passwords alongside the other Render
secrets, set them with `gh secret set`, and never commit or print them. If a
service is rebuilt, its hook URL changes — update the secret.

For `render.prod.yaml` changes, validate before merge:

```bash
render blueprints validate ./render.prod.yaml -o json
```

For ordinary code/docs work, follow `context/DEVELOPMENT_WORKFLOW.md`. Emergency
hotfixes may go to `main` only when the production issue justifies an immediate
deploy; still run the narrowest meaningful check first and document the smoke
afterward.

## Verification Commands

Basic public checks:

```bash
curl -fsS https://api.ph-nav.com/api/v1/ready
curl -I https://www.ph-nav.com
curl -I https://ph-nav.com
curl -I https://v0.ph-nav.com
```

Expected:

- `https://api.ph-nav.com/api/v1/ready` returns `200` with `db:true`.
- `https://www.ph-nav.com` returns `200`.
- `https://ph-nav.com` redirects to `https://www.ph-nav.com/`.
- `https://v0.ph-nav.com` returns `200`.

CORS preflight spot check:

```bash
curl -i -X OPTIONS https://api.ph-nav.com/api/v1/admin/users \
  -H 'Origin: https://www.ph-nav.com' \
  -H 'Access-Control-Request-Method: GET'
```

Render CLI orientation:

```bash
render blueprints validate ./render.prod.yaml -o json
render services --include-previews
render environments prj-d0mcajhr0fns73bkq7gg
```

The Render CLI requires an operator login or token (`render login` /
`RENDER_API_KEY`). If that is unavailable, use the Render dashboard and do not
invent credentials.

## Do Not Do

- Do not delete V0 services or the V0 repo without Ed's explicit instruction.
- Do not recreate staging unless a future rehearsal/debug task requires it.
- Do not paste Render database URLs, R2 secrets, Fernet keys, account-token
  secrets, or one-time invite/reset links into this repo.
- Do not add production seeds to Render's normal start command.
- Do not use `ed@example.com` in local Playwright/Codex browser work unless Ed
  explicitly asks; local agent work uses `codex@example.com` to avoid the
  single-active-session collision.
