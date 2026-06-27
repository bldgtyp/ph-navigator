---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Planned - implementation not started.
AUTHOR: Codex with Ed May
SCOPE: Phase 4 - built-in FieldDef drift reporting and schema-bump docs.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../decisions.md
---

# Phase 4 - FieldDef Drift And Schema-Bump Docs

## Goal

Make built-in table contract drift explicit before stale persisted `field_defs`
create beta surprises.

## Scope

- Add a helper or CLI mode that compares persisted built-in `field_defs` to
  current code-defined built-ins.
- Report differences by table and `field_key`.
- Distinguish built-in product fields from user-created custom fields.
- Add schema-bump checklist docs.
- Reconcile docs that still describe the migration mechanism as deferred.
- Keep table-view migration lightweight unless real product requirements change.

## Drift Reporter Should Flag

- missing built-in fields;
- extra persisted built-in fields;
- `field_type` changes;
- number unit config changes;
- linked-record config changes;
- option namespace/default changes;
- display-name changes;
- origin mismatches.

## Acceptance Criteria

- Seeded/current project documents produce an understandable drift report.
- A deliberately stale built-in `FieldDef` fixture produces a useful warning.
- User custom fields are not reported as product drift.
- The schema-bump checklist exists and points developers to the upgrade tests
  and audit CLI.
- Technical requirements docs reflect that this is now a beta gate.

## Verification

- Focused tests around drift classification.
- Docs check with `git diff --check`.
- Any code changes covered by backend focused tests.

