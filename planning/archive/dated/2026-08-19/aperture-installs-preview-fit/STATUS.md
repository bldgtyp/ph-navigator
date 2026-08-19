---
DATE: 2026-08-19
TIME: 19:35 EDT
STATUS: Complete — implemented and verified on branch
AUTHOR: Codex
SCOPE: Current state of Installs preview fitting
RELATED:
  - planning/archive/dated/2026-08-19/aperture-installs-preview-fit/PRD.md
---

# STATUS — Aperture Installs Preview Fit

**State:** `Complete`; implementation, verification, docs pass, and archive
cleanup finished on `codex/aperture-installs-preview-fit`.

## Next step

No implementation work remains. Merge/deploy are separate operator decisions.

## Implementation

- `containFitZoom` now owns width/height fit math shared by the Builder and
  Installs preview.
- `InstallsPreviewCanvas` measures its own region with `ResizeObserver`, keeps
  the last valid measurement through transient zero-size observations, and
  centers the exact-size SVG/overlay viewport with 16 px minimum padding.
- Scale-up is capped at the existing 300% builder maximum; narrow UI stacks the
  key view over the independently scrolling legend.

## Verification

- [x] Unit tests cover width-fit, height-fit, padding, maximum scale, and
      transient zero-size measurement.
- [x] Component test proves SVG/overlay share one zoom and recompute on resize.
- [x] Full CI confirms existing staged editing, paint, and copy tests remain
      green.
- [x] `make agent-browser-ready` ran before mounted Installs-modal checks.
- [x] Playwright geometry checks cover portrait, landscape, resize, and narrow
      stacked UI.
- [x] Browser bounding boxes confirm every edge target remains inside the
      shared SVG bounds.

## Verification evidence

- `make format` — passed; frontend and backend sources formatted.
- `make ci` — passed: backend `1870 passed, 7 skipped`; frontend `272` files /
  `2456` tests passed; structural guards and production build passed.
- `pnpm exec playwright test tests/e2e/apertures-installs-modal.spec.ts` —
  `2 passed`, covering staged edit persistence plus portrait, landscape,
  resize, narrow stack, padding, shared zoom, and edge bounding boxes.
- `graphify update .` — code graph refreshed after implementation.

## Residual risk

No known functional residual. The mounted geometry spec uses a single-cell
aperture; multi-cell, Empty-panel, missing-frame, operation-symbol, and mulled
edge behavior remains covered by the existing unit/component suite included in
full CI.

## Blockers

None. The defect is isolated to frontend sizing; no schema or backend work is
expected.
