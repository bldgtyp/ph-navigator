---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Disposition + phase map for viewer-display-modes.
RELATED: ./README.md; ./PRD.md
---

# STATUS — Viewer display modes

**State:** Active — captured from the 2026-07-15 UI batch. Not scoped in detail.

## Phase map (proposed)

- **Phase 1 — Spaces material fix (Item 13). ✅ DONE.** Spaces now render fully
  opaque with the exact Building shaded material (white `#ececec`). The knob was
  `baseOpacity`/`baseColor` in `lib/colors.ts` (not `lenses.ts` as first assumed).
  Verified on a render; Ed confirmed opaque + white. On branch
  `feature/spaces-opaque-material` (not yet merged to main).
- **Phase 2 — Airflow on Floor Areas (Item 14).** Reuse the airflow color path +
  legend on the Floor Areas lens.
- **Phase 3a — ERV research (Item 15 gate).** Determine whether the space→ERV
  mapping reaches the PHN document schema. Deliverable: yes/no + where the data
  lives (or where it's dropped).
- **Phase 3b — ERV color mode (Item 15).** Only if 3a clears (or after the
  upstream schema field is added): register the new color mode + legend.

## Next step

Phase 1 (Item 13) is done. Remaining: Phase 2 (Airflow on Floor Areas) and the
Phase 3a ERV research that gates Item 15.

## Blockers

- Item 15 is blocked on the Phase 3a research result.

## Verification

- ✅ Item 13: Spaces lens renders solid opaque white, identical to the Building
  shaded material; interiors occluded (section plane to cut in) — confirmed on a
  render.
- Floor Areas lens shows the Airflow legend and colors correctly.
- (If shipped) ERV mode colors spaces per unit with a correct legend.
- Check draw-call / FPS baseline (~14 calls @ 60 FPS on Hillandale) isn't
  regressed by new materials/modes.
