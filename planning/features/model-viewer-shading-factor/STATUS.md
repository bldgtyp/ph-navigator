---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — not started
AUTHOR: Codex
SCOPE: Current state of Model Viewer shading-factor mode
RELATED:
  - planning/features/model-viewer-shading-factor/PRD.md
  - planning/features/model-viewer-shading-factor/PLAN.md
---

# STATUS — Model Viewer Shading Factor

**State:** `Active` planning; no code written.

## Next step

Start Phase 00 with a red extraction test using at least two apertures whose
Summer and Winter factors differ. Confirm the output currently contains no PH
factor fields, then add the typed wire contract before touching theme UI.

## Known constraint

This is forward-only for existing immutable `/model_data` artifacts. The viewer
must show Missing for old artifacts. Re-extraction of production models is a
separate, explicitly authorized operation.

## Verification ledger

- [ ] Backend valid/null/invalid factor extraction tests.
- [ ] Legacy artifact compatibility.
- [ ] Type/meta carry-through tests.
- [ ] Fixed continuous-scale unit tests.
- [ ] Building-only theme registration and URL season parsing.
- [ ] Summer/Winter repaint without geometry/network work.
- [ ] Continuous legend and Missing count.
- [ ] Inspector values.
- [ ] Viewer draw-call/FPS performance gate.
- [ ] Mounted fresh-artifact browser acceptance after agent readiness.
- [ ] Graphify and durable Model Viewer docs update.

## Blockers

None for implementation. Existing production artifacts will remain Missing
until a separate rebuild/re-upload decision is made.
