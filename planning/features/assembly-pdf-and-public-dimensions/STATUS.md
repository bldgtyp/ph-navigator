---
DATE: 2026-08-19
TIME: 23:00 EDT
STATUS: Active — Phase 00 complete; Phase 01 next
AUTHOR: Codex
SCOPE: Current state of Assembly PDF and public dimensions
RELATED:
  - planning/features/assembly-pdf-and-public-dimensions/PRD.md
  - planning/features/assembly-pdf-and-public-dimensions/PLAN.md
---

# STATUS — Assembly PDF and Public Dimensions

**State:** `Active` implementation. Phase 00 is complete on
`codex/assembly-pdf-public-dimensions`.

## Next step

Run PLAN Phase 01, beginning with a failing component test that proves read-only
`AssemblyCanvasOverlay` currently omits layer dimensions.

## Blockers and risks

- Browser and backend geometry live on different sides of the stack. The report
  model/parity tests must prevent two drifting Assembly interpretations.

## Verification ledger

- [x] Renderer proof preserves vectors and selectable text. ReportLab 5.0.0;
  `uv run pytest tests/envelope/test_assembly_pdf_renderer.py -q` → `1 passed`;
  visual artifact: `working/assembly-pdf-renderer-proof.pdf`.
- [ ] Backend N Assemblies → N PDF pages.
- [ ] Saved-Version, capability, filename, and dirty-draft behavior.
- [ ] Editor dimensions and commands unchanged.
- [ ] Locked and anonymous dimensions visible/read-only.
- [ ] Signed-out export route/menu unavailable.
- [ ] Extreme geometry and membrane fixtures render without clipping.
- [ ] Rendered browser and PDF acceptance complete.
