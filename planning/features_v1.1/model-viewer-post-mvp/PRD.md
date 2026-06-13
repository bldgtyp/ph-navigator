---
DATE: 2026-06-13
TIME: -
STATUS: Deferred
AUTHOR: Codex
SCOPE: Product contracts for deferred Model Viewer v1.1+ candidates.
RELATED:
  - README.md
  - STATUS.md
  - context/user-stories/40-model-viewer.md
  - planning/archive/model-viewer/PRD.md
  - planning/archive/model-viewer/decisions.md
---

# Model Viewer Post-MVP - PRD

## Goal

Preserve the deferred Model Viewer work as explicit future feature
candidates after the MVP archive is complete.

## Candidate Contracts

### Sun-Path Wiring

Site & Sun already renders building geometry, grey non-selectable
shades, north marker, and a location hint. The future feature should
populate and render `sun_path` from project location data.

Non-goals: redesigning the Model tab, making shades selectable, or
reworking Measure.

### NEW-VIEW-2 - Legend-As-Filter

Legend rows are already real inert buttons. Future behavior should
let a reviewer click a legend swatch/row to isolate matching geometry,
with an obvious clear-filter affordance and multi-select only if it
stays understandable.

### NEW-VIEW-1 - HBJSON / Project Document Cross-Check

Compare HBJSON content against builder/project tables and surface
divergences in the Model tab. This should be planned with the broader
Rooms/equipment QA/QC family, not as a purely visual overlay.

### Section / Clipping Planes

Add plane placement and clipping controls only when a concrete review
workflow needs sectioned model inspection.

### Sun-Path Scrubber

Add time/season interaction after static sun-path rendering exists.

### Comments / Annotations

Do not add Model Viewer-only comments before the app has a shared
comment/presence model.

### John Test / Product Validation

The MVP implementation could not perform the non-technical John test
inside a coding-agent session. Treat it as a product validation task,
not a missing implementation phase. If the test exposes workflow gaps,
promote those gaps into specific feature work.
