---
DATE: 2026-06-12
TIME: -
STATUS: Ready for handoff — requires Phase 1 merged (the
  `project_hbjson_files` table and link flow must exist).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Model Viewer Phase 2 — backend HBJSON
  extraction (US-VIEW-7): honeybee deps, schema port from V1, bulk
  /model_data endpoint, per-feature MCP routes, upload-time geometry
  summary job (D-13).
RELATED:
  - planning/features/model-viewer/PLAN.md
  - planning/features/model-viewer/PRD.md (§5 backend contract)
  - planning/features/model-viewer/decisions.md (D-02, D-12, D-13, D-07)
  - context/user-stories/40-model-viewer.md (US-VIEW-7 — canonical)
  - research/v1-3d-model-viewer-reference.md (§2 backend tour, §9
    userData contracts, §16 checklist)
---

# Phase 2 — Extraction backend

## 1. Goal

`GET /api/v1/projects/{id}/hbjson-files/{file_id}/model_data` returns
a `CombinedModelData` payload — faces (punched, triangulated),
spaces + floor segments, ventilation, hot water, merged shades,
`load_summary` — SI canonical. Per D-15 the payload is **precomputed
at upload** by the extraction job and served from R2 as an immutable
gzip'd artifact (`Cache-Control: immutable` + ETag); there is no
per-request parse and no in-memory cache. The same job fills the
`extracted_*` columns Phase 1 created (one parse does both — D-13 +
D-15). Per-feature read endpoints ship alongside for MCP and read
the same artifact. `/model_data` failures follow the D-16 taxonomy
(permanent vs. transient). The frontend never builds against a mock
wire format (this phase precedes all 3D work).

US-VIEW-7 criteria 1–12 are the contract, as amended by PRD §4/§5
deltas (no EPW/sun-path port — D-07; declarative-materials language —
irrelevant to backend; D-12 four U/R fields; D-15 artifact serving —
amends crit. 9; D-16 error taxonomy).

## 2. Required reading (in order)

1. `context/user-stories/40-model-viewer.md` — US-VIEW-7 (and
   US-VIEW-1 crit. 5 for the summary job).
2. `planning/features/model-viewer/PRD.md` §5 (deltas: D-02 deps,
   SI wire, no cache, D-12, summary job).
3. `research/v1-3d-model-viewer-reference.md` §2 (backend tour:
   routes, services, schema subtrees), §9 (what each loader expects —
   the DTO fields are the frontend's contract), §16 starred items.
4. V1 source (read-only; never modify `../ph-navigator/`):
   - `../ph-navigator/backend/features/hb_model/services/model_elements.py`
   - `../ph-navigator/backend/features/hb_model/schemas/` —
     `honeybee/`, `honeybee_energy/`, `honeybee_ph/`,
     `honeybee_phhvac/`, `ladybug/`, `ladybug_geometry/`
5. `context/CODING_STANDARDS.md`.

## 3. Dependencies (D-02)

```
cd backend && uv add honeybee-ph ladybug-core
```

`honeybee-ph` pulls honeybee-core / honeybee-energy /
ladybug-geometry transitively. Never edit `uv.lock` by hand; never
use pip. If `uv add` resolution conflicts with existing pins, stop
and report rather than forcing versions — these are PH-Tools' own
libraries and should resolve cleanly on Python 3.11.

## 4. Schema port

Into `backend/features/model_viewer/schemas/` (subpackage of the
Phase 1 module; split files by source library as V1 did). Pydantic v2
only: `ConfigDict`, `field_validator`, `model_validator`. Port
field-for-field — **no field renames vs. V1** (US-VIEW-7 crit. 8: the
frontend loaders key off these names) — except:

- **Airflow fields are m³/s.** Delete V1's pre-Pydantic `× 3600`
  conversion entirely (US-VIEW-7 crit. 1). Document the unit in the
  field description (`v_sup` m³/s, etc.).
- **Constructions serialize all four thermal fields** (D-12):
  `u_factor`, `u_value`, `r_factor`, `r_value` — for opaque AND
  window constructions, straight from honeybee-energy (Factor =
  films included; Value = films excluded). No relabeling on the wire.
- **`load_summary`** is new (US-VIEW-7 crit. 3):
  `{air_boundaries_skipped, faces_extracted, spaces_extracted,
  shade_groups_extracted, extraction_warnings: [str]}`.
- `sun_path` key exists and is **always `null` in this phase** —
  D-07/OQ-1: sun-path generation is blocked on the deferred
  `project-location` feature. Keep the field nullable so the wire
  shape doesn't change when it lands. Do not port V1's
  `services/epw.py`.

## 5. Extraction service

`backend/features/model_viewer/extraction.py` (or split further if
any module nears the CODING_STANDARDS size limit), ported from V1
`model_elements.py`:

- `Model.from_dict()` parse; **normalize model units to Meters
  before extraction** (`Model.convert_to_units` — HBJSON exports
  arrive in Inches/Feet/Meters; the Hillandale fixture is Inches and
  the wire is SI); faces via punched geometry + triangulation;
  apertures; PH spaces + floor segments; ventilation systems with
  `duct_type` (Supply/Exhaust) populated (US-VIEW-7 crit. 7);
  hot-water tree (System → Trunk → Branch → Fixture → Segment, plus
  flat recirc).
- **AirBoundary skip** (crit. 1): faces whose construction fails
  opaque validation are skipped; each skip logs one line; total in
  `load_summary.air_boundaries_skipped`.
- **Shade merging** (crit. 5): tolerance-aware vertex merge
  (`Point3D.is_equivalent`, tol=1e-7) per `display_name` group,
  server-side — one merged mesh per group.
- **Artifact serving (D-15, amends crit. 9):** the extraction runs
  once, in the upload job, which writes the full `CombinedModelData`
  JSON to R2 gzip'd under a derived key (e.g.
  `derived/{asset_id}/model_data.json.gz` via the existing
  `R2Client`; NOT a `project_assets` row). `GET /model_data` streams
  the artifact with `Cache-Control: immutable` + ETag. Do not
  memoize the parsed Model in process memory. Self-healing: artifact
  missing + `extraction_status='pending'` → extract synchronously,
  persist, serve; `'failed'` → D-16 permanent error.
- **Error taxonomy (D-16):** `/model_data` and the per-feature
  routes return typed errors via the standard `api_error` shape with
  a `{"kind": "permanent" | "transient"}` detail. Permanent =
  `Model.from_dict()` rejection (invalid HBJSON; schema-version
  mismatch — include the file's declared `version` vs. the backend
  pin in the message). Transient = R2/network. The job writes the
  permanent cause to `extraction_error`.
- Non-fatal anomalies append to `extraction_warnings`, never raise.

## 6. Routes

Extend the Phase 1 router:

| Route | Access | Returns |
|---|---|---|
| `GET /{file_id}/model_data` | view | `CombinedModelData` (the viewer's only data call) |
| `GET /{file_id}/faces` | view | `[Face]` |
| `GET /{file_id}/spaces` | view | `[Space]` |
| `GET /{file_id}/ventilation_systems` | view | `[VentSystem]` |
| `GET /{file_id}/hot_water_systems` | view | `[HotWaterSystem]` |
| `GET /{file_id}/shading_elements` | view | `[ShadeGroup]` |

No `/sun_path` route this phase (D-07). All six are MCP-exposed via
`tool_*` functions per the Phase 1 pattern (NEW-LLM-API-1: "list all
spaces with v_sup < X" style agent queries hit the per-feature
routes; the viewer hits `/model_data`).

## 7. Geometry summary job (completes D-13)

On the Phase 1 link step (`POST /hbjson-files`), schedule a FastAPI
`BackgroundTasks` job (the assets module's thumbnailer shows the
pattern): parse the HBJSON **once** and from that single parse
(a) write `extracted_volume_m3` (Σ `room.volume`),
`extracted_envelope_area_m2` (Σ exterior face areas),
`extracted_floor_area_m2` (iCFA per honeybee-ph spaces), and
(b) build + persist the `CombinedModelData` artifact (D-15, §5);
then `extraction_status` → `success`/`failed` (+`extraction_error`,
`extracted_at`). A failed extraction must NOT block file management
(the file stays listable, renamable, deletable) — but it is NOT
renderable: the list payload's `extraction_status` drives the
Phase 1 badge and `/model_data` returns the D-16 permanent error.
Nothing consumes the summary columns yet (US-ENV-14 is FUTURE).

## 8. Test fixtures

- Copy `planning/features/model-viewer/ph_nav_v2_example.hbjson` →
  `backend/tests/fixtures/ph_nav_v2_example.hbjson` (canonical
  fixture, Ed 2026-06-12). Delete the superseded
  `planning/features/model-viewer/my_example_project.hbjson`.
- Golden counts for assertions (from PLAN.md coverage map):
  4 rooms · 25 faces (16 Wall / 5 Floor / 4 RoofCeiling) · boundary
  conditions Outdoors 12 / Surface 6 / Ground 7 · 30 apertures ·
  5 shade groups (distinct display_names) · 4 PH spaces / 5 floor
  segments · 4 supply + 4 exhaust duct elements · hot-water tree
  trunk → branch → fixture → 4 segments · `air_boundaries_skipped == 0`.
- **Scale fixture (Ed 2026-06-12):** copy
  `planning/features/model-viewer/Hillandale_Gateway_NAR_260402.hbjson`
  (51.99 MB) → `backend/tests/fixtures/` as well. Golden counts:
  583 rooms · 6,178 faces (4,591 Wall / 798 Floor / 789
  RoofCeiling) · BCs Outdoors 831 / Surface 5,248 / Ground 99 ·
  1,024 apertures · 253 orphaned shades sharing ONE display_name
  (merge → **1** shade group) · 583 PH spaces / 583 floor segments ·
  weighting 1.0 ×561 / 0.0 ×22 · 71 named constructions (9 opaque /
  62 window) · NO ducts, NO pipes (empty arrays on the wire — the
  disabled-lens real-data case) · `air_boundaries_skipped == 0` ·
  schema 2.0.4 · units **Inches** (the units-normalization test) ·
  tolerance 0.05. Mark its heavyweight tests so the suite stays
  fast (e.g. a pytest marker run in CI but skippable locally), and
  **record its end-to-end extraction wall-time in STATUS.md** —
  this is the D-15 perf canary, deliberately measured now rather
  than at Phase 6 acceptance.
- Gaps in BOTH fixtures (Adiabatic, AirBoundary skip > 0, recirc
  piping / any duct-pipe geometry at scale, intermediate weighting
  buckets): unit-test with minimal hand-built HBJSON dicts in the
  test body.

## 9. Verification gate

1. **pytest**: golden-count assertions on `/model_data` against BOTH
   fixtures (incl. Hillandale's 253-shades→1-group merge and
   Inches→Meters normalization — spot-check a known face area);
   m³/s on the wire asserted against a hand-computed value; all four
   U/R fields present on opaque + window constructions; shade groups
   merged to 5 (primary fixture); duct_type split 4/4; HW tree
   depth; AirBoundary skip unit test (synthetic dict); the upload
   job writes `extracted_*` AND the R2 artifact in one parse, with
   status transitions incl. a failure path; `/model_data` serves the
   artifact with `Cache-Control: immutable` + ETag asserted;
   self-healing path (artifact deleted, status pending → re-extracts
   and persists); D-16 taxonomy: junk-JSON file → permanent error
   naming the cause, simulated R2 outage → transient; per-feature
   routes return subsets consistent with `/model_data`; viewer-role
   can GET everything (read endpoints are view-access).
2. **MCP**: tool-level tests following existing `test_*_mcp.py`
   patterns.
3. **Closeout**: `make format` + `make ci` green. `graphify update .`.

## 10. Exit criteria

US-VIEW-7 criteria pass as amended (§4: no EPW port, sun_path null,
D-12 fields). Frontend Phase 3 can be built against the real wire.
STATUS.md ledger updated with evidence.
