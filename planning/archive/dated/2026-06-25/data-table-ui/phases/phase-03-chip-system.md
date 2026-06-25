---
DATE: 2026-06-25
TIME: 01:24 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Status chip styling and global chip-style decision.
RELATED:
  - planning/features/data-table-ui/PLAN.md
  - frontend/src/shared/ui/data-table/components/SingleSelectCell.tsx
  - context/technical-requirements/data-table.md
---

# Phase 03 - Chip System

## Goals

- Improve status chip readability and semantics.
- Decide whether solid-fill chips with white text should become the
  shared DataTable chip style.

## Tasks

- Inventory current chip renderers: `single_select`, status, linked
  records, toolbar/filter/sort/group indicators, missing-option states,
  and duplicate-record warnings.
- Prototype status chips with semantic colors, tighter type, and icons
  for Complete / Needed where useful.
- Compare global solid chips against a narrower status-only solid style
  in dense rows.
- Treat DESIGN-agent numeric-prefix stripping as an explicit per-field
  presentation option, not a global single-select behavior.
- Keep linked-record chips legible when many values are clipped in one
  cell.

## Acceptance

- Complete: built-in `status` cells now render with
  `.single-select-pill--status`, semantic `data-status-option` values,
  solid Complete / Needed / Question treatments, and a quieter N/A
  treatment.
- Complete: Complete and Needed status chips include decorative scan
  icons while preserving the visible option label.
- Complete: ordinary `single_select` pills keep the existing quiet tinted
  treatment; broad solid-fill styling is rejected for dense tables until
  a separate design decision changes that scope.
- Complete: numeric-prefix stripping is not global. Any future prefix
  hiding needs an explicit field/list-level presentation rule.

## Verification

- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/GridBody.test.tsx src/shared/ui/data-table/__tests__/lib.test.ts src/features/equipment/__tests__/PumpsTable.reuse.test.tsx src/features/equipment/lib.test.ts src/features/equipment/heat-pumps/__tests__/outdoor-equip-columns.test.ts`
  passed 155 tests.
- `make frontend-dev-check` passed. Lint still reports the repo's
  existing 14 fast-refresh warnings; no errors.
- `graphify update .`
