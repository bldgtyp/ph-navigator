---
DATE: 2026-07-01
TIME: -
STATUS: Implemented on branch — ALL 4 PHASES COMPLETE (2026-07-02) on
  feature/model-viewer-construction-detail; all gates green; merge to
  main (and the D-9 deploy DB reset) = Ed's call. ARCHIVED.
AUTHOR: Claude (for Ed)
SCOPE: Current state, next step, and evidence for the Model tab detailed
  construction viewer feature.
RELATED:
  - PRD.md, PLAN.md, README.md
---

# STATUS — Detailed Construction Viewer

## Phase progress

- **Phase 1 — Backend constructions map: ✅ DONE (2026-07-01).**
  `honeybee_energy.py` widened (recursive `ConstructionMaterialSchema`,
  `DetailedOpaqueConstructionSchema`, thin `FaceConstructionSummarySchema`);
  `CombinedModelDataSchema.constructions` map added; `_faces_from_model`
  dedups by identifier and assigns faces the thin summary. Verified by
  `backend/tests/test_model_viewer_constructions.py` (synthetic
  API-built fixture, full Model→HBJSON→parse→extract path; 6 tests) +
  all existing model_viewer suites green + `uv run ty check` clean.
  - **Q1 RESOLVED:** honeybee `OpaqueConstruction.materials` docstring
    states "outside to inside" — `materials[0]` is exterior. Asserted in
    the new test.
  - **Q2 size delta (canonical fixture; Hillandale absent locally):**
    old schema 121,135 B raw / 9,230 B gzip → new 111,748 B raw /
    9,063 B gzip. The dedup map *shrinks* the artifact (per-face
    materials removed outweigh the added map).
- **Phase 2 — Frontend types + adapter: ✅ DONE (2026-07-01).**
  `types.ts` gains `PhColor` / `MaterialDivisions` / recursive
  `ConstructionMaterial` / `DetailedOpaqueConstruction` (intersection on
  the summary type) + optional `constructions` map on
  `CombinedModelData`; loader threads it onto `BuildingModel`;
  `lib/constructionLayers.ts` is the pure adapter (flat = single-cell
  degenerate case, D-5; cells carry x/y/width/height fractions so the SVG
  stays dumb). 11 Vitest cases; `tsc -b` green. See phase-02 §7 as-built
  notes.
- **Phase 3 — Modal (drawing + table): ✅ DONE (2026-07-01).**
  `ConstructionDetailModal` + `ConstructionStackSvg` + 
  `ConstructionLayerTable`: stat-tile header, to-scale sticky section
  drawing with hover↔row linking and steel-stud hatch, expandable layer
  schedule (framed layers open by default) with segmented swatches and
  totals. 10 RTL cases; `tsc -b` green. See phase-03 §7 as-built notes.
- **Phase 4 — Inspector button + verification: ✅ DONE (2026-07-02).**
  "View Construction" button (full-width row under the inspector
  sections, `faceMesh` only) opens the modal from the stage-passed
  `constructions` map; Escape/Close preserve the 3D selection (ModalDialog
  now consumes its Escape; viewer hotkeys guarded behind modals); focus
  returns to the button. E2e spec + 12 RTL cases + `make ci` green;
  screenshots in `assets/`. See phase-04 §7 as-built notes (incl. the
  React-synchronous-unmount Escape gotcha).

## Acceptance walk (PRD §7) — all 11 pass, 2026-07-02

1. ✅ Opaque face shows the working button; window selection does not
   (e2e: `model-viewer-construction-detail.spec.ts`).
2. ✅ Flat construction draws to scale with correct table + totals
   (e2e + RTL; `assets/modal-flat.png`).
3. ✅ Framed construction draws segment sub-cells (3-cell
   cellulose/wood-stud, `assets/modal-framed.png`) and steel-stud spacing
   annotated (406.4 mm o.c., `assets/modal-steel-stud.png`) — RTL +
   browser walkthrough on a synthetic honeybee-ph model.
4. ✅ Exterior/Interior labels correct — Q1 resolved (honeybee
   "outside to inside"), asserted in backend test.
5. ✅ Thickness/λ/R track the IP/SI toggle (RTL flip test + e2e).
6. ✅ Σ layers R reconciles with header R-Value within rounding
   (RTL totals test; screenshots show 6.3 ↔ 6.3).
7. ✅ Escape and Close dismiss; 3D selection preserved (e2e asserts
   `selectionId` unchanged); focus returns to the button.
8. ✅ No layer detail → button hidden / empty-state message (RTL +
   `detailedConstructionForMeta` guard).
9. ✅ No Envelope data or code imported by model_viewer (D-8) — drawing
   pattern reimplemented locally; grep-verified no `features/envelope`
   import.
10. ✅ `make ci` green (backend + frontend); size delta recorded
    (canonical fixture −8%; Hillandale fixture absent locally).
11. ✅ New extractions carry the map (backend tests); stale artifacts
    degrade to no-button (optional wire field + guard), no migration
    (D-9).

## Current state

`Active` (planning). PRD and a phased plan are drafted. Feasibility is
**verified**, not assumed (PRD §2):

- Ed's sample `project_2540_assemblies.json` confirms the HBJSON carries
  full layer + segment + color data (thickness, conductivity, inline
  `ph_color`, `divisions.cells`, `steel_stud_spacing_mm`).
- A spike (`OpaqueConstruction.from_dict(d).to_dict()` under honeybee-ph,
  the existing backend dep) confirmed that data round-trips losslessly
  for all three kinds: flat, hybrid (5-cell framed layers), and
  steel-stud (406.4 mm spacing preserved).
- Root cause of "why isn't it visible" pinned to one place: the
  model_viewer `EnergyMaterialSchema` (`honeybee_energy.py:14-25`) is a
  flat mirror with no `identifier`/`properties`, so Pydantic drops the
  layer detail at extraction. Everything downstream mirrors that gap.

Difficulty verdict: **moderate, low-risk** — additive backend schema +
frontend types + a read-only modal reusing the Envelope drawing pattern.
"Handle flat and detailed both" reduces to one rule (`divisions.cells`
populated?), not two code paths.

## Confirmed by Ed (2026-07-01)

- **D-1** — opaque assembly surfaces only, not windows.
- **D-8** — fully isolated, strictly view-only: HBJSON is read-only in
  the app; no import of its materials into the catalog; no migration of
  any item from this view into the Envelope/assembly builder pages; no
  Envelope code imported by the model_viewer feature.
- **D-2** — delivery is a **deduplicated top-level `constructions` map**
  keyed by identifier; faces keep their thin summary and look up detail
  by `construction.identifier`. Cleaner/leaner than per-face embedding;
  chosen deliberately despite slightly more code. Internal plumbing only
  — invisible to the user, orthogonal to D-8 isolation.
- **D-9** — *revised after confirming the one-day-old prod has no
  projects.* **No migration, no versioning** for v1: with no cached
  artifacts to migrate, the `constructions` map just appears on every
  extraction going forward. Instead, **⚠️ do a DB reset/restart on the
  deploy** (see reminder below). Artifact versioning is **deferred**
  (PRD §12) to the next extraction-schema change that ships against real
  project data. Phase 1 is now purely additive schema work.

## ⚠️ Deploy reminder — DB reset (don't forget)

When Phase 1 ships to production, **reset/restart the deploy's DB** while
it is still empty. This is the clean-slate step we chose *in place of* a
migration (D-9): it clears any stray test project and guarantees every
`model_data` artifact is (re)extracted with the new `constructions`
schema. It is trivial and safe **only because prod has no real projects
yet** — the moment real project data lands, this option is gone and
artifact versioning (PRD §12) becomes the required path. Do not let Phase
1 reach production without either the reset or (later) versioning.
- **Q3 label** — the button reads "View Construction".

## Next step

Start **Phase 4** (`phases/phase-04-inspector-button-and-verification.md`):
the "View Construction" inspector button, open/close wiring, Playwright +
browser walkthrough, and feature closeout. Phases 1-3 are done (see Phase
progress above + per-phase as-built notes); Q1 (orientation) is resolved —
`materials[0]` is exterior.

## Blockers

None. The one hard dependency (data availability) is resolved.

## Verification evidence

- Feasibility spike: 2026-07-01, run via `uv run python` from `backend/`
  against `~/Desktop/project_2540_assemblies.json`. Output recorded in
  the originating session (three constructions round-tripped; cells and
  steel-stud spacing preserved). To be promoted to a committed backend
  test with a synthetic fixture in Phase 1 (no heavy/licensed HBJSON in
  this public repo).
