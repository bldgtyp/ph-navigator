# Archive Index - Completed Planning Packets

Append-only audit trail. Durable decisions live in `context/`; this records
how and when each feature packet landed. Newest first. Grep by slug.

## 2026-07-02

- `aperture-builder-workflow` - Aperture Builder workflow closeout: Eyedropper source picks now arm paste mode directly with Paint bucket toolbar feedback, persisted `flipLeftRight` mirrors columns, element spans, side frame assignments, and operation directions while preserving row spans/head/sill assignments, backend/frontend focused tests passed, `make format`, `graphify update .`, `make ci`, and local Playwright browser smoke passed.
- `aperture-frame-compatibility-rules` - Apertures frame compatibility rules: side-filtered frame pickers include `Mull-H` for head/sill and `Mull-V` for jamb sides while preserving `Any`; operation filtering excludes `Fixed` rows for slider elements; stationary-panel exceptions deferred until segment-role metadata exists. Focused Vitest, live builder smoke with `AGENT-BROWSER`, and `make frontend-dev-check` passed.
- `apertures-page-layout-polish` - Apertures builder layout polish: viewport-bounded two-column workbench, scroll-bounded `Aperture Types` sidebar, symmetric centered collapsed rail controls, shared autocomplete dropdown flip placement plus local operation-menu placement, `make frontend-dev-check`, and live Playwright smoke at 1440x900 with 24 aperture types.
- `data-table-visual-overflow-polish` - shared DataTable polish for dense linked-record cells, sticky headers, and fixed chrome clipping: default header token is opaque, scroll root is the clipping/stacking boundary, linked-record cells use non-shrinking pills in a horizontal scroll lane with measured `...` cue, focused linked-record tests pass, `make frontend-dev-check` passes, and headless browser smoke verified Catalogs / Frame Types plus Spaces / Space-Types.
- `apertures-frames-grouping` - Frames report grouping polish: report rows default-group by durable `manufacturer`, can regroup by durable `brand`, and can return to an ungrouped view from a compact report-toolbar control while preserving existing status sections, datasheet expansion, and use-site review behavior. Focused RTL coverage and `make frontend-dev-check` passed; populated-route smoke awaits local seed rows.
- `model-viewer-construction-detail` - read-only "View Construction" assembly detail modal in the Model tab's Opaque Surface inspector, drawing the selected face's HBJSON construction: deduplicated top-level `constructions` map on the `/model_data` artifact (recursive honeybee-ph material schema — ph_color, division cells, steel-stud spacing — parsed once per unique construction, faces keep a thin summary; artifact got ~8% smaller), pure layer-geometry adapter (flat = degenerate single cell), stat-tile header + to-scale SVG section with hover↔row linking + expandable layer schedule with segment sub-rows and Σ-layers reconciliation, and inspector wiring with selection-preserving Escape. Fully isolated from the Envelope feature (D-8, view-only); windows deferred. All 11 acceptance criteria pass; e2e + 12 RTL + backend suites + `make ci` green. Implemented on `feature/model-viewer-construction-detail`; merge + D-9 deploy DB reset (prod still empty) = Ed's call.

## 2026-07-01

- `model-viewer-sun-study` - "Sun study" mode for the Site & Sun lens: date-of-year + time-of-day scrubbers drive a sun marker along the existing sunpath dome and re-aim the scene's key light to cast real-time self+ground shadows. Six phases: ground-shadow baseline fix (D-12, folds in `model-viewer-ground-shadows`), BatchedMesh×shadow-map spike (GO), backend `sun_positions` grid (365×24 unit vectors + sunrise/sunset on `/sun-path`), scene (amber marker, sun key light with bounds-fitted shadow camera, `ShadowMaterial` catcher, horizon ramp, section→shadows-off), pill→full sun bar UI (date/month rail, 4 preset chips, daylight-band time scrubber, Esc/lens exit), and e2e+perf-gate closeout. Three as-built amendments (PCF not PCFSoft; section disables the sun shadow pass; `true_north_deg` on grid); Q-VIEW-6 un-deferred. `make ci` green.
- `model-viewer-ground-shadows` - Superseded: ContactShadows vertical-plane fix folded into `model-viewer-sun-study` as its phase-01 baseline (PRD D-12) and shipped there. Kept for the imported behavior contract.
- `model-viewer-mep-elements` - Ventilation/Hot Water MEP element selection and length reporting: backend duct/pipe length fields, element-level click/hover selection, Total Length inspector with segment table, row/3D focus sync, selected-element dimension overlays, segment-order resolution as stable display order only, screenshots, context docs-pass, and full viewer/CI closeout.
- `model-viewer-clipping-planes` - axis-aligned section plane for the Model Viewer: camera-cluster toggle, X/Y/Z controls, slider mapped to model bounds, global renderer clipping, clipped raycast filtering, debug-hook support, Vitest/Playwright coverage, and `make ci`. Capped/filled sections remain out of scope.
- `model-viewer-rendering-style` - cross-cutting 3D viewer rendering refactor: matched Spacio-style "solid study-model" look via soft key+fill lighting, N8AO, neutral near-white palette, dark opaque windows, flat unlit hover/selection highlight, and lightened edges; shipped as the new default (`DEFAULT_RENDER_SETTINGS`). Precedent research, perf baseline, and the licensed Hillandale-fixture leak fix included. (PR #26, `2c533d4b`)

## 2026-06-30

- `mcp-write-loop` - MCP runtime write-loop and docs hardening: draft save/discard, generic table replace + preview, save-as/version metadata/diff parity, canonical `context/mcp.md`, tool-inventory drift guard, smoke hardening, stale JSON-Patch contract reconciliation, graphify update, and `make ci`. (branch closeout)

## 2026-06-29

- `production-frontend-performance` - production frontend perf baseline + triage that drove the asset-cache and equipment fan-out fixes. Phase 02 public + Phase 04 authenticated read-only scorecards (10/10 routes healthy, 0 long tasks, loads ~0.24-0.32s), Phase 06 triage, Step-2 fan-out investigation. All findings shipped: `/assets/*` immutable cache headers (PR #20), equipment `table-views` + `draft-tables` fan-out collapsed 7→1 (PRs #21, #22); climate map LCP accepted as expected; Phase 05 write-path intentionally never run. (PR #20 + archive closeout)
- `batch-table-views-endpoint` - collapse the per-table view-state read fan-out into one batch request: backend `GET …/table-views?keys=…` → `BatchTableViewsResponse` (`repository.get_many` over `table_key = ANY`, editor-only, ≤64 keys, single-key routes untouched) + a frontend page-scoped batch context with a read-through in `useProjectTableViewState` (seed-or-wait when covered, per-table GET fallback otherwise; `prime`/`drop` keep the cache coherent). Equipment page wired (7 view-state reads → 1). `make ci` green (backend +8 tests, frontend +5 tests). Optional post-merge: empirical perf re-run (`equipment` 19 → ~13). (branch closeout)
- `envelope-save-ui-polish` - cross-feature UI polish refactor: shared Radix tooltip primitive, Save Version blocking overlay, Assembly canvas stroke gutter, Climate map tile-loading spinner, Apertures zero-type empty state, browser smoke evidence, `make format`, and `make ci`. (branch closeout)
- `equipment-draft-etag-coordination` - stale Equipment sibling `draft_etag` regression fixed by resolving a fresh target table slice before write payload construction while preserving lazy sibling invalidation; focused Vitest, Playwright browser flow, and request-count no-fan-out guard passed. (branch closeout)
- `production-climate-data-seeding` - production Climate enablement: full PHIUS 2022 and PHI 10.6 bundles published to private R2, Render Postgres seeded (`phius/2022` 1007 locations, `phi/10.6` 1002 locations), PHIUS/PHI/Hourly production workflows manually verified, and rerun evidence archived. (production closeout)
- `admin-user-management` - two-user production account lifecycle MVP: audited first-admin bootstrap, invite/admin-reset-link/deactivate/reactivate/admin grants, last-admin protection, CSRF/Origin guard, capability-gated UI, Admin-derived `catalog.edit`, audit, runbook, and production smoke evidence. (docs closeout)

## 2026-06-28

- `v2-production-rollout` - Render production rollout completed through Phase 4: current PH-Navigator live at `www.ph-nav.com` and `api.ph-nav.com`, legacy V0 retained at `v0.ph-nav.com`, GitHub repo canonicalized, production R2 upload smoke passed, old V1 staging services deleted, and stable deployment facts moved to `context/PRODUCTION_DEPLOYMENT.md`. (8038c57a + archive closeout)

## 2026-06-27

- `access-capability-model` - replace the binary `is_editor = (user is not None)` check with a capability model (principals → capability bundles → `require_capability` seam). Beta (Phases 1–4b) shipped: reserved tenancy/shares schema + resolver, anonymous/`client` export gating front and back, viewer metadata redaction, `catalog.edit` grant, viewer version-pin + Settings/export hiding, and the CP-5 read-only canvas-inspect modal. Phase 5 enforcement (roles, certifier shares, held DDL) extracted to `planning/features_v2.0/access-capability-enforcement/`, deferred to the RBC trigger. (07b6f8bd + docs closeout)
- `beta-schema-evolution` - project-document schema evolution lane with read-time forward-only upgrader, v1 golden corpus, audit CLI, built-in FieldDef drift guard, schema-bump checklist, recovery runbook, and closeout gate (`make ci`, fixture audit, local DB audit). (branch closeout)
- `datatable-status-backfill` - resolved deferred DataTable status-field backfill as unnecessary before first deploy; no users or old project documents exist, focused fresh-start verification passed, and no migration/backfill was written. (docs closeout)
- `report-tables` - shared dense read-mostly report-table primitive for Materials and aperture specification rollups; current code confirmed in `shared/ui/report-table`, `MaterialsPanel`, and `ApertureSpecReportPanel`. (docs reconciliation)

## 2026-06-25

- `table-write-architecture-unification` - collapse heat-pumps' parallel write path onto the generic registered-contract + shared write spine (BE) and generic table-write client (FE); shared backend write spine, shared option-list delete cascade, bespoke service/FE-client/PATCH-shim removed, `dependent_link_delete_blocked` rename. (f760c31e)
- `data-table-ui` - shared DataTable rendering polish: number precision/alignment, unit sublabels, status chips, tokenized table rhythm, and route-smoke verification. (closeout)

## 2026-06-24

- `backend-data-architecture-cleanup` - repository/module/schema cleanup, clean relational Alembic baseline, backend boundary lint, and pre-deploy hardening; Phase 4 promoted, Phase 7 deferred. (391da061)
- `apertures-glazings-frames-reports` - route-based Materials-parity glazing and frame specification reports, with datasheets, status, use-sites, drift, screenshots, and old refs modal retired. (closeout)
- `glazing-frame-documentation` - flat documented project glazing/frame entities with aperture FK migration, datasheet links, spec status, and builder hydration. (main closeout)
- `window-glass-catalog-enums` - glazing catalog manufacturer → single-select, server-derived name, import v2 (brand reverted to free text post-ship). (f5c4a89b)
- `archive-dated-reorg` - dated archive buckets and chronological archive index. (286e9486)
- `data-table-status-field` - per-row status enum and chip column. (618fc21f)
- `data-table-status-field-addendum` - status field follow-up addendum. (6aa8114c)
- `phpp-uvalue-export` - PHPP U-value export with accepted soft-cell handling. (07fcd1cb)

## 2026-06-23

- `envelope-hbjson-import` - envelope HBJSON import flow. (6ae40fd2)
- `model-viewer-legend-filter` - model viewer legend filtering. (c9c0ad48)
- `model-viewer-sun-path` - model viewer sun-path controls. (37460502)
- `window-frames-catalog-enums` - window frame catalog enum cleanup. (079328da)

## 2026-06-22

- `climate-auto-populate` - climate field auto-population. (4c20b118)
- `climate-dataset-picker` - climate dataset picker workflow. (08e68455)
- `climate-weather-file` - climate weather file import and selection. (3b6577f8)

## 2026-06-21

- `data-table-formula-builder` - DataTable formula builder. (13234215)
- `table-csv-download` - table CSV download behavior. (19d4e135)

## 2026-06-20

- `data-table-field-config-modal` - DataTable field configuration modal. (3aec44ac)

## 2026-06-19

- `data-table-maintenance` - shared DataTable maintenance pass. (8f4aac53)
- `data-table-regression-suite` - shared DataTable regression suite. (00deabb4)
- `model-viewer-performance` - model viewer performance improvements. (dbca4650)

## 2026-06-17

- `data-table-consolidation` - shared DataTable consolidation. (0d9759ab)
- `record-identity-model` - canonical record identity model. (337d3bcb)
- `spaces-refactor` - Spaces, Space-Types, and Rooms refactor. (d4c04ecc)

## 2026-06-16

- `heat-pump-link-fields` - heat-pump linked field behavior. (1ee3b398)

## 2026-06-15

- `attachments` - attachment workflows and document handling. (49cddd93)
- `climate-reference-data-seeding` - climate reference data seed pipeline. (b7911aa1)

## 2026-06-14

- `climate` - climate model and UI foundation. (07dfe631)
- `css-brand-dependency-resilience` - CSS brand dependency resilience. (66f61f4b)
- `css-rationalization` - CSS rationalization pass. (e9f23342)
- `css-structure-discoverability` - CSS structure discoverability pass. (197d6001)
- `css-token-guard-sweep` - CSS token guard sweep. (6b2a2598)

## 2026-06-13

- `equipment-custom-fields` - equipment custom fields. (4a109a4a)
- `model-viewer` - model viewer MVP. (f7691004)
- `project-location` - project location workflow. (e4aafa36)

## 2026-06-09

- `backend-hygiene-pass` - backend hygiene cleanup. (001b6868)
- `heat-pumps` - heat-pump equipment workflow. (e80b320f)
- `record-linking` - linked-record graph behavior. (a14fff3f)

## 2026-06-07

- `apertures-cleanup` - apertures cleanup pass. (315ab7fb)
- `assembly-builder-hardening` - assembly builder hardening pass. (c47deade)

## 2026-06-05

- `apertures` - apertures feature set. (f2dcbc9f)
- `assembly-builder-tools` - assembly builder tool controls. (6f1ad93b)
- `frame-types-catalog` - frame types catalog. (6f1ad93b)
- `glazing-types-catalog` - glazing types catalog. (6f1ad93b)

## 2026-06-04

- `assembly-builder` - assembly builder planning packet. (3718a2e8)
- `assembly-builder-foundation` - assembly builder foundation workflow. (9ebe90bd)
- `auth-session-perf` - auth session performance pass. (1db2d711)
- `catalog-perf` - catalog performance pass. (405b9e1c)
- `editable-fields` - editable field contracts. (e2c9d586)
- `row-context-menu` - row context menu behavior. (20778df4)

## 2026-06-03

- `color-field` - color field support. (3f9816bf)
- `data-table-unit-number-field` - unit-aware number field support. (94d6a2a6)
- `delete-project` - delete project workflow. (74e889bd)
- `ip-si-unit-switching` - IP/SI unit switching. (4a2beba9)
- `materials-catalog-datatable` - materials catalog DataTable surface. (804f8299)
- `materials-catalog-import-export` - materials catalog import/export. (6b15abf6)
