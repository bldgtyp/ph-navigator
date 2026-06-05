---
DATE: 2026-06-05
TIME: 16:30 EDT
STATUS: Active — not yet started
AUTHOR: Codex
SCOPE: Toolbar Merge / Split buttons that respect the no-holes
       coverage invariant, eyedropper / paint-bucket copy-paste
       state machine for assignment transfer between elements,
       bounded 20-entry undo stack per aperture type, ESC and
       ⌘Z keyboard shortcuts, visual pulse animation on paste.
       Backend handlers `mergeElements`, `splitElement`,
       `pasteAssignment` are filled in beyond Phase 01 stubs.
RELATED:
  - planning/features/apertures/PRD.md §13 (ApertureCommand),
    §19 (testing), §20 (phase group 6)
  - planning/features/apertures/PLAN.md (Phase 08 row)
  - planning/archive/assembly-builder/phases/phase-04-pick-paste-state-machine.md
    (precedent: pick / paste state machine + 20-entry undo)
  - context/user-stories/10-windows.md US-WIN-3 (merge / split),
    US-WIN-7 (copy / paste)
  - phase-01 (delivers `mergeElements`, `splitElement`,
    `pasteAssignment` stubs)
  - phase-04 (selection model — multi-select drives merge)
---

# Phase 8 — Merge / split + copy/paste + bounded undo

## P0. Why this slice

Phase 08 completes the in-canvas editing surface. The user
shift-selects two adjacent elements and hits Merge; selects a
merged element and hits Split; uses the eyedropper to grab an
element's full assignment payload (frames + glazing + operation
+ name) and the paint-bucket to apply it across a series of
target elements; presses ⌘Z to walk back.

By the end of Phase 08:

- Toolbar exposes `Merge`, `Split`, `Eyedropper`, `Paint bucket`,
  `Undo last paste` buttons. Each is gated by selection state.
- `Merge` validates that the current selection forms a contiguous
  rectangle (no holes, no non-rectangle shapes) and dispatches
  `mergeElements`. The merged element inherits assignments
  (frames / glazing / operation / name) from the **top-left**
  source element; a Sonner toast confirms which source provided
  them.
- `Split` is enabled only when exactly one element is selected
  AND that element spans more than 1×1. Dispatches `splitElement`;
  per Q-WIN-6 lean, every new 1×1 cell inherits the source's
  assignments — V1's papercut (assignments lost on split) is
  fixed.
- Eyedropper / paint-bucket state machine runs in the
  apertures Zustand store: `idle → picking → picked → pasting`
  (rapid-fire from `pasting`); ESC at any non-idle returns to
  `idle`.
- Paste copies the **6 fields** (operation, glazing, four
  frames) including `catalog_origin` blocks. `id`, `row_span`,
  `column_span`, `name` are not copied — the target keeps its
  own.
- Single JSON-Patch per paste-target (atomic at the draft-buffer
  level).
- 20-entry undo stack per aperture type; `Undo last paste`
  toolbar button + ⌘Z keyboard shortcut.
- 600 ms pulse animation on the paste target after each paste.
- No cross-aperture paste; switching aperture types or versions
  clears all pick / paste state.

Phase 08 does **not** ship U-Value (Phase 09), HBJSON export
(Phase 10), manufacturer filters (Phase 11), refresh-from-catalog
(Phase 12), or any new picker UI.

## P1. Acceptance — Phase 8 done when

1. **Toolbar buttons** added to `<ApertureCanvasToolbar />`:
   - `Merge` (lucide `Combine`) — enabled when ≥ 2 elements
     selected. Tooltip names the count: `Merge selected
     (3 elements)`.
   - `Split` — enabled when exactly 1 element is selected AND
     its `row_span[1] > row_span[0]` OR `column_span[1] >
     column_span[0]`.
   - `Eyedropper` (lucide `Pipette`) — always enabled when
     `canEdit`.
   - `Paint bucket` (lucide `PaintBucket`) — enabled only when
     state is `picked` or `pasting`.
   - `Undo last paste` (lucide `Undo2`) — enabled when the
     active aperture's undo stack is non-empty.
   - All buttons hidden on locked / Viewer.
2. **Merge behavior:**
   - Client validates contiguous-rectangle at click time using
     `mergeRectangleFromSelection(elements, selectedIds)`. If
     the selection is non-rectangular or has internal gaps,
     toast `Selection isn't a rectangle. Pick contiguous
     cells to merge.` and abort.
   - On valid selection, dispatch `mergeElements` with
     `aperture_type_id` and the ordered list of source element
     ids. Backend re-validates and writes a single
     `ApertureElement` covering the union span. The new element
     inherits the top-left source's assignments (frames /
     glazing / operation / name).
   - On success, toast `Merged N elements; kept assignments
     from top-left ('<name>')` per US-WIN-3 criterion 6.
   - Selection updates to the new merged element.
3. **Split behavior:**
   - Client computes the new 1×1 cells from the source's spans.
   - Dispatches `splitElement` with the source element id.
   - Backend re-validates and writes N new elements (each 1×1,
     fresh `aptel_<token>` id, `name=source.name`,
     `frames=source.frames` (deep-copy with fresh
     `catalog_origin.synced_at` updated to now since the new
     elements are now distinct copies), `glazing=source.glazing`,
     `operation=source.operation`).
   - Selection updates to the set of new elements.
4. **Pick / paste state machine** lives in the Zustand store
   (Phase 04's `pickPasteMode` field, now populated):
   - `idle` → eyedropper click → `picking`.
   - `picking` → element click → `picked`; capture
     `pickedAssignment = { operation, glazing, frames }`.
   - `picked` → paint-bucket click → `pasting`.
   - `pasting` → element click → paste applied (one JSON-Patch),
     600 ms pulse on the target, state stays in `pasting` for
     rapid fire.
   - `Esc` from any non-idle state → `idle` (clears
     `pickedAssignment`).
   - Click on the canvas background during pick / paste →
     `idle`.
5. **Paste payload** is the 6 fields named in PRD §13:
   `operation`, `glazing`, `frames.top`, `frames.right`,
   `frames.bottom`, `frames.left`. Catalog-origin blocks travel
   with the copy. `id`, `row_span`, `column_span`, `name` are
   not copied.
6. **Backend `pasteAssignment` handler:**
   - Loads the source element's 6 fields.
   - Writes them onto the target element via a single
     JSON-Patch with multiple `replace` ops.
   - Re-validates coverage (no change expected).
   - Audit: `command="pasteAssignment"`, `source_element_id`,
     `target_element_id`, fields covered, `affects_u_value=True`.
7. **Bounded undo stack:**
   - Lives in the Zustand store, keyed per aperture type.
     Maximum 20 entries.
   - On every successful paste, push a snapshot of the
     target element's prior 6 fields onto the stack.
   - `Undo last paste` pops the most recent entry and
     dispatches a `pasteAssignment` with the prior payload.
   - ⌘Z (Cmd-Z) does the same on the canvas with focus.
   - Switching aperture types or versions clears the stack
     (matches the no-cross-aperture-paste decision).
8. **Visual feedback:**
   - Source element under `picked` state renders a CSS
     ring outline `--copy-source-ring`.
   - Target element under `pasting` renders a 600 ms pulse
     animation `--paste-pulse` on success.
   - Cursor changes to a pipette / paint-bucket icon during
     pick / paste mode.
9. **Cross-aperture / cross-version:**
   - Switching the active aperture type clears `pickPasteMode`,
     `pickedAssignment`, and the undo stack for the previous
     aperture (other apertures' stacks preserved).
   - Switching the active version clears every aperture's
     pick / paste state.
10. **Backend `mergeElements`, `splitElement`,
    `pasteAssignment` handlers** filled in beyond Phase 01
    stubs:
    - `mergeElements` validates the source list forms a
      contiguous rectangle; raises `aperture_merge_not_rectangle`
      otherwise.
    - `splitElement` requires `row_span[1] > row_span[0] OR
      column_span[1] > column_span[0]`; raises
      `aperture_split_not_split-able` otherwise.
    - `pasteAssignment` validates source / target ids exist in
      the same aperture type.
    - All three end with `validate_document` to enforce
      coverage.
11. `make ci` is green.

## P2. Files

### New (frontend)

- `frontend/src/features/apertures/components/MergeSplitButtons.tsx`
- `frontend/src/features/apertures/components/PickPasteButtons.tsx`
- `frontend/src/features/apertures/components/UndoButton.tsx`
- `frontend/src/features/apertures/lib/mergeValidation.ts`
- `frontend/src/features/apertures/lib/splitGeometry.ts`
- `frontend/src/features/apertures/lib/pickPasteMachine.ts`
- `frontend/src/features/apertures/hooks/usePickPasteShortcut.ts`
- `frontend/src/features/apertures/hooks/useUndoShortcut.ts`
- `frontend/src/features/apertures/__tests__/mergeValidation.test.ts`
- `frontend/src/features/apertures/__tests__/splitGeometry.test.ts`
- `frontend/src/features/apertures/__tests__/pickPasteMachine.test.ts`
- `frontend/src/features/apertures/__tests__/PickPaste.flow.test.tsx`
- `frontend/src/features/apertures/__tests__/MergeSplit.flow.test.tsx`

### New (backend)

- `backend/features/project_document/aperture_commands/handlers/merge_split.py`
- `backend/features/project_document/aperture_commands/handlers/paste.py`
- `backend/features/project_document/__tests__/test_aperture_merge_split.py`
- `backend/features/project_document/__tests__/test_aperture_paste.py`

### Modified

- `frontend/src/features/apertures/components/ApertureCanvasToolbar.tsx`
  - Add the five new toolbar buttons.
- `frontend/src/features/apertures/store/builder-store.ts`
  - Populate `pickPasteMode`, `pickedAssignment`, and add
    `undoStacksByAperture: Record<string, PasteUndoEntry[]>`.
- `frontend/src/features/apertures/components/ApertureCanvasOverlay.tsx`
  - When `pickPasteMode !== "idle"`, element clicks drive the
    state machine instead of the selection model.
- `backend/features/project_document/aperture_commands/models.py`
  - Fill in `MergeElements`, `SplitElement`, `PasteAssignment`
    shapes.

### Deleted

None.

## P3. Component / model shapes

```ts
// mergeValidation.ts — sketch

export function selectedElements(
  apertureEntry: ApertureTypeEntry,
  selectedIds: string[],
): ApertureElement[] {
  return apertureEntry.elements.filter((e) => selectedIds.includes(e.id));
}

export function isContiguousRectangle(
  apertureEntry: ApertureTypeEntry,
  selectedIds: string[],
): { ok: true; merged: { row_span: [number, number]; column_span: [number, number] } } | { ok: false; reason: string } {
  const elements = selectedElements(apertureEntry, selectedIds);
  if (elements.length < 2) return { ok: false, reason: "fewer than two elements" };
  // compute union bounding span
  const r0 = Math.min(...elements.map((e) => e.row_span[0]));
  const r1 = Math.max(...elements.map((e) => e.row_span[1]));
  const c0 = Math.min(...elements.map((e) => e.column_span[0]));
  const c1 = Math.max(...elements.map((e) => e.column_span[1]));
  // every cell in the union must be covered by exactly one selected element
  const covered = new Set<string>();
  for (const el of elements) {
    for (let r = el.row_span[0]; r <= el.row_span[1]; r++) {
      for (let c = el.column_span[0]; c <= el.column_span[1]; c++) {
        const key = `${r},${c}`;
        if (covered.has(key)) return { ok: false, reason: "overlap" };
        covered.add(key);
      }
    }
  }
  const expected = (r1 - r0 + 1) * (c1 - c0 + 1);
  if (covered.size !== expected) return { ok: false, reason: "non-rectangular" };
  return { ok: true, merged: { row_span: [r0, r1], column_span: [c0, c1] } };
}

export function topLeftSource(elements: ApertureElement[]): ApertureElement {
  return [...elements].sort((a, b) => {
    if (a.row_span[0] !== b.row_span[0]) return a.row_span[0] - b.row_span[0];
    return a.column_span[0] - b.column_span[0];
  })[0];
}
```

```ts
// pickPasteMachine.ts — sketch

export type PickPasteMode = "idle" | "picking" | "picked" | "pasting";

export type PasteUndoEntry = {
  target_element_id: string;
  prior: { operation: ApertureOperation | null; glazing: GlazingRef | null; frames: ApertureElementFrames };
};

export function nextMode(current: PickPasteMode, action: PickPasteAction): PickPasteMode {
  // pure state transition; tested independently of React.
}
```

```python
# backend/features/project_document/aperture_commands/handlers/paste.py
# — sketch

def apply_paste_assignment(
    body: ProjectDocumentV1,
    command: PasteAssignment,
    actor: str,
    catalog: CatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    apertures = list(body.tables.apertures)
    apt_idx, entry = _locate_aperture(apertures, command.aperture_type_id)
    src = _locate_element(entry.elements, command.source_element_id)[1]
    target_idx, target = _locate_element_by_id(entry.elements, command.target_element_id)

    next_target = target.model_copy(update={
        "operation": src.operation,
        "glazing": src.glazing,
        "frames": src.frames,
    })
    next_elements = list(entry.elements)
    next_elements[target_idx] = next_target
    next_entry = entry.model_copy(update={"elements": next_elements})
    apertures[apt_idx] = next_entry
    next_body = body.model_copy(
        update={"tables": body.tables.model_copy(update={"apertures": apertures})}
    )
    audit = {
        "command": "pasteAssignment",
        "aperture_type_id": command.aperture_type_id,
        "source_element_id": command.source_element_id,
        "target_element_id": command.target_element_id,
        "affects_u_value": True,
    }
    return next_body, audit
```

## P4. Sequence

1. **Commit 1 — Backend merge / split / paste handlers.** Fill
   in the three handlers + their tests.
2. **Commit 2 — Merge validation + split geometry primitives.**
   Add the pure TS helpers with tests. No UI yet.
3. **Commit 3 — Merge / Split toolbar buttons.** Wire the
   toolbar gating + dispatch + Sonner toast.
4. **Commit 4 — Pick / paste state machine.** Add
   `pickPasteMachine.ts`, populate the Zustand store fields,
   wire toolbar buttons.
5. **Commit 5 — Visual feedback.** Add CSS for the pick source
   ring, the paste pulse animation, the cursor changes.
6. **Commit 6 — Bounded undo stack.** Implement push / pop +
   the toolbar undo button + ⌘Z keyboard shortcut.
7. **Commit 7 — Cross-aperture / cross-version clears + tests
   + `make ci` green.**

## P5. Tests

### Unit — merge validation

- Two adjacent 1×1 elements in the same row → `ok` with
  `merged.row_span=[0,0]`, `column_span=[0,1]`.
- Two non-adjacent elements → `ok: false, reason: "non-rectangular"`.
- L-shape selection of three elements → `ok: false`.
- Three elements that form a 1×3 row → `ok` with
  `column_span=[0,2]`.
- One element selected → `ok: false, reason: "fewer than two"`.

### Unit — split geometry

- Element with `row_span=[0,1], column_span=[0,1]` → 4 new
  cells `(0,0), (0,1), (1,0), (1,1)`.
- Element with `row_span=[0,0], column_span=[0,2]` → 3 new
  cells `(0,0), (0,1), (0,2)`.

### Unit — pick/paste state machine

- `nextMode("idle", { type: "click-eyedropper" }) === "picking"`.
- `nextMode("picking", { type: "click-element" }) === "picked"`.
- `nextMode("picked", { type: "esc" }) === "idle"`.
- `nextMode("pasting", { type: "click-element" }) === "pasting"`.
- `nextMode(any non-idle, { type: "click-background" }) === "idle"`.

### Backend — merge / split / paste

- `mergeElements` on a rectangle preserves top-left assignments
  and removes the other source elements.
- `mergeElements` on non-rectangle → 422
  `aperture_merge_not_rectangle`.
- `splitElement` on a 2×2 element → 4 new elements with
  preserved assignments and fresh ids.
- `splitElement` on a 1×1 element → 422
  `aperture_split_not_split-able`.
- `pasteAssignment` copies the 6 fields; `id`, `row_span`,
  `column_span`, `name` on the target are untouched.
- `pasteAssignment` source / target in different aperture types
  → 422.

### Browser

- Shift-click two adjacent elements; click Merge; verify the
  toast `Merged 2 elements; kept assignments from top-left
  ('Sash 1A')`.
- Try merging a non-rectangular selection; verify the
  `Selection isn't a rectangle` toast.
- Select a merged element; click Split; verify 4 (or however
  many) new elements inherit the same frame / glazing colors.
- Click Eyedropper; click an element (ring outline appears);
  click Paint bucket; click two targets; verify both pulse
  briefly and inherit the assignments.
- Press ⌘Z; verify the most recent paste reverts.
- Switch aperture types; verify the undo stack is cleared for
  the previous type.

## P6. Out of scope (lands in later phases)

- U-Value chip values — Phase 09 (the paste does trigger U-Value
  recompute via the `affects_u_value=True` audit signal Phase 09
  reads, but the chip rendering itself lands in Phase 09).
- HBJSON export — Phase 10.
- Manufacturer filters — Phase 11.
- Refresh-from-catalog dialog — Phase 12.

## P7. Risks

- **R-08-1. Eyedropper / paint-bucket disambiguation from
  selection click.** Mitigation: the overlay's element-click
  handler reads `pickPasteMode` from the store first; if
  non-idle, the click drives the machine and the selection
  model is bypassed. Tests cover both code paths.
- **R-08-2. ⌘Z conflicts with browser undo.** Mitigation:
  `usePickPasteShortcut.ts` and `useUndoShortcut.ts` call
  `e.preventDefault()` only when the canvas has focus and the
  shortcut applies. Other inputs (rename dialog, dimension
  edit, pill edit, picker search) keep their native ⌘Z.
- **R-08-3. Bounded undo stack erodes determinism if a paste
  fails partway.** Mitigation: backend writes are atomic
  (single JSON-Patch); the client only pushes to the undo
  stack on a 200 success. On error, the stack is unchanged.
- **R-08-4. Merge inheritance from the top-left can surprise
  the user.** Mitigation: the Sonner toast names the source
  explicitly (`from top-left ('Sash 1A')`) so the user can
  immediately reverse the merge (Split) and re-merge in a
  different order if needed.
- **R-08-5. Split spawns N elements with duplicated
  `catalog_origin.synced_at`.** Mitigation: the handler stamps
  the new elements' `synced_at = now()` so drift detection in
  Phase 12 treats them correctly as distinct copies.
