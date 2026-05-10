---
DATE: 2026-05-10
TIME: -
STATUS: REFERENCE — V1 Window-Builder feature/behavior catalog. Source
        for V2 user-story drafting. Not a spec; not normative.
AUTHOR: Claude (from V1 source)
SCOPE: Detailed enumeration of every UI surface, interaction, data
       structure, and edge case in PH-Navigator V1's Window-Builder
       (a.k.a. UnitBuilder), including the Frame Types and Glazing
       Types catalog views that live alongside it.
RELATED: docs/plans/architecture-prd.md (V2 architecture PRD),
         docs/plans/user-stories.md (V2 user stories — to be expanded
         with US-Builder-Windows after this reference is in hand)
SOURCE: frontend/src/features/project_view/data_views/windows/**,
        backend/features/aperture/**
---

# 1. Domain glossary as used in V1

- **Aperture** — a single window/door "type" template. Owns a 2D grid (rows × columns), a name, and a list of `ApertureElement`s. Backend: `db_entities.aperture.aperture.Aperture`. Frontend type: `ApertureType`.
- **ApertureElement** — one cell (or merged span of cells) inside an Aperture's grid. Has a row/col origin, row_span/col_span, optional name, four side-frames (top/right/bottom/left), one glazing, and an optional `operation`. The element is what receives glazing-/frame-type/operation assignments. Backend: `ApertureElement`. Frontend: `ApertureElementType`.
- **FrameType** — a catalog (library) entry describing a window-frame product. Carries `width_mm`, `u_value_w_m2k`, `psi_g_w_mk`, manufacturer/brand/use/operation/location/mull-type/source/datasheet/link/comments. AirTable-sourced; mirrored into the local DB. Backend: `ApertureFrameType` / `FrameTypeSchema`.
- **GlazingType** — a catalog entry for a glass build-up. Carries `u_value_w_m2k`, `g_value` (SHGC), manufacturer/brand/source/datasheet/link/comments. AirTable-sourced. Backend: `ApertureGlazingType` / `GlazingTypeSchema`.
- **ApertureElementFrame** — the per-element instance that points at a `FrameType` (one row of a join table). Each element has exactly four (`frame_top`, `frame_right`, `frame_bottom`, `frame_left`).
- **ApertureElementGlazing** — the per-element glazing instance pointing at a `GlazingType`. One per element.
- **ManufacturerFilter** — per-project list of which frame manufacturers and which glazing manufacturers are visible in the catalog dropdowns. Backend table `ProjectManufacturerFilter` keyed by `(project_id, manufacturer, filter_type)`.
- **"Unit"** — UI shorthand for an Aperture row (the dashboard tab is labeled "Unit Types"; the URL segment is `window-unit-types`).
- **"Type"** — used three different ways: (1) in "Unit Type" = an Aperture; (2) in "Frame Type" / "Glazing Type" = catalog entry; (3) in `operation.type` = `'swing' | 'slide'`.
- **Operation** — a `{ type: 'swing' | 'slide', directions: ('left'|'right'|'up'|'down')[] }` payload on each element. `null` operation = "fixed". Stored on `ApertureElement.operation` as JSON.
- **Side / Edge** — the four sides of an element (top, right, bottom, left) for frame assignment. Edges of the whole aperture grid (top/bottom/left/right) are also where the EdgeAddButtons add a row/column.

---

# 2. Data model (V1)

## 2.1 Aperture (`backend/features/aperture/schemas/aperture.py`)

`ApertureSchema(BaseModel)`:
- `id: int`
- `name: str`
- `row_heights_mm: list[float]` — order is top→bottom; row 0 = top.
- `column_widths_mm: list[float]` — order is **left→right in the stored (data) frame of reference**. The view-direction flip happens only in the UI; backend stays in one canonical orientation (see §7).
- `elements: list[ApertureElementSchema]`
- `last_modified` (computed) — UTC ISO-8601 string with trailing `"Z"` (not `"+00:00"`). Aggregates `max()` across the aperture row, every element row, every element's glazing + glazing_type, and every element's four frames + frame_types. Implemented in `backend/features/aperture/services/last_modified.py`. Required to be byte-stable for the Rhino plugin's literal-equality compare (`last_modified.py:21-25, 86-94`).
- `_orm_aperture: PrivateAttr` — held to walk relationships not exposed as schema fields. Schema MUST be constructed via `model_validate(orm)`, otherwise `last_modified` raises (`aperture.py:39-64`).

DB defaults (`backend/db_entities/aperture/aperture.py:50-78`):
- `row_heights_mm` default = `[1000.0]`
- `column_widths_mm` default = `[1000.0]`
- `Aperture.default(project)` creates an aperture named `"Unnamed Aperture"` with `[1000.0]` × `[1000.0]` and one element at `(row=0, col=0)`.

Request/response schemas in the same file:
- `UpdateNameRequest { new_name }`
- `UpdateGlazingRequest { glazing_id }`
- `UpdateColumnWidthRequest { column_index, new_width_mm }`
- `UpdateRowHeightRequest { row_index, new_height_mm }`
- `RowDeleteRequest { row_number }`
- `ColumnDeleteRequest { column_number }`
- `AddRowRequest { position: InsertPosition = END }`
- `AddColumnRequest { position: InsertPosition = END }`
- `UpdateApertureFrameRequest { element_id, side: FrameSide, frame_type_id }`
- `MergeApertureElementsRequest { aperture_element_ids }`
- `SplitApertureElementRequest { aperture_element_id }`
- `UpdateApertureElementNameRequest { aperture_element_name }`

Enums:
- `FrameSide = TOP | RIGHT | BOTTOM | LEFT` (lowercase string values).
- `InsertPosition = START | END`.

## 2.2 ApertureElement (`schemas/aperture_element.py`)

`ApertureElementSchema`:
- `id: int`
- `name: str | None = "Unnamed"`
- `row_number: int` (0-indexed)
- `column_number: int` (0-indexed)
- `row_span: int = 1`
- `col_span: int = 1`
- `glazing: ApertureElementGlazingSchema`
- `frames: ApertureElementFramesSchema` — exactly the four sides
- `operation: OperationSchema | None = None`

`OperationSchema`:
- `type: Literal["swing", "slide"]`
- `directions: list[Literal["left", "right", "up", "down"]]`

`UpdateOperationRequest { operation: OperationSchema | None }` — `null` = fixed.
`FrameTypeIdMap { top, right, bottom, left }` — all four required.
`UpdateElementAssignmentsRequest { operation, glazing_type_id, frame_type_ids: FrameTypeIdMap }` — bulk update used by paste + (potentially) any "apply assignments" path.

ORM (`db_entities/aperture/aperture_element.py`):
- `name` defaults to `"Unnamed"` at the DB level.
- `row_number` / `column_number` default `1` at DB level (services pass explicit 0-based indices, so the default only applies when nothing is passed).
- `operation` is a `JSON` column, nullable.
- `glazing_id`, `frame_top_id`, `frame_right_id`, `frame_bottom_id`, `frame_left_id` are nullable in the schema, but `services.aperture_element.create_aperture_element` always populates all five with the default catalog rows (see §2.5).
- All five relationships are `cascade="all, delete-orphan"`, `single_parent=True` — deleting an element deletes its glazing + four frame join rows (but not the catalog FrameType / GlazingType).
- `frames` property returns `{top, right, bottom, left}` dict for serialization.

## 2.3 ApertureElementFrame (`schemas/aperture_element_frame.py`)

`ApertureElementFrameSchema`:
- `id: int`
- `name: str = "Unnamed Frame"`
- `frame_type: FrameTypeSchema | None = None`

`ApertureElementFramesSchema { top, right, bottom, left }` — all four mandatory fields.

`fromAirTableRecordDict(record)` is defined here too (lower-cases all keys).

## 2.4 ApertureElementGlazing (`schemas/aperture_element_glazing.py`)

`ApertureElementGlazingSchema`:
- `id: int`
- `name: str = "Unnamed Glazing Type"`
- `glazing_type: GlazingTypeSchema` (non-nullable in the schema)

## 2.5 FrameType (`schemas/frame_type.py`)

`FrameTypeSchema`:
- `id: str` — AirTable record id (string, not int).
- `name: str = "Unnamed Frame Type"`
- `width_mm: float`
- `u_value_w_m2k: float`
- `psi_g_w_mk: float`
- `manufacturer: str | None`
- `brand: str | None`
- `use: str | None`
- `operation: str | None`
- `location: str | None`
- `mull_type: str | None`
- `source: str | None`
- `datasheet_url: str | None`
- `link: str | None`
- `comments: str | None`
- `FrameTypeDatasheetSchema` (nested for AirTable parsing): `id, url, filename, size, type`.

`fromAirTableRecordDict` extracts the first attachment in `record.fields["DATASHEET"]` and copies its `url` into `datasheet_url`; lower-cases all field keys.

Default frame type: `services/frame_type.py::get_default_frame_type` searches for `name == "Default"`, falls back to first row, raises `NoFrameTypesException` if the table is empty.

## 2.6 GlazingType (`schemas/glazing_type.py`)

`GlazingTypeSchema`:
- `id: str` — AirTable record id.
- `name: str = "Unnamed Glazing"`
- `u_value_w_m2k: float`
- `g_value: float` (SHGC, dimensionless)
- `manufacturer | brand | source | datasheet_url | link | comments` (all `str | None`)

Same `fromAirTableRecordDict` pattern as FrameType.
Same default-by-name `"Default"` fallback in `services/glazing_type.py::get_default_glazing_type`.

## 2.7 ManufacturerFilter (`schemas/manufacturer_filter.py`)

`ManufacturerFilterResponseSchema`:
- `available_frame_manufacturers: list[str]`
- `enabled_frame_manufacturers: list[str]`
- `available_glazing_manufacturers: list[str]`
- `enabled_glazing_manufacturers: list[str]`
- `used_frame_manufacturers: list[str]`
- `used_glazing_manufacturers: list[str]`

`ManufacturerFilterUpdateSchema { enabled_frame_manufacturers, enabled_glazing_manufacturers }`.

DB: `ProjectManufacturerFilter (project_id, manufacturer, filter_type, is_enabled)` with `filter_type` ∈ `{"frame", "glazing"}`.

## 2.8 WindowUValue (`schemas/window_u_value.py`)

`ElementUValueResult`:
- `element_id, u_value_w_m2k, total_area_m2, glazing_area_m2, frame_area_m2`

`WindowUValueResponse`:
- `u_value_w_m2k, total_area_m2, glazing_area_m2, frame_area_m2`
- `heat_loss_glazing_w_k, heat_loss_frame_w_k, heat_loss_spacer_w_k`
- `is_valid: bool, warnings: list[str]`
- `calculation_method: str` (always `"ISO 10077-1:2006"`)
- `includes_psi_install: bool` (always `False`)
- `element_u_values: list[ElementUValueResult]`

## 2.9 LastModified mixin (`db_entities/aperture/_mixins.py`)

`LastModifiedMixin` is applied to `Aperture`, `ApertureElement`, `ApertureElementFrame`, `ApertureElementGlazing`, `ApertureFrameType`, `ApertureGlazingType`. Column is `DateTime(timezone=True)`, `server_default=func.now()`, `onupdate=func.now()`. Bulk-update sites in `services/aperture.py` set it explicitly because `synchronize_session=False` core updates do not fire `onupdate` (see `aperture.py:128-141, 200-209, 272-281, 330-339`).

---

# 3. Page composition / routes

## 3.1 React-Router (`frontend/src/Routes.tsx:49-53`)

```
<Route path="window-data" element={<WindowDataDashboard />}>
    <Route index element={<Navigate to="window-unit-types" replace />} />
    <Route path="window-unit-types"    element={<ApertureTypesPage />} />
    <Route path="window-glazing-types" element={<GlazingTypesDataGrid />} />
    <Route path="window-frame-types"   element={<FrameTypesDataGrid />} />
</Route>
```

Default landing tab is **Unit Types**.

## 3.2 `WindowDataDashboard.tsx`

- Renders `DataDashboardTabBar` with tabs `[Unit Types, Glazing Types, Frame Types]`.
- Active-tab index is read from `location.pathname` (no router hook — uses `location` directly via implicit global). Updates via a `useEffect` keyed off `location.pathname`.
- Wraps an `<Outlet />` with **five context providers** in this order (outer → inner): `ManufacturerFilterProvider → AperturesProvider → CopyPasteProvider → FrameTypesProvider → GlazingTypesProvider → DataViewPage / ContentBlocksContainer`.

## 3.3 `pages/UnitBuilder/Page.tsx` — UnitBuilder shell

- Inner providers (added on top of dashboard providers): `ZoomProvider → ViewDirectionProvider → DisplayUnitProvider → ApertureSidebarProvider`.
- Inside `ApertureTypesContentBlock`:
  - Computes `isBlocking = isLoadingFrameTypes || isLoadingGlazingTypes || isLoadingApertures`.
  - Shows a `CircularProgress` overlay over the whole content block while `isBlocking`. Loading message is one of: `"Refreshing frame types..."`, `"Refreshing glazing types..."`, `"Processing aperture..."`, or `"Loading..."`.
  - Header text is `"Window / Door Type"`.
  - Header buttons array is `[<UValueLabel/>, ...useHeaderButtons()]`.
  - `titleContent` puts the heading next to the `<ApertureSelector />` (an Autocomplete bound to `apertures`, sorted by `localeCompare`, placeholder `"Select aperture..."`).
  - Body is a flex row: collapsible sidebar (260 px wide; transition 0.2s) + a chevron toggle button + main content. The toggle has `title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}`.
  - Sidebar default state is **closed** (`isSidebarOpen` initial = `false`, `Sidebar.Context.tsx:15`).
  - Main content stacks `<ApertureElements />` (canvas) on top of `<ApertureElementsTable />` (per-element table). No tabs between them — they render together, scrollable.

## 3.4 FrameTypes / GlazingTypes pages

Each renders inside the same dashboard shell as a separate tab. They reuse `ApertureProvider` and `FrameTypes` / `GlazingTypes` providers but render their own `ContentBlock` + MUI X `<DataGrid>`. The tab bar is the only navigation between Unit Types, Glazing Types, and Frame Types — there is no inline navigation from the per-aperture frame/glazing dropdowns back to the catalog page.

---

# 4. Context providers

(`children` of providers re-render on any field change because each `value` is a `useMemo` over its own dependency array.)

## 4.1 `_contexts/Aperture.Context.tsx` — `AperturesProvider`

State:
- `apertures: ApertureType[]` (from TanStack `useAperturesQuery`; query key `['apertures', projectId]`).
- `selectedApertureId: number | null`
- `activeAperture: ApertureType | null` (re-synced from cache on every query invalidation, `Aperture.Context.tsx:130-137`)
- `selectedApertureElementIds: number[]` (multi-select for merge/split)
- `isMutating: boolean`
- `isDownloading: boolean`
- `hasInitialized` (resets on `projectId` change; on first non-loading apertures load, selects index 0)

Public API (handlers):
- `handleSetActiveApertureById(id)`, `handleSetActiveAperture(aperture)` — both clear `selectedApertureElementIds`.
- `handleNameChange(id, newName)` — calls API, invalidates, re-selects.
- `handleAddAperture()` — POST, invalidates, sets new aperture active.
- `handleDeleteAperture(id)` — `window.confirm('Are you sure you want to delete the Aperture?')`; on success selects first remaining aperture or null.
- `handleDuplicateAperture(id)` — POST, invalidates, alerts `"Window unit duplicated successfully"`.
- `handleAddRow(position='end')`, `handleAddColumn(position='end')`.
- `handleAddRowAtEdge(edge)`: `'top'→'start'`, `'bottom'→'end'`. (Note: data-frame, not view-frame.)
- `handleAddColumnAtEdge(edge)`: `'left'→'start'`, `'right'→'end'`. (Data-frame.)
- `handleDeleteRow(index)`, `handleDeleteColumn(index)`.
- `getCellSize(row, col, rowSpan, colSpan) -> {width, height}` (mm; sums slices of the active aperture's arrays).
- `updateColumnWidth(apertureId, columnIndex, newWidthMM)`, `updateRowHeight(apertureId, rowIndex, newHeightMM)`.
- `toggleApertureElementSelection(elementId, addToSelection=false)` — if shift held, only allows extending the selection to **adjacent** elements (`areElementsAdjacent` in `Aperture.Context.tsx:22-35`). If not shift, single-select. Clicking an already-selected element removes it.
- `clearApertureElementIdSelection()`.
- `mergeSelectedApertureElements()`, `splitSelectedApertureElement()` — split requires exactly 1 selected (alerts otherwise).
- `handleUpdateApertureElementFrameType({apertureId, elementId, framePosition, frameTypeId})`.
- `handleUpdateApertureElementGlazing({elementId, glazingTypeId})`.
- `handleUpdateApertureElementOperation(elementId, operation)`.
- `handleUpdateApertureElementAssignments(elementId, payload)` — bulk; used by paste.
- `updateApertureElementName(elementId, newName)`.
- `handleDownloadWindowConstructions()` — fetches HBJSON via `aperture/get-window-constructions-as-hbjson/{projectId}`, builds a `Blob`, triggers a download to `project_{projectId}_window_constructions.json`.

Cache strategy:
- Fully invalidates the apertures query for: name change, add aperture, delete aperture, duplicate aperture.
- Optimistically updates only the active aperture's cache entry for: row/col add/delete/resize, frame change, glazing change, operation change, element rename, merge, split. (`updateApertureInCache` patches just one item in the array — see `Aperture.Context.tsx:100-107`.)

## 4.2 `_contexts/FrameType.Context.tsx` — `FrameTypesProvider`

- Wraps `useFrameTypesQuery` (query key `['frameTypes']`, `staleTime = gcTime = 24h`) and `useRefreshFrameTypesMutation`.
- Exposes `frameTypes`, `isLoadingFrameTypes`, `handleRefreshFrameTypes()`.
- Refresh shows an `alert(...)` summarizing `types_added / types_updated / types_total_count` on success and `'Error refreshing frame data...'` on failure (`useRefreshFrameTypesMutation.ts:18-26`).

## 4.3 `_contexts/GlazingTypes.Context.tsx` — `GlazingTypesProvider`

Symmetric to FrameType. Same 24-hour cache. Same alert on refresh.

## 4.4 `_contexts/ManufacturerFilter.Context.tsx` — `ManufacturerFilterProvider`

- `useManufacturerFilterQuery` (query key `['manufacturerFilters', projectId]`, 24h cache).
- Exposes: `filterConfig`, `enabledFrameManufacturers`, `enabledGlazingManufacturers`, `isLoading`, `updateFilters(frameMfrs, glazingMfrs)`, `refreshFilters()`.

## 4.5 `pages/UnitBuilder/Sidebar/Sidebar.Context.tsx` — `ApertureSidebarProvider`

- `nameChangeModal: { isOpen, apertureId, apertureName }`.
- `openNameChangeModal(id, name)`, `closeNameChangeModal()`, `handleNameSubmit(newName)`.
- `isSidebarOpen` (default `false`), `toggleSidebar()`.

## 4.6 `pages/UnitBuilder/Dimensions/Dimensions.Context.tsx` — `DimensionsProvider`

- `units` (from DisplayUnit).
- `editingColIndex / editingRowIndex / editingValue` and start/confirm callbacks.
- Tracks `initialEditValue` (a `useRef`) so a click-away with no edit doesn't overwrite a precise stored value with its rounded display string (`Dimensions.Context.tsx:17, 31, 55`).
- Edits are committed only if (a) `editingValue !== initialEditValue.current`, (b) `parseToMM(editingValue)` is a positive non-NaN number (`Dimensions.Context.tsx:31-37, 55-61`).
- Mounted **inside** `<ApertureElements />` so it has the live aperture in scope (provider lives next to the dimension lines, not at the page shell).

## 4.7 `pages/UnitBuilder/Dimensions/DisplayUnit.Context.tsx` — `DisplayUnitProvider`

- Two stored values: `siUnit` and `ipUnit`, persisted to `localStorage` keys `window_builder_si_display_unit` and `window_builder_ip_display_unit`.
- Active unit = `unitSystem === 'SI' ? siUnit : ipUnit`. Falls back to `'mm'` / `'in'` if invalid value found in localStorage.
- Provides `formatValue(valueMM, decimals?)`, `parseToMM(input)`.

## 4.8 `pages/UnitBuilder/ApertureView/ViewDirection.Context.tsx`

- State: `viewDirection: 'outside' | 'inside'`, persisted to **`sessionStorage`** key `window_view_direction` (`ViewDirection.Context.tsx:12, 18, 22-24`). Note: session, not local — resets per browser tab session.
- Default = `'outside'`.
- `isInsideView` boolean convenience flag.
- `toggleViewDirection`, `setViewDirection`.

## 4.9 `pages/UnitBuilder/ApertureView/Zoom.Context.tsx`

- `scaleFactor: number` (default `0.1`, min `0.05`, max `1.0`, step `0.05`).
- `zoomIn / zoomOut / resetZoom`.
- `getScaleLabel()` returns e.g. `"10%"`.
- Not persisted across reloads.

## 4.10 `pages/UnitBuilder/ApertureView/CopyPaste.Context.tsx`

Mounted at the dashboard level (above AperturesProvider's child level — see `WindowDataDashboard.tsx:42`).

State machine:
- `isPickMode` — user is hunting for a source element. Cursor becomes a custom inline-SVG eyedropper (`PICK_CURSOR` in `ApertureElement.Container.tsx:11-12`).
- `isPasteMode` — derived from `Boolean(copyPayload)`. Cursor becomes a paint-bucket SVG (`PASTE_CURSOR`, lines 13-14).
- `copyPayload: ElementAssignmentsPayload | null` — `{operation, glazingTypeId, frameTypeIds: {top,right,bottom,left}}`.
- `sourceElementId: number | null`.
- `lastPastedElementId: number | null` — used to drive a 600 ms `pastePulse` keyframe animation on the just-pasted element (`ApertureElement.Container.tsx:71-82`).

Behaviors:
- `startPickMode()` clears all copy state.
- Clicking an element while in `isPickMode` calls `startPasteMode(element)` (which sets `copyPayload` to that element's assignments) and clears the multi-select.
- Clicking another element while in `isPasteMode` calls `pasteToElement(elementId)`, which calls `handleUpdateApertureElementAssignments(elementId, copyPayload)`, sets `lastPastedElementId`, and schedules a 600 ms timeout to clear it.
- **Escape** key resets paste mode (global `keydown` listener while in pick or paste).
- Mousedown anywhere not inside `.aperture-element` resets paste mode (`CopyPaste.Context.tsx:101-107`, capture-phase listener).
- If the source element disappears (e.g. another tab/user deletes it), paste mode is auto-reset and the user is alerted: `"Copied element no longer exists. Paste mode has been cleared."` (`CopyPaste.Context.tsx:118-131`).

What gets copied: `{operation, glazingTypeId, frameTypeIds.{top,right,bottom,left}}` — i.e. **assignments only**, not size/position/name. The four-side frame mapping uses the element's stored sides (data frame), so pasting "as-is" works regardless of view direction.

---

# 5. Sidebar (window-type list)

## 5.1 `Sidebar.tsx` (the list shell)

- Renders `<ChangeNameModal />`, `<ApertureListHeader />`, then a scrollable `<List dense>` (`maxHeight: calc(100vh - 360px)`).
- Sort: `naturalSortCompare` from `frontend/src/formatters/naturalSort.ts` — uses `localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })`. So `C2 < C10`, `D1 < D2 < D10`. Verified by `Sidebar.test.tsx:275-310`.

## 5.2 `Sidebar.ListHeader.tsx`

- Single button: `+ Add New Aperture` (full-width, `120px` minWidth, with tooltip `"Add a new Aperture to the Project"`).
- **Renders only for logged-in users** (`UserContext.user`).

## 5.3 `Sidebar.ListItemContent.tsx`

Each row:
- Click → `handleSetActiveApertureById(id)`; `selected={isSelected}` highlights the row.
- Action icons (`EditNameButton`, `DuplicateButton`, `DeleteButton`) are visible only for logged-in users, and only on hover (`opacity 0.15s ease-in-out`, `Sidebar.ListItemContent.tsx:32-37`). Tooltips: `"Edit Name"`, `"Duplicate Aperture"`, `"Delete Aperture"` (placement="bottom").
- Edit-name button opens the `ChangeNameModal` (Aperture Name dialog).
- Duplicate / Delete buttons are disabled while `isLoadingApertures`.
- Delete uses `window.confirm('Are you sure you want to delete the Aperture?')` (in the AperturesProvider, not in the row itself).

The list does **not** show U-value, element count, dimensions, or thumbnail per row — just the name.

## 5.4 `ChangeNameModal/Modal.ChangeName.tsx`

- MUI Dialog (`maxWidth="xs"`, fullWidth).
- Title: `"Aperture Name"`.
- Single TextField labeled `"Aperture Name"`, autoFocus.
- Submit on Enter.
- Save button is disabled if `!newName.trim()` or `newName === apertureName` (i.e. unchanged).
- Buttons: `Cancel` / `Save`.

## 5.5 Sidebar tests

`Sidebar/__tests__/Sidebar.test.tsx`:
- Sidebar renders all apertures sorted alphabetically (Door Type C before Window Type A).
- Empty list renders no list items (only the Add button).
- ListHeader: button shows for logged-in users only; clicking calls `onAddAperture`.
- ListItemContent: highlights selected; click fires `handleSetActiveApertureById`; edit/duplicate/delete buttons exist for logged-in users (not for logged-out); each calls the corresponding handler.
- `naturalSortCompare`: multi-digit naturally (`C2 < C10`); letter-then-number (`A1 < A2 < B1 < B2`); hyphen names (`W-1 < W-2 < W-10 < W-20`); pure numeric; mixed letters; realistic window names.

---

# 6. Dimensions panel (rows + columns)

## 6.1 Layout

- Horizontal dimension strip lives **below** the canvas; vertical dimension strip lives **to the left**. Both are absolutely positioned relative to the SVG container. Constants in `Dimensions/constants.ts`:
  - `DIMENSION_LABEL_WIDTH_PX = 40`
  - `GRIDLINE_TICK_GAP_PX = 5`
  - `EXTRA_DIMENSION_GUTTER_PX = 20`
  - `DIMENSION_LABEL_TOP_PX = 10`
  - `DIMENSION_LABEL_LINE_OFFSET_PX = 8`
  - `DIMENSION_GUIDE_DOT_SIZE_PX = 4`
  - `DIMENSION_GUIDE_LINE_THICKNESS_PX = 1`
  - `DIMENSION_INPUT_WIDTH_PX = 160`
  - `DIMENSION_TOOLTIP_DELAY_MS = 1500`

## 6.2 Visual elements per axis

- A guide line spanning the full width/height (`DimensionCenterGuide.tsx`) with a small dot at every grid line.
- A tick mark at every grid line position (`GridLineTick.tsx`, 30 px length).
- One dimension label per segment, positioned at the segment's midpoint.
- One delete button per segment (only visible for logged-in users) — small `RemoveCircleTwoToneIcon`, color `rgba(0, 0, 0, 0.34)`.

## 6.3 Editing a segment

- Click a label → `handleEditColStart` / `handleEditRowStart` records the formatted display string in `editingValue` and `initialEditValue.current`, swaps the label for `<DimensionEditable>` (a `TextField` with `ClickAwayListener`).
- The TextField:
  - autoFocus, full select on focus.
  - Tooltip varies by display unit (`Dimension.Label.tsx:39-46`):
    - mm: `"Tip: You can use expressions like 100 + 50"`
    - cm: `"Tip: You can use expressions like 10 + 5"`
    - m: `"Tip: You can use expressions like 1.2 + 0.5"`
    - in: `"Tip: Use 2' 6\", 6-1/2\", or expressions like 24 + 12"`
    - ft: `"Tip: You can use expressions like 3.5 + 1.25"`
    - ft-in: `"Tip: Use 2' 6\", 6-1/2\", or expressions like 24 + 12"`
    - Tooltip enter delay 1500 ms.
  - `endAdornment` = unit string (mm/cm/m/in/ft) **except** when in `ft-in` (since the value already contains markers).
- On Enter or click-away → confirm. Confirm parses with `parseToMM(editingValue)`; only if NaN-free and `> 0` does it call `onColumnWidthChange / onRowHeightChange`.

## 6.4 Feet-inches parser (`parseFeetInches.ts`)

Handles these forms (verified by `__tests__/parseFeetInches.test.ts`):
- Feet only: `2'` → 24
- Inches only: `6"` → 6, `12"` → 12, `6.5"` → 6.5
- Combined no space: `2'6"` → 30
- Combined with space: `2' 6"` → 30
- Combined with dash separator after feet: `3'-4"` → 40
- Pure fractions: `1/2"` → 0.5, `3/4"` → 0.75, `1/8"` → 0.125
- Mixed inches with dash: `6-1/2"` → 6.5
- Mixed inches with space: `6 1/2"` → 6.5
- Whole inches with fraction: `24 3/8"` → 24.375
- Feet + mixed: `2' 6-1/2"` → 30.5; `2' 6.5"` → 30.5; `1' 3/4"` → 12.75
- Multiple spaces tolerated.
- Smart-quote normalization: U+2018/U+2019/U+0060/U+00B4 → `'`; U+201C/U+201D → `"` (`parseFeetInches.ts:19-23`).
- Returns `null` on plain numbers (no markers), arithmetic expressions (no markers), empty strings, or unparseable feet/inches segments.

## 6.5 Feet-inches formatter (`formatFeetInches.ts`)

- Converts mm → inches by `valueMM / 25.4`.
- Snaps fractional part to nearest 1/16, then reduces to lowest terms (e.g. `8/16 → 1/2`, `4/16 → 1/4`, `2/16 → 1/8`).
- Carries fractional overflow: `16/16 → +1 inch`; `≥12 inches → +1 foot, mod 12`.
- Output formats:
  - `0` mm → `0"`
  - exact feet → `1'`, `2'`, `3'` (no trailing inches)
  - exact inches → `1"`, `6"` (no leading feet)
  - feet + inches → `2' 6"`
  - inches + fraction → `6-1/2"`
  - feet + inches + fraction → `2' 6-1/2"`
  - pure fraction → `1/2"`, `3/4"`
  - negative → `-1'`
  - 1/16 → `1/16"` (snaps `1.5875` mm correctly).

## 6.6 Expression evaluator (`evaluateExpression.ts`)

- Whitelist regex: `^[\d\s+\-*/.]+$`. Tokenizes into numbers and `+ - * /` operators.
- Operator precedence: two-pass — `* /` first (left-to-right), then `+ -` (left-to-right). No parentheses.
- Returns `NaN` for: invalid characters (alphabetic, `(`, `)`, `;`, `$`, `eval`, `function`), code-injection attempts, division by zero, empty string, leading or trailing operator, double operators (`100 + + 50`), parens (not supported).
- Allows leading zeros (`007 → 7`).
- Allows negative leading number via the fast-path regex `/^-?\d+\.?\d*$/`. Negative numbers in expressions (e.g. `5 + -3`) are NOT supported (would NaN because the second operand can't start with `-`).
- Whitespace-tolerant: `100+50` and `  100   +   50  ` both work.
- Tested in `__tests__/evaluateExpression.test.ts` (50+ cases, including security/code-injection cases).

## 6.7 Display-unit conversion (`displayUnitConverter.ts`)

`formatValueForDisplay(valueMM, displayUnit, decimals?)`:
- mm: 1 decimal default
- cm: 2 decimals (mm/10)
- m: 4 decimals (mm/1000)
- in: 2 decimals (mm/25.4)
- ft: 3 decimals (mm/304.8)
- ft-in: delegates to `formatFeetInches`.
- Uses `convertValue` from `frontend/src/formatters/Unit.Converter.ts`.

`parseDisplayUnitToMM(input, displayUnit)`:
- mm/cm/m/ft → `evaluateAndConvertToMM` (arithmetic in display unit, then convert).
- in or ft-in → `parseIPInputToMM` → `parseInput(input, isIPMode=true)` then `* 25.4` (i.e. always interprets the result as inches; in `in` mode you can still type `2' 6"` and it works).

## 6.8 `parseInput` orchestration (`parseInput.ts`)

- Empty/whitespace → NaN.
- SI mode (`isIPMode=false`) → always arithmetic. Feet/inch markers in SI mode return NaN (verified by test).
- IP mode + contains `'` or `"` → `parseFeetInches`; if that returns null, returns NaN (don't fall back to arithmetic — user likely typo'd).
- IP mode without markers → arithmetic.

Disambiguation invariant: `6-1/2"` (with marker) → 6.5 inches; `6-1/2` (no marker) → 5.5 (arithmetic `6 - 1/2`).

## 6.9 Persistence

- Each segment edit calls one PATCH endpoint per axis: `/aperture/update-column-width/{apertureId}` or `/aperture/update-row-height/{apertureId}`.
- Response is the full updated `ApertureSchema`; the AperturesProvider pushes it into the cache via `updateActiveApertureData`.
- No autosave on dimension change is needed beyond the explicit confirm — the keystroke-to-API path is `Enter / clickAway → parseToMM → onColumnWidthChange → updateColumnWidth → ApertureService → PATCH`.

## 6.10 Add-row/column behaviors

- The grid edge `EdgeAddButtons` (§7.6) is one path. The other path is the `ApertureEditButtons` legacy buttons (`Aperture.EditButtons.tsx`) which call `handleAddRow / handleAddColumn` with the default `position='end'`. (The edit buttons component is **not** rendered anywhere in the current shell — see `Aperture.EditButtons.tsx`. It's dead code, used only in tests/legacy paths.)
- New row default height = 1000 mm; new column default width = 1000 mm (`backend/features/aperture/services/aperture.py:102, 170`).
- Adding at `START` shifts every existing element's row/col index by +1 in a single bulk update with explicit `last_modified=func.now()`. Adding at `END` just appends.
- New row/column auto-creates one element per opposing-axis cell, using the default frame & glazing types (`services/aperture.py:148-156, 215-222`).

## 6.11 Delete-row/column behaviors

- `LastColumnException` / `LastRowException` raised if you try to delete the only row/column. HTTP 403 returned (`routes/aperture.py:574-580, 596-602`).
- Note: `delete_row_from_aperture` actually raises `LastColumnException` (not `LastRowException`) when `len(row_heights_mm) == 1` — likely a bug, see §17.

## 6.12 Dimensions tests

`__tests__/parseInput.test.ts` (24 cases):
- SI mode: plain number, expression, feet-inches → NaN, invalid → NaN.
- IP mode feet-inches: `2'`, `6"`, `2' 6"`, `6-1/2"`, `2' 6-1/2"`.
- IP mode plain: `24`, `24+12`, `6.5`, `2*12`.
- Empty/whitespace/invalid → NaN.
- Disambiguation: `6-1/2"` is 6.5; `6-1/2` (no marker) is 5.5 (arithmetic).

`__tests__/formatFeetInches.test.ts` (11 cases): zero, exact feet (1', 2', 3'), exact inches, feet+inches, fractions, fraction reduction, negatives, snap to 1/16.

`__tests__/evaluateExpression.test.ts` (50+ cases): basic ops, chained ops, precedence, whitespace, edge cases (div-by-zero NaN, leading/trailing ops NaN, double ops NaN), security (alpha, eval, function, parens, semicolons all NaN).

`__tests__/displayUnitConverter.test.ts`:
- format: mm/cm/m/in/ft/ft-in.
- parse: each unit; `in` mode accepts `2' 6"`; `ft` mode supports expressions.
- round-trip: mm/cm/m/in/ft (each `format → parse` returns within 1 unit of original).
- error: empty/invalid → NaN.

`__tests__/parseFeetInches.test.ts` (40+ cases): see §6.4.

---

# 7. Aperture canvas (ApertureView)

## 7.1 `ApertureElements.tsx` — layout

- Top-line: `<ApertureToolbar />` (§7.2) centered above the canvas.
- A small italic typography reads e.g. `"1234.5 mm × 1000.0 mm"` (or in ft-in: `"3' 4-3/8" × 3' 3-3/8""`) as the total dimensions caption (`ApertureElements.tsx:106-119`).
- Main container is a CSS grid:
  - `gridTemplateColumns` = `getDisplayColumnWidths(column_widths_mm, isInsideView).map(w => w*scaleFactor + 'px').join(' ')` — i.e. column widths reversed when in interior view.
  - `gridTemplateRows` = `row_heights_mm.map(h => h*scaleFactor + 'px').join(' ')`.
- Inside: `<EdgeAddButtons />` (overlay), `<ApertureElementsDisplay />` (the SVG grid), `<ElementLabelsOverlay />` (name labels), and the `<DimensionsProvider>` wrapping `<VerticalDimensionLines>` + `<HorizontalDimensionLines>`.

## 7.2 `ApertureToolbar.tsx`

A pill-shaped toolbar with these buttons (size 24×24, custom hover scale animation):
- Zoom-in / Zoom-out (`ZoomInIcon` / `ZoomOutIcon`) — disabled at min/max scale.
- Swap-direction (`SwapHorizIcon`) — toggles inside/outside. Always visible.
- A static label pill: `"Viewing from Interior"` or `"Viewing from Exterior"`.
- (logged-in users only) Toolbar divider.
- Eyedropper / paint-bucket (`ColorizeIcon` / `FormatColorFillIcon`) — disabled if no aperture / no user.
- "Pick source" pill (green-tinted) when in pick mode and not yet pasted.
- "Paste mode" pill (yellow-tinted) when paste payload is loaded.
- Merge (`CallMergeIcon`) — disabled if `< 2` selected. Tooltip shows count: `"Merge selected (3 elements)"`.
- Split (`CallSplitIcon`) — disabled unless exactly 1 selected.
- Clear (`ClearIcon`) — disabled if no selection.

Tooltips:
- `"Zoom in"`, `"Zoom out"`, `"Switch to interior view"` / `"Switch to exterior view"`.
- `"Pick a window element to copy assignments"`, `"Click a window element to copy assignments"`, `"Exit paste mode"`.
- `"Select 2+ elements to merge"`, `"Select 1 element to split"`, `"Select elements to clear"`, `"Clear selection"`.

## 7.3 `ApertureElement.SVG.tsx` — SVG composition

For each element the SVG draws four `<rect>`s (one per side) inside a `viewBox="0 0 width height"`, `preserveAspectRatio="none"`:
- Right rect (full element height, frame width on right edge).
- Left rect (full element height, frame width on left edge).
- Top rect (full element width).
- Bottom rect (full element width).
- Frame widths come from each side's `frame_type.width_mm` (default 100 mm if missing). Scaled by `scaleFactor`.
- Hovering a side fills it `rgba(25,118,210,0.1)` and strokes it `var(--primary-color)`; otherwise `fill='#fff' stroke='#000'`.
- Each rect has a `<Tooltip>` with `frame_type.name` (placement = the side, `enterDelay=250`).

When `isInsideView`:
- Frame-data left/right are swapped before drawing (`ApertureElement.SVG.tsx:18-29`):
  - `top → top`, `bottom → bottom`
  - `right → left`'s frame, `left → right`'s frame.

After the four rects, the `OperationSymbol` is drawn inside the glazing area (the inner rectangle inside the four frames):
- `glazingArea = { x: leftFrameWidth, y: topFrameWidth, width: w-left-right, height: h-top-bottom }`.

## 7.4 `OperationSymbols.tsx`

Two kinds of symbols, both grey (`#666`), stroke-width 1:

- **SwingSymbol** (for `type='swing'`): two dashed lines (`strokeDasharray="4,3"`) from the hinge midpoint of the named side to the two opposite corners of the glazing rect. Direction maps to hinge side:
  - `left` → hinge on left edge midpoint, lines to right corners
  - `right` → hinge on right edge midpoint, lines to left corners
  - `up` → hinge on top midpoint, lines to bottom corners
  - `down` → hinge on bottom midpoint, lines to top corners
- **SlideArrow** (for `type='slide'`): a single arrow at vertical center, length = 80% of `min(width,height)`, head size = 10% of `min(w,h)`. Points in the named direction.

Multi-direction support: if `directions = ['left', 'up']` (e.g. tilt-turn), both symbols are drawn over each other.

Inside-view flip: `flipDirectionForInsideView` swaps `left↔right`. `up`/`down` are unchanged. Applied to both swing and slide.

## 7.5 `ApertureElement.Container.tsx`

Wraps the SVG in a clickable Box with grid placement:
- `gridRowStart = row_number+1`, `gridRowEnd = row_number+1 + row_span`.
- `gridColumnStart` / `gridColumnEnd` are computed by `viewFlipUtils.getDisplayColumnIndex` so that the visual columns reverse when interior.
- Selected: 2 px solid `#1976d2` + 10% blue background tint.
- Unselected: 1 px solid `#ddd`.
- Hover: light blue tint, transitions 0.2s.
- In paste/pick mode: amber tint and amber border on hover; cursor swaps to a custom inline-SVG eyedropper or paint-bucket cursor.
- Just-pasted: 600 ms `pastePulse` keyframe (amber box-shadow ripple).

Click handler precedence:
1. If `isPasteMode` → `pasteToElement(element.id)`. Stop.
2. If `isPickMode` → `startPasteMode(element)` + clear multi-select. Stop.
3. Otherwise → `toggleApertureElementSelection(element.id, event.shiftKey)`. Shift-click extends selection only to adjacent elements (§4.1).

## 7.6 `EdgeAddButtons.tsx`

- Logged-in users only.
- 4 hover zones (40 px deep each), at `top: -40, bottom: -40, left: -40, right: -40` of the canvas container.
- Each shows a small round blue (+) button on hover; tooltip placements per edge: `"Add row at top"`, `"Add row at bottom"`, `"Add column at left"`, `"Add column at right"`.
- Clicking a top/bottom edge calls `handleAddRowAtEdge('top'|'bottom')`.
- Clicking left/right edge:
  - When in exterior view: `'left' → data.left`, `'right' → data.right`.
  - When in interior view: visual left = data right and vice versa, so the handler flips: `handleLeftEdge → handleAddColumnAtEdge('right'|'left')` per `isInsideView`.
- Disabled while `isLoadingApertures`.

## 7.7 `ApertureSelector.tsx` (in the page header)

- An MUI Autocomplete for jumping between apertures. Sorted alphabetically (`localeCompare`, NOT natural-sort; this differs from the sidebar).
- Placeholder: `"Select aperture..."`.
- Shows in the page header next to the `Window / Door Type` heading.

## 7.8 `ElementLabelsOverlay.tsx`

- A separate full-canvas absolutely-positioned overlay. Each element gets a small white pill at its center showing `element.name || "Element ${id}"`.
- Hover (logged-in): cursor=pointer, slight elevation. Click swaps the pill for an editable TextField (autoFocus, full-select on focus). Enter/click-away submits via `updateApertureElementName`. Escape cancels.
- Logged-out users see the label as static (pointer-events none).
- The label position is computed using `getDisplayColumnIndex` to follow the interior-view column reversal.

## 7.9 `ApertureElementsDisplay` selection / multi-select

- Click an element → single-select (or toggle off if already the only selection).
- Shift-click → extend selection but **only to elements that are adjacent** to at least one already-selected element (`Aperture.Context.tsx:436-456`). "Adjacent" = same row/column AND col/row distance of 1, accounting for `col_span` / `row_span`. Non-adjacent shift-clicks are ignored silently.
- Multi-select state lives in `selectedApertureElementIds: number[]` (preserves click order).
- Merge is enabled at ≥2 selected. Merge requires the selection to form a complete rectangle with no gaps; otherwise the backend raises `ValueError` and the UI alerts (`services/aperture.py:603-617`).
- Split requires exactly 1 selected with `row_span > 1 || col_span > 1`; else ValueError → 400.
- Splitting creates `row_span × col_span` new 1×1 elements, each with the **default** frame & glazing types — assignments from the merged element are NOT preserved (`services/aperture.py:678-693`).
- Selection is cleared when switching apertures (`handleSetActive*`).

## 7.10 `viewFlipUtils.ts`

The whole interior-view flip is a thin layer of three helpers:
- `getColumnOrder(columnCount, isInsideView)` — `[0..n]` reversed if interior.
- `getDisplayColumnIndex(originalIndex, colSpan, columnCount, isInsideView)` — for an element in column `c` with `col_span = s`, its visual start column is `n - 1 - c - (s - 1)` when interior.
- `getDisplayColumnWidths(columnWidths, isInsideView)` — reverses the array when interior.

Frame name labels in the table also follow the flip (`ElementTableGroup.tsx:179, 193`): the **table row** labeled "Right Frame:" reads from `element.frames.left.frame_type` when in interior view, and vice-versa.

## 7.11 Total dimensions caption

`ApertureElements.tsx:88-90` builds `"{width} × {height}"` (no unit suffix in ft-in mode) or `"{width} mm × {height} mm"` (in numeric units).

---

# 8. Elements table

## 8.1 `ElementsTable.tsx`

- Renders one `ApertureElementTableGroup` per element.
- Sort: selected elements first (alphabetical by name), then non-selected (alphabetical) (`ElementsTable.tsx:18-37`).
- Wrapped in `<Flipper>` (`react-flip-toolkit`) with `flipKey = sortedElements.map(e => e.id).join(',')` so reordering animates with a spring (stiffness 200, damping 25).

## 8.2 `ElementTableGroup.tsx`

For each element, a card with:
- Title row: editable element name (click → TextField; Enter/click-away → save; Escape → cancel). Right-aligned: `<ElementUValueLabel>` (small `U-w: X.XXX W/m²K` chip with tooltip `"Element U-Value (U-w) — Calculated per ISO 10077-1:2006"`).
- Header row (`<TableHeader />`).
- 6 content rows in fixed order:
  - GlazingRow (rowIndex 0)
  - Top FrameRow (rowIndex 1)
  - Right FrameRow (rowIndex 2) — but with `position={isInsideView ? 'left' : 'right'}` (see §7.10)
  - Bottom FrameRow (rowIndex 3)
  - Left FrameRow (rowIndex 4) — with `position={isInsideView ? 'right' : 'left'}`
  - OperationRow (rowIndex 5)

## 8.3 `TableHeader.tsx`

5 columns (Grid sizes shown):
- `Element` (size 2)
- `Name` (size 6)
- `U-Value` (size 2) — tooltip `U-Value [W/m²K]` or `U-Value [Btu/hr·ft²·F]` per unit system.
- `Width` (size 1) — tooltip `Width [mm]` or `Width [in]`.
- `g-Value` (size 1) — tooltip `Solar Heat Gain Coefficient`.

## 8.4 `TableRows.tsx`

- `GlazingRow`: shows `Glazing:` label, the `<GlazingSelector>` (size 6), the glazing-type's u-value (size 2, formatted in current units, 3 decimals), `-` for width (glazing has no frame width), and the glazing's g-value (size 1).
- `FrameRow`: shows `Top Frame:` / `Right Frame:` / `Bottom Frame:` / `Left Frame:` (with capitalization fallback if `label` not provided), `<FrameSelector>` (size 6), frame's u-value (size 2, 3 decimals), frame's width (size 1, 1 decimal), `-` for g-value.
- `OperationRow`: `Operation:` label + `<OperationEditor>` spanning size 10.

Zebra striping: alternating `row-even` (#f8f9fa) / `row-odd` (#ffffff). Hover: `#e3f2fd` (`styles.css`).

## 8.5 `FrameTypeSelector.tsx`

- Logged-out: renders a `<span>` with the selected frame's name (read-only).
- Logged-in: MUI `Autocomplete`:
  - Options = `frameTypes` filtered by manufacturer filter (frames with no manufacturer pass through; frames whose manufacturer is in `enabledFrameManufacturers` pass).
  - Sort: `localeCompare` (alphabetical, not natural-sort).
  - Placeholder: `"Select top frame"` / `"...right frame"` etc.
  - Each option's row in the dropdown shows: `<bold>{name}</bold>` and `Width: {width_mm}mm, U-Value: {u_value_w_m2k}` (always SI in the option preview — `FrameTypeSelector.tsx:84-89`).
  - On change → `handleUpdateApertureElementFrameType({apertureId, elementId, framePosition: position, frameTypeId})`.
- The 24 px height TextField sx makes the whole thing very compact.

## 8.6 `GlazingTypeSelector.tsx`

Same Autocomplete pattern. Option preview line: `U-Value: {u_value_w_m2k}, g-Value: {g_value}` (SI-only, per source).
Placeholder: `"Glazing type..."`.

## 8.7 `OperationEditor.tsx`

- Read-only span for logged-out users showing e.g. `"Fixed"` / `"Swing (Left, Up)"`.
- Logged-in:
  - `<Select>` with options `Fixed`, `Swing`, `Slide`. Selecting `Fixed` clears the operation to `null`. Selecting `Swing` or `Slide` sets `{type, directions: []}`.
  - Direction checkboxes (`Left`, `Right`, `Up`, `Down`) appear only when type is non-fixed. Toggling adds/removes the direction. No mutex — multiple simultaneous directions are allowed (e.g. tilt-turn = `swing` + `[left, up]`).
- Display label format: `"Type"` if no directions, `"Type (Dir1, Dir2)"` otherwise.

## 8.8 Selection ↔ table row link

- Selection on the canvas does not "scroll the table to" the element; instead the **element's table card moves to the top** because `ElementsTable.tsx` sorts selected elements first. The `<Flipper>` animates the reorder.
- Selected element cards get a 2 px blue outline (`outline: '2px solid blue'` in `ElementTableGroup.tsx:103`).

## 8.9 Header / group rows

There is no per-aperture summary group above the elements — only per-element cards. The Window U-value lives in the page header (`UValueLabel`, §10).

---

# 9. Manufacturer filter

## 9.1 What it filters

Per project, controls which `manufacturer` values are visible in the FrameType / GlazingType Autocompletes (§8.5, §8.6). Frames/glazings with `manufacturer == null || ""` always pass through (`FrameTypeSelector.tsx:30-33`).

## 9.2 Modal (`ManufacturerFilterModal/Modal.ManufacturerFilter.tsx`)

- Triggered from the more-actions menu (the `⋯` button in the page header, §3.3, "Configure manufacturer filters" item with `<TuneIcon>` and helper `"Select visible manufacturers"`).
- MUI Dialog, `maxWidth="sm"`, fullWidth.
- Title: `"Configure Manufacturer Filters"`.
- Body:
  - Description: `"Select which manufacturers to show in the frame and glazing type dropdowns. Unchecked manufacturers will be hidden from selection."`
  - Caveat caption: `"Manufacturers in use can't be disabled."` (uses U+2019 curly apostrophe)
  - Two sections (Frame Manufacturers, Glazing Manufacturers), each with:
    - Right-aligned `Select All` / `Select None` links (Select All adds `available ∪ locked`; Select None reduces to `locked`).
    - One checkbox per manufacturer. Locked ones are disabled with tooltip `"In use on window elements"`.
- Buttons: `Cancel` / `Save`. While saving, button shows `<CircularProgress size={20}>`.
- On open: `refreshFilters()` (invalidate query) is called — see `Modal.ManufacturerFilter.tsx:113-117`.

## 9.3 Storage / API

- Stored in `ProjectManufacturerFilter` table: one row per `(project_id, manufacturer, filter_type)`.
- `filter_type` ∈ `{"frame", "glazing"}`.
- Update strategy (`services/manufacturer_filter.py:127-152`): wipes all rows for `(project_id, filter_type)`, re-creates one row per `all_manufacturers` with `is_enabled = manufacturer in enabled_manufacturers`. So the table is dense (every known manufacturer appears, just with a flag).
- `has_any_filters(project_id, filter_type)` is the "is configured" check; if false, the API returns `enabled = all_manufacturers`. So freshly-created projects show everything by default.
- "Used manufacturers" are computed at read time by joining `Aperture → ApertureElement → ApertureElementFrame/Glazing → FrameType/GlazingType`. The response always sets `enabled = sorted(set(enabled) | set(used))`, so used manufacturers can never be disabled (`routes/manufacturer_filter.py:60-62, 95-100`).

## 9.4 Tests

`ElementsTable/services/__tests__/manufacturerFilterService.test.ts`:
- Returns cached filters when not expired.
- Returns null when cache is expired.
- Clears cached entries.

(The localStorage-based service `ManufacturerFilterService` is **not** wired into the live UI — the live path goes through TanStack `useManufacturerFilterQuery`. The service file exists alongside but is unused except by these tests. Confirmed: no imports of `ManufacturerFilterService` outside its own file/tests.)

---

# 10. U-value computation

## 10.1 Backend service (`services/window_u_value.py`)

Method = ISO 10077-1:2006:

```
U_w = (Σ A_g·U_g + Σ A_f·U_f + Σ l_g·Ψ_g) / (Σ A_g + Σ A_f)
```

- "Uninstalled" — psi-install is excluded (`includes_psi_install=False`).
- Per element:
  - `width_m`, `height_m` summed from the aperture's column/row arrays accounting for span.
  - `interior_width = width - left_frame.width_m - right_frame.width_m`; `interior_height = height - top - bottom`.
  - If interior dim ≤ 0 → element skipped with warning.
  - `total_area = w*h`, `glazing_area = interior_w*interior_h`, `frame_area = total - glazing`.
  - **Corner handling**: each side gets half of each adjacent corner area (`corner_area_i = (this.width_m * adj_i.width_m) / 2`). So a side's full frame area = `width * interior_length + half-of-corner-1 + half-of-corner-2`. Lines 392-400.
  - `heat_loss_glazing = glazing_area * U_g`.
  - `heat_loss_frame[side] = side_area * U_f[side]` (corner-adjusted).
  - `heat_loss_spacer[side] = interior_length * psi_g[side]`.
  - Element-specific U = `total_heat_loss / total_area`.
- Aperture-level U = `Σ heat_loss / Σ total_area`.
- Final U rounded to 4 decimals; areas to 6 decimals.

Validation (`_validate_aperture`):
- No elements → invalid.
- No row_heights / column_widths → invalid.
- Per element: warning if no glazing, no glazing_type, no frame on a side, or no frame type on a side.
- Invalid → returns zeros + warnings + `is_valid=False`.

Caching: content-addressable cache keyed by `sha256` of `(row_heights, column_widths, element positions/spans, frame width+u+psi per side, glazing u)` — first 16 chars. Bound by `LimitedCache(max_size=50)`. No explicit invalidation needed because the key changes when inputs change.

## 10.2 Frontend hook (`useApertureUValue.ts`)

- Fetches `aperture/get-u-value/{aperture.id}` whenever a U-value-affecting property changes.
- Dependency key (`generateUValueDependencyKey`) is `JSON.stringify({id, columnWidths, rowHeights, elements: [{id, geometry, frames, glazing, operation}]})`. Note: includes operation, but operation has no effect on U-value (could be omitted). Note: excludes `name`, so renaming an aperture or element does NOT trigger a refetch.
- Debounce: 300 ms when editing the same aperture; **immediate** when switching to a different aperture (`useApertureUValue.ts:104-114`).
- Sets `loading=true` immediately on dependency change, even before the debounced fetch fires (so the UI feels responsive).
- Returns `{uValueData, elementUValues: Map<elementId, ElementUValueResult>, loading, error, refetch}`.

## 10.3 `UValueLabel.tsx` (page header)

- Shown in the page header, before the more-actions menu.
- While `loading` or no data → empty Box of fixed `minWidth: 180` (prevents layout shift, `UValueLabel.tsx:84-92`).
- Otherwise: `U-w: 1.234 W/m²K` (or `U-w: 0.217 BTU/hr-ft²-°F` in IP) with a small info icon.
- Tooltip content (always shown on hover):
  - Title: `"Effective Window U-Value (U-w)"`
  - Subtitle: `"Calculated per ISO 10077-1:2006"`
  - Italic formula: `U_w = (A_g·U_g + A_f·U_f + l_g·Ψ_g) / A_w`
  - Footnote: `"Uninstalled value (excludes Ψ-install)"`

## 10.4 `ElementUValueLabel.tsx` (per-element)

- Same logic as the page label but with `minWidth: 120`, smaller font (0.75rem), no info icon.
- Lives in the title row of each `ApertureElementTableGroup` (right-aligned next to the editable element name).

## 10.5 Output formatting

- SI: `value.toFixed(3)` with unit `W/m²K`.
- IP: `valueInCurrentUnitSystemWithDecimal(uValue, 'w/m2k', 'btu/hr-ft2-F', 3)` with unit `BTU/hr-ft²-°F`.

---

# 11. Frame Types catalog page (`pages/FrameTypes/`)

## 11.1 `FrameTypes.DataGrid.tsx`

- Pulls `apertures` and `frameTypes` from their providers.
- **Filters** the displayed catalog to only frame types whose `id` appears in some element's `frames.{top|right|bottom|left}.frame_type.id` across all apertures (`collectUniqueFrameTypeIds`). I.e. **only "in-use" frame types are shown** — this catalog page is not a general library browser, it's "what's currently used in this project".
- Sorted alphabetically by `name`.
- Column visibility is dynamically pruned via `useDynamicColumns` against the candidate list `['manufacturer', 'brand', 'use', 'operation', 'location', 'u_value_w_m2k', 'width_mm', 'psi_g_w_mk', 'comments']` — columns where every row has empty/null values are hidden.
- Wrapped in MUI X `<DataGrid>` with shared `StyledDataGrid` style.
- Title: `"Window & Door Frame-Types"`.

## 11.2 `useFrameTypeColumns()` columns

| Field | Header (SI / IP) | Render |
|---|---|---|
| `manufacturer` | `Manuf` | text |
| `brand` | `Brand` | text |
| `use` | `Use` | text |
| `operation` | `Operation` | text |
| `location` | `Location` | text |
| `u_value_w_m2k` | `U-Value [W/m²K]` / `U-Value [Btu/h·ft²·°F]` | converted, 2 decimals |
| `width_mm` | `Width [MM]` / `Width [Inches]` | converted, 2 decimals |
| `psi_g_w_mk` | `Psi-G [W/mk]` / `Psi-G [Btu/h·ft·°F]` | converted, 3 decimals |
| `datasheet_url` | `Data Sheet` | `CheckboxForDatasheet` (Yes/No marker, tooltip `"Do we have a PDF data-sheet with the product's performance values? Yes/No"`) |
| `comments` | `Notes` | `TooltipWithComment` |
| `link` | `Link` | `LinkIconWithDefault` |

## 11.3 Edit / add / delete

- The catalog page is **read-only display**. There are no per-row edit / add / delete controls in the data grid. Mutation of the catalog is only via the "Refresh frame types" menu item, which re-syncs from AirTable (`useRefreshFrameTypesMutation`) and runs `purge_unused_frame_types` (which deletes catalog rows that no aperture element references).

## 11.4 Difference vs. per-aperture FrameTypeSelector

- Selector (§8.5) shows the **full catalog** filtered by manufacturer-filter (regardless of project usage).
- Catalog page shows **only types currently in use** in this project's apertures.

---

# 12. Glazing Types catalog page (`pages/GlazingTypes/`)

Symmetric to Frame Types.

## 12.1 `GlazingTypes.DataGrid.tsx`

- Title: `"Window & Door Glazing-Types"`.
- Filters to in-use glazing-type ids only.
- Dynamic column candidates: `['manufacturer', 'brand', 'u_value_w_m2k', 'g_value', 'comments']`.

## 12.2 Columns

| Field | Header | Render |
|---|---|---|
| `manufacturer` | `Manuf` | text |
| `brand` | `Brand` | text |
| `u_value_w_m2k` | `U-Value [W/m²K]` / `U-Value [Btu/h·ft²·°F]` | converted, 2 decimals |
| `g_value` | `g-Value [%]` | `ValueAsDecimal(2)` (no unit conversion) |
| `datasheet_url` | `Data Sheet` | as for frames |
| `comments` | `Notes` | `TooltipWithComment` |
| `link` | `Link` | `LinkIconWithDefault` |

## 12.3 Edit / add / refresh

- Read-only DataGrid. Mutation only via the menu item "Refresh glazing types" (purges unused, re-imports from AirTable).

---

# 13. Backend routes / API surface

All under prefix `/aperture` (`backend/features/aperture/routes/`), tag `aperture`.

## 13.1 Apertures (`routes/aperture.py`)

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | `/aperture/get-apertures/{bt_number}` | — | `list[ApertureSchema]` | Sorted asc by name. 500 on any error. |
| GET | `/aperture/get-apertures-as-json/{bt_number}` | `?offset=0` | `{apertures: jsonString}` | All apertures keyed by name; HBJSON-compatible dump. |
| GET | `/aperture/get-window-constructions-as-hbjson/{bt_number}` | — | `{hb_constructions: jsonString}` | Honeybee-Energy `WindowConstruction` per element, identifier `"{apertureName}_C{col}_R{row}"`. 404 if project missing. |
| GET | `/aperture/get-aperture/{aperture_id}` | — | `ApertureSchema` | 404 if not found. |
| POST | `/aperture/create-new-aperture-on-project/{bt_number}` | — | `ApertureSchema` | Creates an `Aperture.default(project)` with one element. |
| POST | `/aperture/duplicate-aperture/{aperture_id}` | — | `ApertureSchema` | Deep-copy: dimensions + all elements + frames + glazing + operation. New name = `"{src} (Copy)"`. |
| PATCH | `/aperture/update-aperture-name/{aperture_id}` | `UpdateNameRequest` | `ApertureSchema` | |
| PATCH | `/aperture/update-glazing-type/{element_id}` | `UpdateGlazingRequest` | `ApertureSchema` | URL takes element id; body has `glazing_id` (= GlazingType id, a string). Returns parent aperture. |
| PATCH | `/aperture/update-column-width/{aperture_id}` | `UpdateColumnWidthRequest` | `ApertureSchema` | |
| PATCH | `/aperture/update-row-height/{aperture_id}` | `UpdateRowHeightRequest` | `ApertureSchema` | |
| PATCH | `/aperture/update-frame-type/{aperture_id}` | `UpdateApertureFrameRequest` | `ApertureSchema` | URL takes aperture id, body has element_id + side + frame_type_id. |
| PATCH | `/aperture/add-row/{aperture_id}` | `AddRowRequest` (default END) | `ApertureSchema` | START shifts all element row_numbers +1. |
| PATCH | `/aperture/add-column/{aperture_id}` | `AddColumnRequest` (default END) | `ApertureSchema` | START shifts all element col_numbers +1. |
| PATCH | `/aperture/merge-aperture-elements/{aperture_id}` | `MergeApertureElementsRequest` | `ApertureSchema` | Validates rectangle + no gaps. 400 on validation, 500 otherwise. |
| PATCH | `/aperture/split-aperture-element/{aperture_id}` | `SplitApertureElementRequest` | `ApertureSchema` | Splits a span back to 1×1 cells with default frames+glazing. 400 if span = 1×1. |
| PATCH | `/aperture/update-aperture-element-name/{element_id}` | `UpdateApertureElementNameRequest` | `ApertureSchema` | |
| PATCH | `/aperture/update-element-operation/{element_id}` | `UpdateOperationRequest` | `ApertureSchema` | `null` operation = fixed. |
| PATCH | `/aperture/update-element-assignments/{element_id}` | `UpdateElementAssignmentsRequest` | `ApertureSchema` | Bulk: operation + glazing_type_id + frame_type_ids (all 4). Used by paste. |
| DELETE | `/aperture/delete-aperture/{aperture_id}` | — | 204 No Content | Cascade removes all child rows. |
| DELETE | `/aperture/delete-row/{aperture_id}` | `RowDeleteRequest` | `ApertureSchema` | 403 if last row. |
| DELETE | `/aperture/delete-column/{aperture_id}` | `ColumnDeleteRequest` | `ApertureSchema` | 403 if last column. |
| GET | `/aperture/get-u-value/{aperture_id}` | — | `WindowUValueResponse` | ISO 10077-1 calc. 404 if missing. |

## 13.2 Frame types (`routes/frame_type.py`)

| Method | Path | Response |
|---|---|---|
| GET | `/aperture/get-frame-types` | `list[FrameTypeSchema]` (all rows in DB) |
| GET | `/aperture/refresh-db-frame-types-from-air-table` | `{message, types_added, types_updated, types_total_count}` |
| GET | `/aperture/load-all-frame-types-from-airtable` | `list[FrameTypeSchema]` (raw read-through, no DB write) |

## 13.3 Glazing types (`routes/glazing_type.py`)

Symmetric:
- GET `/aperture/get-glazing-types`
- GET `/aperture/refresh-db-glazing-types-from-air-table`
- GET `/aperture/load-all-glazing-types-from-airtable`

## 13.4 Manufacturer filters (`routes/manufacturer_filter.py`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/aperture/manufacturer-filters/{bt_number}` | — | `ManufacturerFilterResponseSchema` |
| PATCH | `/aperture/manufacturer-filters/{bt_number}` | `ManufacturerFilterUpdateSchema` | `ManufacturerFilterResponseSchema` |

Both 404 if project not found.

## 13.5 Notes

- Most routes have a `# @limiter.limit(...)` line commented out — rate-limiting is not enabled in V1.
- Rate-limit defaults discussed in code comments: 10/minute on list endpoints, 1/second on mutations.
- All catalog refresh endpoints are GET (not POST), even though they mutate the DB. Re-runnable / idempotent in spirit.

---

# 14. Persistence + last-modified handling

## 14.1 Save flow

- All edits autosave **per-edit** (no batching, no explicit "Save" button anywhere in the unit builder). The frontend has no "dirty" state.
- Each edit:
  1. UI handler calls `ApertureService.<method>` (PATCH/POST/DELETE).
  2. Service throws on null response or non-2xx (with `getWithAlert` / `patchWithAlert` / etc. handling auth/error alerts).
  3. The whole updated `ApertureSchema` is returned and pushed into the TanStack cache via `updateApertureInCache` (single-aperture replace inside the array). For sidebar-affecting mutations (rename, add, delete, duplicate) the whole `apertures` query is invalidated and re-fetched.
- `isMutating` flag in AperturesProvider gates a full-screen-ish loading overlay during row/col/aperture-create/-delete/-duplicate.
- `isLoadingApertures` in the public context API combines `isLoadingApertures` (initial fetch) and `isMutating`. Used to disable buttons throughout the UI (Sidebar Duplicate/Delete, EdgeAddButtons).
- No optimistic UI: the response replaces state. There's a perceptible round-trip on every edit.

## 14.2 Last-modified

- Defined in `_mixins.py` as a `DateTime(timezone=True)` column with `server_default = onupdate = func.now()` on `Aperture`, `ApertureElement`, `ApertureElementFrame`, `ApertureElementGlazing`, `ApertureFrameType`, `ApertureGlazingType`.
- `ApertureSchema.last_modified` (computed) walks the aperture, every element, each element's glazing+glazing_type, and each element's four frames+frame_types, taking `max()`.
- Tz handling (`_ensure_aware` in `last_modified.py:36-51`): naive datetimes (returned by SQLite test DB) are coerced to UTC; Postgres stays unchanged.
- Wire format: `dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")`. The "Z" suffix is contractually required because the Rhino plugin does literal byte-equality vs. a stored copy.
- For four bulk-update sites (add row, add column, delete row, delete column), `last_modified` must be set explicitly in the SQL update because `synchronize_session=False` doesn't fire `onupdate` (`services/aperture.py:128-141, 200-209, 272-281, 330-339`).

## 14.3 UI loading / error display

- `LoadingModal` is mounted with `showModal={false}` in the UnitBuilder shell — the actual loading overlay is the in-line `Box` with `CircularProgress` (`Page.tsx:65-85`).
- Per-mutation error path: `console.error(...) + alert(<message>)`. There's no toast system.
- API helpers (`patchWithAlert`, `getWithAlert`, ...) themselves emit alerts on auth/network failures.

---

# 15. AirTable touchpoints

Source: `backend/features/air_table/services.py:255-286`.

- One AirTable base id (`AIRTABLE_APERTURE_DATA_BASE_ID`) holds two tables read by V1:
  - `AIRTABLE_FRAME_DATA_TABLE_ID` — frame catalog.
  - `AIRTABLE_GLAZING_DATA_TABLE_ID` — glazing catalog.
- One token (`AIRTABLE_APERTURE_DATA_GET_TOKEN`) for both tables.
- Reads use `pyairtable`'s sync `Api.table(base, table).all()`.

Field mapping (via `FrameTypeSchema.fromAirTableRecordDict` / `GlazingTypeSchema.fromAirTableRecordDict`):
- All AirTable field keys are lower-cased and assigned to schema fields by name.
- The first attachment in the `DATASHEET` field's array is extracted; its `url` is stored as `datasheet_url`. Other attachments are dropped.
- The AirTable record id becomes `id` (a string).

Refresh flow (e.g. `refresh-db-frame-types-from-air-table`):
1. Read all from AirTable.
2. `purge_unused_frame_types(db)` — deletes any local row not referenced by any `ApertureElementFrame.frame_type_id`.
3. For each AirTable row: try `update_frame_type(id=...)`; on `FrameTypeNotFoundException`, `create_new_frame_type(...)`.
4. Returns `{types_added, types_updated, types_total_count}`.

V1 never **writes** back to AirTable. The catalog is unidirectional: AirTable → DB → UI.

---

# 16. Testing posture

(File list and the invariants each test group locks in.)

## 16.1 Frontend (`__tests__/`)

`Sidebar/__tests__/Sidebar.test.tsx` — UI behavior:
- Sidebar renders apertures alphabetically by name (Door C before Window A).
- Sidebar renders all apertures from context.
- Empty list → no list items.
- ListHeader: "+ Add New Aperture" button shows for logged-in user; absent for logged-out; click invokes `onAddAperture`.
- ListItemContent: selected highlights with `Mui-selected`; non-selected does not; click → `handleSetActiveApertureById(id)`; logged-in users see edit/duplicate/delete buttons; logged-out users see only the row button; clicking edit/duplicate/delete calls the right handler.
- `naturalSortCompare`: multi-digit (`C2 < C10`); letters (`A* < B*`); hyphens (`W-1 < W-2 < W-10 < W-20`); pure numeric; mixed letter+number.

`Sidebar/__tests__/testUtils.tsx` — Mock factories: `mockApertures` (3), `mockUser`, `createMockAperturesContext`, `createMockSidebarContext`.

`Dimensions/__tests__/parseInput.test.ts` — Orchestrator for SI/IP-mode parsing:
- SI mode: plain number; expression; feet-inches in SI mode → NaN; invalid → NaN.
- IP feet-inches: `2'`, `6"`, `2' 6"`, `6-1/2"`, `2' 6-1/2"`.
- IP plain: `24`, `24+12`, `6.5`, `2*12`.
- Errors: empty/whitespace/invalid → NaN.
- Disambiguation: `6-1/2"` (marker) = 6.5; `6-1/2` (no marker) = 5.5 (arithmetic).

`Dimensions/__tests__/formatFeetInches.test.ts` — Formatter:
- Zero, exact feet, exact inches, feet+inches, fractions, mixed, fraction reduction (1/2 not 8/16), negatives, snap to 1/16.

`Dimensions/__tests__/evaluateExpression.test.ts` — Expression engine:
- Numbers (int, decimal, negative, leading zeros).
- Each binary op (+, -, *, /).
- Chained operations.
- Operator precedence.
- Whitespace handling.
- Edge cases: div-by-zero NaN, empty/whitespace NaN, trailing/leading op NaN, double op NaN.
- Security: alpha NaN, code-injection NaN (eval/function/parens/$/;), variables NaN.

`Dimensions/__tests__/displayUnitConverter.test.ts`:
- format: per unit (mm 1d, cm 2d, m 4d, in 2d, ft 3d, ft-in arch).
- parse: per unit; `in` mode supports feet-inches; `ft` mode supports expressions.
- round-trip accuracy for mm/cm/m/in/ft.
- Errors: empty / invalid → NaN.

`Dimensions/__tests__/parseFeetInches.test.ts` — feet-inches parser:
- `containsFeetInchesNotation` for markers (incl. curly quotes); false for plain numbers / arithmetic.
- `parseFeetInches`: feet only, inches only, combined (with/without space, with dash), fractions, complex `2' 6-1/2"`, whitespace tolerance, smart-quote normalization, plain numbers/expressions/empty → null.

`ElementsTable/services/__tests__/manufacturerFilterService.test.ts` (localStorage layer; not used by live UI):
- Returns cached filters when not expired.
- Returns null when expired.
- `clearCache(projectKey)` removes both keys.

## 16.2 Backend tests

The backend tree under `backend/features/aperture/` does not contain a `tests/` subdirectory. (Backend tests, if any, live elsewhere — outside the scope of this reference.)

---

# 17. Edge cases & gotchas observed in code

- **`delete_row` raises `LastColumnException` not `LastRowException`** (`services/aperture.py:251-252`). The HTTP route catches `LastRowException` (`routes/aperture.py:575`); since `delete_row_from_aperture` actually raises `LastColumnException`, the wrong handler triggers (catches as `Exception` → 404 instead of 403). Likely a real bug.
- **Schema cycle workaround**: `ApertureSchema` defers `from features.aperture.services.last_modified import ...` inside the `last_modified` property body to avoid an import cycle (`schemas/aperture.py:48-54`). Touching the import order here will break it.
- **`last_modified` requires `model_validate(orm)`**: constructing `ApertureSchema(...)` with raw fields raises in `last_modified` because `_orm_aperture` is `None` (`schemas/aperture.py:56-61`). All routes use `model_validate(...)`.
- **Bulk row/col shifts must hand-set `last_modified`** because `synchronize_session=False` doesn't fire `onupdate` (`services/aperture.py:128-141, 200-209, 272-281, 330-339`).
- **Rhino plugin literal-equality wire format**: `last_modified` MUST end in `Z`, not `+00:00` (`services/last_modified.py:21-25, 86-94`).
- **Naive-datetime tolerance**: SQLite (test backend) returns naive datetimes for `timestamptz`-style columns; `_ensure_aware` patches them to UTC at read time (`last_modified.py:36-51`).
- **Splitting drops assignments**: `split_aperture_element` creates new 1×1 elements with default frame/glazing types. The merged element's frames/glazing/operation are NOT preserved (`services/aperture.py:678-693`).
- **Merge requires a complete rectangle**: gaps cause `ValueError`. Two non-adjacent selected elements that happen to share a row/col will fail validation server-side (`services/aperture.py:603-617`).
- **Adjacency check on shift-click is greedy**: the new element only needs to be adjacent to *any* already-selected element, not all of them. So you can build a non-rectangular L-shape via shift-click and then fail merge (`Aperture.Context.tsx:447-450`).
- **Shift-click on empty selection** treats it as a single-select (the `prev.length === 0 → return [elementId]` branch).
- **Toggle off while shift held**: clicking an already-selected element with shift removes it (the `if (prev.includes...) return prev.filter...` branch fires before the addToSelection check, `Aperture.Context.tsx:439-441`).
- **EdgeAddButton coordinate flip**: when interior view is active, the visual left/right are swapped before calling the data-frame handler (`EdgeAddButtons.tsx:131-139`). The top/bottom are NOT swapped (data y-axis = view y-axis).
- **OperationSymbol left/right swap on inside-view but not up/down** (`OperationSymbols.tsx:34-38`). This matches the convention that you flip horizontally (mirror) when looking from the other side.
- **Frame label flipping in the elements table** is independent of frame data flipping in the SVG: the table row labeled `Right Frame:` reads `element.frames.left` when interior, while the SVG reads `element.frames.left` for its visual right edge. Two separate flips kept in sync by hand (`ElementTableGroup.tsx:179, 193` and `ApertureElement.SVG.tsx:18-29`).
- **`ApertureSelector` (page header) sorts with `localeCompare`**, but the **Sidebar** sorts with `naturalSortCompare`. So `Window 10` comes before `Window 2` in the page selector, but after in the sidebar (`ApertureSelector.tsx:10` vs. `Sidebar.tsx:14`).
- **FrameTypeSelector / GlazingTypeSelector sort with `localeCompare`** (not natural) for catalog options.
- **Catalog dropdown option preview hard-codes SI units** (`Width: {width_mm}mm, U-Value: {u_value_w_m2k}` in `FrameTypeSelector.tsx:84-89`; same pattern in glazing). Does not respect IP unit toggle.
- **`useApertureUValue` debounce (300 ms) skips on aperture switch**, fires immediately. So switching a sidebar item triggers an instant fetch; rapid editing of the same aperture fans out 300 ms-coalesced fetches (`useApertureUValue.ts:104-114`).
- **`useApertureUValue` includes `operation` in the dependency key** even though operation has no effect on U-value (`useApertureUValue.ts:25-31`). Causes a redundant fetch when operations change.
- **`useApertureUValue` excludes `name`** from its key on purpose, to avoid useless fetches on rename. `aperture.elements.map` itself uses no `name` field.
- **`UValueLabel` reserves space (180 px) even when empty** during loading or invalid state (`UValueLabel.tsx:44-52, 84-92`). Prevents header layout bounce.
- **`ViewDirection` uses `sessionStorage`, not `localStorage`** (`ViewDirection.Context.tsx:12, 18, 22-24`). Per-tab persistence; reload keeps it; new tab resets.
- **`DisplayUnit` keeps SI and IP choices separately** in localStorage (`DisplayUnit.Context.tsx:17-18`). Toggling `unitSystem` swaps active unit but the other system's last choice is preserved.
- **localStorage-based catalog caches in `services/`** (`frameTypeService.ts`, `glazingTypeService.ts`, `manufacturerFilterService.ts`) with a 24-hour duration are **not connected to the live UI** — they exist alongside the TanStack queries but are only invoked by tests. The TanStack `staleTime: 24h` is the actual cache.
- **`generateUValueDependencyKey`** stringifies the entire frames/glazing trees (with name + URL etc.) every render → minor extra work but correctness-stable since it's done in a `useMemo` keyed off the aperture reference.
- **`react-flip-toolkit` reorder animation** uses `flipKey` = comma-joined element ids. New element ids → animation; reordering existing → animation. Removing an element → unmount, no animation.
- **`window.confirm` is the only delete confirmation** (`Aperture.Context.tsx:206`). No undo. No trash.
- **Merge selection invariant**: `mergeAperturesElements` only commits if validation passes; on success, `clearApertureElementIdSelection()` runs in `finally`, so even an error clears the selection (`Aperture.Context.tsx:472`).
- **Edit dimension click-away behavior** uses a `ref` to skip "no-op" commits (`Dimensions.Context.tsx:17, 31, 55`). Without it, opening a label editor and clicking away (with no edit) would parse the displayed `1234.5 mm`-rounded value back, losing precision in stored mm.
- **Paste mode escape** binds a global `keydown` and a capture-phase `mousedown` listener while pick or paste is active. The mousedown handler's escape bypasses if `target.closest('.aperture-element')` is hit, so clicking inside an element doesn't reset the mode (`CopyPaste.Context.tsx:101-107`).
- **PASTE_CURSOR / PICK_CURSOR** are inline `data:image/svg+xml` URLs (`ApertureElement.Container.tsx:11-14`). The hotspot coordinates are baked in (`4 20`, `6 22`).
- **Cache key for U-value is content-addressed sha256, max 50 entries** (`window_u_value.py:36, 39-83`). The content-addressing means stale entries linger (cache lookup is O(1) but no TTL).
- **`purge_unused_frame_types` / `purge_unused_glazing_types`** are called as part of every catalog refresh (`routes/frame_type.py:43-45`). So if a frame type isn't currently used by any element, hitting Refresh **will delete it**. Unused frame types from a prior project state can reappear if they exist in AirTable.
- **`frames` ORM property returns dict, not list**, so `purge_unused_frame_types` iterates `aperture_element.frames.values()` (`services/frame_type.py:191-195`). Order isn't guaranteed.
- **Dynamic column collapsing on the catalog pages**: a column with all empty/null values across the in-use rows is hidden. So if no frame in your project has a `mull_type`, that column doesn't appear (`useDynamicColumns`).
- **The `WindowDataDashboard` uses the global `location` object, not `useLocation()`** (`WindowDataDashboard.tsx:22, 35`). Works because the `useEffect` is keyed on `location.pathname`, but is non-idiomatic React Router usage.
- **`isLoadingFrameTypes` / `isLoadingGlazingTypes` are conflated with refresh-pending** in their providers (`isLoading = isLoadingFrameTypes || refreshMutation.isPending`). The full-screen loading overlay therefore gates everything during a refresh — including aperture editing.
- **Default values fall back to `"Default"`-named row, then first row, then exception** for both frame and glazing type lookups (`services/frame_type.py:49-63`, `services/glazing_type.py:49-65`). If the catalog is empty, creating a new aperture / element raises (`NoFrameTypesException` / `NoGlazingTypesException`).
- **Rate limiters are commented out** on every `/aperture/*` route. The `# @limiter.limit(...)` comments suggest intent (10/min on lists, 1/sec on mutations) but neither is enforced in V1.
- **`get-window-constructions-as-hbjson`** uses a hard-coded `_DEFAULT_VT = 0.6` for the `EnergyWindowMaterialSimpleGlazSys.vt` field (`services/to_hbe_window_construction.py:28`). The g-value comes from the glazing's `g_value`; the U-factor from the per-element ISO 10077-1 result.
- **`Aperture.fromAirTableRecordDict` is not defined** — only the catalog schemas (FrameType, GlazingType) parse from AirTable; apertures are not AirTable-sourced.

---

# 18. What's NOT in V1's window-builder

- **No undo / redo**. `window.confirm` on aperture delete; no other safety nets.
- **No multi-aperture operations**. Can't bulk-edit a property across multiple apertures.
- **No element duplicate**. Can duplicate a whole aperture; can't duplicate a single element.
- **No multi-select copy/paste**. Pick/paste applies to one source → one target (per click).
- **No parens in the expression evaluator**. `(1+2)*3` → NaN. Negative-second-operand expressions (`5 + -3`) also NaN.
- **No mullion direction control**. Frames are top/right/bottom/left only; there's no concept of an internal mullion that runs through merged spans.
- **No dimension chains / chained dimensions / fractional dimension locks**. Each segment is independent; no "all columns equal" tool.
- **No row/column drag-to-resize**. Editing is text-input only.
- **No element drag/move**. Position is determined by row/column index — there's no free-form move.
- **No element rotation**.
- **No "fixed cell aspect ratio"** or grid-snap.
- **No keyboard shortcuts** for the canvas. Escape resets paste mode (the only canvas-bound key handler). No arrow-key navigation between elements; no Delete-key on selected elements; no Ctrl/Cmd-A select-all; no Ctrl/Cmd-C / Ctrl/Cmd-V (the toolbar copy is the eyedropper, not OS clipboard).
- **No element thumbnail** in the sidebar.
- **No per-element U-value display in the sidebar or aperture selector.**
- **No dropdown for pre-built operation patterns** (e.g. "tilt-turn" preset). Users tick `swing` and then add `[left, up]` manually.
- **No "Set all four sides to the same frame type" shortcut** in the per-element table. Each side is independent.
- **No copy-frame-only / copy-glazing-only**. The copy payload is always `{operation, glazing, all 4 frames}`.
- **No catalog edit / add / delete** on the frame or glazing data-grid pages. Catalog is read-only; mutation is only via "Refresh from AirTable" (which can also delete unused rows).
- **No catalog filter UI** on the FrameTypes / GlazingTypes data-grid pages. Manufacturer filtering only affects per-element selectors, not the catalog page itself.
- **No browser-history per-aperture URL**. The active aperture id is in React state, not the URL. Reloading or sharing a URL always lands on "first aperture in alphabetical order".
- **No project-wide search**. No "find an element by name across all apertures".
- **No element search/filter** in the elements table.
- **No print / export-to-PDF / export-to-image** of an aperture diagram. The only export is the HBJSON window-constructions download.
- **No CSV / XLSX export** of the elements table or catalog data-grids (beyond MUI X DataGrid's built-in column menu, which is enabled but not customized).
- **No psi-install editing**. The U-value is uninstalled by definition (ISO 10077-1).
- **No mullion psi or jamb-detail editing**. Frame psi-glazing (`psi_g_w_mk`) is the only thermal-bridge value at the window level.
- **No SHGC / VT calculation**. SHGC is taken straight from the glazing's `g_value`; VT is hard-coded to 0.6 for HBJSON export.
- **No surface-tilt / orientation** on apertures. They're 2D types that get placed in the building model elsewhere — orientation lives outside the window-builder.
- **No "model-side" surface assignment** in the builder. Apertures aren't linked to assemblies/walls inside this view.
- **No glazing layer / build-up editor**. Glazing is opaque catalog data — `u_value_w_m2k` and `g_value` are numbers, not derived from a layer stack.
- **No frame profile editor**. Same — `width_mm`, `u_value_w_m2k`, `psi_g_w_mk` are flat numbers.
- **No multi-language / i18n**. All strings are English.
- **No dark mode** (the app may have one elsewhere; the window-builder does not customize for it).
