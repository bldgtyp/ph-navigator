---
DATE: 2026-06-24
TIME: 00:00 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Cross-table built-in `status` single-select field for DataTable-backed equipment and Thermal Bridges records.
RELATED: planning/refactor/data-table-status-field/PRD.md, planning/refactor/data-table-status-field/PLAN.md, planning/refactor/data-table-status-field/STATUS.md
---

# DataTable Status Field Refactor

## Scope

Add a built-in `status` single-select field to these DataTable records:

- Thermal Bridges
- Heat Pumps: Outdoor Equipment
- Heat Pumps: Indoor Equipment
- Pumps
- Fans
- Hot Water Heaters
- Hot Water Tanks
- Electric Heaters
- Appliances

This is a refactor packet because the change cuts across the shared project-document table contracts, the separate Heat Pumps leaf-table contracts, frontend DataTable schemas, seed data, and local dev DB reset/reseed workflow.

## Read Order

1. `README.md` - scope and routing.
2. `PRD.md` - behavior contract and field semantics.
3. `PLAN.md` - implementation sequence and validation gates.
4. `STATUS.md` - current state and next action.
5. `phases/phase-01-contract-and-seeds.md` - backend field contract and seed data.
6. `phases/phase-02-backend-validation-tests.md` - backend API/validator coverage.
7. `phases/phase-03-frontend-types-ui.md` - frontend table schema, defaults, and UI coverage.
8. `phases/phase-04-reset-reseed-smoke.md` - local reset/reseed and browser smoke.
9. `phases/phase-05-closeout-docs.md` - graph/docs/checks closeout.

## Key Source Touchpoints

- Shared table built-in seeds: `backend/features/project_document/tables/{thermal_bridges,pumps,fans,hot_water_heaters,hot_water_tanks,electric_heaters,appliances}.py`
- Heat Pump leaf built-in seeds: `backend/features/project_document/tables/heat_pumps.py`
- New-project document defaults: `backend/features/project_document/templates.py`
- Local seed source: `backend/seeds/project/*.json`
- Seed assembler: `backend/scripts/seed_dev_db.py`
- Shared table frontend contracts: `frontend/src/features/equipment/types.ts`, `frontend/src/features/equipment/lib.ts`
- Heat Pump frontend contracts: `frontend/src/features/equipment/heat-pumps/{types,lib,row-builders,payload-builders}.ts`
- Existing status visual precedent: `frontend/src/features/envelope/components/MaterialsPanel.tsx`, `frontend/src/shared/ui/report-table/StatusPill.tsx`

## Phase Map

| Phase | Status | Purpose |
|---|---|---|
| Phase 01 | Planned | Add built-in field definitions, option-list constants, new-document defaults, and seed JSON values. |
| Phase 02 | Planned | Prove backend reads, writes, validates, and seed assembly preserve the status field. |
| Phase 03 | Planned | Prove frontend schemas, row builders, payload builders, and table UI expose/edit status. |
| Phase 04 | Planned | Reset/reseed the local dev DB and smoke the mounted app. |
| Phase 05 | Planned | Run graph/docs closeout and record evidence. |
