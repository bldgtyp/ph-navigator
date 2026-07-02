---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Pending
AUTHOR: Codex
SCOPE: Backend and shared DataTable guardrails for option mutability.
RELATED:
  - ../PLAN.md
  - ./phase-00-contract-spike.md
---

# Phase 01 - API Guardrails

## Goal

Make option mutability enforceable before exposing new UI.

## Scope

- Add the Phase 00-selected backend contract to `TableFieldRegistry`.
- Enforce protected fields in `resolve_option_target` or `apply_edit_options`.
- Keep Rooms `floor_level` and `building_zone` allowlisted.
- Keep app-owned `status` option lists protected.
- Add frontend FieldDef capability so cell editors know whether creating
  options is allowed.
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
