---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Current state and next steps
RELATED: planning/refactor/data-table-field-config-modal/PLAN.md
---

# Status

## Current State

Research complete. The modal is centralized in the shared DATA-TABLE
package:

- `DataTable.tsx` mounts `CreateFieldConfigModal` and `FieldConfigModal`.
- `FieldConfigModal.tsx` renders the current Edit Field title, Name label,
  Type pill radio group, type-change preflight panel, Description label,
  and footer.
- `CreateFieldConfigModal.tsx` repeats the same Add Field title, Name
  label, Type pill radio group, Description label, and footer.
- `DataTable.css` owns `.data-table-field-config-modal-title`,
  `.data-table-add-field-label`, `.data-table-add-field-type-row`, and
  `.data-table-add-field-type-pill`.

The old label class is wider than the screenshot implies: type-specific
subsections also use it for Number precision, Units, Options, Formula
source, Linked record target/cardinality, and Preflight. Implementation
should remove the old class everywhere, but preserve semantic labels with
`.sr-only` or a new low-emphasis modal label class where controls still
need visible labels.

## Next Step

Implement `phases/phase-01-field-type-select.md`, then continue through
the phase files in order.

## Verification Target

- Static search proves no `data-table-field-config-modal-title`,
  `data-table-add-field-label`, `data-table-add-field-type-row`, or
  `data-table-add-field-type-pill` references remain.
- Shared unit tests cover both Add Field and Edit Field modal flows.
- A browser smoke on one DATA-TABLE route proves the parent-level modal
  renders consistently for consumers.
