# 3D Model Viewer Guide

Technical reference for the 3D Model Viewer feature. This component displays Passive House building geometry, spaces, HVAC systems, and solar analysis in an interactive THREE.js viewer.

## 1. Overview

**Purpose**: Read-only 3D visualization of Honeybee model data loaded from AirTable HBJSON files.

**Key Characteristics**:
- View-only (no editing - all model changes done in Rhino3D)
- Data sourced from AirTable via backend API
- Built on THREE.js with React integration
- State-machine architecture for visualization modes and tools

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Viewer.tsx (Entry)                       │
│  - Context providers (4 nested)                                 │
│  - SceneSetup instance                                          │
│  - Dimension lines group                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   World.tsx   │    │   Model.tsx   │    │BottomMenubar  │
│ - Animation   │    │ - Data fetch  │    │ - UI controls │
│ - Events      │    │ - Loaders     │    │               │
│ - State mount │    │ - Loading UI  │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
```

## 3. File Structure

```
frontend/src/features/project_view/model_viewer/
├── Viewer.tsx                 # Entry point, context setup
├── World.tsx                  # Animation loop, event routing, state handlers
├── Model.tsx                  # Data loading orchestration
│
├── _components/
│   ├── BottomMenubar.tsx      # Main toolbar container
│   ├── VizStateMenubar.tsx    # Visualization mode buttons
│   └── ToolStateMenubar.tsx   # Tool selection buttons
│
├── _contexts/
│   ├── app_viz_state_context.tsx    # Current visualization state
│   ├── app_tool_state_context.tsx   # Current tool state
│   ├── selected_object_context.tsx  # Selected 3D object tracking
│   └── hover_object_context.tsx     # Hover state tracking
│
├── _handlers/
│   ├── selectObject.tsx       # Click/hover material changes
│   ├── selectMesh.tsx         # Raycasting for mesh selection
│   ├── selectPoint.tsx        # Raycasting for vertex selection
│   ├── modeMeasurement.tsx    # Measurement tool logic
│   ├── modePipes.tsx          # Pipe interaction (highlight)
│   └── onResize.tsx           # Window resize handler
│
├── states/
│   ├── VizState.ts            # Visualization state machine
│   └── ToolState.ts           # Tool state machine
│
├── scene_setup/
│   ├── SceneSetup.tsx         # THREE.js scene, camera, renderer, groups
│   ├── Materials.tsx          # Material definitions
│   └── Lighting.tsx           # Light configuration
│
├── loaders/
│   ├── load_faces.tsx         # Building geometry
│   ├── load_spaces.tsx        # PH space volumes
│   ├── load_space_floors.tsx  # PH space floor segments
│   ├── load_sun_path.tsx      # Solar diagram
│   ├── load_hot_water_piping.tsx   # DHW piping
│   ├── load_erv_ducting.tsx   # Ventilation ducting
│   └── load_shades.tsx        # Shading elements
│
├── to_three_geometry/
│   ├── honeybee/
│   │   └── face.tsx           # HB Face → THREE.Mesh
│   └── ladybug_geometry/
│       ├── geometry2d/        # 2D arc, line converters
│       └── geometry3d/        # 3D face, line, polyline, arc converters
│
├── types/
│   ├── honeybee/              # Face, Aperture, Shade, BoundaryCondition
│   ├── honeybee_ph/           # Space, Volume, Floor types
│   ├── honeybee_phhvac/       # Hot water, ventilation system types
│   ├── honeybee_energy/       # Construction, material types
│   ├── ladybug/               # Sunpath types
│   └── ladybug_geometry/      # Geometry primitives (Point3D, Face3D, etc.)
│
└── styles/
    └── styled_components/     # Tooltip styling
```

## 4. State Management

### 4.1 Visualization States (VizState)

Controls which geometry groups are visible. Only one active at a time.

| State | Enum | Shows |
|-------|------|-------|
| None | 0 | Building geometry (default) |
| Geometry | 1 | Building faces + wireframes |
| SpaceFloors | 2 | Floor segments + building wireframes |
| Spaces | 3 | Space volumes + building wireframes |
| SunPath | 4 | Building + sun path diagram + shading |
| Ventilation | 5 | Building wireframes + ERV ducting |
| HotWaterPiping | 6 | Building wireframes + DHW piping |

### 4.2 Tool States (ToolState)

Controls active interaction mode. Only one active at a time.

| State | Enum | Function |
|-------|------|----------|
| None | 0 | No interaction |
| Select | 1 | Click to select, hover to highlight |
| Measure | 2 | Click vertices to measure distances |
| Comments | 3 | (Planned - not implemented) |

### 4.3 State Machine Pattern

Both VizState and ToolState use the same pattern:

```typescript
class State {
    eventHandlers: { [event: string]: Function }    // Window events (click, pointermove)
    mountHandlers: { [event: string]: Function }    // Run when state activates
    dismountHandlers: { [event: string]: Function } // Run when state deactivates
}
```

**World.tsx** manages state transitions via useEffect:
1. When state changes, run new state's `mountHandlers`
2. Add new state's `eventHandlers` to window
3. Cleanup: run previous state's `dismountHandlers`, remove previous `eventHandlers`

### 4.4 Object Selection Context Pattern

Both `selectedObjectContext` and `hoverObjectContext` use dual-tracking:
- `useState` for React component updates
- `useRef` for immediate THREE.js access

```typescript
// From selected_object_context.tsx
const [selectedObject, setSelectedObject] = useState<THREE.Mesh | null>(null);
const selectedObjectRef = useRef<THREE.Mesh | null>(null);
```

> **Investigation Needed**: This pattern was implemented to avoid circular update issues between React and THREE.js. The specific bug this solved is not documented - needs testing to verify if still necessary.

## 5. Data Flow

### 5.1 Frontend Loading Sequence

```
1. Viewer mounts
   └─> Creates SceneSetup (THREE.js world)

2. Model component mounts
   └─> useEffect triggers on projectId change
       └─> get3DModelData(projectId) fetches all endpoints in parallel:
           - GET /hb_model/{projectId}/faces
           - GET /hb_model/{projectId}/spaces
           - GET /hb_model/{projectId}/sun_path
           - GET /hb_model/{projectId}/hot_water_systems
           - GET /hb_model/{projectId}/ventilation_systems
           - GET /hb_model/{projectId}/shading_elements

3. Loaders convert API data to THREE.js objects
   └─> Each loader adds geometry to appropriate SceneSetup groups

4. VizState handlers control group visibility
```

### 5.2 Backend Data Sources

```
Frontend Request
      │
      ▼
Backend Route (routes.py)
      │
      ▼
Service Layer (hb_model.py, epw.py)
      │
      ├─> Check in-memory cache (1hr TTL, max 10 projects)
      │
      └─> Cache miss:
          ├─> Query Postgres for project → AirTable base mapping
          ├─> Fetch HBJSON/EPW file URL from AirTable
          ├─> Download and parse file
          └─> Cache result
      │
      ▼
Model Elements Service (model_elements.py)
      │
      └─> Extract/transform specific data (faces, spaces, systems)
      │
      ▼
Pydantic Schema serialization
      │
      ▼
JSON Response
```

## 6. THREE.js Scene Structure

### 6.1 Geometry Groups (SceneSetup)

All loaded geometry is organized into groups for visibility control:

| Group | Contents |
|-------|----------|
| `buildingGeometryMeshes` | Face meshes, aperture meshes, vertex helpers |
| `buildingGeometryOutlines` | Face/aperture wireframes |
| `buildingGeometryVertices` | Vertex points (for measurement tool) |
| `spaceGeometryMeshes` | Space volume meshes |
| `spaceGeometryOutlines` | Space wireframes |
| `spaceGeometryVertices` | Space vertex points |
| `spaceFloorGeometryMeshes` | Floor segment meshes |
| `spaceFloorGeometryOutlines` | Floor wireframes |
| `spaceFloorGeometryVertices` | Floor vertex points |
| `sunPathDiagram` | Analemma lines, day arcs, compass |
| `pipeGeometry` | Hot water piping (LineSegments2) |
| `ventilationGeometry` | ERV ducting (LineSegments2) |
| `shadingGeometryMeshes` | Merged shade meshes |
| `shadingGeometryWireframe` | Shade edge lines |
| `selectableObjects` | Dynamic group - holds currently selectable geometry |

### 6.2 Materials (Materials.tsx)

| Material | Use |
|----------|-----|
| `geometryStandard` | Building face meshes (white) |
| `geometryWindow` | Aperture meshes (semi-transparent) |
| `geometryShading` | Shade meshes (grey) |
| `geometrySelected` | Highlighted selection |
| `geometryHoverOver` | Hover preview |
| `groundShadow` | Ground plane shadow receiver |
| `wireframe` | Edge lines |
| `dimensionLine` | Measurement lines |
| `sunpathLine` | Dashed sun path lines |
| `pipeLine` / `pipeLineHighlight` | Piping lines |
| `ductLine` | Ventilation duct lines |

### 6.3 Rendering Pipeline

```
requestAnimationFrame loop:
  1. controls.update()           # OrbitControls
  2. composer.render()           # EffectComposer → RenderPass
  3. labelRenderer.render()      # CSS2DRenderer for DOM labels
```

## 7. Geometry Conversion

### 7.1 Honeybee Face → THREE.js

```
hbFace (API response)
    │
    ▼
convertHBFaceToMesh() [to_three_geometry/honeybee/face.tsx]
    │
    ├─> convertLBTFace3DToMesh() [ladybug_geometry/geometry3d/face.tsx]
    │   ├─> Create BufferGeometry from vertices
    │   ├─> Set face indices for triangulation
    │   ├─> Compute vertex normals
    │   └─> Create wireframe from boundary
    │
    └─> Returns: { mesh, wireframe, vertices, vertexHelper }
```

### 7.2 userData Attachments

Loaders attach metadata to mesh.userData for selection display:

**Face meshes**:
- `identifier`, `display_name`, `face_type`
- `boundary_condition`
- `energy.construction` (with `r_factor`, `u_factor`)

**Space meshes**:
- `identifier`, `name`, `number`
- `floor_area`, `weighted_floor_area`, `net_volume`, `avg_clear_height`

**Piping**:
- `diameter`, `insulation` properties, `water_temperature`, `material`

## 8. Backend API Reference

All routes prefixed with `/hb_model/{bt_number}/`

| Endpoint | Rate Limit | Returns |
|----------|------------|---------|
| `/faces` | 5/min | Building faces with apertures, constructions, R/U values |
| `/spaces` | 5/min | PH spaces with volumes, floors, computed areas |
| `/sun_path` | None | Sunpath diagram geometry (analemmas, arcs, compass) |
| `/hot_water_systems` | 5/min | DHW systems with trunk/branch/fixture piping |
| `/ventilation_systems` | 5/min | ERV systems with supply/exhaust ducting |
| `/shading_elements` | 5/min | Grouped shade surfaces with merged meshes |

**Key Backend Files**:
- `backend/features/hb_model/routes.py` - Route definitions
- `backend/features/hb_model/services/hb_model.py` - Model loading/caching
- `backend/features/hb_model/services/epw.py` - Weather file loading
- `backend/features/hb_model/services/model_elements.py` - Data extraction

## 9. Known Issues & Technical Debt

### 9.1 Performance Issues

- **SAOPass disabled**: Ambient occlusion post-processing causes jagged lines and poor performance. Currently commented out in SceneSetup.tsx:64-80. Viewer shows flat-shaded wireframes only.

- **No dynamic scaling**: World size (ground plane, grid, sun path, camera position, light shadow bounds) is hard-coded for house-scale projects (~25m). Does not adapt to larger buildings (apartments).

### 9.2 Functional Issues

- **Measurement tool vertex snapping unreliable**: selectPoint.tsx raycasting doesn't consistently find vertices. Needs investigation.

- **Text labels disabled**: Troika text labels on apertures don't orient correctly to face normals. Code exists but is commented out in load_faces.tsx:113-115.

### 9.3 Code Quality

- **File extensions**: Some non-React files use `.tsx` instead of `.ts` (type definitions, utilities). Should be cleaned up during refactoring.

- **ESLint suppressions**: Several `// eslint-disable-next-line react-hooks/exhaustive-deps` in World.tsx. These exist because tool event handlers are registered at module level with useCallback - pattern may need review.

- **Dual-tracking pattern**: selected_object_context and hover_object_context use both useState and useRef. Original bug this solved is undocumented - needs testing to verify necessity.

### 9.4 Planned Features

- **Comments tool**: ToolState enum includes Comments (3) but no implementation exists yet.

## 10. Adding New Features

### 10.1 New Visualization State

1. Add enum value to `states/VizState.ts`
2. Add mount handler in `World.tsx` (show geometry groups)
3. Add dismount handler in `World.tsx` (hide geometry groups)
4. Add button to `_components/VizStateMenubar.tsx`

### 10.2 New Tool State

1. Add enum value to `states/ToolState.ts`
2. Add event handlers in `World.tsx` using `addToolStateEventHandler()`
3. Add dismount handler for cleanup
4. Add button to `_components/ToolStateMenubar.tsx`
5. Create handler functions in `_handlers/`

### 10.3 New Geometry Type

1. Create TypeScript types in `types/`
2. Add backend endpoint in `backend/features/hb_model/routes.py`
3. Add schema in `backend/features/hb_model/schemas/`
4. Add extraction function in `backend/features/hb_model/services/model_elements.py`
5. Add to `frontend/src/api/get3DModelData.tsx`
6. Create loader in `loaders/`
7. Create converter in `to_three_geometry/` if needed
8. Add THREE.Group to `SceneSetup.tsx`
9. Wire into relevant VizState mount/dismount handlers

## 11. Key Patterns

### 11.1 Loader Pattern

```typescript
export function loadXxx(world: React.RefObject<SceneSetup>, data: XxxType[]) {
    data.forEach(item => {
        const geom = convertXxxToMesh(item);
        geom.mesh.name = item.display_name;
        geom.mesh.userData['type'] = 'xxxMesh';
        geom.mesh.material = appMaterials.geometryStandard;
        world.current.xxxGeometryMeshes.add(geom.mesh);
        // ... wireframes, vertices
    });
}
```

### 11.2 Selection Material Swap

```typescript
// Store original material
mesh.userData['materialStore'] = mesh.material;

// Apply highlight
mesh.material = appMaterials.geometrySelected;

// Restore
mesh.material = mesh.userData['materialStore'];
```

### 11.3 Selectable Objects Management

```typescript
// Mount: Add to selectable group
world.current.selectableObjects.add(world.current.buildingGeometryMeshes);

// Dismount: Move back to scene (THREE objects can only have one parent)
world.current.clearSelectableObjectsGroup(); // Moves children back to scene
```
