---
DATE: 2026-06-05
TIME: 15:45 EDT
STATUS: Active — not yet started
AUTHOR: Codex
SCOPE: Layer a DOM overlay above the Phase 03 SVG substrate that
       owns hit targets, hover rings, the editable on-canvas
       element-name pill, the single / shift / cmd-ctrl + ESC
       selection model, and the no-direct-delete educational
       tooltip. No pickers, no dimension chrome — those land in
       Phases 05 and 06.
RELATED:
  - planning/features/apertures/PRD.md §9.2.1, §9.2.2, §9.2.3, §11
  - planning/features/apertures/PLAN.md (Phase 04 row, R7)
  - planning/archive/assembly-builder/phases/phase-02-overlay-chrome.md
    (precedent: DOM overlay above SVG substrate)
  - frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx
  - frontend/src/features/apertures/aperture-geometry.ts (Phase 03)
---

# Phase 4 — Canvas overlay, on-canvas pill, selection model

## P0. Why this slice

Phase 03 gave the canvas pixels. Phase 04 gives it **interaction
chrome**: a DOM overlay positioned over the SVG with hit targets
and hover rings, the editable on-canvas element-name pill, and the
selection state machine. After this phase the user can click an
element to select it, shift-click / cmd-click to extend, rename
elements inline on the canvas — but cannot yet pick frames or
glazings (Phase 06) and cannot edit dimensions (Phase 05).

Splitting the overlay from the picker wiring keeps the PRs
reviewable. The overlay infrastructure (positioning, hit-target
shape, selection store, escape handling) is non-trivial and is
worth landing on its own.

By the end of Phase 04:

- `<ApertureCanvasOverlay />` mounts above the SVG substrate. It
  positions DOM hit targets over each element + each frame region +
  glazing region using the same mm-coords as the SVG.
- Hover renders ring outlines (element-level, frame-region-level,
  glazing-level) using CSS-token strokes.
- A clickable on-canvas pill renders the element's `name` centered
  on the glazing region; click-to-edit; Enter / blur commit
  through `setElementName`; Escape cancels; empty input reverts.
- Selection state lives in the apertures Zustand store. Single
  click selects / deselects, shift-click extends, cmd/ctrl-click
  toggles, ESC clears. Switching aperture types or versions clears
  selection.
- Delete / Backspace with elements selected shows the once-per-
  session educational tooltip pointing the user at Merge / row-col
  delete.
- Locked versions / Viewer access: hover rings still render; pill
  is read-only; selection still works (it's a viewing aid); the
  Delete tooltip is suppressed (no edit affordances exist anyway).

Phase 04 does **not** ship: per-region click-to-pick (Phase 06),
dimension strips (Phase 05), operation symbols (Phase 07), merge /
split / copy-paste (Phase 08), card sync with the pill — pill ↔
card sync is one-way (pill writes; cards read from the document
on next render), bidirectional sync lands when cards exist in
Phase 06.

## P1. Acceptance — Phase 4 done when

1. `<ApertureCanvasOverlay />` renders in a DOM layer absolutely
   positioned over the SVG canvas, with the same outer width and
   height (mm × `BASE_PX_PER_MM` × zoom). Both layers scroll
   together inside a shared scroll wrapper.
2. Per element, the overlay renders a single
   `<div className="aperture-hit aperture-hit--element"
   data-testid="hit-element-{id}" />` covering the element's pixel
   rect. The element hit owns the element-level hover ring and the
   selection click.
3. Per region (top / right / bottom / left / glazing), the overlay
   renders a nested
   `<div className="aperture-hit aperture-hit--region"
   data-region="top|right|bottom|left|glazing"
   data-testid="hit-{element_id}-{region}" />`. Region hits sit
   above the element hit and propagate to the picker handler in
   Phase 06 (Phase 04 stubs the picker handler — clicking a region
   only triggers a hover ring and the selection state).
4. **Hover behavior:**
   - Mouse over an element rect (and not over a region rect): the
     element hit renders a 2 px CSS-token outline ring
     (`--aperture-hover-ring`). The cursor is `pointer`.
   - Mouse over a region rect: that region hit renders a 2 px
     stronger ring (`--aperture-hover-ring-strong`). Element ring
     stays.
   - Leaving the canvas clears all hover state.
5. **Selection model** (per PRD §9.2.2):
   - State lives in `useApertureBuilderStore` (Zustand):
     `selectedElementIds: string[]` keyed per active aperture
     type. Switching aperture types or document versions clears
     `selectedElementIds`.
   - Click an element rect → single-select. Click the same
     element again → deselect.
   - Shift-click an element → extend the selection by appending
     that element's id (idempotent — already-selected elements
     stay). No adjacency rule on the click itself; merge in
     Phase 08 validates the contiguous-rectangle invariant at
     commit time and toasts on failure.
   - Cmd-click / Ctrl-click → toggle that element in/out of the
     selection.
   - Pressing `Escape` clears `selectedElementIds`.
   - A canvas-level `Clear selection` button (in the toolbar)
     mirrors `Escape`.
   - Click on the canvas background (not on any element hit)
     clears selection.
6. **Selected styling.** Selected elements render a persistent
   ring outline `--aperture-selected-ring` (distinct from hover).
   The element's hit `<div>` gets `data-selected="true"` for CSS
   targeting and `aria-selected="true"` for screen readers.
7. **On-canvas name pill:**
   - Per element, a `<div className="aperture-name-pill"
     data-testid="pill-{element_id}">` renders centered on the
     glazing region.
   - Pill text = `element.name`. Pill height ≈ 24 px; pill width
     auto with a small horizontal padding.
   - Click on the pill (mousedown not click — to prevent the
     element selection from firing too) flips it into an
     editable `<input>` with `autoFocus` + full-select.
   - Pressing Enter commits via `applyApertureCommand` with
     `setElementName`. Pressing Escape cancels and restores the
     prior value. Blur commits (matches the rename flow's commit
     semantics). Empty / whitespace-only input reverts silently.
   - Pill renders read-only on locked versions / Viewer access
     (no click-to-edit).
8. **No-direct-delete educational tooltip:**
   - When `Delete` or `Backspace` fires while the canvas has
     focus and `selectedElementIds.length > 0`, a Sonner toast
     fires once with id `aperture-no-direct-delete`:
     `To remove an element, merge it into a neighbor (Toolbar →
     Merge) or delete its row / column (hover the dimension
     label, click −).`
   - The toast id ensures only one shows at a time per session.
9. **Pill positioning under interior view:** the pill position
   uses the rendered (post-flip) glazing rect from
   `elementRegionsMm`, so the pill stays visually centered on
   the rendered element regardless of view direction.
10. **Pill ↔ document sync:** after a commit, the pill re-renders
    from the active document on the next React tick. There is no
    optimistic update beyond the local input state during edit.
11. Overlay layer is **pointer-event-aware**: when the user is
    holding the eyedropper / paint-bucket modes (Phase 08), the
    overlay defers clicks. Phase 04 ships the hooks but only
    Phase 08 sets the modes; Phase 04 just guards against the
    code path firing twice.
12. `make ci` is green; new tests (geometry + selection store +
    pill behavior + overlay rendering) pass.

## P2. Files

### New

- `frontend/src/features/apertures/components/ApertureCanvasOverlay.tsx`
- `frontend/src/features/apertures/components/ApertureNamePill.tsx`
- `frontend/src/features/apertures/components/ApertureHitTarget.tsx`
  (the per-element + per-region hit primitive)
- `frontend/src/features/apertures/store/builder-store.ts`
  (Zustand store: selection, hover, pending pick/paste mode hooks)
- `frontend/src/features/apertures/hooks/useApertureBuilderStore.ts`
- `frontend/src/features/apertures/__tests__/builder-store.test.ts`
- `frontend/src/features/apertures/__tests__/ApertureCanvasOverlay.test.tsx`
- `frontend/src/features/apertures/__tests__/ApertureNamePill.test.tsx`

### Modified

- `frontend/src/features/apertures/components/ApertureCanvasContainer.tsx`
  - Add the overlay layer above the SVG substrate inside a
    shared scroll wrapper.
  - Add a global `keydown` listener that clears selection on
    `Escape` and surfaces the no-direct-delete toast on
    `Delete` / `Backspace` while focus is inside the canvas.
- `frontend/src/features/apertures/components/ApertureCanvasToolbar.tsx`
  - Add `Clear selection` button (enabled only when
    `selectedElementIds.length > 0`; hidden on locked / Viewer).
- `frontend/src/features/apertures/apertures.css`
  - Add overlay positioning rules, hover-ring tokens, selected-
    ring tokens, pill base + editing styles.
- `frontend/src/features/apertures/components/ApertureSvgCanvas.tsx`
  - Add `pointer-events: none` to the `<svg>` element so all
    clicks land on the overlay layer above.
  - Keep `role="img"` and `aria-label` — the overlay sits
    above for clicks, but screen readers still find the SVG.

### Deleted

None.

## P3. Component shapes

```ts
// builder-store.ts — sketch

type ApertureBuilderState = {
  selectionByAperture: Record<string, string[]>;  // aperture_type_id → element_ids
  hoveredElementId: string | null;
  hoveredRegion: {
    elementId: string;
    region: "top" | "right" | "bottom" | "left" | "glazing";
  } | null;
  pickPasteMode: "idle" | "picking" | "picked" | "pasting";  // wired in Phase 08
  pickedAssignment: null | { /* phase 08 */ };

  selectSingle(apertureId: string, elementId: string): void;
  extendSelection(apertureId: string, elementId: string): void;
  toggleSelection(apertureId: string, elementId: string): void;
  clearSelection(apertureId: string): void;
  clearAllSelectionsForVersion(): void;
  setHoveredElement(elementId: string | null): void;
  setHoveredRegion(value: ApertureBuilderState["hoveredRegion"]): void;
};

export const useApertureBuilderStore = createStore<ApertureBuilderState>(...);
```

```tsx
// ApertureCanvasOverlay.tsx — sketch (parallel to AssemblyCanvasOverlay.tsx)

export function ApertureCanvasOverlay(props: Props) {
  const { aperture, zoom, viewDirection, canEdit } = props;
  const renderedAperture = useMemo(
    () => applyViewDirection(aperture, viewDirection),
    [aperture, viewDirection],
  );
  const selected = useApertureBuilderStore(
    (s) => s.selectionByAperture[aperture.id] ?? [],
  );
  const hoveredEl = useApertureBuilderStore((s) => s.hoveredElementId);
  const hoveredRegion = useApertureBuilderStore((s) => s.hoveredRegion);
  const { selectSingle, extendSelection, toggleSelection, clearSelection,
          setHoveredElement, setHoveredRegion } =
    useApertureBuilderStore();

  const onElementClick = (el: ApertureElement, e: React.MouseEvent) => {
    if (e.shiftKey) extendSelection(aperture.id, el.id);
    else if (e.metaKey || e.ctrlKey) toggleSelection(aperture.id, el.id);
    else selectSingle(aperture.id, el.id);
  };

  return (
    <div className="aperture-canvas-overlay" style={{ width: pxW, height: pxH }}>
      {renderedAperture.elements.map((el) => {
        const rect = elementRectMm(renderedAperture, el);
        const regions = elementRegionsMm(el, rect);
        return (
          <div
            key={el.id}
            className="aperture-hit aperture-hit--element"
            data-testid={`hit-element-${el.id}`}
            data-selected={selected.includes(el.id) ? "true" : "false"}
            data-hovered={hoveredEl === el.id ? "true" : undefined}
            style={pixelRectStyle(rect, zoom)}
            onClick={(e) => onElementClick(el, e)}
            onMouseEnter={() => setHoveredElement(el.id)}
            onMouseLeave={() => setHoveredElement(null)}
          >
            {(["top", "right", "bottom", "left", "glazing"] as const).map(
              (region) => (
                <ApertureHitTarget
                  key={region}
                  region={region}
                  element={el}
                  rect={regions[region]}
                  parentRect={rect}
                  zoom={zoom}
                  onClick={() => onRegionClick?.(el, region)}  // Phase 06 wires
                  onMouseEnter={() => setHoveredRegion({ elementId: el.id, region })}
                  onMouseLeave={() => setHoveredRegion(null)}
                />
              ),
            )}
            <ApertureNamePill
              element={el}
              glazingRect={regions.glazing}
              parentRect={rect}
              zoom={zoom}
              canEdit={canEdit}
            />
          </div>
        );
      })}
    </div>
  );
}
```

```tsx
// ApertureNamePill.tsx — sketch

export function ApertureNamePill(props: PillProps) {
  const { element, glazingRect, parentRect, zoom, canEdit } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(element.name);
  const { projectId, versionId } = useDocumentRoute();
  const { apertureTypeId } = useActiveAperture();

  const offset = pillOffsetStyle(glazingRect, parentRect, zoom);

  if (!editing) {
    return (
      <div
        className="aperture-name-pill"
        data-testid={`pill-${element.id}`}
        style={offset}
        onMouseDown={(e) => {
          if (!canEdit) return;
          e.stopPropagation();
          setDraft(element.name);
          setEditing(true);
        }}
      >
        {element.name}
      </div>
    );
  }
  return (
    <input
      className="aperture-name-pill aperture-name-pill--editing"
      style={offset}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") cancel();
      }}
      onBlur={commit}
    />
  );

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === element.name) {
      cancel();
      return;
    }
    applyApertureCommand(projectId, versionId, {
      kind: "setElementName",
      aperture_type_id: apertureTypeId,
      element_id: element.id,
      new_name: trimmed,
    });
    setEditing(false);
  }

  function cancel() {
    setDraft(element.name);
    setEditing(false);
  }
}
```

## P4. Sequence

1. **Commit 1 — Zustand store.** Add `builder-store.ts` with
   selection, hover, and stub pick/paste fields. Tests in
   `builder-store.test.ts` verify each action's shape.
2. **Commit 2 — Overlay shell + hit-target primitives.** Add
   `ApertureCanvasOverlay` and `ApertureHitTarget`. Positioning
   verified visually against the SVG. No selection wiring yet —
   hover only.
3. **Commit 3 — Selection wiring.** Connect element click,
   shift / cmd / ctrl modifiers, Escape handling, background
   click, Clear-selection button. Tests in
   `ApertureCanvasOverlay.test.tsx`.
4. **Commit 4 — On-canvas name pill.** Add `ApertureNamePill`,
   wire `setElementName`. Tests in `ApertureNamePill.test.tsx`.
5. **Commit 5 — No-direct-delete tooltip + locked/viewer
   states.** Add keydown listener for Delete / Backspace,
   wire Sonner toast with stable id. Verify locked / Viewer
   render correctly.
6. **Commit 6 — CSS polish + pointer-event isolation on the
   SVG.** Tune ring tokens, pill styles, ensure SVG has
   `pointer-events: none` so all clicks land on overlay.

## P5. Tests

### Unit — store

- `selectSingle` replaces the selection for the given aperture.
- `extendSelection` appends; idempotent.
- `toggleSelection` removes if present, adds if absent.
- `clearSelection` for one aperture leaves other apertures'
  selections intact.
- Hover setters update independently of selection.

### Component — overlay

- Renders one hit per element + 5 hits per element for regions.
- Shift-click extends; cmd-click toggles; bare click sets single.
- Escape clears selection.
- Click on the overlay background (outside any element hit)
  clears selection.
- Selected element renders `data-selected="true"` and the
  selected-ring CSS class.
- Interior view: hits are positioned at the rendered (post-flip)
  positions; selecting a visible right-side element still keys
  off the canonical element id.

### Component — pill

- Renders the element name centered on the glazing region.
- Clicking the pill flips to input mode; autoFocus is set.
- Enter commits via `setElementName`; backend mock is called
  with the trimmed name.
- Escape reverts; pill re-renders with prior name.
- Empty / whitespace input on Enter or Blur reverts silently.
- On locked / Viewer, pill is read-only — click does nothing.

### Component — keyboard

- With one element selected, Delete fires the
  `aperture-no-direct-delete` toast exactly once.
- With no elements selected, Delete is a no-op (no toast).

### Browser

- Create a 2×2 aperture; click an element, verify ring outline.
- Shift-click another element, verify two rings.
- Cmd-click one of the selected; verify it deselects while the
  other stays.
- Press Escape, verify all rings clear.
- Click an element's pill, type a new name, press Enter; verify
  the name persists after a refresh.
- Toggle view direction; pill stays centered on the rendered
  glazing.

## P6. Out of scope (lands in later phases)

- Region click → open picker — Phase 06 (the overlay surface
  fires `onRegionClick`; Phase 06 attaches the handler).
- Dimension strips, edge-hover add, total-dim caption — Phase 05.
- Operation symbols (dashed hinge lines, slide arrows) — Phase 07.
- Merge / split / copy-paste — Phase 08.
- U-Value chip values — Phase 09.

## P7. Risks

- **R-04-1. Overlay and SVG must stay positionally in sync.** Any
  scroll or zoom desync looks broken. Mitigation: both layers
  share the same outer scroll wrapper and the same
  `pxFromMm(mm, zoom)` math. A regression test in
  `ApertureCanvasOverlay.test.tsx` asserts that the first
  element's hit `left/top` equals the first SVG `<rect>`'s
  position to within 1 px.
- **R-04-2. Pill mousedown vs element click race.** Without
  `e.stopPropagation()` on the pill, clicking the pill also
  selects the element underneath. Mitigation: pill explicitly
  stops propagation on mousedown; element click handler ignores
  events whose `target` matches `[data-pill="true"]`.
- **R-04-3. Cmd-click on macOS opens the browser context menu.**
  Mitigation: bind on `mousedown` and call `preventDefault()`
  when `e.metaKey` is true; if this proves brittle across
  browsers, fall back to a small "Modifier-click" affordance in
  the toolbar.
- **R-04-4. Sonner toast spam on repeated Delete.** Mitigation:
  use a stable `toast.id` so repeated presses dedupe.
- **R-04-5. Selection state lives in Zustand, not the document.**
  This is by design (selection is ephemeral) but could surprise
  someone diffing draft bodies. Mitigation: documented in the
  store module's header comment; `selectionByAperture` clears
  on version switch via a project-document hook.
