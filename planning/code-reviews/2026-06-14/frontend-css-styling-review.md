# Frontend CSS / Styling Review

DATE: 2026-06-14
TIME: (local)

## Goal

Systematic review of **how the PH-Navigator V2 frontend handles CSS and
styling** — colors, fonts, shared layouts (data-tables, panels, chips),
and the token system — to answer three questions the owner posed:

1. Are the visual styles the user sees **consistent** across the app, or
   has "drift" crept in during development?
2. Can downstream feature authors easily **find, access, and use** the
   standard styles?
3. What, if anything, should we **re-centralize / rationalize** before
   the next wave of feature work?

This document is **review only** — no code was changed. It is the input
for a follow-on remediation plan (if we decide one is warranted).

## Method

The `frontend/src` tree was partitioned into six scopes and audited by
parallel sub-agents against a shared rubric (token drift, off-brand
colors, duplication, naming/structure, inline styles, JS-driven styling,
discoverability). Every reported "live bug" was independently
re-verified with grep before inclusion here. The six detailed scope
reports live alongside this file in [`scopes/`](./scopes/):

| Scope | Coverage | Report |
| ----- | -------- | ------ |
| A | Global token/base layer, `App.css`, `index.html`, guard scripts | [scope-A](./scopes/scope-A-global-tokens.md) |
| B | `shared/ui/data-table/**` (the 2,830-line DataTable) | [scope-B](./scopes/scope-B-datatable.md) |
| C | `shared/ui/**` primitives (report-table, dimensions, menus, modal, toggle…) | [scope-C](./scopes/scope-C-shared-ui.md) |
| D | `features/apertures`, `features/envelope`, `features/assets` (SVG/canvas) | [scope-D](./scopes/scope-D-apertures-envelope.md) |
| E | `features/model_viewer` (R3F), `features/climate` (recharts/SVG) | [scope-E](./scopes/scope-E-modelviewer-climate.md) |
| F | `project_status`, `project_document`, `equipment`, `catalogs`, `auth`, `mcp`, `projects`, `table_views` | [scope-F](./scopes/scope-F-small-features.md) |

All 13 features + the full `shared/ui` layer + the global layer were
covered.

---

## TL;DR

The **foundation is sound**: a clean three-tier CSS-custom-property
token system, a sanctioned "hex lives only in `tokens.css`" rule
enforced by a `check:hex` guard, an exemplary z-index contract, and
genuinely disciplined inline-style usage (no static design values inline
anywhere). Plain hand-written CSS, no Tailwind/CSS-in-JS/shadcn.

The **drift is real but mechanical and concentrated**, not structural.
It clusters into a handful of repeating shapes:

- **7 undefined CSS variables** are referenced in shipping code, pass CI,
  and render silently-wrong (the guards can't see them).
- **Several token scales exist but are barely adopted** — `--space-*` is
  effectively unused; there is no type-scale at all; radius and shadow
  each have 5+ competing sources.
- **Shared primitives are under-built**, so features reinvent them —
  ~12 independent chip/pill implementations; apertures and envelope are
  ~70% the same drawing UI written twice.
- **The guards give false confidence** — `check:hex` only catches `#hex`
  (not `rgb()/rgba()/hsl()/`named), never scans `.ts`, and skips
  `src/styles/**`; nothing caps `.css` size or checks that a `var()`
  resolves.
- **Discoverability is poor** — no styling README, no token catalog, no
  `shared/ui` barrel, and the shared component library is buried in a
  1,967-line `base.css` god-stylesheet with no map.

None of this is alarming, but it is exactly the kind of slow erosion the
owner suspected. A focused rationalization pass (Theme-by-Theme below)
would re-centralize it and make the standard styles easy to reach.

---

## How styling is *supposed* to work

Establishing the intended model first, because several findings are
deviations from it.

**Three token tiers:**

- **L1 — Remote brand tokens.** `frontend/index.html:7` loads
  `https://bldgtyp.github.io/bt-branding/tokens/tokens.css` at runtime.
  This is the BLDGTYP brand palette (`--accent #3E93AE`,
  `--highlight #E23489`), fonts (`--font-primary 'Outfit'`,
  `--font-table 'Geist'`, `--font-mono 'Geist Mono'`), radius, motion,
  the light/dark surface + text + border families, and a set of
  `--svg-line-*` / `--svg-fill-dot` / `--svg-text` tokens intended for
  technical line drawings. It is theme-aware via `data-theme` on
  `<html>` (hardcoded to `"light"`). Geist fonts load from Google Fonts.
- **L2 — App tokens.** `frontend/src/styles/tokens.css` (the **only**
  sanctioned home for raw hex). It *overrides* a few brand tokens —
  notably `--font-primary → Geist` (the deliberate font swap the owner
  mentioned; Outfit is not even fetched), `--bg-page`, `--radius-sm
  3px → 5px` — and *adds* the app-domain scales: spacing (`--space-1..7`),
  z-index (`--z-*`), shadows (`--shadow-elev-*`, `--phn-shadow`), control
  sizing (`--phn-*`), the DataTable tokens (`--data-table-*`), the chart
  palette (`--chart-*`), report-status colors (`--report-status-*`), the
  axis-tint cascade (`--data-table-tint-*`), and semantic
  `--phn-success/warning/danger`.
- **L3 — Feature/component CSS.** One stylesheet per feature/component,
  consuming the tiers above via `var()`. Raw hex is banned here.

**Guards (run in `pnpm check:all` / CI):** `check:hex` (no `#hex` in
feature/shared CSS+TSX), `check:z-index` (no raw integer z-index),
`check:file-sizes` (`.ts/.tsx` ≤ 500 lines), `check:feature-shape`.

**Documented intent vs. reality (context, not a defect).** `context/
UI_UX.md` §"BLDGTYP design system" and PRD §12 prescribe **Tailwind +
shadcn/ui** with theme tokens wired to the brand vars. The app is in
fact **hand-written plain CSS with no Tailwind and no shadcn**. This is
not itself a bug — but it has two consequences worth a decision: (a) the
docs are currently misleading to a new contributor, and (b) the
undefined-variable bugs in Theme 1 are *ghosts of the shadcn token
vocabulary* (`--surface`, `--border`, `--danger`, `--font-sans`,
`--text-on-accent`) that was specced but never wired up. **DECIDED
(2026-06-14): update the docs to describe the bespoke-CSS reality**;
re-platforming to Tailwind/shadcn is explicitly *not* planned.

---

## Findings by theme

Severity: **High** = visible bug / broken styling / governance hole that
lets drift ship · **Med** = consistency erosion or maintainability cost ·
**Low** = polish. Every High item below was grep-verified.

### Theme 1 — Undefined CSS variables that ship and render wrong (HIGH)

These `var(--x)` references have **zero definitions** anywhere (verified
against `src/` and the live remote brand sheet). CSS resolves them to the
initial/inherited value, so the UI is quietly wrong and CI stays green.

| Token | Used at | Symptom |
| ----- | ------- | ------- |
| `--font-sans` | `base.css:1748` (`.app-menu__item`) | Dropdown menu loses Geist → UA default font |
| `--danger` | `base.css:1770` | App-menu danger item not red → `currentcolor` |
| `--surface` | `envelope.css:932,946,951` | `color-mix()` invalidated → `.material-drift-badge` background dropped |
| `--border` | `apertures.css:1231,1370,1415,1429` | Wrong border color on aperture cards |
| `--text-on-accent` | `model_viewer.css:391` | Active lens-bar button text color undefined on accent bg |
| `--bg-input` (bare) | `apertures.css:923,1059` | Transparent input bg (base.css always uses the `, var(--bg-card)` fallback; these omit it) |
| `--shadow-popover` | `DataTable.css:965` | Has a raw fallback, so cosmetic only — **Low**, but same root cause |

**Root cause:** no guard verifies that a `var()` resolves. These are
mostly shadcn-vocabulary leftovers (see "intent vs reality").
**Fix:** correct each to its real token (`--font-sans→--font-primary`,
`--danger→--phn-danger`, `--surface→--bg-card`,
`--border→--border-subtle`, `--text-on-accent`→ a real on-accent token,
add the `--bg-input` fallback), **and** add a "var() must be defined"
check to the guard suite.

### Theme 2 — classNames referenced but defined in no stylesheet (HIGH — verify in browser)

Class strings emitted by components that no CSS rule matches → elements
render unstyled. Grep-verified (0 CSS definitions):

- `data-table-link-cell` — **7 sites** (the heat-pump equipment tables:
  `PumpsTable.tsx`, `HotWaterTanksTable.tsx`, `FansTable.tsx`,
  `ElectricHeatersTable.tsx`, `AppliancesTable.tsx`,
  `VentilatorsTable.tsx`, `HotWaterHeatersTable.tsx`).
- `import-dialog-*` — the 3 catalog import/export dialogs
  (`materials`/`glazing-types`/`frame-types`).
- `link-button` (`OptionPicker.tsx:137`), `hp-helper-text`
  (`IndoorUnitRowModal.tsx:149,171`), `hp-cascade-list` / `hp-cascade-meta`,
  `hp-option-add-trigger`.

**Fix:** define or remove each. Recommend a small "className referenced
in TSX has a matching CSS rule" lint to prevent recurrence.

### Theme 3 — Guards give false confidence (HIGH for governance)

The styling guards are good in intent but have exploitable gaps that let
the drift in Themes 4–5 ship green:

- `check:hex` matches only `#hex` — **misses `rgb()/rgba()/hsl()` and
  named colors**. Dozens slip through (`base.css:1560/1567`
  `rgb(249,250,251)`, `:1520` `color:white`, `envelope.css:339-343`
  `crimson/gold/seagreen`, `ViewerCanvas.tsx:37` `"snow"`, heat-pump
  `"slategray"`).
- `check:hex` **never scans `.ts`** — so the entire 3D viewer palette
  (`model_viewer/lib/themes.ts`, `lib/colors.ts`, ~40 hex incl.
  `VIEWER_HIGHLIGHT_FALLBACK = "#E23489"`) and DataTable's
  `OPTION_COLOR_PALETTE` (`lib/options/create.ts`) are CI-invisible.
- `check:hex` **excludes `src/styles/**`** — `base.css` uses raw
  `#ffffff` (`:657`, `:1687`) freely.
- **No `.css` size cap** — `check:file-sizes` only covers `.ts/.tsx`, so
  `DataTable.css` (2,830), `base.css` (1,967), `envelope.css` (1,467),
  `apertures.css` (1,436) grow unbounded.
- The guard is being **worked around**: `ColorCell.tsx:7`
  `PICKER_FALLBACK_COLOR = \`#${"000000"}\`` string-concatenates to dodge
  `check:hex` — a signal the rule is fighting legitimate needs.

**Fix:** extend `check:hex` to `rgb/rgba/hsl`/named + `.ts` files; add a
`.css` line cap (with the existing `@size-exception` escape hatch); add
the var()-resolves check from Theme 1. Where JS genuinely needs a color
literal, give it a sanctioned token source instead of a string trick.

### Theme 4 — Token scales defined but not adopted (MED, pervasive)

The scales exist; the code largely ignores them and hardcodes literals.

- **Spacing.** `--space-1..7` is used **essentially zero times**. ~68
  raw-px spacing declarations in the small features alone (17 distinct
  values, incl. off-grid 5/7/9/14/18/38px), ~116 more in `base.css`, and
  pervasive raw px in DataTable. `--space-6` and `--space-7` are dead.
- **Type / font-size.** **No type-scale tokens exist at all.** Result:
  ~222 raw `font-size` literals across feature/shared CSS, with ~15+
  near-duplicate values (`0.78/0.8`, `0.85/0.86`, `0.875/0.88` rem; plus
  many raw px, e.g. envelope uses raw-px font-size ~18×). The ubiquitous
  `0.72rem` "chrome label" size is an unnamed de-facto sub-token.
- **Radius.** ≥5 competing sources: brand `--radius-sm 3px` (overridden
  to 5px), `--phn-radius`, `--phn-control-radius 6px`, plus literals
  `4px` / `6px` / `7px` / `8px` / `999px` / `50%`. Inputs render 4px
  while buttons/popovers render 5–6px.
- **Shadow.** `--shadow-elev-1/2/3` are under-used (`--shadow-elev-3` is
  dead) while bespoke `rgb()` shadows proliferate: the **same**
  `0 6px 24px rgba(0,0,0,0.12)` popover shadow is copy-pasted at 6 sites
  in `DataTable.css` (185/360/605/1450/1606/2450); `model_viewer.css` has
  12 ad-hoc HUD shadows (7 distinct values); apertures/envelope/
  attachments each carry their own modal shadow recipe. *Caveat:* the
  3D HUD shadows are a legitimately tighter scale than the modal-sized
  `--shadow-elev-*` — they want a new `--shadow-hud-*` token, not a
  force-fit.
- **Motion.** `--ease` is well-adopted (good), but `--transition-base`
  (0.3s) is unused; `base.css` repeats the literal `0.16s` 22× (there is
  no `--transition-fast`), and DataTable mixes `0.1s`/`80ms`/`100ms`/
  `0.12s`.

**Fix:** add the missing scales (type-scale, `--transition-fast`,
`--radius-pill`, `--shadow-hud-*`), then mechanically sweep literals →
tokens. Delete the dead tokens (`--space-6/-7`, `--shadow-elev-3`,
`--chart-6`, `--z-overlay-hud`).

### Theme 5 — Color drift & off-brand values (MED)

- **SVG technical drawings ignore the brand's SVG tokens.** `--svg-line-*`
  / `--svg-fill-dot` / `--svg-text` exist *specifically* for line drawings
  and are used **zero times**. Apertures and envelope independently
  hardcode `rgba(0,0,0,0.5)` strokes (`apertures.css:354`,
  `envelope.css:507`) — they converged on the *same* value, which proves
  one shared token fits.
- **Named colors** off the token system: `crimson/gold/seagreen`
  (`envelope.css:339-343` canvas states), `snow` (`ViewerCanvas.tsx:37`
  3D background, theme-unaware), `slategray` (heat-pump swatch literals
  duplicated across 4 column files), `white` (`project_status.css:79`).
- **Off-brand pill color** `rgb(233,238,249)` at `DataTable.css:2622/
  2686/2720/2728` (linked-record pills) — not accent-derived, not
  theme-aware.
- **The 3D viewer has a wholly independent palette** (`themes.ts:73-103`
  four color-by palettes, `colors.ts:11-24` material/edge constants) with
  no shared logic with `--chart-*` or the brand; `VIEWER_HIGHLIGHT_
  FALLBACK` duplicates the `--highlight` literal. Two categorical
  palettes (`--chart-*` vs 3D color-by) that should share a source.
- The SVG sun-path (`climate.css:341-357`) is tokenized but borrows the
  `--chart-*` *series* hues instead of the `--svg-*` line tokens meant
  for diagrams.

**Fix:** route all SVG stroke/fill through `--svg-*`; replace named/raw
colors with tokens; unify the 3D + chart + brand palettes behind one
source of truth (a shared TS palette module, or have the viewer read the
`--chart-*`/categorical CSS vars at runtime) so 3D drift stops being
CI-invisible.

### Theme 6 — Duplication / missing shared primitives (MED — the "drift" itself)

This is the structural root of the visual inconsistency the owner felt.

- **Chips/pills/badges: ~12 independent implementations.** The
  *intended* canonical `.report-status-chip` (`ReportTable.css:172`) is
  reused in exactly **one** downstream place. Reinventions include
  `status-badge` + `date-pill` (`project_status.css:134/160`),
  `aperture-uvalue-chip` / `aperture-name-pill`, `read-only-pill`
  (`base.css:1478`), `pill-tab` (`base.css:1497`), `model-file-chip`,
  `material-drift-badge`, and `single-select-pill` / `linked-record-pill`
  (DataTable) — with 4+ different padding/radius/weight combinations.
- **Apertures ≈ Envelope: the same drawing UI built twice (~70%).**
  Info tooltip (`apertures.css:78-127` ≈ `envelope.css:280-329`, incl.
  byte-identical `rgb(87 87 87 / 94%)`), canvas toolbar (`:376-489` ≈
  `:390-498`), sidebar roster (`:156-332` ≈ `:12-166`), dimension
  input/label/delete (`:749-828` ≈ `:558-634`) — split only by class
  prefix.
- **DataTable popover-shell** — 6 near-identical surface blocks
  (`179/353/599/1444/2156/2444`).
- **model_viewer "floating HUD card"** — 4+ copies, no base class
  (drives the shadow drift in Theme 4).
- **Re-declared base primitives:** the `[data-tooltip]` tooltip is
  re-implemented in `version-controls.css:211-285` (already in
  `base.css:1424+`); `.icon-button`/`.danger-button` are re-declared in
  `project_status.css:274-290` with a silent 80% vs 82% hover drift; two
  pill/tab systems coexist in base.css (`.pill-tab` vs
  `.app-subtabs[data-variant=pills]`).
- **Catalogs hand-roll `.catalog-table`** (`catalogs.css:46-91`) instead
  of the shared `<DataTable>`.

**Fix:** extract one tokenized `.chip`/`.pill` primitive and migrate the
reinventions; extract shared drawing widgets (`shared/ui/canvas/`:
InfoTooltip, canvas-toolbar, sidebar/roster, dimension-strip) used by
both apertures and envelope; add a `.data-table-popover-surface` and a
`.model-hud-card` base; delete the re-declarations.

### Theme 7 — Architecture / structure (MED)

> ✅ **BUILT 2026-06-14** (P3, archived:
> `../../archive/css-structure-discoverability/`). One import strategy with the
> 6 double-imports removed; leaked shared CSS promoted (`.sr-only` →
> `reset.css`; panel recipe → `styles/panels.css`; `attachments.css` →
> `shared/ui/`); the `InlineHeaderNameEditor` shared→feature selectors inverted
> to a `data-reveal-edit-on-hover` opt-in; the first cascade-safe `base.css`
> split (`reset.css` + `base-responsive.css`) landed with a written split plan
> for the rest in `styles/README.md`; a `.css` line-size guard added.

- **`base.css` is a 1,967-line god-stylesheet** holding resets + the
  *entire* shared component library (buttons, pills, tabs, three menu
  systems, forms, tooltip) + page layouts + responsive — uncapped and
  undocumented as the de-facto shared home.
- **Split, partly doubled CSS import strategy.** `App.css` `@import`s 13
  sheets; `apertures.css` / `climate.css` / `model_viewer.css` /
  `attachments.css` are imported via TS at component level instead; and
  **6 sheets are double-imported** (both `@import` in `App.css` *and* TS
  import): `auth-page.css`, `catalogs.css`, `DataTable.css`,
  `equipment.css`, `project_status.css`, `version-controls.css`.
- **`attachments.css` is imported from 5 sites** across 3 features
  (assets/envelope/equipment) via `../../` paths — de-facto shared but
  filed under the `assets` feature.
- **Shared utilities leaking into feature files** (dependency inversion):
  `.sr-only` is defined in `equipment.css:1` but used by 7 files; a
  shared 11-selector panel-border recipe lives in `auth-page.css:11-25`;
  `InlineHeaderNameEditor.css:49-56` hardcodes *feature* ancestor
  selectors (`.assembly-header:hover`, `.apertures-page__header:hover`);
  `TablePrimitiveStub.tsx` couples to `DataTable.css`.

**Fix:** pick one import strategy (globals via `App.css`, feature sheets
TS-imported once each); promote genuinely-shared CSS (`.sr-only`, panel
recipe, `attachments.css`) into the shared layer; begin splitting
`base.css` into sectioned files; invert the shared→feature selector
dependencies.

### Theme 8 — Remote-dependency resilience (MED / strategic)

The owner explicitly put "the brand-token dependency itself" in scope.

- Brand `tokens.css` **and** Geist fonts are **render-blocking runtime
  fetches** (bldgtyp.github.io + Google Fonts) with **no local fallback
  and no `var()` fallbacks anywhere**. Offline, in CI, if the site is
  down, or if a brand token is renamed, `--accent` (101 uses),
  `--ease` (48 uses), and all text/border/bg tokens collapse to initial
  values — **silently**, with no build error and no guard able to catch
  it.
- A brand-side token *rename* is an undetectable breakage for this app.

**DECIDED (2026-06-14): vendor a pinned copy of the brand `tokens.css`
into the repo (with a sync script) and self-host the Geist fonts**, so
the app owns its visual contract and CI can validate it. Optionally also
add `var(--accent, #3E93AE)`-style fallbacks on the most critical tokens.

> ✅ **BUILT 2026-06-14** (P4, archived). Vendored to
> `frontend/src/styles/brand/` + `pnpm run sync:brand`; `index.html`
> dropped both remote fetches; `check-css-vars` sources its allowlist from
> the vendored file. Offline render verified (no remote requests, brand
> teal + Geist resolve locally). The optional `var()` fallbacks were not
> added — the vendored copy + guard make them redundant.

### Theme 9 — Discoverability (HIGH for the owner's goal #3)

> ✅ **BUILT 2026-06-14** (P3, archived:
> `../../archive/css-structure-discoverability/`). `frontend/src/styles/README.md`
> now provides the map — the L1/L2/L3 tier model, a token catalog, a
> shared-class catalog (which sheet owns which class), the import strategy, a
> "how to style a new feature" recipe, and the god-stylesheet split plan — and
> `frontend/src/shared/ui/index.ts` is the shared-UI barrel. The right
> token/class is no longer a grep exercise.

A new feature author has no map. There is **no** `src/styles/README`, no
token catalog, no `src/shared/ui/index.ts` barrel, and no index of which
classes live in `base.css`. Components without their own CSS (AppMenu,
AppSubTabs, AutocompleteSelect, ModalDialog, DialogActions, …) emit
class strings that resolve into `base.css` with **no pointer** telling
you so. Finding the right token/class is currently a grep exercise.

Bright spot to copy: **`shared/ui/report-table/`** is the gold standard —
co-located CSS, a barrel, and a PRD reference. It should be the template
for the whole `shared/ui` layer.

**Fix:** add `src/styles/README.md` (or `STYLING.md`) mapping L1/L2/L3,
the full token catalog with intent, the shared-class catalog, and a "how
to style a new feature" recipe; add a `shared/ui/index.ts` barrel;
propagate the `report-table/` co-located pattern.

### Theme 10 — Plan vs. reality (context)

Covered under "How styling is supposed to work" — the docs prescribe
Tailwind+shadcn; the app is bespoke CSS. **DECIDED (2026-06-14): update
the docs to match the bespoke-CSS reality** (no Tailwind/shadcn
migration). Until the docs are updated they mislead and the
shadcn-vocabulary ghost tokens (Theme 1) keep reappearing.

> ✅ **DONE 2026-06-14** (P4 + P3, archived). `context/UI_UX.md`
> §design-system + PRD §12 rewritten to the bespoke plain-CSS + 3-tier
> token reality (P4). The `context/TECH_STACK.md` tail — UI-kit +
> table-primitive rows + the design-system section — was reconciled off
> shadcn/Tailwind in **P3**
> (`../../archive/css-structure-discoverability/` §4); `UI_UX.md` now
> cross-links the `styles/README.md`.

---

## What's already good (preserve these)

- **Three-tier token layering** with a single sanctioned hex home
  (`tokens.css`) and a `check:hex` guard — the right shape.
- **Z-index contract** — fully tokenized (`--z-*`) and enforced by
  `check:z-index`. This is the model the other axes (spacing, radius,
  shadow, type) should follow.
- **DataTable axis-tint subsystem** — 14 `oklch()` tokens applied purely
  via `[data-axis-tint]` attribute selectors; JS emits subset codes,
  **never colors**. Exemplary separation.
- **Recharts** correctly consumes `--chart-*` via `var()` / a `colorVar`
  indirection — genuinely hex-free.
- **Inline-style hygiene is excellent app-wide** — every `style={{}}`
  (≈30 sites) is dynamic geometry or data-driven color passthrough
  (virtualization offsets, measured column widths, dnd transforms,
  `--option-color` injection). No static design values inline.
- **`color-mix(in oklab, …)`** used consistently to derive semantic
  tints from base tokens.
- **`report-table/`** co-located CSS + barrel + PRD reference — the
  template for `shared/ui`.

---

## Consistency scorecard

| Axis | State | Note |
| ---- | ----- | ---- |
| Z-index | 🟢 Excellent | Tokenized + enforced |
| Inline-style hygiene | 🟢 Excellent | Geometry/data only |
| Semantic/status color | 🟢 Good | Tokenized |
| Charts (recharts) | 🟢 Good | `--chart-*` via var() |
| Fonts | 🟡 Mixed | family tokenized; size never; `--font-sans` bug |
| Token governance / guards | 🟡 Mixed | real gaps (Theme 3) |
| Remote-dep resilience | 🟡 Mixed | no fallback (Theme 8) |
| Spacing | 🔴 Poor | `--space-*` unused |
| Radius | 🔴 Poor | 5+ sources |
| Shadow | 🔴 Poor | bespoke everywhere |
| Chips / pills / badges | 🔴 Poor | ~12 reinventions |
| SVG / 3D color | 🔴 Poor | off-token, independent palettes |
| Discoverability | 🔴 Poor | no map/README/barrel |

---

## Suggested remediation themes (for the follow-on plan)

Not a plan yet — a prioritized backlog to shape one. Rough effort in
parentheses.

**P0 — Correctness (DONE 2026-06-14, branch `css-p0-correctness`):**
1. ✅ Fixed the undefined-variable references (Theme 1) — `--font-sans→
   --font-primary`, `--danger→--phn-danger` (base.css); `--surface→
   --bg-card` ×3 (envelope.css); `--border→--border-subtle` ×4 +
   bare `--bg-input`→`var(--bg-input, var(--bg-card))` ×2 (apertures.css);
   `--shadow-popover`→`--shadow-elev-2` (DataTable.css); defined a real
   `--text-on-accent` token (tokens.css) for model_viewer.css:391. **The
   new guard then surfaced an 8th undefined token the manual review
   missed — `--text-strong` (11× in DataTable.css) → `--text-primary`.**
2. ✅ Defined the unstyled classNames (Theme 2) — `.link-button`
   (base.css, with the button family); `.hp-helper-text`,
   `.hp-option-add-trigger`, `.hp-cascade-list`, `.hp-cascade-meta`
   (equipment.css); `.data-table-link-cell` (DataTable.css); the
   `.import-dialog-*` stage layout (catalogs.css, covers all 3 catalog
   import dialogs).
3. ✅ Added the var()-resolves guard — `scripts/check-css-vars.mjs`,
   wired into `pnpm check:all` → CI. Flags any fallback-less `var(--x)`
   whose `--x` is not a CSS definition, a JS-set inline-style prop, or a
   brand token. *Deferred (intentionally):* extending `check:hex` to
   `rgb/rgba/hsl`/named + `.ts` + `src/styles/**`, and the `.css` size
   cap — each would turn dozens of **pre-existing** Theme 4–5 / Theme 7
   literals red, so they belong with the P1/P2 sweeps and P3 split that
   actually clean those up, not P0. (`make ci` green.)

**P1 — Re-centralize the scales (NEUTRAL CORE DONE 2026-06-14 on `main`):**
4. ✅ Added tokens `--radius-pill` (999px), `--shadow-popover`,
   `--shadow-hud-1/-2/-3`, `--transition-fast` (0.16s); deleted the two
   genuinely-dead tokens `--chart-6` and `--z-overlay-hud` (kept
   `--space-6/-7` and `--shadow-elev-3`, which the sweeps now use).
5. ✅ Ran the **visually-neutral** literal→token sweep (token value ==
   replaced literal in every case): box-shadow **15** sites (popover ×7,
   HUD ×8), border-radius **61** sites (999px→pill, 6px→control, 5px→
   `--phn-radius`), spacing **273** values → `--space-*` (only where
   *every* value in a declaration is on-grid, so no mixed literal/token
   lines). 16 files. `make ci` green; Playwright spot-check of sign-in,
   dashboard, and the Materials DataTable confirmed pixel-identical.
   *Tool:* `working/css-review/p1-sweep.mjs` (+ `analyze-values.mjs`).

   **✅ Design-dependent sweep DONE 2026-06-14 (approved, on `main`):**
   - **Spacing:** redesigned `--space-*` to a px-named **2px-base** scale
     (`--space-2 … --space-48`, `--space-8` == 8px). Migrated all 325
     old index-named refs (`--space-1`→`--space-4`, etc.) and tokenized
     294 more literals. Neutral — odd values (3/5/7px), 1px hairlines,
     and rare oddballs (22/26/96px) left as literals (no rounding).
   - **Type scale:** added an 8-step rem scale `--fs-2xs … --fs-3xl`
     (0.68/0.72/0.78/0.875/1.0/1.1/1.25/1.55). Mapped **227** font-sizes
     (46 distinct rem values → 8 tokens; 0 raw rem font-sizes left in
     CSS). Nearest-step rounding ≤0.04rem (~0.6px, imperceptible). px
     badges / 13px table body / `em` sizes left as literals; the 2
     recharts `fontSize` props in `ClimateRecordCharts.tsx` left as JS
     literals.
   - **Radius:** added `--radius-xs:4px` (swept ×42) and `--radius-md:8px`
     (×18), neutral; 3/7/9/10/12px left as literals for a later pass.
   - **Verified:** `make ci` green; Playwright confirmed catalog table +
     dashboard render pixel-identical (`working/css-review/p1b-*.png`).
     *Tool:* `working/css-review/p1-sweep-v2.mjs`.

   **Still open for a future pass (no decision blocked):** tighten the
   spacing scale (drop rarely-used steps once design-reviewed); fold the
   remaining literal radii (3/7/9/10/12px) into tokens; decide whether
   the 13px/11px px font-sizes should join the rem scale.

**P2 — Build the missing shared primitives:**
6. ✅ **Chip primitive started 2026-06-14 (on `main`).** Added a tokenized
   `.chip` primitive to `base.css` — base shell + `.chip--sm`/`--md`
   sizes + `.chip--outline`/`--interactive` variants — and migrated 4
   chips to compose it: `report-status-chip` (neutral), `status-badge`,
   `date-pill`, `material-drift-badge` (≤1px padding standardization).
   Verified: `make ci` green; Playwright before/after on the status page
   (`status-badge`) and envelope Materials filters (`report-status-chip`)
   confirmed clean (`working/css-review/chip-*.png`).
   - *Finding:* P1's tokenization had already removed most of the chip
     "drift" — the remaining classes are largely **semantically distinct**
     (interactive filter chip vs mono status label vs data-coloured table
     pill), so the win is a reusable forward-looking primitive + shell
     dedup, not collapsing them to one look.
   - *Also migrated (2026-06-14):* `read-only-pill` → `chip chip--sm`;
     `model-file-chip` → `chip chip--md chip--outline` (verified on the
     Model tab). **6 of the chip family now compose `.chip`.**
   - *Left as-is by design:* `aperture-name-pill` (canvas-positioned
     editable label), `model-loading-chip` (status banner w/ states),
     `manufacturer-column__badge` (tiny inline table tag, custom padding),
     `aperture-uvalue-chip` (metric + info-button), `pill-tab` (nav),
     data-table `single-select-pill`/`linked-record-pill` (user-coloured).
     Optional future: unify `.chip--sm` padding so all small chips match.
7. ✅ **DONE 2026-06-14 (branch `css-p2-canvas`).** Extracted the
   genuinely-shared drawing widgets: `<InfoTooltip>`
   (`shared/ui/info-tooltip/`, + `--info-tooltip-bg/-fg` tokens — kills the
   dup `rgb(87 87 87 / 94%)`), the canvas hover-hint tooltip + the canvas
   toolbar (`shared/ui/canvas/`, the latter removing a fragile apertures→
   envelope.css class borrow), and the dimension delete button
   (`DimensionChrome.css`). Each a neutral, browser-verified commit.
   *Review over-flagged the rest:* the apertures vs envelope **sidebar
   roster** (different `<li>`/`<NavLink>` interaction models + action sets)
   and the **dimension input + draft hooks** (divergent units/validation/
   width) are parallel-but-different and were left feature-specific, not
   force-merged. (M–L)
8. Route SVG color through tokens; assess the 3D palette. (M) —
   ✅ **Resolved 2026-06-14.**
   - *SVG:* apertures `--aperture-region-stroke` + envelope
     `.assembly-svg-segment` now use `var(--svg-line-heavy)` (neutral;
     first use of the brand `--svg-*` tokens). Verified.
   - *3D palette — review over-flagged this; correct action is to LEAVE
     IT INDEPENDENT.* `model_viewer/lib/themes.ts`'s color-by palettes
     (`FACE_TYPE_COLORS`, `BOUNDARY_COLORS`, `VENTILATION_AIRFLOW_COLORS`,
     `FLOOR_WEIGHTING_FACTOR_COLORS`) are **domain-standard
     Honeybee/Ladybug colors** (Outdoors `#40B4FF`, Ground `#A55200`,
     Adiabatic `#FF8080`, Surface `#008000`; standard face-type hues) —
     merging them into the generic `--chart-*` palette would break a
     convention the PH ecosystem (and honeybee_ph) relies on.
     `colors.ts` is already a centralized 3D material module with a CSS
     bridge (`resolveViewerTokens` reads `--highlight`/`--highlight-light`
     with a brand-matching fallback). No change made.
   - *Optional governance follow-up (deferred):* extend `check:hex` to
     `.ts` while exempting the sanctioned colour modules (`colors.ts`,
     `themes.ts`, data-table `lib/options/create.ts`) so future
     *accidental* hex in other `.ts` becomes visible. Separate guard task.

**P3 — Structure & discoverability (owner's goal #3) — ✅ BUILT & ARCHIVED
2026-06-14** — *built and archived at
`../../archive/css-structure-discoverability/`. The color-literal token sweep,
the `check:hex` → `rgb/hsl`/`.ts` extension, and the scale design pass were
carved out to `../../features/css-token-guard-sweep/`.*
9. ✅ **Done** — `src/styles/README.md` token+class catalog + import strategy
   + "how to style a new feature" recipe + split plan; `shared/ui/index.ts`
   barrel; the `report-table/` co-located pattern documented as the norm.
10. ✅ **Done** — one CSS import strategy (6 double-imports removed); shared CSS
    promoted out of feature files (`.sr-only`, panel recipe, `attachments.css`);
    `InlineHeaderNameEditor` selectors inverted; first cascade-safe `base.css`
    split + `.css` size guard.

**P4 — Strategic decisions (✅ BUILT & ARCHIVED 2026-06-14)** — *shipped the
same day; archived at `../../archive/css-brand-dependency-resilience/`. The
`TECH_STACK.md` reconciliation tail was handed to P3 and is now done
(`../../archive/css-structure-discoverability/`).*
11. ✅ **Done** — vendored + self-hosted the brand tokens and fonts
    (`frontend/src/styles/brand/`) with a `pnpm run sync:brand` script;
    `index.html` dropped both remote fetches; `check-css-vars` sources its
    allowlist from the vendored file (Theme 8). Offline render verified.
12. ✅ **Done** — reconciled `UI_UX.md` §design-system + PRD §12 to the
    bespoke plain-CSS reality, dropping the Tailwind/shadcn prescription
    (Theme 10); no migration. `TECH_STACK.md` tail → P3.

---

## Appendix — detailed scope reports

Full per-scope findings (every Low item, line-by-line evidence, and the
"how styling works in this module" notes) are in
[`scopes/`](./scopes/): A (global), B (DataTable), C (shared-ui),
D (apertures/envelope), E (model_viewer/climate), F (small features).
