---
DATE: 2026-06-12
TIME: -
STATUS: Active — decisions accepted (Ed 2026-06-12); Phase 1
  implemented 2026-06-12; Phase 2 next
  (phases/phase-02-extraction-backend.md)
AUTHOR: Claude (for Ed)
SCOPE: Router for the 3D Model Viewer feature (the Model tab) — scope,
  read order, and phase map.
RELATED:
  - context/user-stories/40-model-viewer.md (US-Viewer + US-VIEW-1..7 —
    canonical behavior contract; all Q-VIEWs resolved 2026-05-10)
  - research/v1-3d-model-viewer-reference.md (V1 behavior enumeration;
    §16 is the no-regression checklist)
  - context/technical-requirements/frontend-viewer-units.md (§11.4 R3F
    stack, §11.4.2 storage, §11.5 units)
  - context/UI_UX.md §2.9 (Model tab — points at UI_SPEC.md in this
    folder since the 2026-06-12 acceptance)
  - planning/features/model-viewer/PRD.md
  - planning/features/model-viewer/UI_SPEC.md
  - planning/features/model-viewer/PLAN.md
  - planning/features/model-viewer/decisions.md
---

# Model Viewer — Feature Folder

## Scope

The **Model tab**: upload HBJSON exports from the Rhino / Honeybee
toolchain, render them as an interactive 3D model, switch viewing
lenses (building / spaces / floor areas / site+sun / ventilation /
hot water), color geometry by attribute, inspect any object's
metadata, and measure between vertices.

Read-only viewer. Deliberately disconnected from the builder tables
(PRD §11.4.6 / §3 non-goals). Last of the five MVP workspace tabs.

## What is new in this folder (vs. the user stories)

`context/user-stories/40-model-viewer.md` remains the canonical
*behavior* contract — every capability, schema, route, and resolved
question there still applies. This folder adds:

1. **A redesigned UI** (`UI_SPEC.md`) — the user stories describe
   V1's composition (bottom icon rails, explicit Select tool, ColorBy
   as an 8th viz state). Ed's 2026-06-12 direction: redesign for a
   modern, fluid, non-CAD feel serving both engineers and owners.
   The redesign is **capability-preserving**: every US-VIEW behavior
   maps onto the new surface.
2. **Stack decisions the stories left open** (`decisions.md`) —
   backend honeybee dependencies, loading UX without sonner, sun-path
   location source.
3. **An implementation phase sequence** (`PLAN.md`).

## Read order

1. `PRD.md` — feature contract: goals, capability matrix, data flow,
   backend contract summary, deltas vs. the user stories.
2. `UI_SPEC.md` — the UI definition for implementation agents:
   layout, components, interactions, states, keyboard map.
3. `decisions.md` — inherited + accepted decisions (all confirmed by
   Ed 2026-06-12; none open).
4. `PLAN.md` — phase map (6 phases, each PR-sized).
5. `STATUS.md` — current state, next step, blockers.

For fine-grained acceptance criteria (file management rules, schema
DDL, per-type inspector fields, backend extraction details), go to
US-VIEW-1..7 — this folder does not duplicate them.

## Out of scope (MVP)

Per resolved Q-VIEWs and PRD §3: legend-as-filter (NEW-VIEW-2,
near-priority post-MVP), HBJSON↔document cross-check (NEW-VIEW-1),
section/clipping planes, sun-path time scrubber, comments/annotation
tool, shade selectability, HBJSON editing or write-back of any kind.
