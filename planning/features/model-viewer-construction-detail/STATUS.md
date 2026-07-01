---
DATE: 2026-07-01
TIME: -
STATUS: Draft — PRD authored from a verified feasibility spike; awaiting
  Ed's review. No implementation started.
AUTHOR: Claude (for Ed)
SCOPE: Current state, next step, and evidence for the Model tab detailed
  construction viewer feature.
RELATED:
  - PRD.md, PLAN.md, README.md
---

# STATUS — Detailed Construction Viewer

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

All product decisions are settled and four phased handoff docs are
authored under `phases/`. Start **Phase 1**
(`phases/phase-01-backend-constructions-map.md`): the deduplicated
`constructions` map + widened material schema — additive, no migration
(D-9), independently mergeable.

Carried into Phase 1 as a *verification* (not a decision): **Q1
(orientation)** — confirm honeybee exterior→interior layer order before
Phase 4 labels the drawing.

On acceptance, author the `phases/` handoff docs (mirroring the MEP
feature) and start Phase 1 (backend schema widening).

## Blockers

None. The one hard dependency (data availability) is resolved.

## Verification evidence

- Feasibility spike: 2026-07-01, run via `uv run python` from `backend/`
  against `~/Desktop/project_2540_assemblies.json`. Output recorded in
  the originating session (three constructions round-tripped; cells and
  steel-stud spacing preserved). To be promoted to a committed backend
  test with a synthetic fixture in Phase 1 (no heavy/licensed HBJSON in
  this public repo).
