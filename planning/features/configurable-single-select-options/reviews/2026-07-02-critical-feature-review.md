---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Critical review of configurable single-select option implications.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../phases/phase-00-contract-spike.md
---

# Critical Review - Configurable Single-Select Options

## Bottom Line

This is smaller than it first appears for Rooms storage, but larger than a
simple UI toggle.

Rooms `Floor` and `Zone` already have project-document option storage:
`rooms.floor_level` and `rooms.building_zone`. Backend `editOptions` already
supports core Rooms single-selects and clears deleted nullable references.

The risk is that the DataTable has several option-mutation paths, and the
current lock model is mostly frontend/render-time. If only the field-config
modal is unlocked, protected app vocabularies can still be affected by inline
create or paste unless those paths are covered by the same contract.

## Current Code Facts

- `FieldDef.locked` includes `"options"` and `FieldConfigSectionOptions`
  disables option editing when that lock is present.
- Rooms currently overlays `Floor` and `Zone` with
  `locked: ["field_type", "options", "delete", "duplicate"]`.
- `SingleSelectPopover` always offers `+ Create "<label>"` for unmatched input;
  it does not consult an option-lock/configurability flag.
- `useGridEdit.planSingleSelect` emits `newOptions` when the user commits a new
  label.
- Paste can also create `newOptions`.
- `EditOptionsMutation` works for built-in Rooms `floor_level` and
  `building_zone`.
- `EditOptionsMutation` clears deleted nullable core option references.
- The legacy slice-replace option helper for Rooms requires replacements for
  referenced deletes.
- Backend `TableFieldRegistry` has `field_type_locked_keys`, but no equivalent
  backend option-edit lock/allowlist.

## Edge Cases

- Protected `status`: hiding the manage-options affordance is not enough if
  inline create and paste can still add unknown status options.
- Stale values: existing rows may reference option ids absent from the current
  list. The modal already warns about missing refs; the implementation must
  decide whether save is allowed in that state.
- In-use delete: backend typed `editOptions` clears nullable Rooms cells;
  current PRD text requires a replacement. Those are different product
  behaviors.
- Empty option lists: Rooms allow null Floor/Zone, but row-creation helpers use
  the first Floor option when present. Reordering Floor changes the implicit
  first/default choice.
- Room modal path: `nextRoomsPayload` upserts Floor/Zone labels from the modal
  through whole-table replace. Manage-options changes must not diverge from the
  modal's label-to-option behavior.
- Undo/history: inline-created options currently pair cell writes with
  `newOptions` / `removedOptions`. Manage-options edits through schema mutation
  need equally coherent undo or an explicit non-goal.
- Multi-session conflicts: field-config modal already detects option-list
  changes while open. Reusing that modal is good, but only if source options are
  stable and refetched after save.
- Required built-ins: Rooms are nullable, but other built-in single-selects may
  be required or domain-owned. The replacement dialog already supports required
  fields, but the options section currently passes `allowReplacement={false}`.
- Shared option lists: heat-pump manufacturer/status-style lists can be shared
  across sibling tables. Option deletion must cascade across every binding, not
  just the visible grid.
- View-state/filter/grouping: filters store option ids. Rename/recolor/reorder
  should preserve filter intent; delete must decide how to handle filters that
  reference removed ids.
- Exports: CSV serializes labels. Missing option ids serialize blank; a delete
  policy can silently change exports if cells are cleared.
- MCP/REST writes: protected fields need backend rejection, not just hidden UI.

## Recommended Product Contract

Use one explicit DataTable concept: option mutability.

Minimum shape:

- `option_mutability = "locked" | "editable"`
- editable means all option mutation paths are allowed.
- locked means no manage-options, no inline create, no paste-created options,
  and backend schema mutations reject option-list edits.

Implementation can derive the frontend bit from existing
`!locked.includes("options")`, but backend needs an equivalent registry-level
contract before claiming protected fields are safe.

## Recommended Scope Split

1. Guardrails first: backend option-edit allowlist/lock plus frontend
   no-create behavior for locked option lists.
2. Rooms basic manage-options: unlock `Floor` and `Zone`, then add/rename/
   reorder/unused-delete through typed mutations.
3. Referenced delete UX: clear vs replace decision, then modal support for
   replacements.
4. Browser and regression coverage across Rooms plus one protected `status`
   table.

## Decision Pressure

This feature is easy if we accept current backend semantics:

- Rooms Floor/Zone are nullable.
- Referenced deletes clear cells.
- The existing field-config modal is enough after unlocking `"options"`.

It is larger if we require explicit replacement UX, because
`FieldConfigSectionOptions`, `EditCustomFieldBundleRequest`, and the mutation
builder need to carry `optionReplacements`, and the dialog must offer
replacement candidates instead of always using `allowReplacement={false}`.
