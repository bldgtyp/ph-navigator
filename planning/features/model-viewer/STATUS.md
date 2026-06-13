---
DATE: 2026-06-12
TIME: -
STATUS: Active — Phases 1–5 implemented; Phase 6 in review
AUTHOR: Claude (for Ed)
SCOPE: Status ledger for the Model Viewer feature.
RELATED: planning/features/model-viewer/README.md
---

# Model Viewer — Status

## Current state

`Active — implementing.` Feature folder authored 2026-06-12: PRD,
UI_SPEC (redesigned non-CAD composition), decisions ledger, 6-phase
plan. **Phase 1 (HBJSON file management) implemented 2026-06-12**;
**Phase 2 (extraction backend) implemented 2026-06-12** — honeybee
deps in, `/model_data` artifact pipeline live (details below).
**Phase 3 (viewer core) implemented and verified 2026-06-13** —
three/R3F deps added, Building lens renders real `/model_data`, and
`make format` + `make ci` passed in that session.
**Phase 4 (remaining lenses) implemented 2026-06-13** — lens bar,
Spaces, Floor Areas, Ventilation, Hot Water, deep links, and the
remaining inspector configs are live. **Phase 5 (themes + legend)
implemented 2026-06-13** — color themes, `&theme=`, legend counts,
mini-keys, and scene-info popover are live. **Phase 6 (Measure, Site
& Sun, polish) implementation started 2026-06-13 and is in review** —
measure mode, Site & Sun enablement, shade renderables, keyboard map,
and e2e specs are implemented; closeout gates are pending below.

Test fixtures (both in this folder, both copied to
`backend/tests/fixtures/` in Phase 2; coverage maps + remaining
synthetic-only gaps in PLAN.md):
- `ph_nav_v2_example.hbjson` (459 KB, Ed 2026-06-12) — primary
  canonical fixture. (Supersedes `my_example_project.hbjson`.)
- `Hillandale_Gateway_NAR_260402.hbjson` (51.99 MB, Ed 2026-06-12,
  review round 3) — scale fixture and D-15 perf canary: 583 rooms,
  6,178 faces, 1,024 apertures, 71 named constructions, 253 shades
  → 1 merged group, units **Inches**. Its size triggered D-17
  (100 MB cap).

Pre-existing groundwork already on main:
- `project_assets` backbone supports `asset_kind='hbjson'`
  (`backend/features/assets/registry.py`).
- Behavior contract complete in
  `context/user-stories/40-model-viewer.md` (all Q-VIEWs resolved).
- V1 reference complete in `research/v1-3d-model-viewer-reference.md`.

2026-06-12: V1 frontend parity audit completed from V1 source
(`reviews/2026-06-12-v1-parity-audit.md`) — full capability parity
confirmed; 3 findings folded back.

2026-06-12 (Ed review round 2): **D-02..D-12 confirmed by Ed.** All
decisions now accepted; none open. Same-pass docs sync completed:
`decisions.md` marked accepted; PRD/UI_SPEC/README status flipped;
`context/user-stories/40-model-viewer.md` gained a "V2 composition
amendments — accepted 2026-06-12" block and the amended US-VIEW-6
crit. 7 + crit. 5 construction rows (D-12); `context/UI_UX.md` §2.9
now points at UI_SPEC.md and UX-Q9 is resolved (D-05);
`context/GLOSSARY.md` gained the "Thermal performance" section
("-Factor = with films, -Value = without"; the section US-VIEW-6
cited had never actually been created — it exists now).

2026-06-12 (phase handoffs): detailed implementation plans for all
six phases authored under `phases/` (phase-01 … phase-06). Each is a
self-contained subagent handoff: required reading, work breakdown
with file paths, contracts, fixture golden counts, verification
gates, exit criteria. Notable corrections baked in from codebase
verification: `users.id` and `projects.id` are UUID and
`project_assets.id` is TEXT (US-VIEW-1's DDL sketch said INTEGER /
implied UUID — phase-01 §3.1 records the corrected column types);
the `model` tab already exists as a placeholder in `PROJECT_TABS`;
the asset upload-intent flow already captures `content_hash_sha256`
(dedup enforced at the hbjson-files link step); zustand ^5.0.2 is
already a frontend dep, three/R3F are not (added in Phase 3).

2026-06-12 (Ed review round 1): OQ-1 resolved — project location
becomes its own deferred feature
(`planning/features/project-location/`, requirements stub written);
Site & Sun sun path blocked on it. OQ-2 resolved → D-13 (schema
Phase 1, job Phase 2, Airtightness consumer marked FUTURE). OQ-4
researched (LBT forum #11790 + honeybee-energy source) → D-12
proposed: LBT-verbatim terminology, show U-Factor (films incl.) AND
U-Value (films excl.) rows. OQ-3 resolved → D-14: selection uses the
BLDGTYP branding `--highlight` token family (already loaded app-wide
from bldgtyp.github.io/bt-branding). No open questions remain.

2026-06-12 (review round 3 — plan-readiness critique): a
completeness review surfaced three decision items; Ed accepted all
three same-day, plus one follow-on:
- **D-15** `/model_data` precomputed at upload, served as an
  immutable R2 artifact (amends US-VIEW-7 crit. 9 — the prior
  "re-parse per request" plan had conflated caching the raw bytes
  with caching the derived payload).
- **D-16** broken-file lifecycle: "Failed to parse" badge driven by
  `extraction_status` + permanent/transient error taxonomy on
  `/model_data` (Retry is transient-only).
- **Scale fixture pulled forward**: Ed provided
  `Hillandale_Gateway_NAR_260402.hbjson` (51.99 MB multifamily);
  exercised from Phase 2 on, not deferred to Phase 6 acceptance.
- **D-17** upload cap 50 → 100 MB (the fixture itself exceeded the
  old cap).
Same-pass docs sync: decisions.md (D-15/D-16/D-17), PRD (§2 matrix,
§3, new §4.6, §5, §7, §8), UI_SPEC (§2 badge + cap, §8 typed
errors), PLAN (Phases 1–3 + fixture section), phase-01/02/03/06
handoffs, and `context/user-stories/40-model-viewer.md` (amendments
block + crit. 3 cap + crit. 9 in place). The round-3 editorial
items (implementer-level, no decision needed) were applied same-day:
`window.__phnModelViewer` scene-ready test-hook contract defined in
phase-03 §4.8 and referenced from phases 4–5; WebGL/SwiftShader CI
caveat (phase-03 §6.2); GPU-memory/disposal acceptance check
(phase-03 §4.9); dedup made race-proof via a denormalized
`content_hash_sha256` column + partial unique index (phase-01
§3.1/§3.3); phase-04 §1 Site & Sun goal paragraph rewritten to
state the §3.1 rule plainly; drei Z-up caveat broadened to all
scene helpers (phase-03 §4.1).

## Next step

Complete Phase 6 verification and closeout — handoff doc:
`phases/phase-06-measure-site-sun-polish.md` (Measure, Site & Sun
polish, keyboard/a11y polish).

## Phase 6 — in review 2026-06-13

Frontend MVP closeout work landed so far:

- Measure state/lifecycle: store now tracks active Measure mode, snap
  target, pending point, and accumulated dimension lines. Entering
  Measure clears hover/selection; exit/file switch/lens switch clear
  all measurement artifacts.
- Measure rendering: canvas-scoped drei `<Html>` pill labels, nearest
  face-corner snap by screen-space projection within the 20 px target,
  snap marker, two-click dimension line, and unit-aware labels
  (`m` / feet-inches) backed by `lib/measure.ts`.
- Site & Sun: segment is enabled when building geometry exists; the
  lens reuses selectable building faces/apertures, renders merged
  shade groups as flat grey non-selectable meshes, adds a small north
  marker, keeps sun-path rendering keyed behind `sun_path != null`,
  and shows the D-07 location hint while `sun_path` is null.
- Keyboard/a11y: `1`–`6`, `F`, `H`, `M`, Esc cascade
  (Measure → selection → popovers), and `Cmd/Ctrl+C` with selection
  are wired. The canvas has an aria label naming active file + lens;
  icon-heavy controls gained labels/titles.
- Debug/e2e hook: exposes `measureActive`, `measureLines`,
  `measureBetweenVertices`, `shadeCount`, and `sunPathReady`; Site &
  Sun visible/selectable IDs intentionally expose building objects
  only, not shades.
- Tests added/updated: `viewerMeasure.test.ts`,
  `model-viewer-measure.spec.ts`, `model-viewer-site-sun.spec.ts`;
  existing core/lens expectations updated for enabled Site & Sun.

Focused verification run so far:
- `cd frontend && pnpm exec tsc -b --pretty false` — green.
- `cd frontend && pnpm exec vitest run
  src/features/model_viewer/__tests__/viewerCore.test.ts
  src/features/model_viewer/__tests__/viewerThemes.test.ts
  src/features/model_viewer/__tests__/viewerMeasure.test.ts
  src/lib/units/units.test.ts` — green (32 tests).
- `cd frontend && pnpm run lint` — green with the 3 known
  pre-existing aperture fast-refresh warnings.
- `cd frontend && pnpm run check:all` — green.
- `cd frontend && pnpm exec playwright test
  tests/e2e/model-viewer-files.spec.ts
  tests/e2e/model-viewer-lenses.spec.ts
  tests/e2e/model-viewer-themes.spec.ts
  tests/e2e/model-viewer-measure.spec.ts
  tests/e2e/model-viewer-site-sun.spec.ts --project=chromium` —
  green (5 specs).
- Browser walkthrough on `localhost:5173` as `codex@example.com`:
  Site & Sun deep link rendered active with the location hint and
  scene aria description; Measure toggle rendered active with hint.
  Screenshots saved to `assets/phase-06-site-sun.png` and
  `assets/phase-06-measure.png`.
- `$ simplify` completed after implementation. Follow-up fixes:
  shade groups now flatten all shades in a group; Measure reuses the
  shared feet-inches formatter; Escape popover handling is centralized;
  the debug hook mounts only in dev/test; Measure pointer snapping is
  rAF-coalesced and avoids redundant invalidations.
- `$ docs-pass` completed; no context/ADR updates were needed. The
  remaining durable tracker item is the Ed/John-coordinated John test.
- Final closeout gates completed:
  - `make format` — green.
  - `make ci` — green: backend Ruff format/lint, Ty, Alembic, pytest
    (780 passed, 2 skipped); frontend Prettier check, ESLint (3 known
    aperture fast-refresh warnings), structural checks, Vitest (1575
    passed), and production build.

Acceptance notes:
- The John test requires Ed/John coordination with a non-technical
  viewer and was not performed by the coding agent. Record the outcome
  here when coordinated.

## Phase 5 — implemented 2026-06-13

Frontend only; Phase 2/4 already shipped the required model-data DTOs
and renderable metadata:

- Theme model/URL: store now tracks `themesByLens`; switching lens
  resets to that lens's default while switching theme preserves
  selection. `&theme=` reads/writes permanent kebab-case tokens:
  `shaded`, `surface-type`, `boundary`, `construction`,
  `window-construction`, `ventilation-airflow`, `weighting-factor`.
  Invalid or inapplicable theme tokens silently fall back to the
  active lens default.
- Theme menu: attached to the right end of the lens bar only for
  Building, Spaces, and Floor Areas. Building offers Shaded, Surface
  Type, Boundary, Construction, Window Construction; Spaces offers
  Shaded and Ventilation Airflow; Floor Areas defaults to Weighting
  Factor and also offers Shaded.
- Color application: `lib/themes.ts` owns V1 static color maps,
  ventilation airflow categories, the V2 floor-weighting buckets
  (fixed `0.3` boundary), and the preserved cyrb53 + golden-ratio HSL
  construction hash. The scene uses shared unlit `MeshBasicMaterial`
  bucket colors for active themes; hover/selection still override via
  the D-14 highlight materials and deselection returns to the theme
  color.
- Legend card: bottom-left card renders non-Shaded theme legends and
  Ventilation / Hot Water mini-keys. Rows are inert buttons with
  swatch, label, and count; dynamic construction legends sort
  alphabetically; long legends scroll; collapsed state is remembered
  in session storage.
- Scene info: bottom-left info trigger is available with or without a
  legend. Popover shows file name, upload timestamp, load-summary
  counts, and extraction warnings. The ready loading-chip summary now
  flashes briefly and collapses into this popover.
- Debug/e2e hook: `window.__phnModelViewer` now exposes `theme`,
  `legend`, `setTheme`, and `themeColorForObject`.
- Tests: `viewerThemes.test.ts` covers theme-token fallback, cyrb53
  golden values, weighting bucket boundaries, ventilation airflow
  truth table, legend counts, theme reset on lens switch, and
  selection survival on theme switch. `model-viewer-themes.spec.ts`
  uploads the canonical fixture, verifies Boundary legend counts
  (Outdoors 12 / Ground 7 / Surface 6), verifies selected-face
  survival across theme changes, checks Floor Areas default Weighting
  Factor, checks Ventilation mini-key, verifies deep link
  `?file=…&lens=building&theme=boundary`, and checks legend collapse
  persistence.

Focused verification already run this session:
- `cd frontend && pnpm exec tsc -b --pretty false` — green.
- `cd frontend && pnpm exec vitest run
  src/features/model_viewer/__tests__/viewerCore.test.ts
  src/features/model_viewer/__tests__/viewerThemes.test.ts
  src/lib/units/units.test.ts` — green.
- `cd frontend && pnpm run lint` — green with 3 pre-existing
  react-refresh warnings in `features/apertures`.
- `cd frontend && pnpm run check:all` — green.
- `cd frontend && pnpm exec playwright test
  tests/e2e/model-viewer-files.spec.ts
  tests/e2e/model-viewer-lenses.spec.ts
  tests/e2e/model-viewer-themes.spec.ts --project=chromium` —
  green.
- Browser walkthrough on `localhost:5173` as `codex@example.com`:
  deep-linked Building / Boundary rendered with the attached Color:
  Boundary trigger, disabled Site & Sun segment, legend counts
  Outdoors 12 / Ground 7 / Surface 6, and scene-info popover counts
  25 surfaces / 4 spaces / 5 shade groups / 0 air boundaries skipped.
  Screenshot showed boundary swatches matching unlit mesh colors over
  the canvas.

## Phase 4 — implemented 2026-06-13

Frontend only; Phase 2 already shipped the required backend DTOs:

- Lens state/URL: `ModelViewerLens` now covers
  `building|spaces|floor-areas|site-sun|ventilation|hot-water`.
  `&lens=` reads/writes those permanent kebab-case tokens; invalid
  values default to `building`.
- Lens bar: floating top-center segmented control with lucide icons,
  one active segment, labels collapsed below ~1100 px, disabled
  states derived from built model content. **Site & Sun decision: kept
  disabled in Phase 4** with tooltip "Coming with project location";
  Phase 6 still owns project-location/sun-path completion.
- Scene sets: the Phase 3 loader was extended into a full viewer-model
  builder for Building, Spaces, Floor Areas, Ventilation, and Hot
  Water. Interior lenses render low-opacity building-edge ghost
  context. Lens switches clear selection and crossfade in 180 ms while
  keeping `<Canvas frameloop="demand">`.
- Geometry: spaces render translucent volume meshes; floor areas
  render floor segment meshes; ducts/pipes render drei `<Line>`
  world-unit thick lines. Ducts split supply blue / exhaust red from
  normalized `duct_type`; DHW distribution and synthetic recirc paths
  have distinct styles. `raycaster.params.Line2/Line` threshold is set
  for forgiving thick-line picking.
- Inspector: added `spaceGroup`, `spaceFloorSegmentMeshFace`,
  `ductSegmentLine`, and `pipeSegmentLine` configs. Pipe config
  includes all Q-VIEW-4 fields. Duct diameter/thickness are converted
  from meter wire values; DHW pipe diameter/thickness use the backend
  `*_mm` fields. Airflow wire remains m³/s and displays as m³/h (SI)
  or CFM (IP) through `formatAirflowFromM3S`.
- Debug/e2e hook: `window.__phnModelViewer` now exposes expanded
  object counts, visible IDs, `setLens`, and `selectAnyModelObject`
  for deterministic lens e2e.
- Tests: `viewerCore.test.ts` covers Phase 4 loader counts,
  availability, URL-token parsing, disabled reasons, line metadata,
  synthetic recirc, and new inspector unit formatting.
  `model-viewer-lenses.spec.ts` uploads the canonical fixture, asserts
  4 spaces / 5 floor segments / 5 duct segments / 4 pipe segments,
  switches through implemented lenses, selects space/floor/duct/pipe
  objects, verifies Duct Type/Water Temp inspector rows, asserts Site
  & Sun disabled, and verifies a direct
  `?file=…&lens=ventilation` deep link.

Focused verification already run this session:
- `cd frontend && pnpm exec tsc -b --pretty false` — green.
- `cd frontend && pnpm exec vitest run src/features/model_viewer/__tests__/viewerCore.test.ts src/lib/units/units.test.ts` — green.
- `cd frontend && pnpm run lint` — green with 3 pre-existing
  react-refresh warnings in `features/apertures`.
- `cd frontend && pnpm exec playwright test tests/e2e/model-viewer-lenses.spec.ts --project=chromium` — green.
- Browser walkthrough on `localhost:5173` as `codex@example.com`:
  deep-linked Ventilation lens rendered with file chip, load summary,
  lens toolbar, Ventilation pressed, Site & Sun disabled, and no fetch
  error. Browser screenshot capture timed out in the in-app browser;
  Playwright e2e remains the durable visual smoke evidence.
- `make format` — green.
- `make ci` — green: backend Ruff format/lint, Ty, Alembic, pytest
  (780 passed, 2 skipped); frontend Prettier, ESLint, structural
  guards, Vitest (158 files / 1564 tests), and production build. ESLint
  still reports 3 pre-existing react-refresh warnings in
  `features/apertures`.

Closeout passes completed: `$ simplify`, `$ docs-pass`, `make format`,
`make ci`, and `graphify update .`.

## Phase 3 — implemented and verified 2026-06-13

Frontend only:
- Deps: `three`, `@react-three/fiber`, `@react-three/drei`,
  `@react-three/postprocessing`, `@types/three` added with pnpm
  supply-chain protections intact. Resolution landed on React-19-
  compatible R3F v9.6.1 / drei v10.7.7.
- `/model_data` client path: `fetchModelData`, `useModelDataQuery`
  (`staleTime: Infinity`, no retry for D-16 permanent failures),
  typed DTOs in `types.ts`, and model-data cache removal when a file
  is deleted.
- Viewer state: `store.ts` now carries fixed Phase-3 `lens='building'`,
  hover/selection IDs, load/error state, and fit/home/zoom camera
  requests, with no-op guards on pointer-heavy updates. `Esc`, `F`,
  and `H` keyboard handling shipped; Measure stays Phase 6.
- Pure loader layer: `loaders/geometry.ts` and `loaders/building.ts`
  convert Phase 2 faces/apertures into `BufferGeometry` + full
  inspector metadata. This phase renders only `faceMesh` and
  `apertureMeshFace`; the same pattern is the Phase 4 extension point.
  Polygon faces are fan-triangulated defensively even though Phase 2
  currently ships triangulated meshes. Phase 4 later extended this
  loader pattern to all remaining non-Site lenses.
- R3F scene: full-bleed `<Canvas frameloop="demand">`, Z-up camera,
  OrbitControls damping, fit-on-load, Grid + ContactShadows + SMAA,
  Building lens meshes with edge lines, hover/selection materials
  from the BLDGTYP `--highlight` family, double-click / button zoom,
  Fit/Home camera buttons. Old `BufferGeometry` is disposed on file
  switch/unmount, and the canvas is keyed by file id so repeated
  HBJSON object identifiers across files cannot retain stale geometry.
- Inspector: right slide-in panel for Opaque Surface + Window configs,
  D-12 U-Factor/U-Value/R-Factor/R-Value rows, `--` missing-value
  fallback, IP/SI live formatting through existing unit helpers, Copy
  ID, and Zoom to. Field configs use typed accessors rather than
  string paths.
- Loading/error: in-canvas chip shows download/building/error states;
  transient errors show Retry, permanent parse errors do not. Scene
  ready/debug hook `window.__phnModelViewer` is dev/test-only and
  exposes load phase, object counts, lens, hover, and selection for
  e2e.
- Bundle: `ProjectTabContent` now lazy-loads `ModelTab`, keeping the
  Three/R3F stack out of the initial project-workspace route module.
- Tests: `viewerCore.test.ts` covers loader counts/geometry, drag
  tolerance, D-14 highlight fallback, and D-12 field formatting.
  `model-viewer-files.spec.ts` now waits on the scene-ready hook,
  asserts 25 face meshes / 30 aperture meshes for the primary
  fixture, selects through the dev/test-only viewer hook to open the
  inspector, and verifies `Esc` clears selection.

Focused verification already run this session:
- `cd frontend && pnpm exec tsc -b --pretty false` — green.
- `cd frontend && pnpm exec vitest run src/features/model_viewer/__tests__/viewerCore.test.ts` — green.
- `cd frontend && pnpm run lint` — green with 3 pre-existing
  react-refresh warnings in `features/apertures`.
- `cd frontend && pnpm run check:all` — green.

Closeout passes: `$ simplify` completed; `$ docs-pass` completed
(planning docs only; no stable `context/` update needed). Final
gates completed: `make format` green; `make ci` green (backend Ruff,
Ty, Alembic, 780 pytest passed / 2 skipped; frontend Prettier,
ESLint with the pre-existing aperture fast-refresh warnings only,
structural guards, 1,561 Vitest tests passed, production build
green); `cd frontend && pnpm exec playwright test
tests/e2e/model-viewer-files.spec.ts --project=chromium` green.
`graphify update .` run after the implementation docs were updated.

## Phase 2 — implemented 2026-06-12

Backend only (no frontend changes; the Phase 1 "Failed to parse"
badge is now live data):

- Deps: `uv add honeybee-ph ladybug-core` resolved cleanly
  (honeybee-core 1.64.47, honeybee-energy 1.121.2, honeybee-ph
  1.33.19, honeybee-schema 2.0.7, ladybug-core 0.44.49).
- `backend/features/model_viewer/schemas/` — V1 schema port, split by
  source library (8 modules), Pydantic v2. Wire deltas vs. V1: m³/s
  airflow (no ×3600; aliases `_v_sup` etc. preserved via
  `by_alias=True` artifact dumps), all four U/R fields (D-12), typed
  duct element/segment schemas (V1 shipped raw dicts), `load_summary`,
  `wufi_type` on spaces (V1 frontend declared it but V1's backend
  schema never shipped it).
- `extraction.py` — pure dict→DTO port of V1 `model_elements.py`:
  Meters normalization before extraction, AirBoundary skip+log+count,
  shade merging per display_name. The O(n²) V1 vertex merge was
  replaced with a rounded-coordinate bucket index (27-neighbor probe
  preserves `is_equivalent` tol=1e-7 semantics) — required for the
  253-shade Hillandale group. **duct_type is normalized from list
  membership** (supply=1/exhaust=2; US-VIEW-7 crit. 7): real GH
  exports tag exhaust ducts duct_type=1 (the primary fixture does).
- `model_data.py` — D-13/D-15/D-16 workflow: link-step
  `BackgroundTasks` job does ONE parse → `extracted_*` columns + gzip
  artifact at `derived/{asset_id}/model_data.json.gz` (mtime=0 for a
  deterministic ETag). `GET /model_data` streams it
  (`Cache-Control: private, max-age=31536000, immutable`, ETag,
  304 on If-None-Match). Self-healing: missing artifact on a
  non-failed row re-extracts synchronously (also covers MCP-created
  links — MCP `create_hbjson_file` schedules no job; first read
  extracts). Permanent (`model_data_extraction_failed`, 422,
  kind=permanent, names declared vs. pinned schema version) vs.
  transient (`model_data_unavailable`, 503, kind=transient; job
  failures leave the row 'pending' for retry-on-read).
- Routes: `/model_data` + 5 per-feature subset routes (raw-JSON
  passthrough from the artifact — no re-validation). All six
  MCP-exposed (`get_hbjson_model_data`, `list_hbjson_faces`/`spaces`/
  `ventilation_systems`/`hot_water_systems`/`shading_elements`).
- Tests: `test_model_viewer_extraction.py` ×17 (golden counts both
  fixtures, m³/s wire, D-12 fields, synthetic AirBoundary/Adiabatic/
  recirc), `test_model_viewer_model_data.py` ×11 (job, headers/304,
  subsets, D-16 both kinds, self-heal ×2, MCP tools), Phase 1 file
  tests updated (valid minimal Models — the job now runs on link).
  `hillandale` pytest marker registered: CI runs the 52 MB tests;
  skip locally with `-m 'not hillandale'`. Full suite 780 passed.
- **D-15 perf canary (Hillandale, 52 MB, recorded this session):**
  7.4 s end-to-end on Ed's machine — json.load 0.3 s, parse+convert
  (Inches→Meters) 4.2 s, extraction 1.8 s, serialize+gzip 1.0 s.
  Artifact: 18 MB JSON → 1 MB gzip.

Plan-vs-fixture corrections discovered while implementing (golden
counts in PLAN.md §Phase 2 were authored before parsing the files):

- Primary fixture ventilation: ONE system shared by 4 rooms (the
  "4 supply + 4 exhaust duct elements" count was the per-room view
  before V1-parity dedup) → 1 supply duct element (3 segments) +
  1 exhaust (2 segments) on the wire.
- Hillandale is NOT duct/pipe-free: 24 ventilation systems with 48
  duct elements and 1 HW system with 10 trunks (so it does not
  exercise the disabled-lens case; Phase 4 now covers empty-lens
  disabled-state derivation in focused frontend tests.
- Hillandale opaque constructions: 12 in use (not 9); 62 window ✓.
- Primary fixture spaces carry NO airflow values (all None) — the
  m³/s wire test is synthetic (sets `_v_sup` on the parsed model).

Known edge (V1 parity, deliberate): the AirBoundary tripwire is
"construction fails OpaqueConstructionSchema validation" — a
construction containing an EnergyMaterialNoMass layer (no thickness/
conductivity fields) would also fail and be skipped+counted as an air
boundary. Neither fixture has one (skip counts are 0 ✓) and V1
behaved identically; if a real project ever shows a nonzero
`air_boundaries_skipped` with no air boundaries modeled, look here
first.

Closeout gate (`make format` + `make ci`) green this session;
`graphify update .` run.

## Phase 1 — implemented 2026-06-12

Backend:
- Migration `20260612_0022_project_hbjson_files` (UUID PK, TEXT
  asset_id, partial unique `(project_id, content_hash_sha256)` dedup
  backstop, `(project_id, uploaded_at DESC)` list index).
- `backend/features/model_viewer/` (routes/models/service/repository)
  registered in `main.py`. Link step implements two-layer dedup
  (SELECT for the friendly 409 + unique-index backstop), restore-on-
  relink for soft-deleted rows (asset-layer hash dedup returns the
  same `asset_id`, which is UNIQUE on the link table), and orphan-
  asset discard on rejected duplicates.
- hbjson kind-level upload policy added in `assets/registry.py` +
  intent validation (`.hbjson`/`.json`, JSON/octet-stream content
  type; the 100 MB cap is the existing service hard cap = D-17).
  Without this, hbjson intents fell through to the thermal-bridge
  attachment config and its 25 MB cap.
- Download route does its own linked-file check and bypasses the
  asset layer's anonymous document-reference gate (hbjson assets are
  never document-referenced).
- MCP tools in `features/mcp/tools_model_viewer.py` (list/create/
  rename/delete/download-url) re-exported via `tools.py`, stubs in
  `server.py`.
- `backend/tests/test_model_viewer_files.py` — 11 tests green
  (round-trip, ordering, rename/notes validation, soft delete,
  dedup 409 + backstop + orphan discard, restore-on-relink, viewer
  401s, anonymous download, intent constraint rejections, >8 KB
  magic-check regression).
- Latent asset-layer bug found and fixed: `_validate_magic` ran
  `json.loads` on only the first 8 KB, so ANY real `.hbjson` over
  8 KB failed complete-upload (`hbjson_parse_failed`). Now: full
  parse only when the prefix holds the whole file, JSON-object sniff
  otherwise. Regression test included.

Frontend:
- `frontend/src/features/model_viewer/` (api/hooks/lib/store/
  query-keys/types + components FileChip, FilePopover, FileRow,
  UploadDropZone, UploadNoticeLine, ModelEmptyState,
  DeleteFileDialog + routes/ModelTab + model_viewer.css). Wired in
  `ProjectTabContent`; `TAB_COPY.model` updated.
- Active file ⇆ `?file=` via `useSearchParams` (newest fallback);
  `store.ts` zustand groundwork holds `activeFileId`.
- Upload flow: local validation → SHA-256 (shared
  `shared/lib/sha256.ts:sha256HexOfFile`) → intent → XHR PUT with
  progress (shared `assets/api.ts:putToSignedUrlWithProgress`) →
  complete → link; dedup 409 surfaces inline with [Switch] (D-06:
  no toasts).
- Vitest: 11 tests green (`lib.test.ts`, `FilePopover.test.tsx` —
  validation, sort, viewer-role hiding, failed badge, dedup notice).
- Playwright e2e green: `frontend/tests/e2e/model-viewer-files.spec.ts`
  (codex@example.com, real fixture upload → rename → notes →
  `?file=` → delete → empty state). Requires `make seed-agent-user`
  and `make object-store-init` (the MinIO bucket was missing on this
  machine — that's the dev-stack step that creates it).

Closeout gate (`make format` + `make ci`) run at end of session —
see ledger.

## Blockers

None. Phase 6's sun path remains blocked on the deferred
`project-location` feature (the lens itself still ships with a
location hint) — it does not gate Phases 1–5. The scale fixture is
in hand (round 3); the former "waiting on multifamily HBJSON"
blocker is cleared.

## Verification ledger

| Phase | State | Evidence |
|---|---|---|
| Planning docs | Done 2026-06-12 | this folder |
| Phase handoff plans (01–06) | Done 2026-06-12 | `phases/` |
| Phase 1 — file management | **Done 2026-06-12** | migration `20260612_0022`; `backend/features/model_viewer/`; `frontend/src/features/model_viewer/`; pytest ×11 + Vitest ×11 + e2e green; `make ci` green (this session) |
| Phase 2 — extraction backend | **Done 2026-06-12** | `schemas/` + `extraction.py` + `model_data.py`; 6 read routes + 6 MCP tools; pytest ×28 new (incl. Hillandale goldens); perf canary 7.4 s; `make ci` green (this session) |
| Phase 3 — canvas + Building lens | **Done 2026-06-13** | R3F deps; `/model_data` query; Building lens loader/canvas; selection + inspector; scene-ready hook; simplify + docs-pass complete; `make format` green; `make ci` green; focused Playwright spec green; `graphify update .` run |
| Phase 4 — remaining lenses | **Done 2026-06-13** | lens bar + all remaining non-Site lenses; inspector configs; `&lens=` deep links; focused Vitest green; Phase 4 Playwright e2e green; browser walkthrough green |
| Phase 5 — themes + legend | **Done 2026-06-13** | theme registry + `&theme=`; attached Color menu; unlit theme bucket materials; legend counts + mini-keys + scene-info popover; focused Vitest green; Phase 5 Playwright e2e green; browser walkthrough green |
| Phase 6 — measure, Site & Sun, polish | In review | Measure store/overlay, Site & Sun shade layer, keyboard map, debug hook, focused TypeScript/Vitest/lint/check/e2e green; browser screenshots saved; simplify/docs-pass complete; `make format` green; `make ci` green; John test requires Ed/John coordination |
