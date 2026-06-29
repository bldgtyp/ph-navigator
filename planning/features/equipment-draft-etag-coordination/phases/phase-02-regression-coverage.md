---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Unit, controller, and Playwright coverage for cross-table draft ETag freshness.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 02 - Regression Coverage

## Goal

Prevent this regression from returning when table performance or write plumbing
changes again.

## Unit Coverage

Extend `frontend/src/features/project_document/table-slice.test.ts`.

Keep the existing assertion that a sibling editor slice is invalidated but not
eager-refetched after an accepted write. Add the missing second half:

- source table write returns `draft-new`;
- sibling editor slice remains invalidated;
- next sibling write refreshes the sibling slice first;
- sibling `PUT` uses `If-Match: draft-new`;
- source write did not refetch every active sibling query.

## Controller Coverage

Add focused coverage around `useSliceTableController` if no current test file
exists for the hook.

The key assertion is not only header freshness. The payload builder must receive
the fresh target slice:

```text
stale sibling slice rows = ["old"]
fresh sibling slice rows = ["old", "remote-safe-row"]
user inserts "new"
payload builder sees ["old", "remote-safe-row"], then appends "new"
```

This prevents a header-only fix that could overwrite target table data.

## Playwright Coverage

Add a focused spec under:

```text
frontend/tests/e2e/table-regression/
```

Suggested name:

```text
table-draft-etag-coordination.spec.ts
```

Suggested tag:

```text
@table-draft-etag
```

Minimum scenarios:

1. `Equipment / Fans -> Hot-water tanks`
   - add or edit Fan;
   - do not `Save Version`;
   - add Hot Water Tank;
   - assert no conflict banner;
   - assert Hot Water Tank row exists.

2. `Equipment / Pumps -> Appliances`
   - same pattern with another pair to prove this is not table-specific.

3. Heat-pump leaf pair if the generic fix touches `HeatPumpsPanel`.
   - Keep this scenario only if stable fixture setup is practical.

## Run Policy

Add a package script only if useful:

```json
"test:e2e:tables:draft-etag": "playwright test tests/e2e/table-regression --grep @table-draft-etag"
```

Do not add the new e2e spec to default CI unless the existing
DataTable-regression policy is changed.

## Exit Criteria

- Focused Vitest coverage fails before P01 and passes after P01.
- Focused Playwright coverage fails before P01 and passes after P01.
- Existing table-regression scripts still run.
- No default-CI policy change is made without an explicit decision.
