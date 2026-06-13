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

# Sun Path — PLAN

## Sequence

| Phase | Scope | Gate to start | Ships |
|---|---|---|---|
| 1 — Static sun path | Backend `sun-path` endpoint + builder + MCP; frontend query + renderer completion + bounds-fit | None — D-SP-1 accepted | The whole declared Site & Sun sun path (annual envelope) |
| 2 — Scrubber | Time/season interaction over the rendered diagram | Phase 1 merged **and** a concrete time/season review need exists (Q-VIEW-6) | Deferred sub-feature; do not start speculatively |

Phase 1 is a single, mostly-mechanical pass: the wire schema and the
renderer scaffold already exist; this connects them and supplies the
data. Phase 2 is intentionally a separate, gated unit.

## Build order within Phase 1

1. **Backend builder (pure).** `build_sun_path(location_inputs) ->
   SunPathAndCompassDTOSchema` — ladybug `Location` + `Sunpath`, unit
   radius, origin-centered, DST off. Pure and fixture-testable first
   so the north-sign verification (D-PL-4) is nailed before any
   plumbing.
2. **Backend route + service + MCP.** `GET …/sun-path` reading
   `project_location` in-process; null when unset.
3. **Frontend query.** `useSunPathQuery(projectId)` + DTO type
   completion in `types.ts`.
4. **Frontend renderer.** Complete `SiteSunLayer` (arcs + compass),
   wire the query result as the lens's `sunPath`, fit to `model.bounds`,
   flip the location-hint condition.
5. **Tests + closeout.** pytest (builder + route, incl. null + north
   sign), vitest (renderer DTO mapping + bounds-fit), Playwright
   (lens with seeded location), then `make format` + `make ci`.

## Risks / watch-items

- **North sign (D-PL-4)** — the most likely defect. Lock it with a
  fixture before trusting visuals. Phase-01 §4.
- **Diagram scale** — do not hardcode V1's radius 40; fit to bounds or
  the 52 MB multifamily model will dwarf the diagram.
- **`frameloop="demand"`** — the sun-path query resolving must
  `invalidate()` the canvas so the diagram paints without a manual
  camera nudge (the existing lens-fade/loader code shows the pattern).
- **Serving strategy is settled** — D-SP-1 accepted the decoupled
  endpoint (Option A); the steps above are the path. The rejected
  bake-into-artifact alternative (Option B) is recorded in
  `decisions.md` for context only.
