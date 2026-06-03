---
DATE: 2026-06-03
TIME: 17:12 EDT
STATUS: Complete on branch codex/data-table-number-units
AUTHOR: Codex
SCOPE: Backend/frontend contracts and closed unit registry for Number
       with Units.
RELATED:
  - ../PRD.md
  - ../PLAN.md
  - frontend/src/lib/units/
  - frontend/src/shared/ui/data-table/types.ts
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
  - backend/features/project_document/custom_fields.py
  - backend/features/project_document/document.py
---

# Phase 01 - Contract And Registry

## Objective

Define the canonical config contract and unit registry before touching
interactive table behavior.

## Contract

Persist unit metadata only on Number fields:

```json
{
  "precision": 2,
  "units": {
    "mode": "editable",
    "unit_type": "density",
    "si_unit": "kg_m3",
    "ip_unit": "lb_ft3",
    "precision_si": 1,
    "precision_ip": 1
  }
}
```

Use closed identifiers in storage (`kg_m3`, `lb_ft3`, `w_m_k`,
`btu_h_ft_f`, `m`, `ft`, `m2`, `ft2`, `m3`, `ft3`). Render human labels
separately (`kg/m3`, `Btu/(h-ft-F)`, etc.).

`config.units` is valid only when:

- field type is `number`;
- `mode` is `editable` or `fixed`;
- `unit_type`, `si_unit`, and `ip_unit` are from the registry;
- SI/IP units are compatible with the same unit type;
- `precision_si` and `precision_ip` clamp to the same bounds as number
  precision.

## Backend Work

- Add typed helper models/functions for Number config validation near
  `custom_fields.py` or a small sibling module.
- Keep `CustomFieldType.number`; do not add a new enum member.
- Validate `config.units` during document validation and schema
  mutations.
- Reject partial unit configs.
- Reject `config.units` on non-number field types.
- Preserve current `config.precision` behavior for plain Number fields.
- Add tests covering valid editable config, valid fixed config, partial
  config rejection, wrong-unit-pair rejection, and non-number rejection.

## Frontend Work

- Add shared TypeScript types for `NumberUnitsConfig`.
- Extend `FieldDef` / `TableFieldDef` mapping to surface unit config on
  Number fields.
- Add a closed unit registry under `frontend/src/lib/units/` or a
  sibling `data-table` unit adapter:
  - density: `kg_m3 <> lb_ft3`;
  - conductivity: `w_m_k <> btu_h_ft_f`;
  - length: `m <> ft`;
  - area: `m2 <> ft2`;
  - volume: `m3 <> ft3`.
- Reuse existing conversion factors where possible; add tests for each
  round trip.

## Verification

- Backend focused tests for field config validation.
- Frontend unit-registry tests for every MVP unit pair.
- Typecheck focused touched modules if available.

## Handoff Criteria

- A plain Number field still maps and validates as before.
- A Number field with complete `config.units` maps into a frontend
  `FieldDef` with unit config.
- Invalid unit configs fail before they can enter a project document.

## Completion Notes

Implemented in Phase 01:

- Backend Number unit config validation in
  `backend/features/project_document/custom_fields.py`.
- Backend registry snapshot and validation tests in
  `backend/tests/test_project_document_custom_fields.py`.
- Frontend MVP registry and conversion helpers in
  `frontend/src/lib/units/numberUnits.ts`.
- Frontend exports in `frontend/src/lib/units/index.ts`.
- Frontend `FieldDef.numberUnits` plumbing through
  `frontend/src/shared/ui/data-table/hooks/useTableSchema.ts` and
  `frontend/src/shared/ui/data-table/types.ts`.
- Frontend unit/schema tests in `frontend/src/lib/units/units.test.ts`
  and `frontend/src/shared/ui/data-table/__tests__/useTableSchema.test.ts`.

Simplify pass completed after implementation. Concrete fixes applied:

- precomputed frontend registry maps for label and compatibility lookup;
- derived TypeScript unit unions from the runtime registry;
- stricter frontend precision validation matching backend bounds;
- backend/frontend snapshot tests to catch registry drift.

Verification:

- `cd backend && uv run ruff check features/project_document/custom_fields.py tests/test_project_document_custom_fields.py`
- `cd backend && uv run ruff format --check features/project_document/custom_fields.py tests/test_project_document_custom_fields.py`
- `cd backend && uv run pytest tests/test_project_document_custom_fields.py`
- `cd frontend && pnpm exec vitest run src/lib/units/units.test.ts src/shared/ui/data-table/__tests__/useTableSchema.test.ts`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run build`
