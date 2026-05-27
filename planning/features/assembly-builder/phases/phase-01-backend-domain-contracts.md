---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Backend domain model, validation, read slices, and table-contract
       adapters for Assembly Builder.
RELATED:
  - planning/features/assembly-builder/PRD.md §§5-6, 11
  - planning/features/assembly-builder/README.md
  - context/technical-requirements/data-model.md
  - context/technical-requirements/save-versioning.md
  - context/technical-requirements/attachments.md
  - context/CODING_STANDARDS.md
---

# Phase 1 - Backend Domain Contracts

## Goal

Create the backend envelope domain foundation without building the
editor UI yet. After this phase, the backend should validate typed
assemblies and project materials, serve the envelope read model, and
support registered table adapters for project materials and flattened
assembly segments.

## In Scope

- `backend/features/envelope/` package skeleton following coding
  standards.
- Pydantic models for:
  - assembly;
  - layer;
  - segment;
  - project material;
  - catalog origin for project materials;
  - envelope read response;
  - thermal status placeholders.
- Project-document validation for:
  - duplicate assembly names;
  - duplicate ids within assemblies/layers/segments/project materials;
  - contiguous layer/segment orders;
  - non-positive thickness/width/stud spacing;
  - broken non-null `project_material_id` references;
  - wrong catalog-origin family;
  - segment `use_site_notes` as nullable text;
  - asset id arrays as ordered string lists.
- Read endpoint for envelope document slices from saved version or
  current user's draft.
- Registered table contracts for:
  - `project_materials`;
  - `assembly_segments` flattened from nested assemblies.
- JSON Schema exposure for envelope row shapes if the current schema
  endpoint pattern supports it.
- Unit descriptors on registered built-in physical table fields if the
  current table-contract pattern supports render-time metadata. These
  descriptors are frontend hints only; backend schemas and payloads
  remain SI canonical.
- Backend fixtures with one realistic wall/roof/floor sample and one
  incomplete sample.

## Out Of Scope

- Mutating envelope commands.
- Frontend routes or canvas rendering.
- Catalog picker behavior.
- Asset upload/preview UI.
- Thermal calculation.
- HBJSON export.
- MCP tools beyond making read models future-compatible.

## Constraints

- Start only after the active table-schema/custom-field reshape has a
  stable backend typecheck baseline.
- If this phase tightens `ProjectDocumentV1` validation, decide whether
  the current document schema version bumps. Record that decision in the
  phase closeout and PRD lesson log if it changes the PRD contract.
- Do not store envelope data in relational tables.
- Do not make the flattened `assembly_segments` table the source of
  truth. It is a read/write adapter for attachment/table workflows.

## Workstreams

### Backend Domain

Define typed envelope models and wire them into the project-document
schema. Keep validation error messages specific enough to identify the
assembly/layer/segment path.

### Read Models

Implement the envelope read service with:

- `source=version`;
- `source=draft`;
- version and draft ETags;
- computed use-sites for every project material;
- segment-owned use-site notes in flattened segment/use-site reads;
- placeholder status flags for unfinished assemblies.

### Table Contracts

Bring `project_materials` and `assembly_segments` into the registered
table-contract pattern so downloads, diff, attachment resolution, and
future MCP table reads all discover them through one registry.
Physical built-in fields should be identifiable for frontend
unit-aware rendering:

- `thickness_mm`, `width_mm`, and `steel_stud_spacing_mm` as length;
- `conductivity_w_mk` as conductivity;
- `density_kg_m3` as density;
- `specific_heat_j_kgk` as specific heat.

Do not imply custom `number` fields have units.

### Fixtures

Add or update seed/fixture helpers for:

- a complete assembly with at least two layers and a shared project
  material;
- a null-material segment;
- a project material with missing conductivity;
- duplicate material names with different ids.
- a segment with `use_site_notes` to prove notes are segment-owned.

## Verification Gates

Backend:

- targeted project-document validation tests;
- table-contract registry tests for `project_materials` and
  `assembly_segments`;
- table-contract tests that physical built-ins expose unit descriptors
  where supported, while custom numbers stay unitless;
- read endpoint tests for saved version and draft source;
- schema endpoint tests if schema routes are added or changed.

Commands:

```bash
cd backend
uv run ruff check .
uv run ty check
uv run pytest tests/test_project_document.py
uv run pytest tests/test_envelope_phase01.py
```

Add any new targeted test file to the command list before closing the
phase.

## Success Criteria

1. Invalid envelope documents fail at the backend with precise errors.
2. Existing non-envelope project-document tests still pass.
3. Envelope read response is stable enough for Phase 2 UI work.
4. Registered table-contract discovery includes project materials and
   flattened assembly segments.
5. The phase closeout records whether a schema-version bump occurred.

## Risks

- **Schema churn from adjacent table work.** Mitigation: start from a
  clean typecheck baseline and keep this phase backend-only.
- **Over-validating incomplete design work.** Mitigation: allow null
  materials and missing physical values; reserve hard failures for
  malformed shape and broken references.
- **Flattened adapter becoming the domain model.** Mitigation: tests
  should assert that assembly data remains nested in `assemblies[]`.

## Lessons To Capture

Add PRD lesson-log entries if this phase changes:

- schema-version strategy;
- required vs nullable physical material values;
- table-contract ownership;
- validation error envelope conventions.
- whether `use_site_notes` need length limits or rich-text support.

## Implementation Closeout Notes

Updated 2026-05-26:

- Schema-version decision: no bump. Phase 1 typed and validated the
  already-reserved `tables.assemblies[]` and `tables.project_materials[]`
  shapes inside schema version 4; it did not introduce a new persisted
  top-level document version.
- Added `tests/test_envelope_phase01.py` as the targeted phase gate for
  envelope validation, registered table contracts, unit descriptors,
  schema endpoints, and saved/draft read behavior.
- Simplify/docs-pass follow-up removed a schema-test collection blocker
  by making `features.project_document.tables` lazy at package init, then
  updated `tests/test_schemas.py` to the current schema v4 /
  registered-table schema contract.
- `uv run ty check` and `uv run pytest tests/test_project_document.py`
  currently expose pre-existing custom-field/FieldDef test drift outside
  this envelope slice. Use the scoped typecheck and
  `tests/test_envelope_phase01.py` as Phase 1 evidence until the
  project-document baseline tests are reconciled.
