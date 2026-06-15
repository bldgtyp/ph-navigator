---
DATE: 2026-06-12
TIME: 17:05 EDT
STATUS: Deferred
AUTHOR: Codex
SCOPE: Router for v1.1 candidate features that are intentionally outside the current v1 scope.
RELATED:
  - planning/.instructions.md
  - planning/features/attachments/STATUS.md
---

# v1.1 Candidate Features

This folder holds deferred feature candidates for PH-Navigator V2 v1.1.
These are intentionally not part of the current v1 closeout scope.

Use the normal feature-folder shape for each candidate:

```text
planning/features_v1.1/<feature-slug>/
  README.md
  PRD.md
  STATUS.md
```

## Candidate Index

| Feature | Status | Current next step |
|---|---|---|
| [Model Viewer post-MVP](model-viewer-post-mvp/README.md) | Active (router) | Umbrella router classifying the deferred Model Viewer candidates into the feature folders below. |
| ⮑ [Model Viewer — Sun Path (3D render)](model-viewer-sun-path/README.md) | Active (planned) | **Frontend-only; depends on Climate Phase 1** (which owns the sun-path endpoint). Render the diagram over geometry once Climate ships it. Scrubber is a gated Phase 2. |
| ⮑ [Model Viewer — Legend as Filter](model-viewer-legend-filter/README.md) | Active (planned) | Ready to build — Ed-flagged near-priority; frontend-only, no open decisions, no Climate dependency. |
| ⮑ [Model Viewer — Clipping Planes](model-viewer-clipping-planes/README.md) | Deferred (gated) | Build when a named sectioned-inspection workflow exists; plan is ready. |
| [User-defined attachment fields](user-defined-attachment-fields/README.md) | Deferred | Revisit after v1 ships and at least two real project workflows need ad hoc attachment columns. |
| _(shipped in v1.0)_ Climate — reference-data ingest + seed | Complete | Shipped v1.0 (2026-06-15) and archived to `planning/archive/climate-reference-data-seeding/`. The former **PHI/PHPP importer** candidate was folded in as `phases/phase-02-phi-importer.md`. |
| [Climate — Design conditions + metrics](climate-design-conditions/README.md) | Deferred (gated) | Build with a scheduled fRSI/comfort consumer; needs D-CL-5. Per-source, source-parameterized exterior-conditions contract. |
| [Climate — tab follow-ups](climate-tab-followups/README.md) | Deferred | Small independent backlog: custom-record entry form, sun-path cardinal labels, attached-source charts, promote `ClimateRecord` to `context/`. |

The **Climate** feature (a top-level tab that owns location/EPW + the
sun-path service + climate design conditions) shipped its data store —
**Phases 1–3 are complete (2026-06-14)** and the feature is archived at
[`planning/archive/climate/`](../archive/climate/README.md). Its remaining
deferred work was split into the three `climate-*` candidates above.

Model Viewer Tier 3 candidates (HBJSON↔document cross-check, comments/
annotations, John test) stay scoped inside
[model-viewer-post-mvp](model-viewer-post-mvp/PRD.md) until their gates
open — they are not yet broken into feature folders.
