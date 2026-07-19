---
DATE: 2026-07-19
TIME: 21:39
STATUS: Complete / archived and squash-merged to main
AUTHOR: Ed May (with Claude)
SCOPE: Execution state for the site-photos feature
RELATED: README.md, PRD.md, research.md
---

# Documentation tab — STATUS

**State:** Complete — implementation, docs-pass, Graphify update, e2e, and
full `make ci` are complete. Archived 2026-07-19 and included in the final
squash merge to `main`. Visual contract:
`assets/wireframe.html` (v2.1, Ed-approved). US-ENV-15 amended in context docs
(absorbed + redirect).

## Phase progress

- ✅ **Phase 0** (`planning/archive/dated/2026-07-19/heat-pump-display-name/`) —
  implemented + verified 2026-07-18 on this branch (schema v5 migration,
  tag→name backfill, pinned Display Name column on all four HP leaves;
  evidence in that feature's STATUS.md). **Holding here per Ed** before
  starting Phase 1.
- ✅ **Phase 1** (`phases/phase-01-backend-schema-registry.md`) —
  implemented + verified 2026-07-18. Schema v6 adds `photo_asset_ids`
  and hidden waiver defaults across equipment, heat-pump leaves, aperture
  product rows, thermal bridges, project materials, and envelope segments;
  the asset registry now authorizes `site_photo` fields; shared `status`
  displays as `Specification Status`. Waiver fields remain typed backend
  fields, not DataTable FieldDefs, so they do not leak into table columns.
- ✅ **Phase 2** (`phases/phase-02-backend-heic-summary.md`) —
  implemented 2026-07-18. `site_photo` uploads now accept HEIC/HEIF and
  convert to JPEG during `complete-upload`; corrupt HEIC returns
  `asset_conversion_failed`. Saved/draft `documentation-summary` endpoints
  now expose backend-owned rollups for spec/datasheet/photo axes, envelope
  material-per-assembly groups, heat-pump leaf groups, and table deep-links.
  Focused backend tests/lint/type passed; full closeout gate pending below.
- ✅ **Phase 3** (`phases/phase-03-frontend-photo-columns.md`) —
  implemented 2026-07-18. Equipment tables, all four Heat Pump leaves,
  Aperture Frames/Glazings report panels, and Thermal Bridges now expose
  proximate `Site photos` attachment cells next to the existing datasheet /
  PDF-report evidence. Attachment payloads normalize photo ids, duplicate-row
  builders clear attachment ids, HEIC/HEIF is accepted by the browser picker,
  and shared status renders as `Specification Status`.
- ✅ **Phase 4** (`phases/phase-04-documentation-page-viewer.md`) —
  implemented 2026-07-18. The top-level Documentation tab now renders a
  viewer-first read-only project evidence page over the backend summary:
  draft/saved endpoint selection, one bulk asset URL pass, header rollups,
  per-axis missing filters, section anchors/copy links, complete-section
  collapse, read-only row strips, record-detail modal, empty state, and the
  legacy `/envelope/site-photos` redirect to `#envelope`.
- ✅ **Phase 5** (`phases/phase-05-editor-affordances-directions.md`) —
  implemented 2026-07-19. Editor Documentation rows now expose real photo
  upload/delete affordances, spec-status selects, Photos/Datasheet
  `Not required` waiver toggles, draft-publish hint focus to Save Version,
  and static in-repo directions content with placeholder example-photo slots.
  Writes use attach/detach for photos, envelope commands for project
  materials and aperture products, and guarded draft-table replaces for
  table-backed rows; envelope photo waivers validate and fan out to every
  summary segment id. Viewer and locked-version surfaces remain read-only.
- ✅ **Phase 6** (`phases/phase-06-verification-docs.md`) —
  implemented 2026-07-19. Added a seeded Playwright Documentation tab
  happy path for phone-width anonymous contractor directions, missing-photo
  rollup/filter behavior, editor JPEG upload from the owning Ventilators
  table, real HEIC upload from the Documentation page, Save Version, and
  anonymous saved-version verification. Final context docs now cover the
  Documentation tab vocabulary, equipment-story rollup pointer, HEIC
  publication path, and equipment-family directions content.

## Next step

None. The feature is archived and landed; branch cleanup follows after
`main` is pushed.

## Decisions (see decisions.md — all major axes settled 2026-07-18)

- ✅ D1: top-level **Documentation** tab (`/projects/{id}/documentation`),
  absorbs US-ENV-15; old envelope sub-tab route redirects to `#envelope`.
- ✅ Scope: equipment + apertures + thermal bridges; identity = Display
  Name (heat-pump-display-name is the do-first prerequisite).
- ✅ D2 direction: evidence page — photo strip + read-only datasheet chip +
  record-detail modal per record.
- ✅ D4: static in-repo directions content. ✅ HEIC: accept + convert.
- ✅ D5: spec status stored (column renamed `Specification Status`, dual-
  surface); datasheet/photo axes derived from attachments + per-axis N/A
  waivers; three-chip rollup.
- ✅ D6: explicit Save (Materials parity) + unsaved-changes hint.
- ✅ Record-modal contents, waiver UX, mobile details, and editor upload paths
  shipped and verified across Phases 4-6.

## Blockers

None for US-SP-1 / US-SP-3. US-SP-2 is intentionally out — blocked on
`planning/features_v1.1/contributor-auth/` (its own design must land first).

## Verification (when implementation starts)

- Phase 1 focused: `uv run pytest tests/test_assets_registry.py
  tests/test_project_document_schema_guard.py
  tests/test_project_document_schema_migrations.py
  tests/test_project_document.py::test_project_document_upgrade_entrypoint_accepts_current_and_v0_baseline`
  → 18 passed.
- Phase 1 backend gate: `make check-backend` → 1413 passed, 7 skipped,
  1 warning (`HTTP_413_REQUEST_ENTITY_TOO_LARGE` deprecation in existing
  asset-service test path).
- Schema fixtures regenerated with
  `uv run python scripts/check_project_document_upgrade.py --fixtures
  --preview-dir /tmp/phn-doc-schema-preview-20260718-2`; audit ok,
  fielddef_drift_count 0, schema_version 6.
- Phase 2 focused: `uv run pytest tests/test_assets_registry.py
  tests/test_assets_service.py tests/test_project_documentation_summary.py`
  → 25 passed.
- Phase 2 changed-slice lint/type:
  `uv run ruff check features/assets/heic_types.py features/assets/heic_conversion.py features/assets/service.py features/assets/registry.py features/assets/repository.py features/project_document/documentation_summary.py features/project_document/routes.py tests/test_assets_registry.py tests/test_assets_service.py tests/test_project_documentation_summary.py`
  and matching `uv run ty check ...` → passed.
- Phase 2 HEIC tests use real generated HEIC bytes through fake R2; dedicated
  MinIO + thumbnail-ready smoke not run in this slice.
- Phase 3 focused frontend tests: `pnpm exec vitest run
  src/features/equipment/lib.test.ts
  src/features/equipment/__tests__/PumpsTable.reuse.test.tsx
  src/features/equipment/__tests__/VentilatorsTable.reuse.test.tsx
  src/features/equipment/__tests__/FansTable.reuse.test.tsx
  src/features/equipment/__tests__/HotWaterHeatersTable.reuse.test.tsx
  src/features/equipment/__tests__/HotWaterTanksTable.reuse.test.tsx
  src/features/equipment/__tests__/ElectricHeatersTable.reuse.test.tsx
  src/features/equipment/__tests__/AppliancesTable.reuse.test.tsx
  src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx
  src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts
  src/features/equipment/heat-pumps/__tests__/OutdoorEquipTable.test.tsx
  src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx
  src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx
  src/features/apertures/__tests__/ApertureSpecReportPanel.test.tsx
  src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx
  src/features/assets/thermal-bridges/__tests__/payloads.test.ts` → passed.
- Phase 3 type/build gate: `pnpm exec tsc -b --pretty false` → passed;
  `make frontend-dev-check` → passed with pre-existing Fast Refresh warnings
  and Vite chunk-size warnings only.
- Phase 3 closeout: simplify fixed helper-boundary, heat-pump payload typing,
  and heat-pump attachment-column duplication findings; docs-pass updated this
  packet, `planning/STATUS.md`, and `context/technical-requirements/attachments.md`.
- Phase 3 full gate: `make ci` → backend 1419 passed, 7 skipped, 1 existing
  deprecation warning; frontend 241 test files / 2235 tests passed; build
  passed with existing warning classes. `graphify update .` completed.
- Phase 3 browser smoke after `make agent-browser-ready`: Ventilators,
  Heat Pump Outdoor Equipment, and Thermal Bridges rendered the new proximate
  photo columns; Ventilators also showed the renamed `Specification Status`
  header. A post-simplify browser recheck reconfirmed Ventilators and Heat Pump
  Outdoor Equipment. Frames route had no seeded project frames, so row-level
  Frames photo behavior is covered by `ApertureSpecReportPanel.test.tsx`.
- Phase 3 live upload/save/anonymous-viewer smoke not completed because the
  exposed Playwright MCP controls do not provide a file chooser path.
- Phase 4 focused frontend tests: `pnpm exec tsc -b --pretty false` → passed;
  `pnpm exec vitest run
  src/features/documentation/__tests__/DocumentationSummaryView.test.tsx
  src/App.test.tsx` → 2 files / 34 tests passed.
- Phase 4 frontend gate before docs-pass: `make frontend-dev-check` → passed
  with pre-existing Fast Refresh warnings and Vite chunk-size warnings only.
- Phase 4 browser smoke after `make agent-browser-ready`: Documentation tab
  rendered at desktop and 390px widths; empty-state rollup was
  `Spec 0/0`, `Datasheets 0/0`, `Photos 0/0`; legacy
  `/envelope/site-photos` redirected to `/documentation#envelope`; no upload
  affordances were present. The AGENT-BROWSER fixture had zero documentation
  records, so row/filter/modal behavior is covered by the focused Vitest
  fixture for this phase.
- Phase 4 simplify: fixed accessible toggle state, no-op section collapse,
  empty group noise, static row attachment previews, and dead row slicing;
  kept the feature `query-keys.ts` wrapper for shape-guard compliance.
- Phase 4 docs-pass: added `context/ui/pages/documentation-tab.md`, updated
  the UI/UX page index and project-workspace tab narrative, updated this
  packet, and updated `planning/STATUS.md`.
- Phase 4 closeout: `graphify update .` completed; `make ci` → backend 1419
  passed, 7 skipped, 1 existing deprecation warning; frontend 242 test files /
  2237 tests passed; build passed with existing warning classes.
- Phase 5 focused backend tests: `uv run pytest
  tests/test_project_document_aperture_documentation_commands.py
  tests/envelope/test_envelope_document_contracts.py -q` → 8 passed.
- Phase 5 focused frontend test: `pnpm exec vitest run
  src/features/documentation/__tests__/DocumentationSummaryView.test.tsx`
  → 3 passed.
- Phase 5 frontend checks: `pnpm run format:check`, `pnpm run lint`,
  `pnpm run check:all`, and `pnpm run build` → passed; lint still reports the
  existing Fast Refresh warnings only, and build still reports existing Vite
  chunk-size warnings.
- Phase 5 backend checks: targeted `ruff format --check`, targeted
  `ruff check`, and `uv run ty check` → passed.
- Phase 5 simplify: three read-only review agents ran. Follow-up fixes landed
  for stale modal row state, no-op table writes, no-op attachment table-key
  ternaries, fail-closed table routing, and envelope segment fan-out
  validation. Larger table-slice/command wrapper and row/modal evidence-editor
  consolidation findings were deferred as non-blocking cleanup because they
  broaden the phase.
- Phase 5 graph update: `graphify update .` completed; Graphify skipped HTML
  viz because the graph exceeds the 5000-node visualization limit.
- Phase 5 full gate: `make ci` → backend 1419 passed, 7 skipped, 1 existing
  asset-service deprecation warning; frontend 242 test files / 2238 tests
  passed; build passed with existing Vite chunk-size warnings.
- Phase 6 focused frontend test: `pnpm exec vitest run
  src/features/documentation/__tests__/DocumentationSummaryView.test.tsx`
  → 3 passed.
- Phase 6 lint slice: `pnpm run lint -- tests/e2e/documentation-tab.spec.ts
  src/features/documentation/directions/content.ts
  src/features/documentation/__tests__/DocumentationSummaryView.test.tsx`
  → 0 errors, existing Fast Refresh warnings only.
- Phase 6 e2e: `pnpm exec playwright test
  tests/e2e/documentation-tab.spec.ts --project=chromium` → 1 passed. The
  spec seeds a Ventilators row, verifies a signed-out phone-width
  Documentation page, checks the Ventilators directions shot list and
  missing-photo rollup/filter, uploads a JPEG from the owning Ventilators
  table, uploads real HEIC bytes from Documentation, saves the draft, and
  verifies a fresh anonymous viewer sees `2 attached` with no upload controls.
- PRD §5 edge-case coverage status:
  `na` records remain exempt via focused Documentation component coverage and
  backend summary tests; locked/viewer read-only remains covered by Phase 4/5
  tests; Heat Pump leaf grouping, duplicate-row attachment clearing, and HEIC
  conversion remain covered by Phase 2/3 tests; Save-As/deleted-row/version-
  picker behavior relies on the existing versioned-document and attachment-GC
  contracts plus the new saved-version e2e happy path.
- Phase 6 simplify: three parallel review agents checked reuse, quality, and
  efficiency. Follow-up fixes centralized the e2e agent sign-in helper,
  switched Documentation e2e row selectors to `role=listitem`, and replaced a
  repeated draft-table polling read with a single owner-table PUT wait. Inline
  tiny JPEG/HEIC buffers were retained to avoid binary fixture churn.
- Phase 6 docs-pass: final fold-back landed in
  `context/ui/pages/documentation-tab.md`, `context/GLOSSARY.md`,
  `context/user-stories/30-tables-equipment.md`,
  `context/technical-requirements/attachments.md`, this packet, and
  `planning/STATUS.md`.
- Phase 6 `make format` → passed; backend 522 files unchanged, frontend source
  Prettier unchanged.
- Phase 6 `graphify update .` → completed; Graphify skipped HTML viz because
  the graph exceeds the 5000-node visualization limit.
- Phase 6 full gate: `make ci` → backend 1419 passed, 7 skipped, 1 existing
  asset-service deprecation warning; frontend lint passed with existing Fast
  Refresh warnings, Vitest 242 files / 2238 tests passed, and build passed with
  existing Vite chunk-size warnings.
