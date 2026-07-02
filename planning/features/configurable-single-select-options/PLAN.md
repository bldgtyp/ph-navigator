---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implementation plan for user-configurable single-select options.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
  - ./reviews/2026-07-02-critical-feature-review.md
  - ./phases/phase-00-contract-spike.md
  - ./phases/phase-01-api-guardrails.md
  - ./phases/phase-02-rooms-affordance.md
  - ./phases/phase-03-cascade-ux.md
  - ./phases/phase-04-verification-docs.md
---

# PLAN - Configurable Single-Select Options

## Current Assessment

This is not a storage-heavy feature for Rooms. `single_select_options` already
exists, Rooms already returns `rooms.floor_level` / `rooms.building_zone`, and
backend `EditOptionsMutation` already works for those core fields.

The substantial part is the DataTable option-mutability contract. Today the app
has multiple paths that can alter option lists:

- field-config modal option editor
- inline single-select `+ Create`
- paste/type-to-create `newOptions`
- legacy whole-table replace `legacyOptions`
- typed schema mutations (`editOptions`, `editFieldBundle`)

The feature should be split so protected fields such as `status` cannot be
edited through one path while another path still creates options.

## Phase 00 - Contract Spike

- Complete `phases/phase-00-contract-spike.md`.
- Decide whether the product contract is expressed as `locked: ["options"]`,
  backend `option_editable_field_keys`, backend `option_locked_field_keys`, or a
  combined render/server contract.
- Decide delete behavior for in-use nullable Rooms options: clear, require
  replacement, or phased support.
- Decide whether Rooms uses typed schema mutations only, or keeps the legacy
  whole-table replace path.

## Phase 01 - API Guardrails

- Complete `phases/phase-01-api-guardrails.md`.
- Enforce option-edit allowlist/lock semantics on backend schema mutations.
- Extend the frontend DataTable contract so inline create and paste observe the
  same mutability rule as the field-config modal.
- Add focused tests for allowlisted Rooms fields and protected `status`.

## Phase 02 - Rooms Affordance

- Complete `phases/phase-02-rooms-affordance.md`.
- Expose the affordance only for configurable single-select fields.
- Wire Rooms `Floor` and `Zone` through the agreed typed mutation path.
- Support add, rename, reorder, and unused-option delete.
- Defer in-use replacement UX unless Phase 00 explicitly keeps it in scope.

## Phase 03 - Cascade UX

- Complete `phases/phase-03-cascade-ux.md`.
- Support referenced-option delete with explicit clear/replace semantics.
- Decide whether this unlocks required built-in single-selects beyond Rooms.

## Phase 04 - Verification and Docs

- Complete `phases/phase-04-verification-docs.md`.
- Add or update backend, frontend unit, and browser-smoke coverage.
- Fold durable DataTable field-contract decisions into
  `context/technical-requirements/data-table.md`.
- Update this packet's `STATUS.md`.

## Split Guidance

Do not combine Phase 01 through Phase 03 unless Phase 00 proves that the
feature can use existing typed `editOptions` behavior unchanged. The most likely
safe split is:

1. Guardrails first.
2. Rooms manage-options for add/rename/reorder/unused-delete.
3. Referenced-delete replacement/clear UX.
