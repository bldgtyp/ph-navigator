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

Planning added. No functional code has been changed yet.

Rooms already has the desired behavior. Equipment and Thermal Bridges
currently render the shared `AddFieldTailCell` in disabled mode because
their table components do not receive `onAddCustomField`.

The deeper blocker is backend support: the generic
`custom-fields:mutate` route requires the target `TableContract` to
publish a `field_registry`. Most target contracts currently publish
`field_registry=None`; Pumps has a registry scaffold but still rejects
schema mutations and does not publish it on the contract.

## Next Step

Implement Phase 1 from `PLAN.md`: backend field-registry opt-in for a
representative target table, then wire the frontend affordance for that
same table and verify the full add-field path before repeating the
pattern across the remaining tables.

## Blockers

None yet, but implementation should not enable the frontend buttons
until the matching backend table contract accepts schema mutations.

## Verification To Date

- Source review only.
- No tests run for this planning-only change.
