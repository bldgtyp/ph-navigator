---
DATE: 2026-07-02
TIME: 16:20 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Contract decisions for configurable single-select options.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./phases/phase-00-contract-spike.md
---

# Decisions - Configurable Single-Select Options

## D-1: Use Explicit Option Mutability

Use one shared capability: `option_mutability = "editable" | "locked"`.

Frontend:

- Add a `FieldDef.optionMutability?: "editable" | "locked"` capability.
- Default is derived from `FieldDef.locked`: if `locked` contains `"options"`,
  option mutability is locked; otherwise it is editable.
- Manage-options, inline `+ Create`, and paste-created `newOptions` must all
  check the same helper, not reimplement the lock test.

Backend:

- Add a `TableFieldRegistry.option_editable_builtin_field_keys` allowlist.
- Custom `cf_*` single-select fields remain option-editable by default.
- Built-in single-select fields are option-locked unless their field key is in
  the allowlist.
- Rejection should happen inside `resolve_option_target` / `apply_edit_options`
  before validating or applying the new option list.

Reason: `FieldDef.locked` is a render-time overlay and is not enough for direct
REST/MCP schema mutations.

## D-2: Rooms Floor And Zone Are Editable Built-Ins

`rooms.floor_level` and `rooms.building_zone` are the first editable built-in
single-select option lists.

Backend allowlist:

- `rooms_field_registry.option_editable_builtin_field_keys =
  frozenset({"floor_level", "building_zone"})`

Frontend overlay:

- Rooms `Floor` and `Zone` keep `["field_type", "delete", "duplicate"]`
  locked.
- They do not carry the `"options"` lock.

## D-3: App-Owned Status Options Are Locked

Built-in `status` fields stay app-owned.

Expected behavior:

- No manage-options affordance.
- No inline `+ Create`.
- Paste/type-to-create of an unknown status label rejects instead of emitting
  `newOptions`.
- Direct schema mutation returns `422 custom_field_options_locked`.

## D-4: Nullable Rooms Referenced Deletes Clear Cells

Rooms `Floor` and `Zone` are nullable. When an editable Rooms option is deleted
while referenced, the typed backend path may clear affected cells by writing
`null`.

Phase 03 can add a clearer confirmation/replacement UX, but replacement is not
required for nullable Rooms fields.

## D-5: Manage-Options Uses Typed Schema Mutations

Rooms manage-options should dispatch through the existing typed field-config
bundle path:

- DataTable modal request: `EditCustomFieldBundleRequest.options`
- Frontend mutation: `editFieldBundle.nextOptions`
- Backend core: `apply_edit_field_bundle` -> `apply_edit_options`

Do not add new Rooms `legacyOptions` wiring for this feature. The legacy
whole-table replace helpers remain only for existing slice-level paths until a
separate cleanup removes them.
