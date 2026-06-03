---
DATE: 2026-06-03
TIME: 16:42 EDT
STATUS: PRD confirmed; phased implementation plan drafted.
AUTHOR: Codex
SCOPE: Current state for the DataTable Number with Units planning
       packet.
RELATED:
  - PRD.md
---

# DataTable Number With Units Status

## Current State

- `PRD.md` defines the proposed user behavior, storage contract, table
  semantics, and remaining questions for extending Number fields with
  optional complete SI/IP unit config.
- The clarification pass resolved the user-facing model: this is
  not a separate type in the picker; it is a Number field with added
  units in the edit-field dialog.
- Catalog/domain physical fields may use fixed feature-owned unit
  config; user-created Number fields may use editable unit config.
- Area is confirmed as `m2 <> ft2`; volume is confirmed as `m3 <> ft3`.
- Unit config shape is confirmed as `config.units` with
  `mode: "editable" | "fixed"`.
- Phased implementation plans now live under `phases/`.
- No code has been changed for this feature.

## Next Step

Start implementation with `phases/phase-01-contract-and-registry.md`.
