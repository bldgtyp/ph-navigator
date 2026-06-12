---
DATE: 2026-06-12
TIME: 17:05 EDT
STATUS: Deferred
AUTHOR: Codex
SCOPE: Current state and revisit gate for user-defined attachment fields.
RELATED:
  - PRD.md
  - planning/features/attachments/STATUS.md
  - context/technical-requirements/attachments.md
  - context/technical-requirements/data-table.md
---

# User-Defined Attachment Fields - Status

## Status

Deferred to v1.1. Do not implement for the current v1 scope.

## Current Decision

Keep v1 attachment fields as PHN-declared core fields on the fixed
attachment roster. User-created custom fields remain limited to the
current scalar/computed/link field set.

## Revisit Gate

Reopen this feature after v1 ships and at least two real project
workflows need an ad hoc attachment column that cannot be modeled as an
existing PHN core field.

## Why Deferred

- The current backend asset registry assumes a fixed table/field roster.
- User custom values currently store scalars in `custom_values`; dynamic
  attachment cells need ordered `asset_id[]` values.
- Asset lifecycle behavior must stay correct for save/version invariants,
  orphan detection, bulk download, and MCP tools.
- The feature adds schema-mutation and field-config complexity beyond the
  current v1 closeout goal.

## Next Step When Reopened

Write a phase plan that starts with backend storage and asset-reference
tests before exposing the field type in the frontend picker.

