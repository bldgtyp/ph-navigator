---
DATE: 2026-06-04
TIME: 13:00
STATUS: Blocked on Phase 01
AUTHOR: Ed May / Claude
SCOPE: Replace the existing in-canvas HTML chrome (action-button
       stack, basic layer label column) with the new overlay
       model: dimension column with inline thickness editor,
       orientation labels, per-segment hover highlight, magenta
       hover-`+` buttons for segments and layers. Click segment
       opens SegmentDialog. No hover trash / edit icons.
RELATED:
  - planning/features/assembly-builder/PRD.md §5.2–§5.6, §5.8, §5.9
  - planning/features/assembly-builder/assets/v1-segment-hover-plus-buttons.png
  - planning/features/assembly-builder/phases/phase-01-svg-canvas-substrate.md
  - frontend/src/lib/units/ (existing parser — to be wired)
  - frontend/src/features/envelope/components/AssemblyCanvas.tsx
  - frontend/src/features/envelope/components/dialogs/LengthDialog.tsx
---

# Phase 2 — Overlay Chrome

## P0. Why this slice

Phase 02 turns the Phase-01 substrate into a complete
canvas. It introduces a single new component
`AssemblyCanvasOverlay.tsx` that owns all the HTML chrome
positioned over the SVG: the dimension column on the left, the
top / bottom orientation labels, the per-segment hover state, the
magenta `+` buttons that match the V1 reference
(`v1-segment-hover-plus-buttons.png`), and the inline thickness
editor that accepts any-unit input.

This is also where the current `AssemblyCanvas.tsx` loses its
existing action-button stack — Q-AB-4 resolved that delete /
edit live in the modals only, so the entire on-rect button
cluster is removed in this phase.

By the end of Phase 02:

- `AssemblyCanvas.tsx` is a thin orchestrator that composes
  `<AssemblySvgCanvas />` (Phase 01) + `<AssemblyCanvasOverlay
  />` (this phase).
- The dim column shows per-layer thickness labels in the active
  display unit (Q-AB-3), with dashed extension lines stopping
  at the assembly SVG's left edge (Q-AB-2).
- Click any thickness label → inline `<input>` that accepts
  any-unit length input ("4 in", "156 mm", "0.1 m", "2-1/2\"")
  via the shared parser at `frontend/src/lib/units/`.
- Hover any segment → magenta dashed outline + two magenta
  `+` circles vertically centered at the inside left and right
  edges. Tooltips "Add Segment Before" / "Add Segment After".
- Hover any layer dim cell → "+ Add Layer Above" / "+ Add Layer
  Below" magenta circles at the cell's top and bottom edges.
- Click segment body → opens `SegmentDialog`. Delete is reached
  only from inside the dialog (Q-AB-4 / Q-AB-5).
- Narrow segments (rendered width < ~60 px) collapse to a
  single centered `+` button whose click hit-zone splits
  left-half-Before / right-half-After.

Phase 02 does **not** ship: the toolbar (Phase 03), or the pick /
paste canvas-side mode rendering (Phase 04).

## P1. Acceptance — Phase 2 done when

1. `AssemblyCanvasOverlay.tsx` exists. It receives the same
   `Assembly` + `materials` + `zoom` props as
   `AssemblySvgCanvas` and uses the same geometry helpers, so
   the overlay and substrate stay in sync by construction.
2. `AssemblyCanvas.tsx` is reduced to a wrapper that composes
   `<AssemblySvgCanvas />` and `<AssemblyCanvasOverlay />` and
   forwards the editor callbacks (`onEditLayer`, `onAddLayer`,
   `onDeleteLayer`, `onEditSegment`, `onAddSegment`,
   `onDeleteSegment`). The existing per-segment action-button
   stack (`Pencil`, `Trash2`, `Copy`, etc.) and the old
   per-layer label column are **removed**.
3. Dim column: one cell per layer; cell height = layer's
   rendered px height; label shows thickness in the active
   display unit (Q-AB-3) per US-ENV-3 criterion 2.
4. Dim extension lines: thin dashed `1px #999`. One line at
   the top of each cell, one at the bottom. Each runs from the
   cell's right edge to the assembly SVG's left edge — does not
   continue across the assembly (Q-AB-2).
5. Click a dim-column cell label → label flips into an `<input
   type="text">` with current value selected. Submit on Enter
   / blur. ESC cancels. Submit calls the shared parser; valid
   input writes a JSON-Patch to
   `tables.assemblies[a].layers[l].thickness_mm`. R-value
   refetch triggered per US-ENV-10.
6. Parser acceptance (covered by `lib/units/` tests + the new
   integration test):
   - Plain number → interpreted in active display unit.
   - SI suffix: `mm` / `cm` / `m`, case-insensitive.
   - IP suffix: `in` / `inch` / `inches` / `"`, case-
     insensitive.
   - Mixed-fraction IP: `"2-1/2"`, `"2 1/2"`.
   - Invalid → inline error tooltip; submit disabled.
7. Top / bottom orientation labels render as **"exterior"** /
   **"interior"** per `assembly.orientation`. Centered above /
   below the SVG.
8. Hover a segment → SVG `<rect>` gets a magenta dashed outline
   (via mode-aware CSS variable). Hover state is implemented
   as a controlled prop pair (`hoveredSegmentId`,
   `setHoveredSegmentId`) so the overlay can know which segment
   is hovered without DOM peeking.
9. Two magenta `+` buttons appear in the overlay over the
   hovered segment, vertically centered, anchored a small inset
   (4 px) from the segment's inside left and right edges per
   `v1-segment-hover-plus-buttons.png`. Tooltips: "Add Segment
   Before" / "Add Segment After".
10. Narrow-segment fallback: when the segment's rendered px
    width is `< 60`, the overlay collapses to a single centered
    button. Click on the left half → `onAddSegment(..., "left")`;
    right half → `onAddSegment(..., "right")`.
11. Per-layer hover-`+`: hovering a dim cell reveals "+ Add
    Layer Above" / "+ Add Layer Below" magenta circles at the
    cell's top and bottom edges. Same magenta visual style as
    segment `+`.
12. Click segment body (i.e. any part of the segment that's not
    a `+` button) → calls `onEditSegment(layer, segment)`. The
    existing modal opens.
13. No hover trash, edit, copy, or paste icons in the overlay.
    Per Q-AB-4 — delete / edit live only inside the modal.
14. Locked-version + Viewer behavior: overlay's edit affordances
    (hover-`+`, inline edit, click-segment-to-modal) hide via
    the `canEdit` gate.
15. `make ci` is green.

## P2. Files

### New

- `frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx`
- `frontend/src/features/envelope/components/__tests__/AssemblyCanvasOverlay.test.tsx`
- `frontend/src/features/envelope/components/DimensionCell.tsx`
- `frontend/src/features/envelope/components/__tests__/DimensionCell.test.tsx`
- `frontend/src/features/envelope/components/SegmentHoverPlus.tsx`
  — the magenta `+` button overlay for one segment, including
  the narrow-segment fallback.
- `frontend/src/features/envelope/components/__tests__/SegmentHoverPlus.test.tsx`

### Modified

- `frontend/src/features/envelope/components/AssemblyCanvas.tsx`
  - Drops the in-canvas action-button stack.
  - Composes `<AssemblySvgCanvas />` + `<AssemblyCanvasOverlay />`.
  - Manages `hoveredSegmentId` state (or hoists via a hook).
- `frontend/src/features/envelope/components/AssemblySvgCanvas.tsx`
  - Accepts `hoveredSegmentId?: string` and applies the
    magenta-dashed outline to the matching `<rect>` via CSS
    class toggle. No layout change.
- `frontend/src/features/envelope/envelope.css`
  - Drops the rules for the old chrome (action buttons,
    layer-label column).
  - Adds overlay-layer rules (`.assembly-canvas-overlay`,
    `.dim-column`, `.dim-cell`, `.dim-extension-line`,
    `.orientation-label`, `.segment-hover-plus`,
    `.layer-hover-plus`).
  - Defines the magenta button via a `--canvas-plus-fill`
    CSS variable so dark-mode polish later is one-liner.
- `frontend/src/features/envelope/__tests__/EnvelopePage.test.tsx`
  - Update selectors that referenced the removed action
    buttons.

### Deleted

None (the old chrome is removed via edit, not file delete —
`AssemblyCanvas.tsx` stays).

## P3. Component shapes

```tsx
// AssemblyCanvasOverlay.tsx
import type {
  Assembly,
  AssemblyLayer,
  AssemblySegment,
  ProjectMaterial,
} from "../types";

export type AssemblyCanvasOverlayProps = {
  assembly: Assembly;
  materials: ProjectMaterial[];
  zoom: number;
  canEdit: boolean;
  hoveredSegmentId: string | null;
  onEditLayer: (layer: AssemblyLayer) => void;
  onAddLayer: (layer: AssemblyLayer, position: "above" | "below") => void;
  onEditSegment: (layer: AssemblyLayer, segment: AssemblySegment) => void;
  onAddSegment: (
    layer: AssemblyLayer,
    segment: AssemblySegment,
    position: "left" | "right",
  ) => void;
};

export function AssemblyCanvasOverlay(props: AssemblyCanvasOverlayProps) {
  // 1. Top / bottom orientation labels.
  // 2. Dim column on the left:
  //    - One <DimensionCell layer={...} canEdit={...}
  //                         onCommit={(mm) => mutate(layer, mm)} />
  //      per layer.
  //    - Dashed extension line spans from cell right edge to
  //      the assembly SVG's left edge (positioned via CSS
  //      grid or absolute positioning + computed offsets).
  //    - "+ Add Layer Above" / "+ Add Layer Below" buttons
  //      revealed on cell hover.
  // 3. Absolutely-positioned <SegmentHoverPlus /> over the
  //    currently-hovered segment, positioned via the
  //    mmToPx(zoom) factor applied to segmentXOffsetMm + width.
  // 4. Click-segment passthrough: the overlay's click areas
  //    over each segment forward onEditSegment to the parent;
  //    SVG <rect> onClick also forwards. Whichever fires first
  //    wins; both paths are equivalent.
}
```

```tsx
// DimensionCell.tsx
import { useState } from "react";
import { useUnitPreference, formatLengthFromMm } from "../../../lib/units";
import { parseLength } from "../../../lib/units"; // existing parser

export type DimensionCellProps = {
  layer: AssemblyLayer;
  heightPx: number;
  canEdit: boolean;
  onCommit: (mm: number) => void;
};

export function DimensionCell({
  layer, heightPx, canEdit, onCommit,
}: DimensionCellProps) {
  const { unitSystem } = useUnitPreference();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commit() {
    const parsed = parseLength(draft, unitSystem); // {mm, ok, error}
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onCommit(parsed.mm);
    setEditing(false);
    setError(null);
  }

  return (
    <div className="dim-cell" style={{ height: `${heightPx}px` }}>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setEditing(false); setError(null); }
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? `${layer.id}-err` : undefined}
        />
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => {
            setDraft(formatLengthFromMm(layer.thickness_mm, { unitSystem }));
            setEditing(true);
          }}
        >
          {formatLengthFromMm(layer.thickness_mm, { unitSystem })}
        </button>
      )}
      {error && (
        <span id={`${layer.id}-err`} role="alert" className="dim-cell-error">
          {error}
        </span>
      )}
    </div>
  );
}
```

```tsx
// SegmentHoverPlus.tsx
import { pxFromMm } from "../canvas-constants";

export type SegmentHoverPlusProps = {
  segmentLeftPx: number;       // computed from segmentXOffsetMm + assembly offset
  segmentTopPx: number;        // computed from layerYOffsetMm
  segmentWidthPx: number;
  segmentHeightPx: number;
  onAddBefore: () => void;
  onAddAfter: () => void;
};

const COLLAPSE_THRESHOLD_PX = 60;
const EDGE_INSET_PX = 4;

export function SegmentHoverPlus(props: SegmentHoverPlusProps) {
  const collapsed = props.segmentWidthPx < COLLAPSE_THRESHOLD_PX;
  const topPx = props.segmentTopPx + props.segmentHeightPx / 2 - 12; // 12 = half of 24px button
  if (collapsed) {
    // Single centered button; click hit-zone split via mousedown x within button.
    return (/* single button, splits Before/After by x */);
  }
  return (
    <>
      <PlusButton
        leftPx={props.segmentLeftPx + EDGE_INSET_PX}
        topPx={topPx}
        tooltip="Add Segment Before"
        onClick={props.onAddBefore}
      />
      <PlusButton
        leftPx={props.segmentLeftPx + props.segmentWidthPx - 24 - EDGE_INSET_PX}
        topPx={topPx}
        tooltip="Add Segment After"
        onClick={props.onAddAfter}
      />
    </>
  );
}
```

## P4. Sequence

1. **Commit 1 — `DimensionCell` + parser integration test.**
   Standalone component. Test the parser ↔ commit flow with
   IP / SI / mixed inputs.
2. **Commit 2 — `SegmentHoverPlus`.** Standalone component
   covering the two-button layout + the narrow-segment
   collapse-to-center fallback.
3. **Commit 3 — `AssemblyCanvasOverlay`.** Compose
   `DimensionCell` (one per layer) + `SegmentHoverPlus` (one
   for the hovered segment) + orientation labels + extension
   lines. Test the layout integration.
4. **Commit 4 — Wire into `AssemblyCanvas`.** Drop the old
   action-button stack. Mount the overlay alongside the
   substrate. Update `EnvelopePage.test.tsx` selectors.
5. **Commit 5 — CSS cleanup + visual polish.** Drop dead
   rules. Tune the magenta visual (size 24 px, halo /
   drop-shadow for contrast against any fill color).

Each commit should pass `make ci`.

## P5. Tests

### Unit — `DimensionCell` (`__tests__/DimensionCell.test.tsx`)

- Renders thickness label in SI when unit prefs = SI.
- Renders thickness label in IP when unit prefs = IP.
- Click cell → input appears, value pre-filled, selected.
- Enter "4 in" → onCommit called with 101.6 (approx).
- Enter "156 mm" → onCommit called with 156.
- Enter "0.1 m" → onCommit called with 100.
- Enter "2-1/2 in" → onCommit called with 63.5.
- Enter plain "100" in SI mode → 100 mm; in IP mode → 2540 mm.
- Enter "abc" → error shown, onCommit not called, input stays
  open.
- ESC → editing dismissed, no commit.

### Unit — `SegmentHoverPlus` (`__tests__/SegmentHoverPlus.test.tsx`)

- segmentWidthPx >= 60 → two buttons, positioned with
  `EDGE_INSET_PX` from inside edges.
- segmentWidthPx < 60 → one centered button; click in left
  half → onAddBefore; click in right half → onAddAfter.
- Tooltip strings match "Add Segment Before" / "Add Segment
  After" verbatim.

### Unit — `AssemblyCanvasOverlay`

- Renders one dim cell per layer with the correct
  `heightPx = layer.thickness_mm * BASE_PX_PER_MM * zoom`.
- Renders orientation labels per `assembly.orientation`.
- Hover a segment (controlled via prop) → only that segment's
  `SegmentHoverPlus` is rendered.
- Hover a dim cell → layer hover-`+` buttons render at top /
  bottom edges of that cell.
- `canEdit=false` → all hover affordances hidden; dim cells
  render as labels not buttons.

### Integration — `EnvelopePage.test.tsx`

- A user can click a layer thickness label and submit a new
  value; the document's draft body reflects the patch.
- A user can click a segment → modal opens (existing test;
  selectors update).
- A user can hover a segment and click the right `+` button
  → `onAddSegment(..., "right")` fires with the source
  segment.

## P6. Out of scope (lands in later phases)

- Toolbar (flip × 3, zoom cluster, eyedropper / paint /
  undo buttons) — Phase 03.
- Pick / paste mode visuals on the SVG substrate — Phase 04.
- Hatching patterns / SVG export — deferred.
- Multi-row PhDivisionGrid — out of v1 scope per Q-ENV-5.

## P7. Risks

- **Overlay positioning math drifts from SVG math.**
  Mitigation: both the overlay's `segmentLeftPx` /
  `segmentTopPx` and the SVG's `<rect x y>` come from the
  same `segmentXOffsetMm` / `layerYOffsetMm` helpers + the
  same `pxFromMm` conversion. No parallel implementations.
- **The `parseLength` parser may not yet exist in the exact
  shape `DimensionCell` expects.** Check
  `frontend/src/lib/units/` early in Phase 02. If the parser
  needs a small extension (e.g. fractional-inch handling), add
  it in commit 1 with tests.
- **Click-segment is now ambiguous between the SVG `<rect>`
  click and an overlay-layer click.** Mitigation: only the
  SVG `<rect>` carries `onSegmentClick`; the overlay's
  click areas for `+` buttons stopPropagation. Tested
  explicitly.
- **Hover-state thrashing between the SVG and the overlay**
  (mouse moves across the boundary between `<rect>` and the
  overlay's `<button>`). Mitigation: the overlay's `+`
  buttons are positioned over the SVG, so hover stays "in
  the segment" semantically; we drive `hoveredSegmentId`
  from the SVG's `onMouseEnter` / `onMouseLeave` only, not
  from the overlay.
