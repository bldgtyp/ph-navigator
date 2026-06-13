---
DATE: 2026-06-13
TIME: -
STATUS: Ready — implement.
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

- `../PRD.md` (esp. §2 edge cases, §4 state, §5 hide-vs-dim).
- Current code (read before writing — match patterns):
  - `frontend/src/features/model_viewer/lib/themes.ts` —
    `colorForThemedObject`, `legendForModel`, `lineStyleDefinition`.
  - `frontend/src/features/model_viewer/scene/BuildingLens.tsx` —
    `activeObjects.map(...)` render loop, `MeshObject` / `LineObject`.
  - `frontend/src/features/model_viewer/components/LegendCard.tsx` —
    `LegendRows` (inert buttons today).
  - `frontend/src/features/model_viewer/store.ts` — reset paths in
    `setLens` / `setTheme` / `setActiveFileId`.
  - `frontend/src/features/model_viewer/lib/events.ts` — the
    centralized Esc cascade.

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
groups by `color.key`) and the render gate. Mini-key rows use
`lineStyle` as their `id` (see `lineStyleLegendRows`), so the keys line
up with legend row ids without translation.

### 2.2 Store (`store.ts`)

- Add `legendFilter: { theme: ModelViewerTheme; keys: Set<string> } |
  null`.
- Actions: `toggleLegendFilterKey(theme, key)` (single-select: replace
  set with `{key}`, or clear if the same single key is re-clicked) and
  `clearLegendFilter()`.
- Reset `legendFilter` to `null` inside `setLens`, `setTheme`,
  `setUrlViewState` (lens/theme change branch), and `setActiveFileId`.
- When the selection is hidden by a new filter, clear selection/hover —
  either compute in the setter or let `BuildingLens` clear on render
  (prefer the setter for predictability).

### 2.3 Render gate (`scene/BuildingLens.tsx`)

- In the `activeObjects.map(...)` body, compute
  `const hidden = isHiddenByFilter(object, lens, theme, legendFilter)`
  and skip rendering (or render with `visible={false}` +
  `raycast={() => null}`). Skipping is cleanest; ensure geometry
  disposal is unaffected (geometries are owned by the loader/model, not
  per-mount — confirm against the existing dispose-on-file-switch
  logic).
- `isHiddenByFilter` returns false when `legendFilter` is null or its
  `theme` ≠ active theme (stale-filter guard).
- The `SiteSunLayer` branch is exempt (no legend / no filter).

### 2.4 Legend rows (`components/LegendCard.tsx`)

- `LegendRows`: drop `aria-disabled`/`tabIndex={-1}`; wire `onClick` →
  `toggleLegendFilterKey(theme, row.id)`. Reflect active state via
  `aria-pressed` + a class.
- Add a "Clear filter" control in `model-legend-titlebar`, rendered
  only when `legendFilter` is active. Wire to `clearLegendFilter()`.
- Counts (`row.count`) stay model totals (PRD §2.5) — do not recompute
  from the filtered set.

### 2.5 Esc (`lib/events.ts`)

- Extend the centralized Esc cascade: clear the legend filter at the
  appropriate priority (after Measure exit and selection clear, before
  closing popovers, or wherever reads most natural — document the
  order).

## 3. Tests

- **vitest**:
  - `bucketKeyForObject` for each theme + line style;
  - `isHiddenByFilter` truth table incl. stale-theme guard and
    null-filter pass-through;
  - store reset paths clear the filter (lens/theme/file);
  - selection clears when filtered away.
- **Playwright** (`model-viewer-legend-filter.spec.ts`, new): upload
  the canonical fixture, Building + Boundary theme, click the
  "Outdoors" row, assert only Outdoors faces remain (use the debug hook
  to read visible ids / counts), click Clear, assert all return.
- Expose filter state on the `window.__phnModelViewer` debug hook
  (`legendFilter`, visible-id list already exists) for deterministic
  e2e.

## 4. Exit criteria

- PRD §6 acceptance items 1–5 met (multi-select item 6 is Phase 2).
- Filter clears on every context switch and on Esc.
- `make format` + `make ci` green; focused vitest + the new Playwright
  spec green.
