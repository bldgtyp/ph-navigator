---
DATE: 2026-06-13
TIME: -
STATUS: Deferred — gated on a concrete sectioned-inspection workflow.
  Plan is implementable; do not start until the gate opens.
AUTHOR: Claude (for Ed)
SCOPE: Router for the Model Viewer section / clipping-planes feature.
RELATED:
  - PRD.md
  - PLAN.md
  - phases/phase-01-axis-clipping.md
  - context/user-stories/40-model-viewer.md (Q-VIEW-8)
  - planning/features_v1.1/model-viewer-post-mvp/ (umbrella router)
---

# Model Viewer — Section / Clipping Planes

Add a clipping plane the reviewer can position to cut through the model
("show me the wall section through this room", "look inside without
orbiting around"). Deferred at MVP (Q-VIEW-8) because it needs
plane-placement UI and a non-trivial scene integration, and because no
v1 workflow gated it.

## Gate

Build this when a **named** review workflow needs sectioned inspection
— e.g. a wall-section review or interior walkthrough that orbiting +
the existing lenses cannot serve. Until then it stays planned-but-idle.
The technical approach is low-ambiguity (below), so the plan is ready
whenever the gate opens.

## Read order

1. `PRD.md` — behavior contract + the MVP-scope vs. nice-to-have line.
2. `PLAN.md` — approach and the one real risk (capped cross-sections).
3. `phases/phase-01-axis-clipping.md` — implementable handoff.

## Why it is plannable now

three.js clipping is well-trodden: a global clipping plane on the WebGL
renderer (`gl.clippingPlanes`) cuts every material in the scene without
touching the MVP's shared/derived materials (D-09). The scene is
`frameloop="demand"`, so plane moves just `invalidate()`. The hard part
is *capping* the cut faces (a solid cross-section fill), which is a
known three.js gap — explicitly out of MVP scope here.
