---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Backend domain model, validation, read slices, and table-contract
       adapters for Assembly Builder.
RELATED:
  - docs/features/assembly-builder-prd.md §§5-6, 11
  - docs/plans/2026-05-26/assembly-builder/README.md
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
- read endpoint tests for saved version and draft source;
- schema endpoint tests if schema routes are added or changed.

Commands:

```bash
cd backend
uv run ruff check .
uv run ty check
uv run pytest tests/test_project_document.py
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
