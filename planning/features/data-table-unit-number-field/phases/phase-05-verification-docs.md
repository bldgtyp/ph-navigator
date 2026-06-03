---
DATE: 2026-06-03
TIME: 17:12 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Final verification and documentation pass for Number with Units.
RELATED:
  - ../PRD.md
  - ../PLAN.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/frontend-viewer-units.md
  - context/CODING_STANDARDS.md
---

# Phase 05 - Verification And Docs

## Objective

Close the feature with full gates, browser validation, and context-doc
updates for any decisions that should outlive the feature folder.

## Required Verification

Run from repo root:

```bash
make format
make ci
```

If `make format` changes files, inspect the diff and rerun `make ci`.

## Focused Verification Before Full Gate

Use narrower checks while iterating, then still run the full gate:

- backend tests for custom field config validation and schema mutation;
- frontend unit-registry tests;
- FieldConfigModal tests;
- DataTable render/edit/paste/filter/aggregation tests;
- any Material table tests added in Phase 04.

## Browser Smoke

Use the project's browser testing workflow after frontend behavior is
implemented:

- open a table with a plain Number field and a Number with Units field;
- confirm global SI/IP toggle changes only the unitized field display;
- confirm header unit label changes;
- edit a value in IP and verify stored/rendered SI value after toggle;
- confirm fixed catalog units are visible but not editable;
- confirm global toggle does not dirty the draft.

## Documentation Pass

Update stable docs if implementation changes the durable DataTable or
unit contract:

- `context/technical-requirements/data-table.md`;
- `context/technical-requirements/frontend-viewer-units.md`, if the
  unit registry or display/input contract changes;
- feature status in `planning/features/data-table-unit-number-field/STATUS.md`.

Do not leave accepted implementation decisions only in code comments or
scratch notes.

## Handoff Criteria

- Full `make format` + `make ci` is green.
- Browser smoke is recorded in the feature status.
- Stable context docs reflect the final implemented contract.
- `STATUS.md` names the implemented phases and any deferred follow-ups.
