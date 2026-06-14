# CSS/Styling Review — Scope E: MODEL_VIEWER (R3F/Three.js) + CLIMATE (recharts/SVG)

Reviewer scope: `frontend/src/features/model_viewer/**` and `frontend/src/features/climate/**`.
Review only — no code modified. All citations are real `file:line`.

## How styling works in this scope

This scope splits cleanly into two styling worlds that the rest of the app does
NOT have:

1. **DOM/CSS chrome** (HUD cards, popovers, lens-bar, legend, inspector, climate
   tables/sections) — plain hand-written CSS in `model_viewer.css` (798 lines)
   and `climate.css` (357 lines), consuming L1 brand + L2 app tokens via `var()`.
   This part is mostly disciplined: spacing in climate.css uses `--space-*`, fonts
   use `--font-mono`, surfaces use `--bg-card`/`--bg-elev`/`--border-*`, radius
   uses `--phn-radius`. No raw hex (check:hex passes), no raw int z-index
   (check:z-index passes), no raw `px` font-sizes (all `rem`).

2. **JS-driven rendering** — the central concern of this scope. Colors for the
   3D scene and the recharts/SVG visuals are produced in **`.ts`/`.tsx` files
   that CI's `check:hex` never scans** (it only reads `.css` + `.tsx`, and even in
   `.tsx` only catches `#hex`, not named colors or `rgb()`). Two sub-patterns:
   - **Recharts + SVG sun-path** (climate): correctly token-driven. Chart strokes
     reference `--chart-*` tokens via `var()` strings passed to recharts props
     (`chart-data.ts` stores the token *name*, `ClimateRecordCharts.tsx` wraps it
     `var(${line.colorVar})`), and the SVG sun-path styles its strokes from
     `--chart-*` in `climate.css`. This is the model to imitate.
   - **Three.js materials/edges/lines** (model_viewer): a fully **independent hex
     palette** hardcoded in `lib/colors.ts` and `lib/themes.ts`. ~35 hex literals,
     none of which relate to the brand tokens or the `--chart-*` palette. Only one
     bridge to the token system exists: `resolveViewerTokens()` reads `--highlight`
     and `--highlight-light` via `getComputedStyle` for hover/select emphasis.

So the discoverability/consistency story is bifurcated: a designer editing
`tokens.css` controls all CSS chrome and (correctly) the climate charts/sun-path,
but has **zero** control over the 3D viewer palette, which lives in TS constants
invisible to CI's hex guard.

---

## Findings by rubric

### Rubric 6 — JS-DRIVEN STYLING (the big one)

- `lib/themes.ts:73-103` — **High** — Four color-by palettes (`FACE_TYPE_COLORS`,
  `BOUNDARY_COLORS`, `VENTILATION_AIRFLOW_COLORS`, `FLOOR_WEIGHTING_FACTOR_COLORS`)
  defined as raw hex literals (~25 colors total, e.g. `#E6B43C`, `#801414`,
  `#40B4FF`, `#EE00FF`). These are categorical legend palettes serving the exact
  same UI role as the climate `--chart-*` palette, but are a totally independent
  set of hues with no shared source of truth. Invisible to `check:hex` (a `.ts`
  file). No relationship to brand or chart tokens.
- `lib/colors.ts:11-24` — **High** — 14 viewer material/edge/line hex constants
  (`VIEWER_FACE_EDGE_COLOR #8b8177`, `VIEWER_DUCT_SUPPLY_COLOR #2674d9`,
  `VIEWER_PIPE_RECIRC_COLOR #d4952f`, `VIEWER_SUN_PATH_COLOR #d49b35`, etc.) plus
  `VIEWER_HIGHLIGHT_FALLBACK = "#E23489"` which **duplicates the brand
  `--highlight` literal** rather than deriving it. Again invisible to CI.
- `lib/colors.ts:60,76-78,106-117` — **Med** — Base mesh colors and ghost color
  hardcoded inside material factories (`#d4d7d2`, `#b9c8d5`, `#7aa58d`,
  `#c7a74c`, `#d8d1c6`, `#000000`). Mixed with material physics (roughness,
  opacity), so they read as "rendering constants," but they are still brand-
  detached palette decisions.
- `lib/colors.ts:31` — **Med** — `resolveViewerTokens` reads `var(--highlight-light)`
  but falls back to `mixColor(highlight, "#ffffff", 0.58)`. `--highlight-light`
  IS defined by the remote brand (light + dark), so the fallback rarely fires —
  but the hardcoded white mix means a dark-mode brand change to `--highlight-light`
  would diverge from the JS fallback. Low practical risk today.
- `scene/ViewerCanvas.tsx:37` — **Med** — `<color attach="background" args={["snow"]} />`:
  the entire 3D canvas background is the CSS **named color `"snow"`** (#FFFAFA),
  hardcoded, theme-unaware. `check:hex` does not catch named colors, and the
  surrounding `.model-viewer-surface` uses a token-driven gradient
  (`model_viewer.css:8-16`) — so the DOM surface and the WebGL canvas background
  are styled by two unrelated systems that will visibly mismatch in dark mode.
- `scene/BuildingLens.tsx:255,332,339` & `scene/MeasureOverlay.tsx:113,141` &
  `scene/SiteSunLayer.tsx:76,93,109` — **Low** — These correctly consume the
  `lib/colors.ts` constants (no inline hex), so the JS palette is at least
  centralized within the feature. The problem is the palette's isolation, not
  scattered literals.

**Unification recommendation (special task a):** there is currently **no shared
source of truth** between the 3D palette (`lib/colors.ts` + `lib/themes.ts`), the
`--chart-*` palette (`tokens.css`), and the brand tokens. Two viable directions:
  1. *Read CSS vars in JS* (extend the existing `resolveViewerTokens` pattern):
     pull `--chart-1..6`, the categorical hues, and a `--bg-viewer-canvas` token
     from `getComputedStyle` at material-build time. Makes the palette
     theme-aware and brand-controlled, but adds a runtime read and complicates
     SSR/testing.
  2. *Shared TS token module* — a single `src/styles/palette.ts` (or generated
     from `tokens.css`) exporting the categorical + chart hues, imported by both
     recharts code and the Three.js code. Keeps it static/testable; does not make
     it theme-aware but gives one editable list. Given the 3D viewer needs hex
     strings for Three.js anyway, option 2 (a shared TS palette that `tokens.css`
     mirrors, or vice-versa) is the lower-friction win; option 1 only matters if
     dark-mode 3D is on the roadmap. At minimum, `VIEWER_HIGHLIGHT_FALLBACK`
     (`#E23489`) should be documented as "must equal brand `--highlight`."

### Rubric 1 — DRIFT / hardcoded values bypassing tokens

- `model_viewer.css:35,59,287,310,338,356,421,516,544,635,649,708` — **Med** —
  12 `rgb(0 0 0 / x%)` box-shadow literals (see special task d enumeration below).
  Drift vs `--shadow-elev-*`, though those tokens don't currently fit (see note).
- `model_viewer.css:13` — **Low** — `color-mix(... var(--bg-card) 70%, white)` uses
  the named color `white` in a gradient. Consistent with brand `color-mix` idiom
  elsewhere; minor.
- `model_viewer.css` (throughout) — **Low** — Pervasive raw `px` for spacing/sizing
  (`top:14px`, `padding:7px 12px`, `gap:7px`, `border-radius:8px/10px/12px/999px`,
  `width:34px`, etc.). Unlike `climate.css` (which uses `--space-*` and
  `--phn-radius`), `model_viewer.css` does **not** use the spacing or radius scale
  at all. Not a guard violation, but a consistency gap between the two files in
  the same scope. The pill radius `999px` and pixel offsets are arguably
  intentional for floating chrome, but the `8/10/12px` radii and `7/14px` paddings
  could be `--space-*`/`--phn-radius`.
- `climate.css:140,192,253,279,330,336` — **Low** — A handful of raw `px`
  (`gap:4px`, `gap:2px`, `margin:2px`, `padding:4px 6px`, `height:260px`,
  `max-width:320px`). Sub-`--space-1` values and fixed chart-canvas dims are
  reasonable exceptions; noted for completeness.
- `model_viewer.css:212,261` & climate transitions — **Low** — Raw transition
  timings (`transition: width 120ms linear`, `opacity 160ms ease`,
  `model-loading-spin 900ms`). Brand exposes `--transition-base`/`--ease`; these
  bypass them. Minor.

### Rubric 2 — OFF-BRAND / INCONSISTENT color & semantics

- `scene/ViewerCanvas.tsx:37` — **Med** — `"snow"` canvas background is off the
  token system entirely (see rubric 6).
- `lib/themes.ts` palettes vs `--chart-*` — **Med** — Two categorical palettes
  for legend/series UI with no shared hue logic; the 3D `FACE_TYPE_COLORS` etc.
  and the chart series will look like different products side by side.

### Rubric 3 — DUPLICATION that should be shared

- `model_viewer.css:277-294, 325-342, 344-358, 504-517, 531-545, 696-709` —
  **Med** — The floating HUD chrome (measure hint, loading chip, lens bar, camera
  cluster, legend card, inspector) repeats the same "floating card" recipe:
  `position:absolute` + `border:1px solid var(--border-card)` +
  `background: color-mix(in oklab, var(--bg-card) 90-94%, transparent)` +
  `box-shadow: 0 4px 18px rgb(0 0 0 / 12%)` + a `border-radius`. No shared
  `.model-hud-card` base class; each re-declares it. A single utility class (and
  a single shadow token) would prevent the box-shadow values from drifting apart
  (they already vary: `0 2px 10px/8%`, `0 2px 12px/10%`, `0 3px 14px/10%`,
  `0 4px 18px/12%` — at least 7 distinct shadows for visually-equivalent cards).
- `model_viewer.css:476-488, 579-591, 634-636` — **Low** — Three near-identical
  icon-button declarations (loading-chip/camera/inspector buttons;
  legend-title-actions/scene-info button) sharing border/radius/bg. Partially
  grouped already; could consolidate.

### Rubric 4 — NAMING / STRUCTURE inconsistency

- `climate.css` vs `model_viewer.css` — **Low** — Same scope, opposite
  conventions: climate uses `--space-*` + `--phn-radius`; model_viewer uses raw
  px everywhere. A reader cannot infer one file's conventions from the other.
- `lib/colors.ts` exports `VIEWER_*` SCREAMING_SNAKE constants while
  `lib/themes.ts` uses lowerCamel `ColorDefinition` maps — two naming styles for
  the same concept (viewer palette) in adjacent files. **Low.**

### Rubric 5 — INLINE STYLES in TSX

- `components/LegendCard.tsx:81` — **Justified** — `style={{ backgroundColor:
  row.color }}` sets the legend swatch to the per-row data-driven color produced
  by `lib/themes.ts`. Color is dynamic per legend entry; cannot be a static CSS
  class. Correct use of inline style.
- `components/UploadDropZone.tsx:63` — **Justified** — `style={{ width:
  `${...}%` }}` is the live upload-progress width, inherently dynamic. Correct.

No unjustified inline styles found in scope.

### Rubric 7 — DISCOVERABILITY

- **High (conceptual)** — A new contributor wiring up a new color-by lens has no
  signpost that the categorical palette lives in `lib/themes.ts`, that the chart
  palette lives in `tokens.css` (`--chart-*`), and that these are unrelated. The
  `--chart-*` block is well-commented in `tokens.css:19-30`, but nothing points
  from there to the 3D palette or vice-versa. The `colorVar` indirection in
  `chart-data.ts:14-18` is the one well-documented bridge.
- The 3D palette being invisible to `check:hex` means contributors get **no CI
  feedback** if they add a raw hex in a `.ts` scene file, so drift here is
  silent by construction.

---

## Special-task answers

**(a) JS-driven color catalog & unification** — see Rubric 6. `lib/themes.ts`
defines 4 categorical palettes (~25 hex). `lib/colors.ts` defines 14 viewer
constants + base mesh/ghost colors + `#000000` emissive. The only token bridge is
`resolveViewerTokens()` reading `--highlight`/`--highlight-light`. The 3D palette,
the `--chart-*` palette, and CSS tokens share **no source of truth**. Recommend a
shared TS palette module (option 2) as the pragmatic unification; option 1 (read
CSS vars in JS) only if dark-mode 3D is planned. Flag `VIEWER_HIGHLIGHT_FALLBACK`
as a brand duplicate.

**(b) Recharts token consumption** — VERIFIED hex-free and correctly token-driven.
`ClimateRecordCharts.tsx:71-73,89` passes `stroke="var(--chart-grid)"`,
`stroke="var(--chart-axis)"`, and `stroke={`var(${line.colorVar})`}`; tooltip
`contentStyle` uses `var(--bg-card)`/`var(--chart-grid)`/`var(--phn-radius)`
(lines 75-80). `chart-data.ts:23-36` stores token names only. **`--chart-6` is
DEAD** — series use `--chart-1..5` (temperature: 1,2,5,4; radiation: 1,2,3,4,5);
the SVG sun-path uses `--chart-1` and `--chart-4`. `--chart-6 (#0891b2)` is
defined at `tokens.css:30` and never consumed anywhere in `src/`. Confirmed flag.

**(c) SVG sun-path colors** — Token-driven, but via the **chart palette, not the
`--svg-*` brand tokens**. `climate.css:341-357`: compass uses `--chart-grid`,
day-arcs use `--chart-4`, analemmas use `--chart-1`. The brand defines a dedicated
SVG family (`--svg-line-{heavy,medium,light,faint}`, `--svg-text`, `--svg-fill-dot`)
intended exactly for line diagrams like this; the sun-path ignores them and
borrows chart series hues instead. **Med** — semantically off (a compass grid is
not a "chart series"); using `--svg-line-faint`/`--svg-line-medium` would be more
correct and theme-aware.

**(d) box-shadow enumeration & nearest `--shadow-elev-*` map** — 7 distinct
literals across 12 sites:
| literal | sites | nearest token | fit |
|---|---|---|---|
| `0 2px 10px rgb(0 0 0 / 8%)`  | :35 (file chip) | `--shadow-elev-1` | poor (token blur 2px) |
| `0 8px 28px rgb(0 0 0 / 14%)` | :59 popover, :421 theme-menu, :649 scene-info | `--shadow-elev-2`? | poor (token 18/40px) |
| `0 3px 14px rgb(0 0 0 / 10%)` | :287 (measure/sun hint) | `--shadow-elev-1` | poor |
| `0 2px 10px rgb(0 0 0 / 16%)` | :310 (measure label) | `--shadow-elev-1` | poor |
| `0 2px 12px rgb(0 0 0 / 10%)` | :338 loading chip, :356 lens bar | `--shadow-elev-1` | poor |
| `0 4px 18px rgb(0 0 0 / 12%)` | :516 camera, :544 legend, :635 scene-info btn | — | none close |
| `-8px 0 26px rgb(0 0 0 / 12%)` | :708 (inspector, left-side) | — | none (directional) |

**Conclusion:** the existing `--shadow-elev-*` tokens are tuned for big
dropdown/modal surfaces (18-40px / 24-60px blur) and do **not** fit these tight
floating-chip shadows (2-8px offset, 10-28px blur). The honest fix is **new
HUD-scale shadow tokens** (e.g. `--shadow-hud-1/2/3`) consolidating these 7 into
~3, not a force-fit onto `--shadow-elev-*`. This is why a blanket "map to
elev tokens" would be wrong here.

**(e) Overlay HUD z-index** — `--z-overlay-hud` (z 500) is **NOT used by
model_viewer** (or anywhere in `src/`). model_viewer's HUD layers all use
`--z-base-elevated` (z 1) and `calc(var(--z-base-elevated) + 2)` / `+ 3`
(`model_viewer.css:24,281,329,348,414,508,536,701`). **Confirmed: `--z-overlay-hud`
is dead** (`tokens.css:43`, defined only). The HUD that the token was named for
is the one feature that ignores it — and using z 1 for floating overlay chrome is
itself slightly suspect (it works only because the canvas sits at the base layer).
**Med** — either adopt `--z-overlay-hud` for the HUD (its intended purpose) or
remove the dead token.

**(f) Inline styles** — Both justified; see Rubric 5.

---

## Top 5 highest-impact fixes

1. **Unify the 3D palette with a shared token source** (`lib/themes.ts` +
   `lib/colors.ts`). Establish one palette module (or read `--chart-*`/categorical
   tokens via the existing `resolveViewerTokens` pattern) so the 3D legend hues,
   the chart series, and brand are governed together — and so CI/hex drift in
   `.ts` scene files stops being invisible. (Rubric 6, special task a)
2. **Token the 3D canvas background** (`ViewerCanvas.tsx:37` `"snow"` → a
   `--bg-viewer-canvas` token), so the WebGL background and the CSS
   `.model-viewer-surface` gradient share one theme-aware source and don't
   mismatch in dark mode. (Rubric 2/6)
3. **Introduce HUD-scale shadow tokens** and a shared `.model-hud-card` base
   class. Collapse the 7 ad-hoc `rgb(0 0 0 / x%)` shadows into ~3 tokens and one
   reusable floating-card recipe; do NOT force them onto `--shadow-elev-*` (which
   don't fit). (Rubric 1/3, special task d)
4. **Fix `--text-on-accent`** (`model_viewer.css:391`): this token is undefined
   (not in remote brand, not in app tokens) yet sets the text color of the
   *active* lens-bar button sitting on a `--accent` background — a silently-wrong
   render. Replace with the real on-accent token used elsewhere (brand exposes
   none by that name; the app convention is a contrasting `--text-primary` or a
   defined on-accent value). (Rubric 2; matches the cross-scope undefined-token
   pattern)
5. **Remove or wire up the two dead tokens this scope is supposed to own**:
   `--chart-6` (`tokens.css:30`, never consumed) and `--z-overlay-hud`
   (`tokens.css:43`, never consumed — the HUD uses `--z-base-elevated` instead).
   Either delete them or actually use `--chart-6` for a 6th series and
   `--z-overlay-hud` for the HUD layer it was named for. Also retarget the SVG
   sun-path from `--chart-*` to the brand `--svg-*` line tokens. (Special tasks
   b, c, e)

---

## Reusable patterns / good practices present

- **`colorVar` indirection** (`chart-data.ts:14-18`, `ClimateRecordCharts.tsx:89`):
  storing a CSS-token *name* in data and resolving it to `var(--…)` at render is a
  clean, well-documented way to keep recharts hex-free and CI-clean. This is the
  template the 3D palette should follow.
- **`climate.css` token discipline**: consistent `--space-*`, `--phn-radius`,
  `--font-mono`, `--bg-*`/`--border-*` usage — a good example for `model_viewer.css`
  to match.
- **Justified inline styles only**: both inline styles in scope are genuinely
  data-driven (legend swatch color, progress width). No lazy inline styling.
- **`resolveViewerTokens()`** (`lib/colors.ts:26-33`): the one place JS reads
  brand tokens at runtime with a sensible fallback — the right primitive to extend
  for full palette unification.
- **Well-commented token block**: `tokens.css:19-30` explains *why* `--chart-*`
  exists (hex-free recharts per check:hex) — good discoverability where it exists.
