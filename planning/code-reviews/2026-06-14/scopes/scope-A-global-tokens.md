# CSS Review — Scope A: Global Token/Base Layer + Guards + Import Graph (keystone)

Reviewer scope (read in full): `frontend/src/styles/tokens.css`, `frontend/src/styles/base.css`
(1967 lines), `frontend/src/styles/modals.css`, `frontend/src/App.css`, `frontend/index.html`,
`frontend/scripts/{check-hex,check-z-index,check-file-sizes,check-feature-shape}.mjs`.
Cross-checked against the remote brand `tokens.css` (fetched live) and grepped all of `src/`.

---

## How styling works in this scope (authoritative description)

### The token system as designed (3 layers)

**L1 — Remote brand tokens (`bldgtyp.github.io/bt-branding/tokens/tokens.css`).**
Loaded at runtime via `<link>` in `frontend/index.html:7`. Theme-aware: defines a `:root`
light block and a `[data-theme="dark"]` block. `index.html:2` hardcodes
`data-theme="light"`, so dark is defined-but-never-activated. Verified live contents (93
lines): brand hues (`--accent` `#3E93AE`, `--highlight` `#E23489` + light/dark/darker
variants), fonts (`--font-primary` `'Outfit'`, `--font-table` `'Geist'`, `--font-mono`
`'Geist Mono'`), `--radius-sm` `3px`, `--transition-base` `0.3s ease`, `--ease`
`cubic-bezier(.2,.6,.2,1)`, surfaces (`--bg-page/-card/-elev/-section-alt/-stats`), text
(`--text-primary/-secondary/-muted`), borders (`--border-subtle/-card/-strong`), semantic
text (`--accent-text`, `--highlight-text`), and the `--svg-line-{heavy,medium,light,faint}`
/ `--svg-fill-dot` / `--svg-text` line set. Fonts themselves load from Google Fonts
(`index.html:10-13`) — Geist + Geist Mono only (NOT Outfit).

**L2 — App tokens (`frontend/src/styles/tokens.css`).**
Two `:root` blocks. Selectively **overrides** brand tokens (font, radius, surfaces) and
**adds** app-domain tokens (spacing scale, z-index contract, shadows, control sizing,
data-table metrics, chart palette, report-status, axis-tint cascade, semantic
success/warning/danger). This is the file new authors should learn; `check:hex` exempts it
so it is the sanctioned home for raw hex.

**L3 — Feature/component CSS.** Consumes via `var()`. Guard `check:hex` bans raw `#hex` in
`src/features/**` and `src/shared/ui/**` `.css`/`.tsx`.

### Load/cascade order
`main.tsx` → `App.css` which `@import`s tokens.css → base.css → modals.css → component
sheets (App.css:1-14). Brand L1 is a separate `<link>` in `index.html`, so L1 lands in the
document before the bundled L2/L3. Cascade-wise L2 overrides L1 because both are `:root`
and L2 is later in document order. Fine in practice, but fragile (see Finding D-1).

---

## Findings by rubric category

### 1. Drift / hardcoded values bypassing tokens

- **`base.css` (22 occurrences) — hardcoded `0.16s` transition duration** instead of a
  token — Med. The brand ships `--transition-base: 0.3s ease`, but base.css invents a
  faster `0.16s` everywhere (e.g. `:36` input transition group, `:520`, `:625`, `:850`,
  `:1081`, `:1306` button, `:1439` tooltip). `--transition-base` is referenced **0** times
  app-wide. There is no `--transition-fast` token, so the de-facto app speed (0.16s) lives
  only as a literal. Either add `--transition-fast` or adopt the brand token.
- **`base.css` — multiple distinct hardcoded `border-radius` literals** — Med (radius
  incoherence, see §E): `:43` `4px` (base input), `:521` `3px` (account summary), `:1703`
  `6px`, `:1730` `8px` (app-menu panel), `:1744` `6px` (app-menu item), `:1828` `50%`,
  plus six `999px` pills (`:295,:613,:629,:1480,:1500,:1667`). None use `--phn-radius`
  /`--radius-sm`.
- **`base.css:1731` — raw `box-shadow: 0 8px 24px rgb(0 0 0 / 8%)`** (app-menu panel)
  bypassing `--shadow-elev-*` — Med. Two more bespoke shadows at `:250`
  (`0 18px 42px ...`) and `:631` (`0 1px 2px ...`) are color-mix-based one-offs, not the
  tokens. `--shadow-elev-2` exists and `.account-menu-panel`/`.catalog-menu-panel` already
  use `--phn-shadow` — the app-menu panel diverged.
- **`base.css:1560` and `:1567` — raw `rgb(249, 250, 251)`** for `.app-subtabs` and
  `.app-subtabs__tab` background — Med. That literal is exactly `--bg-elev`
  (`tokens.css:10` = `rgb(249, 250, 251)`). Two near-duplicate hand-typed surfaces that
  should be `var(--bg-elev)`. (Passes `check:hex` because it is `rgb()`, not `#hex` —
  guard gap, see §4.)
- **`modals.css:7` — raw `rgb(0 0 0 / 48%)`** backdrop — Low. No token for scrim opacity;
  acceptable but undiscoverable; candidate `--scrim` token.
- **`base.css` — pervasive raw rem font-sizes** (≈40 declarations across ~15 distinct
  values: `0.68/0.7/0.72/0.74/0.75/0.78/0.8/0.82/0.86/0.875/0.9/0.92/1/1.1/1.25rem`) —
  Med. No type-scale tokens exist at all. `0.72rem` (×9) is the de-facto "eyebrow/label"
  size and `0.78rem` (×5) the de-facto "mono button" size, but both are copy-pasted, not
  tokenized. This is the single biggest discoverability gap for a new author ("what font
  size do I use for a label?").
- **`base.css` — ~116 raw px values in padding/gap/margin/offsets** while a `--space-1..7`
  scale exists — Med. base.css predates/ignores the spacing scale almost entirely (it uses
  `16px`, `14px`, `12px`, `8px`, `24px`, `20px`, `6px`, `4px`, `10px` literals — several of
  which map exactly to `--space-4/-3/-2/-5`). The spacing tokens are used in feature CSS
  but base.css itself almost never consumes them (only the `.app-menu__*` block added later
  uses `--space-*`). Inconsistent base vs. feature convention.

### 2. Off-brand / inconsistent color & semantics

- **`base.css:1770` — `color: var(--danger)` — BROKEN/undefined token** — High.
  `--danger` is defined nowhere: not in app `tokens.css`, not in the live remote brand file
  (verified by fetch — neither `--danger` nor `--font-sans` exist remotely). The
  `.app-menu__item[data-danger="true"]` rule therefore resolves to `currentcolor`/inherited
  rather than red. The correct token is `--phn-danger` (used 46× elsewhere).
- **`base.css:1748` — `font-family: var(--font-sans)` — BROKEN/undefined token** — High.
  `--font-sans` exists nowhere (app or remote). `.app-menu__item` falls back to inherited
  font instead of the intended sans. Correct token is `--font-primary`.
- **`base.css:1513,1520,1521` — `color: white` named color** (pill-tab active) — Low. Every
  other "white on accent" in the file uses `#ffffff` (`:657,:1324,:1358,:1681`). Mixed
  `white` vs `#ffffff` for the identical intent; neither is tokenized (no `--on-accent`
  token). Both pass `check:hex` for `white` (named) — guard gap.
- **`base.css` `#ffffff` literals at `:657,:1324,:1358,:1681`** — Low. "Text on accent
  fill." Lives in base.css (not under the guard's `features/**`/`shared/ui/**` roots, so
  legal), but it is an untokenized brand-coupled value repeated 4×. Candidate `--on-accent`.
- **Semantic warning derivation is convoluted** — Low. `tokens.css:62`
  `--phn-warning: color-mix(in oklab, var(--highlight-text) 72%, black)` derives the
  *warning* color from the *highlight (magenta)* brand token. Functional but semantically
  surprising: a new author reading "warning" would not expect it to track the magenta
  highlight. `--phn-success` (`:60`) aliases `--accent-dark` (teal) — also non-obvious
  (success usually green; the dedicated green lives only in `--report-status-complete`).

### 3. Duplication that should be shared

- **Shared component classes already live in base.css** (good intent, but it has become a
  catch-all — see §G): buttons (`button`, `.primary-button`, `.secondary-button`,
  `.danger-button`, `.text-button`, `.icon-button`, `.download-link`), pills (`.pill-tab*`,
  `.read-only-pill`), tabs (`.tabbar`, `.app-subtabs*`), menus (`.catalog-menu*`,
  `.account-menu*`, `.app-menu*`), forms (input/textarea/select base, `.autocomplete-select*`),
  tooltip (`[data-tooltip]`), eyebrow/headings, empty-state, project list/rows. These are
  genuinely shared and correctly centralized.
- **Two parallel pill/tab systems** — Med. `.pill-tab` (`:1490`) and
  `.app-subtabs[data-variant="pills"] .app-subtabs__tab` (`:1657`) are two independent
  "rounded chip tab" implementations with near-identical visuals (999px, accent-active,
  border-subtle). Plus the report-status-chip pattern noted in user memory as canonical.
  Three chip lineages → consolidation candidate.
- **Tooltip vs modal vs menu panel surfaces** repeat the same recipe
  (`bg-card` + `border` + `border-radius` + `phn-shadow`) inline in 4+ places
  (`:243`, `:547`, `:1422`, `:1724`, modals `.modal-panel`) rather than a shared
  `.surface-elevated` utility — Low.

### 4. Naming / structure inconsistency

- **`base.css` is a 1967-line god stylesheet** — High (structural). It mixes global resets,
  the entire button/form/menu/tab component library, auth pages, dashboard, project list,
  settings, tokens-consumers, and responsive overrides in one flat file. `check-file-sizes`
  caps `.ts/.tsx` at 500 lines but **does not check `.css`** (verified: regex is
  `/\.(ts|tsx)$/`), so base.css grows unbounded. This is the primary navigability problem.
- **`check:hex` does not catch `rgb()/rgba()/hsl()/named colors`** — Med (guard gap). Proven
  live: `base.css:1560/1567` `rgb(249,250,251)`, `modals.css:7` `rgb(0 0 0/48%)`, and
  `base.css:1520/1527` `color: white` all pass the hex guard. The guard gives false
  confidence that "all colors are tokenized."
- **BEM-ish vs flat naming mix** — Low. `.app-subtabs__tab` and `.app-menu__item` use BEM
  `__`; everything else is flat-kebab (`.pill-tab`, `.catalog-menu-panel`). Two
  conventions in one file.
- **No `!important` anywhere in base.css** — Good (noted as positive).

### 5. Inline styles in TSX
- Out of primary scope (these are base/global files), but the chart axis/grid colors are
  applied as inline `style`/string props in `ClimateRecordCharts.tsx:71-77` and
  `chart-data.ts:24-35` — see §6. No problematic static inline styling found in the global
  layer itself.

### 6. JS-driven styling
- **`features/climate/chart-data.ts:24-35` references `--chart-*` as string constants**
  (`colorVar: "--chart-1"` … `"--chart-5"`) consumed by recharts — Low/acceptable. This is
  the intended pattern (keeps chart code hex-free for `check:hex`) and correctly points at
  L2 tokens. Noting it because it is the one place tokens are referenced as JS strings, so
  a rename of `--chart-*` would silently break charts (no guard couples them).

### 7. Discoverability
- **No styles README / index** — High. Confirmed: `src/styles/` contains only
  `base.css`, `modals.css`, `tokens.css` — no README; and a repo-wide search for any
  `*.md` mentioning style/token/design returns nothing. A new feature author has no map of
  "where tokens live, which to use for X, what's already a shared class." `tokens.css` has
  good inline comments but they are scattered and assume you already found the file.
- **Unused / dead tokens muddy the picture** (see inventory below) — Med.

---

## Token inventory — `src/styles/tokens.css` (every token)

Usage = count of `var(--x)` references across `src/**` `.css/.ts/.tsx` excluding tokens.css
(chart palette also counted via JS string refs in chart-data.ts).

### Overrides of a brand (L1) token
| Token | tokens.css | Brand value | Status |
|---|---|---|---|
| `--bg-page` | `rgb(247,248,249)` | `#fff` | override, used 24× |
| `--bg-elev` | `rgb(249,250,251)` | `#fafafa` | override, used 23× |
| `--bg-card` | `#ffffff` | `#ffffff` | redundant restate (same value), used 146× |
| `--radius-sm` | `5px` | `3px` | override, used 4× |
| `--font-primary` | `"Geist"` | `'Outfit'` | **override — app drops Outfit for Geist** (and Outfit is never even loaded from Google Fonts), used 15× |
| `--font-table` | `"Geist"` | `'Geist'` | redundant restate, used 4× (via fallback form) |

### App-domain additions
| Token | Used | Notes |
|---|---|---|
| `--report-status-{missing,question,complete,na}` | 1 each | report-table dots |
| `--chart-axis` / `--chart-grid` | 2 / 3 | |
| `--chart-1` | 3 | |
| `--chart-2` | 2 (JS) | |
| `--chart-3` | 1 (JS) | |
| `--chart-4` | 4 | |
| `--chart-5` | 2 (JS) | |
| `--chart-6` | **0 — UNUSED** | defined but no consumer anywhere |
| `--phn-radius` | 65 | primary radius token (good adoption) |
| `--phn-control-radius` | 3 | 6px control radius |
| `--z-base` | 27 | |
| `--z-base-elevated` | 11 | |
| `--z-sticky` | 4 | |
| `--z-dropdown` | 20 | |
| `--z-overlay-hud` | **0 — UNUSED** | defined for "overlay HUD" tier, no consumer |
| `--z-modal` | 5 | |
| `--z-tooltip` | 5 | |
| `--space-1..5` | 8/17/18/6/1 | |
| `--space-6` | **0 — UNUSED** | 32px |
| `--space-7` | **0 — UNUSED** | 48px |
| `--shadow-elev-1` | 7 | |
| `--shadow-elev-2` | 2 | |
| `--shadow-elev-3` | **0 — UNUSED** | |
| `--phn-shadow` | 6 | alias of elev-2 |
| `--phn-focus` | 3 | |
| `--phn-success` / `--phn-success-bg` | 2 / 1 | |
| `--phn-warning` / `--phn-warning-bg` | 23 / 4 | |
| `--phn-danger` / `--phn-danger-bg` | 46 / 7 | |
| `--phn-control-height` | 2 | |
| `--accent-edge` | 3 | |
| `--gutter-width` | 1 | |
| `--bg-table-outside` | 1 | |
| `--aperture-frame-fill-default` / `--aperture-glazing-fill-default` | 1 / 1 | |
| `--data-table-font-size` / `-header-font-size` / `-row-height` / `-header-height` / `-cell-padding-x` / `-header-padding-x` | 1/1/5/2/2/1 | |
| `--phn-header-border-locked` | 1 | |
| `--data-table-tint-*` (14 tokens) | all used | via attribute-selector → `var()` in DataTable.css |

**Unused app tokens to flag:** `--chart-6`, `--z-overlay-hud`, `--space-6`, `--space-7`,
`--shadow-elev-3` (5 dead tokens).

### Brand (L1) tokens the app NEVER consumes (missed reuse)
Verified by grep of `src/**`:
- `--bg-section-alt` — 0 (app never uses the alt section surface)
- `--bg-stats` — 0
- `--transition-base` — 0 (app reinvented 0.16s instead)
- `--highlight-dark` — 0 (app uses `--highlight-text`/`--highlight-darker` instead)
- `--svg-line-heavy` — 0, `--svg-line-medium` — 0, `--svg-fill-dot` — 0, `--svg-text` — 0
  (only `--svg-line-light` ×2 and `--svg-line-faint` ×2 are used). The SVG line system is
  largely unused despite climate/aperture SVG work.
- `--highlight-light` — 1 (single use, `model_viewer.css:527`)

### Brand tokens intentionally overridden (correct, document them)
Font (`--font-primary` Outfit→Geist), radius (`--radius-sm` 3px→5px), surfaces
(`--bg-page`, `--bg-elev`). These are deliberate and should be called out in the missing
styles README so authors know L2 wins.

---

## §D — Remote-dependency resilience

- **Two runtime network fetches with no local fallback**: brand `tokens.css`
  (`index.html:7`) and Geist/Geist Mono from Google Fonts (`index.html:10-13`). Both are
  blocking `<link rel="stylesheet">`.
- **If `bldgtyp.github.io` is down / offline / CI without network**: every L1 token is
  undefined. `--accent` (used 101×), all `--text-*`, `--border-*`, `--bg-*`, `--ease`
  (48×), `--font-mono` (43×) collapse. `var(--accent)` with no fallback → property is
  invalid → elements render with initial/inherited values (unstyled-ish: black text,
  transparent accents, default serif-ish fonts). **No `var(--accent, <fallback>)` defensive
  fallbacks exist anywhere** — confirmed. The app has zero offline/degraded resilience for
  brand identity.
- **If the brand repo changes a token name/value**: silent drift. E.g. if they rename
  `--accent-text`, 45 call sites break with no build error (CSS custom props don't fail the
  build). The guard scripts cannot catch this (they check for literals, not var existence).
- **FOUC risk**: L1 + fonts are remote and render-blocking; `preconnect` hints exist
  (`index.html:6,8,9`) which helps, but a slow CDN still flashes default fonts before Geist
  loads (`display=swap` on the font URL mitigates font FOUC but not token FOUC).
- **CI**: `make ci`'s production build does not need the network for CSS (Vite bundles only
  L2/L3); the `<link>` is just HTML. So build is fine, but any Playwright/e2e run that
  asserts on color/font is at the mercy of the live CDN.
- **`--font-primary` mismatch**: brand says Outfit, app overrides to Geist, and only Geist
  is fetched from Google Fonts. So even with the remote brand file present, Outfit would
  never render. Harmless today but a latent trap if someone "restores" the brand font.

**Recommendation**: vendor a local copy of brand `tokens.css` (and self-host or
`@font-face` the fonts) so the app has a deterministic, offline-safe baseline; treat the
remote file as the source you periodically sync, not a runtime dependency. At minimum, add
`var(--accent, #3E93AE)`-style fallbacks on the highest-traffic tokens, or define a local
fallback `:root` block before L1.

---

## §E — Radius coherence

Distinct radius **sources** in scope: **6+**.
1. brand `--radius-sm` `3px` (overridden, so never the effective value)
2. app `--radius-sm` `5px` (`tokens.css:32`)
3. `--phn-radius` = `var(--radius-sm)` → 5px (`tokens.css:33`, the main one, 65 uses)
4. `--phn-control-radius` `6px` (`tokens.css:34`)
5. base.css literals: `4px` (`:43` inputs), `3px` (`:521`), `6px` (`:1703,:1744`),
   `8px` (`:1730`), `50%` (`:1828`)
6. pill `999px` (×6)

So inputs are 4px, account-summary is 3px, app-menu is 6px/8px, controls are 6px, panels
are 5px — at least **five different non-pill corner radii** in the global layer, only two of
which are tokens. A user clicking through forms/menus sees visibly inconsistent corners.
Consolidate to `--phn-radius` (surfaces) + `--phn-control-radius` (controls) + a named
`--radius-pill: 999px`.

---

## §F — Split import strategy (recommend ONE)

Two mechanisms coexist:
- **`App.css` `@import`** (13 sheets): tokens, base, modals, DimensionChrome,
  InlineHeaderNameEditor, auth-page, version-controls, equipment, project_status, catalogs,
  envelope, DataTable, ReportTable.
- **TS bundler `import "...css"`** at component level: apertures.css, climate.css,
  model_viewer.css, attachments.css (×5 files), DataTable.css, plus several already in
  App.css.

**Worse than described — 6 sheets are DOUBLE-IMPORTED** (in App.css `@import` *and* a TS
import): `auth-page.css`, `catalogs.css`, `DataTable.css`, `equipment.css`,
`project_status.css`, `version-controls.css`. Vite dedupes identical module specifiers so
this is not a runtime double-paint, but it is confusing and brittle: an author editing
App.css cannot tell which sheets are "global" vs "component-scoped," and removing a sheet
from App.css would silently leave it loaded (or not) depending on whether the route is
mounted. Truly TS-only (not in App.css): `apertures.css`, `climate.css`,
`model_viewer.css`, `attachments.css`.

**Recommendation**: pick one rule.
- *Global/shared sheets* (tokens, base, modals, shared/ui/*) → keep in App.css `@import`
  (or, better, a single `styles/index.css`).
- *Feature sheets* → import only from that feature's entry component (TS import), and
  **remove them from App.css**. That eliminates all 6 double-imports and makes feature CSS
  load with the feature (matches the feature-first organization the project mandates).

---

## §G — base.css as god stylesheet

Yes. 1967 lines, single flat file, holding: global resets (`*`, `html`, `body`, form
elements), the **entire shared component library** (buttons ×7 variants, pills, tabs,
3 menu systems, autocomplete, tooltip, icon-button), plus page-specific layout for auth,
dashboard, project list, project header, settings, tokens-and-deleted-projects, plus the
responsive `@media` block. Shared classes that downstream authors depend on but would
struggle to find: `.primary-button`/`.secondary-button`/`.danger-button`/`.text-button`/
`.icon-button`, `.pill-tab`, `.eyebrow`, `.empty-state`, `.app-subtabs*`, `.app-menu*`,
`[data-tooltip]`, the form/`.autocomplete-select*` system. Because `check-file-sizes` only
gates `.ts/.tsx`, nothing stops further growth. **Recommend splitting** into
`styles/reset.css`, `styles/typography.css`, `styles/buttons.css`, `styles/forms.css`,
`styles/navigation.css` (tabs/menus), `styles/layout.css`, and moving page-specific blocks
(auth, dashboard, settings) into their feature folders — leaving base.css as reset +
element defaults only.

---

## §H — Discoverability verdict

**Poor / fail.** Confirmed there is no `src/styles/README.md` and no styling/token/design
markdown anywhere in the frontend (repo-wide `*.md` search for style/token/design/css = 0
hits). A new feature author has:
- no index of which tokens exist or which to use for spacing/type/color;
- no list of shared classes (they're buried in a 1967-line file);
- five dead tokens and several broken `var()` refs that would mislead by example;
- a `check:hex` guard that implies "colors are handled" while `rgb()`/named colors slip
  through.
The token comments in `tokens.css` are good but presuppose discovery of the file.

---

## Top 5 highest-impact fixes for this scope

1. **Fix the two broken token refs in base.css** — `var(--danger)` (`:1770` → `--phn-danger`)
   and `var(--font-sans)` (`:1748` → `--font-primary`). These are live bugs (app-menu danger
   items aren't red; app-menu font isn't the app font). High, trivial.
2. **Add a `src/styles/README.md` (token + shared-class map)** documenting L1/L2/L3,
   intentional brand overrides (Geist-not-Outfit, 5px radius, bg surfaces), the spacing/
   z-index scales, the shared component classes in base.css, and "use `--phn-*` not
   literals." Single biggest lever for "easy to find/use." High.
3. **Close the guard gaps**: extend `check:hex` to also ban `rgb()/rgba()/hsl()/`named
   colors in features/shared CSS, and add a `.css` line-cap (or section-split mandate) to
   `check-file-sizes`. Add an optional "var() must be defined" lint to catch broken refs
   like #1. Med-High.
4. **Establish missing scales + kill dead/duplicate values**: add `--transition-fast`
   (0.16s, currently 22 literals), a type-scale (`--text-xs..lg` from the ~15 rem literals),
   `--radius-pill: 999px`, `--on-accent: #fff`; replace `rgb(249,250,251)` (`:1560/1567`)
   with `--bg-elev`; remove 5 unused tokens (`--chart-6`, `--z-overlay-hud`, `--space-6/7`,
   `--shadow-elev-3`). Med.
5. **Decide one import strategy + de-dupe the 6 double-imported sheets**, and start
   splitting base.css (god stylesheet) into reset/typography/buttons/forms/nav/layout.
   Med (structural; biggest long-term maintainability win).

---

## Reusable patterns / good practices already present

- **Clean 3-tier token layering** with a sanctioned hex home (tokens.css) and a guard
  enforcing it in feature code — solid foundation.
- **`--phn-radius` (65 uses) and `--phn-danger` (46 uses)** show real, consistent token
  adoption in the newer feature CSS.
- **Z-index is a documented contract** (`tokens.css:1`, `--z-*` tiers) enforced by
  `check-z-index` across all CSS — exemplary; other axes (radius, spacing) should copy this.
- **`color-mix(in oklab, var(--token) X%, ...)`** is used consistently to derive tints from
  base tokens rather than hardcoding shades — good, keeps things theme-derivable.
- **Chart palette referenced as `--chart-*` JS strings** keeps chart code hex-free while
  staying tokenized — a clean pattern for JS-driven coloring.
- **The data-table axis-tint cascade** (14 tokens + attribute selectors) is well-documented
  and fully consumed — a model for how to document a token subsystem.
- **No `!important` in base.css** — specificity kept clean.
