---
DATE: 2026-06-05
TIME: 19:00 EDT
STATUS: Done
AUTHOR: Claude
SCOPE: Replace Phase 06's read-only operation display with the full
       Fixed / Swing / Slide editor + direction toggles + preset
       menu (Tilt-Turn, Awning, Hopper, Casement L/R, Slider L/R).
       Render the V1 SVG operation symbols on the canvas (dashed
       hinge lines for swing, direction arrows for slide), with
       L↔R flip on interior view. Surface the "operation changed
       — re-pick frames" warning when the new operation pattern
       no longer matches the catalog `operation` field of any
       picked frame.
RELATED:
  - planning/features/apertures/PRD.md §9.2 (operation symbols),
    §11.3 (operation editor), §11.1 (operation → picker filter)
  - planning/features/apertures/PLAN.md (Phase 07 row)
  - phase-01 (delivers `setElementOperation` command)
  - phase-04 (overlay)
  - phase-06 (cards + per-side picker filtering by operation)
---

# Phase 7 — Operations editor (presets + symbols + interior flip)

## Implementation note (Claude, 2026-06-05)

Shipped as a single PR. See STATUS.md "Phase 07 deviations from the
doc" for the per-decision rationale. Highlights:

- `OperationRow` uses a native `<select>` + `<button>` toggles
  (no shadcn dep); preset menu is a `<details>` dropdown to match
  the FramePicker / GlazingPicker pattern from Phase 06.
- `<OperationSymbols />` lives at `components/OperationSymbols.tsx`
  (flat, not under a `canvas/` subfolder) and mounts after the
  glazing rect inside `ApertureSvgCanvas` so it paints on top.
- Frame-match is exact-string against `formatOperation(element
  .operation)` — V1 free-form `operation` labels ("Casement") report
  as mismatched until the catalog seed normalizes its operation
  column. Documented as a v1 trade-off.
- Dismissed-warning state lives in Zustand
  (`dismissedOperationWarnings`) and clears on aperture-type
  unmount via `clearDismissedOperationWarnings`.

## Original Phase 07 plan follows.

## P0. Why this slice

Phase 07 makes operations editable and visible on the canvas. The
user picks a pattern from the preset menu (or builds one from
type + direction toggles), the canvas draws the standard
architectural symbol (dashed hinge lines for swing, direction
arrow for slide), and the card's frame picker now narrows by the
matching operation. If the user already picked frames that no
longer match the new operation pattern, a card-level warning
nudges them to re-pick — the existing frames stay assigned (the
user may have done it deliberately).

By the end of Phase 07:

- The Phase 06 read-only operation row is replaced with a full
  editor: shadcn `Select` for Fixed / Swing / Slide, four
  direction `Toggle` buttons, a `Common patterns` preset menu.
- The display label format reads `Fixed`, `Swing`, or
  `Swing (Left, Up)` per PRD §11.3.
- The canvas renders the operation symbol for each non-fixed
  element. Symbols mirror the V1 reference (dashed hinge lines
  from named-side midpoint to opposite glazing corners for
  swing; arrow at vertical center for slide; multi-direction
  symbols overlay).
- Interior view swaps left ↔ right direction for the visual
  symbol (top / bottom unchanged) — the underlying data is
  unchanged.
- When the user changes the element's operation, the card-level
  warning fires: `Operation changed — picked frames may no
  longer match. Re-pick to clear.` The drift-style indicator
  persists until each side has been re-picked (or the user
  dismisses the warning explicitly).
- The Phase 06 per-side picker filter (location + operation)
  refreshes to use the new operation immediately.

Phase 07 does **not** ship merge / split (Phase 08), copy/paste
of operation values (Phase 08), U-Value coupling to operation
(Phase 09 explicitly excludes operation), or any new picker UI.

## P1. Acceptance — Phase 7 done when

1. `<OperationRow />` replaces the Phase 06 read-only operation
   display in `<ApertureElementCard />`. It includes:
   - shadcn `Select` with options `Fixed | Swing | Slide`.
   - When type is non-fixed, four `Toggle` buttons:
     `Left`, `Right`, `Up`, `Down`. Multiple selections
     allowed (tilt-turn = swing + Left + Up).
   - A `Common patterns ▾` button that opens a menu with the
     seven presets listed in PRD §11.3.
2. **Presets** dispatch a `setElementOperation` command with
   the preset's `(type, directions[])`. Picking a preset can
   still be edited via the type select / direction toggles.
3. **Display label format** in the read-only contexts
   (locked / Viewer; sidebar-collapsed compact view; element
   pill if we surface it later) reads:
   - `Fixed` when operation is null.
   - `Swing` when operation is swing with empty directions.
   - `Swing (Left, Up)` with directions joined comma-space and
     each direction title-cased.
   - `Slide (Right)` etc.
4. **Backend `setElementOperation` handler** (filled in beyond
   the Phase 01 stub):
   - Validates the operation payload via the
     `ApertureOperation` pydantic model.
   - Writes the new value on the target element.
   - Audits `command="setElementOperation"`,
     `aperture_type_id`, `element_id`,
     `previous_operation`, `new_operation`,
     `affects_u_value=False` (explicit so Phase 09's cache
     hash skip-list is documented in audit).
5. **Canvas operation symbols** render inside
   `<ApertureSvgCanvas />` (the same SVG layer used for
   regions) but **after** the glazing rect so they paint on
   top:
   - **Swing.** For each direction in `operation.directions`,
     draw two dashed lines (`stroke-dasharray="4,3"`,
     `stroke="var(--aperture-operation-symbol)"`, width 1)
     from the *hinge side*'s midpoint to the two opposite
     glazing corners. Hinge side = direction (e.g. `Left` →
     left edge of glazing rect).
   - **Slide.** For each direction in `operation.directions`,
     draw an arrow at the vertical center of the glazing rect,
     length = 80% of `min(glazingWidth, glazingHeight)`, head
     size = 10%, pointing in the direction.
   - **Multi-direction.** Symbols overlap — V1 parity.
   - **Color.** `var(--aperture-operation-symbol)` token,
     default `#666` per V1.
6. **Interior view flip.** When `viewDirection === "interior"`,
   the canvas helper that resolves a direction's screen-side
   swaps `left ↔ right`; `up` / `down` are unchanged. The
   canonical `operation.directions` array is not mutated; the
   flip happens at the renderer.
7. **Re-pick warning.** When the user changes an element's
   operation, the card surfaces a warning under the operation
   row:
   - Text: `Operation changed — picked frames may no longer
     match. Re-pick to clear.`
   - Each picked-frame side whose catalog `operation` field
     mismatches the new element-level operation gets a small
     ⚠ icon on its row chip. Hover tooltip: `Frame catalog
     operation was '<old>'; element operation is now
     '<new>'.`
   - The warning is dismissible (`✕` on the warning banner) —
     dismissed state is per-element, per-tab, ephemeral (lives
     in the Zustand store, cleared on aperture-type or version
     switch).
   - Hand-entered frames (`catalog_origin === null`) carry no
     `operation` to compare against and never warn.
8. **Empty directions.** Picking `Swing` or `Slide` with no
   directions is allowed (the user is still composing). The
   canvas renders no symbol for that element until at least
   one direction is selected.
9. **Locked / Viewer.** Editor is replaced by the display
   label format from §P1.3. Canvas symbols render the same.
10. `make ci` is green.

## P2. Files

### New (frontend)

- `frontend/src/features/apertures/components/OperationRow.tsx`
- `frontend/src/features/apertures/components/OperationPresetMenu.tsx`
- `frontend/src/features/apertures/components/OperationWarningBanner.tsx`
- `frontend/src/features/apertures/components/canvas/OperationSymbols.tsx`
  (sub-component of `ApertureSvgCanvas` — the symbol layer)
- `frontend/src/features/apertures/lib/operationPresets.ts`
- `frontend/src/features/apertures/lib/operationLabels.ts`
- `frontend/src/features/apertures/lib/operationSymbols.ts`
  (pure geometry: returns line segments / arrow polylines)
- `frontend/src/features/apertures/lib/operationFrameMatch.ts`
  (returns mismatched sides for the current operation)
- `frontend/src/features/apertures/__tests__/operationPresets.test.ts`
- `frontend/src/features/apertures/__tests__/operationLabels.test.ts`
- `frontend/src/features/apertures/__tests__/operationSymbols.test.ts`
- `frontend/src/features/apertures/__tests__/operationFrameMatch.test.ts`
- `frontend/src/features/apertures/__tests__/OperationRow.test.tsx`

### Modified

- `frontend/src/features/apertures/components/ApertureElementCard.tsx`
  - Replace placeholder operation row with `<OperationRow />`.
  - Compose `<OperationWarningBanner />` below the operation row.
- `frontend/src/features/apertures/components/ApertureSvgCanvas.tsx`
  - Add `<OperationSymbols />` for each element after the glazing
    rect.
- `frontend/src/features/apertures/store/builder-store.ts`
  - Add `dismissedOperationWarnings: Record<string, string[]>`
    (aperture_type_id → element_ids).
- `backend/features/project_document/aperture_commands/handlers/element.py`
  - Fill in `setElementOperation` beyond the Phase 01 minimum:
    add audit field `affects_u_value=False`.

### Deleted

None.

## P3. Component shapes

```ts
// operationPresets.ts — sketch

export type OperationPreset = {
  id: string;
  label: string;
  payload: { type: "swing" | "slide"; directions: ("left" | "right" | "up" | "down")[] };
};

export const OPERATION_PRESETS: OperationPreset[] = [
  { id: "tilt-turn", label: "Tilt-Turn",
    payload: { type: "swing", directions: ["left", "up"] } },
  { id: "awning", label: "Awning",
    payload: { type: "swing", directions: ["up"] } },
  { id: "hopper", label: "Hopper",
    payload: { type: "swing", directions: ["down"] } },
  { id: "casement-left", label: "Casement, hinge left",
    payload: { type: "swing", directions: ["left"] } },
  { id: "casement-right", label: "Casement, hinge right",
    payload: { type: "swing", directions: ["right"] } },
  { id: "slider-left", label: "Slider, opens left",
    payload: { type: "slide", directions: ["left"] } },
  { id: "slider-right", label: "Slider, opens right",
    payload: { type: "slide", directions: ["right"] } },
];
```

```ts
// operationLabels.ts — sketch

const TITLE = { left: "Left", right: "Right", up: "Up", down: "Down" };
const TYPE = { swing: "Swing", slide: "Slide" };

export function formatOperation(op: ApertureOperation | null): string {
  if (op === null) return "Fixed";
  if (op.directions.length === 0) return TYPE[op.type];
  return `${TYPE[op.type]} (${op.directions.map((d) => TITLE[d]).join(", ")})`;
}
```

```ts
// operationSymbols.ts — sketch

export type Segment = { x1: number; y1: number; x2: number; y2: number };
export type Arrow = { shaft: Segment; head: { x: number; y: number }[] };

export function swingLines(
  glazing: { x: number; y: number; width: number; height: number },
  direction: "left" | "right" | "up" | "down",
  viewDirection: "exterior" | "interior",
): [Segment, Segment] {
  const screen = flipForView(direction, viewDirection);
  // hinge midpoint = midpoint of the named glazing edge
  const midpoint = edgeMidpoint(glazing, screen);
  // two opposite corners of the glazing rect
  const corners = oppositeCorners(glazing, screen);
  return [
    { x1: midpoint.x, y1: midpoint.y, x2: corners[0].x, y2: corners[0].y },
    { x1: midpoint.x, y1: midpoint.y, x2: corners[1].x, y2: corners[1].y },
  ];
}

export function slideArrow(
  glazing: { x: number; y: number; width: number; height: number },
  direction: "left" | "right" | "up" | "down",
  viewDirection: "exterior" | "interior",
): Arrow {
  const screen = flipForView(direction, viewDirection);
  // arrow at glazing center, length 80% of min dimension, head 10%
  // ...
}

function flipForView(
  direction: "left" | "right" | "up" | "down",
  viewDirection: "exterior" | "interior",
): "left" | "right" | "up" | "down" {
  if (viewDirection === "exterior") return direction;
  if (direction === "left") return "right";
  if (direction === "right") return "left";
  return direction;
}
```

```ts
// operationFrameMatch.ts — sketch

export function mismatchedSides(
  element: ApertureElement,
): ("top" | "right" | "bottom" | "left")[] {
  const elOpString = canonicalOperationString(element.operation);
  const sides: ("top" | "right" | "bottom" | "left")[] = [];
  (["top", "right", "bottom", "left"] as const).forEach((side) => {
    const frame = element.frames[side];
    if (frame?.catalog_origin == null) return;  // hand-entered: skip
    if (!frame.operation) return;
    if (normalize(frame.operation) !== elOpString) sides.push(side);
  });
  return sides;
}
```

## P4. Sequence

1. **Commit 1 — Operation labels + presets.** Add
   `operationLabels.ts` and `operationPresets.ts` with tests.
2. **Commit 2 — Operation symbol geometry.** Add
   `operationSymbols.ts` (pure functions returning segments /
   arrow points) with tests.
3. **Commit 3 — Canvas symbol layer.** Add
   `<OperationSymbols />` and mount inside
   `<ApertureSvgCanvas />`. Visual fidelity check vs V1.
4. **Commit 4 — OperationRow + preset menu.** Replace the
   Phase 06 read-only display with the editor; wire
   `setElementOperation`. Card test added.
5. **Commit 5 — Operation-frame mismatch warning.** Add
   `operationFrameMatch.ts`, `<OperationWarningBanner />`,
   dismissed-state in Zustand store. Wire the per-side ⚠
   indicator.
6. **Commit 6 — Backend audit + Phase 06 picker filter
   refresh.** Confirm the per-side picker re-queries with the
   new operation when the operation changes. `make ci` green.

## P5. Tests

### Unit — labels + presets

- `formatOperation(null) === "Fixed"`.
- `formatOperation({ type: "swing", directions: [] }) === "Swing"`.
- `formatOperation({ type: "swing", directions: ["left", "up"] })
   === "Swing (Left, Up)"`.
- Every preset's `payload` round-trips through `formatOperation`
  to a label string that contains the preset's friendly name.

### Unit — symbol geometry

- Swing left: two segments from left edge midpoint to the
  glazing's top-right and bottom-right corners.
- Swing left in interior view: two segments from the *right* edge
  midpoint to the glazing's top-left and bottom-left corners.
- Slide right: arrow shaft from glazing center pointing right,
  length 80% of min(w, h), head size 10%.

### Unit — frame match

- All sides match → empty array.
- Element operation = Swing + [Left]; top frame catalog
  operation = `Fixed` → `["top"]`.
- Hand-entered frame (origin null) is skipped.

### Component — OperationRow

- Selecting `Fixed` from the type select dispatches
  `setElementOperation({ operation: null })`.
- Selecting `Swing` then toggling `Left` and `Up` dispatches
  `{ type: "swing", directions: ["left", "up"] }`.
- Picking the `Tilt-Turn` preset dispatches the same payload.
- Locked / Viewer renders the display label, not the editor.

### Component — warning banner

- After changing operation from `Fixed` to `Swing+[Left]` while
  the top frame's catalog operation is `Fixed`, the warning
  banner shows and the top row carries the ⚠ icon.
- Dismissing the banner hides it for the rest of the session;
  switching aperture types or versions re-shows it next time.
- Re-picking the top frame with a matching operation clears the
  ⚠ for that side.

### Browser

- Pick a Swing+[Left] preset; verify the dashed hinge lines
  draw from the left glazing edge midpoint to the right
  corners.
- Flip view direction; verify the lines now draw from the
  right edge midpoint to the left corners.
- Change operation to Slide+[Right]; verify the arrow points
  rightward.
- Verify the picker reflects the new operation filter (Head
  + Slide for the top picker).
- Verify the warning banner fires when the new operation does
  not match the picked frame's catalog `operation`.

## P6. Out of scope (lands in later phases)

- Merge / split / copy-paste — Phase 08.
- U-Value coupling to operation — never (excluded by PRD §14).
- HBJSON export — Phase 10.

## P7. Risks

- **R-07-1. V1 symbol pixel-fidelity is a moving target.**
  Mitigation: `operationSymbols.test.ts` asserts geometry
  (coordinates of endpoints), not raster pixels. Visual review
  during the browser check confirms the stylistic match.
- **R-07-2. Tilt-turn (swing + [left, up]) draws two pairs of
  dashed lines that overlap visually.** Mitigation: PRD §9.2
  explicitly allows overlap; the symbol stays legible in
  practice. If feedback flags it, a future polish phase could
  introduce a tilt-specific composite.
- **R-07-3. Re-pick warning is informational, not enforcing.**
  Mitigation: the warning is the only nudge in v1; if the
  user keeps a mismatched frame deliberately, it stays.
  Phase 12 drift detection will surface it again via the
  catalog-origin drift path.
- **R-07-4. Operation-symbol z-order vs region rect z-order.**
  Mitigation: symbols render *after* glazing in the SVG so
  they paint above; tests assert the DOM order.
