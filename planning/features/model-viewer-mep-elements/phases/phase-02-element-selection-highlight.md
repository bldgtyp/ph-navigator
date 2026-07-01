---
DATE: 2026-07-01
TIME: -
STATUS: Not started. Depends on Phase 1 landing first (needs
  `length` on the wire).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 2 — element-level click/hover
  selection, highlight, camera zoom-to, copy-ID, and the base Element
  inspector card (total length + ordered segment table with
  click-to-expand detail). No row↔3D focus linking yet (Phase 3).
RELATED:
  - ../PRD.md §4, §5 (base card), §8, §10 (read the "Sequencing note"
    at the end of §10 — Phase 2 deliberately skips the soft/full split)
  - ../PRD.md §12 D-1, D-2, D-3, D-4
  - ../PLAN.md
---

# Phase 2 — Element-level selection, highlight, camera, base inspector card

## 1. Goal

Clicking any duct or pipe segment selects and highlights the whole
parent Element (every segment lights up together); hovering does the
same as a lighter preview before anything is clicked; "Zoom to" and
copy-ID operate on the whole element; the inspector shows a new
two-tier card — Total Length up top, an ordered segment table below,
each row expandable to the full detail the old single-segment
inspector used to show inline. This is a complete, coherent, shippable
slice on its own — Phase 3's row↔3D focus linking is additive polish
on top, not a prerequisite for this phase to make sense.

**Explicitly deferred to Phase 3** (do not build here): the soft/full
four-tier color split (PRD §10), `focusedSegmentId`, hover-syncs-row /
click-syncs-segment. In this phase, "selected element" renders **every**
segment at exactly today's existing single-segment full-highlight
treatment (`VIEWER_HIGHLIGHT_FALLBACK`) — just applied to N segments
instead of 1. That is intentional, not a shortcut to fix later.

## 2. Required reading (in order)

1. `../PRD.md` §4, §5, §8, and the §10 "Sequencing note" — in full.
2. `frontend/src/features/model_viewer/loaders/building.ts` — read
   the whole file. Key facts already verified for this phase:
   - `BuildingModel` (l.68-75) has `metaById: Map<string,
     ModelObjectMeta>`, one entry per renderable (built once,
     `buildBuildingModel`, l.77+).
   - `ductRenderables`/`addDuctElements` (l.251-294) and
     `pipeRenderables`/`addPipeElement` (l.296-379) build one
     `LineRenderable` per **segment**; the renderable `id` is
     `duct:${element.identifier}:${segmentKey}` /
     `pipe:${pipeKind}:${element.identifier}:${segmentKey}`.
3. `frontend/src/features/model_viewer/store.ts` — `selectionId`,
   `hoverId`, `setSelectionId`, `setHoverId`, `clearSelection`,
   `requestCamera` (all unchanged in shape this phase — only how
   callers resolve the id they pass in changes).
4. `frontend/src/features/model_viewer/scene/BuildingLens.tsx` — the
   whole file, especially `LineObject` (l.121-164), `selectObject`
   (l.202-211), `zoomToObject` (l.213-218).
5. `frontend/src/features/model_viewer/scene/CameraRig.tsx` — the
   whole file, especially the `zoomTo` branch (l.23-32) and
   `fitCameraToBounds` (l.52-79).
6. `frontend/src/features/model_viewer/components/ModelViewerStage.tsx`
   — the whole file (223 lines). Key integration points:
   `selectedMeta` (l.155), `<InspectorPanel meta={selectedMeta} />`
   (l.198), the `⌘/Ctrl+C` copy-ID handler (l.113-119), the `Esc`
   handler (l.97-105, needs no change this phase — `clearSelection()`
   already works regardless of what `selectionId` held).
7. `frontend/src/features/model_viewer/components/InspectorPanel.tsx`
   — the whole file (80 lines) — the rendering pattern (header, copy-ID,
   zoom-to, sectioned field rows) this phase's new component reuses.
8. `frontend/src/features/model_viewer/lib/fieldConfigs.ts` — the
   whole file. `inspectorConfigs.pipeSegmentLine` /
   `ductSegmentLine` (l.129-216) become the per-row expanded-detail
   config; `formatMetersAsLength` (l.364-367) is currently
   module-private — export it, this phase needs it directly.
9. `frontend/src/features/model_viewer/types.ts` l.309-388
   (`ModelObjectType`, `ModelObjectMeta` union, `DuctSegmentLineMeta`,
   `PipeSegmentLineMeta`) — Phase 1 should already have added `length`
   to the underlying `*ModelData` types; this phase adds a new
   `ElementSummary` type, described below.

## 3. Work breakdown

### 3.1 A robust, string-only element-id derivation (no new lookup map)

Add to `frontend/src/features/model_viewer/lib/selection.ts`:

```ts
/** Recovers the parent-element renderable-id family from a duct/pipe
 *  segment's renderable id by dropping the trailing `:<segmentKey>`
 *  and prefixing `element:` — e.g. `duct:X:seg1` -> `element:duct:X`,
 *  `pipe:distribution:X:seg1` -> `element:pipe:distribution:X`. Works
 *  for any id built by `addDuctElements`/`addPipeElement` regardless
 *  of characters inside `identifier`, as long as `segmentKey` itself
 *  contains no `:` (true today — segment dict keys are HBJSON GUIDs).
 *  Returns null for ids that aren't duct/pipe segment ids (faces,
 *  spaces, floor segments) so callers can use it as a type guard. */
export function elementIdForSegmentId(segmentId: string): string | null {
  if (!segmentId.startsWith("duct:") && !segmentId.startsWith("pipe:")) return null;
  const lastColon = segmentId.lastIndexOf(":");
  if (lastColon <= 0) return null;
  return `element:${segmentId.slice(0, lastColon)}`;
}
```

This is the one piece of logic every other change in this phase
depends on — get its unit tests right first (§6).

### 3.2 Loader: `elementsById`

Add to `loaders/building.ts`:

```ts
export type ElementSummary = {
  id: string; // "element:duct:<identifier>" | "element:pipe:<pipeKind>:<identifier>"
  kind: "ductElement" | "pipeElement";
  identifier: string;
  display_name: string;
  length: number; // from Phase 1's wire field — do not re-sum client-side
  segmentIds: string[]; // ordered, insertion order from the source dict (PRD §13.1 caveat)
  ductType?: 1 | 2 | number;
  pipeKind?: "distribution" | "recirc";
};
```

Change `ductRenderables`/`addDuctElements` and
`pipeRenderables`/`addPipeElement` to also accumulate one
`ElementSummary` per element (not per segment) — simplest shape:
change their return type from `LineRenderable[]` to
`{ lines: LineRenderable[]; elements: ElementSummary[] }`, updating
the two call sites in `buildBuildingModel`. Add
`elementsById: Map<string, ElementSummary>` to `BuildingModel`
(alongside `metaById`), populated from both `ductRenderables` and
`pipeRenderables`'s `elements` output. `segmentIds` is exactly the
list of `LineRenderable.id`s produced for that element, in the same
order `Object.entries(element.segments)` yields them today — no new
ordering logic, just capture what already exists.

`disposeBuildingModel` needs no change — `ElementSummary` holds no
GPU resources.

### 3.3 Selection resolution at the two click sites

In `scene/BuildingLens.tsx`:

- `selectObject` (l.202-211): resolve
  `const elementId = elementIdForSegmentId(objectId) ?? objectId;`
  before `useModelViewerStore.getState().setSelectionId(elementId)`.
  (The `?? objectId` fallback is defensive — `LineObject` only ever
  renders duct/pipe segments, so `elementIdForSegmentId` should always
  resolve here; keep the fallback so this function stays safe if ever
  reused for a non-line object.)
- `zoomToObject` (l.213-218): same resolution before both
  `setSelectionId` and `requestCamera("zoomTo", elementId)`.

### 3.4 `LineObject` reads element-scoped selection/hover

In `LineObject` (l.121-164):

- `isSelected` becomes:
  `elementIdForSegmentId(object.id) === useModelViewerStore((s) => s.selectionId)`
  (was: `state.selectionId === object.id`).
- `isHovered` becomes: "the currently hovered id belongs to the same
  element as me" —
  `const hoverElementId = elementIdForSegmentId(hoverId); const isHovered = hoverElementId !== null && hoverElementId === elementIdForSegmentId(object.id);`
  (was: `state.hoverId === object.id`). **Do not promote `hoverId`
  itself to store an element id** — it must keep holding the literal
  segment id the pointer is over; Phase 3's row↔hover sync needs that
  specific segment id, not just "which element."
- The rest of `LineObject`'s color/width logic (l.141-148, l.183-190)
  is unchanged this phase — `isSelected`/`isHovered` now mean
  "part of the selected/hovered element," but the treatment they
  trigger is exactly what it is today. Do not add a third tier here
  (Phase 3).

### 3.5 `CameraRig.tsx` zoomTo union-bounds

In the `zoomTo` branch (l.23-32), before falling back to the existing
single-object `model.metaById.get(targetId)` path, try the element
path first:

```ts
const elementTarget = cameraRequest.targetId
  ? model.elementsById.get(cameraRequest.targetId)
  : null;
const target = elementTarget ? null : ... // existing metaById lookup, unchanged
const bounds = elementTarget
  ? boundsForPoints(
      elementTarget.segmentIds.flatMap((id) => model.metaById.get(id)?.vertices ?? []),
    )
  : target
    ? boundsForPoints(target.vertices)
    : model.bounds;
```

`boundsForPoints` (`loaders/bounds.ts`) already accepts a flat vertex
array — no change needed there.

### 3.6 `ModelViewerStage.tsx` integration

- Add `const selectedElement = selectionId ? (model?.elementsById.get(selectionId) ?? null) : null;`
  alongside the existing `selectedMeta` (l.155). Only one of
  `selectedMeta` / `selectedElement` is ever non-null at a time (the
  two id namespaces don't collide by construction, §3.1).
- Render the new `<ElementInspectorPanel element={selectedElement}
  model={model} />` as a sibling of `<InspectorPanel meta={selectedMeta}
  />` (l.198) — both can sit in the tree unconditionally; each
  internally returns `null` when its own prop is `null`.
- Copy-ID handler (l.113-119): resolve the identifier from either map:
  `const identifier = selectionId ? (model?.metaById.get(selectionId)?.identifier ?? model?.elementsById.get(selectionId)?.identifier ?? null) : null;`
  then copy that (was: `model?.metaById.get(selectionId)?.identifier`
  only).
- `Esc` handler (l.97-105): no change needed — `clearSelection()`
  already resets `selectionId` to `null` regardless of what it held.

### 3.7 New component: `ElementInspectorPanel.tsx`

New file, `frontend/src/features/model_viewer/components/ElementInspectorPanel.tsx`.
Structure per PRD §5's mockup, reusing `InspectorPanel.tsx`'s existing
patterns rather than inventing new ones:

- **Extract a shared field-row renderer.** `InspectorPanel.tsx`
  (l.65-77) already has the "sections → fields → `dt`/`dd` rows"
  render loop. Pull it into a small shared component (e.g.
  `FieldRows({ config, meta, unitSystem })`) both `InspectorPanel` and
  the new per-row accordion detail can use — do not duplicate this
  rendering logic.
- Header: `element.kind === "ductElement" ? "Duct Element" : "Pipe
  Element"`, `element.display_name`, copy-ID button (copies
  `element.identifier`), close button (`clearSelection`).
- **Total Length** block: `formatMetersAsLength(element.length,
  unitSystem)` (now exported from `fieldConfigs.ts`, §2.8) — large
  type, first thing under the header. Secondary line: segment count
  (`element.segmentIds.length`) and, optionally, a typical-diameter
  hint (read straight from the first segment's meta — this is a
  display convenience, not a calculation; if segments have visibly
  different diameters, either show a range or omit rather than
  inventing an "average" client-side).
- **Segment table**: iterate `element.segmentIds`, look up
  `model.metaById.get(segmentId)` per row (already-existing per-segment
  meta — no new backend data needed for the table body). Columns:
  ordinal (1-based index into `segmentIds`), Length
  (`formatMetersAsLength` for ducts, `formatLengthFromMm` for pipes —
  match each lens's existing per-type formatter from
  `fieldConfigs.ts`), Diameter, and Material (pipes only). **Not** the
  shared `<DataTable>` (PRD D-4) — a small bespoke table, styled on
  the existing `.model-inspector-*` CSS classes in `model_viewer.css`.
  New CSS classes for the table go in the same file, same naming
  family (e.g. `.model-inspector-segment-table`).
- **Row click → expand**: clicking a row renders `configForMeta(meta)`
  (`lib/fieldConfigs.ts`) via the shared `FieldRows` component inline
  below that row (accordion), reusing the exact field list the old
  single-segment inspector used to show for `pipeSegmentLine`/
  `ductSegmentLine`. Plain local component state this phase (`useState`
  for which row is expanded) — Phase 3 replaces this with the sticky
  `focusedSegmentId` store field and syncs it to 3D; **do not build
  the 3D-hover-to-row or 3D-highlight-on-focus behavior in this
  phase**, only the expand/collapse interaction itself.
- **Zoom to element** button: `requestCamera("zoomTo", element.id)`.

## 4. Fixture guidance

Use both fixtures. Exercise all four pipe-element "roles" on the
canonical fixture's full 4-level hot-water tree (trunk, branch,
fixture, recirc) — the PRD's acceptance criteria explicitly call out
"whichever it belongs to" (§14 crit. 2); a test that only selects the
trunk misses branch/fixture/recirc regressions. Use Hillandale (48
duct elements, 10 HW trunks) for a multi-element, varied-segment-count
smoke pass — not exhaustive per-element assertions there, just enough
to prove grouping scales.

## 5. Out of scope

Row↔3D focus linking, the soft/full color split, `tokens` threading
into `LineObject` (all Phase 3). Dimension lines (Phase 4). Any change
to Building/Spaces/Floor Areas/Site & Sun lenses.

## 6. Verification gate

1. **Vitest**: `elementIdForSegmentId` unit tests (both duct and pipe
   id shapes, non-duct/pipe ids return `null`, an identifier
   containing a colon doesn't break it); `elementsById` construction
   (given a fixture-shaped `CombinedModelData`, assert the right
   number of elements, right `segmentIds` per element, right
   `length`); the updated `isSelected`/`isHovered` resolution logic in
   isolation if practical to extract as a pure function.
2. **Playwright e2e**: update `model-viewer-lenses.spec.ts`'s existing
   duct/pipe selection assertions (currently written against
   single-segment inspector behavior) to assert clicking any segment
   highlights every segment of its element; assert this for a duct
   element, and for pipe elements at each of trunk/branch/fixture/
   recirc; assert the new card shows Total Length and the right
   segment count; assert "Zoom to" and copy-ID operate on the element.
3. **Closeout**: `cd frontend && pnpm exec tsc -b --pretty false`;
   `pnpm run lint`; `pnpm run check:all`; `make format`; `make ci`
   (first phase in this feature where `make ci` is required, per
   PLAN.md — this is the first user-visible behavior change).
4. Browser walkthrough on `localhost:5173` as `codex@example.com`:
   select a duct element and a hot-water trunk/branch/fixture/recirc
   element each, confirm the whole run highlights, confirm the card
   content, confirm zoom-to and copy-ID.

## 7. Exit criteria

PRD §14 acceptance criteria 1, 2, 4, 5, 9 (element-level select/
highlight, hover-preview before selection, Total Length + segment
table visible, zoom-to/copy-ID on the element) pass. Criteria 3, 6, 7,
8 (hover/focus linking specifics) are Phase 3's, not blocking this
phase's exit. STATUS.md updated with implementation notes and the
verification evidence above.
