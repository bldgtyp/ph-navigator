---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Implementation plan for enabling custom-field add affordances on Equipment and Thermal Bridges tables.
RELATED: planning/features/equipment-custom-fields/README.md; planning/features/equipment-custom-fields/PRD.md; planning/features/equipment-custom-fields/STATUS.md
---

# Equipment Custom Fields Plan

## Assessment

The UI affordance exists already. `AddFieldTailCell` renders an active
button only when `DataTable` receives `onAddCustomField`; otherwise it
renders the disabled "Add field - coming soon" tail cell. Rooms works
because `RoomsTableSlot` forwards all controller custom-field handlers
to `RoomsTable`, and `RoomsTable` forwards them to `DataTable`.

The target Equipment and Thermal Bridges tables already use
`useSliceTableController`, and the frontend slice factory exposes
schema-mutation hooks for them. However, backend `TableContract`
configuration is the likely reason this was left unwired:

- `thermal_bridges`, `ventilators`, `fans`, `hot_water_heaters`,
  `hot_water_tanks`, `electric_heaters`, and `appliances` currently
  publish `field_registry=None`.
- `pumps` has a `pumps_field_registry` scaffold, but its apply handler
  rejects schema mutations and `pumps_contract` still publishes
  `field_registry=None`.
- The generic backend route rejects `custom-fields:mutate` with
  `custom_field_unsupported_table` when a contract has no custom-field
  registry.

So the work is moderately more complicated than "wire the button":
turning the button on before backend opt-in would create a visible
workflow that fails on submit.

## Phase 1 - Backend Registry Pilot

See `phases/phase-01-backend-registry-pilot.md`.

Use Pumps as the pilot because it already has the most complete
`TableFieldRegistry` scaffold and also includes attachment plus inverse
display-column edge cases. The phase is complete when Pumps accepts
`addField` through `/custom-fields:mutate`, preserves existing Pumps
behavior, and has focused backend tests.

## Phase 2 - Backend Registry Rollout

See `phases/phase-02-backend-registry-rollout.md`.

Roll the proven registry pattern across the remaining target tables:
`ventilators`, `fans`, `hot_water_heaters`, `hot_water_tanks`,
`electric_heaters`, `appliances`, and `thermal_bridges`.

## Phase 3 - Frontend Affordance Wiring

See `phases/phase-03-frontend-affordance-wiring.md`.

Expose the existing Rooms-style `DataTable` schema handlers on all
target tables, only after backend support exists for the corresponding
contracts.

## Phase 4 - Verification and Closeout

See `phases/phase-04-verification-closeout.md`.

## Open Questions

- Do we want formula support on every target table immediately, or
  should Phase 1 restrict formula registry typing to fields we can
  confidently expose now?
- Should Heat Pumps leaf tables join this feature later, or stay out of
  scope until their table architecture matures?
