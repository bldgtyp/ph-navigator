---
DATE: 2026-06-13
TIME: -
STATUS: Implemented — single-select isolate (tests green; unmerged).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — single-select legend isolation.
RELATED:
  - ../PRD.md
  - ../PLAN.md
---

# Phase 1 — Single-select isolate

Self-contained frontend handoff. Delivers the core "click a legend row
to isolate matching geometry; clear to restore" behavior.

## 1. Required reading

- `../PRD.md` (esp. §2 edge cases, §4 state, §5 isolate-with-wireframe).
- Current code (read before writing — match patterns):
  - `frontend/src/features/model_viewer/lib/themes.ts` —
    `colorForThemedObject`, `legendForModel`, `lineStyleDefinition`.
  - `frontend/src/features/model_viewer/scene/BatchedLens.tsx` +
    `scene/LensBatch.ts` — the batched substrate for mesh lenses;
    `useBatchColors` is the per-instance subscriber the visibility gate
    mirrors, `batch.batchForId` maps object id → its instances, and
    `batch.edges` is the single merged edge line to keep + recolor.
  - `frontend/src/features/model_viewer/scene/BuildingLens.tsx` —
    `LineObject`, the per-object `<Line>` path kept for the line lenses
    (ventilation/hot-water).
  - `frontend/src/features/model_viewer/components/LegendCard.tsx` —
    `LegendRows` (inert buttons today).
  - `frontend/src/features/model_viewer/store.ts` — per-lens theme
    (`themesByLens`) + reset paths in `setLens` / `setTheme` /
    `setUrlViewState` / `setActiveFileId`.
  - `frontend/src/features/model_viewer/components/ModelViewerStage.tsx`
    — the `onKeyDown` Escape cascade (measure → selection → popovers);
    `lib/events.ts` is only the popover-escape pub/sub it dispatches into.

## 2. Work

### 2.1 Bucket-key helper (`lib/themes.ts` or a new `lib/legendFilter.ts`)

```ts
export function bucketKeyForObject(
  object: ModelRenderable,
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
): string | null {
  if (object.kind === "line") return object.lineStyle;          // mini-key lenses
  return colorForThemedObject(object.meta, lens, theme)?.key ?? null;
}
```

This is the single source of truth shared by the legend (which already
groups by `color.key`) and the visibility gate. Mini-key rows use
`lineStyle` as their `id` (see `lineStyleLegendRows`), so the keys line
up with legend row ids without translation.

### 2.2 Store (`store.ts`)

- Add `legendFilter: { theme: ModelViewerTheme; keys: Set<string> } |
  null`. Stamp `theme` with the active lens's theme (`themesByLens[lens]`)
  so a stale filter is ignored after a theme switch.
- Actions: `toggleLegendFilterKey(theme, key)` (single-select: replace
  set with `{key}`, or clear if the same single key is re-clicked) and
  `clearLegendFilter()`.
- Reset `legendFilter` to `null` inside `setLens`, `setTheme`,
  `setUrlViewState` (lens/theme change branch), and `setActiveFileId`.
- When a new filter hides the current selection's faces (it's outside the
  set), clear selection/hover in the setter (predictable; a wireframe
  ghost is not the inspected object).

### 2.3 Isolation: hide faces, keep wireframe

One shared predicate `isHiddenByFilter(object, lens, theme, legendFilter)`
— true when a filter is active, its `theme` matches the active lens's
theme (stale-filter guard, else false), and the object's
`bucketKeyForObject` is **not** in the active set. Null filter → nothing
hidden.

- **Mesh lenses (batched — `scene/BatchedLens.tsx`).** Drive
  `BatchedMesh.setVisibleAt(instanceId, visible)` off `legendFilter`,
  mirroring the `useBatchColors` subscriber: walk `batch.batchForId`, and
  for each object's `BatchLocation`s set `visible = !isHiddenByFilter(...)`.
  Hidden instances are skipped by the renderer *and* the raycaster, so
  picking is gated for free. Keep `batch.edges` drawn and recolor its
  `LineBasicMaterial` to a lighter gray while a filter is active (restore
  `VIEWER_FACE_EDGE_COLOR` on clear) — this is the wireframe context.
  `invalidate()` after the writes (demand loop).
- **Line lenses (per-object — `scene/BuildingLens.tsx`).** In `LineObject`,
  recolor to the faint gray and set `raycast={() => null}` when
  `isHiddenByFilter` is true (no faces/edges to keep here — the faint line
  is the context).
- The `SiteSunLayer` branch is exempt (no legend / no filter).
- Restore on clear/reset: set every instance visible again and reset the
  edge color; the existing fade-in/dispose paths are unaffected (the batch
  is rebuilt on lens/file change, which already clears the filter).

### 2.4 Legend rows (`components/LegendCard.tsx`)

- `LegendRows`: drop `aria-disabled`/`tabIndex={-1}`; wire `onClick` →
  `toggleLegendFilterKey(theme, row.id)`. Reflect active state via
  `aria-pressed` + a class.
- Add a "Clear filter" control in `model-legend-titlebar`, rendered
  only when `legendFilter` is active. Wire to `clearLegendFilter()`.
- Counts (`row.count`) stay model totals (PRD §2.5) — do not recompute
  from the filtered set.

### 2.5 Esc (`components/ModelViewerStage.tsx`)

- The Escape cascade is the `onKeyDown` handler in `ModelViewerStage.tsx`
  (measure exit → selection clear → `dispatchModelViewerPopoverEscape()`).
  Insert a legend-filter clear after the selection clear and before the
  popover dispatch (`lib/events.ts` is just the popover pub/sub, not the
  cascade).

## 3. Tests

- **vitest**:
  - `bucketKeyForObject` for each theme + line style;
  - `isHiddenByFilter` truth table incl. stale-theme guard and
    null-filter pass-through;
  - store reset paths clear the filter (lens/theme/file);
  - selection clears when its faces are hidden.
- **Playwright** (`model-viewer-legend-filter.spec.ts`, new): upload
  the canonical fixture, Building + Boundary theme, click the
  "Outdoors" row, assert non-Outdoors objects drop out of the visible set
  (use the debug hook), click Clear, assert all return.
- Expose filter state on the `window.__phnModelViewer` debug hook
  (`legendFilter` + make `visibleObjectIds` filter-aware so it reflects
  the isolated set) for deterministic e2e.

## 4. Exit criteria

- PRD §6 acceptance items 1–5 met (multi-select item 6 is Phase 2).
- Filter clears on every context switch and on Esc.
- `make format` + `make ci` green; focused vitest + the new Playwright
  spec green.
