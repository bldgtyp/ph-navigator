---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Current status for Equipment and Thermal Bridges custom-field wiring.
RELATED: planning/features/equipment-custom-fields/README.md; planning/features/equipment-custom-fields/PLAN.md
---

# Equipment Custom Fields Status

## Current State

Phase 01 backend registry pilot is implemented for Pumps. Pumps now
publishes `pumps_field_registry` on its `TableContract` and routes
schema mutations through the shared `custom-fields:mutate` dispatcher.

Rooms already has the desired behavior. Equipment and Thermal Bridges
currently render the shared `AddFieldTailCell` in disabled mode because
their table components do not receive `onAddCustomField`.

The remaining blocker is backend support for the other target tables:
the generic
`custom-fields:mutate` route requires the target `TableContract` to
publish a `field_registry`. Ventilators, Fans, Hot Water Heaters, Hot
Water Tanks, Electric Heaters, Appliances, and Thermal Bridges still
need the proven registry pattern before their frontend add-field
buttons should be enabled.

## Next Step

Start `phases/phase-02-backend-registry-rollout.md`: apply the Pumps
registry pattern to Ventilators, Fans, Hot Water Heaters, Hot Water
Tanks, Electric Heaters, Appliances, and Thermal Bridges.

## Blockers

Do not enable frontend add-field buttons for non-Pumps target tables
until each matching backend table contract accepts schema mutations.

## Verification To Date

- `cd backend && uv run ruff check tests/test_project_document_pumps.py features/project_document/tables/pumps.py` - passed.
- `cd backend && uv run pytest tests/test_project_document_pumps.py` - passed, 8 tests.
- `$simplify` pass completed; the only actionable cleanup was stale
  Pumps module-docstring wording, now updated.

## Phase Ledger

| Phase | Status | Exit Evidence |
| --- | --- | --- |
| 01 - Backend registry pilot | Complete | `pumps_contract.field_registry=pumps_field_registry`; focused Pumps tests pass. |
| 02 - Backend registry rollout | Pending | Pending. |
| 03 - Frontend affordance wiring | Pending | Pending. |
| 04 - Verification and closeout | Pending | Pending. |
