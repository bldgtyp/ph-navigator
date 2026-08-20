---
DATE: 2026-08-20
TIME: 00:32 EDT
STATUS: Complete — implementation and acceptance verified
AUTHOR: Codex
SCOPE: Current state of Assembly PDF and public dimensions
RELATED:
  - planning/archive/dated/2026-08-20/assembly-pdf-and-public-dimensions/PRD.md
  - planning/archive/dated/2026-08-20/assembly-pdf-and-public-dimensions/PLAN.md
---

# STATUS — Assembly PDF and Public Dimensions

**State:** `Complete` on `codex/assembly-pdf-public-dimensions`. All PRD
acceptance criteria have automated or rendered evidence.

## Next step

Open the archived packet's branch for review/merge.

## Blockers and risks

- None for the agreed scope. Alternate page sizes and per-Assembly selection
  remain explicit non-goals.

## Verification ledger

- [x] Renderer proof preserves vectors and selectable text. ReportLab 5.0.0;
  `uv run pytest tests/envelope/test_assembly_pdf_renderer.py -q` → `5 passed`;
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
  cases.
- [x] Rendered browser acceptance: unlocked editor shows SI dimensions and the
  enabled PDF action; dirty-draft confirm cancels/accepts correctly; locked
  mode retains the PDF action and semantic dimensions without edit controls;
  anonymous IP view retains dimensions and omits Assembly actions.
- [x] Final PDF acceptance: `working/assembly-report-phase04.pdf` is two
  deterministic US Letter landscape pages with selectable text/vector output;
  rendered pages show no clipping, membrane thickness label, or table overflow.
- [x] Full verification: backend `1,903 passed, 7 skipped`; frontend `2,505
  passed`; Ruff, ty, ESLint (existing warnings only), Prettier, production
  build, file/feature/style contract checks, and `git diff --check` pass.
