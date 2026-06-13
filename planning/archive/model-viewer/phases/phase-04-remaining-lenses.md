---
DATE: 2026-06-12
TIME: -
STATUS: Done — implemented and focused-verified 2026-06-13; final
  closeout gates tracked in STATUS.md.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Model Viewer Phase 4 — lens bar +
  the Spaces, Floor Areas, Ventilation, and Hot Water lenses; inspector
  configs for space / floor segment / duct / pipe; &lens= deep link.
RELATED:
  - planning/archive/model-viewer/UI_SPEC.md (§3 lens bar + per-lens
    composition table)
  - planning/archive/model-viewer/PRD.md (§4.1 lens model — D-03)
  - context/user-stories/40-model-viewer.md (US-VIEW-3 visibility/
    selectability rules; US-VIEW-6 remaining field configs)
  - research/v1-3d-model-viewer-reference.md (§9.2–9.6 loaders,
    §12.1 thick-line raycast)
---

# Phase 4 — Remaining lenses

## 0. Implementation status — 2026-06-13

Implemented in this session:

- Lens bar with six permanent URL tokens:
  `building`, `spaces`, `floor-areas`, `site-sun`, `ventilation`,
  `hot-water`.
- Site & Sun kept disabled with tooltip "Coming with project
  location"; Phase 6 remains responsible for sun-path completion
  against project-location data.
- Spaces, Floor Areas, Ventilation, and Hot Water render from the
  existing `/model_data` payload. Interior lenses include ghost
  building-edge context.
- Lens switches clear selection and run a 180 ms demand-driven
  opacity fade without changing the canvas to continuous rendering.
- Thick duct/pipe lines use world-unit drei `<Line>` and explicit
  `Line2`/`Line` raycast thresholds.
- Inspector configs added for `spaceGroup`,
  `spaceFloorSegmentMeshFace`, `ductSegmentLine`, and
  `pipeSegmentLine`; pipe config includes all Q-VIEW-4 fields.
- `formatAirflowFromM3S` now follows US-VIEW-6 criterion 8: wire
  m³/s displays as m³/h in SI and CFM in IP.
- Focused verification completed:
  `pnpm exec tsc -b --pretty false`, focused Vitest for viewer/unit
  helpers, `pnpm run lint` (only pre-existing aperture fast-refresh
  warnings), and
  `pnpm exec playwright test tests/e2e/model-viewer-lenses.spec.ts --project=chromium`.

Final repository closeout (`$ simplify`, `$ docs-pass`,
`make format`, `make ci`, `graphify update .`) is recorded in
`planning/archive/model-viewer/STATUS.md`.

## 1. Goal

The top-center lens bar switches between Building · Spaces · Floor
Areas · Ventilation · Hot Water with a ≤200 ms crossfade. The
Site & Sun lens itself ships in Phase 6; its segment is handled per
the rule in §3.1 (disabled-with-tooltip by default; enabled with
building+shades only if that falls out of this phase's loader work
essentially for free — record which in STATUS.md). Each lens shows
its geometry set with ghost-building context, its objects are
selectable with correct inspector configs, and `&lens=` deep-links
work.

D-03 recomposition applies: lens = what you look at; themes (Phase 5)
= how it's painted. The US-VIEW-3 visibility/selectability table
(criterion 4) is the behavior source, re-keyed: Geometry→Building,
SpaceFloors→Floor Areas, Ducts→Ventilation, Pipes→Hot Water.
V1's "click active button reverts to Geometry" is dropped.

## 2. Required reading (in order)

1. `planning/archive/model-viewer/UI_SPEC.md` §3 (lens bar,
   per-lens composition table — the authoritative matrix).
2. `planning/archive/model-viewer/PRD.md` §4.1 (D-03 mapping).
3. `context/user-stories/40-model-viewer.md` — US-VIEW-3 crit. 4
   (visibility/selectability), US-VIEW-6 crit. 5 rows `spaceGroup`,
   `spaceFloorSegmentMeshFace`, `pipeSegmentLine`,
   `ductSegmentLine` (all Q-VIEW-4 pipe fields; duct Supply/Exhaust).
4. V1 source loaders (read-only):
   `../ph-navigator/frontend/src/features/project_view/model_viewer/loaders/`
   — `load_spaces.tsx`, `load_space_floors.tsx`,
   `load_erv_ducting.tsx`, `load_hot_water_piping.tsx`; and
   `_handlers/selectLineSegment2` (thick-line raycast precedent).

## 3. Work breakdown

### 3.1 Lens bar (UI_SPEC §3)

- Floating top-center segmented control, labels + small icons:
  `Building · Spaces · Floor Areas · Site & Sun · Ventilation · Hot
  Water`. One segment always active (accent surface token; ghosts
  inactive). No "off" state.
- **Site & Sun segment**: Phase 6 owns the lens. Default here:
  render the segment **disabled** with tooltip "Coming with project
  location" UNLESS shades-only rendering is a near-free byproduct of
  this phase's loader work — in that case ship building+shades and
  let Phase 6 add the hint + polish. Record whichever was done in
  STATUS.md.
- Lenses with no content in the loaded file (e.g. no hot-water
  piping) render disabled with tooltip "No hot-water piping in this
  model" — derive from `/model_data` array emptiness.
- Crossfade ≤200 ms: opacity fade between lens geometry sets, no
  camera move. With `frameloop="demand"`, drive the fade via an
  invalidating spring/tween (e.g. a small `useFrame` fade that calls
  `invalidate()` while active) — do not switch to a continuous loop.
- Lens switch **clears selection** (UI_SPEC §6) and (Phase 6
  forward-compat) will clear measure state.
- Store: `lens` slice already stubbed in Phase 3; extend the union
  to all six values.
- Below ~1100 px canvas width labels collapse to icons + tooltips.

### 3.2 Lens scene sets (UI_SPEC §3 table)

| Lens | Shows | Ghost context | Selectable |
|---|---|---|---|
| Building | faces + apertures, edges | — | faces, apertures |
| Spaces | space volumes (translucent) | building edges | spaces |
| Floor Areas | floor segments | building edges | floor segments |
| Ventilation | ducts supply-blue / exhaust-red, world-unit thickness | building edges | duct segments |
| Hot Water | distribution + recirc piping (distinct line styles) | building edges | pipe segments |

- **Ghost context** = building edge wireframe at low opacity (reuse
  the Phase 3 edge lines with a ghost material variant).
- Loaders for spaces (volume meshes), floor segments, ducts, pipes —
  port from V1 as pure functions per the Phase 3 loader pattern,
  stamping full DTO meta.
- Ducts/pipes render as thick lines (`Line2`/`LineSegments2` via
  drei `<Line>` with worldUnits). Fixed colors: supply blue /
  exhaust red (D-I6); hot water distribution vs recirc distinct
  line styles. (Their always-on mini-key legend lands with the
  legend card in Phase 5.) Note: the canonical fixture has no
  recirc piping — style it from the DTO contract and unit-test with
  a synthetic DTO.
- **Thick-line picking**: raycasting `Line2` needs an explicit
  raycast threshold so hover/select feels as forgiving as V1
  (`selectLineSegment2` precedent) — set `raycaster.params.Line2`
  /equivalent and verify by feel in the MCP walkthrough.

### 3.3 Inspector configs (US-VIEW-6 crit. 5)

Add `spaceGroup` ("Interior Space"), `spaceFloorSegmentMeshFace`
("Interior Floor"), `pipeSegmentLine` ("Pipe" — ALL Q-VIEW-4 fields:
diameter, insulation thickness/conductivity/reflective/quality,
water temp, daily period, length, material), `ductSegmentLine`
("Duct" — incl. Duct Type Supply/Exhaust). Airflow fields arrive in
m³/s; display via `formatAirflowFromM3S` (m³/h in SI mode, CFM in
IP). Lengths/diameters via existing length/area helpers;
temperatures via `formatTemperatureFromC`; conductivity via the
thermal helpers. `--` for missing values.

### 3.4 URL param

`&lens={building|spaces|floor-areas|site-sun|ventilation|hot-water}`
(D-10) — read on mount, write on switch, same `useSearchParams`
plumbing as `?file=`. Invalid value → default Building, no error.
Choose kebab-case tokens; they become the permanent deep-link
contract, so record them in STATUS.md on landing.

## 4. Out of scope

Themes + theme menu + legend card (Phase 5 — Spaces/Floor-Areas
default appearance this phase is their neutral shaded look; Floor
Areas' Weighting-Factor default activates when themes land), Site &
Sun completion + sun path (Phase 6 against project-location data), Measure,
keyboard `1–6` (Phase 6 keyboard map).

## 5. Verification gate

1. **Vitest**: new loaders (counts from fixture DTO: 4 spaces, 5
   floor segments, 4+4 ducts, HW tree depth incl. synthetic recirc),
   lens-visibility selector logic (given lens → expected
   visible/selectable sets, asserting the §3.2 matrix), URL param
   round-trip, disabled-segment derivation from empty arrays.
2. **Playwright e2e** (`model-viewer-lenses.spec.ts`): switch
   through all lenses; assert per-lens canvas state via the Phase 3
   `window.__phnModelViewer` hook (phase-03 §4.8 — extend its
   `lens` + `objectCounts` for the new lens sets) rather than pixel
   asserts; select a duct → inspector shows Duct Type; select a
   space → m³/s→display conversion correct in both unit systems;
   deep-link `?file=…&lens=ventilation` lands directly on the lens.
3. **Playwright MCP walkthrough**: verify crossfade feel, thick-line
   hover forgiveness, ghost-context legibility. Screenshot evidence
   into STATUS.md.
4. **Closeout**: `make format` + `make ci` green on 2026-06-13.
   `graphify update .` run during final session closeout.

## 6. Exit criteria

Per-lens visibility/selectability matches the UI_SPEC §3 table
exactly; all four new inspector configs render with correct units;
deep links work. STATUS.md ledger updated (incl. the Site & Sun
segment decision and the lens URL tokens).
