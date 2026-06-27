---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Implemented on branch.
AUTHOR: Codex with Ed May
SCOPE: Phase 2 - golden corpus and regression tests.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ./phase-01-upgrade-harness.md
---

# Phase 2 - Golden Corpus And Regression Tests

## Goal

Capture the serialized v1 project-document contract before beta data exists, and
make every future schema bump prove old bodies still upgrade.

## Scope

- Add fixture folder such as:

```text
backend/tests/project_document_schema/fixtures/v1/
```

- Add representative raw JSON project bodies:
  - empty seeded project;
  - demo project with common tables;
  - equipment unit fields;
  - rooms and space types linked records;
  - apertures/glazings/frames references;
  - custom fields, formulas, and option lists.
- Add tests that load fixture files as raw JSON, not Python factories.
- For each input fixture, commit the **expected upgraded output** as a canonical
  JSON snapshot, and assert byte-equality (not just "validates"). A future step
  that silently drops a field or writes a wrong default must turn the build red,
  which a validation-only check would miss (`llm-mcp-schema.md` §10.5 item 6).
- Document fixture expectations for future schema bumps.

## Frozen-Fixture Rule

Old-version input fixtures are frozen artifacts. They are committed by hand as
raw JSON and are **never** regenerated from current models or factories. When
`CURRENT` bumps, add new fixtures for the old shape; do not rewrite existing
ones. Regenerating an old fixture from current code silently destroys the very
contract it was protecting.

## Acceptance Criteria

- Every v1 fixture upgrades to current schema.
- Every upgraded fixture validates as `ProjectDocument`.
- Each fixture's upgraded output matches its committed canonical snapshot
  byte-for-byte.
- Canonical serialization succeeds.
- Body size remains under configured limits.
- Running upgrade on a current body is idempotent.
- The corpus tests run as ordinary `pytest`, so `make ci` exercises the whole
  corpus on every PR (this is the per-PR half of §10.5; the staging-snapshot
  drill in Phase 5 is the production-corpus half).
- Future schema bumps must add at least one fixture for the old shape they
  change.

## Verification

Focused backend test module, likely under:

```text
backend/tests/test_project_document_schema_migrations.py
```

## Implementation Notes

Implemented 2026-06-27:

- Added frozen v1 JSON fixture pairs under
  `backend/tests/project_document_schema/fixtures/v1/inputs/` and
  `backend/tests/project_document_schema/fixtures/v1/expected/`.
- Added `empty_seeded_project` and `representative_design` fixtures. The
  representative body covers project metadata, rooms, Space-Types linked
  records, custom fields, custom single-select option lists, pump unit fields,
  datasheet IDs, project glazings/frames, aperture references, and manufacturer
  filters.
- Added fixture README guidance that old-version inputs are frozen artifacts and
  future schema bumps add new old-shape fixtures instead of regenerating prior
  ones.
- Added `backend/tests/test_project_document_schema_migrations.py` to discover
  `v*/inputs/*.json` fixture cases, run the upgrader, validate the document,
  compare canonical serialized output byte-for-byte against committed snapshots,
  enforce body-size safety through the production helper, and prove idempotence.

## Verification Evidence

```bash
cd backend && uv run ruff check tests/test_project_document_schema_migrations.py
cd backend && uv run ty check tests/test_project_document_schema_migrations.py
cd backend && uv run pytest tests/test_project_document_schema_migrations.py
```

Result: 2 passed.
