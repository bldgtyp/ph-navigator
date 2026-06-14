# CSS Review D — Apertures + Envelope + Assets/Attachments

Scope: `frontend/src/features/apertures/**`, `frontend/src/features/envelope/**`,
`frontend/src/features/assets/**` (the SVG/canvas-heavy features).
Review only — no code modified. Citations are real `file:line`.

Files audited in full:
- `frontend/src/features/apertures/apertures.css` (1436 lines)
- `frontend/src/features/envelope/envelope.css` (1467 lines)
- `frontend/src/features/assets/attachments.css` (236 lines)
- Aperture TSX: `ApertureSvgCanvas.tsx`, `ApertureCanvasContainer.tsx`,
  `ApertureCanvasOverlay.tsx`, `Horizontal/VerticalDimensionStrip.tsx`,
  `DimensionLabel.tsx`, `ApertureNamePill.tsx`, `ApertureHitTarget.tsx`
- Envelope TSX: `AssemblySvgCanvas.tsx`, `MaterialLegend.tsx`, `lib.ts`,
  `canvas-paint.ts`, `canvas-constants.ts`, `EnvelopePage.tsx`
- Shared refs read for baseline: `styles/tokens.css`, `styles/base.css`,
  `App.css`, `shared/lib/color.ts`

---

## How styling works in this scope

Plain hand-written CSS + CSS custom properties, three token layers
(L1 remote brand at `bldgtyp.github.io/bt-branding/tokens/tokens.css`,
L2 `styles/tokens.css`, L3 feature CSS). Each feature ships one big
flat stylesheet named after the feature.

**Rendering model is correct in principle**: all geometry comes from the
backend; the frontend draws it. Both features render a technical drawing
as an absolutely-positioned **SVG layer** plus an **HTML overlay layer**
on top of a scroll/zoom stage, with **dimension strips** in CSS-grid
gutters, a floating **canvas toolbar**, a **sidebar** roster of
items, an **info tooltip** chip in the header, and **add affordance**
buttons on edges. Apertures and Envelope implement this *same* anatomy
**twice, independently**, with parallel-but-divergent class names
(`aperture-*` vs `assembly-*`/`envelope-*`).

Data-driven color is handled well: SVG segment/material fills come from
`materialColor()` → `colorToCss()` (the material's own stored hex, with a
`transparent` fallback) — legitimate domain styling, not drift.

**Three different CSS-load conventions coexist in this scope**, which
hurts discoverability:
- `envelope.css` is loaded via `@import` in `src/App.css:11` (the dominant
  app convention — 11 of the app's stylesheets are `@import`ed there).
- `apertures.css` is loaded via a component-level
  `import "../apertures.css"` in `AperturesTab.tsx:1`.
- `attachments.css` is loaded via **five** separate component-level
  `import` statements across three features (see §d).

The L1 brand ships purpose-built SVG-drawing tokens
(`--svg-line-{heavy,medium,light,faint}`, `--svg-fill-dot`, `--svg-text`)
exactly for technical line-weight drawing. **Neither feature uses any of
them** (see §a) — this is the single clearest drift in the whole scope.

CI guards (`check:hex`) ban raw `#hex` in feature CSS but do **not** catch
`rgb()`/`rgba()`/named colors, so every literal enumerated below passes CI
silently. `check:file-sizes` caps `.tsx` at 500 lines but **not `.css`**,
so the two 1.4k-line stylesheets are unbounded and unsplit.

---

## Rubric 1 — DRIFT / hardcoded values bypassing tokens

### 1a. SVG stroke/fill literals that should use `--svg-*` (see §a)
- `apertures.css:354` — `--aperture-region-stroke: rgba(0, 0, 0, 0.5)` —
  the primary SVG region stroke; should derive from `--svg-line-medium`/
  `--svg-line-heavy`. **High**
- `apertures.css` (consumed at `ApertureSvgCanvas.tsx:97,126`) — stroke
  applied as `var(--aperture-region-stroke)` / `var(--aperture-null-stroke)`.
  Indirection is good, but the resolved value is the `rgba(0,0,0,0.5)`
  literal above. `strokeWidth={0.5}` is also hardcoded inline
  (`ApertureSvgCanvas.tsx:98,127`). **Med**
- `envelope.css:507` — `.assembly-svg-segment { stroke: rgba(0, 0, 0, 0.5) }`
  — identical stroke value to apertures, but expressed as a raw literal in
  a CSS rule rather than via a token. Same line-weight, two encodings,
  zero shared token. **High**
- `envelope.css:512` — `fill: color-mix(in oklab, var(--border-subtle) 18%, white)`
  — null-material fill; the `white` term is a raw color and the role maps
  to `--svg-fill-dot`/page background. **Med**
- `envelope.css:522` — `.assembly-null-material-hatch { stroke: color-mix(... var(--border-subtle) 65% ...) }`
  — hatch line; should be a `--svg-line-faint`/`-light` derivative. **Med**

### 1b. Tooltip / shadow / backdrop literals that should use `--shadow-elev-*`
- `apertures.css:79` & `:106` — info-tooltip `background:` and arrow
  `border-color: ... rgb(87 87 87 / 94%)`. Off-token grey. **Med**
- `envelope.css:281` & `:308` — **byte-for-byte identical** info-tooltip
  `rgb(87 87 87 / 94%)`. Duplicated literal across both features. **Med**
- `apertures.css:1196` & `:1339` — modal `box-shadow: 0 20px 60px rgba(0,0,0,0.25)`
  — should be `--shadow-elev-3` (`0 24px 60px rgb(0 0 0 / 18%)`). **Med**
- `apertures.css:1181` & `:1323` — modal backdrop `background: rgb(0 0 0 / 45%)`.
  No backdrop token exists; this is hand-rolled (and diverges from
  attachments' backdrop — see 2). **Med**
- `apertures.css:1093` — dropdown `box-shadow: 0 4px 12px color-mix(... text-primary 12% ...)`
  — bespoke panel shadow, not `--shadow-elev-2`. **Low**
- `envelope.css:1347` — segment-actions menu `box-shadow: 0 6px 24px rgb(0 0 0 / 12%)`
  — yet another bespoke dropdown shadow. **Low**
- `envelope.css:1188` — input focus `box-shadow: 0 0 0 3px color-mix(... accent 18% ...)`
  re-implements the existing `--phn-focus` token
  (`0 0 0 3px color-mix(... accent 24% ...)`) at a **different opacity**.
  Textbook drift: same intent, slightly different value. **Med**
- `envelope.css:696` / `apertures.css:835` — add-button glow
  `box-shadow: 0 1px 6px color-mix(... <add> 45% ...)` — duplicated glow
  recipe across features. **Low**
- `attachments.css:118` — doc-thumb `box-shadow: 0 1px 2px rgb(15 23 42 / 0.14)`
  — slate-tinted shadow, not `--shadow-elev-1`. **Med**
- `attachments.css:196` — modal `box-shadow: 0 20px 60px rgb(15 23 42 / 0.35)`
  — same geometry as apertures' modal shadow but **slate-tinted vs
  black-tinted** → two modals, two different shadows. **Med**

### 1c. Raw `px` font-sizes (mixed with `rem` elsewhere)
- `envelope.css` uses raw-`px` font-size **18 times**: lines 200, 456,
  579, 601, 808, 918, 937, 972, 995, 1004, 1064, 1108, 1125, 1154, 1163
  (`10.5px`), 1204, 1392. Apertures uses raw px only at 310, 451 (both
  `11px` tooltip text) and otherwise `rem`. Within-scope unit drift:
  envelope is px-first, apertures is rem-first. **Med**
- `attachments.css:161` — `font-size: 7px` (doc-thumb label) — extreme
  magic value with no scale anchor. **Low**

### 1d. Raw radius / spacing literals (no token)
- Radius is `4px` / `6px` / `8px` / `999px` literals throughout both files
  instead of `--radius-sm` (5px) / `--phn-control-radius` (6px):
  e.g. `apertures.css:217,262,381,406,753,798,1190,1215,1333`;
  `envelope.css:92,135,394,411,562,598,901,957,1025,1051,1382,1413`.
  (`999px` pills are fine — there is no pill token.) **Med**
- `var(--space-*)` exists but is used **only 12 times** in `apertures.css`;
  the rest is raw px / rem padding/gap/margin. Spacing is effectively
  ad-hoc. (base.css has the same habit, so this is repo-wide.) **Low**

---

## Rubric 2 — OFF-BRAND / INCONSISTENT color & semantics

- `envelope.css:339-343` — canvas state colors are defined from **named
  CSS colors**: `crimson` (add), `gold` (paint pulse + tint), `seagreen`
  (pick ring). These bypass the brand palette entirely. The brand
  highlight is `#E23489` and apertures uses `var(--highlight-text)` for
  its add affordance (`apertures.css:356`) — so the two features signal
  "add" in **two different hues** (envelope crimson vs apertures pink
  highlight). Off-brand and cross-feature-inconsistent. **High**
- `apertures.css:1181/1323` `rgb(0 0 0 / 45%)` vs `attachments.css:185`
  `rgb(15 23 42 / 0.45)` — two modal backdrops at the same 45% opacity but
  **different base color** (pure black vs slate). Inconsistent modal
  chrome across the scope. **Med**
- UNDEFINED-TOKEN BUGS (these silently break, not merely "off-brand"):
  - `envelope.css:932,946,951` — `color-mix(..., var(--surface))`.
    `--surface` is **not defined** anywhere in `styles/` or `index.html`.
    An undefined custom property inside `color-mix()` makes the whole
    function invalid, so the `background` declaration is **dropped** — the
    `.material-drift-badge` backgrounds do not render. **High**
  - `apertures.css:1231,1370,1415,1429` — `border: 1px solid var(--border)`.
    `--border` is **not defined** (only `--border-subtle/-card/-strong`).
    These borders fall back to the initial `currentColor`-ish value, not
    the intended subtle grey — manufacturer-column + dialog-table borders
    render wrong. **High**
  - `apertures.css:923,1059` — `background: var(--bg-input)` used **bare**
    (no fallback). `--bg-input` is undefined in app/index; base.css always
    writes it as `var(--bg-input, var(--bg-card))`. Here it silently
    resolves to nothing → transparent input background. **Med**

---

## Rubric 3 — DUPLICATION that should be shared (the big one — see §b)

Apertures and Envelope independently re-implement the *same widgets*:

- **Info tooltip** (header U-value/metric explainer):
  `apertures.css:78-127` ≈ `envelope.css:280-329`. Same
  `rgb(87 87 87 / 94%)` bg, same arrow, same transition timings, same
  `min/max-width: min(316px, calc(100vw - 24px))`, same `--z-tooltip`.
  Near-verbatim duplicate ~50 lines each. **High**
- **Canvas toolbar** (floating zoom/tool strip):
  `apertures.css:376-489` ≈ `envelope.css:390-498`. Same surface
  (`color-mix(... bg-card 94% ...)`), border, `--shadow-elev-1`, 23px
  buttons, hover/pressed accent tint, `data-toolbar-tooltip` ::before/
  ::after tooltip machinery. **High**
- **Sidebar roster** (item list + row actions + collapsed rail):
  `apertures.css:156-332` ≈ `envelope.css:12-166`. Same 260px/52px
  widths, same `min-height:38px` rows, same accent-10% active tint, same
  `is-danger` row-action treatment, same `data-sidebar-tooltip` chrome
  (envelope even shares the tooltip selector list with the toolbar at
  `envelope.css:437-491`). **High**
- **Assembly/aperture header** (title + metric chips):
  `apertures.css:8-52` (`apertures-page__header` + `aperture-uvalue-chip`)
  ≈ `envelope.css:179-254` (`assembly-header` + `assembly-header-metrics`).
  Same `1.55rem/700` h2, same `48px` gap / `56px` min-height, same
  `accent 5% bg + accent 10% border` chip. **Med**
- **Dimension input/label/delete** (editable dimension):
  `apertures.css:749-828` ≈ `envelope.css:558-634`. Same input-wrap
  (`bg-card 94%`, `--shadow-elev-1`), same 26px delete button with
  `--phn-danger-bg` hover, same `aria/data error` border switch. **High**
- **Edge "add" button**:
  `apertures.css:830-880` ≈ `envelope.css:689-784`. Same 999px pill,
  same glow recipe, same `scale(1.08)` hover, same `--add-button-transform`
  pattern. **Med**
- **Modal shell** (backdrop + panel):
  `apertures.css:1178-1340` (manufacturer/drift/refresh/project-refs) all
  share one backdrop+panel recipe that also matches `attachments.css:183-202`
  conceptually — none reuse `styles/modals.css` (which exists and is
  `@import`ed at `App.css:3`). **Med**

Concrete extraction candidates (highest value first):
1. A shared **`InfoTooltip`** component + one tooltip token set
   (`--tooltip-bg`, `--tooltip-fg`) — kills the duplicated
   `rgb(87 87 87 / 94%)` in both files.
2. A shared **canvas-toolbar** stylesheet/component (`shared/ui/canvas/`)
   — the strip + button + `data-toolbar-tooltip` chrome is identical.
3. A shared **canvas sidebar/roster** component — the two sidebars differ
   only in class prefix.
4. A shared **dimension input/label** (already partially shared via
   `shared/ui/dimensions/DimensionChrome.css`; see §c) — fold both
   features' input-wrap onto it.
5. A shared **modal** path: route all four aperture modals + the
   attachment modal through `styles/modals.css` (or a `Modal` component).

---

## Rubric 4 — NAMING / STRUCTURE inconsistency

- **Class-prefix divergence for the same anatomy**: apertures uses BEM-ish
  `aperture-*__*` (e.g. `apertures-page__header`, `aperture-dim-label__value`),
  envelope mixes BEM-ish (`spec-expansion__columns`,
  `project-material-editor__field`) with flat-dash
  (`assembly-canvas-toolbar-button`, `dimension-delete-button`,
  `material-legend-swatch`). No single convention even within `envelope.css`.
  **Med**
- **Dimension naming forks**: apertures `aperture-dim-strip` /
  `aperture-dim-label` / `aperture-dim-tick`; envelope `assembly-layer-dimension`
  / `dimension-label-button` / `dimension-tick-top`; plus the shared
  `DimensionChrome.css`. Three vocabularies for one concept. **Med**
- **Uncapped file size**: `apertures.css` 1436 / `envelope.css` 1467 lines,
  flat (no `@layer`, no sub-file split, only `/* ---- Phase NN ---- */`
  comment banners). `check:file-sizes` doesn't apply to `.css`, so these
  grow unbounded. The phase-banner comments (`apertures.css:617,882,1018,
  1150,1176,1295`) are the only navigation aid. **Med**
- **Repeated inline custom-prop blocks**: `apertures.css:676-677,683-684,
  701-702,709-710` repeat `--dimension-axis-y:12px; --dimension-extension-gap:6px`
  (and `--dimension-axis-x:52px`) four times instead of declaring once on
  the strip root. **Low**

---

## Rubric 5 — INLINE STYLES in TSX

- **Justified (geometry/transform — keep):**
  - `ApertureCanvasContainer.tsx:362` `style={{ width: '${pxW}px', height: '${pxH}px' }}`
  - `Horizontal/VerticalDimensionStrip.tsx:44,81 / 41,76` width/height/left/top px
  - `ApertureCanvasOverlay.tsx:182,217` `elementStyle()` / `insertButtonStyle()`
    (defined `ApertureCanvasOverlay.tsx:237,254`) — pure rect geometry from
    mm→px math.
  - `ApertureNamePill.tsx:57,85`, `ApertureHitTarget.tsx:41`,
    `DimensionLabel.tsx:77,82,125` — positioning transforms.
  - `MaterialLegend.tsx:70` `style={{ background: materialColor(material) }}`
    and `AssemblySvgCanvas.tsx:75,115` `fill={materialColor(...)}` — these
    are **data-driven** (the material's own stored hex); correct to be
    inline. **Not a finding.**
- No static color/font/spacing found hard-coded in `style={}` props in any
  of the three features. Inline-style hygiene is **good**. (assets has 0
  inline styles.)

---

## Rubric 6 — JS-DRIVEN STYLING

- Color computed in TS is limited to `materialColor()` →
  `colorToCss()` (`envelope/lib.ts:62`, `shared/lib/color.ts`), which is
  **data**, not theme — appropriate.
- SVG stroke is applied as a CSS-var string from TSX in apertures
  (`ApertureSvgCanvas.tsx:97,126`) — this is fine *as a mechanism*; the
  problem is the token it points to (§1a), not that TS sets it.
- No off-brand palette is synthesized in JS. **No finding beyond §1a.**

---

## Rubric 7 — DISCOVERABILITY

- **Three CSS-load conventions** (`@import` in App.css vs
  component-level import vs five-site import — see "How styling works").
  A new contributor cannot predict where a feature's CSS is wired in.
  **Med**
- **No shared "canvas/drawing UI" home.** Because apertures and envelope
  each own a 1.4k-line monolith, there is no obvious place to *find* the
  canonical tooltip / toolbar / dimension / modal pattern — so the next
  SVG feature will copy a third time. **Med**
- The **`--svg-*` brand tokens are effectively undiscovered** — they ship
  for this exact purpose and zero feature code references them. **Med**
- Undefined tokens (`--surface`, `--border`, bare `--bg-input`) pass CI
  and render silently-wrong, so drift here is invisible until inspected in
  a browser. **(severity captured in Rubric 2.)**

---

## §a — SVG drawing styling (special task)

The brand ships `--svg-line-heavy/-medium/-light/-faint`, `--svg-fill-dot`,
`--svg-text` specifically for technical SVG line-weights. **Usage count
across the entire scope: 0.** Every SVG stroke/fill is hand-rolled:

| Where | Literal | Should be |
|---|---|---|
| `apertures.css:354` (`--aperture-region-stroke`) | `rgba(0,0,0,0.5)` | `--svg-line-medium`/`-heavy` |
| `apertures.css` null stroke (token at :355) | `color-mix(... text-secondary 60% ...)` | `--svg-line-light`/`-faint` |
| `ApertureSvgCanvas.tsx:98,127` | `strokeWidth={0.5}` (inline) | a px constant / token |
| `envelope.css:507` | `stroke: rgba(0,0,0,0.5)` + `stroke-width:0.5` | `--svg-line-medium` |
| `envelope.css:512` | `fill: color-mix(... border-subtle 18%, white)` | `--svg-fill-dot`/page bg |
| `envelope.css:522` | hatch `stroke: color-mix(... border-subtle 65% ...)` | `--svg-line-faint` |

Note both features picked the **same** `rgba(0,0,0,0.5)` + `0.5` stroke
width — strong evidence they should share one `--svg-line-*` token rather
than two literals. This is the prime drift example in the scope.

## §b — Cross-feature duplication (special task)

See Rubric 3. The two features are ~70% structurally identical drawing
UIs split only by class prefix. Five concrete shared-extraction
candidates listed there; top three (InfoTooltip, canvas-toolbar,
sidebar/roster) would each remove ~50-180 duplicated lines per feature
and collapse the duplicated `rgb(87 87 87 / 94%)` / shadow literals to one
place.

## §c — Local dimension strips vs `shared/ui/dimensions/DimensionChrome`

`DimensionChrome.css` already exists and is `@import`ed at `App.css:4`,
and both features set `DimensionChrome`-style vars locally
(`--dimension-axis-x`, `--dimension-axis-color`, `--dimension-extension-gap`,
`--dimension-extension-reach-x`) — apertures at `apertures.css:676-714`,
envelope at `envelope.css:536-539`. So a shared dimension primitive is
partly adopted, but each feature *also* re-styles its own input-wrap /
label / delete-button (`apertures.css:749-828`, `envelope.css:558-634`)
rather than getting them from the shared module. There is real
overlap-plus-divergence: the chrome variables are shared, the
interactive controls are forked. (DimensionChrome itself is another
agent's scope; flagged here only as the convergence target for §b item 4.)

## §d — `attachments.css` multi-import (special task)

`attachments.css` lives under `features/assets/` but is imported by **five
component files across three features**:
- `assets/components/AttachmentTablePanel.tsx:1`
- `assets/components/AttachmentCell.tsx:1`
- `assets/routes/EnvelopeAttachmentsTab.tsx:1`
- `envelope/routes/EnvelopePage.tsx:7` (`../../assets/attachments.css`)
- `equipment/routes/EquipmentPage.tsx:1` (`../../assets/attachments.css`)

It is therefore a de-facto **shared** stylesheet whose classes
(`.attachment-cell`, `.attachment-modal`, `.attachment-thumb`) are used by
non-asset features, but it is filed under one feature and reached by
fragile `../../` relative imports. Recommendation: **promote to a shared
location** (e.g. `shared/ui/attachments/attachments.css`) and either
(a) `@import` it once in `App.css` like the other shared stylesheets, or
(b) keep a single co-located component import — but pick **one** of the
app's conventions instead of five scattered cross-feature imports. While
moving it, fix its three slate-tinted shadow/backdrop literals
(`attachments.css:118,185,196`) to the `--shadow-elev-*` tokens.

---

## Top 5 highest-impact fixes

1. **Adopt the `--svg-*` brand tokens for all SVG stroke/fill** in both
   features (`apertures.css:354-355`, `ApertureSvgCanvas.tsx:97-98,126-127`,
   `envelope.css:507-524`). Replaces the duplicated `rgba(0,0,0,0.5)` /
   `0.5` line-weight with the tokens that exist precisely for this. Fixes
   the #1 drift and makes line-weights theme-aware.
2. **Fix the silent undefined-token bugs**: `--surface`
   (`envelope.css:932,946,951` → `--bg-card`), `--border`
   (`apertures.css:1231,1370,1415,1429` → `--border-subtle`), and bare
   `--bg-input` (`apertures.css:923,1059` → `var(--bg-input, var(--bg-card))`).
   These currently render wrong/transparent and pass CI.
3. **Extract the shared drawing widgets** — InfoTooltip, canvas-toolbar,
   sidebar/roster — into `shared/ui/canvas/` (Rubric 3 / §b). Collapses
   ~3 verbatim-duplicated blocks and the duplicated `rgb(87 87 87 / 94%)`
   tooltip literal into one place; gives the next SVG feature a home so it
   stops copy #3.
4. **Token-ize shadows, focus ring, and the modal backdrop**: route modal
   shadows to `--shadow-elev-3` (`apertures.css:1196,1339`,
   `attachments.css:196`), the input focus ring to `--phn-focus`
   (`envelope.css:1188`), and add a single `--backdrop` token to unify
   `rgb(0 0 0 / 45%)` vs `rgb(15 23 42 / 0.45)`
   (`apertures.css:1181,1323` vs `attachments.css:185`).
5. **Replace named colors + unify the "add" hue**: `envelope.css:339-343`
   `crimson`/`gold`/`seagreen` → brand-derived tokens, and make the
   envelope "add" affordance use the same `--highlight-text` hue as
   apertures (`apertures.css:356`) so "add" reads identically across
   features. Promote `attachments.css` to `shared/` while here (§d).

---

## Reusable patterns / good practices present

- **Data-driven color is done correctly**: `materialColor()`/`colorToCss()`
  keep material fills as domain data with a safe `transparent` fallback;
  inline `style`/`fill` for these is the right call.
- **Inline styles are geometry-only** — every `style={}` in the three
  features is mm→px math or a positioning transform; no static
  color/font/spacing leaked into TSX (assets has none at all).
- **Apertures applies SVG stroke via CSS variables from TSX**
  (`ApertureSvgCanvas.tsx:97,126`) — the right *mechanism* (themeable),
  just pointed at the wrong (literal) token. The fix is one token swap,
  not a refactor.
- **`color-mix(in oklab, var(--accent) N% ...)` for hover/active tints** is
  used consistently and keeps most interactive states token-anchored.
- **z-index and `--ease`/transition tokens are used consistently** — no raw
  z-index ints, transitions go through `var(--ease)`.
- **Partial adoption of `shared/ui/dimensions/DimensionChrome`** shows the
  team already knows how to share a drawing primitive; §b/§c just need to
  finish the job for the input/label/toolbar/tooltip controls too.
