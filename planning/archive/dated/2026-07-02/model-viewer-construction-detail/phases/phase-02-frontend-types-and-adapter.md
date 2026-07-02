---
DATE: 2026-07-01
TIME: -
STATUS: ✅ DONE (2026-07-01) — implemented on
  feature/model-viewer-construction-detail with as-built amendments (see
  §7 As-built notes).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 2 — frontend types for the
  detailed `constructions` map, thread it into the loaded model, and a
  pure honeybee-construction → layer-geometry adapter. No UI yet.
RELATED:
  - ../PRD.md §4.3 (drawing model), §5 (D-4/D-5), §6 (data contract)
  - ../PLAN.md Phase 2
  - frontend/src/features/model_viewer/types.ts
  - frontend/src/features/model_viewer/loaders/building.ts
  - frontend/src/features/envelope/canvas-geometry.ts (pattern reference)
---

# Phase 2 — Frontend: types + layer-geometry adapter

## 1. Goal

Mirror Phase 1's wire contract in TS, make the loaded model expose the
`constructions` map, and add a **pure** adapter that turns one detailed
construction into an ordered layer/segment geometry the modal (Phase 3)
draws and tabulates. No component, store-action, or rendering change that
a user can see — types + one pure function + one plumbing line.

## 2. Required reading (in order)

1. `../PRD.md` §4.3, §5 (D-4 reuse-pattern-not-code, D-5 one-render-path),
   §6 (the exact wire shape Phase 1 ships).
2. `frontend/src/features/model_viewer/types.ts` — `OpaqueConstruction`
   (l.80-87, the thin per-face summary — **unchanged**, faces keep it),
   `FaceModelData` (l.98-111), `CombinedModelData` (l.309-316, gains the
   map).
3. `frontend/src/features/model_viewer/loaders/building.ts` —
   `buildBuildingModel(data)` (l.86-139) already receives the whole
   `CombinedModelData` and returns `BuildingModel` (l.74-84). This is
   where `data.constructions` is threaded onto the model.
4. `frontend/src/features/envelope/canvas-geometry.ts:26-59`
   (`buildAssemblyCanvasGeometry`) — the **reference algorithm**: layers
   stacked by thickness, segments laid out by width. Reimplement the
   shape against the honeybee construction; **do not import** it (D-4,
   D-8 — it is coupled to the editable `Assembly`/`AssemblySegment`
   types).

## 3. Work breakdown

### 3.1 Types (`types.ts`)

Add, mirroring Phase 1's schema (§6):
```ts
export type PhColor = { a: number; r: number; g: number; b: number };

export type ConstructionMaterial = {
  type: string;
  identifier: string;
  display_name: string | null;
  thickness: number;            // meters
  conductivity: number;         // W/mK
  properties: {
    ph: {
      ph_color: PhColor | null;
      divisions: {
        column_widths: number[];   // meters; [] = homogeneous
        row_heights: number[];
        steel_stud_spacing_mm: number | null;
        cells: { row: number; column: number; material: ConstructionMaterial }[];
      };
    } | null;
  } | null;
};

export type DetailedOpaqueConstruction = {
  identifier: string;
  type: string;
  u_factor: number | null;
  u_value: number | null;
  r_factor: number | null;
  r_value: number | null;
  materials: ConstructionMaterial[];
};
```
Add `constructions: Record<string, DetailedOpaqueConstruction>` to
`CombinedModelData` (l.309). Leave `OpaqueConstruction` (the per-face
summary) as-is.

### 3.2 Thread the map onto the model (`loaders/building.ts`)

Add `constructions: Record<string, DetailedOpaqueConstruction>` to
`BuildingModel` (l.74-84) and set it in `buildBuildingModel` from
`data.constructions ?? {}` (l.128-138 return). No other loader change —
faces still read their thin summary as today.

### 3.3 The adapter (new pure module, e.g. `lib/constructionLayers.ts`)

`buildConstructionLayers(construction: DetailedOpaqueConstruction):
ConstructionLayer[]` where:
```ts
type ConstructionCell = {
  label: string;                // material display_name ?? identifier
  color: string | null;         // rgba() from ph_color, or null → fallback
  thickness: number;            // m (= layer thickness)
  conductivity: number;         // W/mK
  widthFraction: number;        // 0..1, normalized column width
  steelStudSpacingMm: number | null;
};
type ConstructionLayer = {
  index: number;
  label: string;
  thickness: number;            // m
  conductivity: number;         // W/mK (homogenized outer value)
  rValue: number;               // thickness / conductivity (SI m²K/W)
  cells: ConstructionCell[];    // ≥1; flat layer = single full-width cell
};
```
Rules (D-5 — one path for flat and detailed):
- Iterate `materials` in order (exterior→interior — Phase 4 confirms the
  label direction; the adapter just preserves array order).
- If `properties?.ph?.divisions?.cells?.length` → one `ConstructionCell`
  per cell, `widthFraction = column_widths[cell.column] / Σcolumn_widths`
  (guard empty/zero sum → equal fractions); color from the **cell**
  material's `ph_color` (D-6).
- Else → a single full-width cell (`widthFraction = 1`) colored by the
  layer material's `ph_color`.
- `rValue = conductivity > 0 ? thickness / conductivity : 0` (guard).
- Color helper: `ph_color` → `rgba(r,g,b,a/255)`; `null` → a defined
  neutral fallback constant (D-6). Keep the fallback local to the modal
  feature — do not reuse Envelope's `materialColor` (D-8).

## 4. Out of scope

Any React component, modal, SVG, store selector the modal needs, or the
inspector button (Phases 3-4). Window constructions (D-1). Unit
formatting — the adapter returns raw SI numbers; Phase 3 formats them
through the existing `formatLengthFromMm` / `formatConductivityFromWmK` /
`formatRValueFromM2KPerW` at render time.

## 5. Verification gate

1. **Vitest** for `buildConstructionLayers` against fixtures mirroring the
   three sample kinds:
   - flat → each layer has exactly one cell, `widthFraction === 1`;
   - hybrid → the framed layer yields N cells whose `widthFraction` sums
     to 1 (within epsilon), each with a color;
   - steel-stud → the cell surfaces `steelStudSpacingMm`;
   - null `ph_color` → cell `color === null` (fallback resolved in the
     component, not here);
   - `rValue` math on a known thickness/λ;
   - empty/degenerate `column_widths` → equal fractions, no NaN.
2. **Type check**: `cd frontend && pnpm exec tsc -b --pretty false` green
   (type + pure-fn only; nothing renders the new types yet).
3. `make format`.

## 6. Exit criteria

`CombinedModelData` / `BuildingModel` expose the detailed
`constructions` map; `buildConstructionLayers` deterministically converts
any construction (flat or framed) into drawable layers/cells with correct
width fractions and per-layer R; unit tests green; no UI change.

## 7. As-built notes (2026-07-01)

Implemented as specified, with amendments from the simplify review:

- `DetailedOpaqueConstruction = OpaqueConstruction & { materials }` —
  intersection, not a re-declared field list (mirrors the backend's
  schema inheritance).
- `CombinedModelData.constructions` is **optional** (`?`) — artifacts
  extracted before the field existed lack the key (D-9 graceful
  degradation); the loader defaults `data.constructions ?? {}` onto
  `BuildingModel`.
- `ConstructionMaterial` uses `| null` only (no `?`) — the artifact is
  serialized without `exclude_none`, so keys are always present.
- Cell contract extended beyond the §3.3 sketch: cells carry
  `xFraction`/`yFraction`/`heightFraction` grid placement (pre-derived so
  the Phase-3 SVG stays dumb, and Q4 multi-row grids render correctly);
  `steelStudSpacingMm` moved from cell to **layer** (it is
  divisions-level data); the cell's redundant `thickness` was dropped
  (equals layer thickness). No `totalThickness` helper — the modal sums
  `layer.thickness` inline beside its total-R sum.
- 11 Vitest cases in `__tests__/constructionLayers.test.ts` cover flat /
  framed / steel-stud / degenerate-widths / multi-row / color-fallback /
  R-math. `tsc -b` green.
