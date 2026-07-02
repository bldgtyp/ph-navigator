---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Pending
AUTHOR: Codex
SCOPE: Backend and shared DataTable guardrails for option mutability.
RELATED:
  - ../PLAN.md
  - ../decisions.md
  - ./phase-00-contract-spike.md
---

# Phase 01 - API Guardrails

## Goal

Make option mutability enforceable before exposing new UI.

## Scope

- Add `TableFieldRegistry.option_editable_builtin_field_keys`.
- Enforce protected built-ins in `resolve_option_target`.
- Reject locked built-in option edits with `422 custom_field_options_locked`.
- Keep Rooms `floor_level` and `building_zone` allowlisted.
- Keep app-owned `status` option lists protected.
- Add `FieldDef.optionMutability?: "editable" | "locked"`.
- Add one shared frontend option-mutability helper used by the field-config
  modal, inline `+ Create`, and paste coercion.
- Disable inline `+ Create` and pasted unknown-label option creation for locked
  lists.

## Tests

- Backend: `editOptions` succeeds for Rooms `floor_level`.
- Backend: `editOptions` rejects a protected `status` field.
- Frontend: locked single-select does not show `+ Create`.
- Frontend: paste into locked single-select rejects unknown labels instead of
  emitting `newOptions`.

## Exit Criteria

- Protected option lists cannot be mutated through UI, REST, or MCP schema
  mutation paths.
- Rooms `Floor` and `Zone` still accept ordinary cell value edits.
- No manage-options UI is required for this phase.
