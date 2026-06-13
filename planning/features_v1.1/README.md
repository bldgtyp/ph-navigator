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
| ⮑ [Model Viewer — Sun Path](model-viewer-sun-path/README.md) | Active (planned) | Ratify decision D-SP-1, then implement Phase 1 (static annual sun path from project-location data). Scrubber is a gated Phase 2. |
| ⮑ [Model Viewer — Legend as Filter](model-viewer-legend-filter/README.md) | Active (planned) | Ready to build — Ed-flagged near-priority; frontend-only, no open decisions. |
| ⮑ [Model Viewer — Clipping Planes](model-viewer-clipping-planes/README.md) | Deferred (gated) | Build when a named sectioned-inspection workflow exists; plan is ready. |
| [User-defined attachment fields](user-defined-attachment-fields/README.md) | Deferred | Revisit after v1 ships and at least two real project workflows need ad hoc attachment columns. |

Model Viewer Tier 3 candidates (HBJSON↔document cross-check, comments/
annotations, John test) stay scoped inside
[model-viewer-post-mvp](model-viewer-post-mvp/PRD.md) until their gates
open — they are not yet broken into feature folders.
