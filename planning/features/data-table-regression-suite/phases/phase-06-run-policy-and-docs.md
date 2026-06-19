---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Operationalize the table regression suite after implementation.
RELATED:
  - planning/features/data-table-regression-suite/PLAN.md
  - context/technical-requirements/data-table.md
---

# Phase 06 - Run Policy And Documentation

## Goal

Make the suite useful as a table-work tool without turning it into an
unreviewed drag on normal development.

## Planned Tasks

1. Measure smoke-suite runtime.
2. Measure full-suite runtime.
3. Record known flake points and whether they are app bugs, setup bugs, or
   browser-tool limitations.
4. Add package scripts if the command shape is stable.
5. Update `context/technical-requirements/data-table.md` with accepted
   tested behavior.
6. Update this planning packet's `STATUS.md` with actual verification
   evidence.
7. Decide whether any subset belongs in default CI.

## Candidate Commands

```bash
cd frontend && pnpm run test:e2e:tables:smoke
cd frontend && pnpm run test:e2e:tables
```

Exact scripts should not be added until the implementation phases show the
suite is stable enough to justify them.

## Completion Criteria

- The suite has documented run commands.
- The suite has documented runtime and stability notes.
- The default validation policy is explicit.
- Durable behavior contracts are folded into `context/technical-requirements`.

