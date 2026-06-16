---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Seed a built-in "Tag" field on the equipment tables, decoupled
  from row identity.
RELATED:
  - planning/refactor/record-identity-model/PRD.md
  - backend/features/project_document/tables/
  - backend/features/project_document/rows.py
---

# Phase 02 - Tag As An Ordinary Field

## Goal

Give the equipment tables a normal, editable, non-unique **Tag** field
that carries the architectural tag where it is domain-standard - without
that field being the row's identity or a constrained key.

## Preconditions

- Phase 00 complete (no field hard-blocks duplicates).
- Phase 01 complete (the pinned identifier is "Display Name").
- Tag seed coverage decided (PRD open question 1; default: all 7
  equipment tables).

## Tasks

1. Add a built-in `tag` FieldDef seed (display name "Tag", short text,
   non-required, non-unique, not the identifier) to the equipment table
   seeds in scope: appliances, electric_heaters, fans, hot_water_heaters,
   hot_water_tanks, pumps, ventilators. Store the value through the
   standard field path the table uses (`custom_values` or a typed column,
   matching how that table stores its other built-in text fields - keep
   it consistent with the table's existing convention).
2. Ensure the new Tag field behaves like any other ordinary field:
   editable, sortable, filterable, paste-able, not required, not
   unique-validated.
3. Add a forward-fill migration so existing equipment documents gain the
   built-in `tag` FieldDef (empty values), consistent with how the
   spaces-refactor added a built-in field to existing documents.
4. Frontend: confirm the Tag column renders through the normal column
   path (no special-casing) and is positioned sensibly relative to
   Display Name.
5. Decide and document whether Heat Pumps' existing typed `tag` column is
   reconciled with this ordinary-field model now or as part of the
   data-table-consolidation Phase 05 HP migration. Default: leave HP's
   typed `tag` until HP joins the shared abstraction, but ensure it is no
   longer uniqueness-constrained (Phase 00).
6. Tests:
   - equipment tables expose an editable, non-unique Tag field;
   - duplicate Tag values are accepted (no hard error, no chip - the chip
     is identifier-only);
   - existing documents gain the Tag FieldDef via migration;
   - Tag is not treated as the identifier column.

## Acceptance Criteria

- The in-scope equipment tables have a built-in, editable, non-unique
  Tag field that is not the identity column.
- Existing equipment documents gain the Tag field via migration.
- Tag renders and behaves as an ordinary field with no special-casing.
- Focused frontend and backend tests pass.

## Stop Conditions

- Stop if seeding Tag everywhere produces confusing duplicate-looking
  columns (Tag vs Display Name holding identical values) that the owner
  would rather make user-added; revisit the seed-coverage decision.
- Stop if reconciling the heat-pump typed `tag` here would pull in the
  larger HP migration; defer that to consolidation Phase 05.

## File Entry Points

- `backend/features/project_document/tables/*.py` (equipment seeds)
- `backend/features/project_document/rows.py`
- `backend/migrations/` (or the project's Alembic migration path)
- `frontend/src/features/equipment/components/*Table.tsx`
- `backend/tests/test_project_document.py`
