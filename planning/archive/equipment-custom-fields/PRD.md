---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Product and behavior contract for custom-field authoring on Equipment and Thermal Bridges DATA-TABLES.
RELATED: planning/archive/equipment-custom-fields/README.md; context/user-stories/32-custom-fields.md; context/technical-requirements/data-table.md
---

# Equipment Custom Fields PRD

This product contract is complete and archived. The implemented scope
matches the target tables and read-only/editor behavior described here.

## Goal

Editors can add, edit, duplicate, delete, hide, sort, filter, group, and
persist user-defined custom fields on Equipment and Thermal Bridges
DATA-TABLES with the same affordance and safety model that Rooms already
uses.

## User-Facing Behavior

- In editor mode, the far-right `data-table-add-field-cell` renders as
  an active "Add field" button on all target tables.
- Clicking the tail "+" opens the existing `CreateFieldConfigModal`.
- Added fields appear in the table immediately after the visual anchor,
  receive focus when created, and persist to the current draft.
- Header context-menu insert-left / insert-right, duplicate, delete,
  and edit-field actions work for custom fields where the shared
  DataTable supports them.
- Viewer mode and locked versions keep the current read-only behavior:
  no active add-field button and no schema-mutation menu actions.
- Existing PHN-defined fields remain built-in / locked as declared by
  their field overlays. Attachment cells remain PHN-defined core fields,
  not user-created attachment fields.

## Target Tables

- `ventilators`
- `pumps`
- `fans`
- `hot_water_heaters`
- `hot_water_tanks`
- `electric_heaters`
- `appliances`
- `thermal_bridges`

Rooms is intentionally out of implementation scope except as regression
coverage, because it already has the behavior.

## Non-Goals

- Do not add custom-field support to catalog tables.
- Do not introduce user-created attachment fields.
- Do not change table schemas for Heat Pumps leaf tables unless a later
  plan explicitly adds them to this scope.
- Do not redesign `DataTable` or the field configuration modals.

## Acceptance Criteria

1. Each target table's active editor UI exposes exactly one tail "Add
   field" button and opens the shared add-field dialog.
2. Adding a short-text custom field succeeds against the backend
   `custom-fields:mutate` endpoint and returns an updated slice with the
   new `field_defs` entry.
3. The new field accepts cell writes through the existing table write
   path, and the value survives draft refetch.
4. Custom field duplicate, delete, and edit-bundle actions work where
   Rooms already exposes them.
5. Viewer and locked-version paths do not expose schema mutation actions.
6. Attachments and inverse-link display columns do not become mutable
   user-defined schema columns by accident.
7. Focused tests cover at least one simple Equipment table, one
   attachment-heavy table, and Thermal Bridges; Rooms add-field tests
   still pass.

## Execution Phases

- Phase 01: `phases/phase-01-backend-registry-pilot.md` proves the
  backend schema-mutation path on Pumps.
- Phase 02: `phases/phase-02-backend-registry-rollout.md` applies the
  backend registry pattern to the remaining target contracts.
- Phase 03: `phases/phase-03-frontend-affordance-wiring.md` turns on
  the existing Rooms-style DataTable affordance for every target table.
- Phase 04: `phases/phase-04-verification-closeout.md` records focused
  tests, browser smoke if needed, and the repo closeout gate.
