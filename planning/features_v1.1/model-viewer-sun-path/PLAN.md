---
DATE: 2026-06-13
TIME: -
STATUS: Active — implementation sequence.
AUTHOR: Claude (for Ed)
SCOPE: Phase sequence and build order for the sun-path feature.
RELATED:
  - PRD.md
  - decisions.md
  - phases/phase-01-static-sun-path.md
  - phases/phase-02-scrubber.md
---

# Sun Path — PLAN (frontend render; backend is Climate Phase 1)

> **Realigned 2026-06-13.** The backend builder + `sun-path` endpoint
> moved to Climate Phase 1 (`planning/archive/climate/`). This plan now
> covers only the Model Viewer frontend render, which **depends on
> Climate Phase 1**.

## Sequence

| Phase | Scope | Gate to start | Ships |
|---|---|---|---|
| 1 — Site & Sun 3D render | Frontend query + renderer completion (arcs + compass) + bounds-fit | **Climate Phase 1 merged** (endpoint exists); D-SP-1 accepted | The annual sun path drawn over the building in Site & Sun |
| 2 — Scrubber | Time/season interaction over the rendered diagram | Phase 1 merged **and** a concrete time/season review need exists (Q-VIEW-6) | Deferred sub-feature; do not start speculatively |

Phase 1 is now a focused frontend pass: the renderer scaffold already
exists; this points it at the Climate endpoint and completes it.

## Build order within Phase 1 (frontend)

1. **Query.** `useSunPathQuery(projectId)` against the Climate
   `GET /projects/{id}/sun-path` endpoint; complete the
   `SunPathAndCompass` DTO type in `types.ts` (incl. the `compass`
   branch).
2. **Renderer.** Complete `SiteSunLayer` (monthly arcs + compass, not
   just analemmas), wire the query result as the lens's `sunPath`, fit
   to `model.bounds`, flip the location-hint condition.
3. **Tests + closeout.** vitest (renderer DTO mapping + bounds-fit),
   Playwright (lens with seeded location), then `make format` +
   `make ci`.

The backend builder + endpoint + its pytest (incl. the north-sign
fixture) live in Climate Phase 1 — not here.

## Risks / watch-items

- **North sign (D-PL-4)** — handled in Climate Phase 1 (backend fixture
  test). This feature trusts the endpoint; a wrong sign shows up as a
  rotated diagram in the lens during the Playwright walkthrough.
- **Diagram scale** — do not hardcode V1's radius 40; fit to bounds or
  the 52 MB multifamily model will dwarf the diagram. The Climate
  endpoint returns unit-radius geometry; this feature scales it.
- **`frameloop="demand"`** — the sun-path query resolving must
  `invalidate()` the canvas so the diagram paints without a manual
  camera nudge (the existing lens-fade/loader code shows the pattern).
- **Serving strategy is settled** — D-SP-1 accepted the decoupled
  endpoint, now owned by Climate (D-CL-2). The rejected
  bake-into-artifact alternative is recorded in `decisions.md` for
  context only.
