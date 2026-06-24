---
DATE: 2026-06-23
TIME: -
STATUS: COMPLETE — Phases 0 + 1 shipped 2026-06-23 (merged, archived).
  Phase 2 (scrubber) deferred. Sequence retained as the build record.
AUTHOR: Claude (for Ed)
SCOPE: Phase sequence and build order for the sun-path feature.
RELATED:
  - PRD.md
  - decisions.md
  - phases/phase-00-backend-sun-path-service.md
  - phases/phase-01-static-sun-path.md
  - phases/phase-02-scrubber.md
---

# Sun Path — PLAN

> **Rebaselined 2026-06-23.** The backend builder + `/sun-path` endpoint
> were built (2026-06-13) and then deleted (2026-06-22). This plan now
> covers **rebuilding the backend** (Phase 0) and then the **frontend
> render** (Phase 1). See `STATUS.md` for the history trace.

## Sequence

| Phase | Scope | Gate to start | Ships |
|---|---|---|---|
| 0 — Backend sun-path service | Rebuild `sun_path.py` builder, `service.get_project_sun_path`, `GET /projects/{id}/sun-path`, MCP tool, north-sign fixture — in `project_location` | Location data exists (met); D-SP-1 accepted | A project-scoped, location-reactive endpoint returning `SunPathAndCompassDTOSchema \| null` |
| 1 — Site & Sun 3D render | Frontend query + renderer completion (arcs + compass) + bounds-fit | **Phase 0 merged** (endpoint exists) | The annual sun path drawn over the building in Site & Sun |
| 2 — Scrubber | Time/season interaction over the rendered diagram | Phase 1 merged **and** a concrete time/season review need exists (Q-VIEW-6) | Deferred sub-feature; do not start speculatively |

Phase 0 is largely a faithful restore of commit `005839dc`, re-verified
against today's `project_location` repository and schemas. Phase 1 is a
focused frontend pass: the renderer scaffold already exists; this points
it at the rebuilt endpoint and completes it.

## Build order within Phase 0 (backend, `project_location`)

1. **Builder.** `sun_path.py`: `build_sun_path(...)` (pure ladybug,
   unit radius, origin-centered, DST off) + `utc_offset_hours(...)`.
   Imports the surviving DTOs from `model_viewer.schemas.ladybug` /
   `ladybug_geometry`.
2. **Service.** `service.get_project_sun_path(project_id)` reads
   `repository.get_location(...)`, returns `None` when there is no row
   or `latitude`/`longitude` are unset; neutral defaults for the rest.
3. **Route.** `GET /api/v1/projects/{project_id}/sun-path` →
   `SunPathAndCompassDTOSchema | null`, view-access gated,
   `Cache-Control: private, max-age=0` (location is editable).
4. **MCP.** `tool_get_project_sun_path` + register in `mcp/tools.py` and
   `mcp/server.py`.
5. **Tests.** `tests/test_project_location_sun_path.py` — builder output,
   the **true-north sign fixture** (D-PL-4, load-bearing), UTC-offset
   handling, route null/diagram cases, MCP parity + scope. Focused
   pytest green.

## Build order within Phase 1 (frontend, `model_viewer`)

1. **Query.** `useSunPathQuery(projectId)` against the Phase 0 endpoint;
   complete the `SunPathAndCompassModelData` type in `types.ts` (incl.
   the `compass` branch). Project-scoped key; normal cache lifecycle
   (NOT `staleTime: Infinity` — location can change). `null` is valid.
2. **Renderer.** Complete `scene/SiteSunLayer.tsx` (monthly arcs +
   compass, not just analemmas), consume the query result as the lens's
   `sunPath`, fit to `model.bounds`, flip the location-hint condition.
3. **Tests + closeout.** vitest (renderer DTO mapping + bounds-fit math),
   Playwright (lens with seeded location), then `make format` + `make ci`.

## Risks / watch-items

- **North sign (D-PL-4)** — the single most likely defect; a wrong sign
  silently rotates the diagram. Locked by the Phase 0 north-sign fixture
  (with `true_north_deg = 90` the compass North tick lands on −X). Phase
  1 confirms it visually in the lens.
- **Diagram scale** — do not hardcode V1's radius 40; the backend emits
  **unit-radius / origin-centered** geometry and the frontend uniformly
  scales + translates it to `model.bounds`, or the 52 MB multifamily
  model will dwarf the diagram. Uniform scale + translate preserves the
  true-north rotation.
- **`frameloop="demand"`** — the sun-path query resolving must
  `invalidate()` the canvas so the diagram paints without a manual
  camera nudge (the existing lens-fade/loader code shows the pattern).
- **Serving strategy is settled** — D-SP-1 accepted the decoupled
  endpoint. The rejected bake-into-artifact alternative is recorded in
  `decisions.md` for context only.
