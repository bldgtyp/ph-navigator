# Archive Index - Completed Planning Packets

Append-only audit trail. Durable decisions live in `context/`; this records
how and when each feature packet landed. Newest first. Grep by slug.

New packets (2026-08-26 onward) archive **flat by slug** to
`archive/<feature-slug>/`; each row here carries the archival date and the
closed GitHub issue link. Entries below dated 2026-08-20 and earlier live in
the frozen legacy `archive/dated/<YYYY-MM-DD>/` tree.

## 2026-08-27 (cont.)

- `2026-07-15-ui-batch.md` / `2026-08-19-ui-batch.md` - Index files for the
  two dictated UI batches; every packet they route to shipped and archived, so
  the indexes moved here flat by name (archived 2026-08-27).

## 2026-08-27

- `spec-status-batch-editing` - Made Spec. Status editing responsive and
  batchable on the Envelope Materials and Apertures Glazings/Frames reports.
  Status writes now render on click and queue on the shared `SliceWriteJournal`
  + `DraftWriteCoordinator` instead of blocking the whole grid for a ~200-350 ms
  production round trip and silently dropping a concurrent change; the command
  endpoint gained a `commands: [...]` form applied as one document write so
  queued writes coalesce; and `ReportTable` gained row selection plus a bulk
  "Set spec. status" action that sends the whole run as one request. Closes
  S-1 through S-5, S-7 and S-8; S-6 (Documentation spec-status optimism)
  deliberately deferred. Four reviews per phase, browser-verified batch gesture
  against 12 seeded materials, full CI green (backend 1,913 passed / 7 skipped;
  frontend 2,545 passed; production build passed). Two browser checks still
  owed against a project with real apertures - the local fixture has none.

## 2026-08-20

- `model-viewer-shading-factor` - Added nullable Summer/Winter aperture
  shading factors to immutable `/model_data` artifacts and a Building-only
  fixed-domain continuous color theme with shareable seasonal URL state,
  non-filtering legend, Missing count, and dual-value aperture inspection.
  Structural perf coverage, isolated mixed-factor browser acceptance,
  three-way simplify reviews, docs-pass, Graphify, and full CI passed (backend
  1,907 passed / 7 skipped; frontend 2,517 passed; production build passed).
- `assembly-pdf-and-public-dimensions` - Added read-only Assembly thickness
  dimensions for locked and anonymous viewers plus a capability-gated,
  saved-Version PDF report with one deterministic vector page per Assembly,
  SI/IP material tables, membrane and air-barrier semantics, and dirty-draft
  confirmation. Three-way simplify review, docs-pass, Graphify, rendered
  unlocked/locked/anonymous browser acceptance, visual two-page PDF inspection,
  and full CI passed (backend 1,903 passed / 7 skipped; frontend 2,505 passed).

## 2026-08-19

- `version-management-and-diff` - Added safe Version rename/delete lifecycle,
  timestamps, a dedicated manager, and structured human-readable saved/draft
  comparison. Dirty-draft and locked-Version browser acceptance, desktop/narrow
  modal geometry, three-way simplify, docs-pass, Graphify, and full CI passed
  (backend 1,889 passed / 7 skipped; frontend 2,490 passed).
- `status-presentation-polish` - Replaced ambiguous Roadmap rail glyphs and the
  duplicate title badge with direct Done / To-Do / N/A labels, reduced Assembly
  condensation status to a compact text action for authenticated users, and
  suppressed both its query and rendering for anonymous users. Three-way
  simplify reviews, docs-pass, Graphify, 2,475 frontend tests, the frontend
  development gate, and mounted desktop/narrow signed-in/out acceptance passed.
- `shared-interaction-polish` - Added tokenized hover and delayed shared
  tooltips to small equal-width SegmentedControls while preserving native
  radio semantics and keyboard behavior. Mounted production ReportTable seam,
  row-action, horizontal-scroll, sticky-lane, and nested-table checks found the
  current shared CSS already continuous, so no speculative style change was
  made. Simplify, docs-pass, Graphify, frontend dev checks, 2,467 Vitest tests,
  and 2 Playwright geometry tests passed.
- `documentation-na-prioritization` - Stable-partitioned fully N/A Envelope
  Assembly records into one collapsed bottom section for authenticated users,
  omitted those rows, empty groups, empty sections, and attachment URL work for
  anonymous viewers, and corrected attention filters to evaluate each raw axis
  independently. Locked/read-only behavior, disclosure state, unchanged
  rollups, signed-in/out rendering, three-way simplify, docs-pass, Graphify,
  and full CI passed (backend 1,870 passed / 7 skipped; frontend 2,465 passed).
- `aperture-installs-preview-fit` - Replaced the Installs modal's fixed
  width-only zoom with a measured two-axis contain-fit viewport. The exact-size
  SVG and install overlay share one centered origin/zoom with at least 16 px
  padding, retain the last valid measurement through transient zero-size
  observations, cap scale-up at 300%, and recompute across resize and narrow
  stacked layouts. Simplify, docs-pass, Graphify, full CI (backend 1,870 passed
  / 7 skipped; frontend 2,456 passed), and mounted Playwright geometry plus
  staged-edit persistence checks passed.

## 2026-08-03

- `attachment-reference-walker-unification` - Derived ordinary attachment row
  paths from `TableContract`, retained explicit adapters for irregular frame,
  glazing, and nested assembly shapes, and routed reference reads plus
  attach/detach mutation through one lazy cached authority. The closed
  attachment-field allowlist remains the anonymous-access boundary. Focused
  coverage, three-way simplify review, docs-pass, Graphify, and full CI passed
  (backend 1,821 passed / 7 skipped; frontend 2,396 passed).
- `shared-segmented-control` - Replaced five bespoke inline single-selects with
  generic native-radio `SegmentedControl<T>` compact/content variants while
  preserving true tablists as `.pill-tab`. Added focused primitive and consumer
  tests, design-system/CSS ownership, mounted geometry and interaction checks,
  rendered typography verification (22/22 states, 28/29 variants), Graphify,
  three-way simplify reviews per phase, docs-pass, and green full CI (backend
  1,822 passed / 7 skipped; frontend 2,396 passed).
- `status-ux-unification` - Unified status vocabulary and controls across
  Documentation, DataTables, report panes, and Aperture editors; added
  URL-addressable Documentation evidence filters; replaced the Status record
  tree with counts-only Overview meters and deep links; and retired the
  duplicate backend/frontend status-summary stack. Browser acceptance,
  three-way simplify reviews, docs-pass, Graphify, and full CI passed (backend
  1,822 passed / 7 skipped; frontend 2,393 passed).
- `public-attachment-access` - Restored anonymous attachment reachability for
  all 31 registered fields by making the row walker list/envelope tolerant and
  registering Thermal Bridge PDF Report. Schema-derived guards cover registry
  and real-shape reachability; download failures stay in-app; unresolved files
  have explicit loading/unavailable states. Read-only production inventory found
  seven valid references and zero violations. Signed-out browser acceptance,
  three-way simplify reviews, docs-pass, Graphify, and full CI passed (backend
  1,830 passed / 7 skipped; frontend 2,389 passed). Archived as locally
  complete; no deployment or production write occurred.

## 2026-08-02

- `units-field-naming` - Shipped project-document schema v9 so heat-pump
  capacities and pump flow use truthful canonical-SI keys backed by backend
  FieldDef units metadata. The v8→v9 migration preserves existing kW/l-min
  magnitudes, converts legacy 17F Btu/h by the exact `3412.141633` factor, and
  refreshes persisted built-ins. Frozen earlier inputs, a new v8 golden case,
  Phius export, simplify/docs-pass, Graphify, full CI (backend 1,776 passed / 7
  skipped; frontend 2,373 passed), and mounted SI/IP API/UI checks all passed;
  no production project write was performed.
- `licensed-data-pipeline` - Shipped the private-git to immutable-R2 licensed
  data pipeline, manifest-pinned runtime reads, audited fail-closed DB-seed
  applies, and Ed-dispatched Render production workflow. Production reconciled
  408 canonical material IDs plus 22 saved references, applied the 201-row ISO
  10456 µ dataset with zero unmatched targets, proved the repeat no-op, and
  verified ASHRAE films still load after guarded legacy-key deletion.
- `agent-access-kit` - Shipped user-scoped revocable machine credentials,
  browser-approved device login, account token management, a generic Dropbox
  null-marker bootstrap, public `bldgtyp` Claude plugin 0.1.1, and generated
  global Codex parity. Production acceptance passed Claude and Codex cold/warm
  reads, a Linde draft/diff/discard round-trip with unchanged saved etag, local
  template stamping, and cross-user `project_not_found` isolation. PH-Navigator
  deployment run `30750524962` and public plugin CI run `30751238058` passed;
  all acceptance credentials were revoked after verification.

## 2026-08-01

- `admin-all-projects-dashboard` - Added a capability-gated all-project
  dashboard for `projects.access.all` holders, grouped by owner with the
  current user's projects first and BT number descending inside each group.
  Ordinary users retain the owner-only list; disabled foreign-project controls
  and owned-only select-all preserve the destructive boundary. Backend and
  frontend coverage, live browser acceptance, Graphify, three-way simplify,
  docs-pass, and green CI completed the packet (backend 1,756 passed / 7
  skipped; frontend 2,369 passed). Deployment remains an explicit operator
  decision.
- `project-ownership-enforcement` - Signed-in project reach now requires the
  caller to own the project or hold `projects.access.all`; ordinary strangers
  receive `404 project_not_found` across REST and MCP. Anonymous read-only
  viewer behavior remains unchanged, while the three destructive project
  operations remain intentionally owner-only. The closeout includes a full
  project-route inventory, stale MCP-token regression coverage, authenticated
  browser and MCP smoke checks, Graphify, three-way simplify review, docs-pass,
  and green CI (backend 1,754 passed / 7 skipped; frontend 2,365 passed plus
  production build). Production `owner_id` distribution review remains an
  explicit pre-deploy operator gate.

## 2026-07-30

- `aperture-u-value-report` - Added a route-addressable SI/IP U-Values audit
  page under Apertures plus saved-version CSV and formula-XLSX downloads.
  The backend retains parity-locked per-edge ISO 10077-1 terms, exposes REST
  and MCP report contracts, uses PHN's 45-degree frame-corner split, excludes
  Ψ-install from uninstalled U-w, and reports glazing-area-weighted SHGC.
  Empty and unfinished treatment is explicit; export actions are
  capability-gated and warn when drafts are excluded. Desktop Excel
  recalculated all 44 representative workbook formulas with zero errors.
  Final `make ci` passed (backend 1741 passed / 7 skipped; frontend 256 files /
  2365 tests), with live browser verification, simplify review, docs-pass, and
  Graphify complete.

## 2026-07-28

- `catalog-seed-idempotency` - All 638 canonical material, glazing, and frame
  seed rows now carry deterministic ids derived from catalog kind + name.
  Three thin seed commands share one validated insert-only workflow, partial
  catalogs self-heal, and matched re-runs skip commit with explicit counts.
  A committed pipeline replay proves first-pass inserts and second-pass
  `new=0` for `408 / 189 / 41` rows. Make help and the local transition runbook
  document exact counts, the two aperture-default sentinels, full-reset data
  loss, custom-catalog loss, and stale `catalog_origin` risk. Final `make ci`
  passed (backend 1639 passed / 7 skipped; frontend 2312 passed).
- `aperture-void-panels` - Aperture Elements now support `kind: "void"` for
  grid cells that are host wall rather than part of the window unit. Empty
  panels preserve exact grid coverage while carrying no frame, glazing, or
  operation assignments; U-value math, specification reports, route-3 GH
  export, and route-4 HBJSON export exclude them. The Builder renders a
  near-transparent dashed cell with per-element and batch kind controls,
  assignment-aware confirmation, pick/paste and merge guards, and durable
  paste-undo restoration. Cross-repo verification added the companion
  Grasshopper absolute-column-origin fix plus an unmodified-schema S15 smoke
  and fully-void-column 422 guard. Final `make ci` passed (backend 1629,
  frontend 2312); Ed verified the real Rhino/GH components against dev
  `:5173`, where Empty panels imported as expected.

## 2026-07-26

- `assembly-membrane-layers` - Assemblies can now hold membrane / sheet-good
  layers (WRBs, vapour-control layers, self-adhered flashings, paints) and
  designate which face is the air barrier. Four phases: **1** `membrane`
  catalog category (Alembic `20260726_0009`) + `air_permeance_l_s_m2_at_75pa`
  threaded end-to-end + a new `air_permeance` unit pair + membrane layers
  **excluded from the R calculation outright** (not "R ~ 0") with a new
  `no_thermal_layers` flag for the all-membrane case; **2** fixed-hairline
  rendering so a 0.15 mm WRB is visible at any zoom, the single-segment rule
  enforced on both `add_segment` and material assignment, and width/steel-stud
  controls dropped from the segment dialog; **3** `Assembly.air_barrier =
  {layer_id, face}` drawn as a bold rule on the designated face, plus the ASTM
  E2178 check against that face's permeance where **`unknown` is deliberately
  distinct from `pass`**; **4** membranes omitted from the HBJSON construction
  (an `EnergyMaterial` needs a positive conductivity) and carried in `ph_nav`
  for a lossless round trip, with a deliberate, recorded PHPP drop.
  No document schema-version bump - both new fields are nullable with `None`
  defaults, so existing bodies validate unchanged; the fingerprint guard and
  corpus snapshots were regenerated and verified additive-only.
  Browser-verified per phase against a purpose-built six-layer wall.
  Unblocks `assembly-condensation-risk` (its other prerequisite,
  `assembly-boundary-conditions` Phase 1, is still open).
  Contracts folded into `context/technical-requirements/envelope-thermal-preview.md`,
  `envelope-commands.md`, `envelope-hbjson-export.md`, `envelope-hbjson-import.md`,
  `envelope-catalog-drift.md`, `data-model.md`, `frontend-viewer-units.md`, and
  `context/ui/pages/envelope-tab.md` + `catalog.md`.
  **Lesson worth keeping:** every place that assumed "layers" and "layers with
  an R-value" were the same set needed revisiting, and the passing tests said
  nothing about any of it - the browser found the unclickable hairline, and
  review found the adjacent-membrane click theft, the assignment back door
  around the single-segment rule, the un-imported air barrier, and the
  foreign-import regression introduced by fixing it.
  **Superseded 2026-07-27:** the hairline rendering was reworked into a
  reserved band drawn as a rule, deleting `canvas-hit-box.ts` and the whole
  hit-box negotiation. That rework found the click theft's real cause — a
  global 38px `button` min-height floor the membrane `z-index` bump had been
  masking, which was stealing clicks for *every* thin layer, not just next to
  membranes. See the packet's `STATUS.md` header.

## 2026-07-20

- `modal-consistency` - Cross-cutting refactor giving every modal/dialog one
  visual + interaction contract: `ModalDialog` + `DialogActions`, footer
  **Cancel** as the canonical dismiss (header "Close" off by default, kept only
  on read-only viewers), styled action buttons, `danger`/`extraActions` for
  destructive & multi-action footers, a shared box with a resize grip when
  oversized, and backdrop-click off for forms / on for viewers. Seven phases
  (00 shared-component contract → 01 header-Close sweep → 02 RowEditModal
  cluster → 03 single-primary partials → 04 multi-action footers → 05 apertures
  rogue migration → 06 Radix data-table family conformed, D-3 keep+conform).
  `make ci` green each phase; Phase 03's bulk batch implemented by Codex/gpt-5.5
  and reviewed here; live `NewProjectModal` screenshot confirmed the rendered
  contract. Contract folded into `context/DESIGN_SYSTEM.md` ("Modal contract").
  Merged to `main` via #42.
- `database-backups` - Independent off-site encrypted Postgres backup plus a
  tested restore path, now operating. Daily GitHub Actions job dumps production
  with a least-privilege `phn_backup` role, encrypts with `age` to a recipient
  whose private key is held offline, and stores to the Cloudflare R2 bucket
  `phn-db-backups` (30 daily / 12 monthly, lifecycle-expired). Backup logic
  lives in `ops/backup/*.sh` over a shared `config.sh` (D-11) rather than in
  workflow YAML, which is what makes `make backup-drill-local` able to
  round-trip the real scripts against local Postgres; that drill caught two
  bugs before they could reach production. First production backup and restore
  drill passed 2026-07-20 (2 users / 5 projects / 7 project_versions, bodies
  intact). Runbook: `context/DATABASE_BACKUPS.md`, which also carries the two
  outstanding setup items (move the age identity out of Downloads; install the
  weekly Dropbox launchd pull).

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
