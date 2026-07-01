---
DATE: 2026-07-01
TIME: -
STATUS: Draft — phase outline pending PRD acceptance. Not started.
AUTHOR: Claude (for Ed)
SCOPE: Implementation phase sequence for the Model tab detailed
  construction viewer. Each phase is one PR-sized, independently
  verifiable slice; per-phase handoff docs under phases/ will be
  authored on PRD acceptance, mirroring the MEP feature's format.
RELATED:
  - PRD.md (product/behavior contract — read first, always)
  - README.md, STATUS.md
---

# Model Viewer — Detailed Construction Viewer — Implementation Plan

Dependency order: **backend data → frontend types + adapter → modal +
drawing → inspector button + verification.** Nothing renders without the
data, so the backend slice leads; it is purely additive (a new map field,
no migration — D-9, prod is empty) and can merge on its own.

Per-phase handoff docs live under `phases/`:

1. `phases/phase-01-backend-constructions-map.md`
2. `phases/phase-02-frontend-types-and-adapter.md`
3. `phases/phase-03-construction-detail-modal.md`
4. `phases/phase-04-inspector-button-and-verification.md`

Every phase starts by reading `PRD.md` in full — it holds the verified
feasibility grounding (§2), the exact file:line change sites, and the
decisions (D-1..D-9) each phase implements. Phase docs cite PRD sections
rather than repeating them.

## Phase 1 — Backend: dedup `constructions` map

Implements PRD §2, §5 (D-2, D-3), §6, §10.1. Purely additive; no
migration/versioning (D-9 — prod is empty, nothing to re-extract).

Add a recursive `ConstructionMaterial` schema (`identifier`, optional
`display_name`, `thickness`, `conductivity`, `properties.ph` = `ph_color`
+ `divisions` with `cells[].material`) and a `DetailedOpaqueConstruction`
schema. Add a top-level `constructions: dict[str,
DetailedOpaqueConstruction]` to `CombinedModelDataSchema`; in
`_faces_from_model` (`extraction.py:133`) insert each unique construction
once (keyed by identifier), keeping materials-presence as the AirBoundary
opaque tripwire (`honeybee_energy.py:28`) and leaving the per-face
construction as today's thin summary. Extraction still just calls
`.to_dict()` — no new parse logic, only a richer target schema.

**Verify:** promote the feasibility spike to pytest with a committed
*synthetic* fixture of the three construction kinds (flat / hybrid /
steel-stud) — no heavy/licensed HBJSON in this public repo; assert the
map dedups by identifier and `ph_color` / `divisions.cells` /
`steel_stud_spacing_mm` survive. `uv run ty check`; record the Hillandale
artifact-size delta in STATUS. Backend-only; independently mergeable.

## Phase 2 — Frontend: types + honeybee-construction → layer geometry adapter

Implements PRD §4.3, §5 (D-5), §6. Add the recursive `ConstructionMaterial`
type, the `DetailedOpaqueConstruction` type, and the top-level
`constructions` map on `CombinedModelData`
(`frontend/src/features/model_viewer/types.ts`). Write a pure adapter:
detailed construction → an ordered list of `{ thickness, color, label,
lambda, rValue, cells: [{ widthFraction, color, label, lambda,
steelStudSpacingMm }] }`, where a flat layer is the single-full-width-cell
degenerate case (D-5). The modal will resolve its construction via
`constructions[face…construction.identifier]` (D-2). Reuse the Envelope
geometry *shape* (`buildAssemblyCanvasGeometry`) as the reference,
reimplemented against the honeybee shape — no Envelope import (D-4, D-8).

**Verify:** Vitest for the adapter (flat = 1 cell; hybrid = N cells whose
widths sum to 1; steel-stud flag surfaced; null-color fallback) and the
per-layer R math. Type-only + pure-function; no UI yet. `tsc -b`.

## Phase 3 — Frontend: the modal (drawing + table)

Implements PRD §4.2-§4.5, §5 (D-4, D-6, D-7). Build
`ConstructionDetailModal` on `shared/ui/ModalDialog`: header (name, type,
total thickness, U/R via existing formatters), the SVG layer-stack
(exterior→interior, thickness-scaled, color-filled, segment sub-cells,
steel-stud marker + spacing), and the expandable layer table with totals.
Wire the IP/SI toggle (`useUnitPreference` + `formatLengthFromMm` /
`formatConductivityFromWmK` / `formatRValueFromM2KPerW`). Handle empty
states (§4.5).

**Verify:** Vitest/RTL for the table rows + totals + expand; snapshot or
structural test for the SVG cell counts on flat vs framed inputs.
`make format`.

## Phase 4 — Frontend: inspector button + wiring + full verification

Implements PRD §4.1, §7, §8. Add the "View Assembly" button to the
Opaque Surface *Construction* section (`components/InspectorPanel.tsx` /
`lib/fieldConfigs.ts`), shown only for `faceMesh` metas with ≥1 layer
(D-1). Manage modal open/close state, Escape/focus return, selection
preservation. Resolve PRD §13-Q1 (orientation) and §13-Q3 (label) with
Ed.

**Verify:** Playwright — flat face and framed face open the modal with
correct layer/segment counts and steel-stud annotation; window face has
no button; Escape/Close preserve selection. `$ simplify`, `$ docs-pass`,
`make format`, `make ci`, browser walkthrough with screenshots (flat +
detailed), `graphify update .`. Fold accepted decisions back into
`context/` if any land there.

## Sequencing notes

- Phase 1 is backend-only and independently mergeable; land it first so
  the data exists.
- Phases 2→3→4 are strictly ordered (types feed the adapter, the adapter
  feeds the modal, the modal feeds the button).
- Window/aperture support and any Envelope cross-reference are **not**
  phases here — they are deferred scope (PRD §12).
