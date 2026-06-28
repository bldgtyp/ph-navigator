---
DATE: 2026-06-27
TIME: 16:34 EDT
STATUS: Active
AUTHOR: Claude (for Ed May)
SCOPE: Deploy the new PH-Navigator V1 to production on Render, promote it to www.ph-nav.com / apex, and relocate the legacy V0 app to v0.ph-nav.com — running both in parallel.
RELATED:
  - context/ENVIRONMENT.md (Render staging runbook, env vars, R2 CORS)
  - render.yaml (current staging blueprint — basis for the prod blueprint)
  - ../../../CLAUDE.md (status/naming note: repo still says V2 until rename phase)
  - V0 repo: ~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator
---

# PH-Navigator V1 Production Rollout — Router

Goal: get a **real** production deployment of the new PH-Navigator V1 live at
the root domain (`www.ph-nav.com` + apex `ph-nav.com`), move the legacy V0 app
to `v0.ph-nav.com`, and run both side-by-side on Render for as long as Ed wants.

**Current gate:** Phase 0 staging/admin rehearsal is complete and Phase 1
production services are live on Render URLs. The production R2 bucket is
configured, production R2 credentials are stored in Apple Passwords, and the
paid DB/API/static services exist. The next gate is one Blueprint sync that
keeps pre-cutover env on the prod Render URLs before the first production admin
bootstrap. Public DNS cutover and repo canonicalization remain later gates.

## Naming convention

- **V0 / legacy PH-Navigator** = the currently live app and repo presently named
  `ph-navigator`; target deprecated repo name `ph-navigator_v0`; target URL
  `v0.ph-nav.com`.
- **V1 / current PH-Navigator** = this new app, currently still checked out as
  `ph-navigator-v2`; target canonical repo name `ph-navigator`; target URLs
  `www.ph-nav.com`, apex `ph-nav.com`, and `api.ph-nav.com`.
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

Everything lives in a single Render project (**PH-Navigator**, Hobby
workspace, Ohio). Legacy V0 is the `Production` environment group (live, paid
Postgres). New V1 already exists as the `Production`-project's `Staging`
environment group under the old `v2` service names, but is **suspended by Ed**
(free DB + free web). The rollout turns the new app into its own real
production environment, performs a DNS + custom-domain cutover at DreamHost,
then performs the GitHub repo rename/reorg. There is no automatic V0→V1 data
migration — V1 launches fresh; V0 stays reachable at `v0.ph-nav.com`.
