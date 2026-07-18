# Font / typography drift audit — rendered-HTML survey

- DATE: 2026-07-17
- TIME: 12:03
- STATUS: Complete (research); follow-up consolidation COMPLETE 2026-07-17 — see `planning/archive/dated/2026-07-17/typography-consolidation/` (REPORT-after.md: 55 → 29 variants)
- AUTHOR: Claude (Fable 5) with Ed May
- SCOPE: Every routed page + representative modal states, surveyed from the
  **actual rendered DOM** (computed styles), not source CSS
- RELATED: `frontend/src/styles/tokens.css` (type scale),
  `frontend/scripts/font-audit.mjs`, `frontend/scripts/font-audit-sweep.mjs`,
  `frontend/scripts/font-audit-aggregate.mjs`,
  `frontend/scripts/font-audit-lib.mjs`, `REPORT.md` (generated)

## Why

Ed observed visible drift in font styles/sizes/weights across pages, and
suspected CSS overrides were producing inconsistent rendered results that
source-reading would miss. Goal: collect every unique rendered "typography
variant" site-wide as ground truth for a later consolidation pass (buttons,
labels, dropdowns, menus, tables, headers, modals).

## Method

Three scripts under `frontend/scripts/` (same self-cleaning Playwright shape
as `agent-browser.mjs`; shared report formatters in `font-audit-lib.mjs`):

1. **`font-audit.mjs <route> [--click…] [--hover…]`** — signs in, drives to a
   page state, then walks every *visible element that directly owns text*
   (plus form controls) and reads `getComputedStyle`. Elements bucket into
   variants keyed on `family | size | weight | style | text-transform |
   letter-spacing` (tracking normalized to em). Records per variant: count,
   inferred use-case roles (`modal/` prefix inside dialogs), line-height
   ratios, colors, example class names, sample text. Maps each computed px
   size back to the type scale by reading the `--fs-*` tokens (and root
   font-size) live off the page — so the map can't drift from `tokens.css`;
   anything else is flagged OFF-SCALE.
2. **`font-audit-sweep.mjs`** — manifest of 22 page/modal states (all
   routes, all project tabs, DataTable record modal, catalog create/import,
   admin invite, status add, recovered-draft). JSON per state →
   `frontend/working/font-audit/`.
3. **`font-audit-aggregate.mjs --out REPORT.md`** — merges the JSONs into
   the site-wide report checked in next to this file.

Rerun: `make agent-browser-ready`, then from `frontend/`:
`node scripts/font-audit-sweep.mjs && node scripts/font-audit-aggregate.mjs
--out ../planning/code-reviews/2026-07-17/font-audit/REPORT.md`

Caveats / setup notes:

- Fixture: `AGENT-BROWSER` project as `codex@example.com`. The
  `catalog.edit` + `admin.users.manage` global grants are seeded by the
  fixture itself since the Phase 6 hermeticity work (2026-07-17) — no
  hand-granting or post-reset repair needed.
- Project-tab states click `Close` first: the fixture's dirty draft pops the
  "Recovered draft found" modal on every load (captured once as its own
  state).
- Not covered: `::placeholder`/pseudo-element styling, responsive
  breakpoints (fixed 1280×900 viewport), color as a variant key (colors are
  recorded per-variant but not split on), empty-table record modals for
  spaces/equipment (same shared `RecordDetailModal` shell as the covered
  catalog-materials state), 3D-canvas text in the model viewer.

## Headline findings (details in REPORT.md)

**55 unique typography variants** across 22 states (1,707 elements sampled).
Two families (Geist / Geist Mono) plus one accidental raw `monospace`.
14 distinct sizes (7 off the token scale), 6 weights (including non-standard
550 and 650), and 9 non-zero tracking values.

The good news: the 8-step `--fs-*` token scale mostly holds — the bulk of
text lands on-scale, and the biggest populations (DataTable cells/headers,
nav, tab bars) are internally consistent.

The drift, concretely:

1. **Buttons are the worst offender: 25 distinct variants** (mono vs
   proportional, 4 sizes, 3 weights, with/without uppercase+tracking). No
   discernible system separates "chrome" buttons from "content" buttons.
2. **h2 renders 5 different ways** — including `16px/650` (DataTable toolbar
   title — the only weight-650 in the app) vs `16px/600` vs `20px/600`
   (modals) vs a mono-11.52px h2. h1 is either `16px/700` or `49.6px/600`
   (sign-in). Heading hierarchy is effectively per-feature.
3. **Off-scale sizes cluster in shared chrome**, so they repeat everywhere:
   - `8.64px` DataTable footer ("Count" / status) — below the smallest token,
     on 10 pages.
   - `14.4px` / `14.72px` catalog toolbar (`.catalog-count`, toggle labels) —
     em-of-em compounding (0.9em × 1rem-ish parents), on all 5 catalog states.
   - `18.72px` empty-state h3, `49.6px` sign-in h1, `10px` chevrons/dimension
     labels, weight-550 `.aperture-uvalue-chip__label`.
4. **Tracking has no scale**: rendered text ships with nine non-zero values
   from 0.04em through 0.15em depending on component.
5. **Raw `monospace` leak**: the `<code>` element (".hbjson" on the model
   tab) gets browser-default monospace 14px — `reset.css` never assigns
   `code` a family.
6. **Modal shell is consistent** (`ModalDialog`: 20px/600 title, 14px/400
   labels/inputs, mono-12.48px uppercase actions) — but it is a *different*
   system from the pages hosting it (page h2s are 16px; modal buttons differ
   from page buttons), which is likely why modals read as "ugly"/foreign.

## Follow-up

Consolidation is COMPLETE (2026-07-17) — see
`planning/archive/dated/2026-07-17/typography-consolidation/` (REPORT-after.md: 29 variants,
zero off-scale, weights {400,500,600,700}, single 0.05em caps tracking).
The sweep is now contract-enforced via `make typography-eval` and the
scheduled `typography-eval.yml` workflow; the state manifest lives in
`frontend/scripts/font-audit-states.mjs`.
