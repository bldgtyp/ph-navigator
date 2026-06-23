---
DATE: 2026-06-13
TIME: -
STATUS: Settled — D-SP-1 accepted (Ed 2026-06-13); RECONCILED 2026-06-23
  (backend home = project_location, not "Climate"; build/delete history
  traced). Inherited items restated for one-stop reading. No open decisions.
AUTHOR: Claude (for Ed)
SCOPE: Decision ledger for the Model Viewer sun-path feature.
RELATED:
  - PRD.md
  - planning/archive/model-viewer/decisions.md (D-07, D-15)
  - planning/archive/project-location/PRD.md §10, decisions.md D-PL-2/D-PL-4
---

# Sun Path — Decisions

## Inherited (settled; restated)

- **D-07 (model-viewer):** sun path derives from project
  latitude/longitude/true-north, NOT an EPW. No EPW upload needed for
  the diagram (the project-location feature retains the EPW for other
  consumers, but the sun path needs only the location floats).
- **D-PL-2 (project-location):** the location *data* ships from
  `project_location`; the sun-path *wiring* (reading that data into a
  rendered diagram) is **owned here**.
- **D-PL-4 (project-location):** `true_north_deg` is stored in the
  ladybug/honeybee convention — counterclockwise degrees from +Y,
  90°=West, 270°=East, validated `[0, 360)`. The exact sign passed to
  ladybug's `Sunpath` is re-verified at implementation against a
  known-orientation fixture (a wrong sign silently rotates the
  diagram). See PRD §6 and phase-01 §4.
- **D-15 (model-viewer):** `/model_data` is a precomputed, immutable,
  forever-cached (`max-age=31536000, immutable`) R2 artifact, parsed
  once at upload. This is the constraint that forces D-SP-1.

## Accepted (Ed 2026-06-13)

### D-SP-1 · Serve the sun path from a separate, location-reactive endpoint — NOT baked into the `/model_data` artifact

**Accepted, Ed 2026-06-13:** "the 'location' is a project-level variable,
not an HBJSON-level variable. It should be settable by the user before
or after (and editable anytime) the HBJSON files are uploaded… it
should be decoupled to a separate project-scoped endpoint and store."
The setter UI already exists — `project_location` shipped the Location
section in Project Settings (`ProjectLocationSettingsSection.tsx` +
`location-form.ts`), so this feature only consumes the data.

The project-location seam (PRD §10) sketched populating the existing
`CombinedModelData.sun_path` key inside model-viewer extraction. That
made sense before D-15 hardened `/model_data` into an immutable,
upload-time, forever-cached artifact. Two facts now collide:

1. **The geometry artifact is immutable and computed once at upload.**
   It only re-extracts when `extraction_status='pending'` or the
   artifact is missing; a `'success'` row is served from R2 forever
   with `Cache-Control: immutable`.
2. **Location is set/edited independently of the upload** — in Project
   Settings, very often *after* the HBJSON was uploaded (upload first,
   set lat/long later is the normal order).

If `sun_path` is baked into the artifact at upload, a project whose
location is set later gets a `sun_path: null` artifact that never
updates, and the immutable cache guarantees it never will.

**Decision:** keep the geometry artifact a pure function of the HBJSON
bytes (`sun_path` stays `null` there — backward-compatible). Compute
and serve the sun path from a **new, project-scoped, location-reactive
endpoint** that reads current `project_location` on every request. The
sun path is purely a function of `(latitude, longitude, true_north,
time_zone)` and is microseconds-to-milliseconds of ladybug math with
**no HBJSON parse** — so a per-request compute is cheap and always
fresh.

| | A — Decoupled endpoint (recommended) | B — Bake into artifact + invalidate |
|---|---|---|
| Freshness on location edit | Instant (read on request) | Needs cross-feature invalidation |
| Cost on location edit | ~0 (no parse) | Re-parse every HBJSON in project (≤52 MB, ~7 s each) |
| Coupling | None (sun-path endpoint reads location repo) | `project_location` PUT must reset every `project_hbjson_files` row + delete derived R2 objects |
| Frontend cache | New query, normal lifecycle | Must bust `staleTime: Infinity` model-data query on location change |
| Artifact immutability | Preserved (D-15 intact) | Broken — artifact now depends on mutable location |
| Frontend work | One extra query + position diagram to model bounds | Reads existing `combinedData.sun_path` |

Option B is more code, worse performance, and breaks the D-15
immutability invariant for a diagram that depends on two floats.
Option A is the clean separation.

**Endpoint shape (Option A):**
`GET /api/v1/projects/{project_id}/sun-path` →
`SunPathAndCompassDTOSchema | null` (null when no location is set, or
lat/long are absent). Project-scoped, **not** file-scoped: the sun path
does not depend on which HBJSON is active. Lives in the model_viewer
routes module for cohesion. Cache: not the immutable treatment — a
short private cache or an ETag derived from a hash of the location
inputs, so a location edit is reflected on the next view.

**Geometry sizing (the one thing that touches the model):** the
analemma/arc/compass geometry must be scaled and centered to the
building so it frames the model rather than sitting at a fixed V1
radius (V1 hardcoded radius 40 because V1 models were near that scale;
the 52 MB multifamily fixture is not). To keep the endpoint
location-only, the **backend generates at a unit radius centered at
the origin** and the **frontend uniformly scales + translates** it to
the model's bounding-sphere radius and center — exactly how the MVP
already positions the north-marker compass from `model.bounds`.
Uniform scale + translate preserves the true-north rotation. No model
bounds cross the endpoint.

**Why both rows of the wire schema already exist:** Phase 2 of the MVP
shipped `SunPathAndCompassDTOSchema` (and its `SunPathSchema` /
`CompassSchema` children) precisely so this wiring would not change the
wire shape. This decision changes *where* that DTO is served, not its
shape.

**If Ed prefers B instead:** Phase 1 changes — extraction populates
`sun_path` using an in-process location read, and `project_location`'s
`PUT` (and EPW apply) must enqueue a model-data invalidation for the
project's HBJSON files, with a matching frontend query invalidation.
The plan flags every spot this diverges.

## Climate feature — this feature was realigned (2026-06-13) — ⚠️ SUPERSEDED 2026-06-23

> **Superseded by the 2026-06-23 reconciliation below.** This section
> predicted the sun-path backend would live in a "Climate Phase 1"
> module. In practice it was built in `project_location` (commit
> `005839dc`), and the Climate work that actually shipped is app-wide
> reference data (datasets / nearest-station lookup) that never owned the
> sun path. The sun-path backend was then deleted on 2026-06-22. Read the
> reconciliation section for the current, accurate picture; the text
> below is retained only for historical context.

Ed greenlit a project-scoped **Climate** top-level tab + service
(`planning/archive/climate/`) and asked to build it **first**. The
sun-path backend therefore moved to **Climate Phase 1** (D-CL-2), and
this feature was realigned to **frontend-only**, consuming the Climate
`GET /projects/{id}/sun-path` endpoint.

Impact on this feature:
- **Validates D-SP-1.** A separate, project-scoped, location-reactive
  endpoint is exactly what the Climate tab and the Model viewer both
  consume — the decoupling is right; Climate now owns it.
- **Backend moved out.** The builder, endpoint, MCP tool, and the
  true-north fixture (D-PL-4) live in Climate Phase 1, not here.
- **This feature renders only** — it points the Site & Sun lens at the
  Climate endpoint and draws the diagram over geometry. The Climate tab
  is a *second* consumer (standalone sun-path visual + climate charts);
  sun-path-in-the-3D-viewer stays a model-viewer feature.
- **Sequencing:** this feature now **depends on Climate Phase 1**.
  Build Climate Phase 1 → then this render and the Climate tab can
  proceed in parallel.

## Reconciliation — backend home + build/delete history (2026-06-23)

This supersedes the 2026-06-13 "realigned to Climate Phase 1" framing.
The facts, traced from `main`:

1. **The backend lived in `project_location`, never a separate Climate
   module.** Commit `005839dc` (2026-06-13) added
   `project_location/sun_path.py`, `service.get_project_sun_path`, the
   `GET /projects/{id}/sun-path` route, and the MCP tool — all reading
   the `project_location` row. This is correct: `project_location` owns
   the coordinates the sun path is a pure function of.
2. **It was deleted on 2026-06-22** (commit `0056f6df`) during the
   Climate pages / PHI·Phius·EPW overhaul. The deletion removed the
   builder, route, MCP tool, tests, **and** a *separate* Climate-page
   sun-path panel (a second, since-retired consumer). The commit note:
   "sun visualization remains in the Model tab" — confirming the
   Model-Viewer render (this feature) is still wanted.
3. **The Climate feature that shipped is app-wide reference data**
   (`climate_dataset` / `climate_dataset_location`, nearest-station
   lookup) — **not** project-scoped, and it does **not** store project
   location or serve the sun path. The earlier assumption that Climate
   would "own" a project-scoped sun-path endpoint never materialized.
4. **Location data shape is unchanged for our purposes.** The overhaul
   added derived geodata columns (`county`, `county_fips`, `country`,
   `climate_zone`, `geodata_provenance`) and renamed `site_address` →
   `street_address` + added `postal_code`, but
   `latitude / longitude / elevation_m / true_north_deg / time_zone`
   are intact and still read via `repository.get_location(...)`.

**Decision:** rebuild the sun-path backend in **`project_location`**
(Phase 0), as a faithful restore of `005839dc` re-verified against
today's repo. D-SP-1 stands (decoupled, location-reactive endpoint, not
baked into `/model_data`); only the *owning module* is clarified —
`project_location`, the coordinate owner, not "Climate". The surviving
wire DTOs in `model_viewer.schemas.ladybug` are reused as-is (no wire
shape change), exactly as `005839dc` did.

## Open questions

- **OQ-SP-1 · Compass ticks/arcs parity.** The MVP `SiteSunLayer`
  renders only the dashed hourly analemmas, and only from the (always
  null) `sun_path.sunpath` branch. Full V1 parity also draws
  `monthly_day_arc3d` and the compass (`all_boundary_circles`,
  `major_azimuth_ticks`, `minor_azimuth_ticks`). Phase 1 completes the
  renderer for arcs + compass; confirm the frontend `SunPathAndCompass`
  DTO type carries the `compass` branch (the backend DTO does). Not a
  fork — just scope tracked here so it is not lost.
