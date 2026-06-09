---
DATE: 2026-06-09
TIME: 14:30
STATUS: DRAFT — Phase 0 outline; awaiting PRD sign-off before
        promotion to detailed implementation plan.
AUTHOR: Ed May (with Claude)
SCOPE: Backend-only foundation for the Heat Pumps feature. No
       frontend, no UX wiring — those land in Phases 1–5.
RELATED:
  - planning/features/heat-pumps/PRD.md §4 (data model), §8 (backend
    contract), §9 (phasing)
  - context/CODING_STANDARDS.md (routes / models / service /
    repository split)
  - context/technical-requirements/data-model.md (project document
    body shape)
  - context/technical-requirements/api.md (REST conventions)
---

# Heat Pumps — Phase 0: Backend Foundation

## Why this slice

The full Heat Pumps feature is a six-phase rollout (PRD §9). Phase 0
is the backend foundation every later phase depends on. By the end of
this slice:

- Four new table arrays exist in the project document body
  (`tables.equipment.heat_pump_outdoor_equip`,
  `…_indoor_equip`, `…_outdoor_units`, `…_indoor_units`).
- Pydantic v2 row models enforce the field shapes from PRD §4.2–4.5.
- A `backend/features/heat_pumps/` feature module owns
  `models.py` / `repository.py` / `service.py` / `routes.py` per
  `context/CODING_STANDARDS.md`.
- REST endpoints (PRD §8.1) accept reads and JSON-Patch writes
  routed through the existing draft buffer.
- Referential-integrity checks (PRD §4.6) run server-side and reject
  invalid mutations with structured errors.
- Pytest coverage exists for every model validator, every service
  rule, and every REST endpoint happy-path + at least one
  error-path each.
- The schema migration is reversible and lands on a feature branch
  off main.

Phase 0 does **not** ship any frontend code, any DataTable wiring,
any Phius export logic, any ERV-cross-link surfaces, or any MCP
tools. Those land in Phases 1–5.

## Acceptance — Phase 0 done when

1. `tables.equipment` JSON Schema accepts the four new array keys.
   Existing projects (with `equipment.ervs`, `pumps`, `fans` only)
   load unchanged; the four new arrays default to `[]`.
2. `GET /api/v1/projects/{id}/equipment/heat-pumps` returns the
   composite shape `{ outdoor_equip: [], indoor_equip: [],
   outdoor_units: [], indoor_units: [] }`.
3. `PATCH /api/v1/projects/{id}/equipment/heat-pumps/{table}` with a
   JSON-Patch `add` op against a valid row passes validation,
   writes to the draft buffer, and round-trips on subsequent GET.
4. Invalid mutations are rejected with `422` and a structured error
   body identifying the field + violation:
   - Required field missing (`tag`, `model_number`,
     `outdoor_equip_id`, `indoor_equip_id`).
   - `tag` duplicate within table (case-insensitive trim).
   - FK reference to a non-existent equipment row, outdoor unit,
     ERV row, or room id.
   - Numeric out-of-range (e.g. negative capacities).
5. Referential-integrity rules from PRD §4.6 enforced:
   - Block delete on equip row with referencing units (`409`
     with structured `referenced_by` payload).
   - Cascade-null on unit delete with referencing indoor units.
   - Cascade-null on ERV delete with `linked_erv_unit_id` references.
   - Filter on room delete with `served_room_ids[]` references.
6. Alembic migration `XXXX_add_heat_pump_tables.py` is reversible
   (`upgrade` and `downgrade` both pass).
7. `cd backend && uv run pytest features/heat_pumps/` passes
   green; ≥ 1 test per model validator, per service rule, per
   REST endpoint.
8. `make ci` from the repo root passes — Ruff format, Ruff lint,
   Ty, Alembic migration, full pytest suite.

## Out of scope for Phase 0

- Frontend pages (Phases 1–4).
- Phius CSV export logic (Phase 5).
- `export_phius_hp_estimator` MCP tool (Phase 5).
- The four standard MCP tools per table (Phase 5).
- ERV reverse-lookup surface and column (Phase 4).
- Conditional column visibility (Phase 1).
- Seed data beyond a minimal smoke fixture for tests.

## Implementation outline

Sketch only — fill out before starting work.

### Step 1: Models

`backend/features/heat_pumps/models.py`:

- `HeatPumpOutdoorEquipRow` (Pydantic v2 `BaseModel` with strict
  config). 20 fields per PRD §4.2.
- `HeatPumpIndoorEquipRow`. Per PRD §4.3.
- `HeatPumpOutdoorUnitRow`. Per PRD §4.4.
- `HeatPumpIndoorUnitRow`. Per PRD §4.5.
- `HeatPumpsTableSlice` — composite container holding the four
  table arrays; lives under
  `ProjectDocumentBody.tables.equipment`.

Per-field validators:

- ULID id pattern (`^hp(oe|ie|ou|iu)_[0-9A-HJKMNP-TV-Z]{26}$`).
- Numeric ranges per PRD §4.2 / §4.3 (e.g. `seer2 >= 0`,
  `heating_cop_47f > 0` when non-null, etc.).
- Discriminator enums (`heating_data_type`,
  `cooling_data_type`) accept the listed string values plus null.
- Tag normalization (trim) before uniqueness check.

### Step 2: Repository

`backend/features/heat_pumps/repository.py`:

- Read: extract the four arrays from
  `project_versions.body.tables.equipment.*` via raw SQL JSON
  path expressions. No SQLAlchemy ORM.
- Write: thin layer over the existing draft-buffer JSON-Patch
  apply pipeline. Repository validates the patch op path is one
  of the four allowed table arrays.

### Step 3: Service

`backend/features/heat_pumps/service.py`:

- `compose_read(project_id, version_id) → HeatPumpsTableSlice`.
- `apply_patch(project_id, draft_id, table_key, json_patch_op) →
  ValidationResult`. Routes through:
  - Pydantic row-shape validation.
  - Cross-row uniqueness checks (tag within table).
  - Cross-table referential integrity checks (FKs to other
    equipment rows, outdoor units, ERVs, rooms).
  - Mutation-specific rules (block delete with refs;
    cascade-null on indirect deletes).

The service module owns the rules; the routes module is thin.

### Step 4: Routes

`backend/features/heat_pumps/routes.py`:

- `GET /api/v1/projects/{id}/equipment/heat-pumps` — calls
  `service.compose_read`; returns 200 + composite payload, or
  404 if project / active version missing.
- `PATCH /api/v1/projects/{id}/equipment/heat-pumps/{table}` —
  one JSON-Patch op; returns 200 with updated row, 422 on
  validation failure, 409 on referential conflict.

`{table}` ∈ {`outdoor-equip`, `indoor-equip`,
`outdoor-units`, `indoor-units`}. Resolves to the matching
service method.

### Step 5: Migration

`backend/alembic/versions/XXXX_add_heat_pump_tables.py`:

- `upgrade`: extends the project-document JSON Schema by adding
  the four new `tables.equipment.heat_pump_*` array keys with
  default `[]`. Existing projects get the empty arrays
  back-filled lazily on first write (or eagerly at migration time
  if `make smoke` shows existing-row impact).
- `downgrade`: strips the four arrays. Idempotent.

### Step 6: Tests

`backend/features/heat_pumps/tests/`:

- `test_models.py` — one test per validator (positive + negative
  per rule).
- `test_repository.py` — read round-trip + patch apply.
- `test_service.py` — every referential-integrity rule from PRD
  §4.6.
- `test_routes.py` — happy-path + error-path per endpoint.
- Reuses existing `conftest.py` fixtures for project / draft
  setup.

## Verification

End of phase, before tagging Phase 0 done:

1. `make format` is clean.
2. `make ci` passes.
3. Manual `curl` walkthrough:
   ```bash
   # Read
   curl -i http://localhost:8000/api/v1/projects/{id}/equipment/heat-pumps

   # Add an outdoor equip row via PATCH
   curl -i -X PATCH http://localhost:8000/api/v1/projects/{id}/equipment/heat-pumps/outdoor-equip \
     -H 'Content-Type: application/json' \
     -d '{"op": "add", "path": "/-", "value": { "id": "hpoe_...", "model_number": "PUZ-A18NKA7", ... }}'
   ```
4. STATUS.md verification row for Phase 0 filled in.

## Risks

- **Existing-project migration**. Real projects on the dev DB have
  existing `tables.equipment` shapes; the migration must default-
  fill the four new arrays without breaking reads. Mitigation:
  the migration tests a fixture of one pre-existing project +
  one new project + one in-progress draft.
- **Draft-buffer JSON-Patch path validation**. The existing draft
  buffer accepts arbitrary paths; we need to ensure paths into
  the four new arrays are accepted while malformed paths are
  rejected with the same shape as existing equipment patches.
- **Cross-table FK validation timing**. Referential checks across
  ERVs / Rooms add new cross-table read patterns. Phase 0 should
  resolve whether these checks happen synchronously inside the
  service or lazily on Save (mirroring existing referential
  patterns in US-EQ-2 / 4).
