---
DATE: 2026-06-13
TIME: -
STATUS: Active — implementation sequence.
AUTHOR: Claude (for Ed)
SCOPE: Phase sequence for legend-as-filter.
RELATED:
  - PRD.md
  - phases/phase-01-single-select-isolate.md
  - phases/phase-02-multiselect-polish.md
---

# Legend as Filter — PLAN

Frontend-only. No backend, no new data. Two small phases so the
high-value core ships first and the multi-select nicety is separable.

| Phase | Scope | Ships |
|---|---|---|
| 1 — Single-select isolate | Store field + reset paths; live legend rows; face-visibility gate on the batch + edge recolor (mesh lenses) and `LineObject` recolor (line lenses); clear-filter affordance; Esc; selection interaction | Click a row → isolate faces against wireframe; click again / Clear → restore |
| 2 — Multi-select + polish | Shift-click union; active-row styling polish; a11y pass; mini-key parity hardening | Show roofs AND floors; full keyboard/AT support |

## Shared design (both phases)

- **The filter predicate already exists.** For a themed object,
  `lib/themes.ts:colorForThemedObject(object.meta, lens, theme)?.key`
  is its bucket key. For mini-key line objects, the bucket is
  `object.lineStyle`. A single helper
  `bucketKeyForObject(object, lens, theme)` centralizes both. (Confirmed:
  the `ModelRenderable` union + `kind`/`lineStyle`/`meta` it relies on
  are unchanged in `loaders/building.ts`.)
- **Isolation is per-instance visibility, not a render gate.** Mesh
  lenses render on the batched substrate — there are no per-object meshes
  to skip. In `scene/BatchedLens.tsx`, drive `BatchedMesh.setVisibleAt`
  off `legendFilter` (mirror the existing `useBatchColors` subscriber);
  keep the merged `batch.edges` line drawn and recolor its material a
  lighter gray while the filter is active. Line lenses keep their
  per-object `<Line>`s in `scene/BuildingLens.tsx` — recolor + `raycast`-
  off non-matching ones in `LineObject`.
- **State + resets** live in `store.ts` next to the existing
  `setLens`/`setTheme`/`setUrlViewState`/`setActiveFileId` clears (note:
  theme is per-lens — `themesByLens[lens]`).
- **Legend rows** live in `components/LegendCard.tsx:LegendRows` —
  flip from `aria-disabled` inert buttons to live filter buttons.

## Build order

1. `bucketKeyForObject` helper + unit tests (themed + line-style).
2. Store `legendFilter` field, setter/toggle/clear, and reset wiring.
3. Batch face-visibility + edge recolor in `BatchedLens` (mesh lenses);
   `LineObject` recolor (line lenses).
4. `LegendCard` live rows + Clear-filter control + active styling.
5. Esc wiring (`components/ModelViewerStage.tsx` cascade),
   selection-cleared-when-hidden rule.
6. Phase 2: shift-click set semantics + a11y/mini-key hardening.
7. Tests + `make format` + `make ci`.

## Watch-items

- **Reset completeness** — every context switch (lens/theme/file) must
  clear the filter or you get an invisible, confusing filter. Cover all
  three in tests.
- **`frameloop="demand"`** — the isolation is imperative buffer work
  (`setVisibleAt` + an edge-material color swap), not a React re-render of
  meshes, so toggling the filter **must** `invalidate()` to repaint —
  exactly as `useBatchColors`/`useLensFadeIn` already do.
- **Construction theme buckets are dynamic** — the filter key is the
  construction identifier; large models can have many. Single-select is
  the primary path; multi-select stays understandable because rows are
  explicit clicks (PRD §2.4).
