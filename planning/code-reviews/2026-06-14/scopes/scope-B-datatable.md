# CSS/Styling Review — Part B: DataTable shared component

Scope: `frontend/src/shared/ui/data-table/**`
Reviewer pass: read-only audit. All citations are real `file:line`.

## How styling works in this scope

The DataTable is the single largest styling surface in the app: one
2830-line stylesheet (`DataTable.css`) plus ~70 component `.tsx`/`.ts`
files. The architecture is consistent with the app's 3-layer token model:

- **L3 consumption.** Almost all of `DataTable.css` paints through
  `var(--…)` references: `--bg-card`, `--text-primary/-secondary/-muted`,
  `--border-subtle/-card/-strong`, `--accent`, `--accent-text`,
  `--phn-radius` (→ `--radius-sm`), `--phn-danger/-warning`, `--z-*`,
  and the DataTable-specific tokens (`--data-table-font-size`,
  `--data-table-row-height`, `--data-table-header-height`,
  `--data-table-cell-padding-x`, `--data-table-header-padding-x`).
- **Local component tokens.** The stylesheet defines its own scoped
  variables on `.data-table-wrap` / `.data-table td` for derived values
  (`--data-table-gutter-width`, `--data-table-row-hover-bg`,
  `--data-table-cell-block-selected-bg`, selection-edge shadows). This is
  good practice — derived colors are computed once with `color-mix()` and
  referenced, not repeated.
- **Axis-tint cascade.** The filter/sort/group tint system is exemplary
  (see §c below): all 14 hues live in `tokens.css`
  (`--data-table-tint-*`), the CSS paints them via `[data-axis-tint]`
  attribute selectors (DataTable.css:1659–1715, 155–165), and the only JS
  involved emits subset *codes* (`"f"`, `"fsg"`), never colors
  (`tokens/data-table-tints.ts`).
- **Inline styles** in the TSX are uniformly justified dynamic geometry:
  virtualization spacer heights, measured column widths, group-depth
  indents, and `--option-color` CSS-variable passthroughs for
  user-authored option colors (see §d).

The drift that exists is concentrated and mechanical, not structural:
(1) `rgb()/rgba()` literals that the `check:hex` guard cannot see because
its regex is hex-only; (2) one off-token brand color hardcoded as
`rgb(233, 238, 249)`; (3) one JS hex palette in a `.ts` file the hex
guard does not scan; (4) ~77 raw `rem`/`px` font-sizes and pervasive raw
`px` spacing instead of `--space-*`; (5) the file is uncapped and should
be split. None of this is on-fire, but all of it is the kind of
low-friction drift the owner wants closed and made discoverable.

---

## Findings by rubric

### 1. Drift / hardcoded values bypassing tokens

**Duplicated raw popover shadow (highest-volume drift).**
`box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12)` is copy-pasted **6×** across
every dropdown/popover surface:
- `DataTable.css:185` — `.data-table-view-popover` (Filter/Sort base) — High
- `DataTable.css:360` — `.data-table-column-menu` — High
- `DataTable.css:605` — `.data-table-overflow-menu` — High
- `DataTable.css:1450` — `.data-table-header-description-tooltip` — High
- `DataTable.css:1606` — `.data-table-field-editor-color-picker` — High
- `DataTable.css:2450` — `.data-table-hide-fields-panel` — High

A `--shadow-elev-2` (`0 18px 40px …`) and `--phn-shadow` token already
exist in `tokens.css:56,58`, and `.room-option-popover` (DataTable.css:2245)
already uses `var(--phn-shadow)` — proving the pattern. The other six
should consume a shared token. Either reuse `--phn-shadow` or add a
`--shadow-popover` token (which DataTable.css:965 already *references with
a fallback* but is **never defined**, see below).

**Other raw `rgba()` shadows / overlays** (escape `check:hex` because the
guard is hex-only):
- `DataTable.css:638` & `952` — `background: rgba(0, 0, 0, 0.45)` modal
  scrims (two near-identical overlay rules; should be a token) — Med
- `DataTable.css:654` — `0 12px 32px rgba(0, 0, 0, 0.2)` alert dialog — Med
- `DataTable.css:965` — `var(--shadow-popover, 0 10px 32px rgba(0,0,0,0.18))`
  — references an **undefined token**; falls back to a raw value — Med
- `DataTable.css:2037` — `0 12px 28px rgba(0, 0, 0, 0.16)` color editor — Med
- `DataTable.css:2163` — `0 10px 24px rgba(0, 0, 0, 0.15)` single-select
  popover — Med
- `DataTable.css:2753` — `0 12px 32px rgba(0, 0, 0, 0.18)` linked-record
  picker — Med
- `DataTable.css:1533` — `background: rgba(0, 0, 0, 0.05)` refcount chip — Low
- `DataTable.css:1589` — `color: rgba(0, 0, 0, 0.6)` color-circle glyph — Low
- `DataTable.css:2010` — `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.35)`
  swatch inner highlight — Low

Five distinct elevated-shadow recipes (`6px 24px`, `12px 32px`,
`12px 28px`, `10px 24px`, `10px 32px`) for what are really three tiers
(menu, dialog, modal). `tokens.css` only ships `--shadow-elev-1/-2/-3`;
the DataTable invented its own ladder. Consolidating to the three elev
tokens would remove all of the above. — Med (as a group)

**Raw `rem`/`px` font-sizes instead of tokens.** 77 `font-size:` lines
use literal values (`0.72rem`, `0.78rem`, `0.8rem`, `0.85rem`, `13px`,
`12px`, `9px`, `10px`, etc.). Only the grid body and header correctly use
`--data-table-font-size` / `--data-table-header-font-size`
(DataTable.css:694,1061). Examples of un-tokenized sizes:
`DataTable.css:138-ish region`, `0.72rem` recurs ~15× for chrome text;
`single-select-pill` uses raw `font-size: 13px` (2138) while the grid
body uses the `--data-table-font-size` token whose value is also 13px —
so the pill silently duplicates the token's value. The
`0.72rem` uppercase-chrome size is a de-facto sub-token used everywhere
(toolbar, popover subheadings, hints, conjunctions) with no name. — Med

**Raw `px` spacing instead of `--space-*`.** The `--space-1..7` scale
(4/8/12/16/24/32/48) exists in `tokens.css:47-53` but `DataTable.css`
uses literal `px` paddings/gaps/margins almost everywhere
(`gap: 8px`, `padding: 12px`, `padding: 8px`, `margin-bottom: 10px`,
`padding: 16px/20px`, etc.). Many of these literals (`8px`, `12px`,
`16px`, `4px`) exactly equal `--space-2/-3/-4/-1`, so they are
shadow-duplicating the scale rather than consuming it. Representative:
`DataTable.css:47,53,183,650,966,2038,2246`. — Med (pervasive, low-risk)

**Raw `border-radius` literals** instead of `--phn-radius` /
`--phn-control-radius`:
- `4px` recurs ~20× (`810,832,897,913,964,1384,2053,2062,2071,2116,…`) —
  these predate / bypass `--phn-radius` (5px) and `--phn-control-radius`
  (6px). The inconsistency means inputs render at 4px while buttons/
  popovers render at 5–6px. — Med
- `6px` literal radius at `133,964,1016,2035,2160,2621,2654` — should be
  `--phn-control-radius`. — Low
- `8px` literal radius at `964,2752` (modal/picker) — Low
- `3px` literal radius at `1170,1232,1916,2009,2677,2719` — matches
  `--radius-sm` (remote, 3px) but written raw. — Low
- `999px` pill radius is fine (intentional full-round).

**Raw `transition` timing.** The remote brand ships
`--transition-base: 0.3s ease` and `--ease`. DataTable uses raw timings:
`transition: opacity 0.1s ease-out` (`339,448,2404`),
`transition: opacity 80ms ease` (`1927`),
`animation: … 1.5s ease-out` (`2585`),
`animation: … 0.8s linear` (`2823`). Mixed `0.1s`/`80ms`/`100ms` units
for the same "quick reveal" intent. — Low

**Hardcoded `font-family` fallbacks.** Several rules write
`var(--font-mono, monospace)` (2017,2097) and `var(--font-primary,
inherit)` (187,365,607,1452,2452) with literal fallbacks. The fallback
literal is harmless but the `inherit` fallback subtly differs across
call sites (some popovers fall back to `inherit`, others have no
fallback). — Low

### 2. Off-brand / inconsistent color & semantics

**Hardcoded linked-record pill color `rgb(233, 238, 249)` (off-token,
brand-bypassing).** Used 4× and not defined as any token:
- `DataTable.css:2622` — `.data-table-linked-record-pill` background — High
- `DataTable.css:2686` — unlink hover (`color-mix … rgb(233,238,249)`) — High
- `DataTable.css:2720` — `.data-table-linked-record-add` background — High
- `DataTable.css:2728` — add hover — High

This is a pale-blue that is *not* derived from `--accent` (#3E93AE) and
is not theme-aware — it will not flip in a future dark theme and does not
match the rest of the grid's accent-tinted chips (e.g. single-select pill
at 2135 uses `color-mix(… var(--accent)…)`). It evades `check:hex`
because it is `rgb()` not `#hex`. Should become a token
(e.g. `--data-table-linked-record-bg`) derived from `--accent` like the
other chips. — High

**JS color palette duplicating brand intent.**
`lib/options/create.ts:4-11` hardcodes a 6-entry hex palette
(`#3b82f6 #10b981 #a16207 #7c3aed #0f766e #be123c`) + fallback `#6b7280`
(line 27), exported as `OPTION_COLOR_PALETTE` and rendered as swatch
backgrounds. These are *intentionally* arbitrary categorical option
colors (user picks one per select-option), so being literal is defensible
— BUT (a) they live in a `.ts` file, which `check:hex` does **not** scan
(guard only walks `.css`/`.tsx`, scripts/check-hex.mjs:30), so this is an
unguarded blind spot, and (b) none of these six match the existing
`--chart-1..6` categorical palette in `tokens.css:25-30`, which is the
app's *other* categorical palette. Two divergent categorical palettes
exist. Consider unifying option colors onto `--chart-*` (or at minimum
documenting why they differ). — Med

### 3. Duplication that should be shared

- **Popover shell.** Six popover/menu surfaces repeat the same recipe
  (`background: var(--bg-card)` + `border: 1px solid var(--border-card)`
  + `border-radius: var(--phn-radius)` + the raw shadow +
  `z-index: var(--z-dropdown)` + `font-family` + `font-size: 0.78–0.8rem`):
  `.data-table-view-popover` (179), `.data-table-column-menu` (353),
  `.data-table-overflow-menu` (599), `.data-table-header-description-tooltip`
  (1444), `.data-table-hide-fields-panel` (2444),
  `.single-select-popover` (2156). A single `.data-table-popover-surface`
  base class (or a shared `%popover` set of declarations) would collapse
  ~6 near-identical blocks and guarantee the shadow/radius/z-index stay in
  lockstep. This is the highest-value de-duplication and the pattern most
  likely to be reinvented by other features. — High
- **Modal scrim.** `rgba(0,0,0,0.45)` overlay duplicated at 638 & 952. — Med
- **Centered-dialog positioning.** The `position: fixed; top:50%;
  left:50%; transform: translate(-50%,-50%)` block repeats at 644–646,
  958–960, 2741–2743. — Low
- **Hover-tint recipe.** `color-mix(in oklab, var(--text-primary) 6%,
  transparent)` for "quiet hover" recurs ~10× (130,385,531,627,2391,
  2488,2573, etc.) — a candidate for a `--data-table-hover-tint` local
  token. — Low

### 4. Naming / structure inconsistency

- **`DataTable.css` is 2830 lines and uncapped.** `check:file-sizes`
  caps `.ts/.tsx` at 500 lines but does not check `.css`
  (scripts/check-file-sizes.mjs). This is by far the largest stylesheet in
  the app and should be split (see §a). — Med
- **Undefined tokens referenced via fallback.** `--shadow-popover`
  (965) and (depending on remote brand) `--accent-light` (5) are not in
  the local `tokens.css`. `--accent-light` *is* used by other features
  (project_status.css:34,146; model_viewer.css:106,193,386,441) so it is
  almost certainly defined in the remote brand bundle — fine. But
  `--shadow-popover` is referenced exactly once, nowhere defined, and
  silently falls back to a raw shadow — dead-token smell. — Med
- **`!important` cluster** in the cell-selection system: 175,177,
  1820–1849 (selection / active / error backgrounds and box-shadows).
  These are arguably justified — they must beat the row-hover and
  axis-tint background rules in a fixed specificity war — but they are a
  fragility hotspot and worth a one-line comment explaining the
  precedence intent (the surrounding comments explain *what* but not
  *why `!important`*). — Low
- **Hardcoded checkmark geometry** (`1.5px` borders, `scale()` transforms
  at 1181–1193) for the custom checkbox — fine, but `1.5px` is a magic
  number repeated. — Low

### 5. Inline styles in TSX

Every `style={{}}` in the data-table TSX files (non-test) is justified
dynamic styling — none is static color/font/spacing that belongs in CSS:

| file:line | style | verdict |
|---|---|---|
| `DataTable.tsx:1442` | `{ width: \`${width}px\` }` on `<col>` | **Justified** — measured/resizable column width |
| `components/GridBody.tsx:257` | `{ height: paddingTop }` | **Justified** — virtualization top spacer |
| `components/GridBody.tsx:258` | `{ padding: 0, border: 0 }` | Justified-ish — static reset on the spacer `<td>`; could be a `.data-table-virtual-spacer` class, but trivial |
| `components/GridBody.tsx:480` | `{ height: paddingBottom }` | **Justified** — virtualization bottom spacer |
| `components/GridBody.tsx:481` | `{ padding: 0, border: 0 }` | Same as 258 |
| `components/GroupHeaderRow.tsx:64` | `{ paddingLeft: \`${indent}px\` }` | **Justified** — group-depth indent (computed) |
| `components/GroupHeaderRow.tsx:103` | `{ "--option-color": option.color }` | **Justified** — user color → CSS var |
| `components/ColorCell.tsx:15` | `{ background: normalized }` | **Justified** — renders the user's literal color value |
| `components/ColorCell.tsx:103` | `{ background: normalized }` | **Justified** — color preview swatch |
| `components/FieldConfigSectionOptions.tsx:361` | `{ "--option-color": color }` | **Justified** — user color → CSS var |
| `components/FieldConfigSectionOptions.tsx:383` | `{ "--option-color": swatch }` | **Justified** — palette swatch color |
| `components/FilterPopover.tsx:283` | `{ "--option-color": option.color }` | **Justified** — user color → CSS var |
| `components/SingleSelectPopover.tsx:158` | `{ "--option-color": option.color }` | **Justified** — user color → CSS var |

Verdict: **clean.** The `--option-color` CSS-variable passthrough is the
correct pattern (color decided in JS, painted in CSS via
`var(--option-color, …)` fallbacks at DataTable.css:1587,1615). The only
nit is the two static `{ padding: 0, border: 0 }` spacer resets which
could be a class. — Low

### 6. JS-driven styling

- `lib/options/create.ts:4-27` — the hex palette (covered in §2). The
  only color constants in JS. — Med
- `components/ColorCell.tsx:7` — `PICKER_FALLBACK_COLOR = \`#${"000000"}\``
  — a deliberate guard against `check:hex` (string concatenation to avoid
  a literal `#000000` token). It works, but it is a code smell that
  signals the guard is being *worked around* rather than satisfied;
  `ColorCell` is a `.tsx` so a plain `#000000` would trip the guard. A
  named token (`--color-black` / `#000`) or a comment would be cleaner.
  Note: this is a *fallback for the user's own color value*, so it is not
  brand styling — defensible, but worth a comment. — Low
- `hooks/useGridColumnResize.ts:269` — builds a CSS `font` shorthand
  string from *computed* style for canvas text measurement (autosize).
  This reads the live computed font, it does not hardcode one — correct
  and necessary for measure-to-fit. — Not a finding (good).

### 7. Discoverability

- **No README / usage doc** anywhere under `data-table/` (confirmed: no
  `*.md` in the tree). A consumer reusing `<DataTable>` has only the
  `index.ts` barrel (115 lines of exports) and the prop types to go on.
  The barrel is thorough for *API* but says nothing about *styling* — how
  to theme, which tokens to override, that `DataTable.css` must be
  imported, or that the page-chrome height is tunable via
  `--data-table-page-chrome` (DataTable.css:15). — Med
- **The CSS is self-documenting on *behavior*** (excellent inline
  comments referencing PRD sections, AirTable walks, and dates), but not
  on *theming surface*. There is no single place that lists the tokens a
  host can override (`--data-table-page-chrome`, `--data-table-gutter-width`,
  the `--data-table-*` sizing tokens). — Med
- **`tokens.css` is the discoverability win.** All DataTable sizing and
  tint tokens are centralized there with good comments — a downstream
  author *can* find them, but only if they know to look in
  `src/styles/tokens.css` rather than in the component. — note.

---

## Special tasks

### a) Should `DataTable.css` (2830 lines) be split? How?

**Yes.** It is the only stylesheet large enough to be a navigation
problem, and the size guard does not cover `.css`. It decomposes cleanly
into ~10 well-bounded sections that already exist as contiguous blocks
(line ranges approximate):

1. **Shell / wrap / scroll container** — 1–42
2. **Toolbar** (status chips, action buttons, axis buttons) — 44–176
3. **View popovers** (Filter / Sort / Group shared surface, rules,
   selects, inputs, disclosure) — 178–595
4. **Column menu / overflow menu / alerts** — 597–674, 1459–1466
5. **Add-row / add-field / tail cell** — 699–947
6. **Field-config modal** — 949–1033
7. **Core table: th/td, gutter, header row, frozen columns, cell
   content** — 1035–1466, 1728–1772
8. **Field editor popover** (options list, color picker) — 1468–1657
9. **Axis-tint cascade** (the `[data-axis-tint]` rules) — 1659–1715
10. **Selection / active / fill / chevron** (cell-state chrome) — 1774–1964
11. **Cell editors + ColorCell + single-select pill/popover + room
    options** — 1966–2299
12. **Summary bar** — 2300–2428
13. **Hide-fields panel** — 2430–2579
14. **Row-focus flash + linked-record cell/pill/picker** — 2581–2830

Recommended split: a `data-table/styles/` folder with
`table.css` (1,7), `toolbar.css` (2,9), `popovers.css` (3,4,8),
`schema.css` (5,6), `cells.css` (10,11), `summary.css` (12),
`hide-fields.css` (13), `linked-record.css` (14), barrel-imported by a
top-level `DataTable.css` (or imported by the components that own them).
Splitting also makes the popover-surface de-duplication (§3) obvious and
localizes the shadow/radius cleanup.

### b) Tokenization quality (quantified)

- **Good:** grid sizing (font, row/header height, cell padding) fully
  tokenized via `--data-table-*` (DataTable.css:694,1040–1056). Colors are
  ~95% tokenized via `var(--…)` + `color-mix()`. Z-index is 100%
  tokenized (every `z-index` uses `var(--z-*)` or `calc(var(--z-*) ± n)`;
  `check:z-index` is satisfied). Derived per-cell colors use scoped local
  vars (smart).
- **Gaps (rough counts):**
  - **20** raw `rgb()/rgba()` literals (the shadow/scrim/pill colors) —
    all invisible to `check:hex`.
  - **~77** raw font-size literals vs 2 tokenized.
  - **~50+** raw `px`/`rem` spacing literals vs near-zero `--space-*`
    usage (the `--space-*` scale is essentially **unused** in this file
    despite existing).
  - **~30** raw `border-radius` literals (mostly `4px`) vs `--phn-radius`.
  - **5** distinct shadow recipes vs 3 `--shadow-elev-*` tokens.
- Net: color tokenization is strong; **spacing, radius, shadow, and
  font-size tokenization is weak-to-absent.** The `--space-*` scale being
  unused here is the single biggest "tokens exist but aren't reached for"
  gap.

### c) Axis-tint system — clean from CSS, or JS-computed?

**Clean and exemplary.** This is the best-architected part of the scope:
- All 14 hues are CSS `oklch()` tokens in `tokens.css:99-119`.
- CSS paints them via attribute selectors keyed on `data-axis-tint`
  (DataTable.css:1659–1715 for th/td; 155–165 for the toolbar buttons).
- The only JS is `tokens/data-table-tints.ts`, which emits the subset
  *code* string (`buildSubsetCode` → `"f"|"s"|"g"|"fs"|…|"fsg"`) — **no
  color computation in JS at all.**
- **No duplication** between `tokens.css` and the CSS/TSX: tokens define
  hues once, CSS references once per subset, JS never touches color.
- One minor doc-drift nit: `tokens/data-table-tints.ts:5` and the comment
  at `:4` say the tint CSS variables live in **`App.css`**, but they
  actually live in `tokens.css` (and are *consumed* in `DataTable.css`).
  Stale comment, not a styling bug. — Low

### d) Inline-style enumeration

Done in §5 above. Summary: 13 inline `style={{}}` sites, **all
justified** dynamic geometry/color (virtualization heights, measured
column widths, group-depth indents, user-color CSS-var passthroughs). The
only nit is two `{ padding: 0, border: 0 }` virtualization-spacer resets
(GridBody.tsx:258,481) that could be a class.

### e) Is the styling self-documenting enough to reuse confidently?

**Partially.** Strengths: the `index.ts` barrel exposes a complete typed
API; `DataTable.css` has unusually good *behavioral* comments (PRD refs,
dated AirTable walkthroughs, z-index rationale); the axis-tint and sizing
tokens are centralized in `tokens.css` with explanatory comments.

Gaps for a reuse-confident downstream author:
1. **No styling/theming README** — nothing tells a consumer to import
   `DataTable.css`, which tokens are the public theming surface
   (`--data-table-page-chrome`, `--data-table-gutter-width`, the
   `--data-table-*` sizing tokens), or that the wrap must be the scroll
   container.
2. **The override knobs are buried** in 2830 lines of selectors rather
   than collected at the top or in a doc.
3. **The 4px/6px/5px radius inconsistency** means a reuser copying a
   pattern inherits ambiguity about which radius is "correct."

A short `data-table/README.md` (or a `:root` doc-comment block listing
the public tokens) plus the popover-surface consolidation would make this
component genuinely reuse-ready.

---

## Top 5 highest-impact fixes

1. **Tokenize & de-duplicate the popover shadow (6 sites) into a shared
   surface class.** Add `--shadow-popover` to `tokens.css` (or reuse
   `--phn-shadow`), introduce a `.data-table-popover-surface` base class,
   and route DataTable.css:185,360,605,1450,1606,2450 (plus the
   single-select/linked-record/color-editor shadows) through it. Removes
   the largest single block of drift and the most-reinvented pattern.
2. **Replace `rgb(233, 238, 249)` with an accent-derived, theme-aware
   token** (DataTable.css:2622,2686,2720,2728). It is the only off-brand,
   non-theme-aware color in the grid and silently evades `check:hex`.
3. **Split `DataTable.css` into ~8 section files** (per §a) and add `.css`
   to the `check:file-sizes` guard so it cannot regrow unbounded.
4. **Close the guard blind spots:** extend `check-hex.mjs` to also scan
   `.ts` files (catches `lib/options/create.ts`) and to flag
   `rgb()/rgba()/hsl()` literals, not just `#hex`. Then either tokenize or
   explicitly allowlist the option palette. This is the change that makes
   "drift stays closed" enforceable rather than aspirational.
5. **Reach for the existing scales:** sweep raw `px` spacing →
   `--space-*`, raw `4px/6px` radii → `--phn-radius`/`--phn-control-radius`,
   and the ubiquitous `0.72rem` chrome font-size → a named token
   (e.g. `--data-table-chrome-font-size`). High volume, low risk, and it
   makes the file consistent with the rest of the app.

---

## Reusable patterns / good practices present

- **Scoped derived-color tokens** on `.data-table td` / `.data-table-wrap`
  (DataTable.css:1092–1106, 1–5): colors computed once with `color-mix()`,
  referenced thereafter. Worth copying app-wide.
- **Axis-tint via attribute selectors + JS-emits-codes-not-colors**
  (§c) — textbook separation of concerns; zero color logic in JS.
- **`--option-color` CSS-variable passthrough** for user-chosen colors
  (GroupHeaderRow.tsx:103, FieldConfigSectionOptions.tsx:361,383,
  FilterPopover.tsx:283, SingleSelectPopover.tsx:158 → painted via
  `var(--option-color, …)` in CSS) — the correct way to bridge JS data to
  CSS without inline color rules.
- **Full z-index tokenization** with documented `calc(var(--z-*) ± n)`
  layering and a written z-index contract (tokens.css:1, DataTable.css
  throughout) — `check:z-index` clean.
- **Exceptional behavioral comments** tying CSS to PRD sections, dated
  design walkthroughs, and browser-verified rationale.
- **Selection-edge box-shadow tokens** (DataTable.css:1779–1801): the
  per-edge inset-shadow variable system is an elegant way to draw a
  composable selection outline without extra DOM.
