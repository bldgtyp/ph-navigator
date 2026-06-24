---
DATE: 2026-06-16
TIME: 13:05 EDT
STATUS: Complete - implemented, verified, pushed, archived
AUTHOR: Codex
SCOPE: Status ledger for Heat Pumps link-field correction.
RELATED:
  - planning/archive/heat-pump-link-fields/README.md
  - planning/archive/heat-pump-link-fields/PRD.md
  - planning/archive/heat-pump-link-fields/phases/phase-01-audit-and-decision.md
---

# Heat Pump Link Fields - Status

## Current State

`Complete - implemented, verified, pushed, archived`.

Source audit confirmed:

- `Equipment` and `Outdoor unit` on `Units - Indoor` are native row
  references, not real single-select vocabularies.
- They rendered as single-select because `indoor-unit-columns.tsx`
  created synthetic `FieldDef.options` and set
  `field_type: "single_select"`.
- `Rooms` renders as a link because `served_room_ids` is exposed as
  `field_type: "linked_record"` and `IndoorUnitsTable.tsx` supplies
  `buildLinkedRecordOps`.
- Backend validation and delete cascades already treat these as
  references.
- Generic inverse-link support does not cover Heat Pumps sub-tables
  because Heat Pumps has a feature-specific endpoint and native row
  models rather than registered generic table envelopes.

## Recommended Direction

Implemented direction:

1. Keep persisted Heat Pumps row fields unchanged.
2. Render `indoor_equip_id` and `outdoor_unit_id` as single-link
   `linked_record` fields in the DataTable.
3. Normalize committed linked-record arrays back to scalar typed fields
   in `IndoorUnitsTable.handleWrite`.
4. Add read-only reverse-link columns computed from the Heat Pumps slice.

## Implementation Files

- `frontend/src/features/equipment/heat-pumps/link-fields.ts`
- `frontend/src/features/equipment/heat-pumps/indoor-unit-columns.tsx`
- `frontend/src/features/equipment/heat-pumps/indoor-equip-columns.tsx`
- `frontend/src/features/equipment/heat-pumps/outdoor-unit-columns.tsx`
- `frontend/src/features/equipment/heat-pumps/components/IndoorUnitsTable.tsx`
- `frontend/src/features/equipment/heat-pumps/components/IndoorEquipTable.tsx`
- `frontend/src/features/equipment/heat-pumps/components/OutdoorUnitsTable.tsx`
- `frontend/src/features/equipment/heat-pumps/components/IndoorUnitRowModal.tsx`
- `frontend/src/features/equipment/heat-pumps/components/OutdoorUnitRowModal.tsx`
- `frontend/src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx`
- `frontend/src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`
- `frontend/src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx`

## Archive Note

Implementation landed on `main` in commit `80ea05bc` and was pushed to
`origin/main`. This planning packet was moved from the active feature
area to `planning/archive/heat-pump-link-fields/` after completion.

## Blockers

None.

## Verification

- Passed 2026-06-16:
  - `$simplify`
    - Accepted concrete cleanup recommendations: removed unused label
      wrappers, made reverse columns real read-only `linked_record`
      fields, precomputed reverse-link indexes, gated modal-only
      Ventilators queries, and moved the helper module from `.tsx` to
      `.ts` to avoid new fast-refresh warnings.
  - `$docs-pass`
    - Confirmed the feature packet, planning index, and equipment user
      story hold the durable decisions; no ADR or broader context doc
      was needed.
  - `cd frontend && pnpm exec vitest run src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx`
  - `git diff --check`
  - `make format`
  - `make ci`
    - Backend: `874 passed, 2 skipped`.
    - Frontend: `169 passed` test files / `1630 passed` tests.
    - Build: `pnpm run build` completed with the existing Vite chunk-size
      warning only.
    - Lint: no new heat-pump warnings; remaining warnings are the three
      pre-existing aperture fast-refresh warnings.
  - `graphify update .`
    - No code-graph topology changes detected; outputs left untouched.
  - Browser smoke on `http://localhost:5173` / `http://localhost:8000`
    - Backend `/api/v1/auth/session` returned the expected
      `401 not_authenticated`.
    - Vite root returned `200 OK`.
    - Logged in as `codex@example.com`.
    - Used local Codex-owned `DEV-CODEX-HP` smoke project with starter
      heat-pump data copied into its Working version.
    - Verified `Units - Indoor` renders `Equipment`, `Outdoor unit`,
      and `Rooms` with `linked_record` header icons and linked pills.
    - Verified `Equipment - Indoor` and `Units - Outdoor` each render a
      read-only linked `Indoor units` reverse column with indoor-unit
      tags.
