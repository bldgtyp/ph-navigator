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

- **Phase 1 — Spaces material fix (Item 13).** Quick material swap in `lenses.ts`
  toward the Building treatment; verify against a rendered model with Ed to
  resolve the opaque-vs-transparency clarify.
- **Phase 2 — Airflow on Floor Areas (Item 14).** Reuse the airflow color path +
  legend on the Floor Areas lens.
- **Phase 3a — ERV research (Item 15 gate).** Determine whether the space→ERV
  mapping reaches the PHN document schema. Deliverable: yes/no + where the data
  lives (or where it's dropped).
- **Phase 3b — ERV color mode (Item 15).** Only if 3a clears (or after the
  upstream schema field is added): register the new color mode + legend.

## Next step

Phase 1 is a fast, high-value fix — do it first (with an eyeball check on the
material). In parallel, run the Phase 3a research so Item 15's true size is known
before committing.

## Blockers

- Item 15 is blocked on the Phase 3a research result.
- Item 13 has a soft decision (opaque vs. translucent) best made on a screenshot.

## Verification (when built)

- Browser/screenshot: Spaces lens looks solid like Building; interiors still
  legible per the resolved decision.
- Floor Areas lens shows the Airflow legend and colors correctly.
- (If shipped) ERV mode colors spaces per unit with a correct legend.
- Check draw-call / FPS baseline (~14 calls @ 60 FPS on Hillandale) isn't
  regressed by new materials/modes.
