# Planning Status

DATE: 2026-06-30
TIME: 18:00 EDT
STATUS: Active routing index for tracked planning material.
AUTHOR: Codex
SCOPE: Current planning folder organization after moving dated docs to
feature-first planning.

## Active / Current Feature Folders

| Feature | State | Current pointer |
|---|---|---|
| Admin User Management MVP | Complete / archived after Phases 00-06 implemented and verified: first-admin bootstrap, invite/admin-reset-link/deactivate/reactivate/admin grants, last-admin protection, CSRF/Origin guard, capability-gated UI, Admin-derived `catalog.edit`, audit, runbook, and production smoke evidence | `archive/dated/2026-06-29/admin-user-management/STATUS.md` |
| Production Climate Data Seeding | Complete / production R2 PHIUS+PHI bundles published, Render Postgres seeded (`phi/10.6` 1002 locations, `phius/2022` 1007 locations), and PHIUS, PHI, and Hourly Climate workflows manually verified on production; archived | `archive/dated/2026-06-29/production-climate-data-seeding/STATUS.md` |
| Equipment Draft ETag Coordination | Complete / archived after P00-P03: stale Equipment sibling `draft_etag` writes now resolve a fresh target slice before payload construction; focused unit/controller coverage and browser request-count regression passed | `archive/dated/2026-06-29/equipment-draft-etag-coordination/STATUS.md` |
| V1 Production Rollout | Archived / complete through Phase 4: production live at `www.ph-nav.com` + `api.ph-nav.com`, V0 retained at `v0.ph-nav.com`, repo canonicalized, old staging deleted; stable deployment facts moved to `context/PRODUCTION_DEPLOYMENT.md` | `archive/dated/2026-06-28/v2-production-rollout/STATUS.md` |
| Beta Schema Evolution | Complete / archived after beta gate drill passed with fixture audit, local DB audit, and `make ci` | `archive/dated/2026-06-27/beta-schema-evolution/STATUS.md` |
| DataTable Status Field — Addendum | Complete — `status` extended to the 3 remaining Datasheet-bearing tables (Ventilators, HP Outdoor Units, HP Indoor Units); `make ci` green, live smoke done, committed `d8b59f28` (branch, not yet merged); archived | `archive/dated/2026-06-24/data-table-status-field-addendum/STATUS.md` |
| DataTable Status Field — Backfill | Complete / resolved-unneeded before first deploy: no users or old project documents exist, focused status-field fresh-start verification passed, no migration/backfill written | `archive/dated/2026-06-27/datatable-status-backfill/STATUS.md` |
| DataTable UI | Complete / numeric precision, unit headers, status chips, shared visual rhythm, route-smoke verification, final `make ci`, and archive cleanup landed | `archive/dated/2026-06-25/data-table-ui/STATUS.md` |
| Delete Project | In review | `features/delete-project/STATUS.md` |
| MCP Write Loop | Complete / archived after Phases 1–4: draft save/discard, generic `replace_table`, `preview_replace_table`, `save_draft_as`, version metadata patch, `diff_versions`, canonical MCP docs, drift guard, smoke hardening, stale contract reconciliation, graphify update, and `make ci` | `archive/dated/2026-06-30/mcp-write-loop/STATUS.md` |
| DataTable Color Field | Complete / implemented on main with CI and browser smoke evidence | `features/color-field/STATUS.md` |
| Attachments | Complete (v1) / implemented on main with automated coverage, R2 smoke, and full Render staging acceptance; Phase-5 polish deferred by decision; archived | `archive/dated/2026-06-15/attachments/STATUS.md` |
| IP/SI Unit Switching | Planned / implementation plan drafted | `features/ip-si-unit-switching/STATUS.md` |
| DataTable Formula Builder | Complete / Phases 01-06 implemented for shared formula editor UI, structured error cards, `&` concat grammar, autocomplete, all-table formula regression coverage, durable docs, and focused re-verification; archived | `archive/dated/2026-06-21/data-table-formula-builder/STATUS.md` |
| Apertures / Aperture Builder | Planned / PRD updated with review decisions; phase planning not started | `features/apertures/STATUS.md` |
| Aperture Frame Picker Filters | Planned / research, PRD, high-level plan, and detailed phase handoffs drafted; ready for implementation | `features/aperture-frame-picker-filters/STATUS.md` |
| Report Tables | Complete / shared read-mostly report-table primitive verified against current code; archived after source reconciliation | `archive/dated/2026-06-27/report-tables/STATUS.md` |
| Apertures → Glazings / Frames Reports | Complete / route-based Materials-parity glazings + frames spec reports with browser smoke, screenshots, context docs, CI, and archive evidence | `archive/dated/2026-06-24/apertures-glazings-frames-reports/STATUS.md` |
| CSS Token Guard Sweep | Complete / implemented on main worktree with format + CI evidence; archived | `archive/dated/2026-06-14/css-token-guard-sweep/STATUS.md` |
| Heat Pump Link Fields | Complete / implemented on main with format, CI, graphify update, browser smoke evidence; archived | `archive/dated/2026-06-16/heat-pump-link-fields/STATUS.md` |
| Spaces Refactor | Complete / Phase 05 verified with format, CI, browser smoke, graphify, simplify, and docs-pass evidence; archived | `archive/dated/2026-06-17/spaces-refactor/STATUS.md` |
| DataTable Consolidation | Complete / Phase 06 verified with format, CI, browser smoke, graphify, simplify, and docs-pass evidence; archived | `archive/dated/2026-06-17/data-table-consolidation/STATUS.md` |
| DataTable Maintenance | Complete / cleanup follow-up implemented and archived | `archive/dated/2026-06-19/data-table-maintenance/STATUS.md` |
| DataTable Regression Suite | Complete / all 7 phases implemented — layered e2e suite under `frontend/tests/e2e/table-regression/` (`@table-smoke` route matrix, `@table-behavior` cell behavior, `@table-links` linked-record flows, `@table-view-state` view-state persistence) over the React-free `sharedEditContract` seam; package scripts + run policy + CI decision recorded; not yet in default CI by decision; archived | `archive/dated/2026-06-19/data-table-regression-suite/STATUS.md` |
| DataTable Field Config Modal | Complete / shared Add/Edit field modal select, markup, static guards, browser smoke, format, CI, graphify evidence; archived | `archive/dated/2026-06-20/data-table-field-config-modal/STATUS.md` |
| Climate Dataset Picker | Complete / P1-P4 implemented and verified with focused backend/frontend tests plus `make ci`; O-DP-6 remains a documented non-blocking PHI region-filter follow-up; archived | `archive/dated/2026-06-22/climate-dataset-picker/STATUS.md` |
| Envelope HBJSON Import | Research / design outline drafted; key decisions made (both PHN-native + raw Honeybee-PH sources, project-only new materials, Phase-0 export upgrade); phase planning next | `features/envelope-hbjson-import/STATUS.md` |
| Glazing + Frame Documentation | Complete / Phases 0-5 implemented; flat `ProjectGlazing`/`ProjectFrame` tables, aperture FK migration/write path, docs commands, datasheet registry, frontend API hydration, docs-pass, graphify, and `make ci` verified; archived | `archive/dated/2026-06-24/glazing-frame-documentation/STATUS.md` |

## Active / Current Refactor Folders

| Refactor | State | Current pointer |
|---|---|---|
| Production Frontend Performance | Implemented locally through Phase 03 setup path / Production harness guards added; guarded `codex@testing.com` / `PERF-STRESS` fixture command added for 250-row Climate/Envelope/Apertures fixture with Model excluded; next live action is choosing the runtime password and running fixture setup in the production API environment; authenticated perf run still held | `refactor/production-frontend-performance/STATUS.md` |
| Backend Data-Architecture Cleanup | Complete / Phases 1–3, 5, and 6 implemented and verified with `make ci`; old Phase 4 promoted to `table-write-architecture-unification`; Phase 7 deferred to pre-first-deploy gate; archived | `archive/dated/2026-06-24/backend-data-architecture-cleanup/STATUS.md` |
| Table-Write-Architecture Unification | Complete / all phases (1, 2, 3a, 3b inc 1–6) landed — heat-pumps fully unified onto the generic registered-contract + spine (BE) and generic table-write client (FE); bespoke write service, FE client, and PATCH shim all removed; shared option-list delete cascade + `dependent_link_delete_blocked` rename; `make ci` green (BE 1110, FE 1906), browser smoke as Ed passed; archived | `archive/dated/2026-06-25/table-write-architecture-unification/STATUS.md` |
| DataTable Status Field | Complete / Phases 01-05 implemented and verified with `make ci` (backend 1061, frontend 1887), live reset/reseed + browser smoke, graphify, simplify, and docs-pass evidence; durable contract folded into `context/technical-requirements/data-table.md`; archived | `archive/dated/2026-06-24/data-table-status-field/STATUS.md` |
| Frontend Performance Eval | Complete / Phases 0-4 implemented and measured; route/project-tab payloads split, DataTable edit invalidation narrowed, Model route shell split to 7.00 kB gzip, secondary runtime candidates rejected after corrected attribution; archived | `archive/dated/2026-06-25/frontend-perf/STATUS.md` |

## Deferred v2.0 Feature Folders

| Feature | State | Current pointer |
|---|---|---|
| Public Account Recovery / Email Delivery | Deferred / post-MVP; owns public forgot-password, transactional invite/reset emails, durable public reset/invite-resend rate limiting, and account notices after the Ed/John rollout | `features_v2.0/public-account-recovery/STATUS.md` |
| Account Security Hardening | Deferred / post-MVP; owns fresh admin re-auth, MFA/passkeys, session/device inventory, suspicious activity alerts, automated token cleanup, and audit export | `features_v2.0/account-security-hardening/STATUS.md` |

## Historical Material

- Legacy dated planning files now live under `archive/dated/<date>/...`.
- Dated code reviews now live under `code-reviews/<date>/...`.
- Feature-specific dated bundles now live under `features/<feature>/...`.
- Completed Admin User Management MVP planning now lives under
  `archive/dated/2026-06-29/admin-user-management/` (two-user production
  account lifecycle, CSRF/Origin guard, `admin.users.manage` Admin preset,
  Admin-derived `catalog.edit`, audit, runbook, and production smoke evidence).
- Completed Production Climate Data Seeding planning now lives under
  `archive/dated/2026-06-29/production-climate-data-seeding/` (production R2
  PHIUS/PHI bundles, Render Postgres climate dataset seed, SQL verification,
  manual production PHIUS/PHI/Hourly Climate smoke, and runbook evidence).
- Completed MCP Write Loop planning now lives under
  `archive/dated/2026-06-30/mcp-write-loop/` (MCP draft save/discard,
  generic table replace + preview, save-as/version metadata/diff parity,
  canonical MCP docs, tool-inventory drift guard, smoke hardening, and stale
  contract reconciliation).
- Completed Apertures, Envelope, Climate + Tooltip UI Polish refactor planning
  now lives under `archive/dated/2026-06-29/envelope-save-ui-polish/` (shared
  Radix tooltip primitive, Save Version blocking overlay, Assembly canvas
  stroke gutter, Climate map tile-loading spinner, Apertures zero-type empty
  state, browser smoke evidence, `make format`, and `make ci`).
- Completed Assembly Builder canvas-refactor planning now lives under
  `archive/dated/2026-06-04/assembly-builder/`; older foundation precedent remains
  under `archive/dated/2026-06-04/assembly-builder-foundation/`.
- Completed CSS Token Guard Sweep planning now lives under
  `archive/dated/2026-06-14/css-token-guard-sweep/`.
- Completed Heat Pump Link Fields planning now lives under
  `archive/dated/2026-06-16/heat-pump-link-fields/`.
- Completed Spaces Refactor planning now lives under
  `archive/dated/2026-06-17/spaces-refactor/`.
- Completed DataTable Consolidation planning now lives under
  `archive/dated/2026-06-17/data-table-consolidation/`.
- Completed DataTable Maintenance cleanup now lives under
  `archive/dated/2026-06-19/data-table-maintenance/`.
- Completed DataTable Regression Suite planning now lives under
  `archive/dated/2026-06-19/data-table-regression-suite/`.
- Completed DataTable Field Config Modal refactor planning now lives under
  `archive/dated/2026-06-20/data-table-field-config-modal/`.
- Completed Climate Dataset Picker planning now lives under
  `archive/dated/2026-06-22/climate-dataset-picker/`.
- Completed DataTable Formula Builder planning now lives under
  `archive/dated/2026-06-21/data-table-formula-builder/`.
- Completed Glazing + Frame Documentation planning now lives under
  `archive/dated/2026-06-24/glazing-frame-documentation/`.
- Completed Report Tables planning now lives under
  `archive/dated/2026-06-27/report-tables/`.
- Completed DataTable Status Field Backfill planning now lives under
  `archive/dated/2026-06-27/datatable-status-backfill/` (resolved-unneeded before
  first deploy; no users or old project documents exist, so no historical
  migration/backfill was written).
- Completed Beta Schema Evolution planning now lives under
  `archive/dated/2026-06-27/beta-schema-evolution/` (read-time upgrader, golden
  corpus, audit CLI, FieldDef drift guard, schema-bump checklist, recovery
  runbook, fixture/local DB drills, and `make ci` closeout).
- Completed Attachments (v1) planning now lives under
  `archive/dated/2026-06-15/attachments/`. The stable implementation contract remains
  current in `context/technical-requirements/attachments.md`; the
  deferred v1.1 candidate stays in
  `planning/features_v1.1/user-defined-attachment-fields/`.
- Completed DataTable Status Field refactor planning now lives under
  `archive/dated/2026-06-24/data-table-status-field/`. The durable contract (built-in
  cross-table `status` single-select stored in `custom_values.status`, option
  list namespaced `<table_label>.status`) is folded into
  `context/technical-requirements/data-table.md` § Backend Data Shapes.
- Completed Model-Viewer rendering-performance refactor now lives under
  `archive/dated/2026-06-19/model-viewer-performance/` (Phases 00–05; Hillandale building
  lens 14 draw calls @ 60 FPS, was 32,045 @ 0.4). The reusable substrate
  convention is in `frontend/src/features/model_viewer/scene/{LensBatch,
  BatchedLens}`. Optional follow-ups (true cross-fade, line merging, the
  OQ-3 opaque-shell look review) are recorded in that folder's `STATUS.md`
  "Next step"; model-viewer feature backlog stays under
  `planning/features_v1.1/model-viewer-*`.
- Completed Frontend Performance Eval planning now lives under
  `archive/dated/2026-06-25/frontend-perf/` (Phases 0-4; perf harness, stress
  seed, route payload splits, DataTable edit invalidation narrowing, Model route
  shell split, and secondary-runtime attribution correction).
- Completed DataTable UI planning now lives under
  `archive/dated/2026-06-25/data-table-ui/` (numeric precision, unit headers,
  status chips, shared visual rhythm, and route-smoke verification).
- Completed Table-Write-Architecture Unification planning now lives under
  `archive/dated/2026-06-25/table-write-architecture-unification/` (shared backend
  write spine; heat-pumps folded onto the registered contract + generic table-write
  client on both stacks; bespoke service/FE-client/PATCH-shim removed; shared
  option-list delete cascade; `dependent_link_delete_blocked` rename).

## Update Rule

When a feature phase lands, update the feature `STATUS.md` first, then
fold durable decisions into `PRD.md`, `decisions.md`, or `context/`.
