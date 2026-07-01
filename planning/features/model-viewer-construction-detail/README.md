---
DATE: 2026-07-01
TIME: -
STATUS: PRD accepted (decisions D-1/D-2/D-8/D-9 + label settled); four
  phased handoff docs authored. No implementation started.
AUTHOR: Claude (for Ed)
SCOPE: Router for the Model tab "detailed construction viewer" feature —
  a read-only modal that visualizes an opaque surface's HBJSON assembly
  (layers + segments) when the user clicks a button in the Opaque
  Surface inspector card.
RELATED:
  - PRD.md
  - PLAN.md
  - STATUS.md
  - planning/features/model-viewer-mep-elements/ (sibling viewer feature,
    same doc conventions)
  - planning/archive/dated/2026-06-13/model-viewer/ (accepted Model tab
    baseline this feature amends)
---

# Model Viewer — Detailed Construction Viewer

Adds a **read-only assembly detail modal** to the Model tab. Clicking a
new button in the Opaque Surface inspector's *Construction* section opens
a modal that draws the construction's full layer stack — every material
layer scaled by thickness, colored by its Passive House color, with
heterogeneous "segment" subdivisions (mixed-material and steel-stud
layers) rendered as sub-cells — plus a layer table with per-layer
thickness, conductivity, and R-value.

The modal is a **viewer of the self-contained HBJSON model only**. It is
deliberately **not** connected to the PH-Navigator App's Envelope items;
the HBJSON assembly may or may not match the App's envelope data, and
reconciling them is explicitly out of scope.

## Read order

1. `PRD.md` — full product/behavior contract, the verified feasibility
   findings, design decisions (D-1..D-9), open questions, acceptance
   criteria. **Start here.**
2. `PLAN.md` — phase sequence overview and dependency ordering.
3. `phases/phase-01-backend-constructions-map.md` →
   `phases/phase-04-inspector-button-and-verification.md` — self-contained
   subagent handoffs, one per phase. Read only the phase you're picking
   up; each cites the exact PRD sections + file:line refs it implements.
4. `STATUS.md` — current state and next step.

## Current state

Feasibility **verified** (PRD §2): the HBJSON carries full layer +
segment + color data, honeybee-ph round-trips it losslessly, and the only
thing dropping it today is the model_viewer Pydantic material schema. All
product decisions settled (opaque-only, dedup `constructions` map,
full Envelope isolation, "View Construction" label). D-9: no
migration/versioning/reset for v1 — the one-day-old prod has no projects,
so there are no cached artifacts to migrate and nothing a reset would
clear; the map just appears on every extraction going forward (versioning
deferred to the next schema change against real data). Four phased handoff
docs authored under `phases/`; none started. Phase 1 (backend map,
additive) is the entry point.
