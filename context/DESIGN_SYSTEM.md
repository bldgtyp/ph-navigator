# PH-Navigator Design System

The single source-of-truth **index** for PH-Navigator's visual language: the
design tokens (color, type, spacing, radius, shadow, z-index), the blessed
component inventory, and the doctrine every new piece of UI must follow.

This document has **two audiences and two modes**:

1. **In-repo (agents + humans).** Use it as the map: it names every token
   group and every reusable component, then points at the real source
   (`frontend/src/styles/`) and the guards that keep the app honest. When you
   build UI, you conform to what's here — you don't re-decide it.
2. **Portable spec (Claude-Design and other external tools).** The
   §"Portable spec" block below is **self-contained** — concrete values, no
   repo access required. Upload *this file* to Claude-Design so it generates
   on-brand components instead of inventing a fifth grey. See
   §"Using this with Claude-Design".

> **Source of truth vs. snapshot.** The authoritative values live in
> `frontend/src/styles/brand/tokens.css` (Layer 1, brand) and
> `frontend/src/styles/tokens.css` (Layer 2, app). The concrete values printed
> in the Portable spec are a **hand-maintained snapshot of the *effective*
> (Layer-2-resolved) values** so an external tool can read them without the
> repo. When they drift, the CSS wins — refresh this snapshot from
> `tokens.css`. `check:css-vars` / `check:hex` keep the *code* honest; this
> doc is the *portable mirror*. Snapshot taken **2026-07-18**.

---

## Design principles (the personality)

PH-Navigator is a **dense, technical, professional data tool** for Passive
House consultants — closer to AirTable / a spreadsheet IDE than to a marketing
site. Design decisions serve legibility of a lot of structured data on one
screen, not visual drama.

- **Information-dense, calm chrome.** Tight spacing (2px base step), small type
  (13px table body), quiet greys. Color is used sparingly and meaningfully —
  the steel-blue accent marks the active/primary thing; magenta is a rare
  highlight; status has its own reserved palette.
- **Hand-written plain CSS on tokens.** No Tailwind, no shadcn/ui, no
  CSS-in-JS. Radix UI supplies *unstyled* behavior primitives; all look lives
  in the stylesheets. New UI reuses existing components before adding CSS.
- **Roles, not places.** A button in a modal renders identically to the same
  button on a page. Shared owners compose a role once; features pick a role,
  never restyle a shared primitive.
- **Light theme today.** The app runs light-only (`color-scheme: light`). The
  brand layer defines a full dark theme, so design *for light* but don't hard-
  code choices that would block dark later (use the semantic tokens).
- **Uniformity is enforced, not requested.** Core affordances (e.g. the
  DataTable) are parent-owned and guarded so every instance behaves the same —
  never per-screen opt-in.

Brand lineage: BLDGTYP, LLC — <https://github.com/bldgtyp/bt-branding> is the
upstream brand token/font source (Layer 1, vendored into the repo).

---

# Portable spec

*Self-contained — safe to hand to Claude-Design with no repo. Values are the
effective (Layer-2-resolved) app values as of the snapshot date above.*

## Color

### Brand palette

| Role | Token | Value | Notes |
|------|-------|-------|-------|
| Accent (Steel Blue) | `--accent` | `#3E93AE` | The primary/active color. Buttons, active tabs, selection, focus. |
| Accent light | `--accent-light` | `#d6ebf1` | Tint fills, hover washes. |
| Accent dark | `--accent-dark` | `#2d6b80` | Accent text on light bg, hover-darken. |
| Accent text | `--accent-text` | = `--accent-dark` | Accessible accent *text* on light surfaces. |
| Highlight (Magenta) | `--highlight` | `#E23489` | Rare emphasis only — not a general accent. |
| Highlight light / dark | `--highlight-light` / `--highlight-dark` | `#fce8f1` / `#C42977` | |
| Highlight text | `--highlight-text` | = `--highlight-dark` | Accessible magenta text. |

### Surfaces (the surface stack)

| Role | Token | Value | Use for |
|------|-------|-------|---------|
| Page body | `--bg-page` | `rgb(247,248,249)` | Project-page workspace body. |
| Elevated | `--bg-elev` | `rgb(249,250,251)` | App-subtabs strip, slightly-raised surfaces. |
| Card / chrome | `--bg-card` | `#ffffff` | Topbar, project tabs, cards, modals. |

*(Layer 1 brand light-theme sets these to near-white; Layer 2 tints them the
greys above — the greys are what actually renders.)*

### Text & borders

| Token | Value | Use |
|-------|-------|-----|
| `--text-primary` | `#111111` | Body/heading text. |
| `--text-secondary` | `#6b7280` | Labels, secondary text. |
| `--text-muted` | `#9ca3af` | Placeholder, disabled, hints. |
| `--border-subtle` / `--border-card` | `#e5e7eb` | Default hairlines, card edges. |
| `--border-strong` | `#c9cbd0` | Emphasized dividers. |
| `--text-on-accent` | `#ffffff` | Text on an accent-filled surface. |

### Status (semantic)

| Token | Value | Meaning |
|-------|-------|---------|
| `--phn-success` (+ `-bg`) | derived from `--accent-dark` | success |
| `--phn-warning` (+ `-bg`) | warm amber (from `--highlight-text`) | warning |
| `--phn-danger` (+ `-bg`) | crimson-derived | danger / destructive |
| `--report-status-missing` | `#d97706` (amber) | report cell: missing evidence |
| `--report-status-question` | `#0ea5b7` (cyan) | report cell: open question |
| `--report-status-complete` | `#16a34a` (green) | report cell: complete |
| `--report-status-na` | `#9ca3af` (grey) | report cell: N/A |

### Chart series (categorical, color-blind-aware)

`--chart-1..5`: `#2563eb` (blue), `#dc2626` (red), `#16a34a` (green),
`#d97706` (amber), `#7c3aed` (violet). Axis `--chart-axis #6b7280`, grid
`--chart-grid #e5e7eb`.

## Typography

**Two families only:** **Geist** (content, body, tables) and **Geist Mono**
(chrome, labels, data, actions, uppercase UI). *(Brand defaults to Outfit;
the app overrides `--font-primary` to Geist — Geist + Geist Mono are what
render.)*

**8-step size scale (rem, `--fs-*`) — the only allowed font sizes:**

| Token | rem | ~px | Typical role |
|-------|-----|-----|--------------|
| `--fs-2xs` | 0.68 | ~11 | micro labels |
| `--fs-xs` | 0.72 | ~11.5 | table headers, chips |
| `--fs-sm` | 0.78 | ~12.5 | dense secondary text |
| `--fs-md` | 0.875 | 14 | **default body/UI** |
| `--fs-lg` | 1.0 | 16 | emphasized body |
| `--fs-xl` | 1.1 | ~17.6 | small headings |
| `--fs-2xl` | 1.25 | 20 | section headings |
| `--fs-3xl` | 1.55 | ~24.8 | page headings |

Named exceptions (roles a scale step can't express):
`--fs-display` `clamp(2rem,5vw,3.1rem)` and `--fs-display-sm` (auth/page hero),
`--fs-canvas-annotation` `10px` (labels drawn over a technical drawing).
Table body is a fixed `--data-table-font-size: 13px`.

- **Weights** (`--fw-*`): 400 regular / 500 medium / 600 semibold / 700 bold.
  (550 & 650 are abolished.)
- **Tracking**: `--tracking-normal 0`; uppercase UI text pairs
  `text-transform: uppercase` with `--tracking-caps 0.05em`.
- **Line-height** (`--lh-*`): 1 solid / 1.15 tight / 1.2 heading / 1.25 ui /
  1.5 body.

## Spacing

px-named scale (self-documenting: `--space-8` == 8px), 2px base:

`--space-2 4 6 8 10 12 14 16 18 20 24 32 48`

## Radius

`--radius-2xs 3` · `xs 4` · `sm 5` (= `--phn-radius`) · control `6`
(`--phn-control-radius`) · `7` · `md 8` · `9` · `lg 10` · `xl 12` ·
`pill 999` (fully-rounded chips/toggles).

## Shadow / elevation

Ascending: `--shadow-elev-1/2/3`; `--shadow-popover` (dropdowns/popovers);
`--shadow-hud-1/2/3` (floating 3D-viewer cards). `--phn-shadow` = `elev-2`.
(Plus exact-value feature shadows kept as tokens to avoid pixel drift.)

## Z-index contract

`--z-base 0` < `--z-base-elevated 1` (in-widget only) < `--z-sticky 10` <
`--z-dropdown 100` < `--z-modal 1000` < `--z-tooltip 2000`. Enforced by
`check:z-index` — never a raw integer.

## Motion & focus

- `--transition-fast 0.16s` for hover/focus; pair with `--ease`
  `cubic-bezier(.2,.6,.2,1)`. `--transition-base 0.3s ease` for larger moves.
- Focus ring: `--phn-focus` = `0 0 0 3px` accent @ 24%.
- Standard control height: `--phn-control-height 38px`.

## Component inventory (the blessed building blocks)

Reuse these before writing new CSS. In-repo, import React primitives from the
`shared/ui` barrel (`frontend/src/shared/ui/index.ts`); class-only components
resolve into the shared sheets. For Claude-Design, treat the descriptions as
the spec to reproduce.

| Component | Class / import | Use for |
|-----------|----------------|---------|
| Primary / Secondary / Danger button | `.primary-button` / `.secondary-button` / `.danger-button` | main actions; 38px tall, accent-filled primary |
| Text / Link / Icon button | `.text-button` / `.link-button` / `.icon-button` | low-emphasis + icon-only actions |
| Chip | `.chip` + `.chip--sm/--md/--outline/--interactive` | compact labels/tags; pill radius |
| Read-only pill | `.read-only-pill` | mono uppercase "read-only" warning badge |
| Pill tabs / sub-tabs | `.pill-tab` / `.pill-tab-list`, `.app-subtabs` | in-page section switching |
| Empty state | `.empty-state` | zero-data placeholder w/ heading + copy |
| Autocomplete select | `AutocompleteSelect` / `.autocomplete-select*` | typeahead single-select |
| Menus | `.app-menu*` / `.account-menu*` / `.catalog-menu*` | topbar dropdown menus |
| Forms | `.auth-form`, `.project-form`, `.settings-*`, `.form-error/-note` | labeled field stacks + validation |
| Modal | `ModalDialog` / `DialogActions`; `.modal-backdrop/-panel/-header` | dialogs |
| Card panel | panels.css recipe (`.auth-panel`, `.status-*`, `.project-list`, …) | bordered card surfaces + blueprint-grid deco |
| **DataTable** | `shared/ui/data-table` (`<DataTable>`) | the flagship grid — dense, uniform, axis-tinted filter/sort/group |
| Report table | `shared/ui/report-table` (`report-status-chip`) | status-dot / status-chip report grids |
| Info tooltip | `<InfoTooltip>` (ⓘ) | hover help; dark panel |
| Inline header editor | `InlineHeaderNameEditor` | rename-on-hover header control |
| Attachments | `shared/ui/attachments` | file chips/cells/panel (assets, envelope, equipment) |
| Breadcrumbs / page heading / topbar | `.breadcrumbs` / `.page-heading` / `.topbar` | app chrome |
| Unit toggle | `.topbar-unit-toggle` | SI ⇄ IP animated toggle |

---

# In-repo doctrine & integration

## Hard rules (authoring)

1. **Tokens, never literals.** Color, size, spacing, radius, shadow, z-index in
   feature/shared CSS come from `var(--…)`. If no token fits, add one to
   `styles/tokens.css` — don't hardcode. (`check:hex`, `check:css-vars`,
   `check:z-index`.)
2. **Typography from the vocabulary only.** `font-family/-size/-weight`,
   `letter-spacing`, `line-height` take only `--font-*` / `--fs-*` / `--fw-*`
   / `--tracking-*` / `--lh-*` (or `inherit`). No px/em/rem/`calc()`/`clamp()`
   size literals; `font:` shorthand banned (except `font: inherit`). Zero-debt,
   enforced by `check:typography` + `make typography-eval` (29-variant ceiling).
3. **Reuse first.** Need a button/chip/menu/modal/table? It exists — use the
   class or the `shared/ui` component. Don't reinvent.
4. **Roles, not places.** Feature CSS never restyles a shared primitive's
   typography or shape.
5. **DataTable uniformity is an iron-law.** Basic affordances are parent-owned,
   required, and structurally guarded — never per-table opt-in.
6. **Files ≤ 500 lines** (`check:sizes`); feature CSS is TS-imported once by its
   route, never `@import`'d into `App.css`.

## Where the real thing lives

| Layer | File | What |
|-------|------|------|
| L1 brand (vendored, generated) | `frontend/src/styles/brand/tokens.css` + `fonts.css` | palette, fonts, SVG helpers, dark theme. `pnpm run sync:brand` to refresh; do not hand-edit. |
| L2 app tokens | `frontend/src/styles/tokens.css` | **the place to add a token** — spacing, type, radius, shadow, z, semantic, data-table. |
| L3 consumers | `styles/reset.css`, `base.css`, `base-responsive.css`, `modals.css`, `panels.css`, `shared/ui/**`, `features/**` | the CSS that consumes tokens. |

Full styling how-to (import strategy, which sheet owns which class, the god-
stylesheet split plan, the full guard list): **`frontend/src/styles/README.md`**.

## Guards (in `pnpm run check:all` → CI)

`check:css-vars` (every `var()` resolves) · `check:hex` (no raw hex) ·
`check:z-index` (z-scale only) · `check:typography` (token vocabulary,
zero-debt) · `check:sizes` (≤500 lines) · `check:shape` (feature file shape).
Plus `make typography-eval` — the rendered 22-state computed-style sweep.

## Related docs

- `frontend/src/styles/README.md` — implementation styling guide (the how).
- `context/UI_UX.md` — UI intent, common elements, DataTable model (§1.7),
  multi-page flows, state-indicator cheatsheet.
- `context/ui/pages/*.md` — per-page design narratives (read only the page in
  hand).
- `context/CODING_STANDARDS.md` — frontend engineering standards.
- <https://github.com/bldgtyp/bt-branding> — upstream brand source.

---

## Using this with Claude-Design

When Claude-Design (or any external design tool) asks **"Do you have a design
system?"** — yes, this file is it.

1. **Upload this file** (`context/DESIGN_SYSTEM.md`) as the design-system
   reference. The Portable-spec block is self-contained; it needs no repo.
2. **Tell it the constraints** that don't fit a token table: dense/technical
   AirTable-adjacent tool, light theme, plain CSS on the tokens above (no
   Tailwind/shadcn), reuse the component inventory before inventing new
   components.
3. **Bring its output home:** translate any concrete values it emits back to
   the matching `--token`, add genuinely-new tokens to `styles/tokens.css`, and
   run `pnpm run check:all` — the guards reject anything that bypassed the
   system.

Keep the snapshot current: when `styles/tokens.css` or the brand layer changes
materially, refresh the Portable-spec values and bump the snapshot date so what
you hand Claude-Design still matches what renders.
