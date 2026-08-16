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
> doc is the *portable mirror*. Snapshot taken **2026-08-15**.

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
| `--attention-amber` | `#d97706` (amber) | non-status attention: Climate data gaps, Documentation write errors/zero meters |
| `--attention-amber-bg` / `-border` / `-text` | amber @ 9% / 32% / 74% | the amber **panel** trio — the Documentation write-error banner. Mix here, never in a feature sheet: these were hand-mixed per feature until the percentages drifted apart |
| `--report-status-needed` | alias of `--attention-amber` | status controls/pills: Needed |
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
- Standard control height: `--phn-control-height 38px`. Applied as a **floor**
  by the global `button` rule in `styles/base.css`, together with its padding.
  A button whose size comes from data rather than the design system — a canvas
  hit target stretched to `inset: 0` over a geometry-driven box — must opt out
  with its own `min-height` *and* `padding: 0`, or it silently keeps a 38px
  box and swallows clicks meant for whatever sits below it. Padding is a second
  floor a border-box cannot shrink past, so overriding `min-height` alone is
  not enough. Existing opt-outs: `.dimension-chrome-label-button`,
  `.dimension-chrome-delete-button`, `.assembly-segment-hit-target`,
  `.installs-modal__edge`, `.installs-modal__type`,
  `.installs-modal__type-action`, `.installs-modal__create-action`. Such a
  button usually also wants `border-radius: 0`
  — pill corners on a box tracing rectangular geometry read as a floating
  bubble, not as the thing itself. Class specificity already beats the element
  rule — do not weaken the global one.

## Interaction states (the state language)

Hover, selection, "armed", focus and disabled are **already designed**. They are
not per-screen decisions, and a new surface never picks its own ring color or
wash — it picks the row here that matches its kind of surface. Tokens live in
`styles/tokens.css` § Interaction states; `check:interaction-states` fails a
state rule that paints a ring or fill from anything else.

Two surface families, because the app has two kinds of thing to point at:

**A. Row / list surfaces** — sidebar rows, menu items, legend rows, ghost and
icon buttons. The background tints; nothing rings.

| State | Token | Reads as |
|-------|-------|----------|
| Hover (list row) | `--state-row-hover-bg` | barely-there **neutral** wash (5% text on card) |
| Selected (list row) | `--state-row-selected-bg` + `--state-row-selected-text` | teal `--accent-light` fill + accent text |
| Hover (ghost/icon button, menu item) | `--state-ghost-hover-bg` | quiet elevated wash |
| Hover / selected (DataTable) | `--data-table-hover-bg` / `--data-table-selected-bg` | accent 6% / 8% — the grid's own denser pair |

The split is deliberate: **hover is neutral, selection is teal.** A hover that
uses accent competes with the selected row and the list stops reading.

**B. Geometry surfaces** — anything drawn: the aperture builder canvas, the
Installs key view, the assembly canvas. The thing under the cursor is an object
with edges, so it takes a **ring**, optionally with a tint.

| State | Ring | Tint |
|-------|------|------|
| Hover | `--state-hover-ring` (magenta `--highlight-text` @76%) | `--state-hover-tint` (@8%) |
| Selected / armed | `--state-selected-ring` (`--accent`) | `--state-selected-tint` (accent @14%) |

**Ring mechanics — this part is not optional:**

```css
.thing {                       /* at rest: the ring exists, invisible */
  outline: var(--state-ring-width) solid transparent;
  outline-offset: var(--state-ring-offset);   /* -2px → drawn INSIDE the box */
}
.thing:hover,
.thing:has(.thing__hit:focus-visible) {
  outline-color: var(--state-hover-ring);
  background: var(--state-hover-tint);
}
```

- **Transparent at rest, colored by state** — never add/remove the outline, or
  the object moves under the cursor.
- **Inset (`outline-offset` negative), never outset.** An outset ring on a
  drawn object is clipped by the neighbouring band, the canvas edge, or any
  scrolling ancestor — it visibly cuts off on the top/left. (`box-shadow:
  inset 0 0 0 2px …` is the alternative when `outline` is already spoken for.)
- **Keyboard focus mirrors hover** on hit-target overlays (`:has(… :focus-visible)`),
  because the visible object and the focusable button are different elements.
  Ordinary controls just take the standard focus ring, `--phn-focus`.
- **Selection must beat hover**: order the selected rule last, or state it with
  a higher-specificity selector.

**Documented exception — canvas *mode* palettes.** The assembly canvas encodes a
*mode*, not just a state: pick = `--assembly-pick-ring` (green), paint/paste =
`--assembly-paint-tint` + `--assembly-paint-pulse` (gold), add =
`--assembly-canvas-add`. A mode palette is a deliberate, named, feature-scoped
extension — add one only when a surface genuinely has modes, name it in the
feature's token block, and say so here.

**Disabled** is opacity + `cursor: not-allowed`/`default` and no state paint —
never a greyed one-off color.

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
| Segmented control | `SegmentedControl` / `.phn-segmented-control*` | mutually exclusive inline single-select; native radio semantics; `xs`/`sm` compact chrome and `md` content pills |
| Empty state | `.empty-state` | zero-data placeholder w/ heading + copy |
| Autocomplete select | `AutocompleteSelect` / `.autocomplete-select*` | typeahead single-select |
| Status control | `StatusSelect` / `StatusPill` / `.status-select` | editable pill-select and shared read-only pill, including built-in DataTable status cells; tone-colored via `--report-status-*` |
| Evidence meters | `StatusAxisRollup` (`features/project_document/StatusVocabulary`) | the three Spec./Datasheet/Site-Photo meters, wherever documentation progress is shown. Green at complete, amber count at zero, empty track when the axis tracks nothing. Pass `linkFor` to make each meter a deep link (Overview) or omit it to render in place (Documentation) — that one prop is the *only* sanctioned difference between surfaces. Consumers size their meter column from `--status-rollup-min` |
| Menus | `.app-menu*` / `.account-menu*` / `.catalog-menu*` | topbar dropdown menus |
| Forms | `.auth-form`, `.project-form`, `.settings-*`, `.form-error/-note` | labeled field stacks + validation |
| Modal | `ModalDialog` / `DialogActions`; `.modal-backdrop/-panel/-header` | dialogs |
| Card panel | panels.css recipe (`.auth-panel`, `.status-*`, `.project-list`, …) | bordered card surfaces + blueprint-grid deco |
| **DataTable** | `shared/ui/data-table` (`<DataTable>`) | the flagship grid — dense, uniform, axis-tinted filter/sort/group |
| Report table | `shared/ui/report-table` (`report-status-chip`) | status-dot / status-chip report grids |
| Hover tooltip | `<Tooltip>` (`shared/ui/tooltip`) | the standard hover/focus hint on a control — dark bubble, `TOOLTIP_HOVER_DELAY.medium/long`, `placement`. Prefer it over a native `title`. A **disabled** button fires no pointer events, so wrap it in an inline-flex span, put the tooltip on the span, and set `pointer-events: none` on the disabled button — otherwise the state that most needs explaining ("why is this greyed out?") is the one with no hint |
| Canvas hint | `[data-toolbar-tooltip]` (`shared/ui/canvas/canvas-hint-tooltip.css`) | pure-CSS label for drawing-tool toolbar buttons |
| Info tooltip | `<InfoTooltip>` (ⓘ) | multi-line hover help behind a small ⓘ trigger (U-Value chip, assembly thermal header, status vocabulary). Renders *through* `<Tooltip>`, so it is portalled and collision-aware — an absolutely-positioned panel gets clipped by the first scrolling ancestor |
| Inline header editor | `InlineHeaderNameEditor` | rename-on-hover header control |
| Element sidebar | `shared/ui/element-sidebar` (`<ElementSidebar>`) | shared object-list rail (Envelope Assemblies, Aperture Types) — "1A Quiet List": ghost header with a Sort-order menu (`AppMenu`), neutral hover / teal-only selection, hover-reveal grip + ghost action cluster, groups-as-dividers with drag-between-groups + a top add-group divider |
| Attachments | `shared/ui/attachments` | file chips/cells/panel (assets, envelope, equipment) |
| Breadcrumbs / page heading / topbar | `.breadcrumbs` / `.page-heading` / `.topbar` | app chrome |
| Unit toggle | `TopbarUnitToggle` / `SegmentedControl` | global SI ⇄ IP preference toggle; modal adapters use the same shared primitive |

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
   enforced by `check:typography` + `make typography-eval`.
   **`check:typography` cannot see the bug you are most likely to ship.** It
   audits declarations that exist; the common failure is a declaration that
   does *not* — an element with no `font-size` inherits the 16px document
   default, larger than anything this dense app renders, and the source guard
   stays green. Only the rendered sweep catches it. Two habits follow: give a
   dense container an explicit type floor (`.documentation-record`,
   `.documentation-progress`) so a forgotten size lands somewhere sane, and
   remember the sweep only sees what a state actually renders — the Overview
   group rows hid a 16px fall-through for months because the only Overview
   state in the manifest was the *collapsed* one.
3. **Reuse first.** Need a button/chip/menu/modal/table? It exists — use the
   class or the `shared/ui` component. Don't reinvent.
3b. **States are reuse too.** Hover / selected / armed / focus come from
   § Interaction states — the same tokens the sidebar, the DataTable and the
   canvases already use. Inventing a ring color or a hover wash for one screen
   is the same error as hand-rolling a button. (`check:interaction-states`.)
4. **Roles, not places.** Feature CSS never restyles a shared primitive's
   typography or shape.
5. **DataTable uniformity is an iron-law.** Basic affordances are parent-owned,
   required, and structurally guarded — never per-table opt-in.
6. **Files ≤ 500 lines** (`check:sizes`); feature CSS is TS-imported once by its
   route, never `@import`'d into `App.css`.

## Modal contract (blessed pattern)

Every modal is `ModalDialog` (the shell) + `DialogActions` (the footer). Do not
hand-roll a backdrop, panel, or footer. The contract:

- **Dismiss — one canonical path.** Footer `Cancel` (left) is the dismiss.
  `ModalDialog`'s header "Close" is OFF by default (`showHeaderClose={false}`);
  only read-only viewers with no footer opt back in with `showHeaderClose`.
- **Footer — always `DialogActions`.** Cancel (`secondary-button`, left) + one
  styled primary (`primary-button`, right); `danger` prop swaps the primary to
  `danger-button`; `extraActions` adds secondary/tertiary buttons between the
  two anchors. No bare/unstyled action buttons. The footer is Cancel/primary
  and nothing else: tools that act on the dialog's body (bulk apply, copy-to)
  belong with the control that arms them or in `headerAccessory`. A dialog that
  writes as you interact has no honest `Cancel`, so stage the edits and write
  them on the primary instead (the Installs modal's `installs-draft.ts`).
- **Labels.** Cancel is literally "Cancel"; the primary is a specific verb
  (`Create material`, `Delete room`, `Save`); busy state swaps to an ellipsis
  form (`Saving…`).
- **Body stack.** Wrap dialog content in `.modal-form`; it owns the vertical
  rhythm (`--space-16` grid gap). Use `.modal-lede` for the summary line under
  the title. A dialog with its own body class (`.segment-properties-form`,
  `.envelope-import`, …) may override the gap, not re-invent the stack.
- **Chrome separators.** `.modal-header` and `.modal-actions` carry a hairline
  rule (and their own padding) by default, app-wide — a dialog does not opt in,
  and feature CSS must not re-declare the border. Header accessories (a unit
  toggle, a `⋯` menu) belong in `ModalDialog`'s `headerAccessory`, above the
  rule — not loose at the top of the body.
- **Box.** Shared `.modal-panel`. Oversized modals that scroll add
  `.modal-panel--resizable` for the lower-right resize grip.
- **Unbounded content pins the footer.** If the body can grow without bound (a
  list of rows, a library that grows with the project), pass `scrollBody` —
  `.modal-panel--scroll-body` keeps the header and `.modal-actions` fixed and
  scrolls the body, so Cancel/primary are never scrolled off. A dialog whose
  body has its own scroll region (one column of a two-column layout, e.g. the
  Installs modal's type list) sets `overflow: hidden` on the body and scrolls
  that region instead.
- **Backdrop-click.** OFF by default (forms can't lose input to a stray click);
  read-only viewers opt in with `dismissOnBackdrop`.

## How this document is kept in front of the work

A design system that lives only in a doc gets re-invented by whoever is fixing
"just one CSS line". Three mechanisms carry it, and all three are load-bearing:

1. **Routing.** `CLAUDE.md`'s dispatch table sends *any* user-visible change —
   including a one-line tweak — here first, and `frontend/.instructions.md`
   opens with a four-question visual pre-flight (component? state? dialog?
   token?).
2. **Presence at the moment of the edit.** `.claude/hooks/ui-design-system-hook.py`
   (registered as a `PreToolUse` hook on Edit/Write) fires whenever a frontend
   `.css` or feature/shared `.tsx` is edited and injects the state/component/
   modal/token rules into the working context, whether or not anyone opened
   this file. Editing `styles/tokens.css` adds a note that new tokens are a
   design-system change, not a local fix.
3. **Guards.** `pnpm run check:all` rejects off-system values (see § Guards);
   `check:interaction-states` specifically rejects a hover/selected/armed rule
   that paints from anything but the state language.

When you *do* extend the system, update this file in the same commit — the
hook and the guards point here, so a stale doc silently becomes the wrong
instruction for every future agent.

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
zero-debt) · `check:interaction-states` (hover/selected/armed rules paint from
the state tokens; baselined debt only) · `check:sizes` (≤500 lines) ·
`check:shape` (feature file shape).
Plus `make typography-eval` — the rendered 23-state computed-style sweep, and
its own GitHub workflow rather than part of `make ci`. Adding a state to
`frontend/scripts/font-audit-states.mjs` both sweeps and enforces it; add one
whenever UI only exists in a disclosed/expanded state. Its `variantCeiling` is
a ratchet: lower it as consolidation lands, never raise it to bless drift. A
ceiling held open for *pre-existing* drift carries a `$knownFailure` note in
`typography-rendered-contract.json`, which the evaluator prints on every run so
it cannot go quiet — as of 2026-08-16 it is held at 30 pending removal of the
30th variant.

## Related docs

- `frontend/src/styles/README.md` — implementation styling guide (the how).
- `context/UI_UX.md` — UI intent, common elements, DataTable model (§1.7),
  multi-page flows, and the §4 state-indicator cheatsheet — which covers
  *document* state (clean / dirty / locked / read-only). **Interaction** state
  (hover / selected / armed / focus) lives here, in § Interaction states.
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
