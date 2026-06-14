# Styling guide (`frontend/src/styles`)

How styling works in PH-Navigator V2 and where to find things. The app uses
**hand-written plain CSS** with CSS custom properties — no Tailwind, no
shadcn/ui, no CSS-in-JS. Radix UI provides unstyled behavior primitives; the
look is all in these stylesheets.

If you are about to add a feature, jump to
[How to style a new feature](#how-to-style-a-new-feature).

---

## The three-tier token model

```
Layer 1  styles/brand/        Vendored BLDGTYP brand: tokens.css (palette,
                              fonts, --svg-*) + self-hosted Geist fonts.
                              Generated — refresh with `pnpm run sync:brand`.
                              Do not hand-edit. (planning/archive/
                              css-brand-dependency-resilience/)
   │  (loaded first so Layer 2 can override, e.g. --font-primary)
   ▼
Layer 2  styles/tokens.css    App design tokens: spacing, type, radius,
                              shadow, z-index, semantic --phn-*, --chart-*,
                              data-table tints, etc. THE place to add a token.
   │
   ▼
Layer 3  base/shared/feature  The CSS that consumes the tokens:
                              - styles/reset.css        global resets + utils
                              - styles/base.css         shared component library
                              - styles/base-responsive  <=760px overrides
                              - styles/modals.css       modal chrome
                              - styles/panels.css       shared card-panel recipe
                              - shared/ui/**/*.css      shared-component styles
                              - features/<f>/*.css      feature styles
```

**Rule of thumb:** values come from Layer 2 (`var(--…)`), never as raw
literals. Raw hex in feature/shared `.css`/`.tsx` is blocked by `check:hex`.

---

## Import strategy (one rule)

`src/App.css` is the single global `@import` manifest.

- **Global + `shared/ui` stylesheets** are `@import`'d in `App.css`, once each.
- **Feature stylesheets** (`features/<f>/*.css`) are **TS-imported once** by
  that feature's route/entry component (e.g. `AperturesTab.tsx` does
  `import "../apertures.css"`) — **never** `@import`'d in `App.css`.

That is the whole convention. Do not import the same sheet both ways (the old
"6 double-imports" problem). Do not deep-`@import` one feature's CSS from
another feature.

---

## Token catalog

Source of truth is `styles/tokens.css` (+ `styles/brand/tokens.css`). Intent:

| Group | Tokens | Use for |
|-------|--------|---------|
| **Brand palette** (L1) | `--accent`, `--accent-dark/-light/-text`, `--highlight*`, `--bg-page/-elev/-card`, `--border-subtle/-card/-strong`, `--text-primary/-secondary/-muted`, `--svg-line-*`, `--svg-fill-dot`, `--svg-text`, `--ease` | brand-level color, surfaces, borders, text, blueprint SVG lines |
| **Spacing** | `--space-2 … --space-48` (px-named, 2px base) | margins, padding, gaps |
| **Type size** | `--fs-2xs … --fs-3xl` (8-step, rem) | `font-size`. Intentional literals: 13px table body, em sizes |
| **Radius** | `--radius-xs/sm/md/pill`, `--phn-radius`, `--phn-control-radius` | `border-radius` |
| **Shadow** | `--shadow-elev-1/2/3`, `--shadow-popover`, `--shadow-hud-1/2/3`, `--phn-shadow` | `box-shadow` |
| **Z-index** | `--z-base`, `--z-base-elevated`, `--z-sticky`, `--z-dropdown`, `--z-modal`, `--z-tooltip` | stacking (contract enforced by `check:z-index`) |
| **Semantic** | `--phn-success/-warning/-danger` (+ `-bg`), `--phn-focus`, `--text-on-accent`, `--phn-control-height` | status, focus rings, control sizing |
| **Charts** | `--chart-axis/-grid`, `--chart-1 … --chart-5` | recharts series (climate graphs) |
| **Report table** | `--report-status-missing/-question/-complete/-na` | report-table status dots |
| **Data table** | `--data-table-*` sizing + the `--data-table-tint-*` axis-tint cascade | the DataTable grid |
| **Info tooltip** | `--info-tooltip-bg/-fg` | shared `<InfoTooltip>` |

Fonts: brand sets `--font-primary` (Outfit) but **Layer 2 overrides it to
Geist** for body + tables; `--font-mono` is Geist Mono.

---

## Shared-class catalog (which sheet owns what)

Components that emit class strings but ship no CSS of their own (`AppMenu`,
`AppSubTabs`, `AutocompleteSelect`, `ModalDialog`, `DialogActions`, …) resolve
into these shared sheets:

| Sheet | Owns (class families) |
|-------|-----------------------|
| `styles/reset.css` | element resets (`*`, `html`, `body`, inputs), `.sr-only` |
| `styles/base.css` | the shared component library: buttons (`.primary-button`, `.secondary-button`, `.danger-button`, `.icon-button`, `.link-button`), `.chip` + variants, `.read-only-pill`, the three menu systems (`.app-menu*`, `.account-menu*`, `.catalog-menu*`), `.app-subtabs*` + `.pill-tab*`, `.autocomplete-select*`, forms (`.auth-form`, `.project-form`, `.settings-*`, `.form-error/-note`), page layouts (`.dashboard-page`, `.project-page`, `.project-row`, `.breadcrumbs`, `.page-heading`, …), `.empty-state`, `.diff-*` |
| `styles/base-responsive.css` | the `<=760px` overrides for the above |
| `styles/modals.css` | `.modal-backdrop`, `.modal-panel`, `.modal-header*`, `.modal-subtitle` |
| `styles/panels.css` | the shared **card-panel recipe** (border + radius + card bg) used by `.auth-panel`, `.modal-panel`, `.project-list`, `.data-table-wrap`, `.status-*`, … + the blueprint-grid decoration |
| `shared/ui/data-table/DataTable.css` | the DataTable grid |
| `shared/ui/report-table/ReportTable.css` | report tables + status pills/chips |
| `shared/ui/info-tooltip/InfoTooltip.css` | the `ⓘ` hover tooltip |
| `shared/ui/InlineHeaderNameEditor.css` | the inline rename header control; a feature reveals the edit affordance by putting `data-reveal-edit-on-hover` on its header element |
| `shared/ui/canvas/*.css` | shared apertures/envelope canvas chrome |
| `shared/ui/dimensions/DimensionChrome.css` | shared dimension delete affordance |
| `shared/ui/attachments/attachments.css` | the shared attachment chips/cells/panel (used by assets, envelope, equipment) |

TS components: import shared primitives from the `shared/ui` barrel
(`src/shared/ui/index.ts`) rather than reaching into individual files.

---

## How to style a new feature

1. **Reuse first.** Need a button/chip/menu/modal/table? It already exists in
   `base.css` / `shared/ui`. Use the class (this catalog) or the component
   (`shared/ui` barrel). Don't reinvent it.
2. **Create `features/<f>/<f>.css`** for genuinely feature-specific rules and
   **TS-import it once** in the feature's route/entry component. Do **not**
   add it to `App.css`.
3. **Use tokens, not literals.** Pull from the token catalog. If no token
   fits, add one to `styles/tokens.css` (don't hardcode). `check:hex` blocks
   raw hex in feature/shared CSS + TSX.
4. **Keep selectors local.** A feature sheet styles its own classes. If you
   need a shared utility, promote it to the shared layer instead of reaching
   across features (see the `.sr-only` / panel-recipe precedent).
5. **Stay under 500 lines** per `.css` (enforced by `check:sizes`). Over that
   needs `/* @size-exception: <doc> */` on line 1.
6. Run `make frontend-dev-check` (fast) and the full `make ci` before you
   finish.

---

## God-stylesheet split plan

`base.css` (~1.9k lines) and `DataTable.css` (~2.8k lines) are the two
remaining oversized sheets (both carry a `@size-exception`). P3 landed the
first, cascade-safe cuts; the rest is incremental.

**Done (P3):** `reset.css` (resets/utilities) and `base-responsive.css`
(`<=760px`) were split out of `base.css`. `styles/panels.css` absorbed the
shared card-panel recipe that had been living in `auth-page.css`.

**`base.css` — planned sections** (extract into `styles/base/*.css`, each
`@import`'d in current cascade order to stay neutral):

1. `buttons.css` — `.primary/.secondary/.danger/.icon/.link-button`, `.chip*`
2. `menus.css` — `.app-menu*`, `.account-menu*`, `.catalog-menu*`
3. `tabs.css` — `.app-subtabs*`, `.pill-tab*`, `.breadcrumbs`
4. `forms.css` — `.auth-form`, `.project-form`, `.settings-*`, `.form-*`,
   `.autocomplete-select*`
5. `layout.css` — `.dashboard-page`, `.project-page`, `.project-row`,
   `.page-heading`, `.project-header`, deleted-project list
6. `diff.css` — `.diff-*`, read-safe panels

**`DataTable.css` — plan:** split by concern into
`shared/ui/data-table/styles/*.css` (grid frame, header, cells/editors,
popovers/menus, row selection/fill, axis tints) `@import`'d from one
`DataTable.css` index. Higher risk (tightly coupled to the grid DOM) — do it
behind interaction-level Playwright verification, one section per commit.

When splitting: keep `@import` order identical to the source order so the
cascade does not move, and verify in the browser.

---

## Guards (run in `pnpm run check:all` → CI)

| Script | Enforces |
|--------|----------|
| `check:css-vars` | every `var(--x)` in feature/shared CSS resolves to a defined token (brand allowlist sourced from `styles/brand/tokens.css`) |
| `check:hex` | no raw `#hex` in feature/shared `.css`/`.tsx` (brand + `tokens.css` exempt) |
| `check:sizes` | `.ts/.tsx/.css` ≤ 500 lines unless line 1 has `@size-exception` |
| `check:z-index` | raw `z-index` integers must use the `--z-*` scale |
| `check:shape` | feature-package file shape |

---

## Deferred / follow-up

A focused follow-up covers the judgment-heavy CSS-token tail that needs design
review and per-literal visual verification — tokenizing the remaining
`rgb()/rgba()/hsl()` literals, extending `check:hex` to those forms + `.ts`
files (with sanctioned-palette exemptions), tightening the spacing/type scales,
and folding the last literal radii. See
`planning/features/css-token-guard-sweep/`.
