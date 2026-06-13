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
   active lens to objects whose bucket key matches that row. Non-
   matching objects of the active lens are **hidden** (not just dimmed)
   — V1's NEW-VIEW-2 intent was "hide all non-matching elements." (See
   §5 for the dim-vs-hide note.)
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
8. **Selection interaction.** While a filter hides the currently-
   selected object, the inspector closes / selection clears (you
   cannot inspect what you cannot see). Selecting a still-visible
   object works normally. Hidden objects are not hoverable/clickable
   (they are not rendered or are `raycast`-disabled).
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
  existing centralized Esc cascade in `lib/events.ts`, ordered after
  Measure/selection/popovers).

## 4. State

- One store field, e.g. `legendFilter: { theme: ModelViewerTheme;
  keys: Set<string> } | null` on `modelViewerStore`. `theme` is stamped
  so a stale filter from a previous theme is ignored/cleared on theme
  switch. Single-select = a one-element set.
- `setLens` / `setTheme` / `setActiveFileId` clear `legendFilter` (add
  to the existing reset paths in `store.ts`).

## 5. Hide vs. dim (decision baked in, not open)

**Hide** (do not render / `raycast`-disable non-matching active-lens
objects). Rationale: V1's spec said "hide all non-matching," hiding is
unambiguous for QA ("show me only the roofs"), and it is the cheapest
correct implementation given the per-object render in `BuildingLens`.
A future "dim instead of hide" toggle is possible but not in scope —
do not build both.

## 6. Acceptance gate

1. Clicking a Surface Type / Boundary / Construction / Window
   Construction / Weighting Factor / Ventilation Airflow row isolates
   the matching geometry; clearing restores it.
2. Mini-key (Ventilation, Hot Water) rows filter line objects.
3. Filter clears on lens/theme/file switch and on `Esc`.
4. Selecting then filtering-away the selection closes the inspector;
   hidden objects are not clickable.
5. Counts remain model totals.
6. Shift-click multi-select (Phase 2) shows the union; plain click
   replaces.
7. `make ci` green; focused vitest (filter predicate + reset paths) +
   Playwright (isolate Boundary "Outdoors", assert hidden count, clear).
