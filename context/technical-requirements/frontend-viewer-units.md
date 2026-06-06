---
DATE: 2026-05-12
STATUS: CANONICAL TECHNICAL REQUIREMENTS — extracted from context/PRD.md to keep startup context small.
RELATED: context/PRD.md §11, context/UI_UX.md,
         context/technical-requirements/data-table.md,
         context/user-stories/40-model-viewer.md
---

# PH-Navigator V2 — Frontend / Viewer / Units Requirements

This file preserves implementation-level requirements that were formerly
embedded in `context/PRD.md`. Load it on demand when touching this surface;
do not make it part of default startup context.

## 11. Frontend

TypeScript / React. Restricted to display + UI/UX.

### 11.1 Top-level surfaces

- **Project list** (editor home, `/dashboard`) — owned-by-current-user
  projects, with pinning + per-user ordering; "Catalogs ▾" dropdown
  in the global header.
- **Project workspace** (`/projects/{id}/{tab}`) — five tabs:
  - **Status** (default landing) — project lifecycle / cert
    milestones (US-Status).
  - **Windows** — window types (US-Builder-Windows).
  - **Envelope** — assemblies (US-Builder-Envelope).
  - **Equipment** — rooms + future MEP equipment tables.
  - **Model** — 3D HBJSON viewer (§11.4).
  - **Project header bar** above the tabs:
    project name + bt_number + client (left); version dropdown
    (US-3.1, *not* a tab — always-visible chrome) + save status +
    Save / Save-As / `⋯` menu + IP/SI units toggle (right).
    Document/version chrome is owned by `features/project_document`
    and reads document-level draft summary state; table-specific
    actions such as table JSON downloads live with the table surface.
- **Catalog manager** (`/catalog/{slug}`) — separate top-level area;
  CRUD on catalog tables. Reached via the global header's
  "Catalogs ▾" dropdown.
- **Diff view** — modal; pick two versions or version-vs-draft.
- **Viewers** access the **same** project workspace
  URL (`/projects/{id}/...`) — there is no separate viewer URL
  shape. Frontend hides edit affordances when not authenticated;
  backend rejects writes without a session token. Non-logged-in
  viewers see Status / Windows / Envelope / Equipment / Model
  tabs read-only, can browse versions, and can download project
  JSON / table JSON / HBJSON.

There is **no top-level "Versions" tab** — versions live in the
header dropdown to keep "current version" always visible and
gate switches behind an explicit Open gesture (US-3.1).
There is **no top-level "Settings" tab** — project settings
(rename, transfer ownership, delete) live behind the project
header `⋯` overflow menu (US-Settings).

### 11.2 Editor state model — three layers

| Layer | What it is | Persistence |
|---|---|---|
| **Document body** | The saved version body, fetched on Open. | Postgres `project_versions.body`. Authoritative. |
| **Server-side draft** | The user's WIP, mirrored from the frontend. | Postgres `project_version_drafts.body`. Crash-recovery only. |
| **In-memory document** | Frontend React state — the live editing target. | Browser memory. Lost on close (unless mirrored to draft). |

Editing flow:
1. User opens a version → frontend GETs document body and any existing
   draft. If draft exists and differs from body, prompt restore /
   discard.
2. Each edit appends a guarded JSON-Patch op to a frontend queue.
3. Queue flushes on debounce (~500ms) as a batched PATCH against
   `/api/v1/.../draft`. Backend applies to draft.
4. **No autosave to the version body.** Save / Save As are explicit
   gestures (§8.2).
5. `beforeunload` fires a warning if the draft is dirty (unsaved patch
   ops in the queue or draft differs from version body).

If a write receives 401 because the session expired, the frontend
freezes the local patch queue and re-authenticates in place. After
re-auth it refetches version/draft ETags. Queued patches are retried
only if both ETags still match; otherwise the user chooses reload
draft / keep local edits as a new draft attempt / discard. V1 never
blindly replays stale queued patches.

For BLDGTYP scale (50–500 KB documents), patch-based draft sync is
sub-100ms latency.

### 11.3 Per-table display

Each table type has a column-config that drives rendering. The catalog
POC's `phase_5` shadcn-table component (toolbar with sort/filter/group,
multi-select, copy) is the right base. Per-table columns are declared
in TS (not user-configurable) — schema flexibility lives in code, not
runtime.

Detailed table contract lives in
`context/technical-requirements/data-table.md`.

### 11.4 3D viewer — React Three Fiber

V2 ships an HBJSON viewer (read-only; **not** an editor) as a project
surface. The viewer's source is **HBJSON files uploaded to the project**
— not the project document. The builder / table data and the 3D model
are deliberately disconnected in V2 v1; see §11.4.6 for rationale.

#### 11.4.1 Workflow context

```
┌──────────────────┐     ┌────────────────┐     ┌──────────────────┐
│ PHN builder /    │     │ Rhino +        │     │ PHN HBJSON       │
│ table editors    │ ──▶ │ Grasshopper +  │ ──▶ │ viewer           │
│ (project doc)    │     │ honeybee_ph    │     │ (uploaded files) │
└──────────────────┘     └────────────────┘     └──────────────────┘
  source-of-truth         3D modeling             read-only display
  for design data         platform                of generated model
```

User flow:
1. Edit assemblies / apertures / rooms / equipment in the PHN
   builder.
2. Reference that data while building the 3D model in Rhino.
3. Run honeybee_ph in Grasshopper to export HBJSON.
4. Upload the HBJSON to the project's viewer area in PHN.
5. View it alongside earlier uploaded HBJSONs.

The builder-to-Rhino flow is by hand / by reference, not by API. PHN
is not the geometry-authoring tool.

#### 11.4.2 HBJSON file storage and data model

HBJSON files are 5–20 MB each, with multiple revisions per project
expected over a project's life. They go in object storage, not
Postgres JSONB:

- **Storage:** Cloudflare R2 through the generic `project_assets`
  backbone (§6.5), with `asset_kind = 'hbjson'`.
- **DB records:** `project_assets` owns object metadata and signed URL
  generation; `project_hbjson_files` owns viewer-specific metadata and
  cached geometry/extraction fields.

```sql
project_hbjson_files (
    id                  UUID PRIMARY KEY,
    project_id          UUID NOT NULL REFERENCES projects(id),
    asset_id            TEXT NOT NULL UNIQUE REFERENCES project_assets(id),
    label               TEXT NOT NULL,
                        -- e.g. "Initial massing", "Round 1 Submit Model"
    notes               TEXT,
    hbjson_schema_version  TEXT,          -- if discoverable from the file
    -- Optional, hand-entered: which project version was this generated
    -- against? Informational; no enforced relationship.
    project_version_id  UUID REFERENCES project_versions(id),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by         INTEGER NOT NULL REFERENCES users(id),
    deleted_at          TIMESTAMPTZ
)
CREATE INDEX ON project_hbjson_files (project_id, uploaded_at DESC);
```

Properties:
- HBJSON files are **independent of project_versions.** A project
  version does not own HBJSON files; an HBJSON file optionally records
  which project version it was sourced against (hand-entered metadata).
- HBJSON files are **immutable after upload.** They arrive complete
  from the modeling tool. New revision = new `project_assets` row and
  separate `project_hbjson_files` row.
- Not included in project document JSON downloads. The "download
  project JSON" endpoint returns the builder/table data only. HBJSON
  files have their own download endpoints (§9.11) and a
  `Content-Disposition: attachment` direct link via signed R2 URL.
- Soft-delete only. Deleting a project soft-deletes all its HBJSON
  rows and related assets; R2 objects are GC'd by a periodic sweep once
  retention and reference checks pass (§6.5).

#### 11.4.3 Tech stack

- **`three`** — geometry kernel, materials, lights, post-processing
  primitives. Same library V1 uses (no engine swap).
- **`@react-three/fiber` (R3F)** — declarative React renderer over
  Three.js. Replaces V1's imperative `SceneSetup` + manual animation
  loop.
- **`@react-three/drei`** — ready-made `OrbitControls`, `Bounds`,
  `Edges`, `Outlines`, `GizmoHelper`, performance helpers.
- **`@react-three/postprocessing`** — declarative effect composer
  (replaces V1's hand-rolled `world.composer.render()`).
- **HBJSON loaders** — port V1's `load_faces`, `load_spaces`,
  `load_erv_ducting`, `load_hot_water_piping`, `load_sun_path`,
  `load_shades`, `load_space_floors` as plain TS functions taking a
  parsed HBJSON object and returning `BufferGeometry` / `Object3D`.
  R3F hosts the result via `<primitive>` or by mapping to declarative
  `<mesh>` / `<lineSegments>` / `<group>` JSX. **The loaders read
  HBJSON, not the project document.**
- **Viewer state** — Zustand store. Replaces V1's six nested context
  providers (`SelectedModelContext`, `AppVizState`, `AppToolState`,
  `ColorBy`, `SelectedObject`, `HoverObject`).

#### 11.4.4 Why R3F (grounded in V1 review)

V1's `model_viewer/` works but carries scaffolding cost that R3F
removes:

| V1 pattern | Why it exists | R3F equivalent |
|---|---|---|
| 6 nested `<...ContextProvider>` in `Viewer.tsx` (l.34–55) | Each tool / viz state needs its own React state | One Zustand store; subscribers select slices |
| Custom `addToolStateEventHandler` / `addVizStateMountHandler` registries with manual `mount`/`dismount` lists | React lifecycle wasn't reachable from imperative scene code | Standard React `useEffect` per scene component; mount = render, dismount = cleanup |
| Empty-deps animation `useEffect` with side-effect manual `requestAnimationFrame` (l.334–354) | Scene was outside React | R3F runs the loop; `useFrame` hooks into it cleanly |
| `mountRef.current?.appendChild(world.current.renderer.domElement)` | Imperative DOM mount | `<Canvas>` component |
| `world.current.scene.add(dimensionLinesRef.current)` during render in `Viewer.tsx` (l.30) | No declarative way to add a group | `<group ref={...}>` in JSX |
| `useCallback` with `eslint-disable-next-line react-hooks/exhaustive-deps` in 6+ places (l.83–127) | Stale-closure dance against the imperative scene | Subscribe to Zustand → no stale deps |
| Hand-rolled outline / wireframe / vertex visibility juggling per viz state | Three has no React-aware lifecycle | Conditional JSX: `{vizState === 'showSpaces' && <SpaceMeshes />}` |

The HBJSON viewer is a near-perfect R3F use case: static or
infrequently-updated geometry, view modes (color-by, sun-path, ERV
ducting), pick / hover interactions, no transform gizmos, no per-vertex
editing. R3F's strengths line up exactly.

#### 11.4.5 What we keep from V1

- HBJSON parsing logic in the loaders.
- Color-by attribute mappings and legend logic.
- Tool / viz state enums and handlers (rewritten as Zustand slices).
- The viewer behavior and domain vocabulary: color-by modes, legends,
  object selection, metadata inspection, measure/select tools, and
  model-file switching.

What changes from V1:

- Composition should be full-bleed or near full-bleed under the project
  header, not a generic page panel.
- Toolbars, legends, file picker, and inspector should be redesigned
  around the V2 workbench shell in `context/UI_UX.md`.
- Visual styling should use the BLDGTYP token system and avoid carrying
  forward MUI/default-blue/magenta-as-everything semantics.

The work is a **port**, not a rewrite from scratch. Rough scope: ~2
weeks of focused frontend work assuming the loaders and color-by logic
are mostly portable.

Compatibility: R3F is a renderer for React; same React, same Vite,
same TS, same component library as the rest of V2. Zero stack
incompatibility. R3F adds ~30 KB gzipped; drei is tree-shakable.
Rendering performance is comparable to vanilla Three for our scene
complexity (<100k triangles per project; well under R3F's practical
ceiling).

#### 11.4.6 The deliberate disconnect from builder data

V2 v1 explicitly does **not** connect builder/table data (project
document) to the viewer. The two live side-by-side in the same project
without a code-enforced relationship. Rationale:

- **Rhino + Grasshopper + honeybee_ph remain the canonical 3D modeling
  toolchain at BLDGTYP.** Replicating their geometry capability in a
  web app is a large effort and not the V2 goal.
- **Builder/table data is the source-of-truth for design decisions**
  (assemblies, equipment, rooms). It flows *into* Rhino by reference
  (Ed reads PHN, types into GH), not as a programmatic export.
- **HBJSON is the canonical exchange format** between Rhino and
  downstream tools (PHX → WUFI / PHPP). Treating it as an upload
  artifact in PHN preserves that role.
- A future phase may bridge the two (validate that an uploaded
  HBJSON's apertures match the project document's `tables.apertures[]`,
  generate Rhino-ready exports from the project document, or
  eventually fold geometry authoring into PHN). Out of scope for V2
  v1; this PRD does not commit to a direction.

This disconnect is acknowledged-not-loved. The constraint is honest
about current workflow; the design leaves room for a later bridge
without forcing one prematurely.

### 11.5 Units architecture — backend is SI, frontend converts

**Hard rule:** all physical quantities in PHN-V2 are stored,
transmitted, and computed in SI canonical units. **Conversion
between SI and IP (Imperial) is exclusively a frontend concern.**

This mirrors V1's model and keeps the data layer free of unit
ambiguity.

#### 11.5.1 Where SI-only applies

- **Project document body (JSONB)** — every numeric field uses SI
  canonical units. Field names embed the unit
  (`width_mm`, `conductivity_w_mk`, `density_kg_m3`,
  `specific_heat_j_kgk`, `airflow_m3h`, `pressure_pa`, etc.) so
  the unit is self-documenting.
- **REST API request and response bodies** — values in, values out:
  SI. Backend rejects (or coerces with a warning) any value that
  arrives in non-SI units.
- **JSON-Patch `op.value` fields** — SI.
- **Catalog tables (Postgres columns)** — SI typed columns.
- **MCP tool inputs and outputs** — SI. LLMs always work in SI;
  zero unit ambiguity for prompt-driven edits.
- **JSON downloads (project + per-table)** — SI. External
  consumers (future GH / PHX integration) get the canonical form.
- **Internal calculations** (when calculations land in V2) — SI
  throughout.

#### 11.5.2 Where conversion happens

- **Frontend display layer.** A units module reads
  `users.units_preference` ('IP' or 'SI', default SI) and:
  - On render: converts SI from server to display units, formats
    with the appropriate suffix ("0.034 W/(m·K)" vs "R-7.6/in").
  - On input: parses user input in display units, converts to SI,
    sends SI to the API.
  - Round-trips must preserve precision (no double-conversion
    drift across edits).
- **Frontend tests must cover the round-trip** for each quantity:
  user types value in IP → frontend converts to SI → backend
  stores SI → frontend reads SI → frontend converts to IP →
  display matches user's original input within rounding tolerance.

#### 11.5.3 Implementation notes

- **TS units strategy — resolved 2026-05-11.** V2 follows the V1
  frontend pattern but formalizes it into quantity-specific helpers.
  Do not port the whole Python `PH_units` package and do not add a
  generic units dependency for MVP. Create focused helpers under
  `frontend/src/lib/units/` by quantity family (`length`, `thermal`,
  `airflow`, `pressure`, `power`, etc. as needed). APIs should be
  explicit, e.g. `parseLengthToMm`, `formatLengthFromMm`,
  `formatUValueFromSI`, not "convert any unit to any unit."
- **V1 precedent / templates.** Use these V1 files as research
  references, not import paths:
  - `../ph-navigator/frontend/src/formatters/Unit.Converter.ts`
  - `../ph-navigator/frontend/src/formatters/Unit.ConversionFactors.ts`
  - `../ph-navigator/frontend/src/features/project_view/_hooks/useUnitConversion.tsx`
  - `../ph-navigator/frontend/src/features/project_view/_contexts/UnitSystemContext.tsx`
  - `../ph-navigator/frontend/src/features/project_view/_components/UnitSystemToggle.tsx`
  - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/displayUnitConverter.ts`
  - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/parseInput.ts`
  - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/parseFeetInches.ts`
  - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/formatFeetInches.ts`
  - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/__tests__/`
- **V1 conversion-factor caveat.** Reuse the V1 shape and test corpus,
  not the V1 constants blindly. Thermal factors and reciprocal
  quantities must be verified against fixtures before landing in V2.
- **Schema migrations preserve units.** A field rename or shape
  change must not silently swap units. The golden-file corpus
  (§10.5) tests the round-trip; new shims are tested for unit
  preservation.
- **Toggle UX.** The IP/SI toggle lives in the global
  `<WorkspaceTopbar>` (`frontend/src/shared/ui/TopbarUnitToggle.tsx`)
  and edits `users.units_preference` through the session round-trip.
  Toggling re-renders every numeric value in the active page —
  catalog managers, project-document tables, and the 3D viewer all
  read the same `useUnitPreference` context. The earlier `ModalUnitToggle`
  remains for in-dialog editors that need a local segmented control.

#### 11.5.4 Anti-patterns banned

- Don't accept "12 in" or "0.305 m" as ambiguous strings; the API
  takes a number whose unit is implied by the field name.
- Don't store "IP-flavored" SI values (e.g. "this column is in mm
  unless the user is in IP mode"). Field semantics are fixed.
- Don't convert units server-side based on a request header or
  user preference. Backend has no notion of user preference for
  numeric values.

#### 11.5.5 DataTable Number with Units

Generic per-Number-field unit config that lets a single DataTable
column participate in the SI/IP toggle without inventing a new
`field_type`. The quantity-specific helpers under
`frontend/src/lib/units/` (§11.5.3) stay as-is for bespoke surfaces
(`ProjectMaterialEditor`, the 3D viewer, etc.); this section covers how
the DataTable consumes them.

- **Closed registry.** `frontend/src/lib/units/numberUnits.ts` exposes
  `NUMBER_UNIT_TYPES` — `density`, `conductivity`, `specific_heat`,
  `length`, `area`, `volume` — each with one SI unit, one IP unit, and
  per-system decimal precision. The same registry is mirrored by the
  backend; `registry_snapshot` round-trip tests pin the two ends
  together. No `R/in` in MVP — reciprocal/derived display belongs in a
  named helper, not the generic conductivity pair.
- **FieldDef payload.** `FieldDef.numberUnits` is the validated
  `NumberUnitsConfig` (`mode`, `unit_type`, `si_unit`, `ip_unit`,
  `precision_si`, `precision_ip`). Absent means "plain Number" —
  unchanged from V1 behavior.
- **Mode.**
  - `"editable"` — user-authored Number fields opt in / edit / remove
    units through the field-config modal.
  - `"fixed"` — catalog / domain built-ins (e.g. material density,
    conductivity) lock the unit config to the canonical contract.
    The modal renders fixed controls disabled with a "Units are fixed
    by this catalog field." hint; the backend rejects user mutations
    through both `editFieldBundle` and direct `changeType`.
- **Display + edit pipeline.** Cell render, inline editor seed, paste
  coerce, copy, filter compare, and aggregation all consult
  `formatNumberUnitsDisplay` + `parseNumberUnitsInput`, threading the
  active `unitSystem` from `useUnitPreference`. Stored values stay
  canonical SI on every write; aggregates reduce on SI and format in
  the active system. The header shows the active unit label
  (`m` / `ft` etc.) as a quiet chip; cells never carry a per-cell
  suffix.
- **Toggle semantics.** Flipping the global SI/IP toggle is render-only
  (re-renders every cell + the header chip + aggregates) and never
  dirties an open editor draft or fires an `onWrite`. A change to a
  field's `numberUnits` config drops persisted filter rules for that
  field — stored filter strings were typed in the prior system and
  would be ambiguous after a swap. All unrelated view state (sort,
  group, widths, hidden columns, filters on other fields) is preserved.
- **Fixed-mode anchors.** The Materials catalog DataTable seeds
  fixed-mode `numberUnits` for `density_kg_m3` (`kg_m3 ↔ lb_ft3`),
  `specific_heat_j_kgk` (`j_kg_k ↔ btu_lb_f`), and `conductivity_w_mk`
  (`w_m_k ↔ btu_h_ft_f`) — see
  `frontend/src/features/catalogs/materials/fieldDefs.ts`. Other catalog
  / domain built-ins that need SI/IP display follow the same pattern.
