---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Implementation plan for user-configurable single-select options.
RELATED:
  - ./README.md
  - ./decisions.md
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

## Phase 00 - Contract Spike - DONE

- Completed in `decisions.md` and `phases/phase-00-contract-spike.md`.
- Product contract is `option_mutability = "editable" | "locked"`.
- Frontend derives the default from `FieldDef.locked: ["options"]` and exposes
  `FieldDef.optionMutability`.
- Backend enforces built-in edits through
  `TableFieldRegistry.option_editable_builtin_field_keys`.
- Nullable Rooms referenced deletes clear cells.
- Rooms manage-options uses typed `editFieldBundle.nextOptions` /
  `apply_edit_options`, not new `legacyOptions` wiring.

## Phase 01 - API Guardrails - DONE

- Completed in `phases/phase-01-api-guardrails.md`.
- Added `TableFieldRegistry.option_editable_builtin_field_keys` and backend
  `custom_field_options_locked` rejection for locked built-ins.
- Added `FieldDef.optionMutability` plus `canEditFieldOptions` for
  field-config options, inline single-select create, and paste coercion.
- Rooms `floor_level` and `building_zone` remain allowlisted.
- Built-in `status` option edits are locked through the schema-mutation path.
- Focused backend/frontend tests cover allowlisted Rooms fields, protected
  status, popover create gating, and paste rejection.

## Phase 02 - Rooms Affordance - DONE

- Completed in `phases/phase-02-rooms-affordance.md`.
- Removed only the `"options"` lock from Rooms `Floor` and `Zone`.
- Verified the shared field-config modal exposes editable option controls for
  both fields.
- Verified Floor option edits dispatch through `editFieldBundle.nextOptions`.
- Backend bundle coverage verifies the same typed path reaches
  `apply_edit_options`.
- Explicit referenced-delete replacement UX remains Phase 03 scope.

## Phase 03 - Cascade UX - DONE

- Completed in `phases/phase-03-cascade-ux.md`.
- `FieldConfigSectionOptions` now prompts on referenced option deletes with
  explicit clear/replace semantics.
- Replacement choices flow through `EditCustomFieldBundleRequest` as
  `optionReplacements` and into `editFieldBundle.optionReplacements`.
- Nullable Rooms built-ins may clear referenced cells; backend required
  built-ins still require replacement.
- No additional required built-in option lists were unlocked.

## Phase 04 - Verification and Docs - DONE

- Completed in `phases/phase-04-verification-docs.md`.
- Added frontend regression coverage for protected Equipment `status` option
  locks found during browser smoke.
- Re-ran targeted backend/frontend verification and browser smoke.
- Folded durable DataTable field-contract decisions into
  `context/technical-requirements/data-table.md`.
- Updated this packet's `STATUS.md` and the top-level planning index.

## Split Guidance

Do not combine Phase 01 through Phase 03 unless Phase 00 proves that the
feature can use existing typed `editOptions` behavior unchanged. The most likely
safe split is:

1. Guardrails first.
2. Rooms manage-options for add/rename/reorder/unused-delete.
3. Referenced-delete replacement/clear UX.
