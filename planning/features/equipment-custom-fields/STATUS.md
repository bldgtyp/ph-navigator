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

Planning added and expanded into handoff-ready phase plans. No
functional code has been changed yet.

Rooms already has the desired behavior. Equipment and Thermal Bridges
currently render the shared `AddFieldTailCell` in disabled mode because
their table components do not receive `onAddCustomField`.

The deeper blocker is backend support: the generic
`custom-fields:mutate` route requires the target `TableContract` to
publish a `field_registry`. Most target contracts currently publish
`field_registry=None`; Pumps has a registry scaffold but still rejects
schema mutations and does not publish it on the contract.

## Next Step

Start `phases/phase-01-backend-registry-pilot.md`: enable the backend
custom-field mutation path for Pumps first, using the existing
`pumps_field_registry` scaffold, and prove the full backend contract
with focused tests before rolling the pattern across the remaining
tables.

## Blockers

None yet, but implementation should not enable the frontend buttons
until the matching backend table contract accepts schema mutations.

## Verification To Date

- Source review only.
- No tests run for this planning-only change.

## Phase Ledger

| Phase | Status | Exit Evidence |
| --- | --- | --- |
| 01 - Backend registry pilot | Active | Pending. |
| 02 - Backend registry rollout | Pending | Pending. |
| 03 - Frontend affordance wiring | Pending | Pending. |
| 04 - Verification and closeout | Pending | Pending. |
