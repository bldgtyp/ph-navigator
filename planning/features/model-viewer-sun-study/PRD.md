---
DATE: 2026-07-01
TIME: 16:31
STATUS: Draft — reviewed by Ed 2026-07-01 (all §11 questions resolved;
  ground-shadows fix packet folded in as the baseline phase); ready for
  implementation planning.
AUTHOR: Claude (for Ed)
SCOPE: Product/behavior contract for a "Sun study" mode in the Model
  tab's Site & Sun lens - date-of-year and time-of-day scrubbers that
  drive a sun marker along the existing sunpath dome and re-aim the
  scene's key light to cast real-time shadows onto the building and a
  ground plane, with progressive disclosure of the controls and a
  strict render-performance budget.
RELATED:
  - context/user-stories/40-model-viewer.md (Q-VIEW-6 — sun-path
    scrubber, previously resolved "defer to v1.1+"; this feature
    un-defers it. Amend Q-VIEW-6 in the closeout docs pass.)
  - backend/features/project_location/sun_path.py (dome builder,
    ladybug Sunpath/Compass, unit radius, true-north baked in)
  - backend/features/project_location/sun_path_schemas.py (wire schema
    this feature extends)
  - frontend/src/features/model_viewer/scene/SiteSunLayer.tsx (dome
    rendering) and scene/sunPathGeometry.ts (fit transform)
  - frontend/src/features/model_viewer/scene/ViewerCanvas.tsx
    (lighting rig, ContactShadows, post-FX, frameloop="demand")
  - planning/features/model-viewer-ground-shadows/ (Codex fix packet
    for the ContactShadows vertical-plane artifact — folded into this
    feature 2026-07-01 as its baseline phase, D-12; that folder is now
    Superseded and points here)
  - planning/archive/dated/2026-06-13/model-viewer/UI_SPEC.md
    (accepted Model tab UI definition — this feature adds one new
    floating control to the site-sun lens only)
  - context/UI_UX.md §0/§1 (common-element rules, "honest density")
  - README.md, STATUS.md (this folder)
---

# Model Viewer — Sun Study (Date/Time Scrub + Real-Time Shadows)

## 0. Problem & design intent

The Site & Sun lens shows the **annual envelope** — every hourly
analemma and monthly day-arc at once. That answers "where can the sun
ever be?" but not the question an architect actually walks into a
design review with: **"where is the sun on June 21 at 3pm, and what
does it shade?"** Today the lens cannot answer it: there is no sun
marker, and the scene's shadows are a baked ground blob that never
moves (`ViewerCanvas.tsx:129-137`).

Design intent, one sentence: **scrub a date and a time, watch a sun
marker ride the dome, and watch the model's own shadows move with it —
so shading behavior (overhangs, neighboring mass, self-shading of
windows) can be *seen* at the handful of dates that matter, without
turning the viewer into a daylighting engine.**

Two constraints shape everything below:

1. **Progressive disclosure, reconciled with "honest density."**
   `context/UI_UX.md` warns against hiding data behind disclosure. The
   resolution: disclosure here is staged **by mode, not by hiding
   fields**. The lens's default state is exactly today's (dome only)
   plus one quiet affordance; engaging Sun study reveals *all* of its
   controls and readouts at once — nothing inside the mode is tucked
   behind hovers or accordions. Users who never engage it never pay
   any visual tax.
2. **Performance is a budget, not an aspiration.** The viewer's whole
   rendering architecture is built around a fixed draw-call budget
   ([[project_model_viewer_batched_substrate]]) and on-demand frames.
   Sun study must be strictly additive-while-engaged and strictly
   zero-cost when not engaged (§7).

## 1. Scope

**In scope:**
- Site & Sun lens only. A collapsed "Sun study" pill; an expanded
  control bar with a date-of-year scrubber and a time-of-day scrubber;
  solstice/equinox preset chips; a readout line (date · time, altitude,
  azimuth, sunrise/sunset).
- A sun marker (small emissive sphere) that rides the existing sunpath
  dome at the scrubbed date/time.
- **Ground-shadow baseline fix** (folded-in packet, D-12): correct the
  `ContactShadows` helper that currently reads as a giant vertical
  gray sheet from some orbit angles, preserving a soft grounding cue
  across all lenses — the corrected baseline is what sun study then
  builds its shadow-catcher on.
- Scene lighting: while engaged, the existing key directional light is
  re-aimed to the true solar direction and casts real-time shadows;
  building/shades cast **and receive** (self-shading is the point); a
  shadow-catcher ground plane registers shadows on the ground.
- Backend: extending the existing `/sun-path` payload with an hourly
  solar-position grid and per-day sunrise/sunset (all solar math stays
  in the backend, per the hard rule).
- Night/below-horizon behavior, engage/disengage/lens-switch behavior,
  perf guardrails, and tests.

**Explicitly not in scope** (full list §9): animation/playback,
radiation or daylighting metrics, URL-persisted scrub state, DST
handling, changes to any other lens, editing project location.

## 2. Current behavior (baseline, verified against code)

- **Backend** serves `/api/v1/projects/{id}/sun-path`
  (`project_location/routes.py:60-65` → `service.py:72-91` →
  `sun_path.py:60-99`). It uses ladybug's `Sunpath` + `Compass` to
  build the dome as **unit-radius, origin-centered geometry with
  true-north rotation baked in**, DST off
  (`_DAYLIGHT_SAVING_PERIOD = None`). The payload
  (`sun_path_schemas.py:23-42`) carries hourly analemma polylines,
  monthly day arcs, and compass circles/ticks — **geometry only; no
  solar position for a specific date/time exists anywhere on the
  wire**, though ladybug's `Sunpath.calculate_sun(...)` sits unused
  one import away from the dome builder.
- **Frontend** renders the dome in `SiteSunLayer.tsx:29-58` as
  non-pickable drei `<Line>`s (`raycast={() => null}`), scaled and
  placed by `sunPathFitTransform(bounds, 1.2)`
  (`sunPathGeometry.ts:77-88`): position
  `[center.x, center.y, bounds.min.z]`, scale = bounding-sphere radius
  × 1.2. The frontend already **samples backend geometry with local
  trig** (`arc3dToPoints`, `arc2dToPoints`) — established precedent
  that display-level geometric evaluation of backend-computed curves
  lives client-side.
- **Lighting** (`ViewerCanvas.tsx:96-108`): shipped look is a
  hemisphere fill + one directional key whose position is *already*
  computed from elevation/azimuth knobs (`keyPos`,
  `ViewerCanvas.tsx:68-73`) — dev-only knobs today, but exactly the
  parameterization a real sun needs. **No shadow maps**: shadows are a
  `ContactShadows` blob baked once per Canvas (`frames={1}`) and
  deliberately **not** keyed by lens (remounting it per lens switch
  leaked geometry — CR3). `frameloop="demand"`; N8AO + SMAA composer;
  heavy models (>1500 objects) drop the composer for MSAA.
- **Known baseline defect (folded-in scope, D-12):** that
  `ContactShadows` helper's receiver plane is visible as a large
  vertical/free-standing gray sheet from some orbit angles — traced
  2026-07-01 to its `scale={80}` plane and a rotation that appears
  wrong for this Z-up scene (`rotation={[Math.PI / 2, 0, 0]}`). The
  full behavior contract and acceptance criteria for the fix live in
  `planning/features/model-viewer-ground-shadows/PRD.md` (imported
  wholesale, not restated here).
- **Store** (`store.ts`): lens, selection/hover, measure, section,
  camera request. No date/time state of any kind.
- **Tests**: `model-viewer-site-sun.spec.ts` (e2e, uses the
  `window.__phnModelViewer` debug hook: `sunPathReady`, `shadeCount`),
  `sunPathGeometry.test.ts` (unit), `test_project_location_sun_path.py`
  (backend), `perfGate.test.ts` (substrate O(1) guard).

## 3. Terminology

- **Sun study** — the engaged mode: scrubbers visible, sun marker on
  the dome, key light re-aimed, shadows live. Standard architectural
  term for exactly this activity; used for the pill label, the store
  slice, and this folder's name.
- **Local standard time (LST)** — all hours in this feature are local
  standard time with **no DST**, on a 365-day year. This matches how
  the dome itself is already built (`_DAYLIGHT_SAVING_PERIOD = None`);
  a dome and a scrubber that disagreed about DST would put the marker
  visibly off the analemmas. The details row labels it (§4) so a July
  "14:30" isn't mistaken for 14:30 EDT.

## 4. New behavior — controls & progressive disclosure

### 4.1 Collapsed state (the only new chrome by default)

When the Site & Sun lens is active **and** sun-path data exists (i.e.
project location is set), one pill appears bottom-center over the
canvas:

```
                    ┌──────────────┐
                    │  ☀ Sun study │
                    └──────────────┘
```

Nothing else changes: the dome renders exactly as today, lighting and
shadows are exactly today's. If location is unset, the lens keeps its
existing location hint and no pill renders. The pill never appears in
any other lens.

### 4.2 Engaged state (everything visible at once)

Clicking the pill expands it in place into the sun bar and switches
the scene into sun-study rendering (§5). All controls and readouts are
immediately visible — no nested disclosure inside the mode:

```
┌──────────────────────────────────────────────────────────────┐
│ ☀ Sun study                            Jun 21 · 14:30    ✕  │
│                                                              │
│ Date    J   F   M   A   M   J   J   A   S   O   N   D        │
│         ────────────────────────●─────────────────────       │
│         [ Dec 21 ] [ Mar 20 ] [ Jun 21 ] [ Sep 22 ]          │
│                                                              │
│ Time    00  ▁▁▁▁▁▂▅█████████████●████████▅▂▁▁▁▁  24         │
│                                                              │
│ Alt 62.4° · Az 218.7° · ↑ 05:24 · ↓ 20:31 · LST (no DST)     │
└──────────────────────────────────────────────────────────────┘
```

- **Header row**: mode label; live primary readout ("Jun 21 · 14:30",
  the number a screenshot needs to be self-explanatory); ✕ collapses
  back to the pill.
- **Date scrubber**: full year, step = 1 day (snaps to grid rows, §6),
  month-initial tick rail. Below it, four preset chips in calendar
  order — **Dec 21 · Mar 20 · Jun 21 · Sep 22** (winter solstice,
  spring equinox, summer solstice, fall equinox; season name in the
  tooltip) — the dates a PH shading review actually checks. Both
  equinoxes get a chip (Ed, 2026-07-01): their sun paths are nearly
  identical, but the calendar dates are what reviews are written
  against. Chips set the **date only**; the chosen time is preserved.
  Chips reuse the canonical filter-chip pattern
  ([[feedback_report_status_chip_styling]]).
- **Time scrubber**: 00:00–24:00, step = 10 min. **The track itself is
  the signature element**: a daylight band computed from the selected
  date's backend-supplied sunrise/sunset — night renders dark, day
  light, with short dawn/dusk ramps. Change the date and the band
  visibly stretches or shrinks; the photoperiod is encoded in the
  control, not decoration. (Structure-is-information; this replaces
  any need for a separate "daylight hours" readout.)
- **Details row** (quiet, always visible while engaged): altitude °,
  azimuth °, sunrise ↑ / sunset ↓ for the selected date, and the
  "LST (no DST)" caption (§3).
- Both scrubbers are native `<input type="range">` (matching
  `ViewerRenderControls.tsx`'s existing slider pattern — no slider
  library): keyboard arrows and visible focus come for free.
- Scrubbing updates marker + lighting **live during drag** (each
  change invalidates the demand-mode frameloop — this is the moment
  the feature exists for; §7 bounds its cost).

### 4.3 Defaults, persistence, exits

- First engage in a session: **today's month/day at 12:00 noon**
  (confirmed by Ed 2026-07-01). "Where is the sun *now-ish*" is the
  intuitive first frame; the canonical review dates are one chip away.
- Scrub state and engaged/collapsed state live in the viewer store for
  the session; leaving the Site & Sun lens tears down all sun-study
  rendering (§5.4) but **remembers** the state, so returning to the
  lens restores it. Not persisted to URL or localStorage in v1.
- Exits: ✕ on the bar; switching lens. `Esc` also collapses the bar —
  safe here because nothing is selectable in this lens, so `Esc` has
  no competing meaning.
- Narrow viewports: the bar is `width: min(560px, calc(100% - 28px))`,
  centered; rows wrap. Bottom-center is free real estate — legend/
  view-options sit top-left, scene info bottom-left, inspector right
  (`model_viewer.css:725-758`).

## 5. New behavior — scene

### 5.1 Sun marker

- A small emissive sphere at `unitSunVector × 1.0` in dome space, run
  through the same `sunPathFitTransform` as the dome — **by
  construction it always lies exactly on the dome surface**, sliding
  along the day's arc as time scrubs and across the analemmas as the
  date scrubs. Radius ≈ 1.5% of dome radius.
- **Marker only in v1** (Ed, 2026-07-01): the dashed azimuth ground
  line originally proposed here is deferred — add later only if the
  numeric azimuth readout (§4.2) proves insufficient in use.
- The marker is `raycast={() => null}` (non-pickable), matching every
  other sun-path element.
- Color: a new warm token (e.g. `VIEWER_SUN_MARKER_COLOR`, amber/gold)
  — deliberately distinct from the sun-path crimson so "the geometry
  of possible suns" and "the sun right now" never read as one thing.

### 5.2 Lighting & shadows

- While engaged, the **existing key directional light is re-aimed** to
  the interpolated solar direction (there is only ever one key light —
  the sun *becomes* the key, reusing the `keyPos`
  elevation/azimuth-to-position pattern verbatim) and gets
  `castShadow`. The hemisphere fill is untouched, so the model never
  goes unreadably dark.
- Building substrate meshes and shade meshes **cast and receive**
  shadows — self-shading of windows by overhangs/reveals/neighboring
  mass is the core value for PH work, not just the ground silhouette.
- **Shadow quality, v1 (deliberately modest):** single directional
  light, `PCFSoftShadowMap`, **1024² map**, orthographic shadow camera
  fitted once per engage to the model bounds (bounds are fixed per
  file), tuned `normalBias`. No cascades, no PCSS, no soft-area
  approximations. Map size becomes a dev-only knob alongside the
  existing render settings; not a user control.
- **Below the horizon** (interpolated altitude ≤ 0°): the sun light's
  intensity ramps smoothly to zero over the last few degrees
  (`smoothstep(0°, ~4°)` on altitude — also gives dusk a soft die-off
  instead of a pop), the marker fades/hides below the compass plane,
  and the scene rests on hemisphere fill alone. The default key light
  is *not* restored at night — flat ambient lighting *is* the honest
  rendering of "no sun."

### 5.3 Ground plane (shadow catcher) & ground-shadow baseline

- **Baseline first (folded-in packet, D-12):** before any sun-study
  scene work, fix the existing `ContactShadows` artifact — its
  receiver plane shows as a large vertical gray sheet from some orbit
  angles (§2). The imported contract
  (`model-viewer-ground-shadows/PRD.md`) governs: no visible
  free-standing helper plane in any lens, a soft grounding cue
  preserved everywhere, helper stays non-interactive, section planes
  never read it as a model surface. Its own PLAN's escalation path
  applies (fix orientation → replace with a custom horizontal
  receiver → AO/grid-only grounding).
- Sun study's **shadow catcher**: a `ShadowMaterial` plane (invisible
  except where shadow falls) at `z = bounds.min.z`, sized ≈ 2× the
  dome fit radius. It changes nothing visually except registering
  shadows — the existing infinite Grid stays the "floor" aesthetic.
  Small +z epsilon vs the grid to avoid z-fighting (tuning, not
  product).
- While engaged, **whatever grounding cue survives the baseline fix**
  (a corrected `ContactShadows`, a custom receiver, or nothing) is
  hidden via `visible = false` — never unmounted — so the static cue
  and the moving shadow don't double up, and the CR3 remount-leak
  lesson is respected. It reappears on disengage.

### 5.4 Engage / disengage lifecycle

Disengaging (✕, `Esc`) or leaving the lens must restore the baseline
scene *exactly*: key light back to its knob-driven position with
`castShadow` off, marker + azimuth line + shadow plane removed,
`ContactShadows` visible again. Baseline draw-call count and frame
time in the other lenses are unchanged by this feature existing
(acceptance §12.10).

## 6. Data & backend changes

**Hard rule:** all calculations live in the backend. Solar position is
a domain calculation — but scrubbing at interactive rates cannot
round-trip per input event. Resolution (Decision D-1): the backend
ships a **precomputed hourly solar-position grid** with the existing
sun-path payload; the frontend only *interpolates between adjacent
backend-computed points* for display smoothness — the same class of
display-level geometric evaluation as the existing `arc3dToPoints`
sampling of backend arcs. The backend grid is the sole source of
truth; the frontend derives nothing it could get wrong about the
domain (and the marker sits *exactly* on backend values at every whole
hour, which is what the golden tests pin).

### 6.1 Wire schema (additive, backwards-compatible)

`SunPathAndCompassDTOSchema` gains one optional block (old consumers,
including the `get_project_sun_path` MCP tool's callers, ignore it):

```python
class SunPositionGridSchema(BaseModel):
    hours: list[float]        # 24 columns: 0.0..23.0 (LST, DST off)
    days: list[int]           # 365 rows: day-of-year, 1..365
    # len == 365*24, row-major by day. Unit vectors in the SAME
    # unit-radius, true-north-baked frame as the dome geometry
    # (built from the same Sunpath instance). z < 0 == below horizon;
    # below-horizon vectors are included so interpolation stays smooth
    # through sunrise/sunset.
    unit_vectors: list[tuple[float, float, float]]
    # Per day: (sunrise, sunset) as decimal hours LST; None/None for
    # polar edge cases (schema tolerates them even though NYC-latitude
    # projects never hit them).
    sunrise_sunset: list[tuple[float | None, float | None]]
```

Computed in `sun_path.py` from the **same `Sunpath` instance** that
builds the dome (`calculate_sun` / `calculate_sunrise_sunset`), so the
frame identity is guaranteed by construction, not by convention.

Rounding: vector components to 4 decimals (~0.006° — far below visual
resolution). Estimated payload growth ≈ 180 KB raw / ~35–40 KB gzip on
a response that is fetched once per project and cacheable. If that
ever matters, `days` supports a coarser step by design (the schema
carries the row labels explicitly) — **not** exercised in v1, where
the full 365 rows keep the date slider a pure snap-to-row with no
day-axis interpolation at all.

### 6.2 Frontend derivations (display-only, from backend values)

- **Time interpolation**: for minutes between whole hours,
  `normalize(lerp(v[h], v[h+1]))` on the two adjacent unit vectors —
  no azimuth-wraparound pathology (which alt/az interpolation would
  have; this is *why* the wire format is vectors, not angle pairs).
  The 23:00→24:00 tail clamps toward hour 0 (sun is below the horizon
  then at any project latitude; the clamp is invisible).
- **Readouts**: altitude = `asin(z)`, azimuth from `atan2` — a
  coordinate-system restatement of the backend vector, not new domain
  math.
- **Daylight band**: rendered directly from the day's shipped
  sunrise/sunset pair. Never derived by scanning the grid for
  zero-crossings (that would be a frontend calculation).

### 6.3 Store additions

```typescript
sunStudy: {
  engaged: boolean;
  day: number;      // 1..365 (grid row)
  minutes: number;  // 0..1439
} | null;
setSunStudy(...): void;
```

One memoized selector/hook derives the interpolated direction +
altitude from grid × state and feeds marker, light, and readouts;
every change calls `invalidate()`.

## 7. Performance budget & guardrails

| Concern | Budget / rule |
|---|---|
| Cost when **not engaged** (any lens) | Zero. No new lights, no shadow depth pass (no `castShadow` light exists), no new meshes. Building-lens draw calls and frame time unchanged (acceptance §12.10). |
| New scene objects while engaged | ≤ 3: marker sphere, azimuth line, shadow plane. Perf-gate unit test asserts the delta stays constant (mirrors `perfGate.test.ts`'s O(1) substrate guard). |
| Shadow pass while engaged | One depth render of casters only — the ≤2 batched substrate meshes + shade meshes (dome/compass lines don't cast; marker/plane don't cast). Cost scales with the existing draw-call budget, not face count. |
| Shadow map | 1024² PCFSoft, single light, fixed ortho frustum. Upgrades are a dev-knob experiment, not v1 scope. |
| Frameloop | Stays `demand`. Scrubbing invalidates per change; idle sun study costs nothing after the settle frame. |
| `Canvas shadows` flag | Enabled at Canvas creation so engaging never rebuilds the GL context; the phase-0 spike (§14) verifies the flag alone is free when no caster light exists. |
| Debug hook | `window.__phnModelViewer` gains a `sunStudy` block (engaged, day, minutes, altitude) so Playwright can assert scene state without pixel-reading. |

## 8. Visual language & tokens

- Bar/pill reuse the established floating-chrome surface recipe
  (`--bg-card` color-mix, `--border-card`, `--radius-md`,
  `--shadow-hud-2`, `--z-base-elevated`) — same family as
  `.model-legend-card`. No new surface style.
- Preset chips: the report-status-chip classes/variables (canonical
  chip pattern).
- New tokens: `VIEWER_SUN_MARKER_COLOR` (warm amber; also the lit
  segment of the daylight band and the time-slider thumb, so "sun
  things are amber" reads as one system). Night segment of the track
  derives from existing neutral surface tokens.
- The one aesthetic risk is the daylight-band track (§4.2). Everything
  else stays quiet and system-standard.

## 9. Explicitly out of scope

- **Playback/animation** (auto-advancing time, "play a day").
  Confirmed out by Ed 2026-07-01 — **manual scrub only, SketchUp
  style**. Cheap once scrubbing exists; deliberate v1.1 candidate.
- **Azimuth ground line** from dome center to the marker's plan
  projection (Ed, 2026-07-01: add later only if the numeric azimuth
  readout proves insufficient).
- Radiation, irradiance, daylight-autonomy, or any quantitative solar
  metric. This is a *qualitative* shading visualization; certification
  numbers stay in PHPP/WUFI.
- Shadow-accuracy claims. 1024² PCF shadows are illustrative, not
  measurable evidence.
- URL/share-link persistence of scrub state; localStorage persistence.
- DST or timezone UI (fixed LST, §3). Leap days (365-day year,
  matching ladybug/dome convention).
- Any lighting/shadow change in the other five lenses; any change to
  dome geometry, compass, or project-location editing.
- Highlighting/labeling individual analemmas or arcs on hover.

## 10. Design decisions (summary)

| # | Decision | Rationale |
|---|---|---|
| D-1 | Solar position ships as a backend-computed hourly grid on the existing `/sun-path` payload; frontend interpolates adjacent grid points for display only | Hard rule (backend owns calculation) + interactive scrub can't round-trip; precedent: frontend already trig-samples backend arcs (`arc3dToPoints`) |
| D-2 | Grid = 365 days × 24 hours of **unit vectors** in the dome's own frame, + per-day sunrise/sunset; built from the same `Sunpath` instance as the dome | Vectors interpolate cleanly (no azimuth wraparound); same-instance construction makes marker-on-dome exact by construction; date slider snaps to rows so only the hour axis interpolates |
| D-3 | The existing key directional **becomes** the sun while engaged (one key light, ever); hemisphere fill unchanged; intensity smoothsteps to 0 below ~4° altitude | Avoids two competing keys washing out shading; shading direction and shadow direction always agree; night stays legible on fill alone |
| D-4 | Ground shadow catcher = `ShadowMaterial` plane at `bounds.min.z`, ~2× dome radius; the post-fix grounding cue (D-12) hidden via `visible=false` (never remounted) while engaged | Invisible except shadows, so the shipped look is untouched; no static/dynamic double shadow; respects the CR3 remount-leak lesson |
| D-5 | Shadow quality v1: 1024² PCFSoft, one light, ortho camera fit once per engage; map size dev-knob only | "Don't go overboard yet" made concrete; single knob to revisit later |
| D-6 | Progressive disclosure staged by **mode**: one pill collapsed → everything visible when engaged; no intra-mode hiding | Reconciles the disclosure ask with UI_UX "honest density" |
| D-7 | All times are local standard time, DST off, 365-day year, labeled "LST (no DST)" in the details row | Must match how the dome is already computed or the marker leaves the analemmas |
| D-8 | Defaults: today's date @ 12:00 noon (confirmed by Ed); state session-persistent in the store; survives lens round-trips; no URL persistence | Intuitive first frame; canonical review dates are one chip away |
| D-9 | Four preset chips in calendar order: Dec 21 · Mar 20 · Jun 21 · Sep 22 (both equinoxes, per Ed); chips set date only | The dates a PH shading review checks; reviews are written against calendar dates, so both equinoxes get a chip even though their paths nearly coincide |
| D-10 | Sun marker only in v1, non-pickable, amber token distinct from sun-path crimson; azimuth ground line deferred (Ed) | "Sun right now" must not read as part of the "all possible suns" geometry; the numeric azimuth readout carries the value until proven insufficient |
| D-11 | Section tool + shadows: set `clipShadows` on shadow-casting materials so clipped-away geometry doesn't keep casting | A sectioned wall casting a phantom shadow reads as a bug |
| D-12 | The `model-viewer-ground-shadows` fix packet (Codex, 2026-07-01) is folded in as this feature's baseline phase; its PRD/PLAN are imported as-is and that folder is marked Superseded with a pointer here | Same file (`ViewerCanvas.tsx`), same shadow strategy; D-4's "hide the grounding cue while engaged" depends on the fix's outcome, so sequencing them in one feature avoids two branches rewriting the same code |

## 11. Resolved questions (Ed, 2026-07-01)

1. **Default date** — today @ 12:00 noon (D-8 confirmed).
2. **Azimuth ground line** — deferred; ship marker-only, add later if
   the numeric readout proves insufficient (D-10 amended). Ed also
   flagged the existing `model-viewer-ground-shadows` packet here,
   which is now folded in (D-12).
3. **Playback** — stays out of v1. Manual scrub only, SketchUp style
   (§9).
4. **Equinox chips** — two chips (Mar 20 and Sep 22), four presets
   total (D-9 amended).

## 12. Acceptance criteria

1. In the Site & Sun lens with a project location set, a "Sun study"
   pill appears bottom-center; it appears in no other lens and not
   when location is unset. Collapsed, the scene is pixel-identical to
   the post-baseline-fix lens (criterion 13).
2. Engaging shows the full bar (date scrubber + chips, time scrubber
   with daylight band, header readout, details row) with no further
   disclosure steps.
3. Scrubbing time moves the marker along the current day's arc;
   scrubbing date moves it across the analemmas; the marker always
   lies on the dome surface; at any whole hour its direction equals
   the backend grid vector exactly (no accumulated drift).
4. Shadows from building + shade geometry fall on the ground plane
   **and on the building itself** (a window under an overhang reads as
   shaded at high summer sun), and move live during scrub.
5. The time-slider daylight band matches the backend sunrise/sunset
   for the selected date and updates when the date changes.
6. Below-horizon times: sun light off (smooth ramp, no pop), marker
   hidden, no shadows, model still legible on fill lighting.
7. All four preset chips set the date (not the time) to Dec 21 /
   Mar 20 / Jun 21 / Sep 22 respectively.
8. Details row shows altitude, azimuth, sunrise/sunset, and the LST
   caption; values match backend-derivable truth within rounding.
9. Disengage (`✕`, `Esc`) and lens switch fully restore the baseline
   scene (key light knob position, ContactShadows visible, no sun
   objects); re-entering the lens restores the remembered scrub state.
10. Perf: Building lens draw calls and frame time unchanged vs main;
    engaging sun study adds ≤ 3 scene objects (perf-gate test) and one
    shadow pass; disengaged Site & Sun lens matches today's cost.
11. Scrubbers are keyboard-operable with visible focus; the bar fits
    viewports down to narrow widths.
12. `make ci` green, including new backend grid tests, frontend unit
    tests, the perf gate, and the extended
    `model-viewer-site-sun.spec.ts` e2e.
13. Ground-shadow baseline (D-12): the imported acceptance criteria of
    `model-viewer-ground-shadows/PRD.md` all hold — no vertical or
    free-standing gray helper plane from any orbit angle, a soft
    grounding cue still visible below the building in every lens, the
    helper never intercepts picking/measure/section, and the before/
    after screenshots called for by its PLAN are recorded.

## 13. Testing considerations

- **Backend**: grid golden tests at a known location (NYC-ish lat/lon):
  solar-noon altitude on Jun 21 ≈ 90° − |lat − 23.45°|; azimuth crosses
  south at solar noon; sunrise/sunset sanity vs published values; a
  **frame-consistency test** asserting the grid vector at (Jun 21,
  hour h) coincides with the corresponding hourly-analemma vertex from
  the same build (locks D-2's same-frame guarantee); polar-edge
  tolerance (None sunrise/sunset) at extreme latitude; payload-size
  regression bound.
- **Frontend unit**: hour-axis interpolation (normalize-lerp, incl.
  the 23h tail clamp); alt/az derivation round-trip against known
  vectors; daylight-band geometry from sunrise/sunset pairs;
  marker-position = fitTransform ∘ unitVector; the light
  intensity-ramp function; perf-gate object-count delta.
- **E2e** (extend `model-viewer-site-sun.spec.ts`): engage via pill →
  assert debug-hook `sunStudy` state + marker/light presence; scrub
  both axes via the range inputs and assert hook altitude changes
  sign/magnitude sensibly; chip clicks; `Esc`/lens-switch teardown and
  state restore; screenshot at Summer-noon for visual record.
- **Ground-shadow baseline smoke** (imported from the D-12 packet's
  PLAN): before/after screenshots across Building, Site & Sun, one
  line lens, and with a section plane enabled; click-through of the
  former plane area does not select or block picks;
  `make frontend-dev-check` for the baseline phase on its own.
- **Perf verification**: before/after frame-time + draw-call
  comparison on the heavy fixture (Hillandale-scale) with sun study
  engaged, recorded in the phase ledger (baseline: ~60 FPS / 14 draw
  calls, [[project_viewer_rendering_style_refactor]]).

## 14. Risks

- **BatchedMesh × shadow maps (top technical risk).** The substrate is
  ≤2 `BatchedMesh` instances; three r0.184 should handle
  `castShadow`/`receiveShadow` on them, but this exact combination is
  unproven in this codebase. **Phase 0 must be a spike**: batched
  substrate + directional shadow + ShadowMaterial plane on the heavy
  fixture, before any UI work. Fallback if broken: shades + ground
  receive only (loses self-shading — degraded enough that the real
  mitigation is a three patch/bump, not shipping the fallback quietly).
- **Shader recompile hitch on first engage** — flipping
  `receiveShadow` recompiles material programs once. Acceptable as a
  one-time cost; if the spike shows it's free, set the flags at mount
  instead.
- **Section-tool interaction** — global clipping planes don't clip
  shadow casters unless `clipShadows` is set (D-11). Verify in the
  spike that this doesn't perturb the substrate's material handling.
- **Composer + shadows on heavy models** — N8AO/SMAA runs on every
  model today; adding a shadow pass on Hillandale-scale is expected
  fine (casters are 2 draws) but is exactly what §13's perf
  verification exists to prove, not assume.
- **LST confusion** — a summer "14:30" is 15:30 on the user's watch
  (DST). Mitigated by the always-visible caption (D-7); revisit only
  if it generates real confusion.
- **Payload growth** on `/sun-path` (~35–40 KB gzip) — acceptable and
  cacheable; the schema's explicit `days` labels leave a coarsening
  knob if a future constraint appears.
