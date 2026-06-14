# CSS Review — F: Small Features + Cross-Cutting Sweep

Scope: `project_status`, `project_document`, `equipment`, `catalogs`, `auth`
(features WITH css); `mcp`, `projects`, `table_views` (features WITHOUT
dedicated css). Review-only; no code modified. All citations are real
`file:line`.

## How styling works in this scope

Three shared layers feed every page: L1 remote brand tokens
(`https://bldgtyp.github.io/bt-branding/tokens/tokens.css`, linked from
`index.html:7` — defines `--accent`, `--text-*`, `--border-*`, `--bg-*`,
`--font-*`, `--svg-*`, `--ease`, `--transition-base`, `--radius-sm`); L2
app tokens (`src/styles/tokens.css` — overrides `--font-primary`→Geist,
`--radius-sm`→5px, adds `--space-1..7`, `--z-*`, `--shadow-elev-*`,
`--phn-*`, `--report-status-*`, `--chart-*`); and L3 shared component
classes split across THREE files — `src/styles/base.css` (1967 lines:
buttons, forms, panels, headings, `.eyebrow`, tooltips, tabs, menus),
`src/styles/modals.css` (38 lines: `.modal-*`), and the canonical chip in
`src/shared/ui/report-table/ReportTable.css:172` (`.report-status-chip`).

Wiring is unusual and matters for this review: `src/App.css` is a global
aggregator that `@import`s tokens, base, modals, AND five feature
stylesheets — `auth-page.css`, `version-controls.css`, `equipment.css`,
`project_status.css`, `catalogs.css` (`src/App.css:1-13`). Those five are
ALSO imported by their own route components. So every "feature" rule in
my scope is in fact loaded globally and competes in the global cascade —
which is exactly why a shared utility (`.sr-only`) defined inside
`equipment.css` silently works everywhere. (Other features —
`climate.css`, `apertures.css`, `attachments.css`, `model_viewer.css` —
are NOT in the aggregator and load only via their route component. The
import strategy is itself inconsistent.)

Reuse quality varies sharply by feature:
- **`projects` — exemplary.** No css file, no inline static styles. Pure
  consumption of shared classes (`secondary-button`, `danger-button`,
  `form-error`, `form-note`, `settings-*`, `project-*`, `modal-actions`,
  `empty-state`, `read-safe-*`). This is the model the other features
  should follow.
- **`mcp`, `table_views` — no UI yet.** No `.tsx` files at all (only
  `api.ts`/`hooks.ts`/`types.ts` and `.gitkeep` placeholders). "Styled
  via shared classes" is vacuously true; nothing to flag.
- **`auth` — high reuse, low custom.** 61-line css adds only the page
  grid + decorative blueprint backdrop; everything else is shared.
- **`catalogs` — medium reuse.** Reuses buttons/modals well but
  hand-rolls a full HTML `<table>` (`.catalog-table`) instead of the
  shared `<DataTable>`.
- **`equipment`, `project_status`, `project_document` — most reinvention.**
  They duplicate shared primitives (tooltip, icon-button, danger-button,
  the panel border rule) and roll their own chips/badges/pills.

Good news on the undefined-TOKEN sweep: every `var(--…)` referenced in
the five in-scope stylesheets resolves to a known token (the only
feature-local one, `--save-state-dot`, is defined in-file at
`version-controls.css:40`). No undefined-token bugs here. The analogous
problem instead shows up on the **className side**: several classes are
referenced in TSX but defined in NO stylesheet (see Rubric 7).

---

## Rubric 1 — Drift / hardcoded values bypassing tokens

**Headline systematic drift — `--space-*` tokens are used ZERO times.**
The scale `--space-1..7` (4/8/12/16/24/32/48) exists in
`tokens.css:47-53` but is referenced by NONE of the five in-scope
stylesheets. Instead there are **68 raw-px** `gap`/`padding`/`margin`
declarations spanning **17 distinct values**, including off-grid ones
that don't map to the scale (5px, 7px, 9px, 14px, 18px, 38px). Per-file:
`project_status.css` 21, `version-controls.css` 21, `equipment.css` 15,
`catalogs.css` 8, `auth-page.css` 3. — **High** (this is the single
biggest consistency lever in scope).

**Font-size drift — no type scale.** 12 distinct rem font-sizes across
the five files (0.68, 0.72, 0.76, 0.78, 0.8, 0.85, 0.86, 0.88, 0.9,
0.875, 1, 1.08rem) with near-duplicates that betray copy-paste tuning
(0.78 vs 0.8; 0.85 vs 0.86; 0.875 vs 0.88). There is no `--font-size-*`
token family to anchor against. — **Med**.

Specific hardcoded values:
- `project_status.css:79` — `color: white;` — **Med**. Named color; the
  `check:hex` guard misses it, and it is inconsistent with the
  `#ffffff` used for the same "filled accent button text" in
  `base.css:1331`.
- `project_status.css:185` — `border-radius: 4px;` (inline-code chip);
  also `:253`/`:254` `.markdown-preview` uses `--phn-radius` while this
  raw 4px sits beside it. Should be `--phn-radius`/`--radius-sm`. — **Med**.
- `version-controls.css:85` — `border-radius: 7px;` — **Med**. Off-token;
  no 7px radius exists anywhere in the system (`--radius-sm`=5,
  `--phn-control-radius`=6).
- `version-controls.css:138` — `border-radius: 3px;` — **Low**.
- `equipment.css:90` — `border-radius: 6px;` — **Low**. This is exactly
  `--phn-control-radius` (6px) but hardcoded.
- `version-controls.css:304` — `transition: background 0.15s var(--ease);`
  — **Low**. Raw 0.15s; rest of file uses 0.16s/0.12s. No
  `--transition-*` duration token is consumed anywhere in scope despite
  `--transition-base` existing at L1.
- `version-controls.css:65, 88` — raw `box-shadow: 0 0 0 3px …` (focus
  glow) and `0 1px 0 …` (hairline). — **Low**. Arguably justified:
  `--shadow-elev-*` are drop shadows, not these glow/hairline effects;
  but they are still bespoke shadow recipes with no token.
- `equipment.css:23` — `font-weight: 650;` and `:23` region; plus
  `equipment.css:70/98` `font-weight: 700/600`, `room-notes-expander
  summary { font-weight: 650 }` (`equipment.css:23`). 650 is a non-
  standard weight not used elsewhere. — **Low**.

## Rubric 2 — Off-brand / inconsistent color & semantics

- No off-brand hues in the five CSS files — semantic colors correctly go
  through `--phn-success/-warning/-danger`, `--accent*`, `--highlight*`.
  Good.
- `equipment/heat-pumps/indoor-unit-columns.tsx:33,39`,
  `outdoor-unit-columns.tsx:30`, `outdoor-equip-columns.tsx:23` —
  `color: "slategray"` literal used as the option-chip swatch color for
  synthetic rows (see Rubric 6). It is a named CSS color baked into JS;
  it does not correspond to any token and renders a grey that no token
  defines. — **Med**.
- Test fixtures (`equipment/testing/*.ts`) carry dozens of raw hex option
  colors (e.g. `appliancesFixtures.ts:63-134`, `testFixtures.ts`,
  `hotWaterHeatersFixtures.ts`). These are **test data**, `.ts` is exempt
  from `check:hex`, and they model AirTable option colors — **not a
  finding**, noted for completeness.

## Rubric 3 — Duplication that should be shared

- **Tooltip re-implemented.** `version-controls.css:211-285` re-creates
  the entire `[data-tooltip]::after` tooltip (positioning, glow, fade,
  arrow-less bubble) that already exists in `base.css:1424+`. ~75 lines of
  duplicated tooltip logic with feature-specific position overrides
  bolted on. — **High**.
- **`.icon-button` re-declared.** `project_status.css:274-280` re-states
  `.icon-button` sizing (34px square) already defined in
  `base.css:1393-1406`. Redundant override. — **Med**.
- **`.danger-button` re-declared.** `project_status.css:282-290`
  re-states `.danger-button` colors/hover already in `base.css:1362-1372`
  (and the hover here uses `80%` vs base's `82%` — a silent drift). —
  **Med**.
- **Panel border rule lives in `auth-page.css`.** The shared panel
  recipe (`border + --phn-radius + --bg-card`) for `.auth-panel`,
  `.empty-state`, `.project-list`, `.modal-panel`, `.version-popover`,
  `.read-safe-panel`, `.data-table-wrap`, `.data-table-empty`,
  `.status-empty`, `.status-item`, `.metadata-grid div` is defined in
  `auth-page.css:11-25` — a feature file. Eleven cross-feature selectors
  share one rule whose home is the `auth` feature. — **High**
  (discoverability + ownership).
- **Catalogs hand-rolls a table.** `catalogs.css:46-91` (`.catalog-table`
  + th/td) re-implements table styling rather than using the shared
  `<DataTable>` (`shared/ui/data-table/DataTable.css`). Raw paddings
  (`8px 12px`), own font-size, own sticky header, own zebra. — **Med**.
- `version-controls.css:189-205` `.menu-action` vs `base.css:1740+`
  `.app-menu__item` — two parallel "menu item button" treatments. — **Low**.

## Rubric 4 — Naming / structure inconsistency

- **Three different chip/pill naming conventions** for the same UI idea:
  `.report-status-chip` (canonical, BEM-ish `__count`),
  `.status-badge`/`.date-pill` (`project_status.css:134,160`),
  `.read-only-pill`/`.pill-tab` (base.css). No shared "chip" primitive
  the others extend. — **Med**.
- **Mixed BEM vs flat.** `equipment.css` uses BEM
  (`.hp-form-grid__wide`, `.hp-rooms-picker__list`,
  `.app-subtabs__tab`) while `project_status.css` /
  `version-controls.css` are flat-dash (`.status-item-main`,
  `.version-path-control`). Inconsistent within scope. — **Low**.
- **`--space-*` numeric scale unused** while a parallel ad-hoc px
  vocabulary (8/10/12/14…) is hand-maintained — see Rubric 1. — **Med**.

## Rubric 5 — Inline styles in TSX (justified vs not)

- **No static-design inline styles anywhere in scope.** Good.
- The only `style=` usages are dynamic CSS-variable injection of
  data-driven option colors: `RoomsTable.tsx:197`, `PumpsTable.tsx:329`,
  `FansTable.tsx:269`, `VentilatorsTable.tsx:244`,
  `HotWaterHeatersTable.tsx:290`, `HotWaterTanksTable.tsx:245`,
  `AppliancesTable.tsx:274` — all `style={{ "--option-color":
  option.color }}`. This is the correct pattern (runtime data → CSS var
  consumed by a class). — **Not a finding** (justified).

## Rubric 6 — JS-driven styling (color/font constants in .ts/.tsx)

- `equipment/heat-pumps/outdoor-equip-columns.tsx:23` —
  `const SYNTHETIC_OPTION_CHIP_COLOR = "slategray";` plus three sibling
  files (`indoor-unit-columns.tsx:33,39`, `outdoor-unit-columns.tsx:30`)
  inline the literal `"slategray"` rather than importing that constant.
  A design color (a) lives in JS, (b) is a named color tied to no token,
  and (c) is duplicated across 4 files instead of shared. — **Med**.
- No font constants in scope TSX. Good.

## Rubric 7 — Discoverability

- **`.sr-only` shared utility lives in `equipment.css:1`.** It is used by
  7 TSX files across multiple features (auth, status,
  `InlineHeaderNameEditor`, `DataTable`, etc.) yet is defined ONLY inside
  the equipment feature stylesheet. It works app-wide solely because
  `App.css:8` aggregates `equipment.css` globally. A new author has no way
  to discover this and would reasonably re-define it. — **High**.
  (SHARED-CONTEXT confirmed this; verified `grep` finds the only
  definition at `equipment.css:1`.)
- **Classes referenced in TSX but defined in NO stylesheet** (render
  unstyled; the className analogue of undefined-token bugs):
  - `data-table-link-cell` — `PumpsTable.tsx:209`,
    `HotWaterTanksTable.tsx:192`, `FansTable.tsx:194`,
    `ElectricHeatersTable.tsx:113`, `AppliancesTable.tsx:195`,
    `VentilatorsTable.tsx:171`, `HotWaterHeatersTable.tsx:208` (7 sites).
    — **High**.
  - `link-button` + `hp-option-add-trigger` — `OptionPicker.tsx:137`.
    — **Med**.
  - `hp-helper-text` — `IndoorUnitRowModal.tsx:149,171`. — **Med**.
  - `hp-cascade-meta`, `hp-cascade-list` — used in equipment TSX, defined
    nowhere. — **Med**.
  - `import-dialog-report`, `import-dialog-pick`, `import-dialog-row-
    preview`, `import-dialog-done`, `import-dialog-counts` — used in
    `catalogs/{materials,glazing-types,frame-types}/import_export/
    ImportDialog.tsx`, defined in NO css (catalogs has only
    `catalogs.css`, which contains none of them). — **High** (a whole
    import-dialog UI is unstyled across 3 catalog variants).
- **No scaffold doc / starter recipe.** A new small-feature page has no
  single reference for the standard page/panel/form/heading skeleton.
  The de-facto answer is "do what `projects` does," but that is tribal
  knowledge. The split of shared classes across `base.css` + `modals.css`
  + `ReportTable.css` + a stray `auth-page.css` panel rule + a stray
  `equipment.css` `.sr-only` makes "where do I find the standard X?"
  genuinely hard. — **Med**.

---

## Chip / badge audit (special task b)

Canonical: `.report-status-chip` (`ReportTable.css:172-199`) — pill,
`border-radius: 999px`, `padding: 7px 12px`, `font-size: 12px`,
`font-weight: 500`, `background: var(--bg-card)`, `border:
var(--border-subtle)`, active = `aria-pressed` accent mix. It is reused
in only ONE place (`StatusFilterChips.tsx`).

In-scope reinventions (all chip/pill shaped, none extend the canonical
chip):

| Class | File:line | radius | padding | font-size | weight | color basis |
|---|---|---|---|---|---|---|
| `.report-status-chip` (canon) | ReportTable.css:172 | 999px | 7px 12px | 12px | 500 | bg-card / border-subtle |
| `.status-badge` | project_status.css:134 | 999px | 3px 8px | 0.68rem | 400 | per-state bg (accent-light / success-bg / bg-elev) |
| `.date-pill` | project_status.css:160 | 999px | 4px 8px | 0.72rem | (inherit) | bg-card / border-subtle |
| `.read-only-pill` | base.css:1478 | (pill) | — | — | — | shared |
| `.save-state` | version-controls.css:39 | --phn-radius | 0 12px | 0.72rem | 400 | bg-card + status dot |
| `.status-state-button/-static` | project_status.css:53 | 999px | 0 | (icon) | 400 | per-state |

Conclusion: `.status-badge` and `.date-pill` are clear reinventions of
the canonical chip with divergent padding (3px 8px / 4px 8px vs 7px 12px),
font-size (rem vs px), and weight (400 vs 500). They should be
unified under a shared chip/badge primitive (or the canonical chip should
be generalized). — **Med**. No status chips found in `catalogs`.

## Features WITHOUT css (special task c)

- `projects` — confirmed pure shared-class consumption; no css file, no
  static inline styles, no hardcoded colors/fonts in TSX. **Clean.**
- `mcp` — no `.tsx` files (only logic + `.gitkeep` placeholders).
  **Nothing to style.**
- `table_views` — no `.tsx` files (logic/hooks only). **Nothing to
  style.**

---

## Top 5 highest-impact fixes

1. **Adopt `--space-*` everywhere (kill the 68 raw-px spacing values).**
   The token scale exists and is used zero times in scope. Mapping
   gap/padding/margin to `--space-1..7` is the single biggest consistency
   + anti-drift win and removes the off-grid 5/7/9/14/18/38px values.
2. **Move `.sr-only` and the shared panel rule to `base.css`.** Relocate
   `.sr-only` (`equipment.css:1`) and the 11-selector panel border recipe
   (`auth-page.css:11-25`) into `base.css` so shared primitives live in
   the shared file, not in random feature stylesheets that only work via
   the App.css aggregation accident.
3. **Fix unstyled classNames.** Define (or remove) `data-table-link-cell`
   (7 sites), the catalog `import-dialog-*` set (3 dialogs), `link-button`,
   `hp-helper-text`, `hp-cascade-*`, `hp-option-add-trigger`. These render
   silently unstyled today and pass CI — same failure class as undefined
   tokens.
4. **De-duplicate the tooltip + button overrides.** Delete the
   re-implemented tooltip (`version-controls.css:211-285`) and the
   `.icon-button` / `.danger-button` re-declarations
   (`project_status.css:274-290`) in favor of the `base.css` originals;
   keep only the genuinely position-specific overrides.
5. **Unify chips: fold `.status-badge` / `.date-pill` into a shared
   chip/badge primitive** derived from `.report-status-chip`, and replace
   the JS `"slategray"` swatch literal (4 files) + `color: white`
   (`project_status.css:79`) with tokens.

## Reusable patterns / good practices already present

- `projects` is a clean reference implementation of "all-shared-class"
  page construction — worth pointing new authors at.
- Semantic status colors are consistently tokenized
  (`--phn-success/-warning/-danger` + `-bg`) across `version-controls.css`
  and `project_status.css`.
- `color-mix(in oklab, …)` tinting from tokens is used well for hover /
  active / banner states (e.g. `project_status.css:34`,
  `version-controls.css:70-71`) — keeps states derived from brand tokens
  rather than hardcoded.
- Data-driven inline styling is done correctly via a single CSS variable
  (`--option-color`) consumed by a class, not via static inline style.
- No undefined `var(--…)` tokens in any of the five in-scope
  stylesheets — token discipline on the CSS side is solid here.
