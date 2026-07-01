---
DATE: 2026-07-01
TIME: 16:14 EDT
STATUS: Complete and verified.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 4 — automatic, selection-scoped
  dimension-line overlays on the selected element's segments.
RELATED:
  - ../PRD.md §9 (full section — read first), §12 D-6, §14 acceptance
    criterion 12
  - ../PLAN.md
---

# Phase 4 — Selection-scoped dimension lines (optional)

## 1. Goal

While a duct/pipe element is selected, each of its segments gets an
offset dimension line (extension lines + end ticks + a unit-aware
midpoint label) rendered to the side of the actual geometry — never
for a whole lens, never when nothing is selected (PRD §9, D-6). This
phase is explicitly cuttable; if it proves more involved than the
budget allows, stop here and proceed to Phase 5 without it (PRD §9:
"don't let dimension-line scope creep block shipping §4-§7").

## 2. Required reading (in order)

1. `../PRD.md` §9 in full, including the named DOM-label perf risk and
   why it's deferred rather than solved here.
2. `scene/MeasureOverlay.tsx` — the whole file. This is the direct
   precedent: a drei `<Line>` plus a canvas-scoped drei `<Html>`
   midpoint label (`MeasureLine`, l.120-151), unit-aware via
   `formatMeasureDistance` (`lib/measure.ts:50-55`). This phase reuses
   this exact rendering shape, just with more line segments per
   dimension (extension lines + ticks, not just one line) and a
   different trigger (selection-driven, not click-to-place).
3. `phases/phase-02-element-selection-highlight.md` §3.2 —
   `ElementSummary`/`elementsById`, this phase's trigger data source
   (`model.elementsById.get(selectionId)`).
4. `scene/CameraRig.tsx` l.1-4, l.36-44 — how `camera` and
   `OrbitControls`'s `onChange={() => invalidate()}` are already wired
   for the `frameloop="demand"` canvas; this phase's offset direction
   needs to track camera orientation the same way.
5. `__tests__/perfGate.test.ts` — the structural draw-call-count
   testing pattern this phase's own perf gate should follow (assert
   object count scales with a bounded input, not with total scene
   size — same idea, different subsystem).

## 3. Work breakdown

### 3.1 Pure geometry helper

New file `frontend/src/features/model_viewer/lib/dimensionLines.ts`:

```ts
export type DimensionLineGeometry = {
  extensionA: [Vector3, Vector3];
  extensionB: [Vector3, Vector3];
  dimensionLine: [Vector3, Vector3];
  tickA: [Vector3, Vector3];
  tickB: [Vector3, Vector3];
  midpoint: Vector3;
  lengthM: number;
};

export function buildDimensionLineGeometry(
  start: Vector3,
  end: Vector3,
  cameraViewDirection: Vector3,
  offsetDistance: number,
): DimensionLineGeometry;
```

- `segmentDirection = end.clone().sub(start).normalize()`.
- `offsetDirection = segmentDirection.clone().cross(cameraViewDirection).normalize()`.
  **Degenerate case**: if the segment runs (near-)parallel to the
  camera's view direction (e.g. looking straight down a vertical
  riser), the cross product's magnitude approaches zero and
  `.normalize()` on a near-zero vector is unstable. Guard this: if the
  cross product's length is below a small epsilon, fall back to a
  fixed world-up-based offset (`Vector3(0, 0, 1)` crossed with
  `segmentDirection`, or similar) rather than producing a NaN/garbage
  direction. Write a unit test for exactly this case (a purely
  vertical segment viewed head-on).
- Offset points: `start + offsetDirection * offsetDistance`,
  `end + offsetDirection * offsetDistance`.
- `extensionA`/`extensionB`: true endpoint → its offset point.
- `dimensionLine`: the two offset points.
- Tick marks: short line segments centered on each offset point,
  perpendicular to `dimensionLine`'s direction, fixed small world-unit
  length (start with something on the order of the offset distance's
  own scale — this needs visual tuning during implementation, PRD
  §13.3, not a value to treat as final).
- `lengthM`: `start.distanceTo(end)` — for the label; do **not**
  recompute this from segment metadata, it must match the true 3D
  distance being drawn, and it should equal the backend-provided
  segment `length` within floating-point tolerance (assert this in a
  test — a mismatch would mean the geometry and the reported length
  have drifted apart, which is worth catching).
- `offsetDistance` heuristic: keep in one named constant/function so
  it's easy to retune, e.g. a small fraction of the *element's*
  bounding-box diagonal (not the whole model's) with a sensible floor
  so short segments don't get a vanishingly small offset. Exact
  formula is an implementation-tuning decision, not specified further
  here.

### 3.2 Scene component

New file `frontend/src/features/model_viewer/scene/DimensionOverlay.tsx`,
mounted from `BuildingLens.tsx` alongside `<MeasureOverlay model={model}
/>` (l.80), gated so it only renders when the current lens is
`ventilation`/`hot-water` **and** `model.elementsById.has(selectionId)`
— i.e. it mounts and unmounts with the selection, matching D-6's
"selected element only" scoping structurally, not just visually (an
unmounted component costs nothing; do not build a component that
always mounts and internally decides to render nothing based on
`segmentIds.length === 0`).

- Read `camera` via `useThree()`; recompute each segment's
  `DimensionLineGeometry` in a `useFrame` (or on `OrbitControls`
  `onChange`, matching the existing `invalidate()` wiring) using
  `camera.getWorldDirection(scratchVector)` — reuse a scratch
  `Vector3` across frames the way `MeasureOverlay.tsx` already does
  (`scratch = useRef(new Vector3())`, l.32) rather than allocating one
  per frame per segment.
- Render per segment: two extension `<Line>`s, one dimension `<Line>`,
  two tick `<Line>`s, one `<Html position={midpoint} center
  className="model-dimension-label" pointerEvents="none">` label using
  the **same formatter** the segment table already uses for length
  (`formatMetersAsLength` from `lib/fieldConfigs.ts`, exported in
  Phase 2 — do not introduce a second meters-to-display-string
  formatter; `lib/measure.ts`'s `formatMeasureDistance` is a second
  valid option but pick one and use it consistently with the segment
  table's own numbers so they can never disagree).
- New CSS class `.model-dimension-label` in `model_viewer.css`, styled
  distinctly from `.model-measure-label` (smaller/quieter — this is
  ambient annotation on a selection, not a user-placed measurement)
  but following the same canvas-scoped-`<Html>` pattern (never
  `document.body`).

### 3.3 Perf gate

New test file mirroring `__tests__/perfGate.test.ts`'s structure and
intent: given an `ElementSummary` with N segments, assert the overlay
produces exactly N sets of dimension-line geometry (5 line pairs + 1
label position) and that this count is a pure function of
`segmentIds.length` for the *selected* element — construct two
elements, one with 3 segments and one with 30 (synthetic fixtures, no
GPU/canvas needed, same spirit as `manyFaces()` in
`lensBatchFixtures.ts`), and assert the larger element's dimension
object count scales linearly with its own segment count while
**unrelated elements in the same model contribute zero** dimension
objects regardless of the model's total segment count. This is the
regression backstop for D-6 — a future "let's also dimension on
hover" change should fail this test loudly if it makes the count
scale with the wrong thing.

## 4. Fixture guidance

Use the canonical fixture's multi-segment elements (3-segment duct, 4-
segment hot-water fixture run) for the geometry/visual verification.
Use a synthetic vertical-segment fixture (hand-built, not from the
HBJSON files) specifically to exercise the §3.1 degenerate-offset-
direction case — neither real fixture is guaranteed to contain a
purely vertical run pointed straight at the camera.

## 5. Out of scope

A lens-wide "show all dimensions" mode (PRD §9 named risk — explicitly
not this phase). Editable/draggable dimension lines. Persisting
dimension-line visibility preferences.

## 6. Verification gate

1. **Vitest**: `buildDimensionLineGeometry` — normal case, the
   degenerate near-parallel-to-camera case, `lengthM` matches
   `start.distanceTo(end)` and (for a fixture segment) matches the
   backend-provided `length` within tolerance. The §3.3 perf gate.
2. **Playwright e2e**: select a multi-segment element, assert
   dimension-line labels render with the right count and the right
   unit-toggle-responsive text; deselect (or select a different lens),
   assert they're gone; select a *different* element and assert the
   previous element's dimension lines don't linger.
3. **Closeout**: `tsc -b`, `pnpm run lint`, `pnpm run check:all`,
   `make format`, `make ci`.
4. Browser walkthrough: visually confirm the dimension lines read as
   "to the side," don't overlap the actual geometry distractingly, and
   orbiting the camera keeps them legible (the offset direction
   tracks the view).

## 7. Exit criteria

PRD §14 acceptance criterion 12 passes. STATUS.md records whether this
phase shipped, was tuned, or was cut — either outcome is acceptable
per PRD §9.

## 8. Completion record

Implemented 2026-07-01.

Implemented:

- `buildDimensionLineGeometry`, `dimensionOffsetDistance`, and
  `dimensionPrimitiveCounts` in
  `frontend/src/features/model_viewer/lib/dimensionLines.ts`.
- `DimensionOverlay` in
  `frontend/src/features/model_viewer/scene/DimensionOverlay.tsx`,
  rendering extension lines, dimension lines, end ticks, and
  canvas-scoped unit-aware labels for the selected element only.
- Conditional overlay mounting from
  `frontend/src/features/model_viewer/scene/BuildingLens.tsx` for
  selected Ventilation / Hot Water elements.
- `.model-dimension-label` styling in
  `frontend/src/features/model_viewer/model_viewer.css`.
- Unit coverage for normal geometry, degenerate head-on geometry,
  offset tuning, and selected-element primitive-count scaling.
- Chromium e2e coverage for selected-element dimension labels and
  teardown on lens switch.

Verification passed:

- `cd frontend && pnpm exec tsc -b --pretty false`
- `cd frontend && pnpm exec vitest run
  src/features/model_viewer/__tests__/dimensionLines.test.ts`
- `cd frontend && pnpm run lint` (0 errors, existing 15 warnings)
- `cd frontend && pnpm run check:all`
- `cd frontend && pnpm exec playwright test
  tests/e2e/model-viewer-lenses.spec.ts --project=chromium`

Repo closeout gate passed:

- `make format`
- `make ci`:
  - backend: 1250 passed, 7 skipped, 1 warning
  - frontend: 219 test files passed, 2007 tests passed; production
    build completed
- `graphify update .`
