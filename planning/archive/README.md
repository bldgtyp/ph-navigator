# Archive Index - Completed Planning Packets

Append-only audit trail. Durable decisions live in `context/`; this records
how and when each feature packet landed. Newest first. Grep by slug.

## 2026-06-29

- `equipment-draft-etag-coordination` - stale Equipment sibling `draft_etag` regression fixed by resolving a fresh target table slice before write payload construction while preserving lazy sibling invalidation; focused Vitest, Playwright browser flow, and request-count no-fan-out guard passed. (branch closeout)
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
