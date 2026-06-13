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

## Phase 1 - Backend Registry Opt-In

1. Convert the target table contracts from `field_registry=None` to real
   `TableFieldRegistry` support.
2. Reuse the Rooms registry pattern:
   - read and replace each table's `field_defs`
   - read and set `row.custom_values`
   - read and set `row.custom_links`
   - compute schema fingerprints
   - route apply / validate through `schema_mutations`
   - preserve existing built-in single-select option-list editing
3. Pay special attention to tables with typed physical fields,
   attachment core fields, and inverse display columns:
   - attachment columns stay built-in / locked
   - inverse-link columns remain display-only and outside persisted
     `field_defs`
   - typed core columns keep existing field overlays and formula typing
4. Add backend tests proving `addField` succeeds on each target table
   and rejects unsupported / mismatched table keys as before.

## Phase 2 - Frontend Prop Wiring

1. Add custom-field props to each target table component, matching
   `RoomsTable`:
   - `onAddCustomField`
   - `onDeleteCustomField`
   - `onDuplicateCustomField`
   - `onEditCustomFieldBundle`
2. Forward controller handlers from each table slot / route only when
   `controller.canEdit` is true.
3. For Thermal Bridges, wire directly from `ThermalBridgesPageBody` into
   `ThermalBridgesTable`.
4. Keep viewer and locked-version behavior passive by continuing to omit
   these props when editing is unavailable.

## Phase 3 - Tests

1. Add focused rendered tests modeled on
   `RoomsTable.addField.test.tsx` for:
   - one simple table, e.g. `VentilatorsTable`
   - one attachment-heavy table, e.g. `PumpsTable` or Hot Water Heaters
   - `ThermalBridgesTable`
2. Add or extend controller / integration tests to assert the POST path
   uses `/draft/tables/<table>/custom-fields:mutate` for each table.
3. Add backend table-mutation tests for representative target tables.
4. Keep existing Rooms custom-field tests unchanged as regression
   coverage.

## Phase 4 - Verification

1. Run focused backend tests for project-document schema mutations.
2. Run focused frontend tests for Rooms plus the new target-table
   coverage.
3. Use browser/Playwright against `http://localhost:5173` and
   `http://localhost:8000` with `codex@example.com` if visual
   verification is needed.
4. Close with repo gate:
   - `make format`
   - `make ci`
   - inspect any formatter diff, then rerun `make ci` if needed

## Open Questions

- Should Pumps be the first backend implementation target because its
  registry scaffold already exists, or should Ventilators be first
  because it is visually simpler and has fewer attachment / inverse
  behaviors?
- Do we want formula support on every target table immediately, or
  should Phase 1 restrict formula registry typing to fields we can
  confidently expose now?
- Should Heat Pumps leaf tables join this feature later, or stay out of
  scope until their table architecture matures?
