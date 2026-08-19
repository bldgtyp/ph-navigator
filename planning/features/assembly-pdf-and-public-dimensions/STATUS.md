---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — not started
AUTHOR: Codex
SCOPE: Current state of Assembly PDF and public dimensions
RELATED:
  - planning/features/assembly-pdf-and-public-dimensions/PRD.md
  - planning/features/assembly-pdf-and-public-dimensions/PLAN.md
---

# STATUS — Assembly PDF and Public Dimensions

**State:** `Active` planning; no application code has been changed.

## Next step

Run PLAN Phase 00 and commit the renderer/page-contract decision before adding
an export dependency. In parallel, Phase 01 can begin with a failing test that
proves read-only `AssemblyCanvasOverlay` currently omits layer dimensions.

## Blockers and risks

- No production PDF composition library is currently established in this repo.
  This is a bounded Phase 00 decision, not permission to rasterize the page.
- Browser and backend geometry live on different sides of the stack. The report
  model/parity tests must prevent two drifting Assembly interpretations.

## Verification ledger

- [ ] Renderer proof preserves vectors and selectable text.
- [ ] Backend N Assemblies → N PDF pages.
- [ ] Saved-Version, capability, filename, and dirty-draft behavior.
- [ ] Editor dimensions and commands unchanged.
- [ ] Locked and anonymous dimensions visible/read-only.
- [ ] Signed-out export route/menu unavailable.
- [ ] Extreme geometry and membrane fixtures render without clipping.
- [ ] Rendered browser and PDF acceptance complete.
