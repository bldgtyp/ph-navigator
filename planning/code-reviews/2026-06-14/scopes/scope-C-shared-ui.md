# CSS Review — Scope C: Shared UI Primitives (everything in `shared/ui` EXCEPT data-table)

Repo: `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-v2`
Scope: `frontend/src/shared/ui/report-table/**`, `frontend/src/shared/ui/dimensions/**`,
`InlineHeaderNameEditor.*`, and the CSS-less components (`AppMenu`, `AppSubTabs`,
`AutocompleteSelect`, `DialogActions`, `ModalDialog`, `ShellMessage`,
`TablePrimitiveStub`, `TopbarUnitToggle`, `WorkspaceTopbar`, `useOutsidePointerDown`).
Cross-checked against `frontend/src/styles/base.css`, `modals.css`, `tokens.css`.

Review only — no code changed.

## How styling works in this scope

The shared-ui layer splits into two styling strategies:

1. **Self-contained CSS-file primitives** — `report-table/ReportTable.css` (262 lines),
   `dimensions/DimensionChrome.css` (115 lines), and `InlineHeaderNameEditor.css`
   (103 lines). These are token-disciplined and guard-clean: every color goes through
   `var(--…)` (no raw hex), every `z-index` uses `--z-*`, and they consume L2 app tokens
   (`--report-status-*`, `--phn-danger`, `--space-*`, `--text-*`, `--accent`) plus L1 brand
   tokens (`--ease`, `--font-mono`, `--accent-text`). `color-mix(in oklab, …)` is the house
   idiom for tints. These three files are the model citizens of the layer.

2. **CSS-less components that borrow global classes from `base.css`** — every component
   without a co-located `.css` file emits `className` strings that resolve to definitions
   physically living in `src/styles/base.css` (or `modals.css`). Mapping:
   - `AppMenu.tsx` → `.app-menu*` (base.css:1695-1838+)
   - `AppSubTabs.tsx` → `.app-subtabs*` (base.css:1565-1693)
   - `AutocompleteSelect.tsx` → `.autocomplete-select*` (base.css:131-…, 178+)
   - `TopbarUnitToggle.tsx` → `.topbar-unit-toggle*` (base.css:608-662)
   - `WorkspaceTopbar.tsx` → `.topbar*`, `.breadcrumbs`, `.account-menu*` (base.css:368-606)
   - `ModalDialog.tsx` / `DialogActions.tsx` → `.modal-*` (modals.css) + `.primary-button`,
     `.secondary-button`, `.text-button`, `.form-error`, `.modal-actions` (base.css)
   - `ShellMessage.tsx` → `.auth-page`, `.auth-panel`, `.eyebrow` (base.css:56-95)
   - `TablePrimitiveStub.tsx` → `.data-table-wrap`, `.data-table`, `.data-table-empty`

This second strategy is the layer's central weakness: the component is in `shared/ui` but
its styling is invisible from the component file and lives in a 1960-line global stylesheet,
sometimes in a *different* feature's CSS. There is no barrel (`index.ts`), no README, and no
JSDoc cross-reference from the component to the class. A downstream author cannot discover
"how do I style/extend this" without grepping the whole repo.

Brand tokens are loaded remotely in `index.html:7`
(`https://bldgtyp.github.io/bt-branding/tokens/tokens.css`); `--ease`, `--accent`,
`--accent-dark`, `--accent-text`, `--font-mono` etc. originate there. L2 overrides/additions
live in `src/styles/tokens.css`.

---

## Findings by rubric

### 1. Drift / hardcoded values bypassing tokens

- `src/styles/base.css:1748` — **High.** `.app-menu__item { font-family: var(--font-sans); }`.
  `--font-sans` is **never defined anywhere** (0 definitions; this is the only usage in the
  whole codebase). The whole app's body font token is `--font-primary` (tokens.css:78). So the
  shared `AppMenu` dropdown silently falls back to the UA default sans-serif instead of Geist.
  This is a live, shipping typography bug in a shared primitive.
- `src/styles/base.css:1731` — **Med.** `.app-menu__panel { box-shadow: 0 8px 24px rgb(0 0 0 / 8%); }`
  is a hand-rolled elevation that bypasses the `--shadow-elev-1/2/3` token scale (tokens.css:55-57).
  The app already has `--phn-shadow` (= elev-2) for floating surfaces; the menu panel reinvents
  a fourth shadow value, so dropdowns and modals don't share an elevation language.
- `src/styles/base.css:1567` — **Med.** `.app-subtabs { background: rgb(249, 250, 251); }` is a
  hardcoded literal that exactly duplicates the value of `--bg-elev` (tokens.css:10). The token
  exists specifically for "the app-subtabs strip and other slightly-elevated surfaces" (per the
  comment at tokens.css:5-8), yet the strip itself doesn't use it. It also won't follow any
  future theme change.
- `src/styles/base.css:657` — **Med.** `.topbar-unit-toggle button.active { color: #ffffff; }`
  and `src/styles/base.css:1687` — `.app-subtabs[data-variant="pills"] .app-subtabs__tab.active
  { color: #ffffff; }`. Raw hex for "text on accent fill." These pass CI only because the
  `check:hex` guard scope is `src/features` + `src/shared/ui` (scripts/check-hex.mjs) and
  excludes `src/styles/**`. There is no `--accent-text-inverse` / on-accent token, so this
  literal is repeated wherever something sits on an accent fill.
- `ReportTable.css:8,126,177,203,241` / `DimensionChrome.css:80` / `InlineHeaderNameEditor.css:34`
  — **Low.** Radius literals `8px`, `4px`, `6px`, `999px` are used directly instead of
  `--radius-sm` (5px), `--phn-radius`, or `--phn-control-radius` (6px). `999px` (full pill) has
  no token at all. Consistent with the rest of the codebase, but it means the radius scale isn't
  actually enforced anywhere.
- `ReportTable.css:112,135,187,188` / `InlineHeaderNameEditor.css:46` — **Low.** Transition
  *durations* (`0.12s`, `0.16s`) are hand-typed. The easing (`var(--ease, …)`) is tokenized but
  no `--duration-*` token exists, so durations drift by feel (`0.12s` vs `0.16s` in the same
  file). System-wide pattern, not unique to this scope.

### 2. Off-brand / inconsistent color & semantics

- No off-brand colors inside the scope's own CSS files — they are semantically correct
  (`--report-status-*` for status dots, `--phn-danger` for validation text, `--accent` tints).
  Good.
- `src/styles/base.css:657,1687` — see rubric 1: on-accent text is a raw `#ffffff` rather than a
  semantic token; minor brand-consistency risk if accent ever shifts to a light tone. **Low.**

### 3. Duplication that should be shared

- **High (the headline finding).** There is no shared `.chip` / `.pill` / `.badge` base class.
  The "canonical filter-chip" (`report-status-chip`, ReportTable.css:172-199) is reused in
  exactly **one** downstream place — `src/features/envelope/components/MaterialsPanel.tsx:234`
  (via the `StatusFilterChips` component) — and only through the *component*, not the class.
  Meanwhile at least a dozen independent chip/pill/badge classes are reinvented across the app,
  each re-deriving `border-radius: 999px` plus its own padding/typography:
  - `.aperture-uvalue-chip`, `.aperture-name-pill` (features/apertures/apertures.css)
  - `.date-pill` (project_status.css:160, `padding: 4px 8px`)
  - `.status-badge` (project_status.css:134, `padding: 3px 8px`)
  - `.read-only-pill` (base.css:1478, `padding: 4px 9px`)
  - `.pill-tab` (base.css:1497)
  - `.model-file-chip`, `.model-loading-chip` (model_viewer.css)
  - `.material-drift-badge` (envelope.css:931), `.manufacturer-column__badge` (apertures.css)
  - `.refresh-dialog__edited-tag` (apertures.css:1378)
  - `.single-select-pill`, `.data-table-linked-record-pill`, `.data-table-add-field-type-pill`
    (DataTable.css)
  These use four+ different paddings (`3px 8px`, `4px 8px`, `4px 9px`, `7px 12px`) for the same
  visual primitive. Verdict on special-task (b): **`report-status-chip` is NOT the single
  canonical chip pattern in practice** — it is canonical only inside report-table; the rest of
  the app reinvents chips. There is no extractable shared chip primitive to point new authors at.
- **Med.** `TablePrimitiveStub.tsx` (a `shared/ui` primitive) renders `.data-table-wrap` /
  `.data-table` / `.data-table-empty`, whose definitions live in `data-table/DataTable.css`
  (DataTable.css:1, base.css:780). So the "stub" table primitive is silently coupled to the
  full DataTable feature's stylesheet. Two unrelated shared table primitives share style names
  defined in a third place — fragile, and confusing for a reader.

### 4. Naming / structure inconsistency

- **High (cross-layer leak).** `InlineHeaderNameEditor.tsx:103` uses `className="sr-only"`, but
  `.sr-only` is defined **only** in `src/features/equipment/equipment.css:1` — a *feature*
  stylesheet. A shared-ui primitive depends on a class owned by one feature; if equipment's CSS
  is ever code-split or removed, the shared editor's screen-reader label becomes visible. A
  visual-hiding utility belongs in `base.css`/`tokens` layer, not a feature.
- **Med.** `InlineHeaderNameEditor.css:49-56` hard-codes the *consumers'* parent selectors:
  `.assembly-header:hover …`, `.apertures-page__header:hover …`,
  `.aperture-element-card__header:hover …`. The shared primitive's reveal-on-hover behavior is
  driven by feature-specific ancestor class names baked into the shared CSS. Adding a new
  consumer requires editing the shared file to add another `:hover` selector — the dependency
  arrow points the wrong way (shared → feature).
- **Low.** Naming conventions are mixed across the layer: report-table uses strict BEM
  (`report-table__head-cell--primary`), AppMenu/AppSubTabs use BEM
  (`app-menu__item`, `app-subtabs__tab`), but AutocompleteSelect uses flat hyphen names
  (`autocomplete-select-listbox`, `autocomplete-select-toggle`) with no `__`/`--` structure, and
  TopbarUnitToggle uses bare element/state selectors (`.topbar-unit-toggle button.active`). No
  single convention.

### 5. Inline styles in TSX (justified vs not)

- `ReportTable.tsx:41,46,54,62,63,97` — **Justified.** All inline `style={gridStyle}` set a
  single CSS custom property `--report-table-columns` computed from the runtime column config
  (line 34-41). This is the correct way to pass a dynamic grid template to CSS — not a hardcoded
  design value. Good practice.
- `AutocompleteSelect.tsx:246-256` — **Justified.** Fixed-position listbox coordinates computed
  from `getBoundingClientRect()` (line 91-109). Inherently dynamic; cannot live in CSS.
- `AutocompleteSelect.tsx:289` — **Justified.** `--autocomplete-option-color` custom property
  fed from per-option data. Dynamic value, correct pattern.
- No unjustified inline styling found in scope. (This is a strength — see good practices.)

### 6. JS-driven styling

- No JS that writes layout/color directly. State→style is done correctly via `data-*` / `aria-*`
  attributes that CSS selects on: `AppSubTabs` (`data-active`, `aria-selected`),
  `TopbarUnitToggle` (`aria-checked`, `.active` class), report-status dots
  (`data-status="…"`), AttachmentChipCell (`data-has-files`). This is the right pattern and
  consistent. No findings.
- `TopbarUnitToggle`'s animated pill is pure CSS (`.topbar-unit-toggle:has(button:nth-child(2)
  .active)::before { transform: translateX(32px) }`, base.css:635) — no JS animation. Good.

### 7. Discoverability

- **High.** No barrel and no docs for the shared-ui layer. There is **no** `src/shared/ui/index.ts`
  and **no** README anywhere under `src/shared/ui/`. `report-table/` has its own `index.ts`
  (good, scoped), but the top-level primitives (`AppMenu`, `ModalDialog`, `AutocompleteSelect`,
  `TopbarUnitToggle`, `AppSubTabs`, `DialogActions`, etc.) are imported by deep relative paths
  with nothing advertising they exist. Answer to special-task (d): if a new feature needs a
  modal, chip, dropdown menu, unit toggle, or autocomplete, it is **not obvious** they already
  exist — discovery requires grep.
- **High.** For the CSS-less components, the styling is doubly hidden: the component file shows
  only `className="app-menu__item"` with zero pointer to where `.app-menu__item` is defined
  (base.css line ~1740, ~700 lines into a 1960-line file). No JSDoc, no `/* see base.css */`
  comment. A reader must full-text search `base.css` to learn how to theme/extend the primitive.
- **Med.** `dimensions/` ships only `DimensionChrome.css` — there is **no `DimensionChrome.tsx`**.
  The `.dimension-chrome-*` classes are applied by raw `className` strings inside feature
  components (`AssemblyCanvasOverlay.tsx`, `VerticalDimensionStrip.tsx`,
  `HorizontalDimensionStrip.tsx`, `DimensionLabel.tsx`). So this "primitive" is a naked
  stylesheet with no React wrapper and no usage docs — every consumer must know the exact class
  contract by reading the CSS.
- **Positive contrast:** `report-table/` is well-organized — co-located CSS, a barrel
  `index.ts`, a header comment pointing to its PRD (ReportTable.css:1-3), and exported types.
  It is the template the rest of the layer should follow.

---

## Top 5 highest-impact fixes

1. **Fix the broken font token in the shared menu.** `.app-menu__item` references the
   nonexistent `--font-sans` (base.css:1748). Change to `var(--font-primary)`. Live typography
   bug affecting every dropdown menu in the app. (Rubric 1, High.)
2. **Extract a single canonical `.chip` / `.pill` base class** into `base.css`, tokenize its
   radius/padding, and migrate `report-status-chip`, `read-only-pill`, `date-pill`,
   `status-badge`, `model-file-chip`, the aperture chips, and the data-table pills onto it.
   Today there is no shared chip primitive and ~12 reinventions with 4+ different paddings.
   (Rubric 3, High.)
3. **Add a `shared/ui/index.ts` barrel + a short README** listing the primitives (Modal,
   AppMenu, AutocompleteSelect, AppSubTabs, TopbarUnitToggle, DialogActions, ReportTable,
   InlineHeaderNameEditor) and, for each CSS-less one, the `base.css` section that styles it.
   Directly fixes the layer's worst problem: a new author can't find what exists or how it's
   styled. (Rubric 7, High.)
4. **Move cross-layer utilities/contracts to the shared layer.** Relocate `.sr-only` from
   `features/equipment/equipment.css:1` into `base.css` (it's a global a11y utility used by a
   shared primitive), and invert the `InlineHeaderNameEditor.css:49-56` hover dependency so the
   shared editor exposes its own hover hook (e.g. a `data-reveal-on-hover` parent contract)
   instead of hard-coding feature ancestor selectors. (Rubric 4, High/Med.)
5. **Tokenize the remaining literals in shared `base.css`:** replace `rgb(249,250,251)` with
   `--bg-elev` (base.css:1567), the `0 8px 24px …` menu shadow with `--phn-shadow`/`--shadow-elev-*`
   (base.css:1731), and introduce an on-accent text token to kill the `#ffffff` literals at
   base.css:657 and base.css:1687. Optionally extend the `check:hex` guard scope to
   `src/styles/**` so these can't recur. (Rubric 1/2, Med.)

---

## Reusable patterns / good practices present

- **`report-table/` is the gold standard:** co-located CSS, barrel `index.ts`, PRD reference
  comment, exported `ReportTableColumn` type, status primitives (`StatusDot`, `StatusPill`,
  `StatusFilterChips`) composed from one `report-status-dot` driven by `data-status`. Token-clean,
  guard-clean. Use it as the template for the whole layer.
- **Correct dynamic-style discipline:** the only inline styles in scope set CSS *custom
  properties* (`--report-table-columns`, `--autocomplete-option-color`) or computed fixed-position
  coordinates — never hardcoded colors/spacing. This keeps design values in CSS while letting JS
  supply runtime values. Worth codifying as the house rule.
- **State-via-attribute pattern is consistent:** `data-active`, `aria-selected`, `aria-checked`,
  `data-status`, `data-has-files` drive all conditional styling through CSS selectors rather than
  JS style writes. Good and uniform.
- **Pure-CSS animated toggle:** `TopbarUnitToggle`'s sliding pill uses `:has()` + `::before`
  transform (base.css:635) — no JS, correctly tokenized `--z-base` / `--z-base-elevated` and
  `var(--ease)`. Verifies special-task (c): z-index uses tokens (`--z-base`,
  `--z-base-elevated`), no raw `z-index` integers in scope; only the transition *duration*
  literals are untokenized (Low).
- **Token-clean co-located CSS:** `ReportTable.css`, `DimensionChrome.css`,
  `InlineHeaderNameEditor.css` contain zero raw hex, all `z-index` via `--z-*`, and use
  `color-mix(in oklab, var(--accent) N%, …)` as a consistent tint idiom.
