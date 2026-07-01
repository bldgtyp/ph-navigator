---
DATE: 2026-07-01
TIME: 15:59 EDT
STATUS: Complete and verified.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 3 — bidirectional row ↔ 3D
  segment linking once an element is selected, and the four-tier
  highlight color model this introduces.
RELATED:
  - ../PRD.md §6 (full section — read first), §10 (visual language),
    §12 D-7, §14 acceptance criteria 6-8
  - ../PLAN.md
---

# Phase 3 — Row ↔ 3D focus linking

## 1. Goal

Once an element is selected and its card is open: hovering a segment
in 3D highlights/scrolls its table row into view (transient); clicking
a table row gives that segment the strongest highlight tier in 3D and
expands its detail, and that focus **persists** through camera orbit
away from the table (sticky). This requires a new, precisely-scoped
fourth visual tier on top of what Phase 2 shipped (which rendered
every selected-element segment identically).

## 2. Required reading (in order)

1. `../PRD.md` §6 in full — the interaction design and its reasoning
   (why click not hover for row→segment; why hover and focus almost
   never compete because they describe different segments). §10 in
   full — the exact token-per-tier table this phase implements.
2. `phases/phase-02-element-selection-highlight.md` §3.1-3.4,
   §3.7 — this phase builds directly on `elementIdForSegmentId`,
   `elementsById`, and `ElementInspectorPanel.tsx`'s Phase 2 shape
   (including the local `useState` row-expand tracking this phase
   **replaces**).
3. `frontend/src/features/model_viewer/store.ts` — the whole file.
   Note every place `selectionId`/`hoverId` currently reset:
   `setActiveFileId` (l.66-74), `setLens` (l.75-87), `setUrlViewState`
   (l.88-99), `clearSelection` (l.126-131). `focusedSegmentId` must
   reset in all four.
4. `frontend/src/features/model_viewer/lib/colors.ts` — `ViewerTokens`
   shape, `highlightSoft` resolution (l.43-46, resolved from
   `--highlight-light` via `getComputedStyle`, matching D-14).
5. `scene/BatchedLens.tsx` — read how it consumes `tokens` for
   comparison; `scene/BuildingLens.tsx` `LineObject` (l.121-164)
   currently does **not** receive `tokens` as a prop and hardcodes
   `VIEWER_HIGHLIGHT_FALLBACK` directly — this phase fixes that.
6. `scene/MeasureOverlay.tsx` l.36-97 — the rAF-coalesced
   pointer-move pattern, for context only. **Not needed here**: hover
   in this codebase already fires on discrete pointer-over/pointer-out
   transitions (`handlePointerOver`/`handlePointerOut`,
   `BuildingLens.tsx:192-200`), not continuously per frame, so the
   row-sync effect this phase adds does not need its own rAF
   throttling — read §3.5 below before reaching for one.

## 3. Work breakdown

### 3.1 Store: `focusedSegmentId`

Add to `ModelViewerState`:

```ts
focusedSegmentId: string | null;
toggleFocusedSegment: (segmentId: string) => void;
```

`toggleFocusedSegment` sets `focusedSegmentId` to `segmentId` unless
it's already that value, in which case it clears to `null` — mirrors
the existing `toggleLegendFilterKey`/`toggleMeasure` naming and
single-value-toggle pattern already in this file.

Add `focusedSegmentId: null` to the reset payload in **all four**
places `selectionId`/`hoverId` reset today (§2.3 above) — this state
must never outlive the element selection it belongs to (PRD §6
"Reset").

### 3.2 The four-tier resolver (one pure function, unit-test it directly)

Add to `lib/selection.ts` (next to `elementIdForSegmentId`):

```ts
export type LineHighlightTier = "default" | "hoverElement" | "selectedSoft" | "hoverSegment" | "focused";

export function resolveLineHighlightTier(
  objectId: string,
  selectionId: string | null,
  hoverId: string | null,
  focusedSegmentId: string | null,
): LineHighlightTier {
  const objectElementId = elementIdForSegmentId(objectId);
  const isSelectedElement = objectElementId !== null && objectElementId === selectionId;
  if (objectId === focusedSegmentId) return "focused";
  if (isSelectedElement && objectId === hoverId) return "hoverSegment";
  if (isSelectedElement) return "selectedSoft";
  const hoverElementId = hoverId ? elementIdForSegmentId(hoverId) : null;
  if (hoverElementId !== null && hoverElementId === objectElementId) return "hoverElement";
  return "default";
}
```

This precedence (`focused` > `hoverSegment` > `selectedSoft` >
`hoverElement` > `default`) is what PRD §6 means by "hover and focus
almost never compete" — they're independent per-segment facts, and
this function is where that independence actually gets resolved into
one rendering decision per object. **Unit-test this function directly
and exhaustively** (§6) before wiring it into `LineObject` — it is the
crux of this phase and the cheapest place to catch a tier-precedence
bug.

### 3.3 `LineObject` — thread `tokens`, consume the tier

- `BuildingLens.tsx` already receives `tokens: ViewerTokens` as a prop
  (component signature, l.22-27) but doesn't pass it to the
  `lineObjects.map(...)` block (l.68-77). Add `tokens={tokens}` to
  each `<LineObject>` and add `tokens: ViewerTokens` to
  `LineObject`'s own props.
- Replace the Phase 2 `isSelected`/`isHovered` booleans with one
  `tier = resolveLineHighlightTier(object.id, selectionId, hoverId,
  focusedSegmentId)` call, and map tier → color/width:

  | Tier | Color | Width multiplier (relative to `base`, l.188) |
  |---|---|---|
  | `default` | `lineColor(style, false)` (existing per-style color) | `1` |
  | `hoverElement` | `VIEWER_LINE_HOVER_COLOR` (existing) | `1.45` (existing hover width) |
  | `selectedSoft` | `tokens.highlightSoft` (**new** — this is the wiring PRD §10 calls for) | `1.5` (tune during implementation; must read as more than hover, less than focused) |
  | `hoverSegment` | `VIEWER_LINE_HOVER_COLOR` | `1.45` |
  | `focused` | `tokens.highlight` (was the hardcoded `VIEWER_HIGHLIGHT_FALLBACK` constant — now resolved through `tokens`, matching `BatchedLens`'s pattern) | `1.8` (existing selected width) |

  Keep the `hidden` (legend-filter-dimmed) check as the first branch,
  unchanged — it still short-circuits every tier.
- Remove the now-unused direct `VIEWER_HIGHLIGHT_FALLBACK` import from
  `BuildingLens.tsx` if nothing else in the file still needs it.

### 3.4 `toggleFocusedSegment` at the row click site

In `ElementInspectorPanel.tsx` (Phase 2), **replace** the local
`useState` row-expand tracking with the store field: a row is expanded
iff `focusedSegmentId === segmentId`. Row click calls
`useModelViewerStore.getState().toggleFocusedSegment(segmentId)`
instead of toggling local state. Do not keep both mechanisms — the
local `useState` from Phase 2 is fully superseded here, remove it.

### 3.5 Row ↔ 3D hover sync

In the segment-table sub-component (inside `ElementInspectorPanel.tsx`
or its own file if that's cleaner given the row count):

- **3D → row**: subscribe to `hoverId` from the store; if
  `elementIdForSegmentId(hoverId) === element.id`, find that segment's
  row and (a) apply a "hovered" CSS class, (b) call
  `rowRef.current?.scrollIntoView({ block: "nearest", behavior:
  "smooth" })`. This only needs to run on `hoverId` **changes** (a
  plain `useEffect([hoverId])`, no rAF coalescing needed — see §2.6,
  `hoverId` only changes on discrete pointer transitions, not per
  frame).
- **row → 3D**: each row's `onMouseEnter`/`onFocus` calls
  `useModelViewerStore.getState().setHoverId(segmentId)`;
  `onMouseLeave`/`onBlur` calls `setHoverId(null)`. This is safe
  against the 3D canvas's own hover handlers — the pointer is either
  over the DOM table or over the canvas at any instant, never both, so
  there's no write race between the two hover sources.

### 3.6 Keyboard/Esc

`ModelViewerStage.tsx`'s `Esc` handler (l.97-105) already calls
`clearSelection()` when `selectionId` is set, which (per §3.1) now
also clears `focusedSegmentId` — no change needed there. Double-check
`⌘/Ctrl+C` (l.113-119) still resolves the **element's** identifier,
not a focused segment's — copy-ID stays element-scoped even when a
segment is focused (a segment-specific copy affordance is not in
scope; the per-row "ID" field is already visible in the expanded
detail if the certifier needs the segment's own identifier).

## 4. Fixture guidance

Exercise a multi-segment element from each of the canonical fixture's
categories (a 3-segment duct element, the 4-segment hot-water fixture
run) so the row-count and scroll-into-view behavior is tested against
something with enough rows to matter, not a 1-segment degenerate case.

## 5. Out of scope

Dimension lines (Phase 4). Any change to how elements themselves are
selected/deselected (Phase 2, unchanged here). A "focus the next/
previous segment via keyboard" affordance — not requested, don't add
it.

## 6. Verification gate

1. **Vitest**: `resolveLineHighlightTier` — exhaustive table-driven
   test covering all five tiers, including the "focused segment is
   also hovered → stays `focused`, not `hoverSegment`" case and the
   "hovering a segment of a different, unselected element while
   another element is selected → `hoverElement`, does not touch the
   selected element's segments" case explicitly (this is the one PRD
   §14 crit. 6 calls out by name). `toggleFocusedSegment` toggle
   semantics. Reset-on-teardown for all four store paths (§3.1).
2. **Playwright e2e**: extend `model-viewer-lenses.spec.ts` (or a new
   spec) — select a multi-segment element; hover a non-selected
   segment via the debug hook or simulated pointer event, assert the
   matching row gets the hovered class; click a row, assert it expands
   and the corresponding 3D segment gets the `focused` tier (assert
   via the `window.__phnModelViewer` debug hook — extend it if it
   doesn't already expose per-object tier/color); **simulate a camera
   orbit after the row click** (drag `OrbitControls` or dispatch the
   equivalent pointer events) and assert the focus survives — this is
   the specific behavior (persistence through camera movement) that
   motivated using click instead of hover for this direction, so it
   needs its own explicit assertion, not just "still selected."
3. **Closeout**: `tsc -b`, `pnpm run lint`, `pnpm run check:all`,
   `make format`, `make ci`.
4. Browser walkthrough: select a multi-segment pipe element, hover
   different segments in 3D and confirm row sync, click a row and
   orbit the camera, confirm the focused segment stays visually
   distinct from its siblings.

## 7. Exit criteria

PRD §14 acceptance criteria 3, 6, 7, 8 pass. The four-tier color table
in PRD §10 is fully wired and unit-tested. STATUS.md updated.

## 8. Completion record

Implemented 2026-07-01.

Implemented:

- `focusedSegmentId` and `toggleFocusedSegment` in
  `frontend/src/features/model_viewer/store.ts`, with reset behavior
  on selection, file, lens, URL-lens, and measure-mode teardown paths.
- `resolveLineHighlightTier` in
  `frontend/src/features/model_viewer/lib/selection.ts`.
- Token-aware line highlight colors/widths in
  `frontend/src/features/model_viewer/scene/BuildingLens.tsx`.
- Store-backed row expansion/focus plus row hover sync in
  `frontend/src/features/model_viewer/components/ElementInspectorPanel.tsx`.
- Debug-hook support for browser verification:
  `focusedSegmentId`, `segmentIdsForElement`, `setHoverId`,
  `toggleFocusedSegment`, and `lineHighlightTierForObject`.
- Unit coverage for tier precedence and store reset semantics.
- Chromium e2e coverage for row hover class, sticky row focus,
  focused line tier, and focus persistence through a canvas orbit.

Verification passed:

- `cd frontend && pnpm exec tsc -b --pretty false`
- `cd frontend && pnpm exec vitest run
  src/features/model_viewer/__tests__/viewerElements.test.ts
  src/features/model_viewer/__tests__/viewerFocusStore.test.ts`
- `cd frontend && pnpm run lint` (0 errors, existing 15 warnings)
- `cd frontend && pnpm run check:all`
- `cd frontend && pnpm exec playwright test
  tests/e2e/model-viewer-lenses.spec.ts --project=chromium`

Repo closeout gate passed:

- `make format`
- `make ci`
- `graphify update .`
