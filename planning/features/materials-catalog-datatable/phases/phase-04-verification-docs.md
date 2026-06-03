---
DATE: 2026-06-03
TIME: 20:30 EDT
STATUS: Planned.
AUTHOR: Claude (Opus 4.7)
SCOPE: Closeout — verification gates and durable doc fold-back.
RELATED:
  - ../PRD.md
  - ../STATUS.md
  - phase-01-backend-schema.md
  - phase-02-drift-and-envelope.md
  - phase-03-frontend-datatable.md
  - ../../../../context/technical-requirements/data-table.md
  - ../../../../context/technical-requirements/frontend-viewer-units.md
---

# Phase 4 — Verification & Docs

## Mandatory closeout gate

Per project CLAUDE.md:

1. `make format` from repo root.
2. `make ci` from repo root.
3. If `make format` changes files, inspect diff and re-run `make ci`.
4. Do not declare complete while any step is red.

## Playwright MCP smoke

Drive `/catalog/materials` interactively:

- Add a row via Shift-Enter; type name; pick category; type density
  in SI and IP; assert SI→IP toggle re-renders the same row without
  edit-buffer drift.
- Edit, then soft-delete the row. Toggle include-inactive and
  reactivate.
- Capture screenshots into `working/` (gitignored) — promote only if
  they end up in the PR description.

## Context doc fold-back

Update only if the implementation produced durable contract changes:

- `context/technical-requirements/data-table.md`:
  - Confirm the "Catalog-manager view-state persistence" deferred
    bullet still accurately describes the catalog state (it does;
    no edit needed unless we changed scope).
- `context/technical-requirements/frontend-viewer-units.md`:
  - If a new `specific_heat` registry entry was added in Phase 3,
    update §11.5.5 example list to include it.
- `planning/features/materials-catalog-datatable/STATUS.md`:
  - Flip to `Implemented on branch` then `Merged to main` on land.

## Acceptance

- `make ci` green.
- All four phases' verification sections green.
- PR description quotes the PRD acceptance bullets and confirms each.
- STATUS reflects the final landed state.

## Out of scope

- Carrying any catalog-version-id behavior forward.
- Scoped re-do of other catalog tables (frame, glazing) — those are
  separate features.
