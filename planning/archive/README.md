# Archive Index - Completed Planning Packets

Append-only audit trail. Durable decisions live in `context/`; this records
how and when each feature packet landed. Newest first. Grep by slug.

## 2026-07-19

- `heat-pump-display-name` - Documentation tab prerequisite: all four Heat
  Pump leaf tables now seed and upgrade a built-in `Display Name` field,
  backfill it from the existing typed Tag during schema v5 upgrades, and pin
  it as the frozen identifier column while preserving Tag uniqueness,
  downstream labels, sorting, modals, exports, and linked-record behavior.
  Verified with backend schema/golden-corpus coverage, frontend heat-pump
  table/payload tests, and AGENT-BROWSER legacy-row smoke; archived with the
  Documentation tab branch closeout.
- `documentation-tab` - top-level project Documentation tab for
  specification/datasheet/photo evidence: schema v6 photo fields and waivers,
  HEIC/HEIF upload conversion to JPEG, backend documentation-summary rollups,
  proximate photo columns across Equipment / Heat Pumps / Apertures / Thermal
  Bridges, viewer-first read-only Documentation page, editor upload/delete +
  waiver/status affordances, static directions content, and legacy
  `/envelope/site-photos` redirect. Final closeout verification: seeded
  Playwright e2e for phone-width anonymous directions, missing-photo filters,
  owning-table JPEG upload, Documentation-page HEIC upload, Save Version, and
  fresh anonymous saved-version read; `make format`, Graphify update, and full
  `make ci` passed. Archived from `feature/documentation-tab` and included
  in the final squash merge to `main`.

## 2026-07-18

- `user-stories` (docs housekeeping, not a feature packet) - the ~10k-line MVP
  user-story cluster (`00-foundation-shell`, `10-apertures`, `20-envelope`,
  `30-tables-equipment`, `31-data-table-enhancements`, `32-custom-fields`,
  `40-model-viewer`, `50-settings-ops-llm`, `90-open-questions`) moved out of
  canonical `context/user-stories/` to `planning/archive/user-stories/`. All
  the features shipped; the durable contracts they produced live in
  `context/technical-requirements/*` and `context/ui/pages/*`.
  `context/USER_STORIES.md` stays as a thin redirect carrying the two
  still-open aperture questions (Q-APT-3, Q-APT-5); the resolved
  open-question log and the historical Phase 0-7 vertical-slice plan remain in
  the archived bodies. Grep by `US-`/`Q-` id.

## 2026-07-17

- `typography-consolidation` - site-wide typography consolidation (refactor packet, driven by the 2026-07-17 rendered font audit's 55-variant finding). **Rendered variants 55 → 29, source typography debt 436 declarations → 0**, all on branch `refactor/typography-consolidation` (11 commits; merge = Ed's call). Six phases: (1) token groups (`--fw-*`, `--tracking-*`, `--lh-*`, named exceptions `--fs-display`/`--fs-display-sm`/`--fs-canvas-annotation`/`--fs-icon-badge`/`--lh-canvas-annotation`/`--lh-icon-collapse`), the `code/kbd/samp/pre` mono reset, and the blocking postcss-based `check:typography` guard (fingerprint ratchet, wired into `check:all`); (2–5) owner-by-owner migration (shared primitives → DataTable/ReportTable/catalogs → apertures/envelope/canvas → model viewer + long tail), retiring the baseline to an empty `{}` — zero-debt mode, any literal now fails CI; recharts `fontSize` props eliminated via CSS hooks instead of registry exceptions; (6) rendered-contract evaluator (`font-audit-eval.mjs` + `typography-rendered-contract.json`, state manifest shared with the sweep via `font-audit-states.mjs`), hermetic fixture (grants + `fixture.json` seeded by `make agent-browser-ready`), `make typography-eval`, and the scheduled/manual `typography-eval.yml` workflow. D1–D5 resolved with PRD defaults (modal titles → page-title tier; display type via named clamp tokens, probe-resolved so **zero off-scale rendered sizes**; canvas labels keep 10px; editor-hero drops 700; chevrons → `--fs-2xs`). Final state: two families, weights {400,500,600,700}, exactly one non-zero tracking (0.05em caps). Recorded deviations: 29 vs the PRD's aspirational ≤25 ceiling (the gap is four deliberate styles listed in STATUS.md) and role-inference button/heading budgets. Verified per phase with screenshots + `make ci`; e2e table smoke 14/14; final 4-angle simplify review applied (shared guard-utils, savepoint fix in `ensure_global_grant`, probe-based clamp mapping). Follow-ups (Ed): merge; after ~3 workflow runs decide PR-CI promotion; optional further consolidation toward ≤25.
- `catalog-option-management` - catalog single-select management is now available to members on Window-Frame Elements and Window-Glazing: add, rename, reorder, recolor, delete, and merge use the shared field-config modal while protected catalog attributes stay locked. A rename previews the affected catalog/project counts, atomically creates a catalog-scoped durable cascade job, then rewrites active project drafts or appends a version when no draft exists; the working modal reports progress, totals, per-project errors, retry, and recovers unresolved work after page remount. Merge preserves drift review for refs while rewriting manufacturer filters. Final verification: focused backend/frontend suites, live member browser rename with clean restoration, `make format`, `graphify update .`, and `make ci` (backend 1406 passed / 7 skipped; frontend suite, static guards, and production build passed). The standard browser fixture contained no catalog-origin refs, so its live job had zero targets; nonzero rewrite behavior is covered by backend tests.

## 2026-07-16

- `viewer-display-modes` - packet 7 (final) of the 2026-07-15 UI-tweak batch (items 13/14/15), 3D model-viewer color/material. All three shipped on branch `feature/spaces-opaque-material` (off `main`; `make ci` green, render-verified; merge/deploy Ed's call — `main` no longer auto-deploys prod). **Item 13 (`b0f92412`):** Spaces lens now renders **fully opaque with the exact Building shaded material** (white `#ececec`, same `MeshStandardMaterial`/AO), was a muddy semi-transparent green — one-value fix flipping `spaceGroup` into `faceMesh`'s existing opacity(1)+color branches in `lib/colors.ts` (the opaque/transparent split is driven entirely by `baseOpacity()`, **not** `lenses.ts` as the PRD assumed). Interiors occlude by design (section/clip plane to cut in); Ed confirmed opaque + white on a render. **Item 14 (`026b00de`):** the Spaces "Ventilation Airflow" (supply/extract/none) mode now also runs on **Floor Areas** — 2-line change (add the mode to the `floor-areas` list in `themeState.ts`; widen the `ventilation-airflow` guard in `themes.ts` to accept `spaceFloorSegmentMeshFace`) because floor segments already carry the parent space's airflow (`loaders/building.ts`). **Item 15 (`69792929`):** new **"Ventilation Unit"** mode colors each space + floor segment by its assigned ERV. Phase 3a research verdict: the space→ERV mapping is **room-level in HBJSON but DROPPED at PHN extraction** (duct-length precedent), so this was **backend-first** — added service-computed `SpaceSchema.ventilation_unit_id`/`_name` populated in `_spaces_from_model` from the parent room's `ph_hvac.ventilation_system.ventilation_unit`, threaded through `SpaceModelData`→`loaders/building.ts`→meta, and a new `ventilation-unit` theme on both space lenses. Colors are **stable hash-based hues** (Ed's choice; extracted a shared `hashedColor` engine out of `constructionColor`) keyed by unit id, labeled by name, neutral grey when unassigned; dynamic per-unit legend. **Forward-only:** the `/model_data` artifact is immutably cached per `asset_id`, so existing already-extracted models show grey "Unassigned" until re-extracted (re-upload or artifact bust). Backend + frontend tests added; render-verified all three on the dev starter model (seed has 1 ERV → one hue). Open Qs all resolved (13 opaque+white; 15 mapping DROPPED; 15 colors = hashed). **Note:** a concurrent env process merged an unrelated `feat(deploy): decouple production deploys from main merges` (`6d6f0e74`) to `main` mid-session; this packet was rebased onto it.
- `sidebar-organization` - packet 5 of the 2026-07-15 UI-tweak batch (items 5/6). User-controlled organization for the Apertures + Envelope sidebars, shipped in 5 phases via PR #35 (squash-merge `c4361842`) and browser-verified. **Phase 0:** consolidated the two divergent sidebars into one shared `shared/ui/element-sidebar/ElementSidebar` (adapters keep their prop APIs), which fixed the Apertures rename-state overlap (item 6) by construction. **Phase 1:** backend `features/sidebar_views/` + table `user_sidebar_views` (Alembic `20260716_0006`, per-user × project × sidebar, opaque JSONB, additive), modeled on `table_views`; frontend `features/sidebar_views/` hooks (debounced/single-flight `useProjectSidebarViewState` + composed `useSidebarOrganization`). **Phase 2:** alphabetical|manual sort toggle + dnd-kit drag ordering (editors only; reuses the repo's existing `@dnd-kit`). **Phase 3:** grouping tree — create/rename/delete groups, per-row native-`<select>` "move to group" (clip-safe vs a popover; cross-container drag deferred), within-section drag, up/down group order, Ungrouped remainder; `ElementSidebar` split into `types.ts`/`rows.tsx`/`GroupedList.tsx` to stay under the 500-line guard. **Phase 4:** per-group collapse (persisted `collapsed_group_ids`). Editor-only + opt-in (default alphabetical unchanged → limited blast radius). Open Qs resolved: #1 backend persistence + #4 dnd-kit (Ed 2026-07-15); #2 new items → Ungrouped, #3 groups only in manual mode, #5 empty groups allowed. Each phase multi-angle reviewed (reuse/simplification/altitude/correctness) + `make ci` green (backend 1390, frontend 2200). Browser-verified 2026-07-16 via the new `frontend/scripts/agent-browser.mjs` (toggle + drag handles + New-group affordance + Manual persists across reload). **Deferred (not committed):** cross-container drag to assign items between groups; drag-reorder of groups. **Sibling:** `chore/reliable-agent-browser` (PR #36, `fccef0e1`) built the browser tooling that unblocked verification.
- `project-public-alias` - packet 6 of the 2026-07-15 UI-tweak batch (item 8). User-settable public-facing project title so internal names ("Ayers Home") never leak on public surfaces. **Model (Ed 2026-07-16, simplifying the PRD):** `display_name = public_alias ?? name`, server-derived and shown to **everyone** (universal override, not a viewer-branch); with **no alias the real name shows** — privacy is **opt-in**. Once an alias is set, the internal `name` is additionally redacted to the alias for `client`/anonymous principals **server-side** (rides the existing `PROJECT_VIEW_PRIVATE` seam in `service.get_project_detail`), so anonymous REST and MCP client tokens can never read the real name; members/`certifier` still get it. **Backend (`355870e4`):** migration `20260716_0007` (`projects.public_alias TEXT NULL`); `ProjectSummary.public_alias` + a server-derived `display_name` **plain field** (deliberately not a `@computed_field` — computed fields are omitted from Pydantic's validation-mode JSON schema, which FastMCP validates tool output against, so `additionalProperties:false` rejected them; the row→model projections skip the derived column via `if field in row`); `UpdateProjectRequest.public_alias`; client-viewer `name` redaction. **Frontend (`f7b57f23`):** editable "Public alias" field in `ProjectSettingsModal`; title sites (`ProjectShell` breadcrumb + header, `ProjectList` dashboard) render `display_name`. **Audit (Phase 4):** remaining raw-`name` renders are editor-only operational surfaces (settings-name editor, delete-confirm, trash) — auth-only or already server-redacted for anonymous viewers; there is **no** per-project HTML `<title>`/OG metadata (tab title is the static `PH-Navigator V2`), so that PRD concern is moot. Tests: `backend/tests/test_project_public_alias.py`, `frontend/.../ProjectSettingsModal.alias.test.tsx`. `make ci` green (backend 1395, frontend 2203). **Deferred (PRD open Q #4):** aliasing other identifying fields (location/client/file names) stays with the access-model track. Branch `feature/project-public-alias`; merge/deploy Ed's call.

## 2026-07-15

- `datatable-ui-fixes` - packet 3 of the 2026-07-15 UI-tweak batch (items 11/12), shared `DataTable`. **Item 11 (z-index):** dropped the `z+9` override on `.data-table-cell-active[data-row-edge="bottom"]` so the bottom-row active cell keeps the normal active `z+2` (below frozen column `z+5` / gutter `z+7`); the selection ring no longer paints over the frozen lane during horizontal scroll. The sticky summary bar (`z+8`) now correctly covers a bottom-row active cell scrolled behind it (AirTable footer parity); the fill handle is pinned inside the cell so it is never clipped scrolled-to-bottom. Root cause was the 2026-07-09 summary-bar z-fix over-lifting the active cell above the whole frozen lane. **Item 12 (single-select "manage options" modal redesign):** new shared `OptionColorPicker` (clean circular swatch → Radix popover with a curated 10-color quick-pick grid **plus a native custom-hex input**; `FieldOption.color` is already free-form, so **no schema change**) used by both the create + edit option editors; fixed the permanently-invisible reorder grip (its hover-reveal selector keyed off `.data-table-view-popover-rule`, a parent the option row lacks) → `GripVertical` revealed on row hover, reusing `.data-table-view-popover-drag`; deferred validation (blank rows are the "add option" affordance, dropped from the saved set instead of erroring — only duplicate labels or an in-use option blanked surface); palette 6→10; spacing polish; orphaned CSS/`AutocompleteSelect` color control removed. Verified: `make ci-frontend` green (2167 tests + build), z-index/css-vars/hex/data-table guards green, 2 new deferred-validation unit tests. **Browser spot-check NOT done** (Playwright profile locked by another session) — manual pass recommended. **Deferred:** a shared `OptionRow`/`OptionListEditor` so the *create* modal also gains reorder (overlaps the [`sidebar-organization`](dated/2026-07-16/sidebar-organization/README.md) shared-reorder-primitive work), and a named z-index token ladder for `DataTable.css`. Committed `c49fa22c` on branch `refactor/datatable-ui-fixes` (off `main`; not yet merged — Ed's call).
- `spaces-tab-rename-reorder` - packet 4 of the 2026-07-15 UI-tweak batch (item 7). Under the Spaces tab, made the Rooms sub-tab first + the default the tab opens on, and relabelled it "Rooms" → "Spaces" (Honeybee-PH terminology). **Display-only rename**: only the sub-tab label and the DataTable title change (the title also drives the CSV/JSON export filename); the route `/spaces/rooms`, the internal `rooms` table key/path, query keys, and persisted table-view state are untouched — no data migration, no MCP/API break. Region aria-label deliberately stays "Rooms" (internal identity), so the accessible region name diverges from the visible "Spaces" tab — a minor, intentional a11y quirk. Ed chose to accept the resulting "Spaces › Spaces" (parent tab Spaces containing sub-tabs Spaces + Space-Types). Docs synced (`context/ui/pages/spaces-equipment-tab.md`, `context/user-stories/30-tables-equipment.md`). Verified: format clean, lint 0 errors, tsc+build pass, full Vitest 2165 passed; Playwright not run (label swap; `openRoomsTable` helper updated). Squash-merged to main 2026-07-15 (from branch `refactor/spaces-tab-rename-reorder`); deploys to production via Render.
- `tooltip-hover-delays` - packet 1 of the 2026-07-15 UI-tweak batch (items 4/9/10). Added named `TOOLTIP_HOVER_DELAY` tiers (`medium` 500ms / `long` 900ms) to the shared `Tooltip` primitive and converged the Apertures + Envelope sidebars onto it, deleting both bespoke JS-portal tooltips, their CSS, and the orphaned `[data-sidebar-tooltip]` hint rules (toolbar variant kept) for identical font/color/size/top-placement parity (net -247 lines). Tiers applied: element name = `medium`; row-action buttons + `version-path-trigger` + version-control help tooltips (project-actions menu items, Save Version / Save As, Uncommitted-changes label) = `long`. Browser verification surfaced and fixed a **general** lingering bug (every tooltip app-wide): Radix restores focus to the trigger on popover close, which re-fired the primitive's `onFocus` and re-opened the tooltip — fixed with `onCloseAutoFocus` preventDefault on `Popover.Content` (browser-verified; jsdom can't reproduce Radix focus restoration). Tests migrated to the shared `.app-tooltip` DOM with async hover asserts; `make ci` green. Remaining batch packets (apertures-builder-fixes, datatable-ui-fixes, spaces-tab-rename-reorder, sidebar-organization, project-public-alias, viewer-display-modes) stay in `planning/`. (squash-merge closeout 2026-07-15)

## 2026-07-09

- `spaces-ventilator-link` - built-in Rooms `Ventilator` linked-record field (`custom_links.ventilator_id`) targeting `tables.equipment.ervs`, with single-link cardinality, room-side picker/pills, Ventilators-side inverse room visibility/editing, silent room-link cleanup when a ventilator is deleted, shared frontend inverse-link helpers, shared backend `custom_links` delete-cascade helper, focused backend/frontend tests, typechecks, graphify, simplify, and docs-pass. (370e6795 + closeout)
- `formula-field-units` - convert a fixed-unit number field into a formula that keeps its units, and back. Three phases on `feature/formula-field-units` (not yet merged to main — Ed's call). Phase 1: the gh_api tabular export emits computed/formula values inline (`{"error"}`-overlay decode extracted to shared `formula.overlay_cell_value`). Phase 2 (backend contract): registry drift closed (`length_mm`/`power` added to `NUMBER_UNIT_REGISTRY`); a single shared fixed-units guard (`mutations/guards.py` `enforce_fixed_units_lock` + `collapse_carried_units` tri-state) replacing the verbatim copies — a fixed field converts only number↔formula and its units never retarget, on either type; top-level `display_units` wire field (D12, tri-state via `model_fields_set`); numeric-formula units allowed in `validate_number_config` (D4); `apply_set_formula` `carried_units` reconciliation as the single units point, run on every formula-target bundle (D7/D14); reverse carry-back on `formula→number` (D6). Phase 3 (frontend): `displayUnits` tri-state payload; a shared `displayUnitsFor(fieldDef)` accessor drives grid cell / header / clipboard / CSV so a numeric-formula column matches a number column everywhere (closed the header + clipboard gaps); modal reuses `FieldConfigSectionNumberUnits` relabeled "Display units" (D11). Design D1-D14 in the packet. Backend suite green (1334 passed); full frontend suite green (2090 passed).
- `bug: ventilators-hp-indoor-units-field-not-hideable` - the synthetic "HP indoor units" incoming-link column escaped DataTable hide/reorder (the per-table `columnsForSanitize` stub omitted its id, so the view-state sanitizer stripped it from `columnOrder`/`hiddenColumns`) and lacked the built-in header border (`incomingLinkFieldDef` didn't set `built_in`). Fixed both uniformly for all incoming/inverse-link columns; heat-pump sibling tables fixed too; Pumps dynamic-inverse noted as follow-up. (d9c92306)
- `bug: thermal-bridges-display-name-formula-renders-blank` - a Display Name set to a Formula rendered blank on every non-Rooms table because the identifier column read the stored value, not the `rows_computed` overlay. Lifted the computed-Display-Name path into the shared `identifierColumn` (formula-aware) instead of the per-table Rooms wiring, threading `rows_computed` through all 8 tables. Backend already computed the overlay. (d5cfc4e5)
- `bug: datatable-frozen-columns-overshoot-body-bottom` - the sticky gutter/frozen lane bled a partial row past the body into the footer. Root cause corrected from the recorded virtualizer-spacer hypothesis to a z-index inversion: the sticky-bottom summary `<tfoot>` (z+2) sat below the body sticky gutter/frozen cells (z+7/+5). Raised the summary bar to z+8 (mirroring the header) and the bottom-row active cell to z+9. Verified against a faithful sticky-stacking browser harness. (4b762dba)
- `data-table-ui-tweaks` - shared DataTable visual polish closeout: active-cell chrome now uses one crisp square overlay ring with square editors, toolbar Filter/Sort/Group active states no longer show inner white pills, and copy/paste now has stable row-id/field-key copied-range feedback with marching-ant perimeter, Esc clear, and paste flash. Focused DataTable tests, live Rooms browser smoke, `make frontend-dev-check`, `graphify update .`, simplify, docs-pass, and full `make ci` passed. Squash-merge closeout in progress 2026-07-09.
- `attachment-cell-ux` - Envelope/Materials attachment + table UX polish across the shared `AttachmentCell`, `ReportTable`, `AttachmentChipCell`, and `MaterialsPanel`. Eight items: IP **Resistivity [R/inch]** column in the Materials table (SI keeps Lambda; reuses `formatRPerInFromConductivityWmK`, display-only, stored field unchanged); noun-aware chip **count tooltip** + fainter "missing" glyph; **accent border** wrapping the expanded report-table row via split `inset` box-shadows (no layout shift, no DOM/ARIA change; also Apertures); **drag-active** drop-target highlight (enter/leave depth counter); persistent **"+ Add"** tile on populated strips (datasheets always allowed 5 — never a backend limit); **variant-sized tile redesign** (`--attachment-tile-size`: card 64px w/ real accent border, cell 32px) replacing the hand-drawn dog-ear/underline glyph with a clean type badge; **upload spinner** + `useAssetUrls` thumbnail-lag `refetchInterval` poll + inline error tile (Sonner toast DEFERRED — no app-wide `<Toaster>` mounted); **single-click opens preview** (decision D-1=A, global) removing the in-strip select model (state/arrow-nav/Delete/tabIndex/`.selected` CSS), detach now modal-only. Synced canonical `attachments.md` §A4.1/§A4.2/§A4.6; 8 equipment datasheet-detach tests migrated to the modal flow. Full frontend suite green (2070 tests); live Playwright smoke on Envelope → Materials verified items 2/3/4/5/6/7/8 (item 1 drag-hover is CSS+unit only). Squash-merged to main 2026-07-09.

## 2026-07-05

- `gh-material-thermal-defaults` - opt-in relaxation of the GH constructions export (`GET /constructions/hbjson`). New query param `on_missing_thermal=strict|user_defaults` (default `strict`, unchanged contract): under `user_defaults` a material missing only its thermal-mass fields (`density_kg_m3`/`specific_heat_j_kgk`) is exported with PH-neutral, EnergyPlus-safe defaults (600/1000) and a `warnings` entry instead of a whole-export 422; missing `conductivity_w_mk` still 422s (it drives the U-value). `warnings` added to the shared `GhEnvelope` as a route-agnostic `GhWarning{code, message, details}` mirroring the error envelope (material specifics live in `details`), so any GH route can carry warnings and the GH client's existing details renderer handles them; the export recursion threads a single `_ExportContext` (materials+mode+warnings) and single-sources the field/default/label triple. 6 new tests + full `make ci` green. Consumer follow-up (send the param, surface `warnings`) is DEFERRED to `honeybee_grasshopper_ph_plus` (`planning/ph-navigator-v1/02-get-constructions.md`).
- `grasshopper-data-api` - downstream read API for Rhino/Grasshopper (`/api/v1/gh/projects/{bt_number}`). Backend Phases 01-03: (01) new `features/gh_api/` router with a three-tier access dependency (session cookie -> MCP bearer -> anonymous, authorizing locally without widening capability sets), `?version=` pinning (saved versions only, never drafts), a `Z`-suffixed UTC envelope, resolver route, minimal per-IP fixed-window rate limiter, and an Alembic migration swapping the full `uq_projects_bt_number` constraint for a partial unique index (bt_number frees up after soft-delete); (02) rich `OpaqueConstruction.to_dict()` built from real honeybee objects (PhColor, `PhDivisionGrid` for hybrid/steel-stud, `honeybee_energy_ref` datasheet/photo refs + `ph_nav` id; added `honeybee-ref==0.2.1`), denormalized `aperture-types` grid JSON (inclusive spans -> V1 count shape, frames/glazing inlined), and a thin `aperture-constructions/hbjson` wrapper; (03) generic `/tables/{table_name}` for the 12 row-based element tables with `{id,label}` single-select denormalization and `custom_values`/`field_defs` passthrough, drift-guarded against the internal table registry. Decisions O1-O7 resolved; PRD §7 parity checklist verified; 32 focused tests + full `make ci` green. Merged to main 2026-07-05. Phases 04-05 (GH-client `PHNavV2Client`, version switch on the two existing components, new getter components) are DEFERRED to the separate `honeybee_grasshopper_ph_plus` repo — start from `CLIENT_HANDOFF.md`.

## 2026-07-02

- `rooms-airflow-fields` - nullable unit-aware Rooms defaults for `Supply airflow rate` and `Extract airflow rate`: schema v2 read-time upgrade adds missing built-in FieldDefs to stale saved/draft bodies while preserving `custom_values`, fresh projects get fixed airflow units (`m3/h` SI, `cfm` IP), Rooms renders extra built-ins through the shared DataTable number-units path, null values stay blank, IP/SI edit/display smoke passed, `make frontend-dev-check`, `make ci`, `graphify update .`, simplify, and docs-pass passed.
- `configurable-single-select-options` - Rooms Floor/Zone option management through the shared DataTable field-config modal: backend allowlist guardrails, frontend option-mutability contract, inline-create and paste gating, explicit clear/replace behavior for referenced deletes, protected Equipment `status` option locks, durable DataTable docs, focused backend/frontend tests, and in-app Browser smoke passed.
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
