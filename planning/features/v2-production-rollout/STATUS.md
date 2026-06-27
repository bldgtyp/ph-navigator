---
DATE: 2026-06-27
TIME: 16:34 EDT
STATUS: Active
AUTHOR: Claude (for Ed May)
SCOPE: Live status + open decisions for the new PH-Navigator V1 production rollout.
RELATED:
  - ./PLAN.md
  - ./README.md
---

# Status — PH-Navigator V1 Production Rollout

**State:** Discovery complete. Render account, V0 hosting, and the domain/DNS
setup are mapped and verified (2026-06-27). Phased PLAN drafted. Not yet
started executing.

## Decisions — settled (2026-06-27)

1. ✅ **Fresh data, no migration** — new V1 launches empty; existing projects
   stay on legacy V0 at `v0.ph-nav.com` and get recreated in V1 as we go.
2. ✅ **`api.ph-nav.com`** — V1 backend gets its own subdomain; prod blueprint
   targets it (and fixes the `VITE_API_BASE_URL`/MCP naming wrinkle).
3. ✅ **Budget** — approved to pay for V1's own paid Postgres + always-on web
   service (~$13–26/mo; exact figure pending V0 tier readout).
4. ✅ **V0 home** — `v0.ph-nav.com`.
5. ✅ **Repo names after cutover** — legacy repo becomes `ph-navigator_v0`; new
   repo takes over canonical `ph-navigator`; future product versions are normal
   releases inside that repo, not new repos.
6. ✅ **Future naming policy** — canonical URLs/repos/folders stay unversioned;
   only deprecated generations get numbered aliases. `/api/v1` remains the API
   contract version and is not tied to the product generation name.

## Two facts still to read from the dashboard (cost sizing, non-blocking)

- `ph_navigator` (V0 prod DB) instance tier + storage size.
- `ph-navigator-backend` (V0 web) plan tier.
  → Used only to right-size V1's paid DB/web in §7.

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
    CORS; enter prod secrets; add/move custom domains; edit DNS records; seed
    prod user + climate data.

## Next concrete step

Decisions are settled (above). Next: **Phase 0** — resume the suspended new-app
`*-staging` services and confirm a full logged-in flow works on the onrender URL
(proves the app boots before we pay for prod infra). In parallel, Claude can
draft `render.prod.yaml` so Phase 1 is a one-click apply.

Pending from Ed (non-blocking): V0 `ph_navigator` DB tier + `ph-navigator-backend`
plan, to pin exact monthly cost.

## Verification log

- 2026-06-27 — DNS: `www`→V0 static (200), apex→Render anycast→301 www;
  `api`/`v0` absent. Dashboard: 1 project, V0=Production (paid PG16, Ohio),
  new app=Staging (3 services suspended by Ed), Hobby workspace. Render free-Postgres
  cap = 1/workspace (paid unlimited) — confirms two DBs coexist.

## Notes / wrinkles to fix in prod blueprint

- Staging `render.yaml` points `VITE_API_BASE_URL`/MCP URLs at
  `ph-navigator-v2.onrender.com` while the API service is
  `ph-navigator-v2-api-staging` — make these consistent in `render.prod.yaml`
  (target `api.ph-nav.com`).
- Product/repo naming now differs from the local checkout name until the rename
  phase completes: legacy app = V0, new app = V1, current local folder still
  `ph-navigator-v2`.
