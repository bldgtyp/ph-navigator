---
DATE: 2026-07-01
TIME: 18:05
STATUS: Active
AUTHOR: Claude (for Ed)
SCOPE: Phase 01 — ground-shadow baseline fix (PRD D-12; imported from
  planning/features/model-viewer-ground-shadows/, now Superseded).
RELATED:
  - ../PRD.md §2, §5.3, D-12
  - ../../model-viewer-ground-shadows/PRD.md (imported behavior contract)
  - frontend/src/features/model_viewer/scene/ViewerCanvas.tsx
---

# Phase 01 — Ground-Shadow Baseline Fix

## Problem (verified)

`ViewerCanvas.tsx` renders drei `ContactShadows` with
`rotation={[Math.PI / 2, 0, 0]}` — which is drei's *default* Y-up
orientation (the component's internal group is `rotation-x={Math.PI/2}`;
the prop overrides it with the same value). In PHN's Z-up scene that
plane is vertical, so from some orbit angles it reads as a giant
free-standing gray sheet.

## Steps

1. Reproduce on the local seed model; capture a before screenshot
   (`assets/phase-01-before.png`).
2. Read the installed drei `ContactShadows` source to confirm the group
   orientation convention, then correct the rotation for Z-up (ground =
   XY plane, normal +Z). Expected fix: `rotation={[-Math.PI / 2, 0, 0]}`
   composed so the internal bake camera looks down world −Z — verify
   empirically, don't trust the sign on paper.
3. Keep everything else about the helper: baked `frames={1}`, not keyed
   by lens (CR3), non-interactive, positioned just below `z = 0`.
   If orientation alone cannot make the plane visually inert, fall back
   per the imported PLAN: custom horizontal receiver, then AO/grid-only.
4. Verify across Building, Site & Sun, one line lens, and with a section
   plane; click through the former plane area (no pick, no block);
   capture after screenshots.
5. `make frontend-dev-check`.

## Exit criteria

Imported acceptance criteria hold: no vertical/free-standing helper
plane from any orbit angle; soft grounding cue below the building in
every lens; helper never intercepts picking/measure/section; before/
after screenshots recorded.

## Ledger

- (fill on completion)
