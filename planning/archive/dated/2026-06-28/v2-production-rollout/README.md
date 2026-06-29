---
DATE: 2026-06-27
TIME: 16:34 EDT
STATUS: Complete through Phase 4 / archived
AUTHOR: Claude (for Ed May)
SCOPE: Deploy the new PH-Navigator V1 to production on Render, promote it to www.ph-nav.com / apex, and relocate the legacy V0 app to v0.ph-nav.com — running both in parallel.
RELATED:
  - context/PRODUCTION_DEPLOYMENT.md (current production source of truth)
  - context/ENVIRONMENT.md (local/operator environment card)
  - render.prod.yaml (production blueprint)
  - render.yaml (dormant optional staging blueprint)
  - CLAUDE.md (current repo/status guide)
  - V0 repo: ~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator
---

# PH-Navigator V1 Production Rollout — Router

> Archived 2026-06-28: rollout Phases 0-4 are complete. Current operational
> facts live in `context/PRODUCTION_DEPLOYMENT.md`. Phase 5 V0 decommission is
> future-only and must run only on Ed's explicit instruction.

Goal: get a **real** production deployment of the new PH-Navigator V1 live at
the root domain (`www.ph-nav.com` + apex `ph-nav.com`), move the legacy V0 app
to `v0.ph-nav.com`, and run both side-by-side on Render for as long as Ed wants.

**Current gate:** Phase 0 staging/admin rehearsal, Phase 1 production services,
Phase 2 Render/DNS public-domain cutover, Phase 3 repo canonicalization, and
Phase 4 old-staging cleanup are complete. The production R2 bucket is
configured, production R2 credentials are stored in Apple Passwords, the paid
DB/API/static services exist, `api.ph-nav.com` serves the V1 API,
`www.ph-nav.com` serves the V1 static site, apex redirects to `www`, and
`v0.ph-nav.com` still serves V0. The real `www.ph-nav.com` ->
`api.ph-nav.com` `SameSite=Lax` browser smoke passed after Ed signed in as
`ed@example.com`; the production `www.ph-nav.com` model upload/R2 smoke also
passed, and the temporary `https://ph-navigator-web.onrender.com` R2 CORS origin
has been removed. The old V1 `*-staging` services and staging DB have been
deleted. Phase 5 V0 decommission is future-only and requires Ed's explicit word.

## Naming convention

- **V0 / legacy PH-Navigator** = the displaced legacy app, now at
  `v0.ph-nav.com` with repo `bldgtyp/ph-navigator_v0`.
- **V1 / current PH-Navigator** = the current app, now the canonical GitHub repo
  `bldgtyp/ph-navigator`; URLs `www.ph-nav.com`, apex `ph-nav.com`, and
  `api.ph-nav.com`. Some active local worktrees may still be folder-named
  `ph-navigator-v2` until the optional local folder rename is done.
- Use release/version numbers inside the new canonical repo from here forward;
  do not create a new repo for each future product version.
- Keep current/canonical names unversioned (`ph-navigator`, `www.ph-nav.com`,
  `api.ph-nav.com`, `~/.../ph-navigator`). Use numbered names only for
  deprecated generations (`ph-navigator_v0`, `v0.ph-nav.com`) or temporary
  replacement candidates (`ph-navigator-next`) that are explicitly retired or
  renamed at cutover.
- Treat `/api/v1` as an **API contract version**, not the product generation.
  Keep it until a breaking API contract requires parallel `/api/v2` support.

## Read order

1. **STATUS.md** — current state, settled decisions, execution surface, next step.
2. **PLAN.md** — the phased rollout (current state → target → Phases 0–5),
   cost, risks, and the per-system change checklists.
3. **research.md** — the detailed, verified discovery behind the plan (Render
   account, V0 hosting/domain internals, V1 readiness, live DNS/HTTP evidence)
   and the corrections to earlier inferences.

## One-paragraph situation

Everything lives in a single Render project (**PH-Navigator**, Hobby workspace,
Ohio). Current V1 production is the canonical `ph-navigator-web`,
`ph-navigator-api`, and `ph-navigator-db` stack, serving `www.ph-nav.com`,
apex `ph-nav.com`, and `api.ph-nav.com`. Legacy V0 remains live in parallel as
Render services `ph-navigator`, `ph-navigator-backend`, and `ph_navigator`,
repo `bldgtyp/ph-navigator_v0`, serving `v0.ph-nav.com`. The old V1 staging
stack used for rollout rehearsal has been deleted. There is no automatic V0→V1
data migration — V1 launches fresh; V0 stays reachable at `v0.ph-nav.com`.
