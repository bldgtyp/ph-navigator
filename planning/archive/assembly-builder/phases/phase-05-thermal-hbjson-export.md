---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Active implementation.
AUTHOR: Codex
SCOPE: Backend thermal calculation overlay and HBJSON construction
       export.
RELATED:
  - planning/archive/assembly-builder/PRD.md §§7.14, 9.2
  - planning/archive/assembly-builder/phases/phase-04-materials-picker-specifications.md
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
- Frontend thermal label in the assembly header using shared IP/SI
  thermal helpers.
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

Implemented in the first Phase 5 pass:

- `thermal.py` calculates construction-only SI thermal values and
  returns explicit unfinished flags instead of writing computed values
  into the document;
- thermal preview status and HBJSON export errors now share the same
  thermal issue records, so missing material, missing conductivity,
  broken project-material references, and invalid geometry cannot drift
  between UI preview and export validation;
- `hbjson_export.py` serializes saved-version assemblies only and
  preserves project-material metadata under both Honeybee-style `ref`
  properties and a V2 `ph_nav` metadata block;
- the export rejects null materials, missing conductivity, broken
  project-material references, and invalid geometry with structured
  path entries.

## Frontend Work

- render effective R-value / U-value with tooltip;
- choose R-value in IP and U-value in SI from the same SI canonical
  backend response;
- debounce/refetch on relevant envelope changes;
- show unfinished/material-data-needed state;
- add project-header overflow action for HBJSON download;
- warn if dirty draft exists before export;
- surface export 422 as a concise, actionable dialog/list.

Implemented in the first Phase 5 pass:

- Assembly header thermal label uses the backend SI response and shared
  IP/SI thermal helpers;
- thermal query invalidation is scoped to the affected assembly for
  assembly-local commands and broadened only for commands that can
  change multiple assemblies or shared project-material values;
- HBJSON download uses the shared API blob helper so request ids,
  credentials, and backend error envelopes match normal JSON requests;
- the HBJSON download action warns when the visible editor source is a
  dirty draft because export reads the last saved version;
- export 422 details are summarized in the existing Envelope command
  error surface.

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
- SI/IP thermal label conversion and reciprocal fixture behavior;
- dirty-draft export warning;
- export error rendering.

Browser:

1. Assign materials to a complete assembly and verify thermal value
   appears.
2. Toggle SI/IP and verify the label switches between SI U-value and IP
   R-value without a backend unit-contract change.
3. Remove one material and verify unfinished state.
4. Clear conductivity and verify material-data-needed state.
5. Save a version, make dirty draft changes, export, and verify warning
   states that export reads last saved version.
6. Download HBJSON and inspect that expected constructions/material ids
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

## Current Verification

Passed on `codex/assembly-builder-phase-05`:

```bash
cd backend
uv run ruff check features/envelope tests/test_envelope_phase04.py tests/test_envelope_phase05.py
uv run ty check features/envelope tests/test_envelope_phase05.py
uv run pytest tests/test_envelope_phase04.py tests/test_envelope_phase05.py
uv run ruff check features/envelope features/shared features/project_document/routes.py tests/test_envelope_phase05.py
uv run ty check features/envelope features/shared/responses.py tests/test_envelope_phase05.py

cd ../frontend
pnpm exec prettier --write src/shared/api/client.ts src/features/envelope/api.ts src/features/envelope/hooks.ts src/features/envelope/__tests__/EnvelopePage.test.tsx
pnpm exec eslint src/features/envelope src/features/catalogs/hooks.ts src/features/project_document/catalog-origin.ts src/features/windows/types.ts
pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx
pnpm exec tsc --noEmit --pretty false 2>&1 | rg "src/features/envelope|src/features/catalogs/hooks|src/features/project_document/catalog-origin|src/features/windows/types" || true
```

Remaining gates:

- steel-stud equivalent-conductivity regression;
- browser acceptance checklist and downloaded HBJSON inspection;
- final decision on hand-authored Honeybee-compatible JSON versus
  adding a Honeybee serialization dependency.

## Risks

- **V1 algorithm archaeology takes longer than expected.** Mitigation:
  isolate a small fixture corpus first, then port behavior.
- **Thermal cache invalidation gets stale.** Mitigation: derive the
  hash from assembly subtree plus referenced material fields only.
- **Duplicate names break Honeybee identifiers.** Mitigation: id-backed
  export identifiers and tests.
- **Thermal helper misuse.** Mitigation: test R/U reciprocal formatting
  directly and keep backend/export SI-only.

## Lessons To Capture

Record lessons for:

- fixture tolerances;
- steel-stud policy details;
- HBJSON identifier format;
- how V1.1 import should map `ph_nav` and `ref_status` back into V2
  project materials;
- cache invalidation dependencies.
