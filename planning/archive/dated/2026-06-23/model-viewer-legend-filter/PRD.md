---
DATE: 2026-06-13
TIME: -
STATUS: Active — behavior contract.
AUTHOR: Claude (for Ed)
SCOPE: Product / behavior contract for legend-as-filter (NEW-VIEW-2).
RELATED:
  - README.md
  - PLAN.md
  - context/user-stories/40-model-viewer.md (NEW-VIEW-2)
  - planning/archive/model-viewer/decisions.md D-11
  - planning/archive/model-viewer/UI_SPEC.md §4 (legend card)
---

# Legend as Filter — PRD

## 1. Goal

Let a reviewer isolate geometry by legend bucket. Click the
"RoofCeiling" swatch in the Surface Type legend → see only roof faces.
Click an "Insulation" entry in the Construction legend → isolate every
face using that construction. This turns the legend from a passive key
into a QA filter, reusing the color mapping the legend already
computes.

## 2. Behavior contract

1. **Click a legend row → isolate.** Clicking a legend row filters the
   active lens to objects whose bucket key matches that row. The matched
   bucket renders solid; the non-matching *faces* are **hidden**, but the
   building's merged edge line stays drawn (recolored a lighter gray) so
   the whole envelope reads as a faint **wireframe context** behind the
   isolated faces. (See §5 — this honors V1's "hide non-matching" intent
   for faces while keeping the wireframe for orientation.)
2. **Active-row affordance.** The clicked row reads as active
   (pressed/outlined). The legend's other rows stay visible and
   clickable (clicking a different row switches the isolation).
3. **Clear filter.** An obvious "Clear filter" affordance at the top of
   the legend card restores all geometry. Clicking the active row again
   also clears it (toggle-off).
4. **Multi-select (Phase 2).** Shift-click adds/removes rows from the
   filter set (show roofs AND floors). Plain click replaces the set
   with the single clicked row. Without shift, single-select.
5. **Counts stay truthful.** Legend counts continue to show the total
   per bucket in the model (not the post-filter count) — they are a
   model summary, not a filter readout. (If a post-filter readout is
   ever wanted, that is a separate enhancement; do not silently change
   the count semantics.)
6. **Scope = active lens only.** Filtering hides objects of the active
   lens. Ghost-context geometry from other lenses (the faint building
   edges shown behind interior lenses) is unaffected — it is context,
   not filterable content.
7. **Filter resets on context change.** Switching lens, switching
   theme (different buckets), or switching file clears the filter. A
   filter keyed to Boundary buckets is meaningless under Construction.
8. **Selection interaction.** When a filter hides the currently-selected
   object's faces (it falls outside the active set), the inspector closes
   / selection clears (you cannot inspect a wireframe ghost). Selecting a
   still-solid object works normally. Hidden faces are not
   hoverable/clickable — `setVisibleAt(false)` instances are skipped by
   the raycaster, and line-lens objects are `raycast`-disabled when dimmed.
9. **Measure interaction.** Entering Measure does not change the
   filter; the filter just restricts which faces are present to snap
   to. (Measure already clears selection/hover; no new rule needed.)
10. **Mini-key lenses filter too.** Ventilation (supply/exhaust) and
    Hot Water (distribution/recirc) mini-key rows filter their line
    objects by `lineStyle`, same model.

## 3. UI surface

- Reuses the existing legend card (`components/LegendCard.tsx`,
  UI_SPEC §4). Rows become active buttons (today they are
  `aria-disabled` inert buttons). Add a "Clear filter" control in the
  card header, shown only when a filter is active.
- Active row styling uses the BLDGTYP token system (consistent with the
  rest of the viewer chrome); the swatch + label + count layout is
  unchanged.
- Keyboard: the rows are already buttons — ensure they are focusable
  and Enter/Space activate; `Esc` clears the filter (fold into the
  existing Esc cascade in `components/ModelViewerStage.tsx`, after
  Measure exit and selection clear, before the popover dispatch).

## 4. State

- One store field, e.g. `legendFilter: { theme: ModelViewerTheme;
  keys: Set<string> } | null` on `modelViewerStore`. `theme` is stamped
  so a stale filter from a previous theme is ignored/cleared on theme
  switch. Single-select = a one-element set.
- `setLens` / `setTheme` / `setActiveFileId` clear `legendFilter` (add
  to the existing reset paths in `store.ts`).

## 5. Isolate with wireframe context (decision baked in, not open)

**Isolate the faces, keep the building as a wireframe.** For mesh lenses:
hide the non-matching *faces* via `BatchedMesh.setVisibleAt(instanceId,
false)`, but leave the lens's single merged edge `LineSegments` drawn —
recolored a lighter gray while a filter is active, restored on clear — so
the matched bucket shows solid inside a faint wireframe of the whole
envelope. For line lenses (no faces/edges): recolor non-matching lines to
faint gray + `raycast`-off.

*History (2026-06-23):* the spec originally said plain **hide** (remove
non-matching entirely), justified by "cheapest given the per-object render
in `BuildingLens`." The batched-rendering refactor (`dbca4650`) removed
that per-object render and made plain hide *expensive* — faces hide per
instance, but the lens's edges are one merged line with no per-instance
visibility, so honest hide would mean re-merging edge geometry on every
toggle. Keeping the merged edges as deliberate wireframe context turns
that cost into a feature: no occlusion (matched faces are unobstructed)
**and** full spatial context, with only per-instance `setVisibleAt` writes
+ a one-material edge recolor. Plain hide and a separate dim toggle are
both out of scope — one behavior.

## 6. Acceptance gate

1. Clicking a Surface Type / Boundary / Construction / Window
   Construction / Weighting Factor / Ventilation Airflow row isolates
   the matching faces (solid) against the wireframe context; clearing
   restores all faces.
2. Mini-key (Ventilation, Hot Water) rows filter line objects.
3. Filter clears on lens/theme/file switch and on `Esc`.
4. Selecting then filtering-away the selection closes the inspector;
   hidden faces are not clickable.
5. Counts remain model totals.
6. Shift-click multi-select (Phase 2) shows the union; plain click
   replaces.
7. `make ci` green; focused vitest (filter predicate + reset paths) +
   Playwright (isolate Boundary "Outdoors", assert non-Outdoors faces
   hidden while edges remain, clear).
