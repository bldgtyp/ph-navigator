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
- Document fixture expectations for future schema bumps.

## Acceptance Criteria

- Every v1 fixture upgrades to current schema.
- Every upgraded fixture validates as `ProjectDocument`.
- Canonical serialization succeeds.
- Body size remains under configured limits.
- Running upgrade on a current body is idempotent.
- Future schema bumps must add at least one fixture for the old shape they
  change.

## Verification

Focused backend test module, likely under:

```text
backend/tests/test_project_document_schema_migrations.py
```

or a similarly named package-local test.

