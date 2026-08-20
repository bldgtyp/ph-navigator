---
DATE: 2026-08-19
TIME: 23:57 EDT
STATUS: Active — Phases 00–03 complete; Phase 04 next
AUTHOR: Codex
SCOPE: Current state of Assembly PDF and public dimensions
RELATED:
  - planning/features/assembly-pdf-and-public-dimensions/PRD.md
  - planning/features/assembly-pdf-and-public-dimensions/PLAN.md
---

# STATUS — Assembly PDF and Public Dimensions

**State:** `Active` implementation. Phases 00–03 are complete on
`codex/assembly-pdf-public-dimensions`.

## Next step

Run PLAN Phase 04: perform rendered signed-in/locked/signed-out acceptance,
inspect the final multi-page PDF, run final gates, and update the graph/docs.

## Blockers and risks

- Rendered browser acceptance must still verify the action/menu and public
  dimension behavior against the isolated local fixture.

## Verification ledger

- [x] Renderer proof preserves vectors and selectable text. ReportLab 5.0.0;
  `uv run pytest tests/envelope/test_assembly_pdf_renderer.py -q` → `1 passed`;
  visual artifact: `working/assembly-pdf-renderer-proof.pdf`.
- [x] Backend N Assemblies → N deterministic vector PDF pages; focused backend
  report/renderer/route/access suites pass (`18 passed`).
- [x] Saved-Version route, dedicated export capability, SI/IP output, stable
  sanitized filename, and `422 no_assemblies` behavior.
- [x] Dirty-draft confirmation, active units, server filename, busy/cancel,
  saved-count, and request-error behavior in the Assembly actions client.
- [x] Editor dimensions and commands unchanged; focused component and
  `EnvelopePage` suites pass (`65 passed`).
- [x] Locked and anonymous dimensions visible as semantic text with no layer
  mutation controls; membranes remain dimensionless.
- [x] Signed-out export route returns `401 not_authenticated`; focused frontend
  tests prove viewer mode omits the entire Assembly actions menu.
- [x] Automated renderer fixtures cover extreme geometry, ordinary air-barrier,
  membrane, legacy multi-segment membrane, missing-material, and long-name
  cases; visual clipping acceptance remains in Phase 04.
- [ ] Rendered browser and PDF acceptance complete.
