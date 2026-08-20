---
DATE: 2026-08-20
TIME: 00:14 EDT
STATUS: Complete — implementation and acceptance verified
AUTHOR: Ed May / Codex
SCOPE: Assembly PDF export and read-only thickness dimensions
RELATED:
  - planning/features/assembly-pdf-and-public-dimensions/PRD.md
  - planning/features/assembly-pdf-and-public-dimensions/PLAN.md
  - planning/features/assembly-pdf-and-public-dimensions/STATUS.md
  - planning/features/assembly-pdf-and-public-dimensions/decisions.md
  - planning/2026-08-19-ui-batch.md
---

# Assembly PDF and Public Dimensions

Two Assembly presentation gaps share one underlying requirement: PHN needs a
canonical Assembly drawing that can render complete dimensional information
without exposing editor controls.

1. Editors can download one PDF containing every Assembly, one Assembly per
   page, from the existing **Assembly actions** menu.
2. Anonymous viewers can see the left-side layer-thickness dimensions on an
   Assembly page but cannot edit, add, or delete layers.

## Read order

1. `PRD.md` — behavior and output contract.
2. `PLAN.md` — implementation sequence and renderer decision gate.
3. `STATUS.md` — current state, next step, and verification ledger.

## Current-code anchors

- `frontend/src/features/envelope/routes/EnvelopePage.tsx` owns the
  `AppMenu label="Assembly actions"` placement and saved-Version availability
  wiring.
- `frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx` renders
  `AssemblyLayerDimensions` for editors and read-only viewers.
- `frontend/src/features/envelope/components/AssemblyLayerDimensions.tsx`
  separates semantic dimension presentation from editor-only thickness,
  add-layer, and delete-layer controls.
- `frontend/src/features/envelope/components/AssemblySvgCanvas.tsx` and
  `canvas-geometry.ts` own the browser drawing geometry.
- `frontend/src/features/envelope/assembly-report.ts` projects that geometry
  into the checked frontend/backend parity fixture.
- `frontend/src/features/envelope/components/MaterialLegend.tsx` remains the
  on-screen material-table contract matched by the report projection.
- `backend/features/envelope/assembly_report.py` owns the canonical saved-Version
  report model and portable natural ordering.
- `backend/features/envelope/assembly_pdf.py` composes the deterministic vector
  pages; `backend/features/envelope/routes.py` owns capability-gated delivery.
- `frontend/src/features/envelope/hooks/useAssemblyPdfExport.ts` owns the
  saved-Version warning and PDF action; the shared download controller handles
  busy, cancellation, filename, and error behavior.

## Scope boundary

The PDF is an editor export, consistent with the other bulk items already in
Assembly actions. This packet does not expose the actions menu or PDF endpoint
to anonymous viewers. Public dimensions are a separate read-only presentation
contract within the same packet.
