---
DATE: 2026-06-04
TIME: 13:00
STATUS: Blocked on Phase 02
AUTHOR: Ed May / Claude
SCOPE: Add the assembly-scoped header toolbar — flip orientation,
       flip layers, flip segments (NEW), zoom cluster (− / % / +
       / Fit), and entry buttons for eyedropper / paint-bucket /
       undo. Backend-only adjustments are pure JSON-Patch
       generators (no schema work). The pick / paste canvas-side
       rendering lands in Phase 04; this phase only mounts the
       UI surface and wires the entry handlers.
RELATED:
  - planning/features/assembly-builder/PRD.md §5.7
  - planning/features/assembly-builder/phases/phase-01-svg-canvas-substrate.md
  - planning/features/assembly-builder/phases/phase-02-overlay-chrome.md
  - context/user-stories/20-envelope.md US-ENV-3, US-ENV-8, US-ENV-9
  - frontend/src/features/envelope/components/AssemblyHeader.tsx
  - frontend/src/lib/userPreferencesStore.ts
---

# Phase 3 — Assembly Header Toolbar

## P0. Why this slice

Phase 03 adds the toolbar cluster between the Effective R-Value
label and the `⋯` overflow menu in `AssemblyHeader.tsx`. It
lands six buttons and one zoom cluster:

- **Flip Orientation** — toggle `assembly.orientation`.
- **Flip Layers** — reverse `assembly.layers[]` + renumber.
- **Flip Segments** (NEW vs US-ENV-8) — for every layer, reverse
  `layer.segments[]` + renumber. Q-AB-1 resolved to per-assembly.
- **Eyedropper** — enter `picking` mode (canvas-side feedback
  lands Phase 04).
- **Paint-bucket** — enter `pasting` mode (enabled only once a
  source is captured).
- **Undo-last-paste** — pops the per-assembly paste-undo stack
  (stack implementation lands Phase 04; button surface here).
- **Zoom cluster** `[−] 100% [+] [Fit]` — discrete-step zoom
  (Q-AB-6 → max 3.0x). Persisted to
  `userPreferencesStore.envelope_canvas_zoom`.

This phase is mostly UI + pure JSON-Patch generators. It does
NOT touch the canvas substrate or overlay. The canvas-side
pick / paste rendering and the undo-stack data layer land in
Phase 04.

## P1. Acceptance — Phase 3 done when

1. `AssemblyToolbar.tsx` exists and is mounted inside
   `AssemblyHeader.tsx`, between the EffectiveRValueLabel and
   the `⋯` overflow menu.
2. **Flip Orientation** click → one JSON-Patch toggles
   `tables.assemblies[a].orientation` between
   `"first_layer_outside"` ↔ `"last_layer_outside"`. R-value
   refetch triggered.
3. **Flip Layers** click → one JSON-Patch replaces
   `tables.assemblies[a].layers` with the reversed array,
   re-numbering each `layer.order` to its new index. R-value
   refetch triggered.
4. **Flip Segments** click → one JSON-Patch replaces every
   layer's `segments` with its reverse + renumbers
   `segment.order`. Whole-assembly flip per Q-AB-1. R-value
   refetch triggered.
5. **Zoom cluster** behavior:
   - `[−]` steps `canvasZoom` to the previous entry in
     `ZOOM_STEPS` (clamped at min).
   - `[+]` steps to the next entry (clamped at max).
   - Numeric label = `Math.round(zoom * 100) + "%"` (read-only
     v1, per US-ENV-3 criterion 1).
   - `[Fit]` computes
     `Math.min(viewportW / vb.width, viewportH / vb.height)`
     and snaps to the nearest entry in `ZOOM_STEPS` that
     does not exceed the computed fit factor.
   - All four affordances are always visible (also for locked
     versions and Viewers — zoom is a viewing aid per US-ENV-3
     criterion 1).
   - Persisted to
     `userPreferencesStore.envelope_canvas_zoom` (number,
     default 1.0). Survives reload; not per-document.
6. **Eyedropper** button click → `enterPickMode()` on the
   canvas state hook. Visual state: button shows the pressed
   variant while `mode === "picking"`. Phase 04 fills in the
   SVG-side rendering.
7. **Paint-bucket** button is **disabled** unless
   `sourcePayload !== null`. On click, calls `enterPasteMode()`.
   Phase 04 fills in the SVG-side rendering.
8. **Undo-last-paste** button is **disabled** unless
   `undoStack.length > 0`. On click, calls `undoLastPaste()`.
   Phase 04 fills in the stack semantics.
9. All toolbar buttons are **disabled when no assembly is
   selected, when the active version is locked, or while in
   pick / paste mode** for the unrelated buttons (per
   US-ENV-3 criterion 4 / US-ENV-9 visual feedback).
10. Each toolbar action surfaces a tooltip via shadcn
    `<Tooltip>` — verbatim strings per US-ENV-8 criterion 1
    and analogous patterns for the new buttons.
11. New JSON-Patch generators in `lib.ts` are pure functions,
    unit-tested with multiple fixtures:
    - `flipAssemblyOrientationOps(assembly)`
    - `flipAssemblyLayersOps(assembly)`
    - `flipAssemblySegmentsOps(assembly)`
    Each returns the array of `JsonPatchOp` the draft buffer
    consumes.
12. `useCanvasZoom` hook exists, exports
    `{ zoom, setZoom, stepUp, stepDown, fitToViewport }`. Tests
    cover the discrete-step math + persistence.
13. `make ci` is green.

## P2. Files

### New

- `frontend/src/features/envelope/components/AssemblyToolbar.tsx`
- `frontend/src/features/envelope/components/__tests__/AssemblyToolbar.test.tsx`
- `frontend/src/features/envelope/hooks/useCanvasZoom.ts`
- `frontend/src/features/envelope/hooks/useCanvasZoom.test.ts`
- `frontend/src/features/envelope/__tests__/flip-ops.test.ts`

### Modified

- `frontend/src/features/envelope/lib.ts`
  - Add `flipAssemblyOrientationOps`,
    `flipAssemblyLayersOps`, `flipAssemblySegmentsOps`.
- `frontend/src/features/envelope/components/AssemblyHeader.tsx`
  - Mount `<AssemblyToolbar />` between EffectiveRValueLabel
    and the `⋯` overflow menu.
- `frontend/src/features/envelope/components/AssemblyCanvas.tsx`
  - Consume `zoom` from `useCanvasZoom()` instead of from a
    parent prop (or keep prop-driven and let the parent
    consume the hook — pick one in commit 4).
- `frontend/src/lib/userPreferencesStore.ts`
  - Add `envelope_canvas_zoom: number` field with default
    `1.0`. Migrate existing stored prefs by defaulting on
    read.

### Deleted

None.

## P3. Component shapes

```tsx
// AssemblyToolbar.tsx
import { Copy, Eye, Flip, FlipVertical, RotateCcw, SwapVert } from "lucide-react";

export type AssemblyToolbarProps = {
  hasAssembly: boolean;
  canEdit: boolean;
  mode: "idle" | "picking" | "picked" | "pasting";
  hasSource: boolean;         // pick-paste sourcePayload != null
  undoStackEmpty: boolean;
  zoom: number;
  onFlipOrientation: () => void;
  onFlipLayers: () => void;
  onFlipSegments: () => void;
  onEnterPickMode: () => void;
  onEnterPasteMode: () => void;
  onUndoPaste: () => void;
  onZoomDown: () => void;
  onZoomUp: () => void;
  onZoomFit: () => void;
};

export function AssemblyToolbar(props: AssemblyToolbarProps) {
  const editableDisabled = !props.hasAssembly || !props.canEdit;
  // ... renders the cluster.
  // Each button: shadcn <Tooltip> wraps <Button variant="ghost" size="icon">.
}
```

```ts
// useCanvasZoom.ts
import { ZOOM_STEPS } from "../canvas-constants";
import { useUserPreferences } from "../../../lib/userPreferencesStore";

export function useCanvasZoom() {
  const { envelope_canvas_zoom, setEnvelopeCanvasZoom } = useUserPreferences();
  const zoom = envelope_canvas_zoom ?? 1.0;

  function stepUp() {
    const idx = ZOOM_STEPS.findIndex((z) => z >= zoom);
    const nextIdx = Math.min(idx + 1, ZOOM_STEPS.length - 1);
    setEnvelopeCanvasZoom(ZOOM_STEPS[nextIdx]);
  }

  function stepDown() {
    const idx = ZOOM_STEPS.findIndex((z) => z >= zoom);
    const prevIdx = Math.max(idx - 1, 0);
    setEnvelopeCanvasZoom(ZOOM_STEPS[prevIdx]);
  }

  function fitToViewport(viewportW: number, viewportH: number, vb: ViewBox) {
    const ideal = Math.min(viewportW / vb.width, viewportH / vb.height);
    // Snap to largest ZOOM_STEP that does not exceed ideal.
    const snapped = [...ZOOM_STEPS].reverse().find((s) => s <= ideal) ?? ZOOM_STEPS[0];
    setEnvelopeCanvasZoom(snapped);
  }

  return { zoom, stepUp, stepDown, fitToViewport, setZoom: setEnvelopeCanvasZoom };
}
```

```ts
// lib.ts — flip JSON-Patch generators
import type { Assembly, JsonPatchOp } from "./types";

const ORIENTATION_TOGGLE = {
  first_layer_outside: "last_layer_outside",
  last_layer_outside: "first_layer_outside",
} as const;

export function flipAssemblyOrientationOps(
  assembly: Assembly,
  assemblyPath: string,           // e.g. "/tables/assemblies/0"
): JsonPatchOp[] {
  return [{
    op: "replace",
    path: `${assemblyPath}/orientation`,
    value: ORIENTATION_TOGGLE[assembly.orientation],
  }];
}

export function flipAssemblyLayersOps(
  assembly: Assembly,
  assemblyPath: string,
): JsonPatchOp[] {
  const reversed = [...assembly.layers].reverse().map((l, i) => ({ ...l, order: i }));
  return [{
    op: "replace",
    path: `${assemblyPath}/layers`,
    value: reversed,
  }];
}

export function flipAssemblySegmentsOps(
  assembly: Assembly,
  assemblyPath: string,
): JsonPatchOp[] {
  const next = assembly.layers.map((layer) => ({
    ...layer,
    segments: [...layer.segments].reverse().map((s, i) => ({ ...s, order: i })),
  }));
  return [{
    op: "replace",
    path: `${assemblyPath}/layers`,
    value: next,
  }];
}
```

## P4. Sequence

1. **Commit 1 — Flip-ops generators + tests.** Add the three
   pure functions to `lib.ts` and unit-test them on fixtures
   (single-layer, multi-layer, multi-segment-per-layer). No
   callers yet.
2. **Commit 2 — `useCanvasZoom` hook + tests.** Add the hook,
   extend `userPreferencesStore.ts`, test step / fit math.
3. **Commit 3 — `AssemblyToolbar` component + tests.** Compose
   the cluster. Disabled-state gating. Tooltip strings.
4. **Commit 4 — Wire into `AssemblyHeader`.** Mount the
   toolbar with the live generators + hook. Update integration
   tests if header selectors changed.
5. **Commit 5 — Canvas zoom rewire.** `AssemblyCanvas`
   consumes `useCanvasZoom().zoom` instead of a parent prop;
   the canvas's `[Fit]` handler uses the wrapper's
   `ResizeObserver` to feed `fitToViewport`. Minor refactor.

Each commit `make ci` clean.

## P5. Tests

### Unit — flip-ops (`__tests__/flip-ops.test.ts`)

- `flipAssemblyOrientationOps` returns one `replace` op
  toggling the enum.
- `flipAssemblyLayersOps`:
  - Empty `layers` → `value: []`.
  - 3-layer fixture → reversed, with `order: 0, 1, 2`
    matching new positions.
  - Layer IDs preserved (we're not regenerating).
- `flipAssemblySegmentsOps`:
  - Every layer's segments reversed + renumbered.
  - Single-segment layers unchanged in shape but order-0
    preserved.

### Unit — `useCanvasZoom` (`hooks/useCanvasZoom.test.ts`)

- `stepUp` from 1.0 → 1.5.
- `stepUp` from 3.0 → 3.0 (clamped).
- `stepDown` from 0.5 → 0.5 (clamped).
- `stepDown` from 1.0 → 0.75.
- `fitToViewport`: ideal = 1.2 → snap to 1.0; ideal = 0.4 →
  snap to 0.5 (floor of available step) — confirm policy in
  test.
- Persistence: `setZoom(2.0)` causes
  `useUserPreferences().envelope_canvas_zoom` to read `2.0`.

### Unit — `AssemblyToolbar` (`__tests__/AssemblyToolbar.test.tsx`)

- All buttons rendered.
- `hasAssembly=false` → all editable buttons disabled.
- `canEdit=false` → editable buttons disabled, zoom still
  enabled.
- `hasSource=false` → paint-bucket disabled.
- `undoStackEmpty=true` → undo disabled.
- `mode="picking"` → eyedropper shows pressed variant; other
  edit-buttons disabled.
- Tooltips render with the verbatim strings.
- Click each button → corresponding handler called.

### Integration — header

- `AssemblyHeader` renders the toolbar after R-Value label.
- Clicking Flip Orientation on the integration tree mutates
  the draft body's `orientation` value (via the JSON-Patch
  generator + draft buffer).
- Zoom step persists across a fake remount.

## P6. Out of scope (lands in later phases)

- Pick / paste canvas-side mode rendering (green outline,
  yellow tint, pulse animation) — Phase 04.
- Undo stack implementation — Phase 04 owns the
  `useEnvelopeCanvasMode` hook that holds the stack.
- ⌘Z keybinding — Phase 04.
- Cmd/Ctrl + scroll-wheel zoom — deferred per PRD §3.
- "Mirror assembly" combined-flip menu item — deferred per
  US-ENV-8 criterion 2.

## P7. Risks

- **`userPreferencesStore` schema change** could collide with
  existing stored values. Mitigation: nullable field;
  `envelope_canvas_zoom ?? 1.0` on read; no migration script
  needed (no users yet, but the pattern stays clean).
- **`[Fit]` semantics ambiguity** — "largest step that fits"
  vs "step closest to the ideal." Pick "largest step ≤ ideal"
  (floors); document in `useCanvasZoom` doc-comment.
- **Toolbar density** — six buttons + a zoom cluster + the
  existing `⋯` is a lot. Mitigation: use icon-only buttons
  with shadcn tooltips; allow line wrap on narrow viewports.
  Phase 03 ships the desktop layout only; mobile / narrow
  layouts are a v1.1+ concern.
- **Flip-Layers vs Flip-Orientation semantics confuse users.**
  Mitigation: tooltips spell out the difference ("Flip
  interior / exterior orientation" vs "Reverse layers from
  inside to outside") verbatim per US-ENV-8 criterion 1.
