---
DATE: 2026-06-12
TIME: 17:19 EDT
STATUS: Complete — archived PRD. Phases 1–3 completed in
  planning/archive/project-location/phases/. Sun-path consumer
  deferred to model-viewer (seam documented in §10).
AUTHOR: Claude (for Ed)
SCOPE: Product + behavior contract for the project-level Location
  section and its EPW linkage. Resolves the open storage decision
  (README item 3) and defines the REST + MCP surface, validation,
  units, and UI.
RELATED:
  - planning/archive/project-location/README.md (router)
  - planning/archive/project-location/decisions.md (resolved forks)
  - planning/archive/project-location/PLAN.md (phase sequence)
  - context/PRD.md §4 (public-read access), §6.1 (thin relational
    layer), §11.5 (SI canonical), §10.3 (MCP)
  - planning/archive/model-viewer/decisions.md D-07 (sun-path
    consumer), phases/phase-02 + phase-06 (pending wiring)
  - backend/features/assets/registry.py (asset-kind registry)
---

# Project Location — PRD

## 1. Goal

Give every project a durable, project-level **Location** section:
latitude, longitude, elevation, time zone, true-north rotation, and a
display address — plus a robust link to an uploaded **EPW** weather
file that can pre-fill those fields and remain on hand for future
climate-aware features. Editors edit; public viewers read. The data is
SI-canonical on the wire and MCP-readable from day one.

Location is **durable project metadata**, not versioned
design-by-discipline data — it lives in the thin relational layer
(context/PRD.md §6.1), never in the project document JSONB.

## 2. Scope

**In scope (v1):**

1. Core location fields with validation (§4, §8).
2. REST read/write at `/api/v1/projects/{id}/location` (§5).
3. MCP read tool exposing location (§5.3).
4. A "Location" section in Project Settings — editor edit, viewer
   read-only (§7).
5. EPW upload as a project asset (`asset_kind='epw'`), header parse →
   one-click pre-fill suggestion, source URL, non-blocking
   entered-vs-EPW mismatch warning, full file retained in R2 (§6).

**Out of scope (v1):** sun-path rendering and the extraction wiring
that populates the model-viewer `sun_path` key — **deferred to
model-viewer** (decisions.md D-PL-2). This PRD documents the seam
(§10) so that integration is a clean handoff, not a rediscovery.
Also out: climate summary / degree-days / Phius-PHI dataset alignment
/ WUFI-PHPP cross-checks (anticipated future consumers — kept
unblocked by retaining the parsed EPW, not built now), map preview,
address→lat/long geocoding.

## 3. Resolved decisions (see decisions.md for rationale)

- **D-PL-1 Storage — dedicated `project_location` table + feature
  module.** A 1:1 table keyed by `project_id` (PK = FK), owned by a
  new `backend/features/project_location/` module. Relational (honors
  the README lean), but kept out of the `projects` row and the
  dashboard list query so location can grow (EPW, climate fields)
  without fattening the hot path.
- **D-PL-2 Sun-path wiring deferred to model-viewer.** This plan
  ships the location *data*; model-viewer owns reading it into
  extraction. Seam in §10.
- **D-PL-3 EPW parse owned by this feature, not the assets feature.**
  The generic asset upload path stays generic; EPW header parsing
  lives behind a `project_location` endpoint that reads the asset
  bytes. The assets `_validate_magic` gets only a light "looks like
  EPW" check.
- **D-PL-4 True-north stored in the ladybug/honeybee convention**
  (counterclockwise degrees from +Y; 90°=West, 270°=East), validated
  `[0, 360)`. The exact sign is re-verified against the installed
  `ladybug` at consumer-integration time with a known-orientation
  fixture (§10).
- **D-PL-5 API — dedicated `GET/PUT /projects/{id}/location`**, not a
  fold into the generic project `PATCH`. Location has its own
  validation, its own EPW actions, and its own MCP resource.

## 4. Data model

New 1:1 table `project_location` (one row per project, created lazily
on first write; absent row ⇒ "no location set"):

| Column           | Type               | Null | Notes |
|------------------|--------------------|------|-------|
| `project_id`     | uuid PK            | no   | FK → `projects(id)` ON DELETE CASCADE |
| `latitude`       | double precision   | yes  | decimal degrees, `[-90, 90]` |
| `longitude`      | double precision   | yes  | decimal degrees, `[-180, 180]` |
| `elevation_m`    | double precision   | yes  | metres above sea level (SI) |
| `time_zone`      | text               | yes  | IANA name (e.g. `America/New_York`); UTC offset derived via `zoneinfo` |
| `true_north_deg` | double precision   | yes  | ladybug convention (D-PL-4), `[0, 360)` |
| `site_address`   | text               | yes  | free text |
| `city`           | text               | yes  | display |
| `state`          | text               | yes  | display (state / region / province) |
| `epw_asset_id`   | text               | yes  | pointer to the project's primary EPW `project_assets.id`; **no hard FK** (assets soft-delete — service resolves/validates) |
| `epw_source_url` | text               | yes  | provenance note/URL (e.g. climate.onebuilding.org) |
| `created_at`     | timestamptz        | no   | `now()` |
| `updated_at`     | timestamptz        | no   | `now()` |

Notes:
- All location values nullable so the section can be partially filled.
- `time_zone` stored as IANA (DST-aware, human-meaningful, derivable
  to the numeric offset ladybug wants). Derivable from lat/long via a
  client/server geocode later — not required v1; user picks/enters it.
- `epw_asset_id` is a soft pointer: the EPW lives in the asset system
  (R2), is independently listable/downloadable, and is **not** the
  owner of the location fields. Clearing the EPW does not clear the
  fields and vice-versa.

## 5. API surface

All routes go through the existing access seam
(`require_project_access`, context/PRD.md §4.1): `view` is public,
`edit` requires an editor session. SI on the wire (§9).

### 5.1 `GET /api/v1/projects/{id}/location`
Public-readable. Returns the location row (or an all-null shape with a
`is_set: false` flag if no row exists yet) plus a resolved EPW
descriptor (id, filename, source URL, parsed-header snapshot) when
`epw_asset_id` is present and the asset is live.

### 5.2 `PUT /api/v1/projects/{id}/location`
Editor-only. Upserts the row. Validates ranges (§8). Returns the saved
location **and** a non-blocking `warnings[]` array (e.g. EPW-mismatch,
§8). Partial payloads allowed (unset fields untouched, explicit
`null` clears).

### 5.3 MCP read tool `get_project_location`
Read-only, `project:read` scope, mirrors the `tool_list_projects`
pattern (`backend/features/mcp/tools.py`). Registered in
`build_mcp_server()` (`backend/features/mcp/server.py`). Returns the
same SI shape as 5.1. Location is exactly the kind of fact LLM
workflows ask for ("what's the project's latitude / climate zone
source?"), so it ships day one.

### 5.4 EPW endpoints (Phase 3)
- `POST /api/v1/projects/{id}/location/epw/parse?asset_id=...` —
  editor-only; reads the uploaded EPW's header bytes (via the assets
  service's object-prefix read), returns a parsed-suggestion shape
  (lat/long/elevation/time_zone/city/state) **without** persisting to
  the location row. The UI offers one-click "Apply". Also persists the
  parsed snapshot into the asset's `metadata` JSONB for later reuse.
- Setting the primary EPW + its source URL is done through the normal
  `PUT /location` (`epw_asset_id`, `epw_source_url` fields).

## 6. EPW linkage flow

1. **Upload** — editor uploads a `.epw` via the Location section. Goes
   through the existing R2 asset pipeline (upload-intent → signed PUT →
   complete-upload) with the new `asset_kind='epw'` (Phase 3). The
   full file is retained in R2, listable/downloadable like any asset.
2. **Light validation** — assets `_validate_magic`
   (`backend/features/assets/service.py`) gains a minimal EPW check:
   first line begins `LOCATION,` with the expected field count.
   Failure ⇒ asset marked failed, 422.
3. **Parse + suggest** — frontend calls `POST …/location/epw/parse`.
   The `project_location` service parses the `LOCATION` header
   (dependency-free; no ladybug needed) and returns
   lat/long/elevation/time_zone/city/state as a **suggestion**.
4. **Apply (one-click, editable)** — user accepts → frontend writes
   the values via `PUT /location`, having also set `epw_asset_id` and
   `epw_source_url`. Fields remain freely editable afterward; the EPW
   is a data source, not the owner.
5. **Mismatch warning** — if entered lat/long differ from the EPW
   header by ≳1°, `PUT /location` returns a non-blocking warning (§8).
6. **Retained for the future** — the parsed snapshot lives in
   `asset.metadata.epw_location`; the whole EPW stays in R2. Future
   consumers (climate summary, degree days, WUFI/PHPP cross-checks)
   can read either without re-upload. We do not build those now.

## 7. UI behavior

A new **"Location"** section in `ProjectSettingsModal`
(`frontend/src/features/projects/components/ProjectSettingsModal.tsx`),
placed after the metadata section and before MCP tokens, matching the
existing `settings-section` pattern:

- **Editors** see editable fields (coordinates, elevation, time zone,
  true-north, address/city/state), the EPW uploader, source-URL field,
  an "Apply EPW values" affordance after parse, and the non-blocking
  mismatch banner.
- **Viewers** see the same data read-only (no inputs, no uploader;
  EPW downloadable if present), consistent with the modal's existing
  viewer branch.
- **Empty state** — "No location set" with a short hint; this is the
  state the model-viewer Site & Sun lens points at today.
- Optional (nice-to-have, not required): a read-only Location card on
  the Status tab. Proposed but not required for v1.

Map preview and geocoding are explicitly **not** in v1.

## 8. Validation

Server-authoritative (Pydantic field validators on the location
models), mirrored client-side for fast feedback:

- `latitude ∈ [-90, 90]`, `longitude ∈ [-180, 180]` — hard errors.
- `true_north_deg ∈ [0, 360)` — hard error.
- `elevation_m` — sane bounds (e.g. `[-500, 9000]`) — hard error
  outside; otherwise accepted.
- `time_zone` — must resolve via `zoneinfo` if provided — hard error
  if unknown.
- **EPW mismatch** — entered lat/long vs parsed EPW header differ by
  ≳1° ⇒ **non-blocking warning** in the `PUT` response `warnings[]`,
  never a rejection. (README item 6.)

## 9. Units (context/PRD.md §11.5)

- **SI on the wire**, always. `elevation_m` in metres; coordinates in
  decimal degrees; true-north in degrees.
- **Frontend display conversion** applies only to elevation
  (m ↔ ft) via `frontend/src/lib/units/` helpers, reactive to the
  IP/SI toggle. Latitude, longitude, and true-north are angular
  degrees — unit-system-invariant, displayed as-is in both modes.

## 10. Sun-path consumer seam (deferred — model-viewer owns wiring)

Per D-07 and decisions.md D-PL-2, the sun-path integration is **not**
built here. What model-viewer needs, recorded so the handoff is clean:

- **Inputs:** `latitude`, `longitude`, `true_north_deg`, and
  `time_zone` (→ numeric UTC offset via `zoneinfo`) from
  `GET /projects/{id}/location` (or the location repository directly,
  in-process within the extraction service).
- **Computation:** model-viewer extraction
  (`planning/archive/model-viewer/phases/phase-02-extraction-backend.md`)
  already owns `ladybug`/`honeybee` and the `sun_path` wire key
  (currently always `null`). It calls `Sunpath.from_location(...)`
  with the location inputs and populates `sun_path`.
- **Renderer:** model-viewer Phase 6 leaves the Site & Sun renderer
  keyed off `sun_path != null` with dashed-line styling stubbed; no
  Model-tab rework expected when the key goes non-null.
- **True-north verification (D-PL-4):** the implementing agent
  confirms the ladybug `north_angle` sign against a known-orientation
  fixture before trusting output — a wrong sign silently rotates the
  diagram. The stored convention is CCW-from-+Y, 90°=West, 270°=East.
- **Trigger:** schedule this wiring when model-viewer Phase 2 (for the
  extraction payload + ladybug dep) **and** Phase 6 (for the renderer
  stub) are both merged. Until then the lens shows the building +
  shades + the "Set project location" hint; this feature's Phase 2 UI
  is where the user sets that location.

## 11. Acceptance criteria

1. A project can have location set/updated/cleared via
   `PUT /location`; reads return SI values for editor and viewer;
   range validation rejects out-of-bounds and accepts valid input.
2. `get_project_location` MCP tool returns the same data under a
   `project:read` token; write is unauthenticated-rejected.
3. An editor can upload an EPW, parse it, one-click-apply the
   suggested values, edit them afterward, set a source URL, and see a
   non-blocking warning on a >1° mismatch. The full EPW is downloadable
   and the parsed header is retained in asset metadata.
4. Viewers see location read-only and can download the EPW; no write
   affordances render.
5. Units: elevation toggles m/ft in the UI; coordinates/north stable
   across IP/SI. Wire stays SI.
6. `make ci` green; focused vitest + pytest for the new module pass.
