---
DATE: 2026-07-01
TIME: 16:20 EDT
STATUS: Complete; implemented, verified, and docs-pass folded back.
AUTHOR: Claude (for Ed)
SCOPE: Router for the MEP (duct/pipe) element-selection feature folder.
RELATED:
  - PRD.md
  - PLAN.md
  - STATUS.md
  - phases/
  - planning/archive/dated/2026-06-13/model-viewer/UI_SPEC.md
  - planning/archive/dated/2026-06-13/model-viewer/PRD.md
---

# Model Viewer — MEP Element Selection & Length Reporting

Amends the Model tab's Ventilation and Hot Water lenses only: clicking
a duct/pipe segment selects and highlights the whole parent Element
(not just the segment), the inspector leads with Total Length and an
stable per-segment table synced bidirectionally to the 3D scene, and
adds automatic, selection-scoped dimension-line overlays.

## Read order

1. `PRD.md` — full product/behavior contract, current-state grounding,
   design decisions (D-1..D-7), open questions, acceptance criteria.
   **Start here, always — every phase doc assumes it.**
2. `PLAN.md` — phase sequence overview and dependency ordering.
3. `phases/phase-01-backend-total-length.md` through
   `phases/phase-05-verification-closeout.md` — self-contained
   subagent handoffs, one per phase. Read only the phase you're
   picking up; each cites the exact PRD sections and file:line
   references it implements.
4. `STATUS.md` — current state and next step.
5. `planning/archive/dated/2026-06-13/model-viewer/UI_SPEC.md` §3
   (lens table) and §6 (selection + inspector) — the accepted baseline
   this feature amends for two of its six lenses.

## Current state

Complete 2026-07-01. Phases 1-5 shipped: backend length fields,
element-level selection/highlight/camera/inspector, row/segment focus
sync, selection-scoped dimension lines, full viewer verification, and
context docs-pass. Segment `#` order was verified **not** to be a
physical path order; it ships as stable display order only.
