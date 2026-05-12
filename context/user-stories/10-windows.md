---
DATE: 2026-05-11
STATUS: Split from context/USER_STORIES.md; canonical story body.
SOURCE: context/USER_STORIES.md
---

# PH-Navigator V2 — User Stories: Windows

## US-Builder-Windows — Windows tab (US-3.3)

**Status:** Draft (parent — sub-stories range Draft → Placeholder)
**Priority:** MVP
**PRD ref:** §6.2 (`tables.window_types` shape), §7 (catalog
bookshelf), §11.1 (project tabs), §11.5 (units architecture),
§8 (save / version model — Window-Builder edits flow into the
draft buffer, persisted by Save / Save As)
**UI/UX ref:** §2.6 *Windows tab* (placeholder — expanded by these
sub-stories)
**V1 reference:** `research/v1-window-builder-reference.md`
— deep enumeration of V1 behavior; consult for any "what does V1
do here" question. Cited as `V1 ref §N` below.

### Story (parent)
> As an editor, I want to compose the project's window / door types —
> the 2D grid of rows × columns, the elements that fill the cells,
> the frames and glazings each element uses, and the operation
> patterns (fixed / swing / slide / tilt-turn) — so that I can capture
> the design intent for every aperture in the project, see live
> ISO 10077-1 window U-values, and feed downstream tools (Rhino +
> honeybee_ph, certification submittals) without leaving the app.

### Why this is a story-cluster (US-WIN-1..12)
Window-Builder is the densest editing surface in PHN — V1 has 12+
named subsystems (sidebar, dimensions panel, canvas, elements table,
frame & glazing selectors, operation editor, manufacturer filter,
copy/paste, view direction, zoom, U-value). Splitting into an
`US-WIN-N` cluster lets us walk one subsystem at a time without
losing the cross-cutting picture. Sub-stories share the project's
versioned-document + bookshelf-catalog architecture (PRD §6.2, §7).

### Key V1 → V2 shifts (read first)
1. **All window-type data lives in the versioned project document.**
   `body.tables.window_types[]` per PRD §6.2. Edits flow into the
   draft buffer (PRD §8.3); explicit **Save** or **Save As** persists
   to a version. No V1-style per-edit autosave round-trip
   (V1 ref §14.1).
2. **Per-side Frame data and Glazing data are bookshelf-copied from
   the catalog, not live-referenced** (PRD §7.1). At pick time, the
   catalog row's values are *copied into the document* and stamped with a
   `catalog_origin` block. Catalog edits do not propagate into the
   project. Refresh-from-catalog (US-WIN-11) is the explicit
   re-sync gesture.
3. **No AirTable.** V2 catalog is hand-curated in the catalog manager
   (a separate top-level area; PRD §7.3, US-2). No "Refresh frame
   types from AirTable" gesture; no `purge_unused_frame_types`
   behavior.
4. **Backend is SI-only; frontend converts** (PRD §11.5). V1's
   selector option preview leaked hard-coded SI strings even in IP
   mode (V1 ref §17); V2 must respect the per-user IP/SI toggle
   everywhere — selectors, table cells, dimensions, U-value labels.
5. **Locked versions block all edits** (US-3.1). When the active
   version is locked, the entire Windows tab renders read-only with
   the "Save As to copy and edit" banner; no inline edit
   affordances anywhere in this cluster.
6. **Sort order normalized.** V1 has three different sort orders for
   aperture lists across three components (V1 ref §17). V2 uses
   `naturalSortCompare` everywhere (so `C2 < C10`).
7. **Selection cleared on version switch.** Canvas multi-select state
   does not survive a version switch via the header dropdown
   (US-3.1).
8. **Toast + Dialog replace `alert` + `window.confirm`.** V1 uses
   browser `alert()` and `window.confirm()` extensively
   (V1 ref §14.3, §17). V2 uses shadcn `Dialog` for confirmations
   and Sonner toasts for non-blocking feedback (UI/UX §1.3, §1.4).

### Open architectural questions — resolve early (data-model-shaping)

These four shape the document body and need to be settled before
Pydantic models are written. They are not blockers for this PRD's
acceptance, but are blockers for the first US-WIN-N implementation.

- **Q-WIN-1: Element span representation.** PRD §6.2 sketch shows
  `row_span: [start, end]` and `column_span: [start, end]` (range
  form). V1 stores `row_number + row_span` (offset + length;
  V1 ref §2.2). V2 picks the **range form** per the sketch — cleaner,
  generalizes naturally to merged cells, and JSON-Patch-friendly
  (a merge is a single value-replacement). **Lean: confirm range
  form. Convention: `[start, end]` is **inclusive** on both ends, so
  a 1×1 cell at row 0 col 0 is `row_span: [0, 0]`,
  `column_span: [0, 0]`.**
- **Q-WIN-2: Per-side frames.** **Resolved 2026-05-11:** V2 uses
  four inlined frame values per element
  (`frames: { top, right, bottom, left }`; V1 ref §2.2), now reflected
  in PRD §6.2 and the glossary. Reasons: Phius / WUFI
  need per-side U-values and Ψ-glazing to round-trip correctly;
  asymmetric jamb cases (e.g. structurally reinforced bottom) need
  per-side; V1's ISO 10077-1 calc assumes per-side
  (V1 ref §10.1).
- **Q-WIN-3: Default frame / glazing on element create.** V1 picks
  catalog row named "Default", falls back to first row, raises
  `NoFrameTypesException` / `NoGlazingTypesException` if catalog is
  empty (V1 ref §17). V2 has no AirTable seed.
  Options:
  (a) Seed the catalog with named "PHN-Default" frame and glazing
      rows on first deploy; new elements pick these by default.
  (b) New elements ship with `frames: { top: null, ... }`,
      `glazing: null`. Document validation tolerates nulls in the
      draft, but Save returns warnings ("3 elements have no frame
      assigned") and Save As to a `submitted` / `closed` kind
      requires non-null assignments.
  (c) Inline placeholder values not tied to the catalog — e.g.
      `name: "— pick a frame —"`, `width_mm: 50`, `u_value: 2.0` —
      with no `catalog_origin`.
  **Lean: (b) — null + Save-time validation.** Forces explicit
  picks, keeps `catalog_origin` clean (only present when a real
  catalog pick happened), avoids "everyone forgot to change the
  default" pattern. Confirm.
- **Q-WIN-4: Manufacturer-filter storage.** V1 stores
  `ProjectManufacturerFilter (project_id, manufacturer, filter_type,
  is_enabled)` — relational (V1 ref §9.3). V2 options:
  (a) Lives in the project document as
      `body.tables.manufacturer_filters` (PRD §6.2 sketch already
      includes this name). Filter state versions with the project,
      so locking a Submitted version captures filter at submit
      time.
  (b) Per-user app-level preference (`users.window_builder_manufacturer_filter`).
      Lighter; doesn't travel with the version; doesn't capture
      filter state in cert submits.
  **Lean: (a) — store in the project document.** A Submitted
  version's `manufacturer_filters` should reflect what the
  project actually consumed when submitted. Confirm.

### Other open questions (UX-shaping; can be resolved per-sub-story)

- **Q-WIN-5: Per-window-type deep-link URL.** V1 has no per-aperture
  URL (V1 ref §18). V2 lean: `/projects/{id}/windows` lists,
  `/projects/{id}/windows/{window_type_id}` opens a specific type.
  Confirm.
- **Q-WIN-6: Split behavior.** V1 splits a merged element into 1×1
  cells whose frame / glazing / operation revert to defaults — the
  source assignments are lost (V1 ref §17, §7.9). V2 lean: **preserve
  source assignments on every new cell.** The document model makes
  this cheap (one JSON-Patch instead of N inserts), and the V1
  behavior is a known papercut. Confirm.
- **Q-WIN-7: Frame-label flip semantics on interior view.** V1 flips
  both the SVG (visual right edge reads `frames.left`) AND the
  elements-table label (table row "Right Frame:" reads
  `element.frames.left` when interior view is active;
  V1 ref §7.10, §17). The behavior is technically correct but
  reliably surprises new readers. V2 lean: **keep the flip** —
  changing it would break the "what you see is what you label"
  invariant when looking from interior.
- **Q-WIN-8: HBJSON window-constructions export.** V1 ships
  `GET /aperture/get-window-constructions-as-hbjson/{bt_number}`
  building Honeybee-Energy `WindowConstruction` per element on
  demand (V1 ref §13.1, §17). V2 with PRD §11.4.6 builder ↔ HBJSON
  disconnect: keep, drop, or move?
  **Lean: keep, as a per-version export sibling to "download
  project JSON" in the project header `⋯` menu.** The construction
  JSON is the bridge into the Rhino + honeybee_ph workflow that
  PRD §11.4.6 acknowledges as the design-time exchange surface.
  Confirm.
- **Q-WIN-9: Display-unit format selector scope.** V1 keeps SI
  (`mm | cm | m`) and IP (`in | ft | ft-in`) last-choices separately
  in localStorage (V1 ref §4.7). V2 with per-user
  `users.units_preference` chooses **system** but not **format**;
  inside the Window-Builder, the user still picks `mm` vs `cm`
  vs `m` (in SI mode) or `in` vs `ft` vs `ft-in` (in IP mode).
  Storage: per-user (`users.window_builder_dim_format_si`,
  `users.window_builder_dim_format_ip`) or per-project
  document? **Lean: per-user.** Confirm.

### Sub-story sequence

| Sub-story | Topic | Status |
|---|---|---|
| US-WIN-1 | Window-type list (sidebar) — add / rename / duplicate / delete | Draft |
| US-WIN-2 | Compose the grid — rows × columns, dimensions, edge add | Draft |
| US-WIN-3 | Window-elements — naming, selection, merge, split | Draft |
| US-WIN-4 | Pick frame & glazing — bookshelf flow from the catalog | Draft (key V2 shift) |
| US-WIN-5 | Operation editor — fixed / swing / slide + directions | Draft |
| US-WIN-6 | U-value display — per-element + window-level (ISO 10077-1) | Draft |
| US-WIN-7 | Copy / paste assignments — eyedropper / paint-bucket | Draft |
| US-WIN-8 | Manufacturer filter — project-scoped, gates selectors | Draft |
| US-WIN-9 | Canvas — SVG render, view direction, zoom, label overlay | Draft |
| US-WIN-10 | Dimensions panel — input parsing, expressions, ft-in | Draft |
| US-WIN-11 | Refresh-from-catalog (per-entry) — bookshelf re-sync | Draft (new in V2) |
| US-WIN-12 | HBJSON window-constructions export | Placeholder (gated by Q-WIN-8) |

---

## US-WIN-1 — Window-type list (sidebar)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.window_types[]`), §11.1 (Windows tab),
§8 (draft + Save flow)
**V1 ref:** §5 (Sidebar), §3.3 (UnitBuilder shell), §4.1
(AperturesProvider)

### Story
> As an editor, I want a left-rail list of every window type in this
> project version, with quick-access actions to add, rename,
> duplicate, and delete a type, so I can navigate and reorganize my
> window set without leaving the canvas.

### Acceptance criteria

1. **Layout.** The Windows tab is split:
   - Left sidebar (≈260 px wide; collapsible to a 0-px rail with a
     chevron toggle), default state **closed** for first-time visits
     to a project (mirroring V1 ref §3.3).
   - Right main area = canvas + elements table for the active type
     (US-WIN-2..5).
2. **List source.** Renders `body.tables.window_types[]` from the
   currently-open version's draft body (or saved body if no draft).
3. **Sort order.** `naturalSortCompare` ascending by `name`. So
   `Type A`, `Type B`, ..., `Type 2`, `Type 10`. (V1 ref §5.1.)
4. **Each row shows name only** — no thumbnail, no U-value, no
   element count (matches V1; perf-friendly; can be expanded
   post-MVP). Active type is highlighted.
5. **Click a row → set active.** The clicked type becomes the
   editing target in the main area. Selection state is local to
   the tab (not persisted to URL in v1 unless Q-WIN-5 resolves
   yes; if so, URL becomes `/projects/{id}/windows/{wt_id}`).
6. **Hover-revealed row actions** (logged-in editor on an unlocked
   version only):
   - **Edit name** — opens the rename dialog (criterion 9).
   - **Duplicate** — clones the type (criterion 10).
   - **Delete** — confirms and removes (criterion 11).
   On a **locked** version, action icons are hidden entirely (the
   tab is read-only per US-3.1 cross-cutting). On a public view
   link, icons are also hidden.
7. **Add button.** Sticky at the top of the sidebar:
   `+ Add new window type`. Disabled on locked versions and public
   Viewers. Clicking creates a new window type (criterion 8) and
   sets it as active.
8. **Add new window type.** Creates the following object in the
   draft body:
   ```jsonc
   {
     "id": "win_<ULID>",                    // server-generated
     "name": "<auto-named per criterion 8a>",
     "row_heights_mm": [1000.0],
     "column_widths_mm": [1000.0],
     "elements": [
       {
         "id": "winel_<ULID>",
         "row_span": [0, 0],
         "column_span": [0, 0],
         "name": "Unnamed",
         "frames": { "top": null, "right": null,
                     "bottom": null, "left": null },
         "glazing": null,
         "operation": null
       }
     ]
   }
   ```
   Newly added type becomes the active selection. Default values
   match V1 (V1 ref §2.1, §6.10) except for the null frames/glazing
   per Q-WIN-3 lean.

   **8a. Auto-named to satisfy uniqueness (per criterion 9a).**
   The default name is **"Unnamed Window Type"**. If a window type
   with that name already exists in the active version's
   `tables.window_types`, the suffix ` (2)`, ` (3)`, …, is appended
   to find the first available integer. So a project that already
   has `Unnamed Window Type` and `Unnamed Window Type (2)` gets a
   new add named `Unnamed Window Type (3)`. Suffix-search uses the
   same case-insensitive trimmed comparison as criterion 9a.
9. **Rename dialog.**
   - Modal title: **"Window Type Name"**.
   - Single text field labelled **"Window Type Name"**, autofocus,
     full-select on focus.
   - Submit on **Enter**.
   - **Save** button disabled while:
     - the field is empty / whitespace, OR
     - the trimmed value equals the current name (no-op), OR
     - the trimmed value collides with another window type's name
       per criterion 9a.
   - **Cancel** / **Save** buttons (Cancel is the default action
     on Esc).
   - On Save, applies a JSON-Patch `replace` op to
     `tables.window_types[<idx>].name` in the draft body.

   **9a. Uniqueness rule (Q-WIN-1.1, resolved).** Window-type
   names **must be unique within a project version**. Comparison
   is **trim + case-insensitive**: `"Type A"`, `"type a "`, and
   `"  TYPE A"` are all treated as the same name. Display preserves
   the user's original casing.
   - Uniqueness is per-version-body (each version's
     `tables.window_types[]` is independent — duplicates across
     versions are fine; locked versions are immutable so they
     can't conflict anyway).
   - Names are **not required to be unique across projects**.
   - When the rename input would collide, the dialog shows a red
     helper line under the field: **"A window type named '<value>'
     already exists in this version."** The Save button stays
     disabled.
   - The same rule blocks Add (criterion 8a auto-suffixes to
     avoid it) and Duplicate (criterion 10a auto-suffixes).
10. **Duplicate.**
    - Deep-copies the active type into a new entry. New `id`s are
      generated for the type itself and every element.
    - `catalog_origin` blocks are preserved (the duplicate inherits
      its source's bookshelf state; no re-pick required).
    - The duplicated type becomes active.
    - Surfaced as a Sonner toast: **"Duplicated as '<new name>'"**.

    **10a. Duplicate naming.** Default new name =
    `"<source name> (Copy)"`. If that name already exists in the
    version (per criterion 9a), suffix ` (2)`, ` (3)`, …, until a
    free name is found. So duplicating `Type A` twice in succession
    produces `Type A (Copy)`, then `Type A (Copy) (2)`.
11. **Delete.**
    - shadcn `Dialog` confirm (not `window.confirm`):
      title **"Delete window type?"**, body **"This will remove
      '<name>' and all its elements from this version. Save or
      Save As to persist. Cancel keeps it in your draft."**,
      buttons **Cancel** / **Delete** (delete is the destructive
      variant).
    - On confirm, removes the entry from the draft.
    - If the deleted type was the active selection, the next type
      in sort order becomes active; if the list is empty, the
      main area shows the empty state (criterion 13).
    - **No `window.confirm`. No type-name re-typing** (deletion is
      reversible by Discard-changes or by not-Saving — much lower
      stakes than project deletion in US-1.4).
12. **Empty list state.** When `tables.window_types` is empty, the
    sidebar shows only the **+ Add new window type** button; the
    main area shows: "No window types yet. **[+ Add window
    type]**" centered, with the same primary action as the sidebar
    button.
13. **Locked-version + Viewer rendering.** All edit affordances
    (add button, hover icons, rename modal trigger) are hidden.
    The list is still navigable read-only. The active row is still
    highlightable.
14. **All mutations go through the draft buffer** (PRD §8.3); no
    direct version-body writes. The save status indicator in the
    project header bar (UI/UX §2.4) reflects the dirty state.

### Resolved questions (2026-05-10)

- **Q-WIN-1.1: Name uniqueness within a project version?**
  **Resolved:** **enforced** within a project version (per criterion
  9a). Trim + case-insensitive. Not required across projects. Add
  and Duplicate auto-suffix to avoid collision; Rename rejects.
- **Q-WIN-1.2: Delete confirmation.**
  **Resolved:** simple shadcn `Dialog` with Cancel / Delete (no
  type-name re-typing). Per criterion 11.
- **Q-WIN-1.3: Reorder.**
  **Resolved:** alphabetical (`naturalSortCompare`) only for MVP.
  Drag-reorder deferred to v1.1+ if requested.

### Open questions
None — all US-WIN-1 questions resolved 2026-05-10.

---

## US-WIN-2 — Compose the grid

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.window_types[].row_heights_mm` /
`column_widths_mm`), §11.5 (units architecture)
**V1 ref:** §6 (Dimensions panel), §7.1 (canvas grid layout),
§7.6 (EdgeAddButtons)

### Story
> As an editor, after creating a window type, I want to define the
> internal grid — number and sizes of rows and columns — by typing
> dimensions in any familiar unit (mm, in, `2'-6"`, `100+50`) and by
> adding rows / columns at any edge, so the grid matches the
> design.

### Acceptance criteria

1. **Initial state.** A newly created window type has one row
   (1000 mm) × one column (1000 mm). User edits from there.
2. **Display formats.**
   - Per-user **system** preference (SI / IP) drives the default
     unit per PRD §11.5.
   - Inside the Windows tab, a small unit-format selector (in the
     dimensions strip's gutter) lets the user pick:
     - SI mode: `mm | cm | m` (default `mm`).
     - IP mode: `in | ft | ft-in` (default `in`).
   - Format choice persists per-user across projects per Q-WIN-9.
3. **Add row / column** — two paths (no keyboard shortcuts in MVP
   per Q-WIN-2.1):
   - **Edge-add hover buttons** on the canvas: a 40-px hot-zone
     above / below / left / right of the grid reveals a small
     blue **+** button when hovered. Tooltips: `Add row at top`,
     `Add row at bottom`, `Add column at left`, `Add column at
     right` (V1 ref §7.6).
   - **Header buttons** in the canvas toolbar: `+ Row`, `+ Column`
     (each adds at the END of the data array — same as V1 default).
4. **Default new row / column dimensions** = 1000 mm.
5. **Adding at the START** shifts every existing element's
   `row_span` / `column_span` by +1 (the document update is a
   single JSON-Patch `replace` of the entire window type, simpler
   than V1's bulk-update SQL; V1 ref §6.10).
6. **Adding a row / column auto-creates one element per
   opposing-axis cell**, each:
   - `row_span` / `column_span` set to the new cell's coordinates,
   - `frames` all `null`, `glazing: null`, `operation: null`,
   - `name: "Unnamed"`.
   Per Q-WIN-3 lean (b) — null frames force pick. (V1 ref §6.10
   creates with default catalog refs; V2 differs.)
7. **Delete row / column.**
   - Hover reveals a small `–` button on each dimension label.
   - Confirm dialog **only when** the row / column contains
     element assignments that would be lost (any frame / glazing
     non-null) — quiet delete otherwise.
   - **Last row / column cannot be deleted.** Button is disabled
     with a tooltip: **"A window type must have at least one row
     and one column."** (V1 ref §6.11 returns 403; V2 makes it a
     UI-level lock.)
   - Deleting shifts subsequent indices down; element spans clamp.
8. **Edit a dimension** — click a label:
   - Label swaps for an inline `Input` (autofocus, full-select).
   - `endAdornment` shows the current display unit (`mm`, `in`,
     `ft`) — except in `ft-in` mode where the value contains markers.
   - Tooltip on the input matches V1's per-unit cheat sheet
     (V1 ref §6.3): e.g. for `in`/`ft-in`:
     **"Tip: Use 2' 6\", 6-1/2\", or expressions like 24 + 12"**.
   - Tooltip enter delay: 1500 ms (matches V1 — non-intrusive).
9. **Submit edit on Enter or click-away.** Edit is committed only
   if (a) the new value is different from the original
   pre-edit display string AND (b) `parseToMM(input)` is a
   positive non-NaN number (matches V1 ref §6.3 invariant).
   Otherwise the input reverts and no patch is sent.
10. **Parser** behavior matches V1 (US-WIN-10 fully specs):
    - SI mode: arithmetic with `+ - * /` (no parens; no negative
      second operand). Feet-inch markers in SI mode → invalid.
    - IP mode: feet-inches forms (`2'`, `6"`, `2' 6"`, `6-1/2"`,
      `2' 6-1/2"`); arithmetic when no markers; smart-quote
      normalization.
    - Empty / NaN / ≤0 → revert.
11. **Visual elements** match V1 (V1 ref §6.2):
    - Horizontal dimension strip below the canvas.
    - Vertical dimension strip to the left.
    - Per-segment label at midpoint, delete button on hover.
    - Center-guide line with grid-tick dots.
    - Grid-line ticks (30 px length).
12. **Total dimensions caption** above the canvas: `"<width> ×
    <height>"` in the active display unit (e.g.
    `"1234.5 mm × 1000.0 mm"` or `"3' 4-3/8" × 3' 3-3/8""`).
    V1 ref §7.11.
13. **All mutations flow through the draft buffer** as JSON-Patch
    ops; debounced ~500 ms (PRD §8.3). No autosave to the version
    body.

### Resolved questions (2026-05-10)

- **Q-WIN-2.1: Keyboard shortcuts for add-row/col?**
  **Resolved:** **no — not in MVP.** Edge-hover **+** buttons and
  the canvas-toolbar `+ Row` / `+ Column` buttons are the only
  add paths. Defer keyboard shortcuts to v1.1+ if requested.
- **Q-WIN-2.2: Drag-to-resize dimension labels?**
  **Resolved:** **no — not in MVP.** Dimension editing is
  text-input only (matches V1 ref §18). Defer to v1.1+ if
  requested.
- **Q-WIN-2.3: Equal-divide tool ("split column into N equal")?**
  **Resolved:** **no — not in MVP.** Defer to v1.1+ if requested.

### Open questions
None — all US-WIN-2 questions resolved 2026-05-10.

---

## US-WIN-3 — Window-elements (naming, selection, merge, split)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`elements[]` shape)
**V1 ref:** §4.1 (multi-select), §7.5 (element click), §7.9
(merge/split), §8.2 (elements table)

### Story
> As an editor, I want to select one or more cells, name them,
> merge contiguous cells into a single element (a transom, a
> spandrel, a multi-cell pane), and split a merged element back
> into its constituent cells, so I can express the design's
> mullion pattern.

### Acceptance criteria

1. **Element identity.** Every element has a stable `id`
   (`winel_<ULID>`), a `row_span: [r0, r1]` and
   `column_span: [c0, c1]` (inclusive ranges per Q-WIN-1), an
   optional `name`, four `frames`, one `glazing`, an optional
   `operation`. Default `name` on create is `"Unnamed"`.
2. **Click an element on the canvas → single-select.**
   Clicking the same element again deselects.
3. **Shift-click extends selection** — V2 keeps V1's
   adjacency-only rule (V1 ref §4.1, §17): the shift-clicked element
   must be adjacent to at least one already-selected element.
   Non-adjacent shift-clicks are silently ignored.
   **Confirm: V2 keeps this rule, or relax to "any element
   shift-clicked extends selection, but merge enforces
   contiguous-rectangle at commit time"?** Lean: **relax** — the
   silent-ignore is confusing; let merge fail with a clear toast
   instead.
4. **Cmd/Ctrl-click** toggles a single element in/out of the
   selection without the adjacency rule (NEW; V1 has no equivalent).
5. **Element name editing** — click the element's label overlay
   (small white pill at center; V1 ref §7.8):
   - Pill swaps for inline `Input` (autofocus, full-select).
   - **Enter** or **click-away** → commit; **Escape** → cancel.
   - Empty / whitespace-only name → revert to previous (no empty
     names). V1 default `"Unnamed"` is allowed.
6. **Merge** — toolbar `Merge` button (V1 ref §7.2):
   - Enabled when ≥2 elements selected.
   - Tooltip shows count: **"Merge selected (3 elements)"**.
   - On click: validates the selection forms a complete rectangle
     with no gaps. If valid, replaces those N elements with one
     element whose `row_span` covers the union and `column_span`
     covers the union. The merged element inherits the assignments
     of the **top-left** source element (frames, glazing,
     operation, name); a Sonner toast notes this:
     **"Merged 4 elements; kept assignments from top-left
     ('Sash 1A')."** Confirm.
   - If invalid (gaps or non-rectangular), error toast:
     **"Selection isn't a rectangle. Pick contiguous cells to
     merge."** (V1 ref §17 — server-side ValueError raised; V2
     can validate client-side too.)
7. **Split** — toolbar `Split` button:
   - Enabled when exactly 1 element selected AND that element has
     `row_span[1] > row_span[0]` OR `column_span[1] > column_span[0]`.
   - On click: replaces the merged element with N 1×1 elements
     covering the same area. Per Q-WIN-6 lean, **each new cell
     inherits the source's frames / glazing / operation** (V1 ref §17
     papercut fixed in V2). Each new cell gets a fresh `id` and
     name `"Unnamed"`.
8. **Clear selection** — toolbar button + `Esc` keypress.
9. **No holes invariant — no direct Delete-element gesture.**
   Per Q-WIN-3.3 (resolved): every cell of the grid is always
   covered by exactly one element. There is no "empty cell" /
   dashed-hole render state.
   - **Delete / Backspace key with a selection** is **not a
     direct gesture** in v1. Pressing it with elements selected
     shows a one-time tooltip: **"To remove an element, merge it
     into a neighbor (Toolbar → Merge) or delete its row / column
     (hover the dimension label, click −)."**
   - **Removing an element** is therefore one of:
     - **Merge it into an adjacent element** (criterion 6) —
       the merged target keeps its own assignments per
       criterion 6's top-left rule.
     - **Delete the row or column** that contains it
       (US-WIN-2 criterion 7).
   - **Deleting a window type** (US-WIN-1 criterion 11) removes
     all its elements at once and is unaffected by this rule.
   - **Direct Delete-element-with-auto-merge** is a v1.1+
     candidate if the merge-or-delete-row workflow proves
     cumbersome.
10. **Multi-select copy/paste** — V1 supports single-source →
    single-target paste only (V1 ref §18). V2 NEW (only if Ed
    wants): **multi-select paste** — picked source pasted onto
    every selected target. Defer to US-WIN-7. Confirm.
11. **Adjacency check.** "Adjacent" = the two elements share an
    edge fully or partially (their bounding rectangles touch
    along a row or column boundary, accounting for spans). Same
    rule as V1 ref §4.1 lines 22–35; ported as a TS utility.

### Resolved questions (2026-05-10)

- **Q-WIN-3.1: Shift-click rule.**
  **Resolved:** **relax** the V1 adjacency-only rule. Any
  shift-click extends the selection; **merge** validates the
  contiguous-rectangle invariant at commit time and shows a
  clear toast on failure (per criterion 3 + 6). The silent-ignore
  V1 behavior is dropped.
- **Q-WIN-3.2: Merged inheritance source.**
  **Resolved:** **top-left** source element's assignments are
  inherited (frames, glazing, operation, name) — per criterion 6.
  Toast confirms which source provided the assignments. No
  user prompt, no alternative source.
- **Q-WIN-3.3: Holes in the grid.**
  **Resolved:** **no holes allowed.** Every cell of the grid
  must always be covered by exactly one element. Deletion of an
  element is only valid if the freed cells can be re-merged with
  an adjacent element (or if the element is the last one and the
  whole window-type would be deleted, which is blocked by the
  "at least one element" invariant). Practically, criterion 9 is
  revised: Delete-key on selection only succeeds if the freed
  cells form a rectangle adjacent to exactly one neighbor — that
  neighbor absorbs the cells. Otherwise the user must merge or
  re-shape first. (See revised criterion 9 below.)

### Open questions
None — all US-WIN-3 questions resolved 2026-05-10.

---

## US-WIN-4 — Pick frame & glazing (bookshelf flow)

**Status:** Draft · **Priority:** MVP — **the key V2 shift**
**PRD ref:** §7.1 (bookshelf semantics), §7.4 (refresh from
catalog), §6.2 (`catalog_origin` block)
**V1 ref:** §8.5 (FrameTypeSelector), §8.6 (GlazingTypeSelector),
§9 (manufacturer filter), §17 (V1's hard-coded SI in option
preview — V2 fixes)

### Story
> As an editor, when assigning a frame type to one of an element's
> four sides, or a glazing type to its center, I want to browse the
> shared catalog filtered by my project's manufacturer set, see
> live performance data (U-value, width, Ψ-glazing, g-value),
> pick one, and have its values copied into my project's document
> so my project no longer depends on the catalog continuing to
> exist or look the same.

### Acceptance criteria

1. **Where the picker lives.** In the per-element table card
   (US-WIN-3 / V1 ref §8.2), each side-frame row and the glazing
   row has a combobox-style selector (shadcn `Combobox` / `Command`
   primitive, replacing V1's MUI `Autocomplete`).
2. **Picker open behavior.**
   - Trigger: click the chip showing the current frame / glazing
     name. If unset (per Q-WIN-3 lean), trigger reads
     **"Pick a frame…"** / **"Pick a glazing…"**.
   - Opens a popover with:
     - Search input (autofocus). Search matches `name`, `manufacturer`,
       `brand` (case-insensitive substring; V1 was alpha-ordered list
       only).
     - Filtered catalog list, sorted `naturalSortCompare` by `name`.
     - Manufacturer filter active by default — frames whose
       `manufacturer` is `null` always pass; otherwise `manufacturer`
       must be in the project's enabled set (US-WIN-8).
   - Each row shows:
     - Bold `name`.
     - Secondary line: `Width: 100 mm · U-value: 0.85 W/(m²K) ·
       Ψ-g: 0.040 W/(m·K)` for frames; `U-value: 0.7 W/(m²K) ·
       g-value: 0.50` for glazing. **Values rendered in the user's
       active unit system** — V1 hard-coded SI (V1 ref §17); V2 fixes.
3. **On pick — bookshelf copy.** The catalog row's values are
   **copied into the document**. The element side's `frame` /
   `glazing` field becomes:
   ```jsonc
   {
     "name": "Skyline Ridge SR-3",
     "width_mm": 100.0,
     "u_value_w_m2k": 0.85,
     "psi_g_w_mk": 0.040,
     "manufacturer": "Skyline",
     "brand": "Ridge",
     "use": "...", "operation": "...", "location": "...",
     "mull_type": "...", "source": "...",
     "datasheet_url": "...", "link": "...", "comments": "...",
     "catalog_origin": {
       "catalog_table": "frame_types",
       "catalog_record_id": "rec123abc",
       "catalog_version_id": "rec123abc_v3",
       "synced_at": "2026-05-10T14:23:00Z",
       "local_overrides": []
     }
   }
   ```
   (Exact field set is the FrameType / GlazingType Pydantic model —
   matches V1 ref §2.5, §2.6 with `id` removed and `catalog_origin`
   added.)
4. **After the first pick, the project owns its copy.** Editing
   the catalog row (in the catalog manager) does NOT change the
   element's frame. To re-sync, the user runs Refresh-from-catalog
   (US-WIN-11).
5. **Inline override.** The element table also exposes inline
   editable cells for the bookshelf-copied values:
   - Frame: editable `name`, `width_mm`, `u_value_w_m2k`,
     `psi_g_w_mk` directly in the row (the rest read-only;
     reachable via a "More fields…" expander).
   - Glazing: editable `name`, `u_value_w_m2k`, `g_value`.
   Editing any of these fields:
   - Updates the document inline.
   - Adds that field key to `catalog_origin.local_overrides` so
     refresh-from-catalog can default that field to **Keep mine** and
     tag it **"You edited this"**. (Catalog row itself is not affected.)
6. **"Sourced from catalog" badge.** Each frame / glazing chip
   shows a small `📚` (or shadcn `Library` icon — no emoji per
   project conventions) badge if `catalog_origin` is non-null.
   Hover tooltip: **"From catalog: 'Skyline Ridge SR-3' · Synced
   2026-05-10. Catalog has changed since pick — refresh to update."**
   (only shows the "changed" suffix when the catalog has a newer
   `current_version_id` than the synced one).
7. **Hand-entered values.** A "+ Hand-enter" entry at the bottom
   of the picker creates an entry with no `catalog_origin`. User
   types in `name`, `width_mm`, `u_value_w_m2k`, `psi_g_w_mk`
   inline. The element gets a small `✎` (handwritten) badge —
   tooltip: **"Hand-entered. Not linked to the catalog."**
8. **Empty catalog.** If the catalog is empty (e.g. fresh DB), the
   picker shows: **"No frames in the catalog yet. [Open catalog
   manager]"** linking to the catalog page in a new tab.
9. **Set all four sides — deferred to v1.1+ (Q-WIN-4.3).**
   Not in MVP. Each of the four sides is picked individually.
   The convenience shortcut "Apply this frame to all four sides"
   may be added post-MVP if it surfaces as a real papercut.
10. **All edits flow through the draft buffer.** Pickers debounce
    patches per PRD §8.3. The save status indicator updates.
11. **U-value live-recompute.** After every pick / inline edit,
    the per-element and window-level U-value labels (US-WIN-6)
    recompute (300 ms debounce; immediate on window-type switch,
    matching V1 ref §10.2).
12. **Read-only on locked versions / for Viewers.** Pickers are
    disabled; chips render as static labels with the badge.

### Resolved questions (2026-05-10)

- **Q-WIN-4.1: Inline override field set (criterion 5).**
  **Resolved:** the **full FrameType / GlazingType field set is
  editable inline** in the elements table. Power fields
  (`source`, `link`, `datasheet_url`, `comments`) and any other
  rarely-used metadata hide behind a `More fields…` expander on
  the row to keep the default density tight. Editing any field
  adds the edited field key to `catalog_origin.local_overrides` per
  criterion 5.
- **Q-WIN-4.2: Diverged-from-catalog visualization (criterion 6).**
  **Resolved:** **inline diff modal on click of the badge**,
  showing three columns: **Catalog (current) · Yours · Choose new
  value**. The "Choose new value" column lets the user pick
  per-row (Take catalog · Keep mine · Edit a third value). Full
  spec lives under **US-WIN-11** (refresh-from-catalog) — same
  modal, reachable from the per-element badge or from the
  project-wide drift summary.

### Resolved questions (continued — 2026-05-10)

- **Q-WIN-4.3: Apply to all four sides shortcut?**
  **Resolved:** **deferred to v1.1+; not in MVP.** Each side
  picked individually. (Criterion 9 updated.)
- **Q-WIN-4.4: Promote hand-entered frame into catalog?**
  **Resolved:** **deferred to v1.1+; not in MVP.** Hand-entered
  values stay in the project document with no `catalog_origin`;
  no UI to push them back into the shared catalog in v1.

### Open questions
None — all US-WIN-4 questions resolved 2026-05-10.

---

## US-WIN-5 — Operation editor

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`elements[].operation`)
**V1 ref:** §8.7 (OperationEditor), §7.4 (OperationSymbols)

### Story
> As an editor, I want to mark each element with its operation
> pattern (fixed, swing, slide, tilt-turn) and direction(s), so
> the canvas shows the standard architectural symbols and the
> exported HBJSON / certification documents reflect operability.

### Acceptance criteria

1. **Data shape.** `operation: { type: "swing" | "slide",
   directions: ("left"|"right"|"up"|"down")[] } | null`.
   `null` = fixed. (Matches V1 ref §2.2.)
2. **Editor UI** in the elements table (Operation row, V1 ref §8.4):
   - shadcn `Select` with options **Fixed**, **Swing**, **Slide**.
   - Picking **Fixed** sets `operation = null`.
   - Picking **Swing** or **Slide** sets `operation = { type, directions: [] }`.
   - When type is non-fixed, four `Toggle` buttons appear:
     **Left**, **Right**, **Up**, **Down**. Multiple selections
     allowed (V1 ref §8.7 allows tilt-turn = swing + [left, up]).
3. **Display label.**
   - `null` → **"Fixed"**.
   - `{ swing, [] }` → **"Swing"**.
   - `{ swing, [left, up] }` → **"Swing (Left, Up)"** — directions
     joined comma-space.
4. **Canvas symbols** match V1 (V1 ref §7.4):
   - Swing: dashed lines from the named-side hinge midpoint to the
     opposite two glazing-rect corners (`strokeDasharray="4,3"`).
   - Slide: a single arrow at vertical center, length = 80% of
     `min(w, h)`, head size = 10%.
   - Multi-direction: overlapping symbols.
   - Color: grey (`#666`), stroke-width 1.
5. **Inside-view flip.** Left ↔ Right swap when interior view is
   active (V1 ref §7.4); Up / Down unchanged. Mirror-image, as a
   real interior viewer would see.
6. **Pre-built operation presets** (NEW v.s. V1; V1 ref §18 lists
   absence). A small `Common patterns` menu at the top of the
   editor lists:
   - **Tilt-turn** (= swing + [left, up])
   - **Awning** (= swing + [up])
   - **Hopper** (= swing + [down])
   - **Casement, hinge left** (= swing + [left])
   - **Casement, hinge right** (= swing + [right])
   - **Slider, opens left** (= slide + [left])
   - **Slider, opens right** (= slide + [right])
   Picking applies the preset's directions; user can still
   customize after. **Confirm: MVP or v1.1?**
7. **Read-only on locked versions / for Viewers.**

### Resolved questions (2026-05-10)

- **Q-WIN-5.1: Operation presets in MVP?**
  **Resolved:** **yes — in MVP.** The `Common patterns` menu
  (Tilt-turn, Awning, Hopper, Casement (hinge L/R), Slider (L/R))
  ships in v1 per criterion 6. Short list, recurring papercut
  removal.
- **Q-WIN-5.2: Operation feeds U-value?**
  **Resolved:** **no — operation does not affect U-value.** The
  thermal effect of operability (gasket / weatherseal / extra
  meeting-rail at sashes) is **already baked into the chosen
  frame product's `u_value_w_m2k`** — picking a casement frame
  vs. a fixed frame is what changes the U. So:
  - The backend U-value calc ignores `operation` entirely (it
    already does — V1's calc never read it; V1 ref §10.1).
  - The frontend U-value-fetch dependency key **excludes
    `operation`** (V1 ref §17 papercut fixed). Toggling a swing
    direction does NOT trigger a U-value refetch.

### Open questions
None — all US-WIN-5 questions resolved 2026-05-10.

---

## US-WIN-6 — U-value display

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10)
**PRD ref:** §6.2 (`tables.window_types`), §10.4 (glossary)
**V1 ref:** §10 (full ISO 10077-1 calc + display components)
**Convention reference:** `context/GLOSSARY.md` — Thermal
performance section. **U-Value (no films) only**, never
"U-Factor." Same policy as envelope (US-ENV-10) and the
Model-tab info panel (US-VIEW-6).

### Story

> As an editor composing a window type, I want a single live
> U-Value number in the Windows tab — both at the window-type
> level and per-element — so I know at a glance whether the
> assembly hits my design target, using the same convention
> the rest of PHN uses.

### Acceptance criteria

1. **Window-type-level chip.** Inside the Windows tab content
   header (NOT the project header bar — per Q-WIN-6.1
   resolved: window U-Value is window-scoped, not
   project-scoped). Renders alongside the window-type
   selector / name.

2. **Per-element chip.** Each elements-table card shows its
   own U-Value chip (per-element data, since per-side frame
   selection per Q-WIN-2 means each element has a distinct
   composite U-Value).

3. **Label text — per active unit system, no films
   convention** (matches `context/GLOSSARY.md` + US-ENV-10):
   - IP: `Window U-Value: 0.21` (2 decimals, BTU/(hr·ft²·°F))
   - SI: `Window U-Value: 1.20 W/m²K` (2 decimals)
   - Per-element renders same format with smaller font.
   - **NEVER labeled "U-Factor"** — the films-excluded
     convention applies here exactly as it does on the
     envelope side. Window U-Value is the **composite**
     conductance through frame + glazing + spacer at the
     window level, excluding surface films.

4. **Info icon** opens the tooltip:

   > **Window U-Value**
   >
   > Composite per-window-type U-Value computed per ISO
   > 10077-1, combining frame, glazing, and spacer
   > performance with area-weighted aggregation across all
   > sides of each element.
   >
   > Note: Surface film resistances (air films) are NOT
   > included in the value shown here — same convention as
   > the envelope's R-Value display (US-ENV-10).
   >
   > Operation (Tilt-Turn, Casement, etc.) does NOT affect
   > this U-Value — the operability's thermal effect is
   > already captured in the picked frame product's
   > `u_value_w_m2k`.
   >
   > *Reference: ISO 10077-1*

5. **Backend calculation** — port V1's
   `backend/features/aperture/services/window_u_value.py`
   (renaming the V1 `aperture` concept → V2 `window_type`).
   Algorithm unchanged: per ISO 10077-1, area-weighted
   composite over frame / glazing / spacer.

6. **Caching.** Backend keys the cached result by a
   **content-hash** of the window-type subtree
   (`row_heights_mm`, `column_widths_mm`, `elements[*]`
   with each element's `frame.{top,right,bottom,left}` +
   `glazing` — only the U-Value-affecting fields). Frontend
   refetches on hash change. V1 ref §10.1 pattern preserved.

7. **Refetch trigger — explicitly EXCLUDES `operation`**
   (per Q-WIN-5.2 resolution). V1 ref §17 flagged this as
   a papercut where the frontend dep key included
   `operation`, triggering unnecessary refetches when
   only the operation enum changed. V2 fixes: the
   content-hash on the backend and the dependency key on
   the frontend both omit `operation`.

8. **Refetch trigger fires on:**
   - Add / remove / merge / split element
     (`tables.window_types[<wt>].elements[]` shape change)
   - Element's frame or glazing reference change
   - Inline override of frame / glazing values (any
     U-Value-affecting field — `u_value_w_m2k`,
     `psi_install_w_mk`, etc.)
   - Row height / column width change (affects element
     areas, which affect the area-weighted composite)
   - Debounced ~500 ms after the last edit (matches
     US-ENV-10's behavior).

9. **`min-width: 200 px`** on each U-Value chip to prevent
   layout shift when the value changes from `--` to a
   number.

10. **Loading state.** While the request is in flight,
    the chip renders `…` with low-opacity tween.

11. **Invalid-state handling.** When any element is
    missing a frame or glazing (per Q-WIN-3 — `null` is
    allowed in draft), the window-type chip renders
    with the same **"unfinished"** qualifier as
    US-ENV-10 criterion 8:
    - Compact form: `Window U-Value: 1.20 W/m²K
      (unfinished)` — italic, muted.
    - Tooltip extends with: *"2 elements are missing a
      frame or glazing assignment. The value above is
      computed from the picked elements only."*
    - The number still renders; we don't suppress it.

12. **Locked-version + Viewer rendering.** Chip and
    tooltip work identically — value is data, not edit
    state.

### Resolved questions (2026-05-10)

- **Q-WIN-6.1: Where to render the window-type-level
  chip — project header vs Windows tab content header?**
  Resolved: **Windows tab content header.** Window
  U-Value is window-scoped, not project-scoped.

### Open questions
None outstanding.

### Cross-references

- **`context/GLOSSARY.md`** — Thermal performance section;
  drives the U-Value-only label + tooltip text.
- **Q-ENV-4 resolution** — sibling envelope decision; same
  policy applies here.
- **Q-WIN-5.2 resolution** — operation does not feed
  U-Value; ensures cache key correctness (criterion 7).
- **US-ENV-10** — envelope-side parallel; identical
  pattern for canvas-header thermal display.
- **US-VIEW-6** — Model-tab info panel; surfaces the same
  Honeybee-source U-Value on each aperture.

---

## US-WIN-7 — Copy / paste assignments

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10)
**PRD ref:** §6.2 (`tables.window_types`), §8.3 (JSON-Patch via
draft buffer)
**V1 ref:** §4.10 (CopyPaste context), §7.2 (toolbar buttons)
**Mirrors:** US-ENV-9 (envelope-side copy/paste) — same
eyedropper / paint-bucket pattern, same deferral decisions on
cross-tier paste + multi-select + keyboard shortcuts (V2-wide
consistency per Ed 2026-05-10)

### Story

> As an editor composing a complex window type, I want to copy
> the operation + glazing + per-side frame assignments from
> one window-element onto others with an eyedropper / paint-
> bucket gesture — without re-walking the bookshelf picker for
> each target — so building out grids of similar elements stays
> fast.

### Acceptance criteria

1. **Toolbar buttons** in the Windows tab header:
   - **Eyedropper** — enters "pick" mode.
   - **Paint-bucket** — enters "paste" mode (enabled only
     after a pick).
   - **Undo-last-paste** — explicit mouse-driven undo
     (parallel to US-ENV-9 criterion 1; ⌘Z also works).

2. **State machine** (V1 ref §4.10 parity, mirrors US-ENV-9
   criterion 2):
   - `idle` → click eyedropper → `picking`
   - `picking` → click source element → `picked` (source
     element shows subtle ring outline)
   - `picked` → click paint-bucket → `pasting`
   - `pasting` → click target element → paste applied +
     600 ms pulse animation → stays in `pasting` (so user
     can rapid-fire multiple targets without re-clicking
     the toolbar)
   - **ESC** at any non-idle state → return to `idle`
   - **Click outside any element** during pick / paste →
     return to `idle`

3. **Copy payload — 6 fields** (V1 parity per V1 ref §4.10):
   ```typescript
   {
     operation: string,
     glazing: { /* full glazing object including catalog_origin */ },
     frames: {
       top:    { /* full frame object including catalog_origin */ },
       right:  { /* ... */ },
       bottom: { /* ... */ },
       left:   { /* ... */ }
     }
   }
   ```
   - **`catalog_origin` blocks travel with the copy** —
     the target's drift-tracking starts fresh from the
     source's pinned `catalog_version_id`.
   - **NOT copied** (target keeps its own values): `id`,
     `row_span`, `column_span`, `display_name`, any
     per-element override metadata not part of the
     assignment.

4. **Single JSON-Patch per paste-target** (V2 cleanup
   matching US-ENV-9 criterion 4). V1 emitted multiple
   PATCH requests per paste-target; V2 paste = **one
   JSON-Patch** with multiple `replace` ops covering the
   6 payload fields, atomic at the draft-buffer level.

5. **No cross-window-type paste in V2 v1** (mirrors
   US-ENV-9's no-cross-assembly-paste decision per Ed
   2026-05-10). Switching the active window type clears
   all pick / paste state. **Rationale:** V2-wide
   consistency with US-ENV-9; the cross-tier mental
   model (does state survive a tier switch?) shouldn't
   differ between Windows and Envelope. The data model
   supports it trivially (just copy values +
   `catalog_origin` blocks), so v1.1+ can lift this
   without schema work.

6. **No multi-select paste in V2 v1** (mirrors US-ENV-9
   criterion 6). One click = one target. v1.1+ candidate.

7. **No keyboard shortcuts (⌘C / ⌘V) on the windows
   canvas** (mirrors US-ENV-9 criterion 7). Toolbar +
   ESC + ⌘Z are the full interaction surface.

8. **Bounded undo stack — 20 entries per active
   window type** (matches V1 + US-ENV-9 criterion 8).
   - ⌘Z undoes the last paste; subsequent presses pop
     the stack.
   - Undo-last-paste toolbar button is the mouse-driven
     equivalent.
   - In-memory only, per-window-type, cleared on type /
     version / document switch. Not persisted.

9. **Refetch window U-Value after every paste** —
   paste mutates `glazing` and the four `frames` (all
   U-Value-affecting). `operation` is excluded from the
   cache key per Q-WIN-5.2 / US-WIN-6 criterion 7, so
   the post-paste refetch fires only when there's a
   real frame / glazing change.

10. **Visual feedback during pick / paste mode:**
    - Source element ring outline (CSS var
      `--copy-source-ring`) — same as US-ENV-9
      criterion 10.
    - Target element 600 ms pulse animation on paste.
    - Element-select / merge / split affordances hidden
      during pick / paste mode (parallel to US-WIN-9 +
      US-ENV-4 criterion 5 patterns).

11. **Locked-version + Viewer rendering.** All
    toolbar buttons hidden; click on an element opens
    the read-only element panel as normal.

12. **All paste state is ephemeral frontend state** —
    lives in the windows-builder Zustand store
    (parallel to envelope-builder's `pickPasteState`),
    keyed per `window_type_id`. Not part of the project
    document.

### Resolved questions (2026-05-10)

- **Cross-window-type paste?** Resolved: **no — V2 v1
  mirrors US-ENV-9's "no cross-tier paste"** decision
  for consistency. V1 allowed it; V2 v1 doesn't. v1.1+
  can lift trivially.
- **Multi-select paste?** Resolved: **defer to v1.1+.**
- **Keyboard shortcuts on canvas?** Resolved: **defer to
  v1.1+.** Toolbar + ESC + ⌘Z only.

### Open questions
None outstanding.

### Cross-references

- **US-ENV-9** — sibling story; identical state machine
  shape, payload-cleanup pattern, and three deferral
  decisions. Both stories should likely be implemented
  behind a shared `<PickPasteToolbar>` primitive if the
  abstraction is clean (call the implementer makes
  during build).
- **US-WIN-6 criterion 7** — refetch trigger fires
  after every paste; cache key excludes `operation`.
- **Q-WIN-5.2 resolution** — operation does not feed
  U-Value; captured in US-WIN-6.

---

## US-WIN-8 — Manufacturer filter

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10)
**PRD ref:** §6.2 (`tables.manufacturer_filters` —
project-document section), §7 (catalog model)
**V1 ref:** §9 (manufacturer filter modal + storage)

### Story

> As an editor working on a project with specific manufacturer
> commitments (e.g. all Schüco frames; only Saint-Gobain
> glazings), I want a per-project manufacturer filter that
> narrows down the catalog picker to only the manufacturers
> relevant to this project — so I don't have to scroll past 80
> products from manufacturers I'll never use.

### Acceptance criteria

1. **Storage** (per Q-WIN-4 resolved): `body.tables.manufacturer_filters`
   — a project-document section, versioned with the project
   like everything else under `body`. Shape:
   ```jsonc
   {
     "manufacturer_filters": {
       "frame_manufacturers_enabled": [
         "Schüco", "Zola", "Alpen", ...        // string identifiers; subset of the catalog roster
       ],
       "glazing_manufacturers_enabled": [
         "Saint-Gobain", "Cardinal", ...
       ]
     }
   }
   ```
   - **Inclusive list** (which manufacturers ARE enabled),
     not exclusive — `[]` means "no manufacturers visible
     in the picker," which is the explicit (and rare)
     state where the user has un-checked everything.
     `null` / absence is treated as "default state."
   - **Default state on a new project**: `null` (or both
     arrays equal to the full catalog roster at project
     create time) — meaning "all manufacturers enabled."
     V1 ref §9.3 parity.

2. **Modal trigger** — project header `⋯` overflow menu:
   **"Configure manufacturer filters"**. Opens a shadcn
   `Dialog` containing the filter modal.

3. **Modal contents** (V1 ref §9 layout):
   - Header: title + count summary ("12 of 18 frame
     manufacturers enabled · 6 of 9 glazing manufacturers
     enabled").
   - Two **checkbox lists** side by side (Frame
     Manufacturers · Glazing Manufacturers).
   - Each row: checkbox + manufacturer name + count badge
     showing how many catalog products are gated by this
     manufacturer ("Schüco · 23 products").
   - **"In-use" manufacturers** are **always-on**,
     checkbox disabled, with tooltip *"In use on N window
     elements — can't be disabled while referenced."*
     (V1 ref §9.2). Computed live from
     `tables.window_types[*].elements[*].frame.*` +
     `glazing` `manufacturer` field references.
   - Top of each list: **Select all** / **Clear all**
     bulk-action links (V2 NEW vs V1; small ergonomic win).
   - Footer: **Cancel** / **Save** buttons. Save is
     disabled if no changes have been made.

4. **Mutation flow:** Save commits a single JSON-Patch
   `replace` on `body.tables.manufacturer_filters` to the
   draft buffer (PRD §8.3). Closes the modal on success.

5. **Picker integration** — both US-WIN-4 (Pick frame &
   glazing) and US-WIN-11 (Refresh-from-catalog) filter
   their candidate lists through these filters:
   - Frame picker shows products from manufacturers in
     `frame_manufacturers_enabled` (or all when `null`).
   - Glazing picker shows products from manufacturers in
     `glazing_manufacturers_enabled` (or all when `null`).
   - Refresh-from-catalog drift diff still surfaces
     drift on filtered-out manufacturers, but the picker
     in the diff modal narrows by the same filter.

6. **"Filter narrowed your picker" UX hint** — when the
   active project has a non-default manufacturer filter
   AND the picker shows fewer than the full catalog roster,
   a small line at the bottom of the picker reads:
   *"Showing 12 of 18 manufacturers · [Adjust filter]"*
   with the link opening this modal. Avoids the V1
   confusion ("where did Manufacturer X go?").

7. **In-use enforcement on Save:** if a user attempts to
   uncheck an in-use manufacturer (e.g. via "Clear all"
   while in-use entries exist), the in-use entries
   remain checked (the toggle is suppressed) and a
   toast surfaces: *"3 manufacturers stayed enabled
   because they're in use."* No hard error.

8. **Catalog roster source.** The list of available
   manufacturers in each checkbox column is built from
   the distinct `manufacturer` values across the
   corresponding catalog table (Frame catalog for the
   frame list; Glazing catalog for the glazing list).
   Refreshes when the catalog changes (live source — not
   a snapshot in the project document).

9. **Locked-version + Viewer rendering:**
   - **Locked version:** modal opens read-only; Save
     button hidden; checkbox columns disabled.
   - **Viewer:** modal trigger hidden in the `⋯`
     menu.

10. **Empty-catalog edge case.** If a catalog has zero
    manufacturers (e.g. fresh deployment with no seed
    data), the corresponding checkbox list shows the
    empty state *"No manufacturers in the catalog yet."*
    No save-on-empty issue since there's nothing to
    toggle.

### Resolved questions (2026-05-10)

- **Q-WIN-8.1: Per-project preset of "default-on"
  manufacturers** (e.g. BLDGTYP defaults to a curated
  subset rather than "all enabled")? Resolved: **defer
  to v1.1+**. Default stays "all enabled" (V1 parity).
  When a per-firm-preset feature lands, it'd likely
  sit at the user-preferences level
  (`userPreferencesStore.default_manufacturer_filters`)
  rather than per-project.

### Open questions
None outstanding.

### Cross-references

- **Q-WIN-4 resolution** — storage location
  (`body.tables.manufacturer_filters`).
- **PRD §6.2** — `tables.manufacturer_filters` shown in
  the canonical project-document sketch.
- **US-WIN-4** — picker filters its catalog rows through
  this.
- **US-WIN-11 (Refresh from catalog)** — diff dialog's
  pickers honor this filter.

---

## US-WIN-9 — Canvas (SVG render, view direction, zoom, label overlay)

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10)
**PRD ref:** §6.2 (`tables.window_types`)
**V1 ref:** §7 (full canvas — SVG composition + view direction
+ zoom + labels)
**Mirrors:** US-ENV-4 (envelope canvas) — shares the
locked-aspect-ratio + per-user-persisted-zoom pattern resolved
in Q-ENV-4.1

### Story

> As an editor composing a window type, I want a proportional
> SVG canvas showing the elements grid — each cell drawn with
> its four frames around its glazing — with toggleable view
> direction (interior ↔ exterior), zoom controls, and editable
> element-name labels overlaying each cell, so I can compose
> and review window types visually.

### Acceptance criteria

1. **Container layout** (V1 ref §7.1 parity):
   - Canvas wrapper fills the Windows tab content area below
     the per-type header.
   - **View-direction label** at the top reads
     `"Viewing from inside"` or `"Viewing from outside"`
     depending on the current direction (criterion 4).
   - Below the canvas: U-Value display chips (US-WIN-6) +
     dimensions panel (US-WIN-10).

2. **Per-element rendering** (V1 ref §7.3 parity — the
   four-rectangles-per-element pattern):
   - Each element is composed of **5 SVG `<rect>` regions**:
     - **Top frame** rectangle (height = top frame width)
     - **Right frame** rectangle (width = right frame width)
     - **Bottom frame** rectangle (height = bottom frame width)
     - **Left frame** rectangle (width = left frame width)
     - **Glazing** rectangle in the center (remaining area)
   - Each rectangle's fill comes from the picked frame /
     glazing's `argb_color` (parsing the `"(a, r, g, b)"`
     string to CSS `rgba(...)`; default `#ccc` on parse
     fail or null).
   - **Null-frame / null-glazing rendering** (mirrors
     US-ENV-4 criterion 3 dashed-outline treatment):
     - Null frame or glazing renders with **blank fill +
       dashed `#999` 1.5 px outline**.
     - Visually flags "no frame/glazing picked yet" — the
       same affordance as null-material segments on the
       envelope canvas. Pairs with the US-WIN-6 criterion
       11 "unfinished" U-Value qualifier.
   - **Merged elements** (per US-WIN-3) span their
     `row_span × column_span` cells; the 5-rect composition
     scales up with the merged area.

3. **Zoom + locked aspect ratio** (mirrors US-ENV-4
   criterion 9 + Q-ENV-4.1):
   - Single scale state: `windowCanvasZoom: number`,
     default `1.0`. **Per-user preference** stored at
     `userPreferencesStore.window_builder_canvas_zoom`
     (sibling to envelope's `envelope_canvas_zoom`).
   - Both axes always scale together by the same factor
     — **aspect ratio is never independent**, fixing
     V1's narrow-viewport squish problem identified
     for envelope (the same flex-grow bug affects this
     surface).
   - Discrete steps: `0.05, 0.10, 0.20, 0.30, 0.50,
     0.75, 1.0` (V1 ref §4.9 had `0.05`-step granularity
     0.05–1.0; V2 simplifies to ~7 discrete steps that
     match what users actually need).
   - Header zoom cluster: `[−] 25% [+] [Fit]` — same
     pattern as US-ENV-3 criterion 1 envelope zoom
     cluster. Visible on locked versions / Viewers.

4. **View direction toggle** (V1 ref §7.10 parity):
   - **Toolbar button** at the canvas header — toggles
     between "interior" and "exterior" view.
   - **Visual semantics:**
     - Default = **exterior view** (looking at the
       window from outside the building).
     - On flip → **interior view**: column-reverse (left
       and right swap), AND symbol-flip on each element
       (the operation symbol — V1 ref §7.10 — mirrors
       left↔right since you're now looking from the
       other side).
   - **Frame-label flip on interior view: KEEP** (per
     Q-WIN-7 resolved). The elements-table label text
     also flips so what you see on the canvas matches
     what you read in the table — "what you see is what
     you label."
   - **View-direction storage: per-user preference**
     (per Q-WIN-9.1 — see Open Questions). Lives at
     `userPreferencesStore.window_builder_view_direction`
     (`'exterior' | 'interior'`).

5. **Label overlay — editable element name pills** (V1
   ref §7.8 parity):
   - Each element's `display_name` renders as an
     overlay pill centered on the glazing region (above
     the SVG, in a DOM layer that scales with zoom).
   - **Click-to-edit**: pill becomes an input field;
     Enter commits (single JSON-Patch `replace` on
     `tables.window_types[<wt>].elements[<el>].display_name`),
     Escape cancels, blur commits.
   - Empty names rejected (silently revert to prior
     value); whitespace trimmed.
   - Same name allowed across multiple elements in the
     same window-type (no uniqueness constraint — elements
     are identified by `id`, not name).

6. **Hover affordances:**
   - **Hover on element** → subtle ring outline + the
     element becomes the click target for selection
     (US-WIN-3 element selection).
   - **Hover on frame region (one of the four rects)** →
     stronger ring on just that rect; click opens the
     per-side frame picker (US-WIN-4) scoped to that side.
   - **Hover on glazing region** → ring on glazing rect;
     click opens the glazing picker.

7. **Click semantics:**
   - **Click on an element (background area)** → selects
     the element (US-WIN-3).
   - **Click on a frame rect** → opens the frame picker
     for that side (US-WIN-4).
   - **Click on the glazing rect** → opens the glazing
     picker for that element (US-WIN-4).
   - **In pick / paste mode (US-WIN-7)** → click drives
     the copy / paste state machine instead.

8. **Hover-`+` add row/col affordances** (mirrors V1 +
   US-ENV-4 hover-circle pattern — V1's edge-hot-zone
   pattern noted in Q-ENV-10 stays here on the windows
   side per its actual V1 implementation):
   - **+ Add row above / below** circular `+` buttons
     revealed on hover at the top / bottom edges of the
     row-rail.
   - **+ Add column left / right** at the left / right
     edges of the column-rail.
   - Gated: logged-in editor, unlocked version, not in
     pick / paste mode (hidden for Viewers).

9. **Loading state.** Canvas renders nothing (or a quiet
   skeleton) when the active window-type is in flight or
   null.

10. **Locked-version + Viewer rendering.** Canvas
    visually identical; hover-`+` buttons + frame /
    glazing pickers hidden; pills are read-only (no
    click-to-edit); view-direction toggle and zoom
    cluster remain functional (viewing aids, not edits).

11. **Horizontal scroll on overflow.** When the scaled
    window-type exceeds canvas width, the canvas
    scrolls horizontally — never compresses (matches
    US-ENV-4 criterion 2 fix).

### Resolved questions (2026-05-10)

- **Q-WIN-9.1: View-direction storage scope?** Resolved:
  **per-user preference** in
  `userPreferencesStore.window_builder_view_direction`.
  V1 used `sessionStorage` (per-tab), which is awkward
  when a user opens the same project in a new tab. Per-
  user matches the pattern locked in for canvas zoom +
  unit-system + window-builder dim format.
- **Zoom persistence?** Resolved: **per-user preference**
  in `userPreferencesStore.window_builder_canvas_zoom`,
  parallel to envelope. V1 was per-tab session; V2
  upgrades to per-user.

### Open questions
None outstanding.

### Cross-references

- **US-ENV-4** — envelope-side parallel canvas; same
  locked-aspect-ratio + per-user-zoom pattern.
- **Q-ENV-4.1 resolution** — drives the aspect-ratio
  + zoom-control design.
- **Q-WIN-7 resolution** — frame-label flip on interior
  view stays in.
- **US-WIN-3** — element selection / merge / split feeds
  click semantics.
- **US-WIN-4** — frame / glazing pickers triggered by
  per-region clicks.
- **US-WIN-6** — unfinished-U-Value qualifier pairs with
  the null-frame / null-glazing dashed outline.
- **US-WIN-7** — pick / paste mode preempts normal click
  behavior.
- **US-WIN-10** — dimensions panel sits below the canvas.

---

## US-WIN-10 — Dimensions panel (parser + display)

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10)
**PRD ref:** §6.2 (`row_heights_mm`, `column_widths_mm` on
window types), §11.5 (units architecture — backend SI canonical,
frontend converts)
**V1 ref:** §6 (full Dimensions panel + parser tests)

### Story

> As an editor sizing a window type, I want a Dimensions panel
> below the canvas that lists each row height and column width
> with editable inline labels — and I want to type those values
> in whatever format is natural (decimal mm, fractions, feet-
> and-inches, or a simple expression like "100 + 50") with the
> parser figuring out what I meant — so I can size windows
> without context-switching to a calculator or a unit converter.

### Acceptance criteria

1. **Panel layout** (V1 ref §6.1 parity):
   - Sits directly below the canvas (US-WIN-9), within the
     Windows tab content area.
   - Two sections side by side: **Row Heights** (left) and
     **Column Widths** (right). Each section is a vertical
     list of editable rows.
   - Per row: index label (e.g. `Row 1`), input field with
     the dimension value, unit suffix per the active
     display format (criterion 4).

2. **Display unit selector** at the top of the panel —
   shadcn `Select` with options matching V1 ref §6.3:
   - **Millimeters** (`mm`) — `"304.8"`
   - **Centimeters** (`cm`) — `"30.48"`
   - **Meters** (`m`) — `"0.305"`
   - **Decimal inches** (`in`) — `"12.0"`
   - **Decimal feet** (`ft`) — `"1.0"`
   - **Feet-and-inches** (`ft-in`) — `"1' 0\""`
   - **Fractional inches** (`in-frac`) — `"12\""` (with
     ¹⁄₁₆" precision)

3. **Display unit persistence — per-user, per-system**
   (per Q-WIN-9 resolved). Two preferences in
   `userPreferencesStore`:
   - `window_builder_dim_format_si` — picked when active
     unit system is SI (`mm` / `cm` / `m`).
   - `window_builder_dim_format_ip` — picked when active
     unit system is IP (`in` / `ft` / `ft-in` / `in-frac`).
   - Switching the unit-system toggle (US-3 header)
     auto-switches which preference is read.

4. **Parser — port V1's utilities as the starting template.** Use the
   V1 dimension utilities and tests as source templates, then adapt to
   V2's `frontend/src/lib/units/length` location and structured
   coercion errors:
   - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/parseFeetInches.ts`
     (V1 ref §6.4) — handles
     `1' 6"`, `1'-6"`, `1ft 6in`, `1' 6 1/2"`,
     `1' 6-1/2"`, etc.
   - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/evaluateExpression.ts`
     (V1 ref §6.5) — simple
     arithmetic expressions (`100 + 50`, `1200 / 4`).
   - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/parseInput.ts`
     (V1 ref §6.6) — top-level dispatcher
     that detects format and routes to the right
     sub-parser.
   - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/displayUnitConverter.ts`
     (V1 ref §6.7) — mm ↔
     all-display-units conversion.
   - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/formatFeetInches.ts`
     (V1 ref §6.8) — formatter for
     the `ft-in` and `in-frac` display modes.
   - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/__tests__/`
     lift the V1 parser/formatter cases into the V2 test suite.
     This is non-negotiable —
     the parser is well-tested in V1 and any regression
     is an immediate user papercut.
   - V1 has `ft-in` with fractional-inch formatting; if V2 keeps a
     separate `in-frac` selector, implement it as a small V2 extension
     on the same fraction-formatting helpers.

5. **`evaluateExpression` — add parens support in V2 v1**
   (per Q-WIN-10.1 resolved). V1 ref §18 noted parens
   were absent; users hit this regularly when typing
   `(1200 - 50) / 4` for evenly-spaced mullions. V2's
   parser handles standard precedence + parens.
   Implementation: simple recursive-descent parser or a
   small library (`mathjs` is overkill — write the ~50
   LOC parser inline).

6. **Inline edit flow** (V1 ref §6.2 parity):
   - Click a row's value → input becomes editable, full
     value selected.
   - **Precision preservation** (V1 ref §17, the
     `initialEditValue` ref): on edit-mode entry, the
     ref captures the value's mm-precise source. On
     blur / Enter, IF the user's typed value parses to
     the same mm-precise source (within rounding
     tolerance — `< 0.5 mm`), the original mm value is
     restored exactly. **Prevents round-trip rounding
     loss** — e.g. typing `"12 1/16\""` doesn't accidentally
     overwrite an underlying `305.5625 mm` with
     `305.5 mm`.
   - Escape → cancel; original value returns.
   - Enter / blur → commit. Single JSON-Patch `replace`
     on
     `tables.window_types[<wt>].row_heights_mm[<index>]`
     or `column_widths_mm[<index>]`.
   - **Backend stores mm-canonical** (PRD §11.5 — backend
     is SI). Display conversion happens at render time.

7. **Parser error handling.** If the input doesn't parse
   to a positive number:
   - Field gets a red border + error icon.
   - Tooltip on the icon: *"Couldn't parse this — try
     `1200`, `1' 6\"`, `1200 / 4`, or `1.2 m`."* (Format
     hints scale to the active display unit.)
   - Save is blocked until the user fixes or escapes.

8. **Validation:**
   - Value must parse to `> 0` (a zero-width column or
     zero-height row would render a degenerate canvas).
   - On `Save As` to a `submitted` / `closed` version
     kind, validation re-runs; any rows / cols that
     remain unparseable raise a structured error in the
     Save As flow (mirrors US-WIN-1's name-uniqueness +
     null-frame Save-As validation pattern).

9. **Refetch window U-Value after every dimension save**
   — dimensions affect element areas, which affect the
   area-weighted composite per US-WIN-6 criterion 8.

10. **Canvas + panel stay synced.** Editing a row /
    column value here re-renders the canvas (US-WIN-9)
    immediately — the panel and canvas read the same
    `row_heights_mm` / `column_widths_mm` arrays from
    the draft buffer.

11. **Locked-version + Viewer rendering.** Panel
    visible; input fields disabled; values rendered as
    plain text in the active display format. Display
    unit selector remains functional (it's a viewing
    aid, not an edit).

### Resolved questions (2026-05-10)

- **Q-WIN-10.1: Add parens to `evaluateExpression`?**
  Resolved: **yes — add parens in V2 v1.** V1 ref §18
  flagged the absence as a papercut. Expression parser
  is small enough that inline implementation is fine
  (no `mathjs` dependency needed).

### Open questions
None outstanding.

### Cross-references

- **PRD §11.5** — backend SI canonical (mm); frontend
  converts at display.
- **Q-WIN-9 resolution** — drives the per-user display-
  format preference (criterion 3).
- **V1 ref §6** — parser test cases lift verbatim to V2.
- **US-WIN-9** — canvas re-renders on dimension change.
- **US-WIN-6 criterion 8** — refetch trigger fires on
  row / column dimension change.

---

## US-WIN-11 — Refresh-from-catalog (per-entry bookshelf re-sync)

**Status:** Draft · **Priority:** MVP — **NEW in V2**
**PRD ref:** §7.4 (refresh-from-catalog UX)
**V1 ref:** none (V1's catalog is live-referenced; V2 is bookshelf)

### Story
> As an editor, when a frame or glazing in the catalog has been
> updated since I picked it (vendor reformulation, library
> typo-fix, new datasheet), I want a per-entry "refresh from
> catalog" gesture that shows me the diff and lets me decide
> which value to keep — without forcing me to re-pick from
> scratch.

### Acceptance criteria

1. **Drift detection.** A frame or glazing entry is "drifted from
   catalog" if `catalog_origin.catalog_version_id !=
   catalog_*_records.current_version_id`. Computed at read time.
2. **Surfaces.**
   - **Per-entry badge** — frame / glazing chip in the elements
     table shows a `🔄` (or shadcn `RefreshCw` icon) overlay when
     drifted. Hover tooltip: **"Catalog has changed since pick.
     Click to review."**
   - **Project-wide drift summary** — small banner at the top of
     the Windows tab when *any* drift exists in the active
     window-type's elements: **"3 entries drifted from catalog
     [Review all]"**.
   - **Across-the-project report** — accessible from the project
     header `⋯ → Catalog drift report`. Per PRD §7.4 final ¶,
     "lives in the catalog manager view of a project."
3. **Per-entry refresh dialog.**
   - Title: **"Refresh '<name>' from catalog?"**
   - Body: side-by-side diff:
     ```
     Field            Catalog (current)   Yours (saved)
     name             Skyline SR-3        Skyline SR-3
     width_mm         110                 100   ← differs
     u_value_w_m2k    0.78                0.85  ← differs
     psi_g_w_mk       0.040               0.040
     ...
     ```
   - Per-row radio: **Take catalog · Keep mine · Edit a third
     value** (third value opens an inline input).
   - Bulk actions: **Take all from catalog**, **Keep all mine**.
   - **Save** writes the chosen values into the document and
     updates `catalog_origin.catalog_version_id = current_version_id`,
     `catalog_origin.synced_at = now()`, and recomputes
     `catalog_origin.local_overrides` as the fields whose chosen
     project value still differs from the current catalog value.
4. **Diverged user-edited fields.** If the user previously
   inline-edited a value (US-WIN-4 criterion 5, field key in
   `catalog_origin.local_overrides`), the diff explicitly tags
   those rows with **"You edited this"** and defaults the row radio to
   **Keep mine** so the user doesn't forget why their value differs.
5. **No bulk "refresh everything" auto-apply** in v1 (PRD §7.4 +
   §17 question 9 lean). The dialog requires explicit per-row
   choice. **Review all** opens the drift report with per-entry
   actions; it does not auto-apply multiple entries.
6. **Read-only on locked versions / for Viewers.** Drift badges
   still show; refresh dialog is unavailable.
7. **All changes flow through the draft buffer.**

### Resolved questions (2026-05-10)

- **Q-WIN-11.1: Catalog version pinning — drift compared to what?**
  **Resolved:** drift is detected **only when**
  `catalog_origin.catalog_version_id !=
  catalog_*_records.current_version_id`. Intermediate non-current
  versions do not trigger the badge. So if the catalog row went
  v3 → v4 → v5 (current), an entry pinned at v3 shows drift; an
  entry pinned at v5 does not, regardless of the v3/v4 history.
  If `local_overrides` is non-empty while the catalog version is current,
  the entry is customized, not stale.
- **Q-WIN-11.2: Renamed-field handling in the diff dialog —
  deferred to schema-migration design.**
  **Revised 2026-05-11:** catalog-schema migration tooling is
  deferred from MVP and kept as a post-MVP goal. MVP refresh
  compares current MVP field names only and stores
  `catalog_schema_version: 1` as a future hook. See sidebar below.

### Sidebar — catalog-schema migration is a post-MVP goal (revised 2026-05-11)

PRD §10.5 commits to **project-document** schema versioning
(forward-only shims, golden-file corpus, read-safe-mode
fallback, deprecation-without-removal). It is silent on
**catalog-schema** versioning — i.e. evolution of the
`catalog_materials` / `catalog_frame_types` /
`catalog_glazing_types` table columns themselves (which is
distinct from the row-level catalog_*_versions in PRD §7.2;
that's "Skyline 2024 spec vs 2026 spec" not "we renamed
`psi_g_w_mk` to `psi_glazing_w_mk`").

Revision (2026-05-11): catalog-schema migration tooling is
deferred from MVP and kept as a post-MVP architectural goal.

MVP does not ship catalog-row shim chains, catalog-schema
golden fixtures, production-corpus refresh drills, renamed-field
diff metadata, or added/removed/re-typed-field migration UI.

MVP does preserve a cheap future hook: catalog row APIs and
copied `catalog_origin` payloads include
`catalog_schema_version: 1`. Refresh-from-catalog compares only
current MVP field names. Any catalog schema change before the
post-MVP migration subsystem exists is a code/data migration
event that requires manual planning.

### Open questions
None for MVP — catalog-schema migration is tracked as a
post-MVP goal in PRD §7.5.

---

## US-WIN-12 — HBJSON window-constructions export

**Status:** Placeholder · **Priority:** v1.1 (gated by Q-WIN-8)
**V1 ref:** §13.1 (`get-window-constructions-as-hbjson` route),
§17 (hard-coded VT = 0.6)

### Notes for full draft
- Behavior matches V1: per-element Honeybee-Energy
  `WindowConstruction` JSON; identifier
  `"{window_type_name}_C{col}_R{row}"`; U-factor from per-element
  ISO 10077-1 result; SHGC from glazing's `g_value`; VT hard-coded
  to 0.6.
- Surfaced in the project header `⋯ → Download window
  constructions (HBJSON)`.
- Per-version: takes the active version's body as input.
- Open per Q-WIN-8: confirm we're keeping this in V2 at all,
  given the PRD §11.4.6 deliberate disconnect.

---
