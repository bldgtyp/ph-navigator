---
DATE: 2026-05-10
TIME: -
STATUS: REFERENCE — V1 3D-Model-Viewer feature/behavior catalog. Source
        for V2 planning of the React Three Fiber rewrite (PRD §11.4).
        Not a spec; not normative.
AUTHOR: Claude (from V1 source)
SCOPE: Detailed enumeration of every backend route, schema, service,
       loader, scene-group, viz-state, tool-state, color-by mode,
       event handler, UI surface, and interaction in PH-Navigator
       V1's 3D Model Viewer (the HBJSON-driven Three.js scene under
       `frontend/.../model_viewer/` and its
       `backend/features/hb_model/` server).
RELATED: context/PRD.md (V2 architecture PRD —
         §11.4 covers the R3F rewrite, §10.5 covers HBJSON file
         storage),
         research/v1-assembly-builder-reference.md (sibling V1
         reference, same template),
         research/v1-window-builder-reference.md (sibling V1
         reference, same template),
         context/USER_STORIES.md (V2 user stories — US-Viewer to be
         expanded with this reference in hand)
SOURCE: backend/features/hb_model/**,
        frontend/src/features/project_view/model_viewer/**,
        frontend/src/api/get3DModelData.ts,
        frontend/src/api/getAvailableModels.ts
---

# 1. Domain glossary as used in V1

- **HBJSON** — Honeybee JSON, the serialized form of a Honeybee `Model` (rooms, faces, apertures, shades, plus extension properties for energy + Passive House). V1 stores HBJSON files in AirTable (one record per model revision); V2 will store them in R2 with a metadata row per file (PRD §11.4.2). The viewer's geometry is **HBJSON-derived**, not derived from the project document. This deliberate disconnect is preserved into V2 v1 (PRD §11.4.6).
- **HB-Model / Honeybee Model** — the deserialized Python object (`honeybee.model.Model`) the backend builds from the HBJSON file before extracting per-feature DTOs.
- **Face** — a Honeybee opaque surface (Wall, RoofCeiling, Floor, AirBoundary). Carries an energy-construction (with U/R factors), apertures, boundary condition, and a triangulated mesh. AirBoundaries are silently skipped by the backend extractor when their construction can't be validated as opaque.
- **Aperture** — a Honeybee window living on a Face. Carries its own mesh, geometry area, and window construction (U-factor). R-factor is **not** surfaced in the V1 info panel for apertures.
- **Boundary condition** — a Honeybee enum on each Face: `Outdoors | Ground | Adiabatic | Surface`. In V1 the value may arrive as either a string or an object with a `.type` field; both shapes are handled in `applyColorByBoundary`.
- **Construction** — the energy-properties construction object on a Face/Aperture. Identified by `identifier` (a string id used for color-by-construction grouping). Carries `u_factor` and (for opaque) `r_factor`.
- **Space (`honeybee_ph` PH-Space)** — a Passive-House-qualified interior volume living under `Room.properties.ph.spaces[]`. Each Space has `name`, `number`, `quantity`, `wufi_type`, `floor_area`, `weighted_floor_area` (the PH TFA — gross area × weighting factor), `net_volume`, `avg_clear_height`, `average_floor_weighting_factor`, and `properties.ph._v_sup / _v_eta / _v_tran` (supply / extract / transfer airflow). Note: the backend pulls airflow values via `space.to_dict()` in **m³/s** and multiplies by 3600 to expose **m³/h** to the client — this conversion is done **before** Pydantic so FastAPI's response-serialization revalidation does not double-multiply.
- **Volume / Floor / FloorSegment** — sub-structures of a Space. A Space has `volumes[]`; each volume has a `floor` whose `floor_segments[]` carry per-segment `weighting_factor`, `floor_area`, `weighted_floor_area`, plus airflow values. Floor segments are the unit colored by the **Floor Weighting Factor** color-by mode and what's selected in the **Interior Floors** viz state.
- **Shade** — a Honeybee `Shade` object (exterior overhangs, fins, neighbor masses, trees). The backend groups shades by `display_name` and merges each group into a single joined Mesh3D before sending to the client. Joining uses a tolerance-aware vertex-equality check (`Point3D.is_equivalent`, tol=1e-7) so co-located vertices from different source shades collapse to one. Shades are visible only in the **Site / Sun-Path** viz state in V1.
- **Sun path / Compass** — a Ladybug visualization comprising hourly analemma polylines (one per hour-of-day), monthly day-arcs (one per month), boundary circles, major + minor azimuth ticks. Generated from the project's EPW file (location lat/long), **scaled by 0.4** with radius = 100 × scale = 40 model units. North = 0°. Daylight savings is off.
- **Ventilation system / Duct element / Duct segment** — `honeybee_phhvac.PhVentilationSystem` carries `supply_ducting[]` and `exhaust_ducting[]` as lists of `PhHvacDuctElement`s. Each element holds a `dict[str, DuctSegment]` keyed by segment id; each segment has a `LineSegment3D` centerline plus `diameter` and `insulation_thickness`. V1 collapses systems by `display_name` so duplicates across rooms appear once.
- **Hot-water system / Trunk / Branch / Fixture / Pipe segment** — `honeybee_phhvac.PhHotWaterSystem` has `distribution_piping` (trunks) and `recirc_piping`. The distribution tree is **4-level**: System → Trunk → Branch → Fixture → Segment. Recirculation piping is a parallel **flat** list of pipe segments (no trunk/branch/fixture nesting). Each pipe segment has a `LineSegment3D` centerline plus diameter, insulation properties, water temp, daily-period, length, material.
- **Selectable / Hover / Selected** — Three concepts that are easy to confuse. **Selectable** = the geometry group currently registered for raycasting (added to `world.selectableObjects`). **Hover** = the object the pointer is currently over (drives the hover-outline highlight + tooltip). **Selected** = the object the user clicked, persisted in `SelectedObjectContext` and shown in the right-hand info panel.
- **VizState** — a high-level "what's being shown" mode (Geometry, SpaceFloors, Spaces, SunPath, Ventilation, HotWaterPiping, ColorBy). Exactly one active at a time. State change triggers a **dismount handler** on the old state (cleanup) and a **mount handler** on the new state (geometry visibility, selectable-objects swap, etc.).
- **ToolState** — a high-level "what does clicking do" mode (None, Select, Measure, Comments). Exactly one active at a time. State change attaches/detaches DOM-level `click` and `pointermove` listeners.
- **ColorBy** — a sub-mode of the VizState machine; when active, meshes get a flat `MeshBasicMaterial` (lighting-independent) keyed by an attribute (FaceType, Boundary, OpaqueConstruction, ApertureConstruction, VentilationAirflow, FloorWeightingFactor). Originals are stashed in `userData['colorByOriginalMaterial']` for restoration on exit.
- **Dynamic legend** — the legend panel's items, populated either from a static color-map (FaceType, Boundary, Ventilation, Weighting) or from a Map<string, ColorDefinition> built at runtime by hashing construction names (OpaqueConstruction, ApertureConstruction). The dynamic-vs-static distinction matters because construction-name color-maps are project-specific and unknown ahead of time.
- **Dimension line** — a measurement-mode artifact: two clicked vertices + a CSS2D-rendered distance label, all added to `dimensionLinesRef` which is a sibling of every other scene group. Cleared when the user exits Measure tool.
- **userData** — Three.js's per-Object3D bag of metadata. V1 leans heavily on this: every loaded geometry stashes the source HBJSON DTO (or relevant fields) in `mesh.userData` so the info panel can pull values without re-querying the backend, and so color-by handlers can read the attribute that determines the mesh's color.

---

# 2. Backend (`backend/features/hb_model/`)

## 2.1 Routes (`routes.py`)

All endpoints live under the prefix `/hb_model/{bt_number}/` and the tag `honeybee_model`. All but one are rate-limited via the global `slowapi` `limiter`. `bt_number` is the BLDGTYP project number (a string in V1, looked up against AirTable). The router does not enforce auth at this layer — auth is global middleware in the V1 backend.

| Method | Path | Rate | Response model | Purpose |
|---|---|---|---|---|
| GET | `/models` | 10/min | `list[HBModelMetadataSchema]` | List all HBJSON revisions for a project, sorted newest first. |
| GET | `/faces` | 5/min | `list[FaceSchema]` | All opaque faces (with apertures embedded) + each face's `OpaqueConstruction` (u/r factors). |
| GET | `/spaces` | 5/min | `list[SpaceSchema]` | All PH-Spaces with volumes + floor segments + ventilation. |
| GET | `/sun_path` | — | `SunPathAndCompassDTOSchema` | Hourly analemma + monthly arcs + compass geometry, generated from the project's EPW. **Not** rate-limited in V1. |
| GET | `/hot_water_systems` | 5/min | `list[PhHotWaterSystemSchema]` | All PH-HVAC hot-water systems, distribution + recirculation. |
| GET | `/ventilation_systems` | 5/min | `list[PhVentilationSystemSchema]` | All PH-HVAC ventilation (ERV/HRV) systems with supply + exhaust ducts. |
| GET | `/shading_elements` | 5/min | `list[ShadeGroupSchema]` | Exterior shades, grouped by display-name and merged into one mesh per group. |
| GET | `/model_data` | 5/min | `CombinedModelDataSchema` | **Bulk endpoint** — same six payloads in one response, loading the HB-Model exactly once. Sun-path failure is non-fatal (logged + null). |

Query params on every model-fetching route:
- `record_id: str | None` — pick a specific HBJSON revision. `None` = latest (most recent by date).
- `force_refresh: bool = False` — bypass the in-memory model cache and re-download from AirTable.

The frontend uses **only** `/model_data` (one call per model load) plus `/models` (for the version dropdown). The six single-feature routes exist but are dormant.

## 2.2 Model cache (`cache.py`)

Two small classes:

- `CacheRecordWithTime[T]` — wraps a value with a timestamp; `is_expired` ≡ now − ts > 3600 s (1 hour).
- `LimitedCache[T]` — subclass of `OrderedDict`, max 10 items by default, oldest-evicted-on-insert (`popitem(last=False)`). Reads delete expired records lazily on access and return `None`.

The cache is used by `services/hb_model.py` to memoize the deserialized `honeybee.model.Model` keyed by `bt_number + record_id`, and by `services/epw.py` to memoize the parsed `ladybug.epw.EPW` keyed by `bt_number`. The cache is **process-local** (no Redis), so it does not survive backend restarts and is not shared across worker processes if the server is run multi-worker.

## 2.3 Services

### 2.3.1 `services/hb_model.py`

- `list_available_models(db, bt_number) -> list[HBModelMetadataSchema]` — Queries AirTable for the project's HBJSON attachment records, returns `[{record_id, date}, …]` sorted by date descending.
- `find_hbjson_file_url(db, bt_number) -> str` — Looks up the AirTable record + builds the AirTable file-download URL.
- `load_hb_model(db, bt_number, record_id, force_refresh) -> Model` — The expensive path: download HBJSON → `Model.from_dict()` → cache. With `record_id=None` it picks the most recent. With `force_refresh=True` it skips the cache and writes a fresh entry.

### 2.3.2 `services/epw.py`

- `find_epw_file_url(db, bt_number) -> str` — Lookup the EPW attachment URL in AirTable.
- `load_epw_object(db, bt_number) -> EPW` — Download + parse + cache the Ladybug EPW. Used only by the sun-path extractor.

### 2.3.3 `services/model_elements.py`

This is the model-to-DTO bridge. Six functions, one per route + a couple of helpers:

- `get_faces_from_model(hb_model)` — Iterate `hb_model.faces`. For each face:
  1. Read `face.properties.energy.construction`; if Pydantic validation of the construction fails (e.g. AirBoundary with no opaque material), **log a warning and skip the face entirely**. This is the dropout point for AirBoundaries.
  2. Build a `FaceSchema` from `face.to_dict()`.
  3. Replace `face.geometry.mesh` with the **triangulated** Mesh3D from `face.punched_geometry` (apertures punched out).
  4. Overwrite `face.geometry.area` with the punched area.
  5. Attach `u_factor` and `r_factor` (defaulting to 0.0 if missing).
  6. For each aperture: triangulated mesh, area, window-construction with u/r factors. Returns one DTO per aperture, embedded in the parent `face.apertures`.
- `get_spaces_from_model(hb_model)` — Iterate `hb_model.rooms` → `room.properties.ph.spaces`. For each Space:
  1. `space.to_dict(include_mesh=True)` produces the full DTO dict.
  2. **In-place** multiply `_v_sup`, `_v_eta`, `_v_tran` by 3600 (m³/s → m³/h) **before** building the Pydantic model. The comment explicitly says this must happen pre-Pydantic because FastAPI re-validates on response serialization, which would double-multiply if done in a validator.
  3. Attach computed properties: `net_volume`, `floor_area`, `weighted_floor_area`, `avg_clear_height`, `average_floor_weighting_factor`.
- `get_sun_path_from_model(epw)` — Build a Ladybug `Sunpath.from_location(...)` + `Compass(radius=40, center=(0,0), north=0)`. Scale 0.4. Output: hourly analemmas + monthly arcs + boundary circles + major/minor azimuth ticks, all converted to schema DTOs.
- `get_hot_water_systems_from_model(hb_model)` — De-dupe systems by `display_name` across rooms, then `system.to_dict(_include_properties=True)` into `PhHotWaterSystemSchema`.
- `get_ventilation_systems_from_model(hb_model)` — Same dedupe-by-display-name pattern, into `PhVentilationSystemSchema`.
- `get_shading_elements_from_model(hb_model)` — Group `hb_model.shades` by `display_name`. For each group, walk every triangulated-mesh-face's vertex tuples through `interpret_input_from_face_vertices` (custom vertex-merging using `Point3D.is_equivalent` with tol = 1e-7) and emit a single joined `Mesh3D`. Returns `list[ShadeGroupSchema]` with one DTO per group.

Internal helpers:
- `any_dict(d)` — A type-launder that hands an untyped LBT `to_dict()` to a Pydantic ctor without mypy complaints.
- `find_vertix_index(vertix_list, vertix)` — Tolerance-aware index lookup for vertex merging in shades.

## 2.4 Schemas (`schemas/`)

Pydantic models, organized by upstream library. Used for FastAPI response validation, but **also** mirror the JSON shape consumed verbatim by the frontend (the TypeScript types in `frontend/.../model_viewer/types/` are a manual mirror).

### 2.4.1 Top-level / metadata

- `schemas/combined_model_data.py` → `CombinedModelDataSchema { faces, spaces, sun_path, hot_water_systems, ventilation_systems, shading_elements }`. `sun_path` is `Optional` because the EPW load is allowed to fail without poisoning the rest of the model.
- `schemas/model_metadata.py` → `HBModelMetadataSchema { record_id: str, date: date }`.

### 2.4.2 Honeybee (`schemas/honeybee/`)

- `face.py` → `FaceSchema { identifier, display_name, face_type, boundary_condition, geometry: Face3DSchema, apertures: list[ApertureSchema], properties: HBFaceProperties }`. Geometry has its `mesh` (Mesh3DSchema) and `area` patched-in by the service.
- `aperture.py` → `ApertureSchema { identifier, display_name, boundary_condition, geometry, properties: HBApertureProperties }`. Same mesh/area patch as Face.
- `shade.py` → `ShadeGroupSchema { shades: list[ShadeSchema] }`, `ShadeSchema { identifier, display_name, geometry: Face3DSchema }`. The group contains exactly one merged-mesh `ShadeSchema` after backend joining.
- `boundarycondition.py` → boundary type definitions.
- `properties.py` → top-level `properties` shape on Face/Aperture.

### 2.4.3 Honeybee-Energy (`schemas/honeybee_energy/`)

- `construction/opaque.py` → `OpaqueConstructionSchema { identifier, type, u_factor, r_factor, … }`.
- `construction/window.py` → `WindowConstructionSchema { identifier, type, u_factor, … }`.
- `material/opaque.py` → opaque material model (rarely surfaced to the viewer in V1 — info panel shows the construction id, not its constituent materials).
- `properties/aperture.py`, `properties/face.py` → energy property extensions.

### 2.4.4 Honeybee-PH (`schemas/honeybee_ph/`)

- `space.py` → `SpaceSchema { identifier, name, number, quantity, wufi_type, floor_area, weighted_floor_area, net_volume, avg_clear_height, average_floor_weighting_factor, volumes: list[VolumeSchema], properties: SpaceProperties }`. `VolumeSchema { floor: FloorSchema, geometry: list[Face3DSchema] }` and `FloorSchema` carries the per-segment data needed for floor-weighting visualization.
- `properties/space.py` → `properties.ph` extension with `_v_sup`, `_v_eta`, `_v_tran` (m³/h after backend conversion).

### 2.4.5 Honeybee-PH-HVAC (`schemas/honeybee_phhvac/`)

- `ventilation.py` → `PhVentilationSystemSchema { identifier, display_name, supply_ducting, exhaust_ducting }` and `PhHvacDuctElementSchema { identifier, display_name, duct_type, segments: dict[str, DuctSegmentSchema] }` and `DuctSegmentSchema { geometry: LineSegment3DSchema, diameter, insulation_thickness }`.
- `hot_water_system.py` → `PhHotWaterSystemSchema { distribution_piping, recirc_piping, … }`, `PipeTrunkSchema`, `BranchSchema`, `FixtureSchema`. Each level keyed by string id in a dict.
- `hot_water_piping.py` → `PipeSegmentSchema { geometry, diameter_value, insulation_thickness, insulation_conductivity, insulation_reflective, insulation_quality, daily_period, water_temp, material_value, length }`.

### 2.4.6 Ladybug + Ladybug-Geometry (`schemas/ladybug/`, `schemas/ladybug_geometry/`)

- `ladybug/sunpath.py` → `SunPathSchema { hourly_analemma_polyline3d: list[Polyline3D], monthly_day_arc3d: list[Arc3D] }`, `SunPathAndCompassDTOSchema { sunpath, compass }`.
- `ladybug/compass.py` → `CompassSchema { all_boundary_circles: list[Arc2D], major_azimuth_ticks: list[LineSegment2D], minor_azimuth_ticks: list[LineSegment2D] }`.
- `ladybug_geometry/geometry3d/` → `Mesh3DSchema`, `Face3D`, `LineSegment3D`, `Polyline3D`, `Arc3D`, `Plane`.
- `ladybug_geometry/geometry2d/` → `Arc2D`, `LineSegment2D` (used only by the compass).

The Mesh3D schema carries vertices, faces (index triples for triangles), and optional normals. Faces with mixed quads + triangles arrive triangulated from the backend (we don't ship quads to the viewer).

---

# 3. Frontend file map

```
frontend/src/features/project_view/model_viewer/
├── Viewer.tsx                         entry component; provider stack
├── World.tsx                          THREE.js boot + viz-state/tool-state effect plumbing
├── Model.tsx                          fetches /model_data + dispatches into loaders
├── _components/
│   ├── BottomMenubar.tsx              wraps ToolStateMenubar + VizStateMenubar
│   ├── VizStateMenubar.tsx            top icon row: Geometry / Floors / Spaces / Site / Ducts / Pipes / ColorBy ▾
│   ├── ToolStateMenubar.tsx           bottom icon row: Select / Measure / Comments
│   ├── ModelSelector.tsx + .css       version dropdown (which HBJSON revision to load)
│   ├── ColorByLegend/                 legend panel for color-by modes
│   │   ├── ColorByLegend.tsx
│   │   └── ColorByLegend.css
│   └── ElementInfoPanel/              right sidebar: selected-object metadata
│       ├── ElementInfoPanel.tsx
│       ├── ElementInfoPanel.css
│       ├── InfoField.tsx              one row in the panel (label + value + tooltip)
│       └── fieldConfigs.ts            per-object-type field declarations
├── _constants/
│   └── colorByColors.ts               static color maps + cyrb53/golden-ratio hash for dynamic colors
├── _contexts/
│   ├── app_viz_state_context.tsx      AppVizStateContext (useReducer over vizStates[])
│   ├── app_tool_state_context.tsx     AppToolStateContext (useReducer over toolStates[])
│   ├── color_by_context.tsx           ColorByContext (attribute + dynamic legend items)
│   ├── selected_object_context.tsx    SelectedObjectContext (state + ref pair)
│   ├── hover_object_context.tsx       HoverObjectContext (state + ref pair)
│   └── selected_model_context.tsx     SelectedModelContext (model list + selected id + forceRefresh)
├── _handlers/
│   ├── selectMesh.tsx                 raycaster: getSelectedMeshFromMouseClick / getMeshFromMouseOver
│   ├── selectObject.tsx               handleOnClick / handleOnMouseOver / clearSelection
│   ├── selectPoint.tsx                selectPoint (snap pointer to nearest face vertex)
│   ├── selectFaceVertex.tsx           face-vertex picking utility
│   ├── selectLineSegment2.tsx         raycasting against thick-line pipes/ducts
│   ├── modeMeasurement.tsx            measure-mode mouse handlers + dimension-line builder
│   ├── modeColorBy.tsx                applyColorByMode + restore helpers
│   ├── modePipes.tsx                  pipe-segment hover/select highlight handlers
│   └── onResize.tsx                   window-resize handler (camera aspect + renderer + composer + labels)
├── loaders/
│   ├── load_faces.tsx                 opaque faces + apertures → buildingGeometryMeshes/Outlines/Vertices
│   ├── load_spaces.tsx                volumes → spaceGeometryMeshes/Outlines/Vertices (initially hidden)
│   ├── load_space_floors.tsx          floor segments → spaceFloorGeometry* (initially hidden)
│   ├── load_sun_path.tsx              analemmas + arcs + compass → sunPathDiagram (initially hidden)
│   ├── load_erv_ducting.tsx           supply + exhaust ducts → ventilationGeometry (initially hidden)
│   ├── load_hot_water_piping.tsx      trunk/branch/fixture/segment + recirc → pipeGeometry (initially hidden)
│   └── load_shades.tsx                shade groups (merged) → shadingGeometryMeshes/Wireframe (initially hidden)
├── scene_setup/
│   ├── SceneSetup.tsx                 the persistent THREE world (camera, renderer, composer, controls, all groups)
│   ├── Materials.tsx                  appMaterials registry (standard, window, shading, lines, etc.)
│   └── Lighting.tsx                   defaultLightConfiguration (intensity, color, shadow flag)
├── states/
│   ├── VizState.ts                    enum + class + vizStates dict + add*Handler helpers
│   └── ToolState.ts                   enum + class + toolStates dict + add*Handler helpers
├── styles/
│   ├── VizStateMenubar.css
│   ├── ToolStateMenubar.css
│   ├── DimensionLines.css
│   └── styled_components/
│       └── LightTooltip.tsx
├── to_three_geometry/
│   ├── honeybee/face.tsx              convertHBFaceToMesh(face) → { mesh, wireframe, vertexHelper, vertices }
│   └── ladybug_geometry/
│       ├── geometry3d/face.tsx        convertLBTFace3DToMesh
│       ├── geometry3d/line.tsx        convertLBTLineSegment3DtoLine
│       ├── geometry3d/polyline.tsx    convertLBTPolyline3DtoLine
│       ├── geometry3d/arc.tsx         convertLBTArc3DtoLine
│       ├── geometry2d/arc.tsx         convertLBTArc2DtoLine
│       └── geometry2d/line.tsx        convertLBTLineSegment2DtoLine
├── types/                             TS mirror of backend Pydantic schemas
│   ├── model_metadata.ts
│   ├── honeybee/{face,aperture,shade,properties,boundarycondition}.tsx
│   ├── honeybee_energy/properties/aperture.tsx
│   ├── honeybee_ph/space.tsx + properties/space.tsx
│   ├── honeybee_phhvac/{ventilation,ducting,hot_water_system,hot_water_piping}.tsx
│   ├── ladybug/sunpath.tsx
│   └── ladybug_geometry/{geometry3d,geometry2d}/*
└── icons/                             SVG icons used by the menubars
    ├── Geometry.svg / Space.svg / FloorSegments.svg / SunPath.svg / Ducts.svg / Piping.svg / ColorBy.svg
    ├── Surface.svg / Ruler.svg / Note.svg            (tool-state icons)
    └── navigator.svg                                  (app logo)
```

`_diagram.drawio` at the root of the folder is an architecture sketch (not consumed by the code).

---

# 4. The provider stack — `Viewer.tsx`

`Viewer.tsx` is the top-level component for the Model tab. It is **deliberately stateless about geometry** — all geometry lives in a single mutable `world` ref (the `SceneSetup` instance), and all viz/tool state lives in nested context providers.

```
<SelectedModelContextProvider>          available HBJSON revisions + selected id + forceRefresh
  <AppStateContextProvider>             VizState (useReducer)
    <AppToolStateContextProvider>       ToolState (useReducer)
      <ColorByContextProvider>          ColorByAttribute + dynamic legend items
        <SelectedObjectContextProvider> selected mesh (state + ref)
          <HoverObjectContextProvider>  hover mesh (state + ref)
            <World …/>                    boots THREE + wires viz/tool effects
            <Model …/>                    fetches /model_data + invokes loaders
            <ModelSelector/>              version dropdown
            <ElementInfoPanel/>           right sidebar
            <ColorByLegend/>              right sidebar (when ColorBy active)
          </HoverObjectContextProvider>
        </SelectedObjectContextProvider>
      </ColorByContextProvider>
      <BottomMenubar/>                    contains ToolStateMenubar (no VizStateMenubar here in current code)
    </AppToolStateContextProvider>
  </AppStateContextProvider>
</SelectedModelContextProvider>
```

Refs created and threaded through:
- `world = useRef(new SceneSetup())` — the persistent THREE world.
- `hoveringVertex = useRef<THREE.Vector3 | null>(null)` — current snap target in Measure mode.
- `dimensionLinesRef = useRef(new THREE.Group())` — container for measurement geometry, added directly to `world.scene` in the body of `Viewer.tsx`.

> Two subtle things V2 should fix: the dimension-lines group is added to the scene **during render** (a side effect in the render function body), and `useState` + `useReducer` are both used for state that is fundamentally driving imperative scene mutations — this is the pattern the R3F rewrite removes.

---

# 5. Model loading — `Model.tsx`

Two `useEffect`s, both with intentionally-shallow deps (the file disables the exhaustive-deps lint per effect):

1. **Available-models fetch** — On `projectId` change or `forceRefresh` flip, calls `getAvailableModels(projectId)` and pushes the list into `SelectedModelContext`.
2. **Model-data fetch + scene populate** — On `(projectId, showModel, selectedModelId, forceRefresh)` change:
   - `world.current.reset()` — clears building/space/floor/sun-path/pipe/ventilation/shading groups.
   - Calls `/model_data` via `get3DModelData(projectId, selectedModelId, forceRefresh)`.
   - Invokes loaders sequentially: `loadModelFaces`, `loadSpaces`, `loadSpaceFloors`, `loadSunPath`, `loadHotWaterPiping`, `loadERVDucting`, `loadShades`. Each goes through `handleLoadError` which logs + skips when the corresponding payload is null/empty.
   - Sets `isLoading = false`. If `forceRefresh` was true, clears it.
   - Errors trigger a browser `alert(...)` — coarse-grained UX, easy to replace in V2.

Loading UX: a centered MUI `Dialog` with `CircularProgress` and "Please wait while the model is loaded. For large models this may take some time to download." The dialog blocks the viewer until all loaders finish.

---

# 6. The persistent world — `scene_setup/SceneSetup.tsx`

A class instantiated exactly once per `Viewer.tsx` mount. Holds **everything THREE-related**.

Camera + renderer:
- `PerspectiveCamera(FOV=45, aspect=W/H, near=0.1, far=1000)`, positioned at `(-25, 40, 30)`, looking at origin, **up = (0, 0, 1)** (Z-up). The Z-up convention matches Rhino + honeybee_ph and is the single most important configuration detail to preserve in V2.
- `WebGLRenderer({ antialias: true })`, sized to window, pixel ratio capped at `min(devicePixelRatio, 2)`.
- `EffectComposer` with one `RenderPass`. A `SAOPass` is instantiated but **not added to the composer**; an inline comment says "too slow, and too shitty… Lines get all un-antialiased and jagged." V2 should pick a different AO/outline strategy if richer rendering is wanted (drei `Outlines`, `<Effects>` with `SSAO` or `SMAA`).
- `CSS2DRenderer` attached to `document.body` with `pointerEvents: 'none'` so DOM labels (measurement distances) overlay the canvas without intercepting clicks.
- `OrbitControls` on the renderer's DOM element, `rotateSpeed=0.9`, `zoomSpeed=3.0`. No `target` set explicitly — defaults to (0,0,0).
- Shadows: `shadowMap.enabled = true`, `type = PCFSoftShadowMap`.

Lighting:
- `AmbientLight(SURFACE_WHITE, indirectLightIntensity)` — fill.
- `DirectionalLight(color, intensity)` at `(-10, -10, 25)` casting shadows; shadow camera frustum is `{top: 25, bottom: -25, left: -25, right: 25}`. Helpers are commented out.

Ground + grid:
- `groundGeometry` group = a 50×50 `PlaneGeometry` with `ShadowMaterial(opacity=0.3)` that **only receives shadows**. Lives on Z=0.
- Two grid helpers (50 units, 50 + 5 subdivisions) rotated to lie flat on the XY plane.

Geometry groups (all added to scene up-front, empty until loaders populate):

| Group | Loaded by | Initial visibility | Purpose |
|---|---|---|---|
| `selectableObjects` | (filled by viz mount handlers) | true | The raycasting target. Children are swapped in/out by mount handlers to scope picking to the current viz state. |
| `groundGeometry` | (built in ctor) | true | The shadow-receiver plane + grid. Always visible. |
| `buildingGeometryMeshes` | `load_faces` | toggled by viz state | Face meshes + aperture meshes. |
| `buildingGeometryOutlines` | `load_faces` | toggled by viz state | Wireframe `LineSegments` (edges) for faces + apertures. |
| `buildingGeometryVertices` | `load_faces` | initially hidden | Per-vertex spheres for face/aperture corners. Used by Measure mode. |
| `spaceGeometryMeshes` | `load_spaces` | initially hidden | Per-Space `THREE.Group`s, each containing meshes for the Space's volume faces. The Group's userData carries the Space metadata. |
| `spaceGeometryOutlines` | `load_spaces` | initially hidden | Edge wireframes for spaces. |
| `spaceGeometryVertices` | `load_spaces` | initially hidden | Vertex spheres for spaces. |
| `spaceFloorGeometryMeshes` | `load_space_floors` | initially hidden | Floor-segment meshes, one per `floor_segments[]` entry. |
| `spaceFloorGeometryOutlines` | `load_space_floors` | initially hidden | Floor-segment outlines. |
| `spaceFloorGeometryVertices` | `load_space_floors` | initially hidden | Floor-segment vertex spheres. |
| `sunPathDiagram` | `load_sun_path` | initially hidden | Analemma + arc lines + compass lines. |
| `ventilationGeometry` | `load_erv_ducting` | initially hidden | Duct centerlines as `LineSegments2`. |
| `pipeGeometry` | `load_hot_water_piping` | initially hidden | Nested groups: System → Trunk → Branch → Fixture → Segment, plus recirc segments. |
| `shadingGeometryMeshes` | `load_shades` | initially hidden | Merged-per-group shade meshes. |
| `shadingGeometryWireframe` | `load_shades` | initially hidden | Edge wireframes for shades. |

Methods:
- `reset()` — Clears all geometry groups (but NOT `groundGeometry`, `selectableObjects`, or `shadingGeometryWireframe` — the last omission looks like a minor V1 bug worth confirming on porting).
- `clearSelectableObjectsGroup()` — Reparents every child of `selectableObjects` back to the scene. Because a `THREE.Object3D` can only have one parent, moving it back to the scene implicitly removes it from `selectableObjects`. The children are still visible because they remain in the scene; only their selectability is revoked.

---

# 7. Materials — `scene_setup/Materials.tsx`

A single `appMaterials` object exports the full palette. All materials are `THREE.MeshStandardMaterial` (lit) for surfaces, `LineBasicMaterial`/`LineDashedMaterial`/`LineMaterial` (thick lines from `examples/jsm/lines`) for line geometry.

| Key | Type | Used by |
|---|---|---|
| `groundShadow` | `ShadowMaterial(opacity=0.3)` | Ground plane (shadow-receiver only). |
| `geometryStandard` | `MeshStandardMaterial(SURFACE_WHITE, doubleSide, flatShading)` | Default opaque face. |
| `geometryWindow` | `MeshStandardMaterial(SURFACE_WHITE, opacity=0.85, transparent, doubleSide)` | Aperture / window face. |
| `geometryShading` | `MeshStandardMaterial(MED_GREY, doubleSide, flatShading)` | Merged shade groups. |
| `geometrySelected` | `MeshStandardMaterial(SURFACE_HIGHLIGHT, doubleSide)` | Applied to the picked mesh in Select tool. |
| `geometryHoverOver` | `MeshStandardMaterial(SURFACE_HOVER, doubleSide)` | Applied to hover mesh in Select tool. |
| `wireframe` | `LineBasicMaterial(OUTLINE, linewidth=2)` | Default edge color. |
| `wireframeDarkGrey` | `LineBasicMaterial(DARK_GREY, linewidth=2)` | Shade edges. |
| `dimensionLine` | `LineBasicMaterial(DIMENSION_LINE, linewidth=2)` | Measurement line color. |
| `sunpathLine` | `LineDashedMaterial(SUNPATH_LINE, linewidth=2, dashSize=1, gapSize=0.5)` | Analemmas, arcs, compass ticks. Requires `computeLineDistances()` before render. |
| `pipeLine` | `LineMaterial(PIPE_LINE, linewidth=0.04, worldUnits=true)` | Hot water pipe segments (thick line in world units). |
| `pipeLineHighlight` | `LineMaterial(PIPE_LINE_HIGHLIGHT, linewidth=0.1, worldUnits=true)` | Hover/select highlight on pipes. |
| `ductLine` | `LineMaterial(DUCT_LINE, linewidth=0.06, worldUnits=true)` | Duct segments. |

Color names (`SURFACE_WHITE`, `OUTLINE`, `DIMENSION_LINE`, `SUNPATH_LINE`, `PIPE_LINE`, `DUCT_LINE`, …) live in the project-global `styles/AppColors.ts`, not in the model_viewer folder.

`LineWidth > 1` is **not** supported by stock `LineBasicMaterial` on most GPUs (the THREE docs warn about this), which is why pipes/ducts use `LineSegments2` + `LineMaterial`. The wireframe materials use `linewidth: 2` cosmetically but in practice render as 1px lines.

---

# 8. State machines — `states/VizState.ts` and `states/ToolState.ts`

Both files implement the same pattern: an enum, a class, a dict of pre-instantiated state objects keyed by enum value, and `addXxxEventHandler` / `addXxxMountHandler` / `addXxxDismountHandler` module-level helpers that mutate the dict.

Critical detail: **the handler registries are module-level, shared globally, and mutated from `World.tsx`'s render body** (not inside a `useEffect`). On every re-render of `World`, the registered handlers are overwritten with new closures. This works because the wrapping `useCallback`s pin the handlers (so the function reference is stable), but it's brittle — V2 should put handlers behind a proper component-scoped store (Zustand slice per state, or R3F's `useFrame`/`<primitive>` lifecycle).

## 8.1 `appVizStateTypeEnum`

| Enum | Value | Mount visibility (set by `World.tsx` mount handlers) |
|---|---|---|
| `None` | 0 | Same as Geometry (default fallback). |
| `Geometry` | 1 | building meshes + outlines + vertices visible; `selectableObjects` = building meshes. |
| `SpaceFloors` | 2 | floor meshes + outlines + vertices visible; building outlines also on (for context); `selectableObjects` = floor meshes. |
| `Spaces` | 3 | space meshes + outlines visible (vertices off); building outlines on; `selectableObjects` = space meshes. |
| `SunPath` | 4 | building meshes + outlines + vertices visible; sun-path diagram on; shading meshes + wireframe on. |
| `Ventilation` | 5 | ventilation geometry on; building outlines on (no meshes). |
| `HotWaterPiping` | 6 | pipe geometry on; building outlines on (no meshes). |
| `ColorBy` | 7 | delegated to `setColorByGeometryVisibility(world, attribute)` which picks building / space / floor geometry based on which color-by attribute is active. Also calls `applyColorByMode` to recolor and pushes the legend items into `ColorByContext`. |

Dismount handlers symmetrically hide the same groups and call `clearSelectableObjectsGroup()`. ColorBy's dismount additionally restores original materials on building / space / floor meshes via three restorer functions.

## 8.2 `appToolStateTypeEnum`

| Enum | Value | Click | PointerMove | Dismount cleanup |
|---|---|---|---|---|
| `None` | 0 | — | — | — |
| `Select` | 1 | `handleOnClick` → pick mesh via raycaster → store in `SelectedObjectContext` → apply `geometrySelected` material. | `handleOnMouseOver` → pick mesh → store in `HoverObjectContext` → apply `geometryHoverOver` material. | `clearSelection` (drops selected + hover). |
| `Measure` | 2 | `measureModeOnMouseClick(hoveringVertex, dimensionLinesRef)` → if a hovering vertex is held, draw a dimension line from the last vertex to it + CSS2D label with distance. | `measureModeOnMouseMove(e, world, hoveringVertex)` → snap pointer to nearest face vertex; show a marker sphere at the snap target. | `hoveringVertex = null`; `dimensionLinesRef.clear()`. |
| `Comments` | 3 | — (placeholder; UI button exists but no behavior wired up) | — | — |

The two `useEffect`s in `World.tsx` that drive the state machine read `appToolStateContext.appToolState` / `appVizStateContext.appVizState` as a dep, then on each change run the new state's mount handlers + add its event listeners to `window`, and return a cleanup that runs the previous state's dismount handlers + removes its listeners. Standard "imperative-scene-meets-React-effects" wiring.

---

# 9. Loaders — what each one builds and what userData it stamps

All loaders follow the same shape: take `(world, payload)`, build geometry, stash relevant fields in `userData`, and add to a specific `world.*Geometry*` group. None of them are pure — they all mutate the scene.

## 9.1 `load_faces.tsx` — Opaque faces + apertures

For each face DTO:
1. `convertHBFaceToMesh(face)` → `{ mesh, wireframe, vertexHelper, vertices }`.
2. `mesh.material = appMaterials.geometryStandard`; `mesh.userData['type'] = 'faceMesh'`; full face DTO is copied into `mesh.userData` via the converter so the info panel can read `display_name`, `face_type`, `boundary_condition`, `area`, `properties.energy.construction.{identifier, type, u_factor, r_factor}`. Added to `buildingGeometryMeshes`.
3. `vertexHelper` (corner spheres) → `userData['type'] = 'faceMeshVertexHelper'`, added to `buildingGeometryMeshes` (yes, in the same group as the mesh — slightly odd grouping that V2 can tidy).
4. `wireframe` → `userData['type'] = 'faceMeshWireframe'`, `appMaterials.wireframe`, added to `buildingGeometryOutlines`.
5. `vertices` → visible=false, added to `buildingGeometryVertices` (used by Measure mode snapping).
6. For each `aperture` on the face: same pattern, but with `'apertureMeshFace'` / `'apertureMeshFaceVertexHelper'` / `'apertureMeshFaceWireframe'` types and `appMaterials.geometryWindow` for the surface.

There is also a (currently disabled) `createTextLabel` path that builds a `troika-three-text` label at each aperture's center. The TODO note says alignment-to-face-normal is not working; do not consider this active in V1.

## 9.2 `load_spaces.tsx` — Interior PH-Spaces (volumes)

For each Space:
1. Create a `THREE.Group` with `userData['type'] = 'spaceGroup'` and **the full space metadata** copied across: `identifier`, `display_name` (= space name), `number`, `quantity`, `wufi_type`, `net_volume`, `avg_clear_height`, `floor_area`, `weighted_floor_area`, `average_floor_weighting_factor`, **and** `properties` (which contains `properties.ph._v_sup/_v_eta/_v_tran`). This group is the selection target (info panel reads from it).
2. For each volume in `space.volumes[]` and each `Face3D` in `volume.geometry`: `convertLBTFace3DToMesh` → mesh + wireframe + vertices. Mesh `userData['type'] = 'spaceMeshFace'`; wireframe type `'spaceMeshFaceWireframe'`. Add to the space group; add the wireframe/vertices to `spaceGeometryOutlines` / `spaceGeometryVertices`.
3. Add the space group to `spaceGeometryMeshes`.

The two-level grouping (`spaceGeometryMeshes` → `spaceGroup` → face meshes) is what lets `applyColorByVentilationAirflow` color **all** faces of a space with one color: it traverses each `spaceGroup`, reads its ventilation userData, and recolors the descendant meshes uniformly.

## 9.3 `load_space_floors.tsx` — Floor segments

For each Space, again build a per-space `THREE.Group` with `userData['type'] = 'spaceFloor'` and the space-level metadata. Then for each `volume.floor.floor_segments[]`, convert the segment's Face3D to a mesh; stash `weighting_factor`, `floor_area`, `weighted_floor_area`, plus the space's airflow values (`_v_sup`, `_v_eta`, `_v_tran`) on the mesh's userData; type = `'spaceFloorSegmentMeshFace'`. The info panel's `spaceFloorSegmentMeshFace` config reads these.

## 9.4 `load_sun_path.tsx` — Analemma + arcs + compass

For each polyline / arc in `sunpath` and `compass`:
1. Convert via the appropriate `to_three_geometry/ladybug_geometry/*` helper.
2. Call `line.computeLineDistances()` (required for `LineDashedMaterial` to render dashes correctly).
3. `line.material = appMaterials.sunpathLine`.
4. Add to `sunPathDiagram`.

There is no userData on sun-path elements; they are non-selectable.

## 9.5 `load_erv_ducting.tsx` — Ventilation ducts

For each ventilation system, iterate both `supply_ducting` and `exhaust_ducting`. For each duct element, iterate `segments`. For each segment:
1. `convertLBTLineSegment3DtoLine(segment.geometry, false)` → a `LineSegmentsGeometry`.
2. `LineSegments2(geom, appMaterials.ductLine)`.
3. `userData['type'] = 'ductSegmentLine'`, `userData['identifier'] = segment_key`, `userData['display_name'] = duct.display_name`, `userData['duct_type'] = duct.duct_type`, `userData['diameter'] = segment.diameter`, `userData['insulation_thickness'] = segment.insulation_thickness`.
4. Add to `ventilationGeometry`.

There is no visual distinction between supply and exhaust in V1 (both use `ductLine` material). V2 could split these for clarity.

## 9.6 `load_hot_water_piping.tsx` — Hot-water distribution + recirc

Hierarchical: System → `pipeGeometry` group → per-trunk `THREE.Group` (`pipeTrunkLine`) → per-branch `THREE.Group` (`pipeBranchLine`) → per-fixture `THREE.Group` (`pipeFixtureLine`) → per-segment `LineSegments2` (`pipeSegmentLine`). Recirc piping is flat: just per-segment `LineSegments2` typed `pipeRecircLineSegment` added directly to `pipeGeometry`.

Each segment carries: `identifier`, `display_name`, `diameter_value`, `insulation_thickness`, `insulation_conductivity`, `insulation_reflective`, `insulation_quality`, `daily_period`, `water_temp`, `material_value`, `length`. The info panel's `pipeSegmentLine` config only surfaces `identifier` + `display_name` in V1 — the rest is in userData but not displayed.

`_handlers/modePipes.tsx` provides hover/select highlighting for pipe segments (swap to `pipeLineHighlight` on hover).

## 9.7 `load_shades.tsx` — Exterior shading

For each shade group from the backend (already merged server-side):
1. Build each shade's mesh via `convertLBTFace3DToMesh`.
2. Merge the group's meshes into a single `BufferGeometry` via `BufferGeometryUtils.mergeGeometries` (so each shade group is **one** draw call regardless of how many faces it contained).
3. The merged mesh gets `appMaterials.geometryShading`. Added to `shadingGeometryMeshes`.
4. An edge wireframe is built per face and added to `shadingGeometryWireframe` with `wireframeDarkGrey` material.

Shades are only shown in the SunPath viz state (mount handler turns `shadingGeometryMeshes` + `shadingGeometryWireframe` visible). They are **not** selectable in V1.

---

# 10. Geometry converters — `to_three_geometry/`

Pure functions: HBJSON-shape-of-geometry → Three.js objects. No scene mutation. Used by loaders.

- `honeybee/face.tsx` → `convertHBFaceToMesh(hbFace)` returns `{ mesh, wireframe, vertexHelper, vertices }` where:
  - `mesh` is a `BufferGeometry` from `face.geometry.mesh` (triangulated; vertex + index buffer).
  - `wireframe` is an `EdgesGeometry` on the punched face boundary, rendered as `LineSegments`.
  - `vertexHelper` is a small spheres-at-corners group used for visual debugging.
  - `vertices` is a `Points` object at each corner, used as the snap source for Measure mode.
  - Each of the four sub-objects has the full face DTO copied into its `userData` so any of them is a valid raycast hit for the info panel.
- `ladybug_geometry/geometry3d/face.tsx` → `convertLBTFace3DToMesh(lbtFace3D)` — same shape as above but for an LBT Face3D (no apertures, no energy props).
- `ladybug_geometry/geometry3d/line.tsx` → `convertLBTLineSegment3DtoLine(lbtLineSegment3D, close=false)` → a `LineSegmentsGeometry` (used for thick lines via `LineSegments2` + `LineMaterial`).
- `ladybug_geometry/geometry3d/polyline.tsx` → `convertLBTPolyline3DtoLine(lbtPolyline3D)` → a `Line` from a list of points.
- `ladybug_geometry/geometry3d/arc.tsx` → `convertLBTArc3DtoLine(lbtArc3D)` → discretized `Line` from arc center/radius/start/end.
- `ladybug_geometry/geometry2d/arc.tsx` + `geometry2d/line.tsx` → 2D versions used only by the compass (positioned at z=0).

---

# 11. Color-by — `_constants/colorByColors.ts` + `_handlers/modeColorBy.tsx`

## 11.1 Six modes (from `ColorByAttribute` enum)

| Mode | Acts on | Color source | Legend |
|---|---|---|---|
| `FaceType` | building meshes | `faceTypeColors` (Wall, RoofCeiling, Floor, Aperture, default) | static |
| `Boundary` | building meshes | `boundaryColors` (Outdoors, Ground, Adiabatic, Surface, default) | static |
| `OpaqueConstruction` | meshes with `type === 'faceMesh'` | per-construction-identifier deterministic hash (cyrb53 + golden-ratio HSL) | **dynamic** — built into a `Map<string, ColorDefinition>` at color-application time and pushed to `ColorByContext.dynamicLegendItems` |
| `ApertureConstruction` | meshes with `type === 'apertureMeshFace'` | same hash, but keyed by aperture construction id | dynamic |
| `VentilationAirflow` | `spaceGroup`s | `ventilationAirflowColors` (SupplyOnly, ExtractOnly, SupplyAndExtract, NoVentilation, default), categorized by `(v_sup > 0, v_eta > 0)` | static |
| `FloorWeightingFactor` | `spaceFloorSegmentMeshFace` meshes | `floorWeightingFactorColors` (FullyTreated 1.0/>0.6, Semi 0.5–0.6, Partial 0.3–0.5, Minimal 0.0–0.3, NonTreated 0.0, default) | static |

Note the **bucketing in `getWeightingFactorCategory`**: `1.0 OR > 0.6` → FullyTreated; `> 0.5 AND ≤ 0.6` → Semi; `> 0.3 AND ≤ 0.5` → Partial; `> 0.0 AND ≤ 0.3` → Minimal; `=== 0.0` → Non. There is a gap between Minimal's upper bound (0.3) and Partial's lower bound (0.3) handled by the strict-greater conditions — worth re-deriving in V2 to make sure 0.3 lands somewhere intentional.

## 11.2 Application flow

`applyColorByMode(world, attribute)`:
1. Always start by `restoreOriginalMaterials(world)` + `restoreSpaceOriginalMaterials(world)` + `restoreFloorOriginalMaterials(world)`. This is the "clean state" guarantee when **switching** between color modes without exiting ColorBy.
2. Dispatch to the matching `applyColorBy*` function.
3. For construction modes, return a `Map<string, ColorDefinition>`; for everything else, return `null`. `World.tsx`'s `applyColorModeAndUpdateLegend` consumes this and pushes either the map or `[]` into `ColorByContext.dynamicLegendItems`.

`applyColorByAttribute(group, colorMap, getKey)`:
1. Traverse all meshes in the group.
2. `storeOriginalMaterial(mesh)` — copy `mesh.material` into `userData['colorByOriginalMaterial']` **only if not already present** (idempotent across switches).
3. Build a `MeshBasicMaterial(color, side=DoubleSide)` — basic, not standard, so the color appears flat and matches the legend swatch exactly (no lighting tint).
4. Write the new material to both `mesh.material` and `mesh.userData['materialStore']`. `materialStore` is the field selection-highlighting reads as "the material to restore me to when I'm no longer selected" — so updating it keeps Select + ColorBy compatible.

`createConstructionColorDef(name)` uses `cyrb53(str, seed)` to derive two 53-bit hashes, then HSL with hue = `(baseHue + goldenRatio * hash2) % 1`, saturation = 55–85%, lightness = 40–65%. The golden-ratio rotation gives consecutive/similar names well-distributed colors (the doc comment explicitly mentions "N.3.1", "N.3.2", … as the use case).

## 11.3 Restoration

Three sibling restore functions — `restoreOriginalMaterials`, `restoreSpaceOriginalMaterials`, `restoreFloorOriginalMaterials` — traverse the relevant group and revert `mesh.material` and `mesh.userData['materialStore']` to the value in `mesh.userData['colorByOriginalMaterial']`. Called on:
- VizState dismount for `ColorBy`.
- Start of every `applyColorByMode` (clean slate before re-coloring).

If a mesh's material was already the color-by material (e.g. user toggled into ColorBy, picked another attribute), restoration happens via the first call inside `applyColorByMode`. This is what keeps the "switch attribute without exiting ColorBy" path clean.

---

# 12. Selection + hover — `_handlers/selectMesh.tsx`, `selectObject.tsx`

## 12.1 Raycasting (`selectMesh.tsx`)

Two functions:
- `getSelectedMeshFromMouseClick(event, camera, objects)` — debounces against drags. On `mousedown` it records the screen position; on `click` it checks the distance to the down-position and bails if > 5px (a drag, not a click). Otherwise runs `THREE.Raycaster` against `objects.children` and returns the first hit's `.object` cast to `THREE.Mesh`.
- `getMeshFromMouseOver(event, camera, objects)` — same raycaster but no drag-debounce; called from `pointermove`.

The raycaster is always pointed at `world.selectableObjects`, whose contents are swapped by viz-state mount handlers. So picking is automatically scoped to "what's currently shown as the primary geometry."

## 12.2 Select tool (`selectObject.tsx`)

- `handleOnClick(event, world, selectedObjectContext)`:
  - `getSelectedMeshFromMouseClick` → mesh or null.
  - If a previous selection exists, restore its `materialStore`.
  - Set `selectedObjectContext.selectedObjectState = mesh` (for the info panel to react) and `selectedObjectRef.current = mesh` (for THREE-side use).
  - Apply `geometrySelected` material (cyan highlight).
- `handleOnMouseOver(event, world, hoverObjectContext)`:
  - `getMeshFromMouseOver` → mesh or null.
  - Restore prior hover's `materialStore`.
  - Apply `geometryHoverOver` material.
  - Update `hoverObjectContext`.
- `clearSelection(selectedObjectContext, hoverObjectContext)`:
  - Restore both selected + hover meshes to their `materialStore`.
  - Null out both contexts.

The `materialStore` userData field is the contract: it is **always** the "what is the mesh's material when nothing is doing anything to it." ColorBy updates `materialStore`. Original load sets it implicitly via `mesh.material`. Selection highlighting reads it as the restoration source.

## 12.3 Measure tool (`modeMeasurement.tsx`)

- On `pointermove`: `selectPoint(pointer, world)` finds the nearest vertex among `buildingGeometryVertices`' children to the pointer's projection. Sets `hoveringVertex.current = vector3` and renders a small marker sphere at that point.
- On `click`: if a hovering vertex is held, builds a `Line` from the previous click vertex to the current hovering vertex with `dimensionLine` material, then adds a `CSS2DObject` label (a div, styled by `DimensionLines.css`) at the line midpoint showing the Euclidean distance. The label is a DOM element so it can use CSS for the pill-shaped white background with a faint shadow.
- On dismount: clears `dimensionLinesRef` and nulls `hoveringVertex`.

---

# 13. UI components

## 13.1 `_components/VizStateMenubar.tsx`

A floating row of icon buttons. Order:
1. **Geometry** (`Geometry.svg`, tooltip "Exterior Surfaces") — VizState 1.
2. **FloorSegments** (`FloorSegments.svg`, "Interior Floors") — VizState 2.
3. **Space** (`Space.svg`, "Interior Spaces") — VizState 3.
4. **SunPath** (`SunPath.svg`, "Site") — VizState 4.
5. **Ducts** (`Ducts.svg`, "Ventilation Ducting") — VizState 5.
6. **Pipes** (`Piping.svg`, "Hot Water Piping") — VizState 6.
7. **ColorBy** (`ColorBy.svg`, "Color By…") — opens an MUI `<Menu>` with six items (FaceType, Boundary, [divider], Opaque Constr., Aperture Constr., [divider], Ventilation Airflow, Floor Weighting Factor). Each item has a tiny inline-SVG icon. Selecting a sub-item dispatches `ColorByAttribute` into context **and** dispatches `appVizStateTypeEnum.ColorBy` if not already in ColorBy mode (so picking a new attribute while in ColorBy just re-applies, doesn't re-enter).

Button click semantics:
- Clicking a non-active button → switch to that VizState.
- Clicking the already-active button → revert to `Geometry` (the implicit "off" state).
- The active button gets a `.active` CSS class for visual feedback.

**Important — this component is NOT currently mounted in `Viewer.tsx`.** Inspection of `Viewer.tsx` shows `<BottomMenubar/>` (which wraps `ToolStateMenubar`) but not `<VizStateMenubar/>`. The viz-state UI may have been temporarily commented out or moved; V2 will need to re-mount or re-locate it. The state machine itself remains fully wired.

## 13.2 `_components/ToolStateMenubar.tsx`

The bottom-left tool selector. Three icon buttons:
1. **Surface** (`Surface.svg`) — Select (ToolState 1).
2. **Ruler** (`Ruler.svg`) — Measure (ToolState 2).
3. **Note** (`Note.svg`) — Comments (ToolState 3). Placeholder; no handler.

Same active-button toggle behavior as the VizStateMenubar.

## 13.3 `_components/ModelSelector.tsx`

A dropdown that lists `availableModels` from `SelectedModelContext`. Selecting a model sets `selectedModelId`, which triggers the `useEffect` in `Model.tsx` to re-fetch + reload. There is also a "refresh" button that flips `forceRefresh = true`, which both forces the available-models list to re-fetch and bypasses the backend model cache.

## 13.4 `_components/ElementInfoPanel/`

The right sidebar that displays selected-object metadata.

`fieldConfigs.ts` is the heart: a `Record<string, ElementTypeConfig>` keyed by `mesh.userData['type']` value. The configs declare, per element type, a top-level field list and optional sections. Each field has:
- `key` — dot-path into userData (`'properties.energy.construction.u_factor'`).
- `label` — human label.
- `tooltip` — optional helper text.
- `decimals` — formatting precision (default 2).
- `units?: { si, ip, siLabel, ipLabel }` — unit-conversion descriptor (the panel respects the global IP/SI toggle and converts on render).

Configured types in V1:
- **`faceMesh`** ("Opaque Surface") — Name, ID, Face Type, Boundary, Area; section "Construction": Name, Type, U-Factor (W/m²K ↔ Btu/hr·ft²·°F), R-Factor (m²K/W ↔ hr·ft²·°F/Btu).
- **`apertureMeshFace`** ("Window") — Name, ID, Face Type, Boundary, Area; section "Construction": Name, Type, U-Factor. (No R-factor.)
- **`spaceGroup`** ("Interior Space") — Name, ID, Number, Quantity, WUFI Type, Floor Area, Weighted Area, Net Volume, Avg Height, Avg Weighting Factor; section "Ventilation": Supply Air (m³/h ↔ CFM), Extract Air, Transfer Air.
- **`spaceFloorSegmentMeshFace`** ("Interior Floor") — Space (display_name), Number, Weight (weighting_factor), Floor Area, Weighted Area; section "Ventilation": Supply, Extract, Transfer Air.
- **`pipeSegmentLine`** ("Pipe") — ID, Name. (Other pipe userData is loaded but not displayed.)
- **`ductSegmentLine`** ("Duct") — ID, Name, Diameter (mm ↔ in), Insulation (mm ↔ in).

Mesh types **without** a config (e.g. wireframes, vertex helpers, shading, sun-path) are not selectable in V1 — either they aren't in `selectableObjects` or, if they are, the info panel renders empty when their userData type doesn't match.

`InfoField.tsx` renders one row: label (with optional tooltip icon), formatted value, unit suffix. `ElementInfoPanel.tsx` reads `SelectedObjectContext`, looks up `userData['type']` in `fieldConfigs`, and renders the configured fields + sections.

## 13.5 `_components/ColorByLegend/`

A right-sidebar legend visible only when in ColorBy viz state. Two modes:
- **Static** — for FaceType/Boundary/Ventilation/FloorWeighting, the legend items are the entries of the matching static color map (`getLegendItems(colorMap)` drops the `default` entry).
- **Dynamic** — for OpaqueConstruction/ApertureConstruction, the legend items come from `ColorByContext.dynamicLegendItems`, which was set by `applyColorByMode` returning a Map of construction-id → ColorDefinition.

Each legend item is a colored swatch + label. No interactivity (clicking a legend item does **not** filter the scene in V1 — a candidate enhancement for V2).

---

# 14. Cross-cutting concerns / surprising details

1. **Z is up.** `camera.up.set(0, 0, 1)` plus the rotated grid. This is the Rhino / honeybee_ph convention. Any V2 R3F port must preserve this — by default R3F uses Y-up. Either set `up` on the camera explicitly or rotate the whole world group.
2. **Airflow units are converted in the backend, not the frontend.** Backend multiplies `_v_sup/_v_eta/_v_tran` by 3600 (m³/s → m³/h) before Pydantic. The frontend then converts m³/h → CFM at render time via the units module. The reason for the pre-Pydantic dance is documented in code: FastAPI re-validates models during response serialization and a Pydantic validator would multiply twice. PRD §11.5 says all backend transport in V2 is SI canonical — m³/s would be the right canonical, so V2 should remove this back-conversion and do `m³/s → CFM` at the frontend.
3. **AirBoundary faces are silently dropped.** Any face whose `properties.energy.construction.to_dict()` fails `OpaqueConstructionSchema` validation is logged + skipped in `get_faces_from_model`. AirBoundaries (which have no opaque construction) are the canonical case. The viewer therefore does not render air-boundary surfaces at all. V2 should decide whether to render them as a distinct (translucent? dashed?) surface type, or preserve the drop.
4. **The cache is process-local and 1-hour-TTL.** Restarting the backend or running multiple workers means a hot model in one process is cold in another. The 1-hour TTL means a user who edits a model in Rhino, re-uploads to AirTable, then re-opens the viewer **without** clicking refresh will see the old cached model. The Model Selector's "force refresh" button is the user-visible way out.
5. **The `selectableObjects` parent-swap is a clever trick.** `clearSelectableObjectsGroup` re-parents children back to `scene`, which removes them from `selectableObjects` without removing them from the scene. This means a mesh can be visible-but-not-selectable, or visible-and-selectable, simply by where it's currently parented. The trade-off is that any code holding a reference to a mesh-as-child-of-selectableObjects breaks when the swap happens. V2 should either keep this pattern explicitly or replace it with a per-mesh `userData['selectable']` flag plus raycast filtering.
6. **Handler registries are module-globals, mutated from a render body.** `addToolStateEventHandler` and `addVizStateMountHandler` write directly into the module-level `toolStates` / `vizStates` dicts. Called inside `World.tsx`'s render (not a `useEffect`). The `useCallback` wrap keeps function identity stable but the pattern is fragile and would silently break under React strict-mode double-invocation if the callbacks weren't pinned. V2's Zustand-or-equivalent store should replace this.
7. **Dimension lines are added to `world.scene` from inside the render body of `Viewer.tsx`.** Specifically `world.current.scene.add(dimensionLinesRef.current)` runs on every render. This is idempotent because `scene.add` of an already-parented object is a no-op, but it is the kind of imperative-in-render side effect R3F's declarative `<group>` pattern eliminates.
8. **CSS2DRenderer is appended directly to `document.body`.** Not under any scoping container; the labels overlay the whole document. `pointerEvents: 'none'` keeps them transparent to mouse events. This means rendering the viewer inside a tab system (which V2 does in the Project workspace) won't accidentally hide labels behind chrome, but switching away from the Model tab needs to detach the renderer or it leaks pinned labels onto other tabs.
9. **Pipe diameter, water temp, daily-period, etc. are in userData but not in the info panel.** The `pipeSegmentLine` field config only shows ID + Name. There's an opportunity in V2 to surface the richer pipe metadata, especially for cert-review walkthroughs.
10. **Single-file alert() for load failure.** `Model.tsx` calls `alert(\`Error loading model data: ${error}\`)` on any thrown error from `get3DModelData`. Replace with a toast/snackbar in V2.
11. **Shade groups are not selectable.** Shades have rich `display_name` info that would be useful at hover-time but `shadingGeometryMeshes` is never added to `selectableObjects`. V2 should likely make shades selectable, surfacing display_name in a minimal info-panel config.
12. **Floor-weighting bucket boundary at 0.3.** Strict-`>` conditions in `getWeightingFactorCategory` mean a value of exactly `0.3` falls through both Partial (`> 0.3 ≤ 0.5`) and Minimal (`> 0.0 ≤ 0.3`), landing in `default`. Real PH weighting factors are typically 0.0, 0.5, 0.6, or 1.0, so the practical hit rate is zero — but V2 should clean up the boundaries.

---

# 15. Data flow summary

```
AirTable
  ├─ HBJSON files (per project, multiple revisions, dated)
  └─ EPW file (per project, single)
       │
       ▼
backend/features/hb_model/services/hb_model.py
  └─ load_hb_model(bt_number, record_id, force_refresh)
       ├─ Cache miss → download HBJSON → Model.from_dict() → cache
       └─ Cache hit → return cached Model
                                                  │
                                                  ▼
backend/features/hb_model/services/model_elements.py
  ├─ get_faces_from_model               (FaceSchema, ApertureSchema, OpaqueConstructionSchema, WindowConstructionSchema)
  ├─ get_spaces_from_model              (SpaceSchema, VolumeSchema, FloorSchema with weighting factors and airflow)
  ├─ get_hot_water_systems_from_model   (PhHotWaterSystemSchema → trunks → branches → fixtures → segments + recirc)
  ├─ get_ventilation_systems_from_model (PhVentilationSystemSchema → ducts → segments)
  ├─ get_shading_elements_from_model    (ShadeGroupSchema → merged Mesh3D per display_name)
  └─ get_sun_path_from_model(epw)       (SunPathAndCompassDTOSchema → analemma polylines + monthly arcs + compass)
                                                  │
                                                  ▼
GET /hb_model/{bt_number}/model_data  (one HTTP call; bulk endpoint)
  → CombinedModelDataSchema (JSON)
                                                  │
                                                  ▼
frontend src/api/get3DModelData.ts
  → { facesData, spacesData, sunPathData, hotWaterSystemData, ventilationSystemData, shadingElementsData }
                                                  │
                                                  ▼
frontend Model.tsx (useEffect on projectId/showModel/selectedModelId/forceRefresh)
  ├─ world.current.reset()
  ├─ loadModelFaces(world, facesData)         → buildingGeometryMeshes / Outlines / Vertices
  ├─ loadSpaces(world, spacesData)            → spaceGeometryMeshes / Outlines / Vertices (hidden by default)
  ├─ loadSpaceFloors(world, spacesData)       → spaceFloorGeometry* (hidden by default)
  ├─ loadSunPath(world, sunPathData)          → sunPathDiagram (hidden by default)
  ├─ loadHotWaterPiping(world, hotWaterSystemData) → pipeGeometry (hidden by default)
  ├─ loadERVDucting(world, ventilationSystemData)  → ventilationGeometry (hidden by default)
  └─ loadShades(world, shadingElementsData)        → shadingGeometryMeshes / Wireframe (hidden by default)
                                                  │
                                                  ▼
frontend World.tsx
  ├─ animate() loop: controls.update() → composer.render() → labelRenderer.render(scene, camera)
  ├─ useEffect [appVizStateContext.appVizState]: run previous dismount handlers, run new mount handlers,
  │                                             swap event listeners on window
  ├─ useEffect [appToolStateContext.appToolState]: same pattern for tool-state
  └─ useEffect [colorByContext.colorByAttribute]: when in ColorBy viz state, recolor + push legend
                                                  │
                                                  ▼
User interactions
  ├─ Click VizStateMenubar button → AppStateContextProvider.dispatch(N) → viz-state effect fires
  ├─ Click ToolStateMenubar button → AppToolStateContextProvider.dispatch(N) → tool-state effect fires
  ├─ Pointermove (Select tool) → raycast → HoverObjectContext → apply hover material
  ├─ Click (Select tool) → raycast → SelectedObjectContext → apply selected material → ElementInfoPanel rerenders
  ├─ Pointermove (Measure tool) → snap to nearest vertex → marker sphere
  ├─ Click (Measure tool) → drop dimension line + CSS2D label between last two snapped vertices
  └─ Pick ColorBy sub-item → ColorByContext.attribute changes → useEffect re-applies coloring + updates legend
```

---

# 16. Quick reference — what V2 must preserve (no-regression checklist)

When the V2 R3F port lands, these are the behaviors that must continue to work. Items marked **★** are the ones with non-obvious implementations that V2 implementers will trip over if they don't re-read this doc.

- [ ] HBJSON ingestion via uploaded file (V1: AirTable; V2: R2 + `project_hbjson_files`). Backend extractor reuses today's `services/model_elements.py` logic, ported as-is.
- [ ] **★** Backend silently skips faces whose construction can't be validated as opaque (AirBoundaries). Either preserve or make the drop explicit + visible.
- [ ] **★** Airflow values arrive in m³/h after backend conversion from m³/s, and conversion is pre-Pydantic. V2 should switch to SI canonical (m³/s on the wire) and convert at the frontend display layer per PRD §11.5.
- [ ] Z-up camera with `(-25, 40, 30)` start position looking at origin.
- [ ] Bulk `/model_data` endpoint (single HTTP call). Keep the per-feature endpoints if helpful for the MCP surface, but the viewer should use one.
- [ ] Model version dropdown with most-recent-first sort + force-refresh button.
- [ ] Process-local cache with TTL (or replace with R2 ETag-based fetch — preferred for V2; no need for an in-memory cache layer if R2 fetches are fast and HBJSON is immutable post-upload).
- [ ] All 7 viz states (Geometry, SpaceFloors, Spaces, SunPath, Ventilation, HotWaterPiping, ColorBy) work and are mutually exclusive.
- [ ] All 6 color-by modes work, including the deterministic name→color hash for construction names.
- [ ] Static legend for FaceType/Boundary/Ventilation/FloorWeighting; dynamic legend (built from project's actual construction names) for OpaqueConstruction/ApertureConstruction.
- [ ] All 3 tool states (None, Select, Measure). Comments can stay as a placeholder until V2 has a comment-thread feature.
- [ ] Select: click to pick, info panel right-sidebar updates, click-elsewhere clears, drags don't trigger picks (5px tolerance).
- [ ] Hover (pointermove in Select tool): hover material applied; restored when pointer leaves.
- [ ] Measure: snap-to-vertex (using face corner vertices), two-click dimension line, CSS2D distance label, clears on tool exit.
- [ ] **★** `materialStore` userData contract: selection/hover use it as the restoration source; ColorBy updates it so post-deselect we land on the color-by material, not the original.
- [ ] Sun-path scale 0.4 (radius 40 world units), centered at origin, north=0°. Generated from project EPW.
- [ ] **★** Shade groups merged into single meshes per `display_name` server-side, using tolerance-aware vertex-merging (`Point3D.is_equivalent`, tol=1e-7).
- [ ] Hot-water tree depth: System → Trunk → Branch → Fixture → Segment, plus flat recirc. Highlight on hover/select.
- [ ] Duct distinction supply/exhaust is **not** visually rendered in V1 — V2 should split colors here.
- [ ] Element info panel field configs preserved per element type (the fieldConfigs in §13.4). IP/SI conversion in panel rendering.
- [ ] Dynamic-legend update path: changing ColorBy sub-attribute while in ColorBy mode re-applies + updates legend without exiting + re-entering.

---

# 17. V2-only opportunities (not present in V1, surfaced by this audit)

Captured here for forward planning; not part of the preservation list.

- **Section / clipping planes** for vertical sectioning of the model.
- **Per-feature visibility toggles** (e.g. "hide apertures" independently of viz state).
- **HBJSON ↔ project document cross-check** — flag windows in the HBJSON viewer that don't have a matching `window_type` in the project document (PRD §11.4.6 leaves this out of scope for V2 v1; consider for v1.1).
- **Legend-as-filter** — clicking a legend swatch hides all other items.
- **Time-of-year scrubber** for sun path (currently just shows the annual envelope).
- **Make shades selectable** with display_name in a minimal info-panel config.
- **Make sun-path lines hoverable** with hour/month annotation.
- **Surface richer pipe metadata** in the info panel (diameter, insulation, water temp, daily period, length, material).
- **Replace `alert()` with toast/snackbar** for load failures.
- **Per-viewer-tab CSS2D label scoping** so labels don't leak across tabs in the V2 workspace.
- **Switch backend transport to SI canonical (m³/s)** per PRD §11.5 and remove the backend's m³/s → m³/h conversion.
