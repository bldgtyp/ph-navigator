---
DATE: 2026-06-05
TIME: 14:30 EDT
STATUS: DRAFT - feature PRD for the full Apertures tab / Aperture Builder build-out. Not yet phased. Revised 2026-06-05 PM to close V1-parity gaps surfaced in PRD review (sub-tab disposition, per-side picker filtering, canvas click-to-pick, on-canvas name pill, selection model, display-unit format selector, datasheet fields, supersedence notes vs `context/user-stories/10-windows.md`).
AUTHOR: Codex
SCOPE: Product, UX, data, save/versioning, MCP, export, and implementation-precedent contract for the V2 Apertures tab.
RELATED:
  - context/user-stories/10-windows.md
  - research/v1-window-builder-reference.md
  - research/ph-nav-v1-screenshots/aperture-builder/Window Builder.png
  - research/ph-nav-v1-screenshots/aperture-builder/Project Frame Types.png
  - research/ph-nav-v1-screenshots/aperture-builder/Project Glazing Types.png
  - context/technical-requirements/save-versioning.md
  - context/technical-requirements/llm-mcp-schema.md
  - context/technical-requirements/data-model.md
  - ../ph-navigator/backend/features/aperture/services/to_hbe_window_construction.py
  - frontend/src/features/windows/
  - frontend/src/features/envelope/components/AssemblySvgCanvas.tsx
  - frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx
  - frontend/src/features/envelope/canvas-geometry.ts
  - frontend/src/features/envelope/envelope.css
---

# PH-Navigator V2 - Apertures / Aperture Builder PRD

## 1. Why this doc exists

The current Windows tab needs to become the Apertures tab and move from
the tracer-bullet picker to a real Aperture Builder: a V2
versioned-document implementation of the V1 Aperture / Unit Builder
workflow.

Terminology decision, 2026-06-05: **Apertures** is the canonical domain
term. This aligns with Honeybee, and the Builder models windows, doors,
skylights, and other glazed/door aperture types. `Windows` remains a
current shipped UI / route / module vocabulary item until the first
implementation phase renames it.

The target is visible in
`research/ph-nav-v1-screenshots/aperture-builder/Window Builder.png`:
a left sidebar of aperture types, a compact per-aperture header with
the active type and Uw, a proportional graphic panel with dimension labels
and editing tools, and a lower stack of per-sash cards for frame,
glazing, and operation assignments.

This PRD consolidates the existing Windows/Apertures user-story cluster, V1 code
reference, screenshot reference, save/versioning model, MCP/schema
requirements, current TB-08/TB-09 implementation, and Assembly Builder
implementation precedent into one feature contract. Detailed phased
plans come after this PRD is reviewed.

## 2. Current baseline

The feature is not greenfield.

Already present:

- `backend/features/project_document/tables/window_types.py` currently
  registers `tables.window_types[]` as a project-document table
  contract.
- `backend/features/project_document/document.py` defines `WindowTypeEntry`,
  `WindowElement`, `FrameRef`, `GlazingRef`, and `CatalogOrigin`.
- `frontend/src/features/windows/` renders the Windows tab with a
  sidebar, minimal detail view, per-slot frame/glazing pickers,
  bookshelf-copy stamping, `u_value_w_m2k` override tracking, and
  refresh-from-catalog UI.
- `backend/features/project_document/refresh.py` reports per-slot drift
  for frame/glazing refs.
- Generic table reads already expose `window_types` through REST and
  MCP `get_table`.

Not yet present:

- V1-like proportional canvas.
- Row/column dimensions, display-unit format selector, and parser UI.
- Element display names (sidebar / card / on-canvas pill).
- Operation editor, presets, and SVG symbols.
- Merge/split.
- Copy/paste assignment tools + bounded undo stack.
- Aperture/window-level and element-level ISO 10077-1 U-Value service.
- Full sidebar actions: rename, duplicate, delete, empty state.
- Per-side frame picker filtering by `location` (Head / Jamb / Sill),
  `use` (Window / Door / Curtain Wall), and `operation`
  (Fixed / Tilt-Turn / Outswing / etc.).
- Click-on-canvas-region → open scoped frame / glazing picker.
- Datasheet PDF link affordance on copied frame / glazing refs.
- Manufacturer filter UI.
- Aperture-specific semantic MCP write tools.
- Browser/MCP edit conflict UX beyond shared draft ETag behavior.
- Project-scoped view of all bookshelf-copied frame / glazing refs
  (the V1 `Frame Types` and `Glazing Types` sibling tabs); see §6.1.

Known schema gap to close before full Builder work: current
`WindowElement` has geometry, frames, and glazing, but no `name` or
`operation`. The PRD requires both. The current table/module vocabulary
also says `window_types`; the PRD target says `apertures`. Backwards
compatibility is not a constraint, so schema/route/module changes may be
direct cutovers with dev DB rebuild or migration cleanup as needed.

## 3. Product goal

Editors can define every project aperture type as a 2D type
template with:

- a named aperture type;
- one or more rows and columns with editable dimensions;
- one or more elements spanning cells;
- per-element glazing assignment;
- per-side frame assignments;
- operation pattern and direction;
- live composite aperture/window U-Value and per-element U-Value;
- catalog provenance and drift review;
- explicit Save / Save As versioning.

The Builder is for type composition. It does not place apertures on
model surfaces, own orientation/tilt, or mutate model geometry. Its
HBJSON scope is construction export only. The Model tab remains
deliberately disconnected from builder tables except where later
export/import tools explicitly bridge them.

## 4. Primary users and workflows

Primary user: a BLDGTYP editor building a PHPP/WUFI/Rhino/Honeybee
aperture schedule from project design information.

Core workflow:

1. Open `Apertures`.
2. Add or select an aperture type, for example `AA`, `CW01`, or `Door B`.
3. Build the 2D grid from row heights and column widths.
4. Merge/split cells into sashes or fixed panels.
5. Pick frame products per side and glazing products per element from
   catalogs.
6. Set operation symbols for operable sashes.
7. Review the live window U-Value and per-element U-Values.
8. Save or Save As the current project version.

Secondary workflows:

- Review from the opposite side of the aperture with an interior/exterior
  view toggle.
- Copy frame/glazing/operation assignments from one sash to another.
- Review catalog drift and selectively refresh copied catalog values.
- Use an MCP client to inspect or update aperture types through a
  structured tool surface.

## 5. Non-goals

- No production backwards compatibility guarantee for existing dev data.
- No V1 AirTable refresh workflow. V2 catalogs are native and curated.
- No live FK from a project aperture type back to catalog rows. Picked
  values are bookshelf-copied into the project document.
- No aperture placement on wall/roof/model surfaces inside this Builder.
- No orientation, tilt, shading, or exposure assignment here.
- No glazing layer build-up editor. Glazing refs stay flat catalog
  values: `u_value_w_m2k`, `g_value`, color, source fields.
- No frame profile editor. Frame refs stay flat catalog values:
  `width_mm`, `u_value_w_m2k`, `psi_g_w_mk`, `psi_install_w_mk`, color,
  source fields.
- No keyboard shortcut suite in v1 except Esc for modal/tool escape and
  normal text-input behavior.
- No bulk auto-refresh from catalog. Review remains explicit.
- No public anonymous MCP. MCP remains authenticated, project-scoped,
  and token-audited.

## 6. Target page layout

The page should follow the V1 `Window Builder.png` composition, adapted
to the current PHN V2 design system and relabelled as Apertures in the
reader-facing UI.

Top-level layout:

- Page header: `Apertures` tab title, active aperture type controls, Uw
  chip, overflow menu.
- Left sidebar: project aperture types.
- Main area:
  - Graphic Builder panel.
  - Canvas toolbar.
  - Proportional SVG window drawing.
  - Editable dimension labels and tickmarks.
  - Per-element assignment cards below the canvas.

The first viewport should be the working Builder, not a marketing or
explanatory landing page.

### 6.1 V1 sub-tab disposition (Frame Types / Glazing Types)

V1 ships three sibling tabs under `Windows`:

- `Unit Types` — the Aperture / Window Builder. **This is the surface
  the rest of this PRD specifies.**
- `Glazing Types` — a project-scoped table of glazing products picked
  into the project from AirTable (see
  `research/ph-nav-v1-screenshots/aperture-builder/Project Glazing Types.png`).
- `Frame Types` — a project-scoped table of frame products picked into
  the project from AirTable (see
  `research/ph-nav-v1-screenshots/aperture-builder/Project Frame Types.png`).

In V1 the `Frame Types` / `Glazing Types` tables exist because the
project maintains its own pool of frame and glazing rows (refreshed
from AirTable) and the Builder's per-side selectors pick from that
pool. The V1 tables also surface the **datasheet PDF** (`Data Sheet`
column, green-checkbox + link icon), `Notes`, and `Link` columns that
are part of the BLDGTYP Phius certification workflow.

V2 decision, 2026-06-05:

1. **The dedicated `Frame Types` / `Glazing Types` sub-tabs are removed
   from the Apertures area.** Catalogs are native to V2 and managed in
   the global catalog manager (PRD §7.3 of the V2 architecture PRD).
   The Apertures tab is the Builder only.
2. **Project-scoped visibility into already-picked frame / glazing
   refs is preserved as a read-only "Project Apertures Refs" view**,
   surfaced as a Builder-level overflow action: `⋯ → View picked
   frames & glazings`. It lists every distinct bookshelf-copied
   `FrameRef` / `GlazingRef` in the active version (deduped by
   `catalog_origin.catalog_record_id` for catalog-sourced refs;
   hand-entered refs listed separately), with their `manufacturer`,
   `brand`, `use`, `operation`, `location`, `width_mm`,
   `u_value_w_m2k`, `psi_g_w_mk`, `datasheet_url`, `link`, drift
   status, and the count of elements that use them. This view is
   navigation / drift-review only — picking, hand-entering, and
   manufacturer filtering all happen inside the Builder element
   cards.
3. **A standalone full Frame Types / Glazing Types editing tab is
   deferred** until a real user need surfaces beyond the
   Builder-cards + global catalog manager combination. The data
   model carries every V1 field (§12), so adding the tab later is
   a pure UI change.

Implementers should not reinstate the V1 sibling tabs in the
Apertures route during phase planning without an explicit revisit
of this decision.

## 7. Sidebar contract

The sidebar lists the target `tables.apertures[]` for the current source
view (`draft` when present, otherwise `version`). The current shipped
table is `tables.window_types[]`; the first implementation phase should
rename it before more Builder code depends on the old term.

Acceptance:

- Natural-sort by `name` (so `AA_2 < AA_10`).
- Active aperture type highlighted.
- Row text is the name only in v1. No thumbnail, U-Value, or element
  count in the sidebar.
- Add button creates a new aperture type entry and selects it.
- Add and Duplicate auto-suffix `(2)`, `(3)`, ... on the default name
  to satisfy uniqueness without prompting (see US-WIN-1 criteria 8a /
  10a for the suffix-search rule).
- Rename enforces trim + case-insensitive uniqueness within the active
  project version. Collision renders a red helper line in the rename
  dialog; Save stays disabled.
- Duplicate deep-copies the aperture type, preserving copied catalog refs
  and generating fresh ids for the type and elements. Toast confirms
  the new name.
- Delete uses an app dialog, not `window.confirm`. No name re-typing.
  On confirm, the next type in sort order becomes active; if the list
  empties, the main area renders the empty state below.
- Sidebar is scrollable. Projects routinely carry 30–100+ aperture
  types (V1 reference shows `AA`, `AA_38`, ..., `CW09B`, ...). v1
  does not implement type-to-filter or virtualization; both are
  candidate v1.1+ improvements if scroll-only navigation proves
  slow.
- Locked versions and Viewer access render the sidebar read-only:
  navigation works, edit affordances (Add button, hover icons,
  rename dialog) are hidden.

Empty-state copy (project has zero aperture types):

- Sidebar shows only the `+ Add aperture type` button.
- Main area shows centered text: `No aperture types yet.` with a
  primary `+ Add aperture type` button mirroring the sidebar action.

Default new aperture type:

```jsonc
{
  "id": "apt_<token>",
  "name": "Unnamed Aperture Type",
  "row_heights_mm": [1000.0],
  "column_widths_mm": [1000.0],
  "elements": [
    {
      "id": "aptel_<token>",
      "row_span": [0, 0],
      "column_span": [0, 0],
      "name": "Unnamed",
      "frames": {
        "top": { "name": "Default Frame", "...": "bookshelf-copied FrameRef" },
        "right": { "name": "Default Frame", "...": "bookshelf-copied FrameRef" },
        "bottom": { "name": "Default Frame", "...": "bookshelf-copied FrameRef" },
        "left": { "name": "Default Frame", "...": "bookshelf-copied FrameRef" }
      },
      "glazing": { "name": "Default Glazing", "...": "bookshelf-copied GlazingRef" },
      "operation": null
    }
  ]
}
```

Default frame/glazing decision, 2026-06-05: new aperture elements should
not normally have missing thermal assignments. Seed or otherwise
guarantee one default frame catalog record and one default glazing
catalog record, then bookshelf-copy those refs into each new element.
Do not fall back to "first catalog row" silently. If the defaults are
unavailable, creation should fail with a clear setup error rather than
creating null thermal assignments.

**Supersedes user-story lean.** This is a deliberate change from the
US-WIN-3 / Q-WIN-3 lean (option `b`: ship new elements with `null`
frames / glazing and validate at Save / Save As time, per
`context/user-stories/10-windows.md`). The seeded-defaults model
(option `a`) was chosen here because (i) it removes "everyone forgot
to change the default" from the V1 papercut list while still surfacing
broken/imported nulls as a structured repair state, (ii) it lets the
Builder render a non-degenerate canvas immediately, and (iii) it
keeps `catalog_origin` semantics consistent across new and picked
elements. The first implementation phase should mark US-WIN-1
criterion 8 and US-WIN-3 acceptance criterion 6 (`frames` all `null`,
`glazing: null` on row/column add) as superseded by this PRD §7 / §12.

Use canonical aperture ids matching the target backend schema. Any
current frontend/backend helper that emits `win_` / `winel_` prefixes
should be normalized during the terminology/schema phase.

## 8. Header and result summary

The Builder header owns aperture-type-scoped state, not project-wide
state.

Required controls:

- Active aperture type name display (matches the row highlighted in
  the sidebar). V1 renders this as a dropdown (`Window / Door Type
  [AA] ▾`); V2 v1 may render it as a read-only chip if the sidebar
  is open, but **the header is the single source of truth for the
  active-aperture label** so that a collapsed sidebar still names
  the current target. If a header dropdown is provided, it must
  drive and reflect the same selection state as the sidebar — no
  divergent active states.
- `Window U-Value` chip.
- Info tooltip explaining ISO 10077-1, no surface-film convention, and
  operation exclusion.
- Save / Save As affordances live in the global project header bar
  (UI/UX §2.4), not inside the Apertures header. The aperture-type
  overflow menu surfaces aperture-type-scoped actions only
  (Rename, Duplicate, Delete, View picked frames & glazings, Export
  window constructions (HBJSON), Configure manufacturer filters).

U-Value labels:

- SI: `Window U-Value: 1.20 W/m2K`.
- IP: `Window U-Value: 0.21 BTU/(hr*ft2*F)`.
- Do not label this `U-Factor`.
- Use fixed/minimum width to avoid layout shift while loading.
- Broken/imported null assignments render a repair warning rather than
  hiding the number. Normal new aperture types should already have
  default frame/glazing assignments.

## 9. Graphic Builder panel

The canvas should reuse the Assembly Builder pattern where practical:

- Pure geometry helpers, parallel to `canvas-geometry.ts`.
- Dedicated SVG renderer, parallel to `AssemblySvgCanvas.tsx`.
- Separate DOM overlay for hit targets, labels, add buttons, and
  dimension editors, parallel to `AssemblyCanvasOverlay.tsx`.
- Tokenized toolbar and dimension CSS, parallel to the Assembly
  Builder section of `envelope.css`.
- Lucide icons for toolbar buttons.

Do not force a shared abstraction before the Aperture canvas exists.
First mirror the proven separation of concerns; extract shared
primitives later only where duplication is real.

### 9.1 Geometry

The aperture type stores:

- `row_heights_mm`: top to bottom.
- `column_widths_mm`: left to right in the canonical exterior/data
  frame.
- `elements[]`: inclusive `row_span` and `column_span`.

Canvas geometry derives:

- total width = sum of columns;
- total height = sum of rows;
- each element rectangle from span extents;
- each glazing rectangle from element extents minus frame widths.

Invariant: every grid cell is covered by exactly one element. No holes.

### 9.2 SVG rendering

Each element renders as five SVG regions:

- top frame;
- right frame;
- bottom frame;
- left frame;
- center glazing.

Frame widths come from each side's `FrameRef.width_mm`. If width is
missing, use a clear visual fallback and validation warning. Do not
invent thermal defaults silently for calculation.

Colors:

- Use `FrameRef.color` / `GlazingRef.color` when valid.
- Null frame/glazing renders blank fill plus dashed outline.
- Invalid color falls back to a neutral builder token.
- Selected/hovered regions use CSS token outlines, not hardcoded theme
  one-offs.

Operation symbols:

- `null` operation means fixed.
- `swing` draws dashed hinge lines to opposite glazing corners.
- `slide` draws a direction arrow.
- Multiple directions are allowed for tilt-turn-style behavior.
- Interior view swaps left/right directions, not up/down.

### 9.2.1 Hover, click, and on-canvas pill

The canvas is a primary editing surface, not just a viewer. Hover and
click semantics follow V1 (V1 ref §7.5 / §7.8 in
`context/user-stories/10-windows.md` US-WIN-9 criteria 5–7):

- **Element background hover** renders a subtle ring around the
  element. Clicking selects the element (selection model below).
- **Frame-region hover** (one of the four side rects) renders a
  stronger ring on that rect only. Clicking opens the **per-side
  frame picker** scoped to that side (Top / Right / Bottom / Left) —
  the same picker that opens from the matching row in the element
  card. In interior view, the visible right rect maps to the
  canonical-left `frames.left` data; the picker writes the canonical
  side, the rendered label tracks what the user sees (§11).
- **Glazing-region hover** renders a ring on the glazing rect.
  Clicking opens the **glazing picker** for that element.
- **In copy/paste mode** (§11), region clicks drive the
  pick / paste state machine instead of opening pickers.

**On-canvas element-name pill.** Each element renders its `name` as
an overlay pill centered on the glazing region, sitting in a DOM
overlay that scales with zoom (parallel to the dimension overlay).
The pill is:

- click-to-edit (inline `Input`, autofocus, full-select);
- commit on Enter or blur, cancel on Escape;
- empty / whitespace input reverts to the previous value (no empty
  names) — the literal default `Unnamed` is allowed;
- the same `name` is also editable from the element card (§11); the
  two surfaces edit one source of truth.

V1 commonly carries position-derived labels like `1.1`, `1.1.1`
(visible in `Window Builder.png`). V2 does **not** auto-generate
these — the field is free text with default `Unnamed`. Users who
want positional labels type them manually. Auto-numbering is a
candidate v1.1+ improvement.

### 9.2.2 Selection model

- **Click on an element** → single-select; click again to deselect.
- **Shift-click** extends the selection. V2 relaxes the V1
  adjacency-only rule (US-WIN-3 Q-WIN-3.1): any shift-click extends;
  the merge operation validates the contiguous-rectangle invariant
  at commit time and toasts on failure. The V1 silent-ignore is
  dropped.
- **Cmd/Ctrl-click** toggles a single element in/out of the selection
  with no adjacency rule.
- **Escape** clears the selection. The toolbar also exposes a
  `Clear selection` button.
- Selection state is per-tab ephemeral; switching the active aperture
  type or the active version clears it.

### 9.2.3 No-holes invariant and Delete key

§12 enforces "no holes" as a structural invariant on the document.
The Builder enforces the same invariant interactionally:

- There is **no direct delete-element gesture in v1**. Pressing
  Delete or Backspace with elements selected shows a one-time
  educational tooltip: `To remove an element, merge it into a
  neighbor (Toolbar → Merge) or delete its row / column (hover the
  dimension label, click −).` (US-WIN-3 criterion 9.)
- The two supported removal paths are: (a) **merge** the element
  into an adjacent element via the toolbar; (b) **delete the row
  or column** that contains it via the dimension-strip `−` button
  (§10).
- Deleting the aperture type itself (sidebar action) removes all
  its elements at once and is exempt from this rule.
- Direct delete-with-auto-merge is a candidate v1.1+ improvement
  if the merge-or-delete-row workflow proves cumbersome.

### 9.3 View direction and zoom

Default view: exterior.

View toggle:

- Exterior: canonical left/right as stored.
- Interior: visual columns are reversed. Frame-label semantics also
  flip so the visible right side maps to the row labelled `Right Frame`
  in the card.

Zoom:

- Single scale factor. Both axes scale together.
- Canvas scrolls on overflow; it never squashes horizontally.
- Reuse Assembly Builder zoom patterns unless an Aperture-specific need
  appears.
- Zoom and view-direction are per-user preferences, not project data.

## 10. Dimensions

Dimension UI must feel like the V1 screenshot: tickmarks, labels at
each row/column segment, and inline editable values.

Required:

- Horizontal dimension strip below the canvas.
- Vertical dimension strip at the left of the canvas.
- Tickmarks at every grid line.
- One label per row/column segment.
- Hover add buttons at grid edges for row/column insertion (top /
  bottom / left / right).
- Tooltips on edge-add hover: `Add row at top`, `Add row at bottom`,
  `Add column at left`, `Add column at right`. New rows / columns
  default to `1000 mm`.
- Delete buttons for row/column removal, blocked for the last row/col
  with a tooltip: `An aperture type must have at least one row and
  one column.` Confirmation dialog only when the row / column
  contains element assignments that would be lost.
- **Total-dimensions caption** above the canvas: `<width> × <height>`
  in the active display unit (e.g. `1234.5 mm × 1000.0 mm` or
  `3' 4-3/8" × 3' 3-3/8"`), matching V1 (V1 ref §7.11). Renders
  even on locked versions and Viewer access.

### 10.1 Display-unit format selector

A small selector lives in the dimension-strip gutter, separate from
the global SI/IP system toggle (which lives in the project header).
It picks the **format** of the displayed value, not the system:

- SI mode options: `mm | cm | m` (default `mm`).
- IP mode options: `in | ft | ft-in | in-frac` (default `in`).
  - `ft-in`: `1' 6"` style.
  - `in-frac`: decimal-replaced-with-nearest fraction (¹⁄₁₆"
    precision), e.g. `12 1/16"`.

Format persistence is **per-user, per-system**, stored under
`userPreferencesStore.aperture_builder_dim_format_si` and
`aperture_builder_dim_format_ip`. The active preference is selected
by the system toggle. (US-WIN-10 Q-WIN-9 resolved.)

### 10.2 Parser and edit flow

- Store mm canonically; the backend never sees IP.
- Accept SI and IP inputs through the frontend length parser:
  - SI: arithmetic with `+ - * /`, parens supported (V2 addition,
    fixes V1 papercut); feet/inch markers invalid in SI mode.
  - IP: feet-inches (`2'`, `6"`, `2' 6"`, `1'-6"`, `1ft 6in`),
    fractions (`6-1/2"`, `1' 6 1/2"`), arithmetic with parens
    when no inch/foot markers are present, smart-quote
    normalization.
  - Empty, NaN, or `≤0` → revert.
- Port V1 parser/formatter test cases from
  `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/__tests__/`.
  Add parens-expression cases (V2 addition).
- **Precision preservation.** On edit-mode entry, capture the
  mm-precise source value. On commit, if the typed value parses to
  the same source within `< 0.5 mm` rounding tolerance, the original
  mm value is restored exactly. Prevents round-trip rounding loss
  (e.g. typing `12 1/16"` does not overwrite an underlying
  `305.5625 mm` with `305.5 mm`). Matches V1 `initialEditValue` ref
  behavior (V1 ref §17).
- Tooltip on the dimension input shows a per-unit cheat sheet:
  IP example `Tip: Use 2' 6", 6-1/2", or expressions like 24 + 12`.

### 10.3 Edit error handling

If the input doesn't parse to a positive number:

- Field gets a red border + error icon.
- Tooltip on the icon: `Couldn't parse this — try 1200, 1' 6",
  1200 / 4, or 1.2 m.` Format hints scale to the active display
  unit.
- The unparseable value is not committed; Esc / Enter reverts the
  field.

Editing a dimension commits a single JSON-Patch (via the
ApertureCommand seam, §13) and immediately re-renders the canvas and
U-Value state.

## 11. Element cards

The lower card stack is a first-class part of the Builder, not a
temporary debug panel.

Each card represents one `ApertureElement` and includes:

- editable element name (synced with the on-canvas pill, §9.2.1);
- per-element U-Value chip;
- glazing row;
- top/right/bottom/left frame rows;
- operation row (preset menu + type + direction toggles, §11.3);
- catalog-origin and drift badges (§11.2);
- inline override fields for key thermal values;
- read-only source/comment fields behind a compact expander.

Rows should preserve the V1 information density: label, picker/name,
U-Value, width where applicable, g-value where applicable. The card may
use V2 styling, but it should not become a large marketing-style card.

Frame label behavior follows view direction. In interior view, the
visible right frame reads/writes the canonical left-side data and the
card label should match what the user sees ("what you see is what
you label", per US-WIN-9 Q-WIN-7).

The active element on the canvas highlights its corresponding card
(border accent matching the canvas selection ring) so the user can
scan canvas ↔ card in one glance.

### 11.1 Per-side picker filtering by location / use / operation

V1 organizes frame catalog rows by three classification fields that
narrow the picker contextually (see `Project Frame Types.png`):

- `use`: `Window | Door | Curtain Wall | ...`
- `operation`: `Fixed | Tilt-Turn | Outswing | Sliding | ...`
- `location`: `Head | Jamb | Sill`

V2 Builder must replicate this contextual filtering inside the per-side
frame picker so the user is not scrolling past 60+ frame rows on every
pick. Filtering rules:

- **Top-frame picker** filters to `location == "Head"`.
- **Bottom-frame picker** filters to `location == "Sill"`.
- **Left-frame** and **Right-frame** pickers filter to
  `location == "Jamb"`.
- **`use`** filter narrows to a value compatible with the active
  aperture type. v1 derives `use` from the aperture's element-level
  `operation` and frame catalog tags rather than introducing a
  separate per-aperture `use` field: doors are recognized by
  outswing-style operation patterns and curtain-wall frames by
  catalog tagging. Future work may promote `use` to an aperture-type
  field if classification by operation proves ambiguous.
- **`operation`** filter narrows to frames whose catalog `operation`
  field matches the element's current `operation.type` and direction
  pattern. Changing an element's operation **invalidates** the
  current four-frame picks and surfaces a card-level warning:
  `Operation changed — picked frames may no longer match. Re-pick
  to clear.` The previously-picked values remain in the document
  (so the user can keep them deliberately) but the drift badge
  treats them as user-acknowledged mismatches.
- The picker shows a `Showing N of M frames · [Clear filter]`
  footnote when filters are active, so the user can opt out when a
  frame catalog row is mis-classified.

Glazing pickers do not use location/use/operation filtering. They
are filtered only by the project's manufacturer filter (§12, §15).

### 11.2 Catalog provenance, drift, and datasheet affordances

Each frame / glazing row in the card includes:

- a **"sourced from catalog" badge** (shadcn `Library` icon) when
  `catalog_origin` is non-null. Tooltip: `From catalog:
  '<catalog_name>' · Synced <timestamp>.`
- a **drift badge** (shadcn `RefreshCw` icon) when the entry is
  drifted (§15). Tooltip: `Catalog has changed since pick. Click to
  review.` Clicking opens the per-entry refresh dialog (§15).
- a **datasheet link** (shadcn `FileText` / `ExternalLink` icon) when
  `datasheet_url` is non-null. Opens the linked PDF in a new tab.
  This affordance is critical for BLDGTYP's Phius certification
  workflow and matches the V1 `Data Sheet` column behavior.
- a **hand-enter badge** (shadcn `PencilLine` icon) when
  `catalog_origin` is null. Tooltip: `Hand-entered. Not linked to
  the catalog.`
- a **"You edited this" tag** on any field whose key appears in
  `catalog_origin.local_overrides`. The tag persists until the next
  refresh-from-catalog clears it (or the user removes the local
  edit).

Inline-editable fields per row, with all other fields reachable via
a compact `More fields…` expander:

- Frame row: `name`, `width_mm`, `u_value_w_m2k`, `psi_g_w_mk`.
- Glazing row: `name`, `u_value_w_m2k`, `g_value`.
- Expander surfaces: `manufacturer`, `brand`, `use`, `operation`,
  `location`, `mull_type`, `psi_install_w_mk`, `color`,
  `datasheet_url`, `link`, `comments`, `source`.

Editing any inline field appends that field key to
`catalog_origin.local_overrides` (or creates the array if absent).
The catalog row itself is not affected.

### 11.3 Operation editor

The operation row exposes:

- a shadcn `Select` for `Fixed | Swing | Slide`.
- four `Toggle` buttons (`Left`, `Right`, `Up`, `Down`) when type is
  non-fixed; multiple selections allowed for tilt-turn-style behavior
  (e.g. `Swing + [Left, Up]` = Tilt-Turn).
- a **Common patterns** preset menu (ships in v1) for the
  recurring patterns: `Tilt-Turn` (swing + [Left, Up]), `Awning`
  (swing + [Up]), `Hopper` (swing + [Down]), `Casement, hinge left`
  (swing + [Left]), `Casement, hinge right` (swing + [Right]),
  `Slider, opens left` (slide + [Left]), `Slider, opens right`
  (slide + [Right]). Picking a preset applies the direction set;
  the user can still customize afterward.
- a display label that reads `Fixed`, `Swing`, or
  `Swing (Left, Up)` (directions joined comma-space).

Operation changes:

- do **not** affect U-Value (U-Value cache key excludes operation,
  §14);
- **do** affect the per-side picker filtering (§11.1), so a
  Fixed → Tilt-Turn change surfaces the "re-pick frames" warning.

### 11.4 Hand-enter entry point

The frame / glazing picker dropdown ends with a `+ Hand-enter`
action. Selecting it creates a ref with `catalog_origin = null` and
opens an inline form for the editable field set in §11.2. Hand-entered
refs validate thermal fields the same as catalog-sourced refs. No
promote-to-catalog flow ships in v1 (§5).

## 12. Data model contract

The target canonical project document stores aperture types under
`body.tables.apertures[]`.

The current shipped tracer-bullet table is `body.tables.window_types[]`.
Rename it during the first implementation phase. Backwards
compatibility is not a product constraint here.

Required `ApertureTypeEntry`:

- `id`: `apt_<token>`.
- `name`: unique within the version after trim + case-insensitive
  compare.
- `row_heights_mm`: non-empty positive floats.
- `column_widths_mm`: non-empty positive floats.
- `elements`: non-empty list of `ApertureElement`.

Required `ApertureElement`:

- `id`: `aptel_<token>`.
- `name`: non-empty display label, default `Unnamed`.
- `row_span`: inclusive `[start, end]`.
- `column_span`: inclusive `[start, end]`.
- `frames`: `top`, `right`, `bottom`, `left`, each `FrameRef`.
- `glazing`: `GlazingRef`.
- `operation`: `{ type: "swing" | "slide", directions: [...] } | null`.

Required validation:

- spans in bounds;
- no duplicate element ids;
- no grid holes;
- no overlapping element coverage;
- row/column dimensions > 0;
- frame/glazing refs validate as data only, with no live catalog FK;
- normal Save should work for newly-created aperture types because
  default frame/glazing refs are assigned at creation.
- null frame/glazing should only appear in legacy/import/broken
  documents; validation should report a structured repair error.

FrameRef:

- Identification: `name`.
- Classification (used for §11.1 picker filtering and the project
  refs view §6.1): `manufacturer`, `brand`, `use`
  (`"Window" | "Door" | "Curtain Wall" | ...`), `operation`
  (`"Fixed" | "Tilt-Turn" | "Outswing" | "Sliding" | ...`),
  `location` (`"Head" | "Jamb" | "Sill"`), `mull_type`.
- Thermal (SI canonical): `width_mm`, `u_value_w_m2k`,
  `psi_g_w_mk`, `psi_install_w_mk`.
- Presentation: `color`.
- Documentation: `datasheet_url`, `link`, `comments`, `source`.

GlazingRef:

- Identification: `name`.
- Classification: `manufacturer`, `brand`.
- Thermal (SI canonical): `u_value_w_m2k`, `g_value`.
- Presentation: `color`.
- Documentation: `datasheet_url`, `link`, `comments`, `source`.

Shared ref behavior:

- Carry `catalog_origin` when bookshelf-copied.
- Allow `catalog_origin = null` for hand-entered refs.
- Track field-level local overrides in
  `catalog_origin.local_overrides: string[]` — a list of field keys
  the user inline-edited after the pick. Refresh-from-catalog (§15)
  uses this list to default the per-row choice to **Keep mine** with
  a "You edited this" tag.
- Keep all physical quantities SI canonical.
- Include `catalog_origin.catalog_schema_version: 1` on every
  bookshelf copy as a forward-compatibility hook. v1 refresh
  compares current MVP field names only; any future catalog-schema
  change before the migration subsystem ships is a coordinated
  code/data migration event. (US-WIN-11 sidebar.)

`catalog_origin` shape:

```jsonc
{
  "catalog_table": "frame_types",
  "catalog_record_id": "rec123abc",
  "catalog_version_id": "rec123abc_v3",
  "catalog_schema_version": 1,
  "synced_at": "2026-05-10T14:23:00Z",
  "local_overrides": ["u_value_w_m2k"]
}
```

Manufacturer filters:

- Store in the project document if implemented for v1.
- Filter picker candidates only. They do not hide already-picked refs.
- In-use manufacturers cannot be disabled without first changing those
  assignments.

## 13. Save, mutation, and conflict contract

All writes flow through the project-document draft buffer. Edits do not
persist to the saved version until Save or Save As.

Required behavior:

- Draft writes use ETags.
- Save/Save As use the active version ETag.
- Locked versions reject draft patch and Save, but allow Save As.
- Discard drops the draft and returns to the saved body.
- Viewer/public access is read-only.
- Browser and MCP writes obey the same draft/concurrency rules.

Mutation decision:

The minimal Windows UI currently uses whole-table replacement for
`window_types`. That is acceptable for low-frequency picker edits, but
the full Aperture Builder introduces high-frequency semantic operations:
dimension edits, add row/column, merge/split, operation changes, and
copy/paste.

Decision, 2026-06-05: introduce an `ApertureCommand` service parallel
to Assembly Builder's envelope command seam before building the
canvas-heavy editor.

Reasons:

- one command equals one user gesture;
- command validation can enforce no holes / no overlaps;
- command payloads are smaller and easier for MCP;
- tests can target semantic operations instead of whole-table diffs;
- conflict/error messages can name the failed operation;
- this matches the recently completed Assembly Builder pattern.

Whole-table replacement can remain as a temporary compatibility wrapper
for the existing tracer-bullet UI while the first phase cuts over, but
new Builder gestures should be authored as semantic commands.

## 14. U-Value contract

Port the V1 ISO 10077-1 calculation to V2 `ApertureTypeEntry`.

Formula:

```text
Uw = (sum(Ag * Ug) + sum(Af * Uf) + sum(lg * psi_g)) / sum(Ag + Af)
```

Behavior:

- Uninstalled value. `psi_install_w_mk` is stored for future use but
  excluded unless a later decision explicitly adds installed Uw.
- Operation does not affect U-Value.
- Area and spacer lengths derive from row/column dimensions, spans, and
  per-side frame widths.
- Per-element U-Value and window-level U-Value are returned together.
- Missing frame/glazing values should only occur in legacy/import/broken
  documents. They produce warnings and a repair state, not a crash.
- Cache by a content hash of U-Value-affecting fields only.
- Exclude element name and operation from the content hash.

## 15. Catalog and refresh contract

Apertures use the V2 bookshelf model:

- Pick copies catalog values into the project document.
- Catalog edits do not automatically mutate projects.
- `catalog_origin` records source table, source record, synced time,
  schema version, and local overrides.
- Refresh-from-catalog compares the copied ref to the current catalog
  row and lets the user choose per field.

Drift detection logic (US-WIN-11 criterion 1, TB-09.a revised
2026-05-14): an entry is **drifted** when **either**

1. `catalog_origin.catalog_version_id !=
   catalog_*_records.current_version_id` (the catalog row was bumped
   to a new version), **or**
2. Any compared field on the current catalog version differs from the
   bookshelf-copied value (catches in-place catalog edits per
   `context/technical-requirements/data-model.md` §7.3, where a
   catalog typo-fix updates the current version without bumping
   `current_version_id`).

Fields listed in `catalog_origin.local_overrides` default to **Keep
mine** in the refresh dialog and carry a "You edited this" tag, but
do not on their own make an entry "not drifted" if anything else
differs.

Drift surfaces in three places:

- **Per-entry badge** on each frame / glazing card row (§11.2).
  Click opens the per-entry refresh dialog with the side-by-side
  diff and per-row choice (Take catalog / Keep mine / Edit a third
  value), plus bulk `Take all from catalog` / `Keep all mine`
  actions.
- **Builder-level summary banner** at the top of the Apertures tab
  when *any* drift exists in the active aperture-type's elements:
  `N entries drifted from catalog [Review all]`.
- **Project-wide drift report** from the project header `⋯ →
  Catalog drift report` (lives in the catalog manager view per
  PRD §7.4 of the V2 architecture PRD).

Refresh-save behavior:

- Writes the chosen values into the document.
- Updates `catalog_origin.catalog_version_id =
  current_version_id` and `catalog_origin.synced_at = now()`.
- **Preserves `local_overrides` verbatim** in v1; recomputing the
  list from post-refresh field values is deferred until the
  full field-level override management feature ships.
- No bulk auto-apply across the project — every entry requires
  explicit per-row review.

Hand-enter path:

- Allowed for real-world one-off values.
- Entry point: `+ Hand-enter` action at the bottom of every frame
  / glazing picker dropdown (§11.4).
- `catalog_origin = null`.
- Still validates thermal fields (`width_mm > 0`,
  `u_value_w_m2k > 0`, etc.).
- Surfaced with the `PencilLine` hand-enter badge on the card row
  (§11.2). Drift detection skips hand-entered refs.
- No promote-to-catalog flow in v1.

Existing refresh plumbing can remain the base. Full Builder work should
surface drift in the element cards and Builder header without making
refresh the dominant workflow.

## 16. MCP / LLM contract

LLM-facing behavior must remain first-class:

- `get_document` exposes the full document with `apertures`.
- `get_table(project_id, version_id, "apertures")` reads the table
  after the terminology/schema cutover. The current tracer-bullet table
  is `window_types`.
- Generic `replace_table` remains table-shaped, but MCP writes are
  currently deferred in the shipped tool surface.
- Future mutating tools should prefer a semantic Aperture command tool,
  not raw nested JSON-Patch into the Builder tree.

Proposed MCP additions for phase planning:

```text
list_aperture_types(project_id, version_id, source?)
get_aperture_type(project_id, version_id, aperture_type_id, source?)
report_aperture_catalog_drift(project_id, version_id, source?)
calculate_aperture_u_values(project_id, version_id, aperture_type_ids?, source?)
apply_aperture_command(project_id, version_id, command, if_match?, if_match_version?)
```

Tool rules:

- SI canonical in all requests/responses.
- Stable ids required for every target.
- Same editor token draft as browser writes.
- Same structured error envelope.
- Same MCP edit-lease policy as other mutating tools.

## 17. HBJSON / Rhino export contract

HBJSON window-constructions export is in core scope. This is V1 parity
and a downstream Rhino/Honeybee requirement, not a nice-to-have export.

Rhino use case:

- Rhino/GH components pull project aperture layout and construction data
  from PHN.
- Those constructions are used to build energy models downstream.
- V2 may change endpoint names, field names, ids, and component internals,
  but it must preserve the core capability: export every aperture
  element as a Honeybee-Energy window construction payload that Rhino can
  consume.

V1 format reference:

- Source:
  `../ph-navigator/backend/features/aperture/services/to_hbe_window_construction.py`.
- Each aperture element becomes one Honeybee-Energy
  `WindowConstruction`.
- Identifier format: `{aperture_name}_C{col}_R{row}`.
  - In V2, use the element's canonical exterior/data-frame starting
    column and row: `column_span[0]`, `row_span[0]`.
  - **Escaping rule.** Honeybee identifiers must match
    `[A-Za-z0-9_]+` (whitespace, hyphens, and most punctuation are
    invalid). The mapping replaces every disallowed character with
    `_` and collapses runs of `_` to a single `_`. Examples:
    - `Door A` + col 0 + row 0 → `Door_A_C0_R0`.
    - `CW01` + col 2 + row 1 → `CW01_C2_R1`.
    - `Type B/2` + col 0 + row 0 → `Type_B_2_C0_R0`.
  - Collisions after escaping are an error: the export response
    surfaces the offending aperture names and the user must rename
    one. Do not silently disambiguate with suffixes.
  - The mapping must stay deterministic across V2 releases so Rhino
    component scripts can rely on it. Any change to the mapping is
    a breaking-change event coordinated with the Rhino
    + honeybee_ph workflow.
- Each construction contains one `EnergyWindowMaterialSimpleGlazSys`.
- Material identifier: `{construction_identifier}_GlazSys`.
- Material `u_factor`: per-element ISO 10077-1 U-Value.
- Material `shgc`: element glazing `g_value`.
- Material `vt`: V1 hardcoded default `0.6` unless a later catalog field
  makes VT explicit.
- Response shape: JSON object keyed by construction identifier, with
  each value equal to `WindowConstruction.to_dict()`.

Export behavior:

- Export reads the selected saved version or current draft source
  explicitly; do not silently choose a different source.
- Export skips or errors on broken aperture elements according to a
  structured validation policy defined in the phase plan. Normal new
  aperture elements should have default frame/glazing assignments and
  should export cleanly.
- Surface in the UI as an Apertures/Project overflow action and expose a
  REST/MCP read tool for downstream automation.
- Add backend fixtures against the V1 output shape before changing Rhino
  components.

## 18. Accessibility and read-only states

Required:

- Toolbar buttons have accessible labels and visible focus states.
- Icon-only buttons have tooltips.
- Canvas has a useful `role="img"` label naming the aperture type.
- SVG regions are mirrored by DOM overlay hit targets, so click/focus
  behavior does not depend on inaccessible raw SVG only.
- Text inputs preserve keyboard semantics: Enter commit, Escape cancel.
- Locked versions show values and viewing controls, but no mutating
  controls.
- Viewers can navigate, zoom, flip view direction, inspect cards, and
  open tooltips; they cannot mutate.

## 19. Testing and verification expectations

Backend tests:

- Aperture document validation: ids, spans, no holes, no overlaps,
  positive dimensions, unique names, operation payload, default
  frame/glazing seed behavior.
- Aperture command service: add/rename/duplicate/delete,
  add/delete row/column, dimension edit, merge/split, pick frame,
  pick glazing, edit operation, paste assignment.
- U-Value service: V1 parity fixtures, broken/null assignment warnings,
  operation excluded from hash, content-hash stability.
- HBJSON export: V1 shape fixture, identifier stability,
  identifier-escaping rules (spaces, slashes), collision detection,
  per-element U-Value mapping, glazing `g_value` as SHGC, `vt=0.6`.
- Drift detection: version-id mismatch, in-place field-delta on
  current version, `local_overrides` interaction.
- Refresh report continues to detect drift and source deactivation.
- MCP read/write tools if added.

Frontend tests:

- Geometry helpers.
- SVG region generation.
- View-direction flip helpers (column-reverse, operation-symbol
  L↔R swap, card frame-label flip).
- Dimension parser and formatter ports from V1, including parens
  expressions and precision preservation.
- Display-unit format selector persistence (per-user, per-system).
- Total-dimensions caption rendering in every display unit.
- Sidebar natural sort, add/rename/duplicate/delete, empty state,
  add/duplicate auto-suffix.
- Element-card frame-label flip and on-canvas pill ↔ card name
  sync.
- Selection model (single, shift, cmd/ctrl, ESC, version-switch
  clear).
- No-holes Delete-key educational tooltip.
- Canvas region click semantics: frame-rect → side picker;
  glazing-rect → glazing picker.
- Picker filtering by `location` for the four side pickers, and
  by `use` / `operation` based on element state. Verify "Showing
  N of M frames" footnote and Clear-filter affordance.
- Operation presets apply the expected direction sets.
- Copy/paste state machine and bounded undo stack (20 entries,
  per-aperture, cleared on type / version switch).
- Catalog badges: sourced-from, drift, hand-enter, datasheet link,
  "You edited this" tag.
- Locked/viewer read-only affordances.
- Refresh badges/dialog integration, including `local_overrides`
  default to "Keep mine".

Browser checks:

- Add an aperture type from empty state; verify default frame/glazing
  seeded.
- Build a 2-column aperture; verify total-dim caption updates.
- Assign frame/glazing from card and from canvas region click.
- Edit dimensions in each display unit format.
- Add operation symbol via preset and via manual direction toggles;
  verify L↔R flip on interior view.
- Confirm canvas / dimension strip / card sync.
- Open datasheet PDF from card link.
- Save via project header bar; reload; verify persisted document.
- Lock version; verify read-only on all surfaces (canvas, cards,
  pickers, dimensions, sidebar) while view-direction and zoom
  remain functional.
- Use `Review all` after catalog drift; verify per-row choices and
  bulk actions.
- Export HBJSON window constructions; verify identifier escaping.

Final code-changing closeout remains `make format && make ci`.

## 20. Suggested phase groups

These are not implementation plans yet. They are the likely grouping for
future phase files.

1. Terminology, schema, defaults, and command boundary
   - Rename reader-facing UI from Windows to Apertures.
   - Rename target document table from `window_types` to `apertures`
     unless the phase plan finds a concrete reason to retain the old
     key.
   - Add element `name` and `operation`.
   - Normalize ids to aperture vocabulary.
   - Seed/guarantee default frame and glazing refs.
   - Adopt `ApertureCommand`.
   - Add validation for coverage/no holes.

2. Builder shell and sidebar
   - V1-like layout.
   - add/rename/duplicate/delete.
   - active type selection and empty states.

3. SVG canvas foundation
   - geometry helpers;
   - SVG renderer;
   - overlay hit targets;
   - zoom and view direction.

4. Dimensions
   - row/column tickmarks and labels;
   - parser port;
   - add/delete/edit dimensions.

5. Element cards and picker polish
   - dense per-element cards;
   - frame/glazing per-side pickers;
   - full inline override fields;
   - catalog badges and refresh affordances.

6. Operations, merge/split, copy/paste
   - operation editor and SVG symbols;
   - selection;
   - merge/split;
   - eyedropper/paint-bucket.

7. U-Value service and display
   - backend ISO 10077-1 service;
   - header and card chips;
   - broken/import repair warning model.

8. HBJSON / Rhino export
   - V1 output-shape fixture;
   - REST/UI export;
   - MCP read tool;
   - Rhino component compatibility notes.

9. Manufacturer filters
   - filter modal;
   - picker integration;
   - in-use manufacturer guard.

10. MCP write follow-up
   - semantic MCP reads/writes;
   - browser/MCP conflict polish.

## 21. Decision log

Resolved 2026-06-05:

1. Use `ApertureCommand` before the core canvas work. Recommendation:
   follow the Assembly Builder command seam because Builder gestures are
   semantic and high-frequency.
2. Land element `name`, `operation`, no-holes validation, and aperture
   terminology/id cleanup in the same schema phase unless the phase plan
   finds a concrete migration risk.
3. Save should work for normal new aperture types. New elements start
   with default frame and glazing refs; missing/null assignments are not
   a normal user state. **Supersedes the US-WIN-3 Q-WIN-3 lean (option
   `b`: null defaults + Save-time validation) in
   `context/user-stories/10-windows.md`.** US-WIN-1 criterion 8 and
   US-WIN-3 criterion 6 must be reconciled to PRD §7 / §12 in the
   first implementation phase.
4. HBJSON window-constructions export is core scope and required for
   Rhino/Honeybee downstream workflows.
5. Manufacturer filters ship after the core canvas.
6. Canonical feature/domain term is `Apertures`, not `Windows`.

Resolved 2026-06-05 PM (PRD review):

7. **V1 `Frame Types` / `Glazing Types` sub-tabs are removed from the
   Apertures area** (§6.1). Catalogs live at the global catalog
   manager; the Apertures area is Builder-only. A read-only
   project-scoped refs view is surfaced as a Builder overflow action.
8. **Per-side frame picker filters by FrameRef `location` / `use` /
   `operation`** (§11.1). Top picks Head, Bottom picks Sill,
   Left/Right pick Jamb; `operation` narrows by element state.
   Filters are dismissible via a Clear-filter footnote for
   mis-classified catalog rows.
9. **Canvas regions are clickable as scoped pickers** (§9.2.1). Click
   on a frame rect opens that side's picker; click on the glazing
   rect opens the glazing picker. Element-name editing is also
   surfaced as an **on-canvas pill** centered on the glazing region;
   the card name field stays in sync.
10. **Selection model: single / shift / cmd-ctrl + ESC** (§9.2.2).
    Adjacency-only V1 shift-click rule is relaxed; merge validates
    contiguous rectangle at commit time.
11. **No direct delete-element gesture in v1** (§9.2.3). Delete /
    Backspace shows an educational tooltip pointing the user to
    merge or row/column delete. Auto-merge-on-delete deferred.
12. **Display-unit format selector ships in v1** with options
    `mm | cm | m` (SI) and `in | ft | ft-in | in-frac` (IP),
    stored per-user per-system (§10.1). Total-dimensions caption
    `<width> × <height>` renders above the canvas (§10).
13. **Operation presets ship in v1**: Tilt-Turn, Awning, Hopper,
    Casement (hinge L/R), Slider (L/R) (§11.3).
14. **Datasheet PDF link is a first-class card affordance**
    (`datasheet_url`, §11.2 / §12). Critical for the BLDGTYP Phius
    certification workflow.
15. **Drift detection covers both version-id mismatch and field-delta
    on current version** (§15). **Supersedes** the §15 prior phrasing
    ("compares the copied ref to the current catalog row").
    Aligns with US-WIN-11 criterion 1 (TB-09.a revised 2026-05-14).
16. **`catalog_origin.catalog_schema_version: 1` is required on
    every bookshelf copy** as a forward-compatibility hook (§12).
17. **HBJSON identifier escaping rule is deterministic**: replace
    every `[^A-Za-z0-9_]` with `_`, collapse runs (§17). Collisions
    after escaping fail the export with the offending names — no
    silent suffixing.
18. **Save / Save As live in the global project header bar**
    (§8); the Apertures header overflow menu carries aperture-type
    and feature-level actions only.
19. **Active aperture label has a single source of truth in the
    Apertures header** (§8); sidebar and (optional) header dropdown
    must drive the same selection state.
20. **Sidebar virtualization / type-to-filter deferred** to v1.1+;
    scroll-only navigation is acceptable for v1 even at 100+
    aperture types (§7).
21. **Standalone Frame Types / Glazing Types editing tab inside the
    Apertures area deferred** indefinitely (§6.1). Data model
    preserves every V1 field, so re-adding the tab later is a pure
    UI change.

## 22. Acceptance summary

The feature is PRD-complete when a future implementation can reproduce
the working shape of `Window Builder.png` in V2:

- sidebar of project aperture types (natural sort, add / rename /
  duplicate / delete, empty state, scroll at 100+ types);
- active aperture header with U-Value chip, info tooltip, and
  aperture-type overflow menu (Save / Save As stay in the global
  project header);
- proportional graphic aperture panel with **click-on-region
  pickers** (frame rect → side picker, glazing rect → glazing
  picker) and an **editable on-canvas element-name pill**;
- toolbar for zoom, view direction, copy/paste (eyedropper /
  paint-bucket / undo), merge/split, clear-selection;
- selection model (single / shift / cmd-ctrl + ESC) and the
  no-direct-delete invariant tooltip;
- editable dimensions with tickmarks, total-dimensions caption, and
  per-user display-unit format selector
  (`mm | cm | m` / `in | ft | ft-in | in-frac`);
- per-element assignment cards for glazing, four side frames, and
  operation — with the **operation preset menu**, sourced-from-
  catalog badge, drift badge, datasheet-PDF link, hand-enter badge,
  and "You edited this" tag;
- per-side picker filtering by FrameRef `location` / `use` /
  `operation`, with a dismissible "Showing N of M frames" footnote;
- HBJSON window-constructions export for Rhino/Honeybee workflows,
  with deterministic identifier escaping;
- all writes through versioned drafts via `ApertureCommand`
  (browser and MCP share the seam);
- catalog provenance (`catalog_origin` with `catalog_schema_version`
  and `local_overrides`) and refresh review (per-entry diff dialog +
  Builder-level drift banner + project-wide drift report) preserved;
- locked/viewer read-only behavior correct (zoom + view direction
  + datasheet links remain functional; mutation affordances hidden);
- verified by focused tests, browser check, `make format`, and
  `make ci`.
