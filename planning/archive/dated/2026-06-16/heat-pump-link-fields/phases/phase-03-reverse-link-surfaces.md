---
DATE: 2026-06-16
TIME: 12:14 EDT
STATUS: Implemented / in review
AUTHOR: Codex
SCOPE: Add read-only referenced-side visibility for Heat Pumps native
  relationships.
RELATED:
  - planning/archive/heat-pump-link-fields/PRD.md
  - frontend/src/features/equipment/heat-pumps/components/IndoorEquipTable.tsx
  - frontend/src/features/equipment/heat-pumps/components/OutdoorUnitsTable.tsx
  - frontend/src/features/equipment/components/PumpsTable.tsx
---

# Phase 03 - Reverse Link Surfaces

## Preconditions

- Phase 02 merged locally and focused tests pass.
- D1 reverse-overlay location has been implemented or is ready to
  implement in this phase.

## Tasks

1. Add a read-only incoming-link column to `Equipment - Indoor`.
   - Source rows: `slice.indoor_units`.
   - Match: `unit.indoor_equip_id === indoorEquip.id`.
   - Cell renders linked-record pills for indoor unit tags.
   - Pill click opens the matching indoor unit modal if practical.
2. Add a read-only incoming-link column to `Units - Outdoor`.
   - Source rows: `slice.indoor_units`.
   - Match: `unit.outdoor_unit_id === outdoorUnit.id`.
   - Cell renders linked-record pills for indoor unit tags.
   - Pill click opens the matching indoor unit modal if practical.
3. Follow the `PumpsTable` inverse-column precedent for:
   - read-only field defs,
   - `LinkedRecordCell` rendering,
   - default width and `data-table-inverse-link-cell` class reuse.
4. Decide default visibility:
   - Recommended: visible by default for `Units - Outdoor` because it is
     the direct "what heads are wired to this condenser" relationship.
   - Recommended: visible by default for `Equipment - Indoor` unless the
     table becomes too wide; if width is a problem, default-hidden is
     acceptable but must be documented.
5. If D1 chose backend overlay, add response fields and backend tests
   before frontend consumption.

## Acceptance Criteria

- Referenced-side rows visibly show the linked indoor unit records.
- Empty reverse cells render empty/read-only, not an editable add
  affordance.
- Reverse columns do not alter persisted Heat Pumps rows.
- Existing delete behavior remains clear:
  - deleting indoor equipment while referenced is blocked.
  - deleting outdoor units still previews and cascade-nulls indoor units.

## Stop Conditions

- Stop if reverse pill click requires cross-tab modal state that would
  destabilize the Heat Pumps panel. In that case, ship read-only pills
  without click behavior and record the deferred click behavior.

## Verification

- Focused Vitest coverage for reverse column render and empty state.
- Backend tests only if D1 chose backend overlay response fields.
- Browser smoke on seeded `DEV-0001`.

## Result - 2026-06-16

Implemented in:

- `frontend/src/features/equipment/heat-pumps/link-fields.ts`
- `frontend/src/features/equipment/heat-pumps/indoor-equip-columns.tsx`
- `frontend/src/features/equipment/heat-pumps/outdoor-unit-columns.tsx`
- `frontend/src/features/equipment/heat-pumps/components/IndoorEquipTable.tsx`
- `frontend/src/features/equipment/heat-pumps/components/OutdoorUnitsTable.tsx`
- `frontend/src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`
- `frontend/src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx`

Evidence:

- `Equipment - Indoor` and `Units - Outdoor` now include a visible,
  read-only `Indoor units` reverse-link column.
- Reverse cells render `LinkedRecordCell` pills with
  `data-table-inverse-link-cell`.
- Reverse pill clicks open the existing indoor-unit modal from both
  referenced-side tables.
- Focused Vitest passed for reverse column visibility and adjusted
  cascade-preview behavior.
