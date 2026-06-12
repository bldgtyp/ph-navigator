---
DATE: 2026-06-12
TIME: -
STATUS: Ready for handoff — requires Phases 1–2 merged (file picking +
  real /model_data wire). First visible 3D.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Model Viewer Phase 3 — R3F canvas,
  scene dressing, Building lens geometry, always-on selection, inspector
  (Opaque Surface + Window), loading states, camera cluster.
RELATED:
  - planning/features/model-viewer/UI_SPEC.md (§1, §5, §6, §8 — the UI
    contract for this phase)
  - planning/features/model-viewer/decisions.md (D-01, D-04, D-06,
    D-08, D-09, D-12, D-14)
  - context/user-stories/40-model-viewer.md (US-VIEW-2; US-VIEW-4/6
    partial, as recomposed by PRD §4.2/§4.3)
  - research/v1-3d-model-viewer-reference.md (§6 scene, §9.1 face
    loader, §12 selection, §14 gotchas)
  - context/technical-requirements/frontend-viewer-units.md (§11.4
    stack rationale, §11.5 units)
---

# Phase 3 — Viewer core: canvas + Building lens + selection

## 1. Goal

Loading a file renders its faces + apertures as a polished 3D scene:
Z-up damped orbit, fit-on-load, contact shadows, fading grid, SMAA.
Hovering highlights, clicking selects and opens the inspector with
live IP/SI values, double-click zooms to the object. Loading shows
the non-blocking progress chip; errors show in-canvas Retry. No lens
bar yet — the Building lens is implicitly the only view.

## 2. Required reading (in order)

1. `planning/features/model-viewer/UI_SPEC.md` §0–§1 (design intent,
   quadrant layout), §5 (camera), §6 (selection + inspector), §8
   (load/empty/error).
2. `planning/features/model-viewer/PRD.md` §4.2 (always-on
   selection), §4.3 (declarative materials), §6–§7 (stack, perf).
3. `decisions.md` D-04, D-06, D-08, D-09, D-12, D-14 (read the D-14
   implementer notes verbatim).
4. `context/user-stories/40-model-viewer.md` — US-VIEW-2 (scene),
   US-VIEW-6 (field configs: `faceMesh` + `apertureMeshFace` rows
   only, amended by D-12).
5. V1 source for porting reference (read-only):
   `../ph-navigator/frontend/src/features/project_view/model_viewer/`
   — `loaders/load_faces.tsx`, `to_three_geometry/`,
   `_handlers/selectMesh.tsx` (5 px drag-vs-click),
   `_components/ElementInfoPanel/` + `fieldConfigs.ts`.
6. `context/CODING_STANDARDS.md` frontend section (file-size splits,
   feature-first layout).

## 3. Dependencies

```
cd frontend && pnpm add three @react-three/fiber @react-three/drei @react-three/postprocessing
pnpm add -D @types/three
```

pnpm supply-chain protections stay on (`minimumReleaseAge: 1440` in
`pnpm-workspace.yaml`). If the newest release of a package is <24 h
old, pnpm resolves an older one — that is correct behavior; do not
loosen the config. R3F/drei versions must be React-19-compatible
(R3F v9+); if resolution lands on a React-18-only major, stop and
report.

## 4. Architecture

All inside `frontend/src/features/model_viewer/`:

```
store.ts            — Zustand: activeFileId (Phase 1) + lens (fixed
                      'building' for now), hoverId, selectionId,
                      loadPhase, cameraRequest (fit/home/zoomTo)
api.ts / hooks.ts   — useModelData(projectId, fileId) TanStack Query
                      on /model_data; staleTime Infinity (immutable)
loaders/            — PURE functions: DTO → {geometry: BufferGeometry,
                      meta: ObjectMeta}[]; no three-scene side effects;
                      unit-testable without a canvas
scene/              — JSX: <ViewerCanvas>, <SceneDressing>,
                      <BuildingLens>, <SelectionEffects>
components/         — <InspectorPanel>, <LoadingChip>, <CameraCluster>
lib/                — colors.ts (resolve --highlight via
                      getComputedStyle at mount, #E23489 fallback —
                      D-14), fieldConfigs.ts (inspector)
```

Keep components small per CODING_STANDARDS; split rather than grow.

### 4.1 Canvas + scene (US-VIEW-2 as amended by D-08)

- `<Canvas frameloop="demand">`; camera `up=[0,0,1]`, FOV 45, near
  0.1 far 1000, initial `[-25, 40, 30]` → immediate fit-to-model on
  first load (drei `<Bounds>`).
- drei `<OrbitControls makeDefault>` damping on, rotateSpeed 0.9,
  zoomSpeed 3.0; controls invalidate the demand loop while moving.
- Dressing: off-white vertical-gradient background, drei
  `<ContactShadows>` (soft; NOT a hard PCF shadow plane), drei
  `<Grid>` infinite + fading, very low contrast, at z=0, subtle
  edge lines on meshes (drei `<Edges>` or merged line segments —
  pick by perf on the fixture), SMAA only via
  @react-three/postprocessing (no SSAO — US-VIEW-2 crit. 7).
- **Z-up caveat (applies to ALL drei scene helpers, not just the
  grid):** drei assumes Y-up by default. `<Grid>` must be rotated
  to the XY plane; `<ContactShadows>` casts onto a Y-up plane and
  needs the same rotation; verify `<Bounds>` fit and the
  `<GizmoHelper>` cube labels/orientation visually under
  `up=[0,0,1]` before trusting them. Budget a visual check per
  helper — this is the classic Rhino-convention-vs-three trap.
- All chrome floats over a full-bleed canvas per UI_SPEC §1; no
  panel boxing.

### 4.2 Loaders (faces + apertures)

Port V1's `load_faces` logic as pure TS: backend ships triangulated
punched geometry, so the loader maps vertices/faces →
`BufferGeometry` and stamps an `ObjectMeta` record (the full DTO —
the inspector reads it; US-VIEW-7 crit. 8 field names are load-
bearing). Collect face-corner vertices into a positions array now
(Phase 6 Measure snaps to them). One geometry per face/aperture;
shared materials per bucket (PRD §7 — no per-mesh material clones).

### 4.3 Materials — derived, not stashed (D-09)

Mesh appearance = `f(lensDefault, themeColor, isHovered,
isSelected)` computed in render. No `userData['materialStore']`, no
restore bookkeeping. Phase 3 has no themes yet, so the function is
`f(lensDefault, hovered, selected)` — but write the signature with
the theme slot now so Phase 5 extends rather than refactors.
Observable contract to preserve: hover never leaks after
pointer-out; deselect always lands on the current base color.

### 4.4 Selection (D-04, US-VIEW-4 semantics)

- Always-on: R3F pointer events (`onPointerOver/Out`, `onClick`)
  with the 5 px drag-vs-click guard (track pointer-down position;
  V1 `selectMesh.tsx` precedent).
- Hover: subtle emissive/brightness lift + cursor-tether tooltip
  with display name (`Wall · N00_POOL_CELLAR`). Throttle to frame
  rate; never recolors neighbors.
- Click: selection treatment = outline + slight emissive in
  `--highlight` (resolved per D-14; hover uses
  `--highlight-light`/reduced opacity — intensities of one idea).
  Click empty space or Esc → deselect.
- Double-click an object: eased ~400 ms camera focus (zoom-to);
  Esc/Fit recovers.

### 4.5 Inspector (US-VIEW-6 partial, D-12)

Slides in from the right (~320 px, ≤200 ms) when `selectionId` set;
canvas stays full-bleed behind. Configs this phase: **Opaque
Surface** (`faceMesh`) and **Window** (`apertureMeshFace`) per the
US-VIEW-6 roster, with the D-12 Construction section: U-Factor
(primary), U-Value, R-Factor, R-Value for opaque; U-Factor + U-Value
for windows. Tooltips state the film convention + honeybee field
name verbatim (copy in decisions.md D-12). Use
`useUnitPreference()` + existing helpers (`formatAreaFromM2`,
`formatUValueFromWm2K`, `formatRValueFromM2KPerW` from
`frontend/src/lib/units/`) — IP/SI toggle re-renders the open panel
live. Missing values render `--` (deliberate V1 delta — parity
audit #13). Unknown `meta.type` renders the generic fallback card
(header "Element", type string, identifier + copy button — audit
#12). Copy-ID writes the HBJSON identifier with a tick confirmation.
Internal scroll. "Zoom to" button = same path as double-click.

### 4.6 Loading / error states (D-06)

Progress chip top-center: `◌ Downloading model · {MB}` →
`◌ Building scene…` → flash `✓ {faces} surfaces · {spaces} spaces ·
{n} air boundaries not rendered` (from `load_summary`) → collapse.
Use fetch streaming or axios-style progress on the `/model_data`
GET for the download fraction; "Building scene" covers parse +
mount. File switch dims the previous model to ~30% opacity instead
of clearing. Errors follow the D-16 taxonomy from the backend's
`{"kind": ...}` detail: **transient** → destructive-token chip
`⚠ Couldn't load model · [Retry]`; **permanent** (invalid HBJSON /
schema-version mismatch) → `⚠ This file couldn't be parsed` with
the backend's cause line and NO Retry (the file-popover badge from
Phase 1 marks the same file). Everything else stays interactive.
No `alert()`, no global toasts. (The permanent scene-info popover home for the
summary lands with the legend card in Phase 5 — until then the chip
flash is the only surfacing.)

### 4.7 Camera cluster (bottom-right)

drei `<GizmoHelper>` viewport cube (monochrome until hover; face
click = eased snap), **⤢ Fit**, **⌂ Home** (default 3/4 aerial).
Real buttons, aria-labeled, tooltips on hover AND focus. (Keyboard
F/H bindings may land here or in Phase 6 with the full map — if
trivial, bind now.) Measure button placeholder is NOT rendered
until Phase 6.

### 4.8 Scene-ready test hook (cross-phase e2e contract)

E2E specs in this phase AND Phases 4–6 assert scene state through a
test API, never pixels. Define it once, here:

- `window.__phnModelViewer` — present only in dev/test builds
  (gate on `import.meta.env.DEV || import.meta.env.MODE === 'test'`;
  it must NOT exist in the production bundle).
- Shape (extend, never reshape, in later phases):
  `{ loadPhase: 'idle'|'downloading'|'building'|'ready'|'error',
  errorKind: 'permanent'|'transient'|null, activeFileId,
  objectCounts: Record<metaType, number>, lens, selectionId,
  hoverId }` — Phase 5 adds `theme` + `legend: {bucket: count}`,
  Phase 6 adds `measure: {active, lineCount}`.
- Derive it from the Zustand store + loaded meta records (a small
  store subscriber), so it can never disagree with what the React
  tree believes.
- Playwright waits on `loadPhase === 'ready'` instead of timeouts;
  count asserts read `objectCounts` (e.g. 25 faces / 30 apertures
  for the primary fixture).

### 4.9 GPU memory lifecycle

The §4.6 file-switch behavior (old model dims to 30% while the new
one loads) means **two models are resident at once** by design —
with the 52 MB Hillandale file that is a real allocation. When the
swap completes, the old model's subtree must actually unmount (R3F
auto-disposes geometries/materials on unmount — rely on that, don't
hand-dispose, but verify the unmount really happens). Acceptance
check: 5× file switches between the two fixtures with no monotonic
`renderer.info.memory.geometries` growth (expose it through the
§4.8 hook if convenient).

## 5. Out of scope

Lens bar + non-Building lenses (Phase 4), themes/legend (5), Measure
+ Site & Sun + keyboard map + a11y pass (6).

## 6. Verification gate

1. **Vitest**: loaders (golden geometry/vertex counts from the
   fixture DTO — reuse Phase 2's fixture JSON via an API-shape
   sample checked into `frontend/src/features/model_viewer/
   __fixtures__/` or fetched-and-frozen subset; keep it small),
   derived-material function, drag-vs-click guard, fieldConfig
   formatting incl. IP/SI and `--` fallback, token resolution
   fallback (#E23489 when CSS var missing).
2. **Playwright e2e** (`model-viewer-core.spec.ts`): load fixture →
   chip progress appears → scene reaches `loadPhase === 'ready'`
   with the fixture's golden `objectCounts` (via the §4.8 hook) →
   click a wall → inspector shows Opaque Surface with construction
   rows → toggle IP/SI → values re-render → Esc deselects → error
   paths: blocked model_data route (transient) shows Retry; a
   mocked permanent error shows the no-Retry parse-failure message
   (D-16). **CI caveat:** headless Chromium renders WebGL via
   SwiftShader (software) — slower and not pixel-identical to local
   GPU runs. Wait on the §4.8 hook with generous timeouts for the
   Hillandale file; never pixel-compare canvas output in CI.
3. **Playwright MCP walkthrough** (interactive, not committed):
   orbit/fit/select/inspect on `ph_nav_v2_example.hbjson`;
   screenshot for STATUS.md evidence. Strict port 5173; agent user
   `codex@example.com`.
4. **Closeout**: `make format` + `make ci` green (includes prod
   build — watch bundle-size guards; three/drei must be imported
   so Vite code-splits the viewer chunk: lazy-load the ModelTab
   route if the main-bundle guard trips). `graphify update .`.

## 7. Exit criteria

US-VIEW-2 criteria pass as amended by D-08; selection/inspector
behavior per UI_SPEC §6 for the two configured types; BOTH fixtures
load via the UI — the 459 KB canonical and the 52 MB Hillandale
file (the perf canary: progress chip visible throughout, orbit
stays smooth after load; record load wall-time and any jank in
STATUS.md). STATUS.md ledger updated.
