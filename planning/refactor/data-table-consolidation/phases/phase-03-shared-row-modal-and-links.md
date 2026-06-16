---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Unify the row-edit modals into one shared modal/hook, make
  single-select-in-modal use the shared editor, and unify linked-record /
  inverse-link rendering across Pumps, Ventilators, and Heat Pumps.
RELATED:
  - planning/refactor/data-table-consolidation/PRD.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - frontend/src/features/equipment/components/RoomModal.tsx
  - frontend/src/features/equipment/components/VentilatorRowModal.tsx
  - frontend/src/features/equipment/heat-pumps/components/
  - frontend/src/shared/ui/data-table/fields/linkedRecord/
---

# Phase 03 - Shared Row Modal And Links

## Goal

Collapse the six near-duplicate row-edit modals into one shared modal /
form hook, make modal single-select and linked-record editing use the
shared editors (not bespoke `<select>` / `<datalist>` / `OptionPicker`),
and unify the inverse/incoming-link column into one implementation
(review F4, F5, F6).

## Preconditions

- Phase 00 complete (the `setCustomValue` shadow is gone).
- Phase 02 complete (shared number-input parser exists; field-wrapper
  consolidation can build on it).

## Tasks

1. **Shared row-edit modal (F4).** Create a `<RowEditModal>` /
   `useRowEditForm` in a shared location that owns the common scaffold:
   `draft` + `error` + `isSaving` state, the `save()` validate/try/catch
   flow, the `ModalDialog` + `project-form` chrome, the error paragraph,
   and the `modal-actions` footer (Cancel + submit + optional Delete +
   optional `frozenReason`). Migrate `RoomModal` and `VentilatorRowModal`
   onto it; consolidate the local `TextField` / `NumberField` /
   `NumberInput` wrappers into one shared set.
2. **Single-select in modals (F5).** Replace modal single-select editors
   (Ventilator raw `<select>`, Room `<datalist>` input, heat-pump
   `OptionPicker` usage) with a shared single-select editor wrapper over
   `SingleSelectPopover` / `SingleSelectDefaultPicker`, so single-selects
   render one way in grid and modal. (Removing `OptionPicker` itself lands
   with the heat-pump migration in Phase 05; this phase makes the shared
   editor available and adopts it where modals already exist.)
3. **Linked-record selection in modals.** Replace the raw-`<select>`
   linked-record pickers in heat-pump modals with the shared
   `fields/linkedRecord/Picker`, so linked-record selection is one
   component in grid and modal.
4. **Unified inverse/incoming-link column (F6).** Pick one
   implementation for the "incoming links as clickable pills" column and
   make Pumps, Ventilators, and Heat Pumps (`link-fields.ts`
   `incomingUnitColumnDef`) use it. Settle one pill-label policy (resolve
   real identifiers, not raw ids) and one click behavior (open in-page
   row modal per `data-table.md`; route navigation only for explicit
   cross-route flows). Move the shared link layer out of `heat-pumps/`
   into a neutral shared location.
5. **CSS namespace rename (F9).** Rename the `hp-` modal-form classes
   (`hp-modal-form`, `hp-modal-section`, `hp-form-grid`,
   `hp-form-grid__wide`) to a neutral shared namespace now that
   Ventilator/Room modals consume them, and update all consumers.
6. **Tests.** Cover the shared modal (open/edit/save/error/delete/frozen),
   shared single-select editor parity, shared linked-record picker, and
   the unified inverse-link column (label + click behavior).

## Acceptance Criteria

- One `<RowEditModal>` / `useRowEditForm` backs Rooms and Ventilators
  (and is ready for the heat-pump modals in Phase 05); no duplicate
  state/save/error scaffolds remain in those files.
- Single-select editing looks and behaves the same in grid and modal.
- Linked-record selection uses the shared `Picker` in grid and modal.
- The inverse/incoming-link column has one implementation, one
  pill-label policy, and one click behavior across Pumps and Ventilators.
- The `hp-` modal-form classes are renamed to a neutral namespace with no
  dangling references.
- Focused frontend tests pass; browser smoke confirms modal parity.

## Stop Conditions

- Stop if the shared modal cannot express a real per-table field set
  without leaking feature-specific logic into the shared component;
  prefer a field-descriptor input over per-table branches.
- Stop if unifying the inverse-link click behavior would break an
  existing deep-link/navigation flow that users rely on; record the
  exception and keep route navigation only where required.

## File Entry Points

- `frontend/src/shared/ui/data-table/` (new `RowEditModal` /
  `useRowEditForm` / shared single-select editor + neutral modal CSS)
- `frontend/src/features/equipment/components/RoomModal.tsx`
- `frontend/src/features/equipment/components/VentilatorRowModal.tsx`
- `frontend/src/features/equipment/components/PumpsTable.tsx`
- `frontend/src/features/equipment/components/VentilatorsTable.tsx`
- `frontend/src/features/equipment/heat-pumps/link-fields.ts`
- `frontend/src/features/equipment/equipment.css`
