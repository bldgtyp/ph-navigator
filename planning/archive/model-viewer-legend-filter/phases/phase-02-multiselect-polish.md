---
DATE: 2026-06-13
TIME: -
STATUS: Implemented — multi-select + polish (tests green; unmerged).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — multi-select + a11y/polish.
RELATED:
  - ../PRD.md
  - phase-01-single-select-isolate.md
---

# Phase 2 — Multi-select + polish

Small follow-on to Phase 1. Adds shift-click union semantics and the
accessibility/polish pass.

## Work

1. **Shift-click union (`LegendCard` + store).**
   - Plain click: replace the filter set with the single clicked key
     (Phase 1 behavior).
   - Shift-click: add/remove the clicked key from the set (union).
   - Empty set after a shift-removal → clear the filter (equivalent to
     no filter).
   - Pass the modifier from the row's click handler into a store action
     that branches on it (e.g. `applyLegendFilter(theme, key, {
     additive })`).
2. **Active-row styling.** Make the active/selected rows visually
   distinct via the BLDGTYP token system; ensure the multi-select state
   (2+ active rows) reads clearly. Keep it understandable — if it ever
   reads as noise, single-select is the fallback (PRD §2.4: multi-select
   "only if it stays understandable").
3. **A11y.** `aria-pressed` per row; the legend container described as a
   filter group; Clear-filter reachable by keyboard; focus order sane.
   Run the project a11y expectations (chrome-devtools a11y skill or the
   existing structural guards).
4. **Mini-key parity.** Confirm Ventilation / Hot Water mini-key rows
   honor multi-select (supply AND exhaust) the same way themed rows do.

## Tests

- **vitest**: union add/remove, empty-set-clears, plain-click-replaces.
- **Playwright**: shift-click two Surface Type rows (e.g. Wall +
  RoofCeiling), assert the union's faces stay solid and other faces drop
  out (edges remain); shift-click one off, assert its faces hide.

## Exit criteria

- PRD §6 item 6 met; a11y pass clean.
- `make format` + `make ci` green.
