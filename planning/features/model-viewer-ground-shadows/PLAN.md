---
DATE: 2026-07-01
TIME: 16:18 EDT
STATUS: Planned / ready for implementation.
AUTHOR: Codex
SCOPE: Small implementation sequence for Model Viewer ground shadows.
RELATED:
  - README.md
  - PRD.md
  - STATUS.md
---

# Plan - Model Viewer Ground Shadows

## Phase 1 - Reproduce and identify exact helper

- Use the local starter model route and confirm the gray plane appears.
- Inspect the rendered Three scene via Playwright/page evaluate if needed:
  confirm object type/name/material/bounds for the visible helper.
- Toggle or temporarily isolate render helpers during investigation only;
  do not commit debug toggles.

Exit criteria: exact scene object is identified, with before screenshot.

## Phase 2 - Correct the ground-shadow implementation

- First attempt: fix `ContactShadows` orientation/position for PHN's Z-up
  scene so it lies on the ground plane below the model.
- Keep the receiver outside `model.bounds` calculations and picking.
- Preserve the current low-cost intent: baked/static contact shadow, no
  per-frame shadow-map work.
- If `ContactShadows` still exposes its plane, replace it with a small custom
  horizontal ground-shadow treatment or remove it in favor of AO/grid grounding.

Exit criteria: no visible vertical helper plane; soft grounding remains.

## Phase 3 - Verification and docs

- Run focused model-viewer browser smoke:
  - Building lens normal orbit.
  - Site & Sun lens.
  - Ventilation or Hot Water line lens.
  - Section plane enabled.
- Verify clicks through the former plane area do not select/block model picks.
- Run `make frontend-dev-check`.
- Update `STATUS.md` with screenshots/commands and any durable decision.

Exit criteria: focused smoke and frontend gate pass; status is updated.
