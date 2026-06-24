---
DATE: 2026-06-23
TIME: 23:35 EDT
STATUS: Deferred
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Wire the shared DataTable field-config "manage options" modal so it opens
  for catalog single-select fields (frame-types + materials), dispatching its
  option edits as a `legacyOptions` schemaMutation through the catalog `onWrite`
  controller (translation logic already shipped).
RELATED:
  - planning/archive/window-frames-catalog-enums/phases/phase-05-frontend-single-select.md (§5b OPEN — origin of this item)
  - planning/archive/window-frames-catalog-enums/decisions.md D-4 (inline add + manage-options)
  - frontend/src/shared/ui/data-table/DataTable.tsx (1109 editConfigEnabled, 1175 onEditCustomFieldConfig, 1475 modal render)
  - frontend/src/shared/ui/data-table/GridHeader.tsx (~202-213 canEditFieldConfig open trigger)
  - frontend/src/features/catalogs/frame-types/controller.ts (editFrameTypeOptions — translation already handles legacyOptions)
---

# Catalog "Manage Options" Modal — wire the field-config path for catalog single-selects

## Why this exists

The window-frames-catalog-enums feature shipped (archived at
[`planning/archive/window-frames-catalog-enums/`](../../archive/window-frames-catalog-enums/README.md)).
Phase 5b completed and unit-tested the **translation logic** that turns a
DataTable `legacyOptions` `schemaMutation` (rename / reorder / delete-with-merge)
into catalog option-store REST calls (`PUT …/frame-types/options` +
`replacements`) — this is the user-facing `OP-TO-FIX` typo-merge cleanup tool.

What did **not** ship is the **UI wiring that opens the modal**. The field-config
"manage options" modal only renders when the DataTable receives
`onEditCustomFieldBundle`, and the header open-trigger (`canEditFieldConfig`)
only enables when `editConfigEnabled` is true — which requires
`onEditCustomFieldBundle` to be passed (`DataTable.tsx:1109,1175,1475`;
`GridHeader.tsx:~202-213`). The catalog pages (**frame-types and materials**)
drive their grids with the bespoke `onWrite` controller, not the
project-document custom-field bundle path, so they pass **neither** handler. The
modal is therefore **unreachable** for a catalog single-select — which is why the
Phase 5 browser smoke found no trigger.

Net: the merge/rename/reorder backend + controller exist and are tested, but a
user has no way to reach them. Inline "+ Add option" already works (the popover
create-footer is not gated by this), so the catalog is usable today; this folder
is the missing manage/cleanup surface.

## Read order

1. `PRD.md` — the exact gap, the seam, and the acceptance behavior.
2. `STATUS.md` — current disposition and the trigger that promotes this to active.

## Notes

- `canEditFieldConfig` does **not** require a custom field — a built-in
  single-select qualifies once the handler is wired.
- This touches the **shared (iron-law) DataTable** surface plus the catalog
  pages, so it must be done deliberately with the dev env up to verify, not as a
  drive-by. See `feedback_datatable_uniformity_ironlaw` in memory.
