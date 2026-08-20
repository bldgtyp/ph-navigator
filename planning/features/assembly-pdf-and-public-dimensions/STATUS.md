---
DATE: 2026-08-19
TIME: 23:00 EDT
STATUS: Active — Phases 00–01 complete; Phase 02 next
AUTHOR: Codex
SCOPE: Current state of Assembly PDF and public dimensions
RELATED:
  - planning/features/assembly-pdf-and-public-dimensions/PRD.md
  - planning/features/assembly-pdf-and-public-dimensions/PLAN.md
---

# STATUS — Assembly PDF and Public Dimensions

**State:** `Active` implementation. Phases 00–01 are complete on
`codex/assembly-pdf-public-dimensions`.

## Next step

Run PLAN Phase 02: add the canonical backend Assembly report projection,
cross-language parity fixture, and deterministic N-page composer.

## Blockers and risks

- Browser and backend geometry live on different sides of the stack. The report
  model/parity tests must prevent two drifting Assembly interpretations.

## Verification ledger

- [x] Renderer proof preserves vectors and selectable text. ReportLab 5.0.0;
  `uv run pytest tests/envelope/test_assembly_pdf_renderer.py -q` → `1 passed`;
  visual artifact: `working/assembly-pdf-renderer-proof.pdf`.
- [ ] Backend N Assemblies → N PDF pages.
- [ ] Saved-Version, capability, filename, and dirty-draft behavior.
- [x] Editor dimensions and commands unchanged; focused component and
  `EnvelopePage` suites pass (`65 passed`).
- [x] Locked and anonymous dimensions visible as semantic text with no layer
  mutation controls; membranes remain dimensionless.
- [ ] Signed-out export route/menu unavailable.
- [ ] Extreme geometry and membrane fixtures render without clipping.
- [ ] Rendered browser and PDF acceptance complete.
