---
DATE: 2026-06-04
TIME: 13:00
STATUS: Blocked on Phase 03
AUTHOR: Ed May / Claude
SCOPE: Land the canvas-side pick / paste (eyedropper /
       paint-bucket) state machine. Wire the SVG substrate to
       render mode-aware outlines + hover tints + a 600 ms
       paste-pulse animation. Add the bounded per-assembly
       undo stack and ⌘Z keybinding. Clear all pick / paste
       state on assembly switch.
RELATED:
  - planning/features/assembly-builder/PRD.md §5.10
  - context/user-stories/20-envelope.md US-ENV-9
  - planning/features/assembly-builder/phases/phase-03-assembly-header-toolbar.md
  - frontend/src/features/envelope/components/AssemblySvgCanvas.tsx
  - frontend/src/features/envelope/components/AssemblyCanvas.tsx
---

# Phase 4 — Pick / Paste state machine

## P0. Why this slice

Phase 04 is the last of the four-phase assembly-canvas rebuild.
It implements the full US-ENV-9 copy / paste contract on the
canvas:

- A `usePickPasteMode` hook that owns the state machine
  (`idle → picking → picked → pasting → pasting → idle`),
  the captured `CopiedAssignment`, and the bounded undo
  stack (per-assembly, 20-entry cap, in-memory only).
- Mode-aware SVG rendering in `AssemblySvgCanvas`:
  - `picking` — every `<rect>` gets a 2 px green outline; the
    cursor is the eyedropper SVG.
  - `picked` — the source segment retains a persistent green
    ring so the user knows what's on the clipboard.
  - `pasting` — hovered `<rect>` yellow-tints; cursor is the
    paint-bucket SVG.
- A 600 ms `@keyframes pastePulse` animation on each paste
  target.
- Global cancel: **ESC**, mousedown outside any `<rect>` /
  toolbar, **assembly switch**.
- ⌘Z (and the Phase 03 Undo button) pops one entry off the
  per-assembly undo stack and applies the inverse JSON-Patch.

Phase 04 does **not** ship: keyboard shortcuts ⌘C / ⌘V on
the canvas (deferred per US-ENV-9), multi-select paste, or
cross-assembly paste (all v1.1+).

## P1. Acceptance — Phase 4 done when

1. `usePickPasteMode` exports:
   - `mode: "idle" | "picking" | "picked" | "pasting"`
   - `sourcePayload: CopiedAssignment | null`
   - `undoStack: readonly UndoEntry[]` — max length 20.
   - `enterPickMode()`, `enterPasteMode()`, `cancel()`,
     `captureSource(segment)`,
     `applyPaste(layer, segment) → JsonPatchOp[]`,
     `undoLastPaste() → JsonPatchOp[]`.
   - State is keyed by `assembly.id` — switching active
     assembly clears mode + source + undo stack atomically.
2. **State machine transitions** (covered by the hook's
   tests):
   - `idle + enterPickMode()` → `picking`.
   - `picking + captureSource(seg)` → `picked` with
     `sourcePayload = { project_material_id,
     steel_stud_spacing_mm, is_continuous_insulation }` per
     US-ENV-9 criterion 3.
   - `picked + enterPasteMode()` → `pasting`.
   - `pasting + applyPaste(seg)` stays in `pasting` (multi-
     paste) and pushes an `UndoEntry` per target.
   - Any state + `cancel()` → `idle` with
     `sourcePayload = null` (does NOT clear undo stack —
     undo survives a cancel within the same assembly).
   - Assembly switch → `idle`, `sourcePayload = null`,
     `undoStack = []`.
3. **Mode-aware SVG rendering** in `AssemblySvgCanvas`:
   - `mode === "picking"` → every `<rect>` carries CSS class
     `segment--picking` (green 2 px outline).
   - `mode === "picked"` → the source segment carries
     `segment--source` (persistent green ring).
   - `mode === "pasting"` → hovered segment carries
     `segment--paste-hover` (yellow tint + outline). The
     source segment retains `segment--source`.
   - Apply via a `mode` + `sourceSegmentId` prop pair —
     keep `AssemblySvgCanvas` declarative.
4. **Cursor change** on the canvas wrapper via a CSS class
   driven by `mode`. SVG eyedropper / paint-bucket cursor
   files live in `frontend/src/features/envelope/cursors/`.
5. **`onSegmentClick` routing.** When `mode === "idle"`, the
   click opens `SegmentDialog`. When `picking`, the click
   calls `captureSource(segment)`. When `pasting`, the click
   calls `applyPaste(layer, segment)`. The
   `AssemblyCanvas.tsx` orchestrator does this routing —
   `AssemblySvgCanvas` stays mode-agnostic for click handling.
6. **Hover-`+` buttons hidden in pick / paste mode** — the
   `AssemblyCanvasOverlay` already gates on the `mode` prop
   (added in this phase as a passthrough). Hidden when
   `mode !== "idle"`.
7. **600 ms paste-pulse** — on each `applyPaste`, the target
   segment receives a transient CSS class
   `segment--paste-pulse` for 600 ms. The CSS keyframe runs
   yellow-glow → transparent.
8. **Global cancel paths:**
   - ESC anywhere with `mode !== "idle"` → `cancel()`.
   - `mousedown` outside any `<rect>` AND outside the
     toolbar → `cancel()`. Implemented via a document-level
     listener active only when `mode !== "idle"`, with
     capture-phase to beat React handlers.
   - Assembly switch (selectedAssemblyId change) → full
     reset.
9. **Undo stack:**
   - Each `applyPaste` pushes a `UndoEntry` =
     `{ inversePatchOps: JsonPatchOp[], targetSegmentId,
     timestamp }`. The inverse captures the target's
     `project_material_id`, `steel_stud_spacing_mm`,
     `is_continuous_insulation` **before** the paste.
   - Capacity 20 — pushing a 21st silently drops the oldest.
   - `undoLastPaste()` pops + returns the inverse ops; the
     caller applies them via the draft buffer.
   - ⌘Z (or ⌃Z on non-mac) triggers `undoLastPaste()` while
     the assembly is focused.
10. **Toolbar wires through** — Phase 03's
    `AssemblyToolbar` props (`mode`, `hasSource`,
    `undoStackEmpty`, `onEnterPickMode`, etc.) are fed by
    `usePickPasteMode` outputs. Phase 03 was scaffolded for
    this; Phase 04 connects the wires.
11. **R-value refetch** on `applyPaste` and on
    `undoLastPaste` — both mutate
    `segments[*].project_material_id` /
    `steel_stud_spacing_mm` /
    `is_continuous_insulation`, all in the US-ENV-10
    refetch-trigger set. Existing debounce stays.
12. `make ci` is green.

## P2. Files

### New

- `frontend/src/features/envelope/hooks/usePickPasteMode.ts`
- `frontend/src/features/envelope/hooks/usePickPasteMode.test.ts`
- `frontend/src/features/envelope/lib/paste-ops.ts` —
  `applyAssignmentOps(currentSegment, source, segmentPath)` →
  `JsonPatchOp[]` + the inverse generator.
- `frontend/src/features/envelope/__tests__/paste-ops.test.ts`
- `frontend/src/features/envelope/cursors/eyedropper.svg`
- `frontend/src/features/envelope/cursors/paint-bucket.svg`

### Modified

- `frontend/src/features/envelope/components/AssemblySvgCanvas.tsx`
  - Accept `mode`, `sourceSegmentId`, `hoveredSegmentId` props.
  - Apply CSS class toggles for the four mode-aware states.
- `frontend/src/features/envelope/components/AssemblyCanvas.tsx`
  - Mount `usePickPasteMode`.
  - Route segment clicks through the mode router.
  - Pass `mode` to overlay (which gates hover-`+`).
  - Wire global ESC + outside-mousedown listeners while
    `mode !== "idle"`.
  - Reset on `assembly.id` change via the hook.
- `frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx`
  - Accept `mode` prop; hide hover-`+` and segment-click
    affordances when `mode !== "idle"`.
- `frontend/src/features/envelope/envelope.css`
  - Add `@keyframes pastePulse` + `.segment--paste-pulse`
    rule.
  - Add `.segment--picking`, `.segment--source`,
    `.segment--paste-hover` rules.
  - Add `.assembly-canvas--picking` and
    `--pasting` cursor rules.
- `frontend/src/features/envelope/components/AssemblyHeader.tsx`
  - Read the toolbar props from `usePickPasteMode` (or its
    parent's exposure of those values) instead of placeholder
    no-ops added in Phase 03.

### Deleted

None.

## P3. Component shapes

```ts
// usePickPasteMode.ts
import { useEffect, useReducer, useRef } from "react";

export type CopiedAssignment = {
  project_material_id: string | null;
  steel_stud_spacing_mm: number | null;
  is_continuous_insulation: boolean;
};

export type Mode = "idle" | "picking" | "picked" | "pasting";

export type UndoEntry = {
  inversePatchOps: JsonPatchOp[];
  targetSegmentId: string;
  timestamp: number;
};

const MAX_UNDO = 20;

type State = {
  mode: Mode;
  sourcePayload: CopiedAssignment | null;
  sourceSegmentId: string | null;
  undoStack: UndoEntry[];
};

type Action =
  | { type: "enterPick" }
  | { type: "enterPaste" }
  | { type: "cancel" }
  | { type: "captureSource"; segmentId: string; payload: CopiedAssignment }
  | { type: "recordPaste"; entry: UndoEntry }
  | { type: "popUndo" }
  | { type: "switchAssembly" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "enterPick":
      return { ...s, mode: "picking" };
    case "enterPaste":
      return s.sourcePayload === null ? s : { ...s, mode: "pasting" };
    case "cancel":
      return { ...s, mode: "idle", sourcePayload: null, sourceSegmentId: null };
    case "captureSource":
      return {
        ...s,
        mode: "picked",
        sourcePayload: a.payload,
        sourceSegmentId: a.segmentId,
      };
    case "recordPaste": {
      const next = [...s.undoStack, a.entry];
      if (next.length > MAX_UNDO) next.shift();
      return { ...s, undoStack: next };
    }
    case "popUndo":
      return { ...s, undoStack: s.undoStack.slice(0, -1) };
    case "switchAssembly":
      return { mode: "idle", sourcePayload: null, sourceSegmentId: null, undoStack: [] };
  }
}

export function usePickPasteMode(assemblyId: string | null) {
  const [state, dispatch] = useReducer(reducer, {
    mode: "idle",
    sourcePayload: null,
    sourceSegmentId: null,
    undoStack: [],
  });
  const prevAssemblyId = useRef(assemblyId);

  useEffect(() => {
    if (prevAssemblyId.current !== assemblyId) {
      dispatch({ type: "switchAssembly" });
      prevAssemblyId.current = assemblyId;
    }
  }, [assemblyId]);

  // Returns dispatchers + values consumed by AssemblyCanvas / Toolbar.
}
```

```ts
// paste-ops.ts
export function pasteAssignmentOps(
  currentSegment: AssemblySegment,
  source: CopiedAssignment,
  segmentPath: string,    // e.g. "/tables/assemblies/0/layers/2/segments/1"
): { forwardOps: JsonPatchOp[]; inverseOps: JsonPatchOp[] } {
  const forwardOps: JsonPatchOp[] = [];
  const inverseOps: JsonPatchOp[] = [];
  if (currentSegment.project_material_id !== source.project_material_id) {
    forwardOps.push({
      op: "replace",
      path: `${segmentPath}/project_material_id`,
      value: source.project_material_id,
    });
    inverseOps.unshift({
      op: "replace",
      path: `${segmentPath}/project_material_id`,
      value: currentSegment.project_material_id,
    });
  }
  if (currentSegment.steel_stud_spacing_mm !== source.steel_stud_spacing_mm) {
    forwardOps.push({
      op: "replace",
      path: `${segmentPath}/steel_stud_spacing_mm`,
      value: source.steel_stud_spacing_mm,
    });
    inverseOps.unshift({
      op: "replace",
      path: `${segmentPath}/steel_stud_spacing_mm`,
      value: currentSegment.steel_stud_spacing_mm,
    });
  }
  if (currentSegment.is_continuous_insulation !== source.is_continuous_insulation) {
    forwardOps.push({
      op: "replace",
      path: `${segmentPath}/is_continuous_insulation`,
      value: source.is_continuous_insulation,
    });
    inverseOps.unshift({
      op: "replace",
      path: `${segmentPath}/is_continuous_insulation`,
      value: currentSegment.is_continuous_insulation,
    });
  }
  return { forwardOps, inverseOps };
}
```

```css
/* envelope.css additions */
@keyframes pastePulse {
  0%   { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.6); }
  100% { box-shadow: 0 0 0 8px rgba(255, 193, 7, 0); }
}

.segment--picking          { stroke: rgba(56, 142, 60, 0.8); stroke-width: 2; }
.segment--source           { stroke: rgba(56, 142, 60, 1);   stroke-width: 3; }
.segment--paste-hover      { fill-opacity: 0.7; stroke: rgba(255, 193, 7, 0.8); stroke-width: 2; }
.segment--paste-pulse      { animation: pastePulse 600ms ease-out; }

.assembly-canvas--picking  { cursor: url(./cursors/eyedropper.svg) 4 28, crosshair; }
.assembly-canvas--pasting  { cursor: url(./cursors/paint-bucket.svg) 4 28, crosshair; }
```

## P4. Sequence

1. **Commit 1 — `paste-ops` pure functions + tests.** Forward
   + inverse op generators. Pure; reusable.
2. **Commit 2 — `usePickPasteMode` hook + tests.** State
   machine, undo stack with cap, assembly-switch reset.
3. **Commit 3 — Mode-aware SVG rendering.** Add `mode` /
   `sourceSegmentId` props to `AssemblySvgCanvas`; toggle
   classes; tests.
4. **Commit 4 — Wire into `AssemblyCanvas`.** Mount the hook,
   route clicks by mode, gate the overlay's hover-`+`
   visibility, push real props to the toolbar, attach ESC +
   outside-mousedown listeners.
5. **Commit 5 — CSS + cursor assets.** Add the keyframe,
   class rules, cursor SVGs. Visual polish.
6. **Commit 6 — ⌘Z keybinding + Undo button wire.** Document-
   level keydown listener gated on focus being inside the
   envelope page; pops undo stack + applies inverse ops via
   the draft buffer.

Each commit `make ci` clean.

## P5. Tests

### Unit — `paste-ops` (`__tests__/paste-ops.test.ts`)

- All three target fields differ → 3 forward ops + 3 inverse
  ops.
- Identical source / target → 0 forward ops + 0 inverse ops
  (no-op paste).
- Only `project_material_id` differs → 1 forward, 1 inverse.
- Inverse applied after forward returns target to original
  state (round-trip test on a fake document).

### Unit — `usePickPasteMode` (`hooks/usePickPasteMode.test.ts`)

- Initial state is `idle` / null / null / [].
- `enterPickMode` → `picking`.
- `enterPasteMode` without source → no-op (still `picked`
  or `idle`).
- Full happy path: pick → captureSource → pasting →
  recordPaste 5× → undoStack length 5.
- Capacity: 21st recordPaste drops the oldest entry; stack
  length stays 20.
- `cancel` resets mode + source but preserves undoStack.
- Assembly switch clears everything atomically.
- ⌘Z handler (separate test in the parent): pops one entry,
  emits the inverse ops.

### Unit — `AssemblySvgCanvas` mode rendering

- `mode="picking"` + 5-segment fixture → all 5 `<rect>` have
  the `segment--picking` class.
- `mode="picked"` with `sourceSegmentId="seg_2"` → only seg_2
  has `segment--source`.
- `mode="pasting"` with `hoveredSegmentId="seg_3"` → seg_3
  has `segment--paste-hover`; sourceSegmentId still has
  `segment--source`.

### Integration — `EnvelopePage.test.tsx`

- Click Eyedropper → mode `picking` → click a segment with
  material X → mode `picked`. Visual: source segment ringed.
- Click Paint-bucket → mode `pasting` → click a target →
  draft document has target.project_material_id = X.
- Click another target → also painted; undo stack length = 2.
- Press ⌘Z → most recent target reverts; stack length = 1.
- Switch active assembly → mode `idle`, undo stack empty.
- ESC during pick → mode `idle`, source dropped, but undo
  stack survives.

## P6. Out of scope (lands in later phases / never)

- Keyboard shortcuts ⌘C / ⌘V on the canvas — US-ENV-9
  defers to v1.1+.
- Multi-select paste — US-ENV-9 defers.
- Cross-assembly paste — US-ENV-9 defers (data model
  supports it trivially; UX deferred).
- Touch / pen support for pick / paste gestures — no
  defined behavior; default to mouse only.

## P7. Risks

- **Document-level listeners (ESC, outside-mousedown, ⌘Z)
  leaking across the app.** Mitigation: attach inside an
  effect gated on `mode !== "idle"` (ESC, outside) or on
  the envelope page being mounted (⌘Z). Detach in the
  cleanup.
- **Undo entry's inverse drifts from current state** if the
  user edits a target's properties between paste and undo.
  Mitigation: each undo entry captures the **target's
  state at paste time**; undo restores to that snapshot
  even if intervening edits happened. This is the simple
  semantics and matches "undo the paste action specifically,"
  not "undo all changes since."
- **Cursor URL assets in CSS** — Vite asset handling can be
  flaky for `url()` paths. Mitigation: import the SVGs in
  the CSS via `~/features/envelope/cursors/*.svg` or use
  Vite's `import url from './path?url'` pattern with inline
  styles. Pick one and document.
- **`@keyframes pastePulse` runs on box-shadow** which is
  ignored on SVG elements in some browsers. Mitigation:
  use a `<rect>` `stroke` animation instead (CSS animation
  on stroke-width or a sibling `<rect>` overlay). Test
  cross-browser in commit 5.
