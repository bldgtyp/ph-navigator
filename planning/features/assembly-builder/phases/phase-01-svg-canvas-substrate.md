---
DATE: 2026-06-04
TIME: 13:00
STATUS: Active — not yet started
AUTHOR: Ed May / Claude
SCOPE: Replace the HTML+CSS flexbox canvas substrate with a single
       SVG element whose viewBox is in mm. Drop the three clamps
       in canvas-constants.ts. Add pure geometry helpers. Keep
       the existing chrome (action buttons, layer labels) in
       place — the overlay rebuild lands in Phase 02.
RELATED:
  - planning/features/assembly-builder/PRD.md §3, §5.1, §6
  - planning/features/assembly-builder/assets/v1-reference-to-scale.png
  - frontend/src/features/envelope/components/AssemblyCanvas.tsx
  - frontend/src/features/envelope/canvas-constants.ts
  - frontend/src/features/envelope/lib.ts
---

# Phase 1 — SVG Canvas Substrate

## P0. Why this slice

Phase 01 is the **rendering primitive swap**. It replaces the
flexbox + `background:` substrate in `AssemblyCanvas.tsx` with a
single `<svg viewBox="0 0 maxWidthMm totalThicknessMm">`
containing one `<rect>` per segment. Aspect ratio is enforced by
the SVG renderer itself, not by CSS — so a 0.5"-then-3.5" layer
pair renders at exactly a 1:7 height ratio regardless of viewport
width, with no clamps and no flex compression.

This phase deliberately keeps the existing HTML chrome (per-layer
labels, action buttons) **in place** above the SVG. The chrome is
ugly relative to the V1 reference, but functional. Phase 02
replaces it with the proper overlay model. Splitting this way
keeps each phase's PR reviewable (~400 LOC vs ~1200).

By the end of Phase 01:

- A new `AssemblySvgCanvas.tsx` exists and renders the to-scale
  SVG substrate for any `Assembly` + `ProjectMaterial[]` input.
- Pure geometry helpers in `lib.ts` (offsets in mm, totals)
  feed both Phase 01 and the Phase 02 overlay.
- `canvas-constants.ts` loses its three aspect-ratio-breaking
  clamps and gains a discrete `ZOOM_STEPS` list.
- `AssemblyCanvas.tsx` becomes a thin orchestrator that mounts
  the SVG substrate inside the **existing** outer wrapper +
  action-button chrome.
- Visual fidelity matches `assets/v1-reference-to-scale.png`.

Phase 01 does **not** ship: the new overlay chrome, the
dimension column with inline edit, hover-`+` buttons, the
toolbar, or the pick / paste state machine.

## P1. Acceptance — Phase 1 done when

1. `AssemblySvgCanvas.tsx` renders one `<svg>` per assembly with
   `viewBox="0 0 maxLayerWidthMm totalThicknessMm"` and
   `preserveAspectRatio="xMinYMin meet"`.
2. Each segment renders as exactly one `<rect x y width height>`
   where coordinates are in **mm**, never in px or percent.
   `fill` is the resolved `project_material.color`. The cumulative
   `x` of segment N is `Σ width_mm` for segments 0..N-1 in the
   same layer.
3. Null-material segments render with `fill="none"` and
   `stroke-dasharray="2,2"` + a CSS variable stroke. No clamp on
   visual presence — they render at their actual width.
4. The SVG's rendered `width` / `height` props equal
   `maxLayerWidthMm * BASE_PX_PER_MM * zoom` /
   `totalThicknessMm * BASE_PX_PER_MM * zoom`. No min-* clamp
   on either axis. The SVG can render at any size; the outer
   wrapper provides horizontal scroll when needed.
5. `canvas-constants.ts` no longer exports
   `MIN_LAYER_HEIGHT_PX`, `MIN_SEGMENT_WIDTH_PX`, or
   `MIN_LAYER_WIDTH_PERCENT`. It exports `BASE_PX_PER_MM`,
   `MIN_CANVAS_WIDTH_PX` (wrapper-only), `ZOOM_STEPS`,
   `ZOOM_MIN`, `ZOOM_MAX`, and `pxFromMm(mm, zoom)` — the latter
   now takes no `minPx` argument.
6. `lib.ts` adds and exports four pure helpers:
   - `totalAssemblyThicknessMm(assembly): number`
   - `layerYOffsetMm(assembly, layerIdx): number`
   - `segmentXOffsetMm(layer, segmentIdx): number`
   - `viewBoxFor(assembly): { x, y, width, height }`
   All four are unit-tested with at least three fixtures
   (single-layer, multi-layer, mixed-segment-width).
7. `AssemblyCanvas.tsx` is reduced to: an outer wrapper, the
   existing HTML chrome (layer labels, action-button stack —
   to be removed in Phase 02), and one mounted
   `<AssemblySvgCanvas ... />`. Segment `<rect>`s are no longer
   in `AssemblyCanvas.tsx`'s render tree.
8. Visual diff (manual) against
   `assets/v1-reference-to-scale.png` on a comparable fixture:
   layer proportions match within rendering tolerance. No layer
   is visibly clamped or compressed.
9. `make ci` is green: typecheck, lint, vitest, build.

## P2. Files

### New

- `frontend/src/features/envelope/components/AssemblySvgCanvas.tsx`
- `frontend/src/features/envelope/components/__tests__/AssemblySvgCanvas.test.tsx`
- `frontend/src/features/envelope/__tests__/geometry.test.ts`

### Modified

- `frontend/src/features/envelope/canvas-constants.ts`
  - Delete `MIN_LAYER_HEIGHT_PX`, `MIN_SEGMENT_WIDTH_PX`,
    `MIN_LAYER_WIDTH_PERCENT`.
  - Change `pxFromMm` signature to `(mm: number, zoom: number)
    => number` — drop the `minPx` arg.
  - Add `ZOOM_STEPS = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0]` (Q-AB-6).
  - Keep `BASE_PX_PER_MM = 0.18`, `MIN_CANVAS_WIDTH_PX = 360`,
    `ZOOM_MIN = 0.5`, `ZOOM_MAX = 3.0`.
- `frontend/src/features/envelope/lib.ts`
  - Add the four geometry helpers (§P1.6).
  - Keep existing `materialById`, `materialColor`,
    `maxLayerWidthMm`, `layerWidthMm`.
- `frontend/src/features/envelope/components/AssemblyCanvas.tsx`
  - Remove inline `<article>`-per-segment rendering.
  - Mount `<AssemblySvgCanvas />` in its place.
  - **Keep** the existing action-button stack + layer-label
    column unchanged for now (a kludge — Phase 02 replaces
    them). Position them via existing CSS.
- `frontend/src/features/envelope/envelope.css`
  - Drop the `.assembly-segment` / `.assembly-segments` flex
    rules that no longer apply.
  - Add `.assembly-svg-canvas` / `.assembly-svg-canvas rect`
    rules. Use CSS variables for hover stroke / fill so the
    Phase 04 mode rendering can override per state.
  - Keep the action-button + dimension-cell rules for now.

### Deleted

None.

## P3. Component shapes

```tsx
// AssemblySvgCanvas.tsx
import { useMemo } from "react";
import {
  BASE_PX_PER_MM,
  MIN_CANVAS_WIDTH_PX,
  pxFromMm,
} from "../canvas-constants";
import {
  layerYOffsetMm,
  materialById,
  materialColor,
  segmentXOffsetMm,
  totalAssemblyThicknessMm,
  viewBoxFor,
} from "../lib";
import type {
  Assembly,
  AssemblyLayer,
  AssemblySegment,
  ProjectMaterial,
} from "../types";

export type AssemblySvgCanvasProps = {
  assembly: Assembly;
  materials: ProjectMaterial[];
  zoom: number;
  onSegmentClick?: (layer: AssemblyLayer, segment: AssemblySegment) => void;
  onSegmentEnter?: (layer: AssemblyLayer, segment: AssemblySegment) => void;
  onSegmentLeave?: () => void;
};

export function AssemblySvgCanvas(props: AssemblySvgCanvasProps) {
  const { assembly, materials, zoom } = props;
  const materialsById = useMemo(() => materialById(materials), [materials]);
  const vb = viewBoxFor(assembly);
  const pxW = Math.max(MIN_CANVAS_WIDTH_PX, pxFromMm(vb.width, zoom));
  const pxH = pxFromMm(vb.height, zoom);

  return (
    <svg
      className="assembly-svg-canvas"
      data-testid="assembly-svg-canvas"
      viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
      width={pxW}
      height={pxH}
      preserveAspectRatio="xMinYMin meet"
      shapeRendering="crispEdges"
    >
      {assembly.layers.map((layer, layerIdx) => {
        const y = layerYOffsetMm(assembly, layerIdx);
        return (
          <g key={layer.id} data-testid={`layer-${layer.id}`}>
            {layer.segments.map((segment, segIdx) => {
              const x = segmentXOffsetMm(layer, segIdx);
              const material = segment.project_material_id
                ? (materialsById.get(segment.project_material_id) ?? null)
                : null;
              const isNull = material === null;
              return (
                <rect
                  key={segment.id}
                  className={
                    isNull ? "segment null-material" : "segment"
                  }
                  data-testid={`segment-${segment.id}`}
                  x={x}
                  y={y}
                  width={segment.width_mm}
                  height={layer.thickness_mm}
                  fill={isNull ? "none" : materialColor(material)}
                  stroke="var(--construction-layer-segment-rect-stroke)"
                  strokeWidth={1}
                  strokeDasharray={isNull ? "4,3" : undefined}
                  onClick={() => props.onSegmentClick?.(layer, segment)}
                  onMouseEnter={() => props.onSegmentEnter?.(layer, segment)}
                  onMouseLeave={() => props.onSegmentLeave?.()}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
```

```ts
// lib.ts — new helpers

export function totalAssemblyThicknessMm(assembly: Assembly): number {
  return assembly.layers.reduce((sum, l) => sum + l.thickness_mm, 0);
}

export function layerYOffsetMm(assembly: Assembly, layerIdx: number): number {
  let y = 0;
  for (let i = 0; i < layerIdx; i++) y += assembly.layers[i].thickness_mm;
  return y;
}

export function segmentXOffsetMm(layer: AssemblyLayer, segIdx: number): number {
  let x = 0;
  for (let i = 0; i < segIdx; i++) x += layer.segments[i].width_mm;
  return x;
}

export function viewBoxFor(assembly: Assembly): {
  x: 0; y: 0; width: number; height: number;
} {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, maxLayerWidthMm(assembly)),
    height: Math.max(1, totalAssemblyThicknessMm(assembly)),
  };
}
```

```ts
// canvas-constants.ts — trimmed

export const BASE_PX_PER_MM = 0.18;
export const MIN_CANVAS_WIDTH_PX = 360;
export const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0] as const;
export const ZOOM_MIN = ZOOM_STEPS[0];
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1];

export function pxFromMm(mm: number, zoom: number): number {
  return mm * BASE_PX_PER_MM * zoom;
}
```

## P4. Sequence

1. **Commit 1 — Geometry helpers.** Add the four pure helpers
   to `lib.ts` with their tests in
   `__tests__/geometry.test.ts`. Helpers are exported but no
   caller uses them yet.
2. **Commit 2 — Constants trim.** Delete the three clamps in
   `canvas-constants.ts`. Add `ZOOM_STEPS`. Change `pxFromMm`
   signature. This commit will temporarily break the current
   `AssemblyCanvas.tsx` (which still passes `minPx` to
   `pxFromMm`). Fix the call sites in the same commit by
   substituting plain `pxFromMm(mm, zoom)`. Visual result will
   be diagrammatic-but-no-clamps — wait for commit 4 for true
   to-scale.
3. **Commit 3 — `AssemblySvgCanvas` substrate.** Add the new
   component + its test file. Component is exported but not
   yet mounted.
4. **Commit 4 — Wire substrate into `AssemblyCanvas`.** Replace
   the per-segment `<article>` block with
   `<AssemblySvgCanvas ... />`. Keep the existing
   layer-label / action-button column above or beside it.
   Update `EnvelopePage.test.tsx` if any selectors moved
   (segment `<rect>` rather than `<article>`).
5. **Commit 5 — CSS cleanup.** Remove the dead flex rules; add
   `.assembly-svg-canvas` rules with CSS variables for
   stroke / hover. Confirm visual fidelity vs
   `v1-reference-to-scale.png`.

Each commit should pass `make ci` independently.

## P5. Tests

### Unit — geometry helpers (`__tests__/geometry.test.ts`)

- `totalAssemblyThicknessMm` returns 0 on empty `layers`,
  sums correctly on single-layer and 5-layer fixtures.
- `layerYOffsetMm`:
  - layerIdx 0 → 0
  - layerIdx 1 on `[12.7, 88.9, 12.7]` → 12.7
  - layerIdx 2 on same → 101.6
  - throws/returns 0 on out-of-range — pick one and test.
- `segmentXOffsetMm`: same shape on `width_mm` array.
- `viewBoxFor`:
  - `{ x: 0, y: 0, width: maxLayerWidthMm, height: totalThicknessMm }`.
  - Both `width` / `height` floored at 1 on empty assembly
    (prevents `0 0 0 0` viewBox).

### Unit — `AssemblySvgCanvas` (`__tests__/AssemblySvgCanvas.test.tsx`)

- Renders one `<svg>` with the expected `viewBox`.
- Renders one `<rect>` per segment with mm-coords in the
  segment's expected position.
- Null-material segment gets `fill="none"` and
  `stroke-dasharray`.
- `onSegmentClick` fires with the right (layer, segment)
  tuple on click.
- `onSegmentEnter` / `onSegmentLeave` fire correctly.

### Invariant — no-clamp aspect ratio

A fixture with two segments
`width_mm: [50, 100]` and one layer `thickness_mm: 25` renders
into an SVG whose viewBox is `0 0 150 25` and whose rendered
pixel `width:height` ratio is exactly `150 * BASE_PX_PER_MM *
zoom : 25 * BASE_PX_PER_MM * zoom = 6:1`. Test asserts the
ratio.

### Regression — `EnvelopePage.test.tsx`

Existing assembly-canvas selectors that referenced
`<article>`-based segments need to swap to `<rect>` selectors
or `data-testid="segment-{id}"`.

## P6. Out of scope (lands in later phases)

- The dim column, orientation labels, hover-`+` buttons,
  inline thickness editor — Phase 02.
- The toolbar (flip × 3, zoom cluster, eyedropper / paint
  buttons) — Phase 03.
- The pick / paste canvas-side mode rendering (green outline,
  yellow tint, pulse animation), the undo stack — Phase 04.
- SVG `<pattern>` hatching fills — deferred to v1.1+ (the
  substrate enables them; no design work yet).
- SVG-as-asset export — deferred (substrate enables it).

## P7. Risks

- **The existing chrome may look weird next to the new SVG**
  because it was designed against the flex substrate. Mitigation:
  this is a known Phase 02 cleanup; accept the rough look on
  main during the Phase 01 → Phase 02 gap. The PR description
  should call this out explicitly so reviewers don't flag it
  as a regression.
- **Snapshot tests of SVG output are flaky across React
  versions.** Mitigation: assert structure (`<svg>` count,
  `<rect>` count, viewBox value) rather than snapshot-stringify.
- **Adding `ZOOM_STEPS` may collide with the existing
  `ZOOM_STEP` (singular).** Mitigation: rename the existing
  constant if needed; downstream callers should switch to
  `ZOOM_STEPS[next_idx]` indexing.
