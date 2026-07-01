---
DATE: 2026-07-01
TIME: -
STATUS: Not started.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 1 — emit a deduplicated,
  detailed opaque `constructions` map in the `/model_data` artifact.
  Additive only; no migration/versioning (D-9 — prod is empty).
RELATED:
  - ../PRD.md §2 (verified feasibility), §5 (D-2, D-3, D-9), §6 (data
    contract), §10.1 (deployment — prod is empty) — read in full first
  - ../PLAN.md Phase 1
  - backend/features/model_viewer/schemas/honeybee_energy.py
  - backend/features/model_viewer/extraction.py
  - backend/features/model_viewer/model_data.py (context only)
---

# Phase 1 — Backend: dedup `constructions` map

## 1. Goal

`/model_data` gains a top-level, opaque-only, **deduplicated**
`constructions` map — `{ identifier → DetailedOpaqueConstruction }` —
where each detailed construction carries its ordered material layers with
thickness, conductivity, PH color, and honeybee-ph `divisions`
(segment cells + steel-stud spacing). Each face keeps only its existing
thin construction summary and already carries the `identifier` needed to
key into the map. No frontend consumer yet — this is a wire-contract
change only. **No migration or artifact versioning** (PRD D-9): the
one-day-old prod has no projects, hence no cached artifacts to re-extract,
so the map simply appears on every extraction from this change forward.
Purely additive; independently mergeable.

## 2. Required reading (in order)

1. `../PRD.md` §2, §5 (D-2/D-3, D-9), §6, §10.1 — the verified data path,
   the dedup-map decision, the recursive material shape, and why no
   migration/versioning is needed (prod is empty).
2. `backend/features/model_viewer/schemas/honeybee_energy.py` — the exact
   schemas today: `EnergyMaterialSchema` (l.14-25, the flat mirror that
   drops everything we need), `OpaqueConstructionSchema` (l.28-42, the
   AirBoundary tripwire — note the required `materials`),
   `WindowConstructionSchema` (l.45-53, out of scope),
   `FaceEnergyPropertiesSchema` (l.56-59, the per-face `construction`
   field this phase re-points at a thin summary).
3. `backend/features/model_viewer/extraction.py:133-175` —
   `_faces_from_model`: the construction is built at l.143
   (`OpaqueConstructionSchema(**energy_prop.construction.to_dict())`),
   thermal fields applied at l.156 (`_apply_thermal_fields`, def at
   l.178), assigned to the face at l.157. This is where the dedup insert
   + summary split happens. Note `extract_model_data` (l.110-130) returns
   `CombinedModelDataSchema(...)` — the top-level `constructions` map is
   added there.
4. `backend/features/model_viewer/model_data.py` — the storage/serve
   layer, **read for context only, no change this phase**:
   `_extract_and_persist` (l.135-183) writes the artifact from
   `data.model_dump(...)` (l.164), so the new `constructions` field flows
   through automatically once it is on the schema.
5. Sample data ground truth: `~/Desktop/project_2540_assemblies.json`
   (Ed's export) — the exact honeybee-ph `to_dict()` shape this phase
   consumes: `materials[].properties.ph.{ph_color, divisions{
   column_widths, row_heights, steel_stud_spacing_mm, cells[{row, column,
   material}]}}`. **Note:** a homogenized layer's outer material may have
   **no `ph_color`** (seen on the steel-stud layer) — `ph_color` is
   optional.

## 3. Work breakdown

### 3.1 New schemas in `schemas/honeybee_energy.py`

Add a **recursive** material schema and a detailed construction schema;
keep a **thin** face summary. Pydantic v2 only.

```python
class PhColorSchema(BaseModel):
    a: int; r: int; g: int; b: int

class DivisionCellSchema(BaseModel):
    row: int
    column: int
    material: ConstructionMaterialSchema        # recursive (D-3)

class DivisionsSchema(BaseModel):
    column_widths: list[float] = []             # meters; [] = homogeneous
    row_heights: list[float] = []
    steel_stud_spacing_mm: float | None = None
    cells: list[DivisionCellSchema] = []

class PhMaterialPropsSchema(BaseModel):
    ph_color: PhColorSchema | None = None        # absent on some layers
    divisions: DivisionsSchema = DivisionsSchema()

class MaterialPropertiesSchema(BaseModel):
    ph: PhMaterialPropsSchema | None = None      # `type`/`ref` ignored

class ConstructionMaterialSchema(BaseModel):
    # existing flat fields (keep) + the previously-dropped ones
    type: str
    identifier: str                              # NEW
    display_name: str | None = None              # NEW (on hybrid layers)
    thickness: float
    conductivity: float
    specific_heat: float
    roughness: str
    visible_absorptance: float
    thermal_absorptance: float
    solar_absorptance: float
    density: float
    properties: MaterialPropertiesSchema | None = None   # NEW → ph data

class DetailedOpaqueConstructionSchema(BaseModel):
    """Materials-bearing; also the AirBoundary tripwire (was
    OpaqueConstructionSchema)."""
    identifier: str
    type: str
    u_factor: float = Field(default=0.0)
    u_value: float = Field(default=0.0)
    r_factor: float = Field(default=0.0)
    r_value: float = Field(default=0.0)
    materials: list[ConstructionMaterialSchema]   # required = tripwire

class FaceConstructionSummarySchema(BaseModel):
    """Thin per-face summary — no materials (D-2)."""
    identifier: str
    type: str
    u_factor: float = Field(default=0.0)
    u_value: float = Field(default=0.0)
    r_factor: float = Field(default=0.0)
    r_value: float = Field(default=0.0)
```

- The self-reference (`DivisionCellSchema.material`,
  `ConstructionMaterialSchema` used before definition) needs a forward
  ref + `ConstructionMaterialSchema.model_rebuild()` at module end (or
  `from __future__ import annotations`, already present at l.9, plus a
  `model_rebuild()`). Verify serialization of a nested cell works.
- Pydantic ignores extra keys by default, so `properties.type`,
  `properties.ref`, `ph.id_num`, `ph.user_data` are dropped silently —
  intended. Only `ph_color` + `divisions` are captured.
- Repoint `FaceEnergyPropertiesSchema.construction`
  (`honeybee_energy.py:59`) to `FaceConstructionSummarySchema | None`.
- Keep `WindowConstructionSchema` / `ApertureEnergyPropertiesSchema`
  untouched (D-1, apertures out of scope).

### 3.2 Top-level map on the combined schema

In the schema that `extract_model_data` returns (`CombinedModelDataSchema`,
imported into `extraction.py`), add:
```python
constructions: dict[str, DetailedOpaqueConstructionSchema] = {}
```
Default empty so older code paths / tests without opaque faces stay
valid.

### 3.3 Extraction: build detailed, dedup, summarize

In `_faces_from_model` (`extraction.py:133-175`), replace the l.143
build + l.157 assign with:

- Build the **detailed** construction:
  `detailed = DetailedOpaqueConstructionSchema(**energy_prop.construction.to_dict())`
  — this keeps the AirBoundary `ValidationError` tripwire (materials
  required), so the existing `except ValidationError:` skip/count logic
  (l.144-151) is unchanged.
- `_apply_thermal_fields(detailed, energy_prop.construction)` (l.156) —
  now applied to the detailed object.
- Insert into the map once: `constructions.setdefault(detailed.identifier,
  detailed)` (thread a `constructions: dict` through `_faces_from_model`
  and return it alongside `face_dtos`, or collect into a passed-in dict —
  mirror how `summary` is threaded).
- Assign the face a **summary**: `face_dto.properties.energy.construction
  = FaceConstructionSummarySchema(identifier=detailed.identifier,
  type=detailed.type, u_factor=detailed.u_factor, ...)`.
- `extract_model_data` passes the collected map into
  `CombinedModelDataSchema(constructions=..., ...)`.

Net: extraction still calls only `.to_dict()` — no honeybee re-query, no
new parse logic. The per-face payload gets **smaller** (summary, no
materials); the detailed layer data lives once per unique construction.

## 4. No migration / versioning (D-9) — but reset the DB on deploy

No migration or versioning is built in this phase: prod is one day old
with no projects, so there are no cached artifacts to re-extract.
`data.model_dump(...)` in `_extract_and_persist` (`model_data.py:164`)
carries the new `constructions` field automatically — no change to
`model_data.py`, `repository.py`, or `alembic/`. Artifact versioning is a
deferred follow-up (PRD §12) — do **not** build it here.

**⚠️ Deploy reminder (don't forget):** when this ships to production, do a
**DB reset/restart on the deploy** while it is still empty — the
clean-slate step chosen in lieu of a migration (PRD §10.1 / STATUS). It is
safe only because prod has no real projects; the window closes once real
data lands. (Belt-and-suspenders: a stray artifact predating the change
degrades gracefully — button hidden, PRD §4.5 — and is fixed by re-upload
/ re-seed.)

## 5. Out of scope

- Any frontend change (Phases 2-4) — types, adapter, modal, button.
- Window/aperture construction detail (D-1).
- A dedicated per-construction endpoint or MCP tool — the modal reads the
  `constructions` map from the already-fetched `/model_data` artifact
  (the dict is not a list, so it is not exposed via the `_subset_route`
  passthrough, `routes.py:94-97` — leave those routes alone).
- Any migration, `model_data_schema_version` column, or serve-path
  staleness logic — none are code changes in this phase (§4, D-9). The
  DB reset is an operational **deploy** step, not code (§4 reminder).

## 6. Verification gate

1. **Backend pytest** (`backend/tests/test_model_viewer_extraction.py`
   or a sibling): commit a **synthetic** fixture built from the three
   sample construction kinds (flat / hybrid / steel-stud) — small enough
   to live in the public repo (no licensed/heavy HBJSON). Assert:
   - `constructions` dedups by identifier (one entry per unique
     construction even when many faces share it);
   - a flat layer has `divisions.cells == []`;
   - a hybrid layer preserves N cells whose `column_widths` are present,
     each cell material carrying `ph_color`;
   - a steel-stud layer preserves `steel_stud_spacing_mm` (e.g. 406.4);
   - the per-face `construction` is the thin summary (no `materials`);
   - AirBoundary faces still skip + count (tripwire intact).
2. **Full-model path check** (PRD §11): confirm ph material props survive
   `Model.from_dict(...).faces[..].properties.energy.construction
   .to_dict()`, not just the isolated-construction spike — a `uv run
   python` smoke against the canonical `ph_nav_v2_example.hbjson` (and
   Hillandale when the local fixture is present).
3. **Artifact shape smoke**: a `uv run python` extraction of the
   canonical fixture, asserting `constructions` is present and non-empty
   and that a face's `construction` is the thin summary. Record the
   Hillandale `/model_data` gzip size before/after in `../STATUS.md`
   (sanity check; the dedup map should keep growth modest).
4. **Types + closeout**: `uv run ty check`; `make format`; `make ci`.

## 7. Exit criteria

`/model_data` returns a deduplicated `constructions` map with full
layer/segment/color detail for opaque constructions; faces carry only the
thin summary; the AirBoundary tripwire still skips + counts; no migration
or versioning added; all backend gates green. No frontend behavior change.
