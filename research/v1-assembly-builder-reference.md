---
DATE: 2026-05-10
TIME: -
STATUS: REFERENCE — V1 Assembly-Builder feature/behavior catalog. Source
        for V2 user-story drafting. Not a spec; not normative.
AUTHOR: Claude (from V1 source)
SCOPE: Detailed enumeration of every UI surface, interaction, data
       structure, and edge case in PH-Navigator V1's Assembly-Builder
       (the visual layer/segment composer + per-segment Material List
       view) and its supporting backend.
RELATED: context/PRD.md (V2 architecture PRD),
         context/USER_STORIES.md (V2 user stories — to be expanded
         with US-Builder-Envelope after this reference is in hand),
         research/v1-window-builder-reference.md (sibling reference
         for the Window-Builder, written in the same template)
SOURCE: backend/features/assembly/**,
        backend/db_entities/assembly/**,
        backend/features/air_table/**,
        backend/features/gcp/** (segment media uploads),
        frontend/src/features/project_view/data_views/envelope/**,
        frontend/src/Routes.tsx
---

# 1. Domain glossary as used in V1

- **Assembly** — a complete envelope construction (one wall type, one floor type, one roof type, etc.). Owns an ordered list of `Layer`s, a `name`, a `project_id`, and an `orientation` flag (whether the first or last layer is the outside). Backend ORM: `db_entities.assembly.assembly.Assembly`. Frontend type: `AssemblyType`. Layers collection uses SQLAlchemy `ordering_list("order")` so list-position and the `order` field stay in sync.
- **Layer** — one homogeneous or heterogeneous cross-section of an Assembly. Owns an ordered list of `Segment`s plus a `thickness_mm` (the layer's depth normal to the assembly face). Backend: `db_entities.assembly.layer.Layer`. Frontend: `LayerType`. Layer.default(material) creates a 50 mm layer with one default Segment.
- **Segment** — one material instance within a Layer. For homogeneous layers there is exactly one Segment whose width equals the layer's full width; for heterogeneous layers (steel-stud cavity, hybrid cells) there are multiple side-by-side Segments. Carries `material_id`, `width_mm`, optional `steel_stud_spacing_mm` (non-null marks this segment as a steel-stud cavity), `is_continuous_insulation`, `specification_status`, `notes`, plus back-references to per-segment `material_photos` and `material_datasheets`. Backend: `db_entities.assembly.segment.Segment`. Frontend: `SegmentType`.
- **Material** — a catalog entry (AirTable-sourced) describing a product. Carries a string `id` (the AirTable record id, **not** an int), `name`, `category`, `argb_color` (string `"(a, r, g, b)"`), `conductivity_w_mk`, `emissivity`, `density_kg_m3`, `specific_heat_j_kgk`. **Globally shared across all projects** — there is no per-project filter (unlike the Window-Builder's `ProjectManufacturerFilter`). Backend: `db_entities.assembly.material.Material`. Frontend: `MaterialType`.
- **MaterialPhoto** — a per-segment image (site photograph or product photo). Stored on GCP; DB row holds `full_size_url`, `thumbnail_url`, optional `content_hash`. Backend: `db_entities.assembly.material_photo.MaterialPhoto`. Note the table is *segment*-scoped despite the "Material" prefix — moving a segment's material does **not** carry photos with it.
- **MaterialDatasheet** — a per-segment PDF (or image of a PDF first page). Same shape as MaterialPhoto. Backend: `db_entities.assembly.material_datasheet.MaterialDatasheet`. Same segment-scoped quirk.
- **SpecificationStatus** — enum on `Segment` indicating design completeness: `complete | missing | question | na`. Default at create time is `na`. Drives the badge color in the Material-List view and is round-tripped through HBJSON via the EnergyMaterial's PH ref properties.
- **Continuous Insulation (CI)** — a Segment-level boolean (`is_continuous_insulation`). Used by the steel-stud thermal-resistance grouper to identify exterior insulation layers between cladding and cavity.
- **Orientation** — Assembly enum: `first_layer_outside` (default) or `last_layer_outside`. Determines which end of the layers list represents the exterior face. Two distinct operations relate to this: **flip orientation** (toggle the enum, layers untouched) vs. **flip layers** (reverse the layer order, enum untouched). Calling both achieves a true mirror.
- **Steel-stud assembly** — an Assembly where any layer has any Segment with `steel_stud_spacing_mm IS NOT NULL`. Surfaced as the `Assembly.is_steel_stud_assembly` property. Triggers the AISI S250-21 equivalent-conductivity calculation when computing thermal resistance and when exporting to HBJSON.
- **Effective R-value (PH average)** — Assembly thermal resistance computed as the **mean of the Parallel-Path and Isothermal-Planes methods** (per ASHRAE Chapter 27). Returned in SI (m²·K/W) and as a U-value (W/m²·K). **Surface films are excluded** from the live calculation (see §13.5 for the gotcha that the HBJSON export uses different film assumptions).
- **HBJSON / OpaqueConstruction** — the Honeybee Energy serialization format. Assemblies can be imported from a `.hbjson` / `.json` file (POST upload) and exported as a JSON object keyed by assembly name (GET download). Round-trips a `ph_nav` external-id on each EnergyMaterial so re-imports re-resolve to the same DB Material rows.
- **"Materials" tab** — the `material-layers` route under `envelope-data`. Despite the name, this is **not** a global material catalog browser; it is a flat per-project view that walks every segment of every assembly and shows one row per segment, focused on per-segment photos / datasheets / notes / spec-status. The global material catalog has no first-class UI in V1 (it is implicit in the Segment-Properties material picker and refreshed via the Assemblies tab's overflow menu).

---

# 2. Data model (V1)

## 2.1 Assembly (`backend/db_entities/assembly/assembly.py` + `backend/features/assembly/schemas/assembly.py`)

ORM `Assembly(Base)`:
- `id: int` PK, auto-increment.
- `name: str`.
- `project_id: int` FK → `projects.id`.
- `project` relationship → `Project` (back_populates="assemblies").
- `layers` relationship → `list[Layer]`, ordered by `Layer.order`, `collection_class=ordering_list("order")`, `cascade="all, delete-orphan"`.
- `orientation: str` — stored as the enum's string value: `'first_layer_outside'` (default) or `'last_layer_outside'`. The enum itself is `AssemblyOrientation` (Python enum).

ORM class methods:
- `Assembly.default(project, material) -> Assembly` — factory: name="Unnamed Assembly", one default Layer (50 mm, one default Segment 812.8 mm wide using `material`), orientation `first_layer_outside`.

ORM properties:
- `is_steel_stud_assembly: bool` — `any(l.is_steel_stud_layer for l in self.layers)`.
- `outside_layer: Layer | None`, `inside_layer: Layer | None`.
- `layers_outside_to_inside: list[Layer]`, `layers_inside_to_outside: list[Layer]`.

Schemas:
- `AssemblySchemaBase { name, layers, orientation, is_steel_stud_assembly }` — the `is_steel_stud_assembly` field is a computed property (derived from layers).
- `AssemblySchema(AssemblySchemaBase) { id }`.
- `UpdateAssemblyNameRequest { new_name }` — model_validator: non-empty, max 100 chars, cleaned via `clean_ep_string`, whitespace normalized.

## 2.2 Layer (`backend/db_entities/assembly/layer.py` + `schemas/layer.py`)

ORM `Layer(Base)`:
- `id: int` PK, indexed.
- `order: int` (required) — managed by ordering_list.
- `thickness_mm: float` (required, **no default**).
- `assembly_id: int` FK → `assemblies.id`.
- `assembly` relationship → `Assembly`.
- `segments` relationship → `list[Segment]`, ordered by `Segment.order`, `collection_class=ordering_list("order")`, `cascade="all, delete-orphan"`.

ORM class methods:
- `Layer.default(material, order=0) -> Layer` — factory: thickness 50.0 mm, one default Segment at order 0.

ORM properties:
- `is_steel_stud_layer: bool` — `any(s.steel_stud_spacing_mm is not None for s in self.segments)`.
- `is_continuous_insulation_layer: bool` — `any(s.is_continuous_insulation for s in self.segments)`.

Schemas:
- `LayerSchemaBase { order, assembly_id, thickness_mm, segments, is_steel_stud_layer, is_continuous_insulation_layer }`.
- `LayerSchema(LayerSchemaBase) { id }`.
- `CreateLayerRequest { order }`.
- `UpdateLayerHeightRequest { thickness_mm }` — `field_validator` parses input via `ph_units.parser.parse_input` (accepts "50 mm", "2 in", or a float), converts to mm, must be > 0.

## 2.3 Segment (`backend/db_entities/assembly/segment.py` + `schemas/segment.py`)

ORM `Segment(Base)`:
- `id: int` PK.
- `layer_id: int` FK → `assembly_layers.id`.
- `material_id: str` FK → `assembly_materials.id` (**string**, not int — see §13.1).
- `order: int` — managed by ordering_list.
- `width_mm: float`.
- `steel_stud_spacing_mm: float | None = None`. Non-null marks this segment as a cavity slot at this stud spacing (typical 406.4 mm = 16").
- `is_continuous_insulation: bool = False`.
- `specification_status: SpecificationStatus = SpecificationStatus.NA` — persisted as a SqlEnum column named `specification_status_enum`.
- `notes: str | None = None`.
- `material_photos` relationship → `list[MaterialPhoto]`, `cascade="all, delete-orphan"`.
- `material_datasheets` relationship → `list[MaterialDatasheet]`, `cascade="all, delete-orphan"`.
- `layer` relationship → `Layer`.
- `material` relationship → `Material`.

ORM class methods:
- `Segment.default(material) -> Segment` — order 0, width 812.8 mm (32"), spacing None, is_continuous_insulation False.

`SpecificationStatus` enum (Python `str`-Enum):
- `COMPLETE = 'complete'`
- `MISSING = 'missing'`
- `QUESTION = 'question'`
- `NA = 'na'` (default at create)

Schemas (request payloads — every Segment-property update is a separate endpoint, see §4.3):
- `SegmentSchema { id, layer_id, material_id, order, width_mm, material, steel_stud_spacing_mm, is_continuous_insulation, specification_status, material_photos | None, material_datasheets | None, notes | None }`.
- `CreateSegmentRequest { material_id, width_mm, order }`.
- `UpdateSegmentMaterialRequest { material_id }`.
- `UpdateSegmentWidthRequest { width_mm }` (model_validator: > 0).
- `UpdateSegmentSteelStudSpacingRequest { steel_stud_spacing_mm: float | None }` (if non-null, must be > 0).
- `UpdateSegmentIsContinuousInsulationRequest { is_continuous_insulation: bool }`.
- `UpdateSegmentSpecificationStatusRequest { specification_status }`.
- `UpdateSegmentNotesRequest { notes: str | None }`.

## 2.4 Material (`backend/db_entities/assembly/material.py` + `schemas/material.py`)

ORM `Material(Base)`:
- `id: str` PK, indexed (AirTable record id; **not** auto-incrementing).
- `name: str` (required, validated via `honeybee.typing.clean_ep_string`).
- `category: str` (required).
- `argb_color: str | None` — format `"(a, r, g, b)"`. Parsed by `argb_list` property to `[a, r, g, b]` integers; defaults to `[255, 255, 255, 255]` if parse fails.
- `conductivity_w_mk: float | None`.
- `emissivity: float | None`.
- `density_kg_m3: float | None`.
- `specific_heat_j_kgk: float | None`.
- `segments` relationship → `list[Segment]`.

ORM class methods:
- `Material.get_by_name(session, name) -> Material | None`.

Schemas:
- `AirTableMaterialSchema` — used to deserialize raw AirTable records. Fields: `id`, `name`, `category`, `argb_color` (defaulting to `""`), `conductivity_w_mk`, `emissivity`, `density_kg_m3`, `specific_heat_j_kgk` (numeric defaults `0.0` or `100.0` for specific heat). Has a `lowercase_keys` model_validator that normalizes all input keys, plus a `fromAirTableRecordDict(record)` classmethod that flattens `record["fields"]` and re-injects `record["id"]`.
- `MaterialSchema` — the response shape for the load endpoints.

## 2.5 MaterialPhoto / MaterialDatasheet

ORM `MaterialPhoto(Base)` (`db_entities/assembly/material_photo.py`):
- `id: int` PK.
- `segment_id: int` FK → `assembly_layer_segments.id`.
- `full_size_url: str` (GCP URL).
- `thumbnail_url: str` (GCP URL).
- `content_hash: str | None`, indexed (for dedup / cache-bust).
- `segment` relationship → `Segment`.

ORM `MaterialDatasheet(Base)` (`db_entities/assembly/material_datasheet.py`) — identical shape, used for PDFs (and PDF first-page thumbnails).

Schemas:
- `MaterialPhotoSchema { id, segment_id, full_size_url, thumbnail_url }`.
- `MaterialDatasheetSchema { id, segment_id, full_size_url, thumbnail_url }`.

Important: both tables are **segment-scoped, not material-scoped**, despite the "Material" prefix in their names. Changing a segment's material does not move its photos / datasheets. Deleting a segment cascade-deletes its photos and datasheets.

## 2.6 ThermalResistanceSchema (`schemas/thermal_resistance.py`)

`ThermalResistanceSchema`:
- `r_parallel_path_si: float` (m²·K/W, ge=0).
- `r_isothermal_planes_si: float` (m²·K/W, ge=0).
- `r_effective_si: float` — average of the two above, ge=0.
- `u_effective_si: float` — `1.0 / r_effective_si`, ge=0.
- `is_valid: bool`.
- `warnings: list[str]`.

The `calculate_effective_r_value` service rounds all four numeric fields to 6 decimal places (`services/thermal_resistance.py`).

## 2.7 No `last_modified` mixin on Assemblies

Unlike the Aperture tree (which carries a `LastModifiedMixin` on every entity for the Rhino plugin's literal-equality compare; see Window-Builder reference §2.9), Assembly / Layer / Segment / Material have **no** `last_modified` column. There is no Rhino-side consumer that depends on byte-stable ISO timestamps. This means cache invalidation on the frontend is driven entirely by query-key invalidation + an in-memory `refreshKey` integer, not by mtime comparison.

---

# 3. Page composition / routes

## 3.1 React-Router (`frontend/src/Routes.tsx:56-62`)

```
<Route path="envelope-data" element={<EnvelopeDataDashboard />}>
    <Route index element={<Navigate to="assemblies" replace />} />
    <Route path="material-layers" element={<MaterialListPage />} />
    <Route path="assemblies" element={<AssembliesPage />} />
    <Route path="airtightness" element={<AirtightnessPage />} />
    <Route path="site-photos" element={<EnvelopeSitePhotosPage />} />
</Route>
```

Default landing tab is **Assemblies** (`envelope-data` → `Navigate replace` → `assemblies`).

## 3.2 `EnvelopeDataDashboard.tsx`

- Imports the three CSS files globally for the whole envelope subtree: `_styles/Assembly.css`, `_styles/Layer.css`, `_styles/Segment.css` (lines 1-2). This means the `.assembly-layer-thickness:hover`, segment hover/stroke vars, and add-layer/segment button styles are globally available, including in the Material-List view (which doesn't render the canvas but still shares the CSS namespace).
- Renders a `DataDashboardTabBar` with tabs `[Assemblies, Materials, Airtightness, Site Photos]` mapped to paths `[/assemblies, /material-layers, /airtightness, /site-photos]`.
- Active-tab index synced from `location.pathname` in a `useEffect` keyed off `location.pathname` (no router hook). Uses raw `location` global, same pattern as the Window-Builder dashboard.
- Wraps `<Outlet />` with **one provider only**: `MaterialsProvider`. (All assembly-specific providers are pushed down into `AssembliesPage` itself, see §3.3.)

## 3.3 `assemblies/_Page/Page.tsx` — AssembliesPage shell

Provider stack (outer → inner, on top of `MaterialsProvider` from the dashboard):

```
ContentBlock
  └─ AssemblyProvider          (assembly query, mutations, refresh keys, file input ref)
      └─ CopyPasteProvider     (pick/paste mode, undo stack, paste pulse)
          └─ AssemblySidebarProvider   (sidebar open/close, name-change modal)
              └─ AssemblyContentBlock  (header, sidebar, canvas, hidden file input)
```

`AssemblyContentBlock` composition:
- Header: `ContentBlockHeader` titled `"Assembly Details"`.
  - `titleContent`: heading + `<AssemblySelector />` (Autocomplete bound to assemblies, sorted via `localeCompare`).
  - `headerButtons`: `[<TotalThicknessLabel/>, <EffectiveRValueLabel/>, ...useAssemblyHeaderButtons()]`.
- Body: flex-row container `#assemblies-active-view-container`.
  - Left: collapsible sidebar (260 px when open, transition `0.2s ease-in-out`; default **closed** per `Sidebar.Context.tsx`).
  - Center: chevron toggle button (`ChevronLeft` / `ChevronRight`); `title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}`.
  - Right: main content (toolbar + assembly canvas + legend) plus a hidden `<input type="file" ref={fileInputRef} accept=".hbjson,.json">`.
- Blocking overlay: `LoadingModal` shown when `isLoadingMaterials || isLoadingAssemblies` (so the canvas does not render with stale or partial data).

## 3.4 `material_list/Page.tsx` — MaterialListPage shell

Provider stack (on top of `MaterialsProvider` from the dashboard):
```
MediaUrlsProvider
  └─ MaterialListContent       (parallel fetch of assemblies + project media URLs)
      └─ ContentBlock          ("Project Materials")
          └─ for each Assembly:
              └─ MaterialListContainer  (h4 "Assembly: {name}" + per-segment rows)
```

On mount, `MaterialListContent` fires **two parallel fetches** (`Promise.all`):
1. `GET assembly/get-assemblies/{projectId}` → `AssemblyType[]`.
2. `GET gcp/get-project-media-urls/{projectId}` → `{ site_photos: Record<segmentId, MaterialSitePhotoType[]>, datasheets: Record<segmentId, MaterialDatasheetType[]> }`. Loaded into `MediaUrlsContext` Maps.

A `LoadingModal` shows while `isLoadingMaterials || isLoadingAssemblies || isLoadingMedia`.

## 3.5 The other two envelope tabs (out of scope for this reference)

- **Airtightness** (`airtightness/Page.tsx`) — blower-door test data and ACH calcs.
- **Site Photos** (`site_photos/Page.tsx`) — required site-photo grid (floor / wall / roof) with captions.

Both share the same dashboard-level `MaterialsProvider` but otherwise are independent of the Assembly / Material-List views; they are not deep-dived here.

---

# 4. Backend API surface

All routes live under `/api/assembly/...` (the backend is single-versioned in V1). Most routes are rate-limited via `@limiter.limit(...)`; the values noted below match the source.

## 4.1 Assembly routes (`backend/features/assembly/routes/assembly.py`)

| Verb / Path | Request | Response | Notes |
|---|---|---|---|
| `POST /assembly/create-new-assembly-on-project/{bt_number}` | (empty) | `AssemblySchema` (201) | Rate 10/min. Inserts Assembly named "Unnamed Assembly" with one default Layer (50 mm) holding one default Segment (812.8 mm wide, project's first available Material). |
| `POST /assembly/add-assemblies-from-hbjson-constructions/{bt_number}` | multipart `.hbjson`/`.json` | (201, no body) | Rate 10/min. Parses HBJSON → OpaqueConstruction(s) → upserts Assemblies by name. 400 on invalid JSON or `MaterialNotFoundException` (with the missing material ids). 500 on other errors. |
| `GET /assembly/get-assemblies/{bt_number}` | — | `list[AssemblySchema]` | Rate 30/min. Sorted by `name.asc()`. |
| `PATCH /assembly/update-assembly-name/{assembly_id}` | `{ new_name }` | `AssemblySchema` | Rate 10/min. Name validated (non-empty, ≤100 chars, cleaned). |
| `DELETE /assembly/delete-assembly/{assembly_id}` | — | (204) | Bulk-deletes all Segments (via Layer join), then all Layers, then the Assembly. `synchronize_session="fetch"`. |
| `GET /assembly/get-assemblies-as-hbjson/{bt_number}` | `?offset=0` (unused) | `JSONResponse { hb_constructions: <JSON-string> }` | Rate 10/min. Body is a stringified JSON object keyed by assembly name. Frontend parses (handles string-or-object), wraps in Blob, downloads. |
| `PATCH /assembly/flip-assembly-orientation/{assembly_id}` | (empty) | `AssemblySchema` | Rate 20/min. Toggles enum only — layers untouched. |
| `PATCH /assembly/flip-assembly-layers/{assembly_id}` | (empty) | `AssemblySchema` | Reverses `layer.order` for every layer (`new_order = total - old_order - 1`), flushes, sorts the in-memory collection, commits. **Does not** flip orientation. |
| `POST /assembly/duplicate-assembly/{assembly_id}` | (empty) | `AssemblySchema` | Creates `"{name} (Copy)"` Assembly with all Layers and Segments duplicated (via staged sub-functions, single commit). |
| `GET /assembly/thermal-resistance/{assembly_id}` | — | `ThermalResistanceSchema` | Rate 30/min. PH average of Parallel-Path + Isothermal-Planes (see §13.4). Surface films excluded. |

## 4.2 Layer routes (`routes/layer.py`)

| Verb / Path | Request | Response | Notes |
|---|---|---|---|
| `POST /assembly/create-new-layer/{assembly_id}` | `{ order }` | `LayerSchema` (201) | Inserts a default Layer at the given order; ordering_list shifts higher orders. |
| `GET /assembly/get-layer/{layer_id}` | — | `LayerSchema` | 404 on `LayerNotFoundException`. |
| `PATCH /assembly/update-layer-thickness/{layer_id}` | `{ thickness_mm }` | `LayerSchema` | Validator parses input via `ph_units.parser.parse_input` (accepts unit strings like "2 in"). |
| `DELETE /assembly/delete-layer/{layer_id}` | — | (204) | Refuses to delete the last remaining Layer (`LastLayerAssemblyException`, surfaced as a 200 with detail). Decrements `order` for all higher-ordered layers; cascades to segments/photos/datasheets. |

## 4.3 Segment routes (`routes/segment.py`)

| Verb / Path | Request | Response | Notes |
|---|---|---|---|
| `POST /assembly/create-new-segment-on-layer/{layer_id}` | `{ material_id, width_mm, order }` | `SegmentSchema` (201) | Bulk-shifts existing segments at `order >= insertion_order` upward, then inserts. |
| `PATCH /assembly/update-segment-material/{segment_id}` | `{ material_id }` | `SegmentSchema` | Raises `MaterialNotFoundException` if material id not in DB. |
| `PATCH /assembly/update-segment-width/{segment_id}` | `{ width_mm }` | `SegmentSchema` | Must be > 0. |
| `PATCH /assembly/update-segment-steel-stud-spacing/{segment_id}` | `{ steel_stud_spacing_mm: float | null }` | `SegmentSchema` | Null = not a steel-stud cavity. |
| `PATCH /assembly/update-segment-is-continuous-insulation/{segment_id}` | `{ is_continuous_insulation: bool }` | `SegmentSchema` | — |
| `PATCH /assembly/update-segment-specification-status/{segment_id}` | `{ specification_status }` | `SegmentSchema` | Validates enum. |
| `PATCH /assembly/update-segment-notes/{segment_id}` | `{ notes: str | null }` | `SegmentSchema` | — |
| `DELETE /assembly/delete-segment/{segment_id}` | — | (204) | Refuses if last segment in its layer (400 + `LastSegmentInLayerException`). Decrements `order` for higher-ordered siblings. Cascades to photos/datasheets. |

## 4.4 Material routes (`routes/material.py`)

| Verb / Path | Request | Response | Notes |
|---|---|---|---|
| `GET /assembly/refresh-db-materials-from-air-table` | — | `JSONResponse { message, materials_number_added, materials_number_updated, material_total_count }` | Workflow: (1) fetch all from AirTable, (2) `purge_unused_materials` (delete Materials referenced by zero Segments), (3) `add_materials` upsert by id. **Note: this is a GET despite mutating** — used as the "Refresh Materials" overflow-menu action. |
| `GET /assembly/load-all-materials-from-airtable` | — | `list[MaterialSchema]` | Reads from AirTable directly (does **not** persist). Used by `useMaterialsQuery` (24h-cached) to populate the in-memory `materials` array used by the Segment-Properties picker and the Material-List read-only material-data block. |

## 4.5 Segment media routes (`backend/features/gcp/...`)

These are not under `/assembly` but are exercised exclusively by the Material-List view and the Segment-Properties modal indirectly. Endpoints used by the frontend:

| Verb / Path | Purpose |
|---|---|
| `GET /gcp/get-project-media-urls/{projectId}` | Returns `{ site_photos: Record<segmentId, MaterialSitePhotoType[]>, datasheets: Record<segmentId, MaterialDatasheetType[]> }`. One call per Material-List page load. |
| `POST /gcp/add-new-segment-site-photo/{projectId}` | multipart upload. FormData: `segment_id` (string), `file` (File). Returns `MaterialSitePhotoType`. Per-file POST when multiple files dropped. |
| `POST /gcp/add-new-segment-datasheet/{projectId}` | multipart upload. Same shape. Returns `MaterialDatasheetType`. |
| `DELETE /gcp/delete-segment-site-photo/{photoId}` | Returns boolean via `deleteWithAlert`. |
| `DELETE /gcp/delete-segment-datasheet/{datasheetId}` | Same. |

There is **no batch endpoint**; the upload helper iterates files one at a time and pushes results (or `null` on per-file failure) into a result array. On any non-OK response, `console.error` + `alert(...)` and the file slot becomes `null` (`uploadDatasheetFiles.tsx`, `uploadSitePhotoFiles.tsx`).

---

# 5. Backend services & business logic

## 5.1 Assembly service (`services/assembly.py`)

Custom exception: `AssemblyNotFoundException(assembly_id)`.

Functions of note:

- `get_assembly_by_id(db, assembly_id) -> Assembly` — raises `AssemblyNotFoundException` on miss.
- `get_assembly_by_name(db, project_id, name) -> Assembly | None`.
- `get_all_project_assemblies(db, bt_number) -> list[Assembly]` — joins Project, sorts by name.asc().
- `create_new_empty_assembly_on_project(db, name, bt_number) -> Assembly` — empty layers; **internal**, only used by HBJSON import.
- `create_new_default_assembly_on_project(db, bt_number) -> Assembly` — wraps `Assembly.default()`.
- `insert_layer_into_assembly(db, assembly_id, layer)` — sets `layer.assembly_id`, adds to session, inserts into the layers collection at `layer.order` (ordering_list does the order-field syncing). Single commit.
- `append_layer_to_assembly(...)` — convenience over the above: `layer.order = len(assembly.layers)`.
- `insert_default_layer_into_assembly(...)`, `append_default_layer_to_assembly(...)` — same shape using `Layer.default()`.
- `update_assembly_name(db, assembly_id, new_name)` — validated by Pydantic; commit + refresh.
- `delete_assembly(db, assembly_id)` — bulk Segment delete via Layer join, bulk Layer delete, then Assembly delete. All `synchronize_session="fetch"`. Single commit.
- `flip_assembly_orientation(db, assembly)` — toggles enum, commit.
- `flip_assembly_layers(db, assembly)` — recomputes `layer.order = total - old_order - 1`, flushes, sorts in-memory collection, commit. **Does not flip orientation.**
- `duplicate_assembly(db, assembly)` — creates `"{name} (Copy)"`, flushes for id, calls `stage_duplicate_layer` for each layer (non-committing), single commit.

## 5.2 Layer service (`services/layer.py`)

Exceptions: `LayerNotFoundException(layer_id)`, `LastLayerAssemblyException(layer_id, assembly_id)`.

- `get_layer_by_id(db, layer_id) -> Layer`.
- `create_new_layer(thickness_mm=50.0, order=0) -> Layer` — unattached factory.
- `update_layer_thickness(db, layer_id, thickness_mm) -> Layer`.
- `delete_layer(db, layer_id) -> None`:
  1. Refuse if it would empty the assembly (raise `LastLayerAssemblyException`).
  2. Bulk-update remaining `order >= deleted_order` to decrement by 1.
  3. Delete the layer (cascade to segments).
  4. Commit.
- `stage_duplicate_layer(db, layer, new_assembly_id) -> Layer` — non-committing helper; calls `stage_duplicate_segment` for each segment.
- `duplicate_layer(db, layer)` — same-assembly variant; commits + refreshes.

## 5.3 Segment service (`services/segment.py`)

Exceptions: `SegmentNotFoundException(segment_id)`, `LastSegmentInLayerException(segment_id, layer_id)`.

- `get_segment_by_id(db, segment_id) -> Segment`.
- `create_new_segment(db, layer_id, material_id, width_mm, order) -> Segment` — bulk-shift `order >= insertion_order` upward, insert, commit, refresh.
- `update_segment_material(db, segment_id, material_id)` — raises `MaterialNotFoundException` if id unknown.
- `update_segment_width / steel_stud_spacing / is_continuous_insulation / specification_status / notes` — simple field updates; one commit each.
- `delete_segment(db, segment_id) -> Segment`:
  1. Refuse if last segment in layer.
  2. Bulk-update siblings at `order > deleted_order` to decrement by 1.
  3. Delete segment (cascade to photos / datasheets).
  4. Commit.
- `stage_duplicate_segment(db, segment, new_layer_id) -> Segment` — non-committing helper.
- `duplicate_segment(db, segment)` — convenience.

## 5.4 Material service (`services/material.py`)

Exceptions: `MaterialNotFoundException(material_id)` (carries both `material_id` and a formatted `message`), `DeleteNonExistentMaterialException(material_id)`, `NoMaterialsException(material_type)`.

- `get_material_by_id(db, material_id: str) -> Material`.
- `get_material_by_name(db, name) -> Material`.
- `get_default_material(db) -> Material` — first row in the table (arbitrary). Used as the default Segment material when no specific id is supplied (e.g. by `Layer.default()`). Raises `NoMaterialsException` if the table is empty — this is a hard failure mode if AirTable refresh has never been run.
- `create_new_material / update_material(db, id, name, category, **fields)` — id-keyed.
- `add_materials(db, materials: list[Material]) -> tuple[int, int]` — upsert per id; returns `(num_updated, num_added)` **in that order** (note the surprising tuple ordering; the route handler reads them with named args so it's not visible from the response).
- `purge_unused_materials(db) -> None` — set-difference between all Materials and all Materials referenced by any Segment; deletes the orphans. Run as part of `refresh-db-materials-from-air-table`.

## 5.5 Thermal-resistance service (`services/thermal_resistance.py`)

Returns `ThermalResistanceResult` (data class mirrored by the schema in §2.6).

Top-level: `calculate_effective_r_value(assembly) -> ThermalResistanceResult`:

1. **Validate** via `_validate_assembly` (returns warnings list); if non-empty → return `is_valid=False` with warnings.
   - Empty layers list.
   - Negative or zero `thickness_mm`.
   - Empty segment list in a layer.
   - `segment.material.conductivity_w_mk` is None / ≤ 0.
   - Negative or zero `width_mm`.
2. If `assembly.is_steel_stud_assembly`, compute `steel_stud_eq_conductivity` via `_calculate_steel_stud_equivalent_conductivity`.
3. Compute `r_parallel_path_si` via `_calculate_parallel_path_r_value(assembly, eq_cond)`.
4. Compute `r_isothermal_planes_si` via `_calculate_isothermal_planes_r_value(assembly, eq_cond)`.
5. `r_effective_si = (r_parallel + r_isothermal) / 2.0`.
6. `u_effective_si = 1.0 / r_effective_si`.
7. Round all four to 6 decimals.

Steel-stud subroutine `_calculate_steel_stud_equivalent_conductivity`:

1. Sort layers via `_sort_layers_for_steel_stud_calc` into `{ext_cladding, ext_insulation, ext_sheathing, stud_cavity, int_sheathing}` (ext_insulation = continuous-insulation layers; cladding = anything before the first CI; sheathing = between CI and cavity / after cavity).
2. Compute IP R-values per group via `_calc_layer_group_r_value_IP`.
3. Pull cavity insulation conductivity from the cavity's first segment.
4. Call `honeybee_ph_utils.aisi_s250_21.calculate_stud_cavity_effective_u_value` with **hard-coded stud parameters**: 16" spacing, 43-mil thickness, 1.625" flange width, **R_SE=0, R_SI=0** (no surface films).
5. Convert U_IP → U_SI, multiply by stud depth in m → return equivalent conductivity (W/m·K).

Path & plane subroutines:
- `_calculate_parallel_path_r_value`: if all layers are 1-segment, simple series sum; else Cartesian product of segment indices per layer → for each path, accumulate `1/R_path * area_fraction_path`; final R = `1 / total_U`.
- `_calculate_isothermal_planes_r_value`: layers in series; per-layer R for heterogeneous layers via area-weighted parallel combination of segment R-values.
- `_get_effective_conductivity(segment, assembly, eq_cond)`: returns `eq_cond` if segment is a steel-stud cavity AND `eq_cond` is supplied; else `segment.material.conductivity_w_mk`.

## 5.6 HBJSON import (`services/assembly_from_hbjson.py`)

Top-level: `create_assembly_from_hb_construction(db, bt_number, hb_construction)`:

1. `get_or_stage_new_assembly(db, project, hb_construction.identifier)` — fetch by name + project, or stage a new empty one. Logs "Updating" if found.
2. `get_energy_materials_from_hb_opaque_construction(...)` — filters to EnergyMaterial only, logs warnings for other types.
3. `get_maximum_assembly_width(hb_materials)` — max cell-division width across all materials, default 812.8 mm if none.
4. For each EnergyMaterial → `stage_create_layer_from_hb_material(db, hb_mat, layer_width_mm, order)`. Three branches:
   - **Steel-stud cavity** (`is_a_steel_stud_cavity`): one Segment with `steel_stud_spacing_mm` from the material's divisions.
   - **Typical heterogeneous** (cell_count > 0, not steel stud): one Segment per cell with that cell's width.
   - **Homogeneous** (no divisions): one Segment from the material itself.
   - Specification status is read from `ref_properties.ref_status` (default `na`).
   - `MaterialNotFoundException`s are **collected**, not raised individually — at end, a single `MaterialNotFoundException` with all missing ids is raised so the error surfaces as one structured response.
5. Clear the existing layers from the Assembly and append the new ones. Single commit at end.

Helper: `get_hb_material_ref_identifier` looks for the `"ph_nav"` external identifier on the EnergyMaterial; this is how round-trip preserves the link to a DB Material row even if names diverge.

Constraint: `get_hb_material_ph_props` raises `NotImplementedError` if a material's PhDivisionGrid has `row_count > 1`. **Multi-row divisions are not supported.**

## 5.7 HBJSON export (`services/to_hbe_construction.py`, `to_hbe_material_typical.py`, `to_hbe_material_steel_stud.py`)

Top-level: `get_all_project_assemblies_as_hbjson_string(db, bt_number) -> str`:

1. Fetch all project Assemblies.
2. `convert_assemblies_to_hbe_constructions(...)` — for each Assembly:
   - If steel-stud → `get_steel_stud_layers_as_hb_materials(layers_outside_to_inside)`.
   - Else → `convert_single_assembly_layer_to_hb_material(layer)` for each layer.
   - Wrap into `OpaqueConstruction(identifier=assembly.name, materials=...)`.
3. Serialize to JSON dict keyed by construction identifier; return as a single JSON string.

Per-segment material conversion (`convert_segment_material_to_hb_material`):
- Builds an EnergyMaterial with thickness, conductivity, density, specific heat from the DB Material; sets PH color from `argb_color`.
- Attaches per-segment photos as `ImageReference`s and per-segment datasheets as `DocumentReference`s.
- Sets the external `"ph_nav"` identifier to `material.id` for round-trip resolution.
- Writes `ref_status` = `segment.specification_status`.
- Display name format: `"{material_name} [{thickness_inches:.1f} in]"`.

Heterogeneous layers (`build_ph_division_grid_from_segments` + `create_hybrid_hbe_material`):
- 1-row PhDivisionGrid; one column per Segment.
- The grid's "equivalent conductivity" is computed from the segment widths and conductivities.
- The hybrid material name joins unique segment material display names with `" + "`.

Steel-stud assemblies (`get_steel_stud_layers_as_hb_materials`):
- Organize layers via `SteelStudLayersCollection.from_layers`.
- Compute equivalent conductivity for the cavity. **Note:** unlike the live R-value calculation, this export **includes** surface films (`R_SE=0.17`, `R_SI=0.68`). The two calculations therefore disagree on a pure cavity-equivalence number; see §13.5.
- Emit: `ext_cladding + ext_insulation + ext_sheathing + equivalent_cavity_material + int_sheathing`. The cavity material carries the original cavity insulation as a division for round-trip fidelity.

---

# 6. Frontend context providers

## 6.1 Dashboard-level: `MaterialsProvider` (`envelope/_contexts/MaterialsContext.tsx`)

Wraps the entire envelope subtree (mounted in `EnvelopeDataDashboard.tsx`). State:
- `materials: MaterialType[]` — synced from `useMaterialsQuery` via `useEffect` (rather than returned directly) so it can also be set imperatively by the "Refresh Materials" flow.
- `isLoadingMaterials: boolean`.
- Public setters `setMaterials`, `setIsLoadingMaterials` (kept on the context surface deliberately; consumed by `Assembly.Context` during refresh).

Hook: `useMaterials()` throws if used outside the provider.

Consumers: `AssembliesPage` (loading overlay gate), Segment-Properties material picker, Material-List read-only material-data block.

## 6.2 Assemblies page: `AssemblyProvider` (`assemblies/Assembly/Assembly.Context.tsx`)

State:
- `assemblies: AssemblyType[]` (from `useAssembliesQuery` with key `queryKeys.assemblies(projectId)`).
- `selectedAssemblyId: number | null`.
- `selectedAssembly: AssemblyType | null` (memoized find).
- `isLoadingAssemblies: boolean` (from query).
- `hasInitialized: boolean` — on first non-loading load, auto-selects `assemblies[0].id`. Resets on `projectId` change (`Assembly.Context.tsx:103-118`).
- `isRefreshing: boolean`, `refreshMessage: string | null` — for upload / refresh modal feedback.
- `refreshKey: number` — incremented after every mutating handler so child components (Assembly, Layer, Segment) re-key and re-sync.
- `rValueRefreshKey: number` — separate counter so the EffectiveRValueLabel can refetch independently of the canvas re-render.
- `layerThicknessOverridesMm: Record<number, number>` — in-memory overrides (the modal's "draft" value before Save). Cleared on assembly change (`Assembly.Context.tsx:125-126`).
- `fileInputRef: React.RefObject<HTMLInputElement | null>` — hidden `<input type="file">` for HBJSON upload.

Public handlers:
- `handleAssemblyChange(id)` — set selected, invalidate query, increment `refreshKey`.
- `handleAddAssembly()` — POST + auto-select.
- `handleDeleteAssembly(id)` — `window.confirm('Are you sure you want to delete the Assembly?')` → DELETE → re-fetch list → select first remaining or null.
- `handleNameChange(id, newName)` — PATCH name → invalidate → re-select → `refreshKey++`.
- `handleRefreshMaterials()` — POST `/assembly/refresh-db-materials-from-air-table`, set `refreshMessage` to `"Materials refreshed successfully!"` or `"Error loading Material Data. Please try again later."`. Also invalidates the materials query (via the mutation hook).
- `handleUploadConstructions()` — programmatically click the hidden file input.
- `handleFileSelected(event)` — validate `.hbjson` or `.json` extension, POST via `fetchPostFile`, clear input value on completion.
- `handleDownloadConstructions()` — GET `/assembly/get-assemblies-as-hbjson/{projectId}`, parse the response (handle both string and object body shapes), wrap in a Blob, trigger `<a download>` to `project_{projectId}_assemblies.json`.
- `handleFlipOrientation(id)` — PATCH, refresh.
- `handleFlipLayers(id)` — PATCH, refresh.
- `handleDuplicateAssembly(id)` — POST, set new assembly active.
- `setLayerThicknessOverrideMm(layerId, mm)` / `clearLayerThicknessOverrides()` — in-memory only.
- `triggerRefresh()` / `triggerRValueRefresh()` — increment the corresponding counters.

Cache strategy: full query invalidation on every Assembly-level mutation (add / delete / rename / duplicate / flip). Layer/Segment-level mutations are not coordinated through this context (their hooks invalidate or manipulate state in `Layer.tsx` / `Segment.tsx` directly), and `refreshKey` provides the catch-all re-render signal.

## 6.3 Assemblies page: `CopyPasteProvider` (`assemblies/Assembly/CopyPaste.Context.tsx`)

State machine for cross-segment material copy / paste, with undo.

State:
- `isPickMode: boolean` — awaiting source segment click. Cursor becomes a custom inline-SVG eyedropper.
- `copyPayload: SegmentMaterialPayload | null` — set when a source is picked.
- `isPasteMode: boolean` — derived (`Boolean(copyPayload)`). Cursor becomes a custom inline-SVG paint-bucket.
- `sourceSegmentId: number | null`.
- `lastPastedSegmentId: number | null` — drives a 600 ms `pastePulse` keyframe animation on the just-pasted segment; cleared by a `setTimeout`.
- `undoStack: UndoEntry[]` — capped at `MAX_UNDO_STACK_SIZE = 20` (LIFO).

Payload shape (5 fields, **no width**):
```ts
interface SegmentMaterialPayload {
  material_id: string;
  steel_stud_spacing_mm: number | null;
  is_continuous_insulation: boolean;
  specification_status: SpecificationStatus;
  notes: string | null;
}
```

Undo entry shape:
```ts
interface UndoEntry {
  segmentId: number;
  previousMaterial: SegmentMaterialPayload;
  newMaterial: SegmentMaterialPayload;
  timestamp: number;
  assemblyId: number;
}
```

Handlers:
- `startPickMode()` — clear all paste state, set `isPickMode=true`.
- `startPasteMode(segment)` — extract its 5 properties into `copyPayload`, set `sourceSegmentId`, leave pick mode.
- `pasteToSegment(target)` — for each of the 5 fields, **issue an individual PATCH** if the target's value differs from the payload's. Push an UndoEntry. Set `lastPastedSegmentId` and start the 600 ms pulse-clear timeout. Trigger an assembly refresh.
- `undoLastPaste()` — pop the stack; if `entry.assemblyId !== currentAssemblyId`, alert and bail; else PATCH the 5 fields back to `previousMaterial` values.
- `resetPasteMode()` — clear payload / pick / source / pulse state and timeout.

Lifecycle:
- All paste state cleared whenever `selectedAssemblyId` changes (`CopyPaste.Context.tsx:56-63`).
- ESC key (global `keydown` listener while in pick or paste) → `resetPasteMode()`.
- Mousedown anywhere not inside a `.assembly-layer-segment` (capture-phase listener on `Assembly.tsx:37-44`) → `resetPasteMode()`.
- Pulse timeout cleaned up on unmount.

What gets copied: **assignments only** (the 5 fields above). Width is preserved per target. Photos and datasheets are **not** copied (they live on the target's own segment id and are unrelated to material identity).

## 6.4 Assemblies page: `AssemblySidebarProvider` (`assemblies/Assembly/Sidebar/Sidebar.Context.tsx`)

State:
- `nameChangeModal: { isOpen, assemblyId, assemblyName }`.
- `isSidebarOpen: boolean` — initial **false** (sidebar starts collapsed).

Handlers:
- `openNameChangeModal(id, name)`, `closeNameChangeModal()`.
- `handleNameSubmit(newName)` — calls `AssemblyContext.handleNameChange`, closes modal.
- `toggleSidebar()`.

No persistence. Sidebar default closed across reloads.

## 6.5 Material-List page: `MediaUrlsProvider` (`envelope/_contexts/MediaUrlsContext.tsx`)

Mounted only inside `MaterialListPage` (not at dashboard level — the assemblies tab does not need per-segment media). State:
- `sitePhotos: Map<segmentId, MaterialSitePhotoType[]>`.
- `datasheets: Map<segmentId, MaterialDatasheetType[]>`.
- `isLoadingMedia: boolean`.

Handlers:
- `setMediaFromResponse(response)` — bulk-loads from the `/gcp/get-project-media-urls/{projectId}` response; converts the object-keyed-by-segmentId-string into a Map keyed by number.
- `addSitePhoto(segmentId, photo)` / `removeSitePhoto(segmentId, photoId)`.
- `addDatasheet(segmentId, datasheet)` / `removeDatasheet(segmentId, datasheetId)`.
- `getSitePhotosForSegment(segmentId)` / `getDatasheetsForSegment(segmentId)` — accessors.

Important: the Maps are **fetched once on Material-List mount** and mutated locally on subsequent uploads / deletes. Switching tabs and coming back triggers a re-fetch. There is no shared cache between Material-List and the Segment-Properties modal in the Assemblies tab — they are independent.

---

# 7. Frontend hooks (queries + mutations)

## 7.1 `useMaterialsQuery` (`envelope/_hooks/useMaterialsQuery.ts`)

- Key: `queryKeys.materials()` → `['materials']` (no project scoping; materials are global).
- Endpoint: `GET assembly/load-all-materials-from-airtable`.
- `staleTime: 24h`, `gcTime: 24h`.
- Returns `{ materials, isLoadingMaterials, error }`.
- `MaterialsContext.Utility.tsx` also caches the JSON to `localStorage['materials']` with a `materials_expiry` companion key.

## 7.2 `useAssembliesQuery` (`assemblies/_hooks/useAssembliesQuery.ts`)

- Key: `queryKeys.assemblies(projectId)` → `['assemblies', projectId]`.
- Endpoint: `GET assembly/get-assemblies/{projectId}`.
- Enabled only when `projectId` is truthy.
- Returns `{ assemblies, isLoadingAssemblies, error }`.
- No explicit `staleTime` / `gcTime` (TanStack defaults).

## 7.3 Assembly mutations (`assemblies/_hooks/useAssemblyMutations.ts`)

Each mutation invalidates `queryKeys.assemblies(projectId)` on success unless noted.

| Hook | Endpoint | Method | Returns |
|---|---|---|---|
| `useAddAssemblyMutation` | `assembly/create-new-assembly-on-project/{projectId}` | POST | `AssemblyType` |
| `useDeleteAssemblyMutation` | `assembly/delete-assembly/{assemblyId}` | DELETE | void |
| `useRenameAssemblyMutation` | `assembly/update-assembly-name/{assemblyId}` | PATCH `{ new_name }` | void |
| `useFlipOrientationMutation` | `assembly/flip-assembly-orientation/{assemblyId}` | PATCH | `AssemblyType` |
| `useFlipLayersMutation` | `assembly/flip-assembly-layers/{assemblyId}` | PATCH | `AssemblyType` |
| `useDuplicateAssemblyMutation` | `assembly/duplicate-assembly/{assemblyId}` | POST | `AssemblyType` |
| `useUploadConstructionsMutation` | `assembly/add-assemblies-from-hbjson-constructions/{projectId}` | POST multipart | void |
| `useRefreshAssemblyMaterialsMutation` | `assembly/refresh-db-materials-from-air-table` | GET | invalidates `queryKeys.materials()` (not assemblies) |

Layer / Segment mutations are **not** wrapped in TanStack hooks; they are plain `fetch` calls inside `Layer.Hooks.tsx` / `Segment.Hooks.tsx` / `CopyPaste.Context.tsx`. Re-syncing relies on the `refreshKey` counter and per-component local state.

## 7.4 `useMaterialListItemHooks` (`material_list/ListItem.Hooks.tsx`)

Per-row hook returned to `MaterialListItem`. Manages:
- `isModalOpen`, `isSegmentHovered` — local UI state.
- `notes: UpdatableInput<string, { notes: string }>` — wrapper class with `currentValue` / `newValue` / `setNewValue`.
- `specificationStatus: SpecificationStatus` — synced from `segment.specification_status`.
- `handleChangeSpecificationStatus(event)` — optimistic local update + `PATCH assembly/update-segment-specification-status/{id}`. On error, revert and `alert(...)`.
- `handleSubmit(e)` (modal Save) — if notes changed, `PATCH assembly/update-segment-notes/{id}`; sync back. Always close modal + clear hover.
- Mouse handlers: `handleMouseEnter`, `handleMouseLeave`, `handleMouseClick` (opens modal).

---

# 8. Sidebar (assembly list)

## 8.1 `Sidebar.tsx` shell

- `<ChangeNameModal />` → `<ApertureListHeader />` (sic — this is the assemblies sidebar's add-button header) → scrollable `<List dense>` (`maxHeight: calc(100vh - 360px)`, `overflowY: auto`).
- Sort: `naturalSortCompare` from `frontend/src/formatters/naturalSort.ts` — `localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })`. Same as the Window-Builder; "Wall 2" sorts before "Wall 10".

## 8.2 `Sidebar.ListHeader.tsx`

- Single button: `+ Add New Assembly` (full-width, `120px` minWidth, blue outlined). Tooltip: `"Add a new Assembly to the Project"`.
- **Renders only for logged-in users** (`UserContext.user`).
- Click → `handleAddAssembly()` (POST → auto-select new).

## 8.3 `Sidebar.ListItemContent.tsx` — per row

- `<ListItemButton>` with primary text = assembly name. `selected={isSelected}` highlights via MUI `selected` style.
- Click → `handleAssemblyChange(id)` (clears copy/paste state via context, invalidates query, re-renders canvas).
- Three hover-reveal action icons (opacity 0 → 1 in 0.15s; logged-in only):
  - **Edit name (pencil)** — opens `ChangeNameModal`. Tooltip: `"Assembly Name"`.
  - **Duplicate (copy)** — `handleDuplicateAssembly(id)`. Tooltip: `"Duplicate Assembly"`. Disabled while loading.
  - **Delete (X)** — `handleDeleteAssembly(id)`. Tooltip: `"Delete Assembly"`. Confirmation handled in `AssemblyProvider` via `window.confirm('Are you sure you want to delete the Assembly?')`. Disabled while loading.

The sidebar list does **not** show R-value, layer count, total thickness, or any thumbnail per row — just the name. (Same minimalism as the Window-Builder sidebar.)

## 8.4 `ChangeNameModal/Modal.ChangeName.tsx`

- MUI `<Dialog maxWidth="xs" fullWidth>`.
- Title: `"Assembly Name"`.
- Single `<TextField>` labeled `"Assembly Name"`, `autoFocus`. Submit on Enter (form `onSubmit preventDefault → handleNameSubmit`).
- Save disabled if `!newName.trim()` or `newName === currentName` (unchanged).
- Buttons: `Cancel` / `Save`.

## 8.5 No assembly-list tests

Unlike `Sidebar.test.tsx` for the Window-Builder, no `__tests__` folder exists in the `assemblies/` tree. Coverage is implicit via end-to-end flows.

---

# 9. Assembly canvas (visual layer / segment editor)

## 9.1 Container layout (`Assembly/Assembly.tsx`)

- `.assembly-container` (margin 4 ≈ 32 px MUI spacing units).
- Top: `<div className="assembly-orientation-text">` showing "exterior" or "interior" based on `orientation`.
  - `first_layer_outside` → top label "exterior", bottom label "interior".
  - `last_layer_outside` → top label "interior", bottom label "exterior".
- Middle: `<div className="assembly-layers">` — vertically stacks `<Layer>` components in `assembly.layers` array order (index 0 at top).
- Bottom: companion orientation label.
- Below the canvas: `<AssemblyLegend>` — unique segment materials sorted alphabetically by name; each row shows a color swatch (from material `argb_color`) and the `conductivity_w_mk`.

## 9.2 Layer rendering (`Layer/Layer.tsx`, `_styles/Layer.css`)

Each `<Layer>` is a flex-row with two columns:

**Left column** — `.assembly-layer-thickness`:
- 35 px fixed width, font-size 8 px, right-edge dashed border.
- Renders the layer's thickness in the user's active display unit (mm or inch via `useUnitConversion`).
- Click → opens `LayerHeightModal`.
- Hover → bold + highlight background + colored right border (`Assembly.css:1-6`).
- Hover-reveal buttons (logged-in only):
  - `+ Add Layer Above` — circular pink (`#b2087c`) button, 15 px, absolute-positioned at top edge.
  - `+ Add Layer Below` — same, at bottom edge.
- Layer-list border treatment: dashed `#ccc` between layers; first-of-type also has a dashed top border.

**Right column** — `.assembly-layer-segments`:
- Flex-grow flex-row container.
- Height in CSS px = layer thickness in mm (1 mm = 1 px). This is the on-screen visual scale.
- Children: `<Segment>` per `layer.segments`.

Layer thickness state (`Layer.Hooks.tsx`):
- `useLayerHooks(layer)` returns `layerThickness: UpdatableInput<number, { thickness_mm: number }>`.
- Modal Save → `PATCH /assembly/update-layer-thickness/{layerId}`. After Save, also calls `triggerRValueRefresh()` so the EffectiveRValueLabel refetches.

Add-layer flow:
- Buttons call `insertLayerAtOrder(orderPosition)` → POST `/assembly/create-new-layer/{assemblyId}` with `{ order }`.
- Frontend GETs the newly created layer (via the response), inserts into local `layers` array at the correct index, recomputes order field on the in-memory list.
- `triggerRValueRefresh()` to refresh the header label.

Delete-layer flow:
- Triggered from the LayerHeightModal's red `Delete Layer` button.
- `window.confirm('Are you sure you want to delete this Layer?')`.
- DELETE `/assembly/delete-layer/{layerId}`. Backend refuses if it would empty the assembly (`LastLayerAssemblyException`).
- Local list update + `triggerRValueRefresh()`.

## 9.3 Segment rendering (`Segment/Segment.tsx`, `_styles/Segment.css`)

Each `<Segment>` is a flex-1 box (`.assembly-layer-segment`) with:
- Inline SVG with a `<rect>` whose:
  - `fill` is computed from `convertArgbToRgba(segment.material.argb_color)` — parses the `"(a, r, g, b)"` string and renders a CSS `rgba(...)`. Defaults to `'#ccc'` on parse failure.
  - `stroke` is the CSS variable `--construction-layer-segment-rect-stroke` (default 1 px).
  - On `:hover`, fill becomes `--construction-layer-segment-hover-fill` and stroke `--construction-layer-segment-hover-stroke` at 3 px.
- `maxWidth: ${segmentWidthMM}px` so width stored in mm renders 1:1 as on-screen px.
- Click → opens the Segment-Properties modal (suppressed in pick / paste modes; click then drives the copy/paste state machine instead).
- Hover-reveal buttons (logged-in only; hidden in pick/paste mode):
  - `+ Add Segment Left` — circular pink (`#b2087c`) button, 20 px, absolute at the segment's left edge.
  - `+ Add Segment Right` — same, at the right edge.
- Width state (`Segment.Hooks.tsx`):
  - `segmentWidthMM: UpdatableInput<number, { width_mm: number }>`.
  - Commit via `PATCH /assembly/update-segment-width/{segmentId}` (called from the modal Save handler, not from the inline width control — there isn't one).

Add-segment flow:
- `onAddSegmentLeft(segment)` / `onAddSegmentRight(segment)` → `insertSegmentOnLayer()`.
- POST `/assembly/create-new-segment-on-layer/{layerId}` with `{ material_id: <clicked segment's material>, width_mm: 50, order: <position> }` (50 mm hard-coded default in `Layer.Hooks.tsx:9`).
- New segment inherits the clicked segment's **material only**; spacing / continuous-insulation / notes default per the schema (null / false / null), and `specification_status` defaults to `na`.

Delete-segment flow:
- From SegmentPropertiesModal's red `Delete Segment` button.
- `window.confirm('Are you sure you want to delete this Layer Segment?')`.
- DELETE `/assembly/delete-segment/{segmentId}`. Backend refuses if it would empty the layer (400 + `LastSegmentInLayerException`).

## 9.4 Copy / paste state-machine on the canvas

Initiated from the AssemblyToolbar (see §10.6). When `isPickMode`:
- All segments render an outline (2 px solid `rgba(56, 142, 60, 0.8)` green, `Segment.tsx:113-116`).
- Cursor becomes the eyedropper SVG.
- Add-segment hover buttons hidden.
- Click on a segment → `startPasteMode(segment)`.

When `isPasteMode`:
- Hover on a segment yellow-tints it (`rgba(255, 193, 7, 0.12)` background, `rgba(255, 193, 7, 0.8)` border).
- Cursor becomes the paint-bucket SVG.
- Click on a segment → `pasteToSegment(target)` — issues 5 individual PATCHes (only for fields that differ), pushes UndoEntry, fires 600 ms `pastePulse` keyframe animation on the target (`@keyframes pastePulse` — yellow box-shadow at 0.6 opacity → 0).

Exit:
- ESC key.
- Mousedown anywhere not inside a `.assembly-layer-segment` (capture-phase).
- Assembly change (clears the entire CopyPasteContext state).

## 9.5 The `AssemblyLegend`

- Below the canvas, listing each unique material used in the active assembly.
- Sorted alphabetically by name.
- Each entry: color swatch (`argb_color` → RGBA) + name + `conductivity_w_mk`.
- Read-only; clicking does nothing.

---

# 10. Modals

## 10.1 ChangeNameModal — see §8.4.

## 10.2 LayerHeightModal (`LayerHeightModal/LayerHeight.tsx`)

Trigger: click on the `.assembly-layer-thickness` cell.

Field:
- **Layer Height** — `<TextField type="number" autoFocus>` with label `"Layer Height [mm]"` or `"[inch]"` per the active display unit. `step="any"` so decimals are allowed.
  - Default value: current thickness, converted into the active unit.
  - On focus: `inputRef.select()` (so the existing value is highlighted ready to overwrite).
  - On change: parse to mm via `useUnitConversion()`, update local state.
  - Disabled when `!userContext.user` (guests see the value but cannot edit).

Buttons:
- **Cancel** — restore original `currentLayerThicknessMM` and close.
- **Save** — if `newValue !== currentValue`, `PATCH /assembly/update-layer-thickness/{layerId} { thickness_mm }`, sync local state, `triggerRValueRefresh()`, close.
- **Delete Layer** (red full-width error button at the bottom) — `window.confirm('Are you sure you want to delete this Layer?')` → `DELETE /assembly/delete-layer/{layerId}` → recompute order locally → `triggerRValueRefresh()` → close. If the backend refuses (last-layer exception), the alert surfaces the error and the modal stays open.

Form `onSubmit preventDefault` → triggers Save (Enter key submits).

## 10.3 SegmentPropertiesModal (`SegmentPropertiesModal/LayerSegmentProperties.tsx`)

Trigger: click on a segment (when not in pick/paste mode).

Title: `"Segment: {currentMaterialName}"` — the title updates live as the material picker changes (`LayerSegmentProperties.tsx:249`).

Fields, top to bottom:

1. **Material** — `<Autocomplete>` of all `materials`, **grouped by `category`** (sorted by category alphabetically, then by name within each group).
   - Value: current `segment.material`.
   - Label: `"Select a material"`.
   - On change: `handleMaterialChange()` updates both `materialId` and the cached `materialColor` so the canvas's preview can re-render correctly on Save.
   - Disabled for guests.
   - Loading-state spinner while `isLoadingMaterials`.

2. **Material Data** — read-only bordered box (border 1 px `#ccc`, background `#f9f9f9`, padding 2 rem) showing the currently selected material's properties:
   - Name, Category.
   - Conductivity (SI: `w/mk`) or Resistivity (IP: `R-value/in`) per active unit system.
   - Density (kg/m³ or lb/ft³).
   - Specific Heat Capacity (J/kg-K or Btu/lb-F).
   - Each value renders as `--` if null / 0 / undefined.

3. **Segment Width** — `<TextField type="number" autoFocus>`. Label `"Segment Width [mm]"` / `"[inch]"`. `step="any"`. `inputRef.select()` on mount.
   - Disabled for guests.

4. **Continuous Insulation** — `<Checkbox>` labeled `"Continuous Insulation (for Steel Stud Walls)"`.
   - Hidden for guests.

5. **Steel Stud Layer** — `<Checkbox>` labeled `"Steel Stud Layer"`.
   - When checked, reveals **Steel Stud Spacing** field below.

6. **Steel Stud Spacing** (conditional) — `<TextField type="number">` labeled `"Steel Stud Spacing [mm]"` / `"[inch]"`. `step="any"`.
   - Default if currently null: `406.4 mm` (≈ 16") via `Segment.Hooks.tsx:65`.
   - Disabled for guests.

Buttons:
- **Cancel** — restore all `current*` values, close.
- **Save** — for each property that changed, fire its own PATCH:
  - `update-segment-width` if width changed.
  - `update-segment-material` if material changed.
  - `update-segment-steel-stud-spacing` if the steel-stud checkbox state or spacing value changed (note: unchecking sends null; checking re-sends the spacing).
  - `update-segment-is-continuous-insulation` if the CI checkbox changed.
  - **Notes are not edited from this modal** (notes live in the Material-List view's modal, not here).
  - Calls in parallel; the modal closes on completion. **Partial-failure caveat**: if one PATCH errors, others may have already succeeded.
- **Delete Segment** (red full-width) — `window.confirm('Are you sure you want to delete this Layer Segment?')` → `DELETE /assembly/delete-segment/{segmentId}`.

Form `onSubmit preventDefault` → triggers Save.

Guest behaviour: all inputs except the Delete button hidden / disabled; the modal effectively becomes a read-only details view.

---

# 11. Header buttons / labels

## 11.1 `<TotalThicknessLabel>` (`_Page/TotalThicknessLabel.tsx`)

- Sum: `Σ (override[layer.id] ?? layer.thickness_mm)` across `selectedAssembly.layers`.
- Uses `layerThicknessOverridesMm` from context so unsaved modal values appear immediately.
- Renders in the active unit system: 3 decimals (SI) or 1 decimal (IP).
- Format: `"Total Thickness: {value} {unit}"`.
- Tooltip: `"Sum of all layer thicknesses"`.
- Container `min-width: 160 px` to prevent layout shift.
- Renders `--` if no assembly is selected.

## 11.2 `<EffectiveRValueLabel>` (`_Page/EffectiveRValueLabel.tsx`)

- `useEffect`-fired `GET /assembly/thermal-resistance/{assemblyId}` on `selectedAssembly` change OR `rValueRefreshKey` change. Each fetch is fresh — no caching.
- Display, per active unit system:
  - **IP**: `"Effective R-Value: {value}"` (1 decimal, hr·ft²·F/BTU).
  - **SI**: `"Effective U-Value: {value} W/m²K"` (3 decimals, W/m²·K).
- Tooltip: detailed paragraph explaining "PH average of Parallel-Path and Isothermal-Planes per ASHRAE CH27" + the explicit note about excluded surface films.
- Icon: `<InfoOutlined fontSize="14px">` to flag the tooltip.
- Container `min-width: 180 px`.
- Renders nothing (empty layout-reserve box) while loading or on error or when `is_valid=false`.

## 11.3 `useAssemblyHeaderButtons` (`_Page/useAssemblyHeaderButtons.tsx`)

Returns a `<HeaderActionsMenu>` (an MUI `MoreHoriz` icon button anchoring a dropdown). Three items:

1. **Refresh materials** — icon `RefreshRounded`. Helper `"Reload from AirTable"`. Handler `handleRefreshMaterials()` → POST → `alert("Materials refreshed successfully!")` on success (or the corresponding error alert). Note this is the **same alert pattern** as the Window-Builder's frame/glazing refresh.
2. **Upload constructions** — icon `FileUploadOutlined`. Helper `"Import .hbjson or .json file"`. Handler triggers the hidden file input. On selection, validates the extension and POSTs as multipart.
3. **Download constructions** — icon `FileDownloadOutlined`. Helper `"Export as .json file"`. Handler GETs `/assembly/get-assemblies-as-hbjson/{projectId}`, parses the JSON body (handles both string and object payloads), wraps in a Blob, triggers a download to `project_{projectId}_assemblies.json`.

Menu disabled (the icon button itself) for guests. While `isRefreshing`, the icon is replaced by a spinner.

## 11.4 `<AssemblyToolbar>` (referenced from `Assembly/AssemblyToolbar.tsx`)

This sits between the project header and the canvas (not inside the `headerButtons` array). It carries the cross-cutting actions on the **selected assembly**:
- **Flip orientation** (`<SwapVert>` icon, tooltip "Flip interior/exterior orientation") → `handleFlipOrientation(assemblyId)`.
- **Flip layers** (`<Flip>` icon, tooltip "Reverse layers from inside to outside") → `handleFlipLayers(assemblyId)`.
- **Copy/Paste material** entry to start `startPickMode()`.
- **Undo last paste** — disabled when in pick/paste or when `undoStack.length === 0` (`AssemblyToolbar.tsx:147`).
- All toolbar buttons disabled if no assembly is selected.

---

# 12. Material-List view (the per-segment list)

URL: `/project/:projectId/data/envelope-data/material-layers`. Reached by clicking the "Materials" tab in the envelope dashboard.

## 12.1 Page layout

- One `ContentBlock` titled `"Project Materials"`.
- For each Assembly (sorted by `name.asc()` from the backend): a `MaterialListContainer`:
  - `<h4 className="assembly-title">Assembly: {assembly.name}</h4>` (border-bottom `1 px #868686`, padding-bottom 5 px).
  - Stack-direction-row of `MaterialListItem` per segment (across all layers, in layer-order then segment-order).
  - Container styling (`MaterialsList.css`): `margin: 15 px`, `border-left: 1 px solid #e0e0e0`, `padding-left: 10 px`, `padding-right: 20 px`.

## 12.2 Per-row layout (`ListItem.tsx`)

A row is a `<Stack direction="row" spacing={2}>` with four flex-1 columns + a hidden modal:

| Column | Subcomponent | Content |
|---|---|---|
| 1 | `MaterialListItemName` | Material name; tooltip = current notes; speech-bubble icon (`SpeakerNotesTwoTone`, color `var(--question-stroke)`) when notes exist. Click → opens DetailsModal. |
| 2 | `DesignSpecificationStatus` | Specification-status `<Select>` — see §12.3. |
| 3 | `SegmentDatasheets` | Drag-and-drop datasheet container — see §12.4. |
| 4 | `SegmentSitePhotos` | Drag-and-drop site-photo container (mirror of datasheets) — see §12.4. |

Row styling (`MaterialsList.css`):
- Background → `var(--appbar-bg-color)` while `isSegmentHovered`, else transparent.
- Cursor: pointer. Padding 1 rem. Border-bottom `1 px #e0e0e0`.

Visibility rule (`ListItem.tsx:43`): a row is hidden if `!userContext.user && specification_status === 'na'`. So unauthenticated viewers see only segments with a meaningful spec-status set (anything other than NA).

## 12.3 `<DesignSpecificationStatus>` (`DesignSpecificationStatus.tsx`)

`<Select size="small" minWidth=200 fontSize=0.7rem>` with the four options enumerated from `Object.values(SpecificationStatus)`.

| Enum | Display label | CSS class | Visual |
|---|---|---|---|
| `complete` | "Design Spec.Complete" | `have-specification-complete` | background `var(--complete)` |
| `missing` | "Design Spec. Missing" | `have-specification-missing` | text `var(--missing-strong)`, background `var(--missing-weak)`, border `var(--missing-strong)` |
| `question` | "Design Spec. Question" | `have-specification-question` | text white, background `var(--question)` |
| `na` | "N/A" | `have-specification-na` | background `var(--appbar-bg-color)` |

On change: optimistic local state update + PATCH; on error revert and `alert("...")`.
Disabled for guests; clicking shows a "Please log in to update the status" alert.

## 12.4 `<SegmentDatasheets>` and `<SegmentSitePhotos>` (`Segment.Datasheets.tsx`, `Segment.SitePhotos.tsx`)

Symmetric components. Per-segment containers that show thumbnails + accept drag-and-drop uploads.

Container box styling (computed in `useMemo`):
- If `specification_status === 'na'` → disabled appearance: border `#ccc`, background `var(--appbar-bg-color)`, cursor `not-allowed`.
- Else if `isDragOver` → blue dashed: border `1 px dashed #1976d2`, background `#e3f2fd`.
- Else if at least one item present → solid `#ccc` border, white background.
- Else (none present, not n/a) → "missing" appearance: solid `var(--missing-strong)` border, `var(--missing-weak)` background. Empty-state text `"Product Datasheet Needed"` (datasheets) or `"Site Photo Needed"` (photos), colored `var(--missing-strong)`.

Items render as `<LazyThumbnail>`s. Click any thumbnail → `<ImageFullViewModal>` (§12.6).

Drag-and-drop:
- `onDragOver` → `preventDefault`, set `isDragOver=true`.
- `onDragLeave` → `preventDefault`, set `isDragOver=false`.
- `onDrop`:
  - Guest? → `alert("Please log in to upload files.")` and bail.
  - Otherwise call `uploadDatasheetFiles(projectId, segment.id, files)` (or `uploadSitePhotoFiles`), which iterates the FileList and POSTs each individually as multipart.
  - Filter null results (per-file failures).
  - For each successful upload, push into `MediaUrlsContext` via `addDatasheet(segment.id, ds)` / `addSitePhoto(segment.id, photo)` so the thumbnails appear immediately.
  - Clear `isUploading` in `finally`.

Loading overlay during upload: centered `<CircularProgress>` + `"Uploading..."` text.

Deletion: handled inside the FullView modal; on confirm, `deleteWithAlert("gcp/delete-segment-datasheet/{id}")` (or site-photo equivalent), then `removeDatasheet(segment.id, id)` from context.

## 12.5 `<LazyThumbnail>` (`LazyThumbnail.tsx`)

Generic over `T extends { thumbnail_url: string }`.
- States: `'loading'` → `<Skeleton variant="rectangular" w/h=64>`; `'error'` → `<BrokenImageIcon>`; `'loaded'` → `<img>` (display block, cursor pointer).
- Click → `setSelectedImage(image)` to open the full-view modal.

## 12.6 `<ImageFullViewModal>` (`Image.FullViewModal.tsx`)

A single modal used for **both** datasheets and site photos.

- MUI `<Modal open={!!selectedItem} onClose={() => setSelectedItem(null)}>` (backdrop click closes).
- Centered Box (flex-column, gap 2).
- Body:
  - If URL ends with `.pdf` → `<PDFViewer url={full_size_url} />`.
  - Else `<img src={full_size_url}>` with `maxWidth: 80vw, maxHeight: 70vh, borderRadius: 8`.
- Logged-in users get a **Delete Image** button (`<Button variant="contained" color="error" startIcon={<DeleteIcon>}>`).
  - `window.confirm("Are you sure you want to delete this image?")`.
  - On confirm: call the parent's `onDeleteSitePhoto(id)` (which actually does the API + context update) → `setSelectedItem(null)` → close.
  - Disabled while in-flight.

No keyboard navigation between images (no next/prev). No zoom/pan. Just one image at a time.

## 12.7 `<PDFViewer>` (`PDFViewer.tsx`)

- 100 % width × `70vh`.
- Loading: centered `<CircularProgress>`.
- Error: `<PictureAsPdfIcon fontSize=60>` + text `"Failed to load PDF"` + a fallback `<a href=url target="_blank">` link.
- Success: `<iframe src="${url}#toolbar=0">` (browser-native PDF viewer, native toolbar hidden via the URL fragment).

## 12.8 `<DetailsModal>` (`Details.Modal.tsx` + `Details.Modal.Types.tsx`)

Trigger: click the segment row's name column. Modal scope: notes editing + read-only material-property block.

Type:
```ts
interface DetailsModalProps {
  isModalOpen: boolean;
  segment: SegmentType;
  currentNotes: string;
  onModalClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onNotesChange: (args: { notes: string }) => void;
}
```

Layout:
- `<Dialog open fullWidth maxWidth="sm">`.
- `<DialogTitle>` = `segment.material.name`.
- `<DialogContent>` as a `<form>`:
  - `<MaterialData>` — read-only bordered box (border `1 px #ccc`, background `#f9f9f9`, padding 2 rem) showing Name / Category / Conductivity (W/m·K) / Density (kg/m³) / Specific Heat Capacity (J/kg·K). Missing values render `--`. **Always SI** in this modal — no IP toggle here, unlike the Segment-Properties modal in the Assemblies tab.
  - `<MaterialNotes>` — heading `"Notes:"` + `<TextareaAutosize minRows={4} placeholder="Add notes here..." width="100%" defaultValue={currentNotes}>`. Disabled for guests.
- `<DialogActions>` → `<OkCancelButtons>`:
  - Logged-in: `<ButtonGroup variant="text">` with `Cancel` + `Save` (`Save` is `type="submit"`).
  - Guests: `<ButtonGroup variant="contained">` with a single `OK` button (`type="submit"`).

Form `onSubmit preventDefault → props.onSubmit(e)` → `handleSubmit` in the row hook. If notes changed, PATCH `assembly/update-segment-notes/{id}`. Always close.

## 12.9 What the Material-List view does NOT do

- It does **not** allow creating / deleting assemblies, layers, or segments. Structural edits live in the Assemblies tab.
- It does **not** show segment thickness / width.
- It does **not** allow editing the segment's material — even though the modal shows material data, there's no picker here. (The picker lives in the Segment-Properties modal in the Assemblies tab.)
- It does **not** edit Continuous-Insulation or Steel-Stud Spacing flags.
- It does **not** participate in the Assembly tab's `refreshKey` cache. Switching from Assemblies → Materials forces a fresh `GET /assembly/get-assemblies` and `GET /gcp/get-project-media-urls`.

---

# 13. Cross-cutting concerns / surprising details

## 13.1 `Material.id` is a string

The PK on `assembly_materials` is the AirTable record id (a string like `"recABCDE12345"`), not an auto-incrementing int. Every `Segment.material_id` and every `UpdateSegmentMaterialRequest.material_id` is a string. This is unique to the Materials table — Assembly / Layer / Segment / MaterialPhoto / MaterialDatasheet all use int PKs.

## 13.2 No project-scoped material filter

Apertures have a `ProjectManufacturerFilter` table (per-project visibility for frame and glazing manufacturers) and a corresponding `ManufacturerFilterProvider` in the frontend. **There is no equivalent for Materials.** Every project sees every material in the global table; the Segment-Properties modal's Autocomplete groups them by category but does not filter by project.

## 13.3 Layer / Segment minimums are enforced server-side

Assemblies must have at least one Layer; Layers must have at least one Segment. Backends raise `LastLayerAssemblyException` / `LastSegmentInLayerException`, surfaced as 200-with-detail / 400, respectively (note the inconsistency). The frontend does not pre-check; it relies on the server's exception → an `alert()` informs the user.

## 13.4 Two flip operations are independent

- `flip_assembly_orientation` toggles the enum only; layers are physically untouched.
- `flip_assembly_layers` reverses layer order in the DB (and in the in-memory `layers` collection); orientation enum stays.

A "true mirror" of an assembly requires **both** to be called. The toolbar exposes them as two separate buttons; nothing in the UI calls both atomically. This is a deliberate design choice, but easy to misuse.

## 13.5 Steel-stud equivalent conductivity uses different surface films in two places

- `services/thermal_resistance.py::_calculate_steel_stud_equivalent_conductivity` uses **R_SE=0, R_SI=0** (no surface films) per the live R-value spec.
- `services/to_hbe_material_steel_stud.py::calculate_steel_stud_eq_conductivity` uses **R_SE=0.17, R_SI=0.68** (standard ASHRAE film resistances) when exporting to HBJSON.

The two calculations therefore disagree on the cavity-equivalent conductivity for the same assembly. The exported HBJSON value is what feeds downstream WUFI/PHPP, while the in-app R-value label is the live preview number. **V2 needs to decide whether this divergence is intentional (and document it) or a bug to fix.**

## 13.6 Specification status round-trips through HBJSON

On export, `segment.specification_status` is written into the EnergyMaterial's PH ref properties (`ref_status`). On import, it is read back. So a HBJSON exported from PHN, edited in Rhino, and re-imported preserves spec-status. This is used by the Material-List to show pending design questions across project iterations.

## 13.7 Per-segment photos / datasheets do NOT follow the material

`MaterialPhoto` and `MaterialDatasheet` rows are keyed by `segment_id`, not `material_id`. If a user changes a segment's material, the existing photos/datasheets stay attached to that **segment**, not the old or new material. This is a deliberate contract: site photos document a specific installation slot, not the abstract product. (V2 should consider whether this stays segment-scoped or moves to material-scoped + segment-scoped.)

## 13.8 Materials table can be empty after a fresh deploy

`get_default_material(db)` raises `NoMaterialsException` if the table is empty. `Layer.default(material)` requires a material to construct a Segment. Therefore creating a brand-new Assembly will **fail** until at least one Material has been seeded — the workflow is: deploy → run `/assembly/refresh-db-materials-from-air-table` once → start creating assemblies. There is no automatic seeding at startup.

## 13.9 `purge_unused_materials` is a side-effect of refresh

Refreshing materials from AirTable will silently delete any DB Material that has zero referencing Segments. This is desirable for catalog hygiene but means: if AirTable removes a material that is not yet used in any assembly, the next refresh will prune the local copy.

## 13.10 `synchronize_session="fetch"` everywhere

All bulk delete and bulk-update operations (`delete_assembly`, `delete_layer`, `delete_segment`, the order-shift operations, `purge_unused_materials`) use `synchronize_session="fetch"`. This is required because the bulk operations bypass SQLAlchemy's identity map; without it, in-memory copies would be stale. Important for any V2 backport: the same pattern must be preserved or replaced wholesale.

## 13.11 Multi-row PhDivisionGrid is unsupported

Both import (`get_hb_material_ph_props` raises `NotImplementedError`) and export (`build_ph_division_grid_from_segments` only builds 1-row grids). This means V1 cannot represent vertically-divided heterogeneous layers (e.g. a wainscot strip across part of a wall). All segments are conceptually side-by-side along a single horizontal axis.

## 13.12 No `last_modified` and no Rhino-plugin coupling

Unlike the Aperture tree, Assemblies have no `LastModifiedMixin` or aggregated computed `last_modified` field. There is no Rhino plugin consuming Assembly data with a literal-equality compare. This makes V2 simpler in this dimension — no need to preserve byte-stable timestamp formatting.

## 13.13 Cache strategy is split between TanStack Query and an in-memory `refreshKey`

- **TanStack Query** is the source of truth for `assemblies` and `materials`. Invalidating these triggers a refetch.
- **`refreshKey: number`** in `AssemblyContext` is incremented after every mutating handler. Children (`Assembly.tsx`, `Layer.tsx`, `Segment.tsx`) watch this key in `useEffect` to re-sync their local "in-flight edit" state. This avoids forcing a full query refetch for every keystroke in a thickness modal but adds a bookkeeping burden.
- **`rValueRefreshKey`** is a second counter for the EffectiveRValueLabel only, so layer-thickness edits trigger an R-value recompute without re-rendering the canvas.
- **Material-List does not participate** in either cache — it does its own one-shot `Promise.all` fetch of assemblies + media URLs on mount and mutates `MediaUrlsContext` Maps locally.

## 13.14 Per-segment property updates are individual round-trips

The Segment-Properties modal Save handler issues up to 4 PATCHes (width, material, steel-stud-spacing, continuous-insulation) and the Material-List flows do the same per-property pattern (notes, spec-status). There is **no bulk-update endpoint**. Copy/paste likewise issues 5 PATCHes per paste (one per field). Networking-wise this is chatty but each PATCH is small; the partial-failure caveat (one succeeds, one fails) is real but rare in practice.

## 13.15 Layers / Segments are not lazy-loaded

The `/assembly/get-assemblies/{projectId}` endpoint returns the full tree (all Assemblies, all Layers, all Segments, and the nested Material on each Segment). Even very large projects are eagerly loaded — there is no per-Assembly fetch. This is fine at BLDGTYP scale (low hundreds of segments per project at most) but should be revisited for V2 if project size grows.

## 13.16 The "Materials" tab name is potentially misleading

The tab labeled "Materials" (route `material-layers`) is a per-segment list, not a global material catalog browser. There is **no UI for browsing or editing the global Material catalog in V1**. The only way to add a material is to add it to AirTable and run "Refresh Materials" from the Assemblies tab's overflow menu. V2's catalog manager (PRD §7) is the first first-class catalog UI.

---

# 14. Styling reference (CSS variables and class hooks)

## 14.1 CSS files (loaded globally for the entire envelope subtree)

Imported once in `EnvelopeDataDashboard.tsx`:
- `_styles/Assembly.css` — `.assembly-layer-thickness:hover`, `.assembly-orientation-text`.
- `_styles/Layer.css` — `.assembly-layer`, `.assembly-layer-thickness`, `.add-layer-button` (15 px circle, `#b2087c` Passivhaus magenta).
- `_styles/Segment.css` — `.assembly-layer-segments`, `.assembly-layer-segment`, `.layer-segment-svg:hover rect` (uses CSS vars), `.layer-segment-rect`, `.create-new-segment-button` (20 px circle, `#b2087c`).

Loaded once in `material_list/Page.tsx`:
- `_styles/Specification.css` — the four `have-specification-{complete|missing|question|na}` classes.
- `_styles/MaterialsList.css` — `.assembly-material-list-container`, `.assembly-title`, `.material-row`, `.row-item`, `.specification-dropdown`, `.thumbnail-container` (and `-disabled` variant), `.thumbnail`, `.full-image-modal`.

## 14.2 CSS variables consumed (theme palette)

Defined in the global theme; the envelope styles reference:
- `--text-highlight-color`, `--highlight-light-color`, `--text-secondary-color` — generic text hover/secondary.
- `--construction-layer-segment-rect-fill`, `--construction-layer-segment-rect-stroke` — default segment SVG rect appearance.
- `--construction-layer-segment-hover-fill`, `--construction-layer-segment-hover-stroke` — segment hover appearance.
- `--complete`, `--missing-strong`, `--missing-weak`, `--question`, `--question-stroke` — specification-status palette.
- `--appbar-bg-color` — used both as the row-hover background and as the spec-status `na` background.

## 14.3 Visual constants

- Add-Layer button: 15 px circle, font-weight 800, `#b2087c` magenta.
- Add-Segment button: 20 px circle, font-weight 800, `#b2087c` magenta.
- Sidebar: 260 px when open, transition `0.2s ease-in-out`, default closed.
- Hover-reveal opacity transition: `0.15s ease-in-out`.
- Paste pulse: `@keyframes pastePulse` 600 ms, yellow box-shadow at 0.6 opacity → 0.

---

# 15. Tests

The Window-Builder has `__tests__/Sidebar.test.tsx` plus inline tests. The Assembly-Builder has **no** dedicated test files in `assemblies/` or `material_list/`. There are no unit / integration tests for:
- Assembly / Layer / Segment ordering preservation.
- Copy/paste payload integrity or undo correctness.
- Thermal-resistance calculation values (golden-file or otherwise).
- HBJSON import/export round-tripping.

V2 should plan for first-class tests in each of these areas (the V2 PRD §10 already treats schemas + golden files as a deliverable; the same discipline can extend to thermal-resistance fixtures).

---

# 16. File inventory (for cross-reference when porting)

## 16.1 Backend

| Path | Role |
|---|---|
| `db_entities/assembly/assembly.py` | Assembly ORM, AssemblyOrientation enum |
| `db_entities/assembly/layer.py` | Layer ORM |
| `db_entities/assembly/segment.py` | Segment ORM, SpecificationStatus enum |
| `db_entities/assembly/material.py` | Material ORM, ARGB parsing |
| `db_entities/assembly/material_photo.py` | MaterialPhoto ORM |
| `db_entities/assembly/material_datasheet.py` | MaterialDatasheet ORM |
| `features/assembly/schemas/assembly.py` | AssemblySchema, UpdateAssemblyNameRequest |
| `features/assembly/schemas/layer.py` | LayerSchema, CreateLayerRequest, UpdateLayerHeightRequest |
| `features/assembly/schemas/segment.py` | SegmentSchema + every Update* request |
| `features/assembly/schemas/material.py` | AirTableMaterialSchema, MaterialSchema |
| `features/assembly/schemas/material_photo.py` | MaterialPhotoSchema |
| `features/assembly/schemas/material_datasheet.py` | MaterialDatasheetSchema |
| `features/assembly/schemas/thermal_resistance.py` | ThermalResistanceSchema |
| `features/assembly/routes/assembly.py` | All assembly-level endpoints |
| `features/assembly/routes/layer.py` | All layer endpoints |
| `features/assembly/routes/segment.py` | All segment endpoints |
| `features/assembly/routes/material.py` | Material refresh + load endpoints |
| `features/assembly/services/assembly.py` | Assembly CRUD + flip + duplicate |
| `features/assembly/services/layer.py` | Layer CRUD + duplicate |
| `features/assembly/services/segment.py` | Segment CRUD + duplicate |
| `features/assembly/services/material.py` | Material CRUD + AirTable upsert + purge |
| `features/assembly/services/thermal_resistance.py` | R-value calculation (PH-average ASHRAE methods, steel-stud handling) |
| `features/assembly/services/assembly_from_hbjson.py` | HBJSON import |
| `features/assembly/services/to_hbe_construction.py` | HBJSON export top-level |
| `features/assembly/services/to_hbe_material_typical.py` | Typical layer → EnergyMaterial conversion (incl. hybrid divisions) |
| `features/assembly/services/to_hbe_material_steel_stud.py` | Steel-stud assembly → EnergyMaterial conversion (with surface films) |
| `features/air_table/services.py` | AirTable API access (used by material refresh) |
| `features/gcp/...` | Per-segment photo/datasheet upload + delete + project-media listing |

## 16.2 Frontend

| Path | Role |
|---|---|
| `features/project_view/data_views/envelope/EnvelopeDataDashboard.tsx` | Envelope tab bar; mounts `MaterialsProvider` |
| `features/project_view/data_views/envelope/_assets/` | `constructions.svg`, `material.svg` |
| `features/project_view/data_views/envelope/_contexts/MaterialsContext.tsx` | Global materials provider |
| `features/project_view/data_views/envelope/_contexts/MaterialsContext.Utility.tsx` | localStorage cache for materials |
| `features/project_view/data_views/envelope/_contexts/MediaUrlsContext.tsx` | Per-segment media Maps for the Material-List page |
| `features/project_view/data_views/envelope/_hooks/useMaterialsQuery.ts` | TanStack query for materials |
| `features/project_view/data_views/envelope/_styles/{Assembly,Layer,Segment,MaterialsList,Specification}.css` | All envelope-wide CSS |
| `features/project_view/data_views/envelope/_types/{Assembly,Layer,Segment,Material,Material.Photo,Material.SitePhoto,Material.Datasheet,Material.Layers}.tsx` | TS types mirroring the backend Pydantic schemas |
| `features/project_view/data_views/envelope/assemblies/_hooks/useAssembliesQuery.ts` | Assemblies query |
| `features/project_view/data_views/envelope/assemblies/_hooks/useAssemblyMutations.ts` | All Assembly-level mutations |
| `features/project_view/data_views/envelope/assemblies/_Page/Page.tsx` | AssembliesPage shell + provider stack |
| `features/project_view/data_views/envelope/assemblies/_Page/AssemblySelector.tsx` | Header Autocomplete for active assembly |
| `features/project_view/data_views/envelope/assemblies/_Page/EffectiveRValueLabel.tsx` | R/U-value header label |
| `features/project_view/data_views/envelope/assemblies/_Page/HeaderButtons.tsx` | Header button container |
| `features/project_view/data_views/envelope/assemblies/_Page/TotalThicknessLabel.tsx` | Total-thickness header label |
| `features/project_view/data_views/envelope/assemblies/_Page/useAssemblyHeaderButtons.tsx` | Refresh / Upload / Download overflow menu |
| `features/project_view/data_views/envelope/assemblies/Assembly/Assembly.Context.tsx` | AssemblyProvider |
| `features/project_view/data_views/envelope/assemblies/Assembly/Assembly.tsx` | Canvas container (orientation labels + layer stack + legend) |
| `features/project_view/data_views/envelope/assemblies/Assembly/AssemblyLegend.tsx` | Below-canvas material legend |
| `features/project_view/data_views/envelope/assemblies/Assembly/AssemblyToolbar.tsx` | Flip / Copy-Paste / Undo toolbar |
| `features/project_view/data_views/envelope/assemblies/Assembly/CopyPaste.Context.tsx` | Copy/paste state machine + undo stack |
| `features/project_view/data_views/envelope/assemblies/Assembly/Sidebar/Sidebar.Context.tsx` | Sidebar provider (open/close + name modal) |
| `features/project_view/data_views/envelope/assemblies/Assembly/Sidebar/Sidebar.tsx` | Sidebar shell |
| `features/project_view/data_views/envelope/assemblies/Assembly/Sidebar/Sidebar.ListHeader.tsx` | "+ Add New Assembly" header |
| `features/project_view/data_views/envelope/assemblies/Assembly/Sidebar/Sidebar.ListItemContent.tsx` | Per-row hover-reveal actions |
| `features/project_view/data_views/envelope/assemblies/Layer/Layer.tsx` | Layer renderer (thickness column + segments row) |
| `features/project_view/data_views/envelope/assemblies/Layer/Layer.Hooks.tsx` | useLayerHooks (thickness state + add-segment defaults) |
| `features/project_view/data_views/envelope/assemblies/Segment/Segment.tsx` | Segment renderer (SVG rect + add-segment buttons + paste-pulse) |
| `features/project_view/data_views/envelope/assemblies/Segment/Segment.Hooks.tsx` | useLayerSegmentHooks (width state + steel-stud default) |
| `features/project_view/data_views/envelope/assemblies/ChangeNameModal/Modal.ChangeName.tsx` | Rename Assembly modal |
| `features/project_view/data_views/envelope/assemblies/LayerHeightModal/LayerHeight.tsx` | Edit Layer thickness modal (incl. Delete Layer) |
| `features/project_view/data_views/envelope/assemblies/LayerHeightModal/LayerHeight.Types.ts` | Modal types |
| `features/project_view/data_views/envelope/assemblies/SegmentPropertiesModal/LayerSegmentProperties.tsx` | Edit Segment properties modal (incl. Delete Segment) |
| `features/project_view/data_views/envelope/assemblies/SegmentPropertiesModal/LayerSegmentProperties.Types.ts` | Modal types |
| `features/project_view/data_views/envelope/material_list/Page.tsx` | Material-List page shell + parallel data fetch |
| `features/project_view/data_views/envelope/material_list/ListItem.tsx` | Per-segment row |
| `features/project_view/data_views/envelope/material_list/ListItem.Hooks.tsx` | Per-row state + handlers |
| `features/project_view/data_views/envelope/material_list/DesignSpecificationStatus.tsx` | Spec-status `<Select>` |
| `features/project_view/data_views/envelope/material_list/Segment.Datasheets.tsx` | Datasheet container + drag-and-drop |
| `features/project_view/data_views/envelope/material_list/Segment.SitePhotos.tsx` | Site-photo container + drag-and-drop |
| `features/project_view/data_views/envelope/material_list/LazyThumbnail.tsx` | Skeleton/loaded/error thumbnail |
| `features/project_view/data_views/envelope/material_list/Image.FullViewModal.tsx` | Full-image modal (also handles PDFs) |
| `features/project_view/data_views/envelope/material_list/PDFViewer.tsx` | iframe-based PDF viewer |
| `features/project_view/data_views/envelope/material_list/Details.Modal.tsx` | Per-segment notes + read-only material-data modal |
| `features/project_view/data_views/envelope/material_list/Details.Modal.Types.tsx` | Modal types |

---

# 17. Quick reference: what V2 must preserve (no-regression checklist)

1. **Per-Assembly canvas** with layers stacked top-to-bottom (mm-to-px), each layer holding side-by-side segments rendered as colored SVG rects from the material's ARGB.
2. **Sidebar** with natural-sort, hover-reveal Edit-Name / Duplicate / Delete on each row, "+ Add New Assembly" button at the top, default-collapsed.
3. **Header**: Total-Thickness label, Effective R-Value/U-Value label (with the IP/SI-aware display), overflow menu for Refresh-Materials / Upload-Constructions / Download-Constructions, and the AssemblyToolbar with Flip-Orientation, Flip-Layers, Copy/Paste-Material, and Undo-Last-Paste.
4. **Three modals**: Change Name, Edit Layer Height (with embedded Delete Layer), Edit Segment Properties (Material picker grouped by category, read-only material-data block, Width, Continuous-Insulation, Steel-Stud + spacing — with embedded Delete Segment).
5. **Add-Layer-Above / Below** and **Add-Segment-Left / Right** hover buttons on every layer / segment (logged-in only).
6. **Copy/Paste material** with the 5-field payload (material, steel-stud spacing, CI, spec-status, notes), 600 ms paste-pulse, capped 20-step undo, ESC-to-exit, click-outside-to-exit, auto-clear on assembly change.
7. **Orientation enum + flip operations** as two distinct buttons (and the equivalent backend separation).
8. **HBJSON import + export** preserving `ph_nav` external-id round-trip, division grids for hybrid layers, the steel-stud equivalent-conductivity material structure, and `specification_status` round-trip.
9. **Effective R-Value calculation**: PH average of Parallel-Path + Isothermal-Planes per ASHRAE CH27, steel-stud equivalent-conductivity via AISI S250-21, surface films excluded from the live label (decide explicitly whether to keep or harmonize the divergence with the HBJSON-export's film inclusion — see §13.5).
10. **Material-List per-segment view** with: name + notes-tooltip + bubble-icon, spec-status `<Select>` with the 4-color palette, drag-and-drop datasheet uploader, drag-and-drop site-photo uploader, full-image modal with delete (handles both images and PDFs via iframe), per-segment notes editor in DetailsModal.
11. **Visibility rule**: rows with `specification_status === 'na'` are hidden from unauthenticated viewers but visible to logged-in editors.
12. **Per-segment media segment-scoping** (do not move photos/datasheets when the material changes).
13. **Material catalog** is global, AirTable-sourced, refreshable on demand from the Assemblies tab; no per-project filter.
14. **Server-side enforcement** that an Assembly always has ≥ 1 Layer and a Layer always has ≥ 1 Segment.
15. **Specification status** persists into HBJSON ref properties.

Items where V2 should explicitly decide whether to preserve, change, or document the divergence:
- §13.5 surface-film inconsistency between live R-value and HBJSON export.
- §13.7 segment-scoped vs material-scoped photos / datasheets.
- §13.8 hard failure when Material table is empty.
- §13.9 silent material purge as a side-effect of refresh.
- §13.11 single-row PhDivisionGrid limitation (no vertical division of a layer).
- §13.16 the "Materials" tab name vs. its actual per-segment-list role; V2's first-class catalog manager (PRD §7) supersedes this for global browsing.
