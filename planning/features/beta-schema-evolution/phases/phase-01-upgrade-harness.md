---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Planned - implementation not started.
AUTHOR: Codex with Ed May
SCOPE: Phase 1 - project-document upgrade harness.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../decisions.md
---

# Phase 1 - Project-Document Upgrade Harness

## Goal

Create the minimal project-document migration seam before real beta data exists.
The first version can be mostly no-op, but the API, error model, and read/save
semantics should be real.

## Scope

- Add a `backend/features/project_document/migrations/` package.
- Add a public upgrade entry point that accepts raw mappings and returns a typed
  result.
- Add a no-op v1 baseline.
- Reject future schema versions clearly.
- Wire saved-version and draft reads to upgrade in memory before current-schema
  validation.
- Ensure save/save-as writes current schema.
- Keep read-safe recovery for invalid bodies that cannot upgrade.

## Suggested API Shape

```python
upgrade_project_document(raw: Mapping[str, object]) -> UpgradeResult
```

`UpgradeResult` should carry:

- original schema version;
- target schema version;
- applied step names;
- warnings;
- upgraded raw body;
- validated current `ProjectDocument`.

## Acceptance Criteria

- Current v1 bodies validate through the upgrade entry point.
- Future schema versions produce a stable typed error.
- Invalid or unsupported bodies still reach read-safe recovery where appropriate.
- Saved-version and draft reads can use the same upgrade entry point.
- Save/save-as persists current schema.
- No DB row is mutated merely because it was read.

## Verification

Focused backend tests should cover:

- v1 no-op upgrade;
- missing/invalid schema version;
- future schema version;
- draft read path;
- saved-version read path;
- save/save-as current-schema persistence.

