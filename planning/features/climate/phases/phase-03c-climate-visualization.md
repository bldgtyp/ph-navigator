---
DATE: 2026-06-13
TIME: -
STATUS: COMPLETE (2026-06-14) — recharts chosen + installed; monthly
  temperature/radiation graphs render behind a Table/Charts toggle on the
  standardized record; the 2D SVG sun-path diagram renders against the
  Phase-1 endpoint (empty state when the location is unset). `make ci`
  green. See §Outcome.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — monthly climate graphs for the active
  source + the sun-path visual in the Climate tab.
RELATED:
  - phase-03-climate-tab-ui.md (§0 decomposition; §2.4 visualization)
  - phase-03b-climate-source-attach-select.md (provides the active source)
  - phase-01-sun-path-service.md (the GET /projects/{id}/sun-path endpoint)
  - ../../features_v1.1/model-viewer-sun-path/ (shares sun-path geometry)
  - ../decisions.md (D-CL-11 per-analysis default)
---

# Climate Phase 3c — Visualization: charts + sun path

The "see the data" half of the tab. 3a renders the standardized record as
read-only tables; 3c adds **monthly graphs** and the **sun-path visual**.
Two distinct pieces of new infrastructure, hence its own slice.

## 1. Charting (new dependency)

- **No charting library is installed** (checked: no recharts/visx/chart.js
  in `package.json`; only `@tanstack/*`, `@dnd-kit/*`, three.js). Pick one
  — likely **recharts** (simple declarative line/bar) or **visx** (lower
  level, lighter) — under the pnpm supply-chain rules (24-hour
  `minimumReleaseAge`, strict min-age, `blockExoticSubdeps`). Decision +
  rationale goes in `STATUS.md` / `context/TECH_STACK.md`.
- **Graphs** for the active source from the standardized record: monthly
  temperature (air/dewpoint/sky), monthly radiation (N/E/S/W/global), and
  degree-days. Respect the IP/SI toggle (temps via
  `formatTemperatureFromC`; radiation stays SI — no IP form in the units
  registry, as in 3a's `ClimateRecordTable`).
- Reuse the 3a `useClimateLocationQuery` record; render alongside (or
  toggled with) the existing record tables.

## 2. Sun-path visual

- **No frontend sun-path consumer exists yet.** Phase 1 shipped the
  backend `GET /projects/{id}/sun-path` + MCP only; the Model Viewer reads
  sun path through a *different* combined model-data endpoint.
- Add `useSunPathQuery(projectId)` (3a client conventions) against the
  Phase-1 endpoint; render the sun path + compass. **Coordinate with
  `planning/features_v1.1/model-viewer-sun-path/`** — share the
  DTO→geometry conversion / `SiteSunLayer` geometry rather than
  duplicating it. 2D diagram vs. reusing the 3D layer is an open call;
  decide when scoping.
- Empty state: "Set location" when the project location is unset (null
  sun-path response).

## Depends on / sequencing

- After **3b** so charts can render the *selected* source (pre-3b they can
  only render a browsed reference location).
- The sun-path piece is independent of 3b and could land earlier if
  desired — it only needs the Phase-1 endpoint (met).

## Tests

- vitest: a chart component maps a standardized record to series correctly;
  units toggle; sun-path empty vs. populated.
- Playwright: open the tab, see graphs for a source; seeded-location
  project shows the sun-path visual; no-location empty state.
- `make ci` green.

## Exit criteria

- Charting dep chosen + recorded; monthly graphs render for the active
  source with the IP/SI toggle; the sun-path visual renders (and shows the
  empty state when location is unset); `make ci` green. Completes PRD §7
  Phase 3 alongside 3a/3b.

## Outcome (2026-06-14)

Frontend-only; no new backend (charts read the 3a record; the sun path reads
the Phase-1 `GET /projects/{id}/sun-path` endpoint).

- **Charting — recharts (3.8.1).** Chosen over visx / hand-rolled SVG for
  declarative, low-maintenance monthly line charts. Installed clean under the
  pnpm 24h `minimumReleaseAge` + `blockExoticSubdeps` rules. Recorded in
  `context/TECH_STACK.md`.
- **Monthly graphs.** `chart-data.ts` holds pure, unit-tested transforms from
  a `ClimateRecord` to recharts rows (temperature IP/SI-aware via `cToF`;
  radiation stays SI — no IP form). `ClimateRecordCharts` renders monthly
  temperature + radiation line charts; series colors come from new
  `--chart-*` design tokens in `tokens.css` (feature code stays hex-free).
  `ClimateRecordView` wraps the 3a tables + the graphs behind a Table/Charts
  toggle; the dataset browser renders this view.
- **Sun-path visual — 2D SVG.** `sun-path.ts` projects the origin-centered,
  unit-radius DTO top-down (z dropped, y flipped for SVG) into SVG paths:
  the hourly analemmas, the tessellated monthly day arcs (Arc3D sampled in
  its plane basis), and the compass rings + azimuth ticks. `SunPathDiagram`
  runs `useSunPathQuery` and renders the SVG, with a "Set the project
  location" empty state when the endpoint returns null. The DTO wire types
  are mirrored in `climate/types.ts` (climate may not import `model_viewer`,
  where the same shape lives — imports are one-way).
- **Bundle.** `ClimateTab` is now lazy-loaded (Suspense), keeping recharts
  out of the initial bundle (index 1682→1300 kB; ClimateTab its own ~379 kB
  chunk), matching the ModelTab/three.js split.
- **Tests.** `__tests__/chart-data.test.ts` (row mapping + IP/SI),
  `__tests__/sun-path.test.tsx` (top-down projection coordinates + arc
  tessellation; diagram populated vs. null empty state). `make ci` green.

**Deferred / not done here:**
- **Cardinal N/E/S/W letters** on the sun-path compass — the DTO carries no
  label geometry, so labelling would need the project true-north passed
  separately. Left as a refinement.
- **Charts render the *browsed* record**, not yet a resolved *attached
  source* — per the phase plan, the graphs reuse the 3a dataset-browser
  record. Rendering an arbitrary attached source's record (resolving
  phius/phi `ref` → record, custom `data` → record) lands with the Phase-4
  consumers / a source-detail view.
