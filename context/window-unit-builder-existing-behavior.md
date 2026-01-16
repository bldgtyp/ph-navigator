# Existing behavior spec: Window Unit Builder (Aperture grid)

Date captured: 2026-01-13

This document catalogs the _current_ behavior of the Window Unit Builder feature in this app, with emphasis on the **graphical interaction elements** (selection, merge/split, grid sizing, and label editing). It is intended to be reused as a functional spec reference when rebuilding a similar feature in a different web app.

---

## 1) Scope and entry points

### In scope (this spec)

- The **Unit Builder** page’s graphical “aperture grid” and its interaction model.
- Related interaction UI that directly affects the grid: zoom, dimension editing, row/column add/remove, element selection/merge/split, and element label editing.

### Out of scope (briefly referenced only)

- CRUD tables for glazing types and frame types (except where they affect the Unit Builder).

### Top-level navigation

- The windows dashboard is a tabbed page with (at least): **Unit Types**, **Glazing Types**, **Frame Types**.
- The Unit Builder is the “Unit Types” page.

Implementation references:

- Dashboard wrapper: [frontend/src/features/project_view/data_views/windows/WindowDataDashboard.tsx](../frontend/src/features/project_view/data_views/windows/WindowDataDashboard.tsx)
- Unit Builder page: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Page.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Page.tsx)

---

## 2) Terminology (as used in code/UI)

- **Aperture**: a “window/door unit type” record. The sidebar list is the aperture list.
- **Aperture grid**: a row/column grid defined by `row_heights_mm[]` and `column_widths_mm[]`.
- **Aperture element** (aka “element”): a rectangular region within the aperture grid. Each element has:
  - `row_number`, `column_number` (0-based in the UI grid code)
  - `row_span`, `col_span`
  - `frames` (top/right/bottom/left) and `glazing`
- **Selection**: a client-only array of selected element ids.
- **Logged-in user**: `userContext.user` truthy; this gates editing capabilities.

Implementation references:

- Types: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/types.ts](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/types.ts)
- State/actions: [frontend/src/features/project_view/data_views/windows/\_contexts/Aperture.Context.tsx](../frontend/src/features/project_view/data_views/windows/_contexts/Aperture.Context.tsx)

---

## 3) Data model (behaviorally relevant)

### Aperture

- `id: number`
- `name: string`
- `column_widths_mm: number[]`
- `row_heights_mm: number[]`
- `elements: ApertureElementType[]`

### Aperture element

- `id: number`
- `name: string` (can be empty/falsey; UI falls back to `Element {id}`)
- Positioning:
  - `row_number: number`, `column_number: number`
  - `row_span: number`, `col_span: number`
- Visual framing data:
  - `frames.{top|right|bottom|left}.frame_type.width_mm` drives the “frame band” thickness in the SVG.

Important: most grid structure changes (split/merge/add row/col/delete row/col) are **server-defined**. The frontend sends an API request and replaces local aperture state with the server response.

---

## 4) Page layout (user visible)

The Unit Builder screen has 3 major regions:

1. **Sidebar (left)** — list of apertures (unit types)

- Sorted by name.
- Click selects the active aperture.
- Logged-in users see per-item actions:
  - Rename aperture (opens modal)
  - Duplicate aperture
  - Delete aperture

2. **Aperture view (center/top)** — the graphical grid

- A scaled grid display based on mm dimensions.
- Each element is drawn as an SVG “frame” outline.
- Elements are clickable/selectable.
- Element names are overlaid as centered labels (editable if logged-in).
- Dimension labels appear on left (row heights) and bottom (column widths).

3. **Elements table (center/bottom)** — per-element property editor

- One group per element.
- A selected element group is outlined.
- Logged-in users can edit:
  - glazing type
  - frame types for each side
  - element name (via the group title)

Implementation references:

- Layout: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Page.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Page.tsx)
- Sidebar: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Sidebar/Sidebar.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Sidebar/Sidebar.tsx)
- Graphic view: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElements.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElements.tsx)
- Elements table: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/ElementsTable.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/ElementsTable.tsx)

---

## 5) Graphical grid rendering (what is actually drawn)

### Grid geometry

- The aperture grid is rendered as a **CSS grid**.
- Column sizes are `column_widths_mm[i] * scaleFactor` pixels.
- Row sizes are `row_heights_mm[i] * scaleFactor` pixels.
- The container size is the total scaled width/height of the aperture.

### Element geometry

- Each element is positioned in the CSS grid by:
  - `gridRowStart = row_number + 1`
  - `gridRowEnd = row_number + 1 + row_span`
  - `gridColumnStart = column_number + 1`
  - `gridColumnEnd = column_number + 1 + col_span`

### Element SVG drawing

- Each element contains an `<svg>` that draws only the **four frame bands**:
  - left/right/top/bottom rectangles with black stroke and white fill
- Band thickness comes from `frame_type.width_mm` (default fallback 100mm), multiplied by `scaleFactor`.

Implementation references:

- Element container + selection style: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.Container.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.Container.tsx)
- Element SVG drawing: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.SVG.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.SVG.tsx)

---

## 6) Zoom behavior

### Controls

- Zoom is controlled via header buttons: **Zoom Out** and **Zoom In (XX%)**.
- Zoom buttons are available even when logged out.
- The zoom in/out buttons are disabled at hard limits.

### Parameters

- `initialScale = 0.1` (10%)
- `minScale = 0.05` (5%)
- `maxScale = 1.0` (100%)
- `zoomStep = 0.05` (5%)

### Effects

`scaleFactor` impacts:

- grid column/row pixel sizes
- element SVG frame band thickness
- label overlay positions and scaled sizing
- dimension tick positions

Not implemented:

- no mouse-wheel zoom
- no panning/drag-to-pan

Implementation references:

- Zoom state: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/Zoom.Context.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/Zoom.Context.tsx)
- Header buttons: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/Aperture.HeaderButtons.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/Aperture.HeaderButtons.tsx)

---

## 7) Selection model (core graphical interaction)

### Basic selection

- Clicking an element toggles selection of that element id.
- Selected elements are visually highlighted (blue border + tinted background).

### Multi-selection constraint: adjacency-gated

Multi-selection is allowed, but **adding** to a selection is constrained:

- If nothing is selected, the first click always selects the clicked element.
- If something is already selected, a clicked element is only added if it is **adjacent to at least one selected element**.
- If the clicked element is not adjacent to any selected element, the click is ignored (selection does not change).

Adjacency check (as implemented):

- The code attempts to treat two elements as adjacent if they “share an edge” either horizontally or vertically.
- The current implementation uses the elements’ `row_number` / `column_number` and spans in a way that works reliably for some cases (especially 1x1 elements), but may not fully represent geometric adjacency for elements with larger spans.

**Important spec note:** this is not a general rectangle-adjacency algorithm; it is the exact behavior of the current code.

Implementation reference:

- Selection logic: [frontend/src/features/project_view/data_views/windows/\_contexts/Aperture.Context.tsx](../frontend/src/features/project_view/data_views/windows/_contexts/Aperture.Context.tsx)

### Selection clearing (side-effect behavior)

Selection is cleared in these scenarios:

- Switching active aperture (sidebar click)
- After merge/split
- After element name update
- After any operation that calls `handleSetActiveAperture(...)` internally (many grid mutations do)

This matters because it shapes the user workflow: users typically select → apply one action → selection clears.

---

## 8) Merge + split interactions

### Where the user triggers these

- Logged-in users see an edit button row above the graphic:
  - Clear Selection (only shown when selection non-empty)
  - Merge Selected (disabled unless selection size ≥ 2)
  - Split Selected (disabled unless selection size = 1)
  - Add Column
  - Add Row

Implementation references:

- Edit buttons UI: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/Aperture.EditButtons.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/Aperture.EditButtons.tsx)

### Merge Selected

- Enabled only when **2+** elements are selected.
- Tooltip hints when disabled.
- Performs a server-side merge via:
  - `PATCH aperture/merge-aperture-elements/{apertureId}`
  - payload includes `aperture_element_ids: number[]`
- On success: the aperture state is replaced with the response.
- Selection is always cleared after the request (success or failure).

### Split Selected

- Enabled only when **exactly 1** element is selected.
- If invoked with selection size != 1, the user sees an alert: “You can only split one Aperture Element at a time.”
- Performs a server-side split via:
  - `PATCH aperture/split-aperture-element/{apertureId}`
  - payload includes `aperture_element_id: number`
- On success: aperture state is replaced with the response.
- Selection is always cleared after the request.

**Not implemented:** graphical split gestures (e.g., draw a divider, choose split direction, drag a split line). Split is purely a button action.

---

## 9) Add/remove rows and columns

### Add row / add column

- Logged-in users can add a row/column via buttons.
- Server-side operations:
  - `PATCH aperture/add-row/{apertureId}`
  - `PATCH aperture/add-column/{apertureId}`
- The server determines where/how the new row/column and elements are created.

### Delete row / delete column (dimension delete buttons)

- Logged-in users see a small “remove” icon adjacent to each row/column segment label.
- Clicking delete triggers server-side operations:
  - `DELETE aperture/delete-row/{apertureId}` with `{ row_number: index }`
  - `DELETE aperture/delete-column/{apertureId}` with `{ column_number: index }`

Notable behaviors:

- No confirmation dialog is shown for row/column deletion.

Implementation references:

- Horizontal dimensions: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/Dimensions.Horizontal.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/Dimensions.Horizontal.tsx)
- Vertical dimensions: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/Dimensions.Vertical.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/Dimensions.Vertical.tsx)
- Delete icon: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/DeleteButton.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/DeleteButton.tsx)

---

## 10) Editing row heights / column widths (dimension labels)

### Display

- Dimension labels are displayed in the current unit system (mm or inches). Under the hood values are stored and sent as mm.

### Edit trigger

- Clicking a dimension label sets an “editing index” in a local context.
- The edit text field is only rendered when logged in.

### Edit confirmation rules

- Confirm on:
  - pressing Enter
  - clicking away
- The entered value must parse as a positive number.
- The value is converted back to mm and sent to the server.

Server calls:

- `PATCH aperture/update-row-height/{apertureId}` payload `{ row_index, new_height_mm }`
- `PATCH aperture/update-column-width/{apertureId}` payload `{ column_index, new_width_mm }`

Implementation references:

- Editing state: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/Dimensions.Context.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/Dimensions.Context.tsx)
- Label + editor: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/Dimension.Label.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/Dimension.Label.tsx)

---

## 11) Element name editing (in-graphic label overlay)

- Each element shows a centered label overlay:
  - `element.name` or fallback `Element {id}`
- Logged-in users can click the label to edit it.
- Editor behavior:
  - click label → becomes an input
  - Enter confirms
  - Escape cancels
  - click-away confirms
- Save conditions:
  - if the new name is blank after trimming, no update is made
  - if the name is unchanged, no update is made
- On failed save, an alert is shown.

Server call:

- `PATCH aperture/update-aperture-element-name/{elementId}` payload `{ aperture_element_name }`

Implementation reference:

- Overlay labels: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ElementLabelsOverlay.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ElementLabelsOverlay.tsx)

---

## 12) Element property editing (table, not graphical)

While not a direct graphical interaction, these edits affect what is drawn (frame width affects SVG band thickness).

- Glazing type selector (logged-in only): autocomplete list; updating triggers a server update.
- Frame type selectors for each side (logged-in only): autocomplete list; updating triggers a server update.

Notable behaviors:

- If logged out, the selectors render as plain text.

Implementation references:

- Element group UI: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/ElementTableGroup.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/ElementTableGroup.tsx)
- Glazing selector: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/GlazingTypeSelector.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/GlazingTypeSelector.tsx)
- Frame selector: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/FrameTypeSelector.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ElementsTable/FrameTypeSelector.tsx)

---

## 13) Permissions / gating summary

- **View-only (logged out)** users can:

  - switch between apertures
  - zoom in/out
  - click elements to toggle selection (highlighting still works)
  - view element names and properties

- **Logged-in** users additionally can:
  - add/duplicate/delete apertures
  - rename apertures
  - add/delete rows and columns
  - edit row heights and column widths
  - merge/split elements
  - edit element names (overlay + table title)
  - change glazing and frame types

Permission checks are primarily `userContext.user` in rendering logic; most callbacks do not themselves guard beyond UI availability.

---

## 14) API endpoints (as used by the frontend)

These are the Unit Builder’s relevant endpoints as called from the service layer:

- Get apertures for project: `GET aperture/get-apertures/{projectId}`
- Create new aperture: `POST aperture/create-new-aperture-on-project/{projectId}`
- Delete aperture: `DELETE aperture/delete-aperture/{apertureId}`
- Duplicate aperture: `POST aperture/duplicate-aperture/{apertureId}`
- Rename aperture: `PATCH aperture/update-aperture-name/{apertureId}`

Grid structure:

- Add row: `PATCH aperture/add-row/{apertureId}`
- Delete row: `DELETE aperture/delete-row/{apertureId}` payload `{ row_number }`
- Add column: `PATCH aperture/add-column/{apertureId}`
- Delete column: `DELETE aperture/delete-column/{apertureId}` payload `{ column_number }`

Sizing:

- Update row height: `PATCH aperture/update-row-height/{apertureId}` payload `{ row_index, new_height_mm }`
- Update column width: `PATCH aperture/update-column-width/{apertureId}` payload `{ column_index, new_width_mm }`

Elements:

- Merge elements: `PATCH aperture/merge-aperture-elements/{apertureId}` payload `{ aperture_element_ids }`
- Split element: `PATCH aperture/split-aperture-element/{apertureId}` payload `{ aperture_element_id }`
- Rename element: `PATCH aperture/update-aperture-element-name/{elementId}` payload `{ aperture_element_name }`
- Update frame type: `PATCH aperture/update-frame-type/{apertureId}` payload `{ element_id, side, frame_type_id }`
- Update glazing type: `PATCH aperture/update-glazing-type/{elementId}` payload `{ glazing_id }`

Implementation reference:

- Service layer: [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/services/apertureService.ts](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/services/apertureService.ts)

---

## 15) Known quirks / edge cases worth copying _or fixing_

These are observable from the code and may matter when replicating behavior:

- **Adjacency selection is not a full geometric check** for arbitrary rectangular spans; it’s based on `row_number`, `column_number`, and span arithmetic in a way that may not behave as users expect for large spans.
- **Selection clears frequently** (after many operations), which simplifies the mental model but can be annoying for multi-step operations.
- **View-only users can toggle selection**, but cannot act on it (merge/split are hidden). Decide whether the new app should allow selection in view-only mode.
- **Row/column deletion has no confirmation**.
- **Dimension label clicking while logged out sets edit state** but does not show an editor (no visible effect).

---

## 16) Suggested acceptance tests (for the new app)

Selection:

- Clicking an element selects it; clicking again deselects.
- When one element is selected, clicking a non-adjacent element does not change selection.
- Selecting a chain of adjacent elements is possible, one click at a time.

Merge/split:

- Merge button disabled until 2+ selected; split disabled unless exactly 1 selected.
- Merge triggers server call with selected ids and clears selection afterward.
- Split triggers server call with selected id and clears selection afterward.

Dimensions:

- Zoom changes pixel sizes but not stored mm values.
- Editing a row/column size converts displayed units to mm correctly.
- Delete row/column removes that segment and updates the grid from server response.

Labels:

- Clicking overlay label starts inline edit (logged-in only).
- Enter/click-away confirms; Escape cancels.

---

## Appendix: Additional implementation references

- Sidebar rename modal + context:
  - [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Sidebar/Sidebar.Context.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Sidebar/Sidebar.Context.tsx)
  - [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ChangeNameModal/Modal.ChangeName.tsx](../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ChangeNameModal/Modal.ChangeName.tsx)
