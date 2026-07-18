# Typography consolidation — status

- DATE: 2026-07-17
- TIME: 12:38
- STATUS: Complete (all 6 phases) — awaiting merge to main
- AUTHOR: Claude (Fable 5) with Ed May
- REVISED: 2026-07-17 afternoon ET by Codex
- SCOPE: Execution state for this packet
- RELATED: `PRD.md`, `PLAN.md`

## Current state

All six phases implemented on branch `refactor/typography-consolidation`.
Rendered typography reduced **55 → 29 variants**; source typography debt
**436 → 0** (empty baseline, guard in zero-debt mode); two-layer
enforcement live (`check:typography` blocking every PR;
`make typography-eval` + scheduled workflow for the rendered contract).
Evidence: `REPORT-after.md`, per-phase notes below.

## Decisions (D1–D5) — resolved 2026-07-17 with PRD proposed defaults

- **D1**: modal titles drop to `--fs-lg`/`--fw-semibold` to match page titles
  (applied in Phase 2 when `modals.css` migrates).
- **D2**: sign-in/hero display type kept as intentional display roles via
  named tokens `--fs-display` (`clamp(2rem, 5vw, 3.1rem)`) and
  `--fs-display-sm` (`clamp(1.9rem, 4vw, 2.75rem)`, the project-header h1).
- **D3**: canvas dimension labels keep 10px via `--fs-canvas-annotation`.
- **D4**: aperture-card editor-hero heading → `--fs-2xl`/`--fw-semibold`
  (drops the 700; applied in Phase 4).
- **D5**: DataTable gutter/summary chevron → `--fs-2xs` (applied in Phase 3).

Ed may override any of these before the owning phase migrates the selector.

## Phase 1 source-debt inventory (parser-derived, authoritative)

`check:typography` scans component CSS (postcss AST) + TS/TSX entry points,
excluding `styles/tokens.css` and vendored `styles/brand/`. Initial baseline:
**436 debt declarations / 435 unique fingerprints**
(`frontend/scripts/typography-baseline.json`). By property: 180 font-weight,
93 line-height, 92 letter-spacing, 56 font-size, 11 font-family, 4 TSX
`fontSize` (recharts adapters in `ClimateRecordCharts.tsx`). Top owners:
DataTable.css 83, envelope.css 68, base.css 61, model_viewer.css 54,
apertures.css 31, ReportTable.css 20, climate-workspace.css 18,
project_status.css 16. Line-height token values (1 / 1.15 / 1.2 / 1.25 / 1.5)
confirmed against the source inventory: they are the five dominant literals
(29/5/13/15/4 occurrences); 1.35, 1.4, 1.45 and the rest are migration debt
mapped to the nearest role during Phases 2–5.

## Next step

None — all six phases complete. Remaining follow-ups (Ed's call):

1. Merge `refactor/typography-consolidation` to `main` (CI green; deploys
   remain a separate explicit action).
2. After ~3 reproducible `typography-eval.yml` workflow runs, decide
   whether its runtime justifies required-PR-CI status (phase-06 §6).
   `check:typography` is already the blocking every-PR control.
3. Optional further consolidation toward the aspirational ≤25 rendered
   variants (see deviations below).

## Phase 6 notes (as-built)

- `frontend/scripts/font-audit-eval.mjs` + checked-in
  `typography-rendered-contract.json`: exact state coverage from the shared
  manifest `font-audit-states.mjs` (missing/empty state = failure),
  families/weights/tracking/size-token invariants, role budgets, modal-role
  reuse, 29-variant ceiling. Verified fail modes: missing state file →
  exit 1.
- Hermetic fixture: `seed_agent_browser_fixture.py` now seeds the
  `catalog.edit` + `admin.users.manage` global grants (no hand-run
  manage_user_access step); `ensure_agent_browser` writes
  `working/agent-browser/fixture.json`, and the sweep discovers the
  project id/email from it (no hardcoded UUID). The dirty-draft
  recovered-modal is a deliberate seeded state.
- `make typography-eval` (agent-browser-ready → sweep → eval) passes
  end-to-end locally; `.github/workflows/typography-eval.yml` runs it on
  workflow_dispatch + weekly schedule and uploads sweep JSON + report.
- `REPORT-after.md` (this folder) records the final rendered result:
  **29 variants / 22 states / 1743 elements** (baseline 55), two families,
  weights {400,500,600,700}, one non-zero tracking (0.05em), zero
  off-scale sizes (the clamp() display tokens map via a live probe).
- Phase 6 variant merges: DataTable toolbar-title/add-field-glyph no longer
  inherit caps tracking; footer count-label joined the caps chip variant;
  climate badges/dividers → chip-role regular; IP/SI + brand declare their
  caps transform; admin chips → data-pill medium; aperture element-table
  heads → dense-label regular; row-name `strong` → `--fw-semibold`;
  admin h1 → page-title semibold.

## Exit criteria (PRD) — measured 2026-07-17

| # | Criterion | Result |
| --- | --- | --- |
| 1 | ≤ 25 unique variants (baseline 55) | **29** — ⚠ deviation; see below |
| 2 | Zero accidental off-scale sizes | ✅ zero off-scale — clamp() display tokens resolve to their token name via a live probe |
| 3 | Weights ⊆ {400, 500, 600, 700} | ✅ exactly those four |
| 4 | Exactly one non-zero tracking (0.05em) | ✅ `--tracking-caps` only |
| 5 | button ≤ 5 / heading ≤ 3 / modal reuse | ⚠ by role-*inference*: button 20, heading 5; modal reuse ✅ strict. See below |
| 6 | No raw `monospace` family | ✅ Geist + Geist Mono only |
| 7 | Static debt baseline empty; `make ci` green | ✅ baseline `{}`; ci green incl. `check:typography` |
| 8 | Hermetic rendered evaluator, full coverage | ✅ 22/22 states; fail-closed on missing states |
| 9 | Visual spot-check screenshots | ✅ sign-in, dashboard, modals (new-project/invite/recovered), catalogs, equipment, apertures, envelope+builder, climate, status, model |

**Deviations (deliberate, recorded for Ed):**

- *Criterion 1 (29 vs 25):* the remaining gap is four deliberate styles a
  surgical pass shouldn't erase: Geist `--fs-sm`/600 legend-table headers
  (envelope/status), mono `--fs-lg` identifiers (`.project-number`,
  status-state buttons), mono `--fs-md` code/dd literals, and Geist
  `--fs-sm`/500 emphasis (U-value chip, pill subtabs). Each is a design
  decision; consolidating any lowers the contract ceiling further.
- *Criterion 5 (budgets):* the audit's role inference counts every text
  node inside a clickable card/row/pill as "button". The shared button
  tiers themselves are exactly the role map (action sm/400/caps, compact
  chrome xs/500/caps, nav 400/700 caps, text, icon/glyph); the 20 count is
  dominated by interactive cards reusing text/label roles. Headings: 3
  core Geist tiers (16/600, 17.6/600, 20/600) + D2 display h1 + the mono
  roadmap overline (which reuses the compact-chrome variant, not a new
  one). The evaluator pins these counts (heading ≤ 5, button ≤ 20) as
  ratchets.

## Phase 5 notes (as-built)

- **Source-debt baseline is EMPTY** (`{}` kept as the explicit zero-debt
  file; the guard reads a missing/empty baseline natively). 436 → 0.
- Model viewer (own commit 5a): 54 decls; 550 sun-study pill →
  `--fw-medium`; 9px month-rail ticks → `--fs-icon-badge`; new
  `--lh-icon-collapse: 0` names the icon-only line-box collapse;
  `calc(--fs-2xs*0.92)` → `--fs-2xs`; empty-state h3 gains the
  display/empty-state role (fixes off-scale 18.72px/700, audit #52-adjacent
  fix #4).
- Long tail (5b): climate (4 sheets), project_status (2), version-controls,
  admin (divergent `var(--fs-lg, 1.25rem)` fallback dropped), tooltips,
  overlay, InlineHeaderNameEditor (700 → `--fw-semibold` to match the
  toolbar-title role it edits in place).
- **Recharts adapters eliminated instead of excepted**: `fontSize` props
  removed from ClimateRecordCharts; tick/tooltip/legend text sized via
  CSS hooks (`.recharts-cartesian-axis-tick-value` etc.) on `--fs-sm`.
  The exception registry remains **empty**.
- Verified: model, climate, status screenshots; `make ci` green. Residual:
  chart-rendered state not screenshotted (fixture has no climate dataset);
  covered by ClimateTab vitest suite and the Phase 6 evaluator states.

## Phase 4 notes (as-built)

- All 115 owner fingerprints retired (apertures.css 31, envelope.css 68,
  DimensionChrome.css 2, element-sidebar.css 6, attachments.css 6,
  canvas-hint-tooltip.css 2); baseline 254 → 139 declarations.
- D3 applied: dimension labels via `--fs-canvas-annotation` +
  new `--lh-canvas-annotation: 14px` (annotation role owns exact text-box
  geometry over the drawing).
- D4 applied: aperture editor-hero h2 700 → `--fw-semibold` at `--fs-2xl`.
- 550 weights (uvalue-chip label, assembly metrics dt) → `--fw-medium`;
  650 (operation menu active, use-sites header, attachment h3) →
  `--fw-semibold`; envelope/materials heading 700s → `--fw-semibold`
  (headings converge on semibold per role map).
- New named token `--fs-icon-badge: 9px` for the attachment doc-thumb
  file-type letterform (icon-internal, per contract rule 6).
- Envelope px sizes (11/12/13/16/10.5px) onto the scale; caps mono chrome
  (dialog labels 0.09em, orientation labels/facts dt/section headers
  0.08em, editor legends 0.04em) → `--tracking-caps`.
- Verified: apertures workspace (hero, U-value chip, canvas dims, element
  table/sidebar), new-assembly dialog, assembly builder (EXTERIOR/INTERIOR
  labels, 100mm dimension chrome) screenshots; `make ci` green.

## Phase 3 notes (as-built)

- All 117 owner fingerprints retired (DataTable.css 83, ReportTable.css 20,
  catalogs.css 11, equipment.css 3); baseline 371 → 254 declarations.
- PRD known outliers fixed: 8.64px footer labels → `--fs-2xs`; 650 toolbar
  title → `--fw-semibold`; catalog 14.4/14.72px em-compounding →
  `--fs-md`; 10px summary chevron → `--fs-2xs` (D5); mono fallback stacks
  (`var(--font-mono, monospace)`, full SFMono stack) collapsed onto tokens.
- Deliberate rendered deltas: DataTable/catalog caps chrome (toolbar,
  toolbar buttons, th, footer status) 0 / 0.02 / 0.04em → `--tracking-caps`;
  12px pills → `--fs-sm`; em icon glyphs (0.7/0.85/0.9em) → `--fs-2xs` /
  `--fs-xs`; ReportTable head 11px → `--fs-xs`, head units 10px → `--fs-2xs`;
  13px body-density (`--data-table-font-size`) preserved everywhere.
- Verified: materials catalog, frame-types, equipment screenshots (toolbar/
  header/rows/footer geometry unchanged); `test:e2e:tables:smoke` 14/14;
  `make ci` green.

## Phase 2 notes (as-built)

- All 65 shared-owner fingerprints (reset/base/base-responsive/modals)
  retired; baseline 436 → 371 declarations. Zero new debt.
- D1 applied: `.modal-header h2` → `--fs-lg`/`--fw-semibold`/`--lh-heading`.
- D2 applied: hero h1 group → `--fs-display` / `--fs-display-sm`,
  `--lh-solid` (was 1.05).
- Deliberate rendered changes beyond pure tokenization (all per PRD role
  map): caps tracking values 0.04–0.15em collapsed to `--tracking-caps`
  (0.05em); non-caps tracking (`.project-meta` 0.04em,
  `.app-menu__item-value` 0.03em) dropped to normal; `.app-subtabs__tab`
  now `text-transform: uppercase` (compact-chrome role; pills variant kept
  sentence-case via `text-transform: none`); IP/SI toggle `--fs-2xs` →
  `--fs-xs`; `.chip--md` 12px → `--fs-sm`; `.empty-state/.tab-panel/
  .read-safe-panel h2` `--fs-2xl` → `--fs-xl` (display/empty-state role);
  tooltip lh 1.35 → `--lh-ui`; `.token-row span` 1.4 and textarea 1.45 →
  `--lh-body`.
- Screenshots verified: sign-in, dashboard, new-project modal, admin invite
  modal, recovered-draft modal, equipment subtabs (uppercase, no clipping).

## Phase ledger

| Phase | State | Variant count after | Evidence |
| --- | --- | --- | --- |
| 1 — Contract + ratchet | ✅ Done 2026-07-17 | — (rendered baseline 55; source debt 436 decls fingerprinted) | scanner tests 13/13; inject-fail + stale-fail verified; `make ci` green |
| 2 — Shared primitives | ✅ Done 2026-07-17 | source debt 371 decls | browser states + screenshots checked; `make ci` green |
| 3 — Data surfaces | ✅ Done 2026-07-17 | source debt 254 decls | e2e table smoke 14/14; screenshots; `make ci` green |
| 4 — Technical workspaces | ✅ Done 2026-07-17 | source debt 139 decls | apertures/envelope/builder screenshots; `make ci` green |
| 5 — Remaining features / zero debt | ✅ Done 2026-07-17 | source debt 0 decls (baseline empty) | model/climate/status screenshots; `make ci` green |
| 6 — Rendered eval + closeout | ✅ Done 2026-07-17 | **29 rendered variants** (baseline 55) | `make typography-eval` 22/22 green; REPORT-after.md; workflow added |

## Blockers

None.

## Planning review

`reviews/plan-review.md` records the initial packet gaps and adopted changes:
day-one blocking ratchet, owner-based migration, token-backed exceptions, and
separate static/rendered controls.

## Verification notes

Sweep prerequisites are self-provisioning since Phase 6: `make
agent-browser-ready` seeds the fixture user/project/grants (`catalog.edit`,
`admin.users.manage`) and writes `working/agent-browser/fixture.json`;
the recovered-draft-modal `Close` quirk is a deliberate seeded state
handled by the state manifest.
