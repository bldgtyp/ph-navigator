---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: In progress
AUTHOR: Ed (via Codex)
SCOPE: Product and engineering contract for DataTable regression coverage.
RELATED:
  - planning/features/data-table-regression-suite/README.md
  - planning/features/data-table-regression-suite/PLAN.md
  - planning/features/data-table-regression-suite/STATUS.md
  - context/technical-requirements/data-table.md
  - frontend/tests/e2e/_helpers.ts
---

# DataTable Regression Suite - PRD

## Problem

PH-Navigator depends on editable DataTables for major project workflows:
Spaces, Equipment, Heat Pumps, and Thermal Bridges. These tables share
DataTable infrastructure, but they are mounted through different routes,
field definitions, row adapters, linked-record declarations, and table-view
keys. In practice, that has made rendering and edit behavior inconsistent.

The test gap is not just "more e2e coverage." The app needs a repeatable
method for validating the shared table contract against every important
table surface without making ordinary development prohibitively slow.

## Goals

- Prove every target table renders with the expected columns and a stable
  grid/cell DOM contract.
- Prove core editable field types work through the real UI:
  text, number, single-select, and linked-record.
- Prove edits persist through the draft table APIs and survive a route
  reload.
- Prove table-view state persists by stable `tableKey` where relevant:
  sort, filter, hide/show, order, and grouping when supported.
- Keep the full point-and-click browser matrix available for table work
  without forcing it into every default validation run.
- Keep fast shared DataTable contract tests separate from slower route-level
  browser tests.

## Non-Goals

- No implementation in the planning phase.
- No redesign of DataTable behavior unless tests expose a confirmed bug.
- No full-field exhaustive testing for every column in every table.
- No screenshot/visual-regression system in the first implementation pass.
- No replacement of existing focused tests such as Rooms/Pumps linked-record
  coverage.
- No CI policy change until the suite has run locally enough to understand
  timing and flake rate.

## Behavior Contract To Verify

### Rendering

- Each table route mounts the shared grid.
- Expected built-in and domain columns are visible by default.
- Cells expose stable selectors through `data-row-id` and `data-field-key`.
- Read-only/computed fields render without entering edit mode.
- Unit fields display units separately from field names and cell values.
- Empty states and add-row states do not break table chrome.

### Text Cells

- A text cell can be focused, edited, committed, and displayed.
- Reloading the route shows the committed value.
- Blank nullable text clears to `null`, not `""`, where the field contract
  allows null.

### Numeric Cells

- A number cell can be focused, edited, committed, and displayed.
- Numeric formatting does not prevent round-trip persistence.
- Blank nullable numbers clear to `null`, not `0`.
- Invalid numbers are rejected with a visible error or no-write behavior,
  depending on the existing DataTable contract.

### Single-Select Cells

- A single-select cell opens an option popover from the grid.
- Selecting an existing option commits the option id/value expected by the
  table payload.
- Creating a new option works only when the field definition allows it.
- Clearing a nullable single-select writes `null`; required clears reject.

### Linked-Record Cells

- A linked-record cell opens the target picker.
- Selecting target rows creates the link expected by the field definition.
- Duplicate links are deduped.
- `maxLinks` is respected.
- Inverse columns, where shown, update after persistence/reload.

### Table View State

- Sort/filter/group/hide/order state persists by `(projectId, tableKey)`.
- Heat Pump leaf tables use distinct stable keys and do not bleed state into
  each other.
- Schema changes or field definition changes do not leave stale table-view
  state that breaks rendering.

## Target Coverage Matrix

| Table | Text | Number | Single-select | Linked record | Notes |
|---|---:|---:|---:|---:|---|
| Space Types | Yes | If present/custom | No baseline | Inverse Rooms | Verify inverse links from Rooms |
| Rooms | Yes | Yes | Yes | Space Types, Pumps | Highest-priority linked-record table |
| Ventilators | Yes | Yes | Yes | Incoming HP indoor units | Verify inverse display if exposed |
| Heat Pumps - Equipment Outdoor | Yes | Yes | Yes | Paired indoor equipment | Stable HP table key required |
| Heat Pumps - Equipment Indoor | Yes | Yes | Yes | None baseline | Stable HP table key required |
| Heat Pumps - Units Outdoor | Yes | If present/custom | No baseline | Outdoor equipment | Stable HP table key required |
| Heat Pumps - Units Indoor | Yes | If present/custom | No baseline | Indoor equipment, outdoor unit, ERV, rooms | Highest-risk HP link table |
| Pumps | Yes | Yes | Yes | Incoming Rooms | Existing Rooms/Pumps flow should remain |
| Fans | Yes | Yes | Yes | No baseline | Verify numeric equipment fields |
| Hot Water Heaters | Yes | Yes | Yes | No baseline | Verify heater type select |
| Hot Water Tanks | Yes | Yes | Yes | No baseline | Verify inside/outside select |
| Electric Heaters | Yes | Yes | No baseline | No baseline | Simple numeric equipment table |
| Appliances | Yes | Yes | Yes | No baseline | Verify appliance type and Energy Star selects |
| Thermal Bridges | Yes | Yes | Yes | No baseline | Verify psi-value and type select |

## Acceptance Criteria

- A table matrix exists that names all 14 target tables, routes, table keys,
  core headers, and representative fields.
- Fast shared DataTable tests cover field-type edit/coercion contracts once,
  close to the shared implementation.
- Browser smoke tests can run across all 14 tables and identify which table
  failed.
- Browser behavior tests cover text, number, single-select, linked-record,
  persistence, and reload behavior where each field type exists.
- The suite can be run manually with a focused command during table work.
- The suite is documented clearly enough that future table changes can add
  a new table or field without reverse-engineering the test harness.
- The default validation path remains lightweight until the suite's runtime
  and stability are known.

