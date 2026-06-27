---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Planned - implementation not started.
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

or a similarly named package-local test.

