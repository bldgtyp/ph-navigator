---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Backend thermal calculation overlay and HBJSON construction
       export.
RELATED:
  - docs/features/assembly-builder-prd.md §§7.14, 9.2
  - docs/plans/2026-05-26/assembly-builder/phase-04-materials-picker-specifications.md
  - context/user-stories/20-envelope.md US-ENV-10, US-ENV-12
  - context/technical-requirements/frontend-viewer-units.md
  - research/v1-assembly-builder-reference.md
---

# Phase 5 - Thermal Overlay And HBJSON Export

## Goal

Port the V1 thermal-resistance behavior to the V2 document model and
ship a read-only HBJSON construction export. This phase is correctness
heavy: it should be driven by fixtures, no-surface-film policy, and
clear incomplete-state behavior.

## In Scope

- Backend thermal service for one active assembly.
- Content-hash/cache strategy for thermal inputs.
- Frontend thermal label in the assembly header.
- Missing-material / missing-conductivity / invalid-geometry states.
- Golden fixtures for:
  - simple homogeneous assembly;
  - multi-segment layer;
  - steel-stud cavity;
  - missing material;
  - missing conductivity.
- HBJSON construction export for saved version body.
- Exported `ph_nav` project-material ids and `ref_status`
  specification-status metadata.
- Dirty-draft warning before export.
- Structured 422 for incomplete or malformed assemblies.
- No-surface-film steel-stud export behavior.
- Unique export identifiers for duplicate project-material names.

## Out Of Scope

- HBJSON import.
- Per-assembly export.
- Partial export that omits incomplete assemblies.
- Model viewer upload/display changes.
- Full PHPP/WUFI downstream automation.

## Backend Work

Thermal service:

- read assemblies and project materials from the selected source;
- normalize segment widths per layer;
- treat null segments as unfinished;
- treat assigned material with missing/invalid conductivity as material
  data needed;
- return numeric result plus warnings/status codes when valid.

HBJSON export:

- use saved version body only;
- produce one construction per assembly;
- emit material/datasheet references at project-material level;
- preserve `ph_nav` metadata with project-material id and catalog
  origin;
- write project-material `specification_status` to Honeybee PH
  `ref_status`;
- reject incomplete assemblies with paths.

## Frontend Work

- render effective R-value / U-value with tooltip;
- debounce/refetch on relevant envelope changes;
- show unfinished/material-data-needed state;
- add project-header overflow action for HBJSON download;
- warn if dirty draft exists before export;
- surface export 422 as a concise, actionable dialog/list.

## Verification Gates

Backend:

- golden thermal tests with tolerances;
- no-surface-film steel-stud regression;
- duplicate material name export identifier test;
- `ph_nav` and `ref_status` metadata export test;
- 422 path report for incomplete assemblies;
- saved-version-only export test when draft diverges.

Frontend:

- thermal label loading/valid/unfinished/error states;
- dirty-draft export warning;
- export error rendering.

Browser:

1. Assign materials to a complete assembly and verify thermal value
   appears.
2. Remove one material and verify unfinished state.
3. Clear conductivity and verify material-data-needed state.
4. Save a version, make dirty draft changes, export, and verify warning
   states that export reads last saved version.
5. Download HBJSON and inspect that expected constructions/material ids
   and specification statuses are present.

Commands:

```bash
cd backend
uv run ruff check .
uv run ty check
uv run pytest tests/test_project_document.py

cd ../frontend
pnpm run format
pnpm test -- --run src/features/envelope
pnpm run build
```

## Success Criteria

1. Thermal values match accepted V1/V2 golden fixtures.
2. Incomplete states are explicit and do not block Save.
3. HBJSON export is pure read and does not mutate draft/version data.
4. Export does not silently omit bad assemblies.

## Risks

- **V1 algorithm archaeology takes longer than expected.** Mitigation:
  isolate a small fixture corpus first, then port behavior.
- **Thermal cache invalidation gets stale.** Mitigation: derive the
  hash from assembly subtree plus referenced material fields only.
- **Duplicate names break Honeybee identifiers.** Mitigation: id-backed
  export identifiers and tests.

## Lessons To Capture

Record lessons for:

- fixture tolerances;
- steel-stud policy details;
- HBJSON identifier format;
- how V1.1 import should map `ph_nav` and `ref_status` back into V2
  project materials;
- cache invalidation dependencies.
