---
DATE: 2026-06-23
TIME: 23:35 EDT
STATUS: Deferred
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Behavior contract for opening the DataTable field-config "manage options"
  modal on catalog single-select fields and routing its save through the catalog
  controller.
RELATED:
  - ./README.md, ./STATUS.md
  - planning/archive/dated/2026-06-23/window-frames-catalog-enums/phases/phase-05-frontend-single-select.md (§5b)
---

# PRD — Catalog "Manage Options" Modal

## The gap (one paragraph)

The translation half is **done**: the frame-types `controller.ts` already
handles a `schemaMutation` of variant `legacyOptions` — it derives add / rename /
reorder / delete-unused from the new option list (backend reconciles by id) and
folds an in-use option's rows into the cascade's replacement label
(`buildLabelReplacements` → backend `replacements`, the `OP-TO-FIX` merge).
21 vitest tests cover this. The **missing** half is purely UI plumbing: the modal
that produces that `legacyOptions` mutation never opens for a catalog grid.

## Why it doesn't open today

- The field-config "manage options" modal **renders** only when the DataTable is
  given `onEditCustomFieldBundle` (`DataTable.tsx:1475`).
- The header **open trigger** is gated by `canEditFieldConfig`, which needs
  `editConfigEnabled = !readOnly && Boolean(onWrite) && Boolean(onEditCustomFieldBundle)`
  (`DataTable.tsx:1109`, surfaced via `onEditCustomFieldConfig` at `:1175`;
  `GridHeader.tsx:~202-213`).
- Catalog pages drive the grid with the bespoke `onWrite` controller and pass
  **neither** `onEditCustomFieldBundle` nor `onEditCustomFieldConfig`. So the
  trigger is disabled and the modal is unmounted.

## Behavior to deliver

1. For the six frame-types single-select fields (and, by the same shape, the
   materials `category` field), expose a "manage options" affordance from the
   column field-config menu.
2. Opening it shows the field's current options (label / color / order) and
   supports **rename, reorder, delete, and delete-with-replacement (merge)**.
3. **Save dispatches a `legacyOptions` `schemaMutation` through the existing
   catalog `onWrite` controller** — it must **not** route through the
   project-document custom-field mutation pipeline. The controller already
   translates this to `PUT …/frame-types/options` (+ `replacements` on merge);
   do not duplicate that logic.
4. On save, invalidate `useFrameTypeOptions` so the grid reflects the new
   vocabulary.

## Design constraint — shared DataTable, not a per-catalog fork

The open-trigger gate and modal live on the **shared** DataTable. Wiring this
must keep the iron-law: the affordance is parent-owned and uniform, not a
bespoke per-table opt-in bolt-on. Decide deliberately whether to (a) let the
catalog pass the existing bundle handlers with a catalog-flavored adapter, or
(b) generalize the gate so an `onWrite`-driven single-select with unlocked
`options` qualifies without the document bundle. Prefer the path that does not
special-case "catalog" inside the shared component. (See
`feedback_datatable_uniformity_ironlaw`.)

## Acceptance

- The "manage options" trigger appears for a catalog single-select column and
  the modal opens.
- Rename an option → grid + persisted options update.
- Reorder options → order persists across reload.
- Delete an **in-use** option with a chosen replacement → rows fold to the
  replacement label (the `catalog_option_in_use` backend guard surfaces as a
  "pick a replacement" prompt, not a hard error).
- All edits flow through `onWrite` / `editFrameTypeOptions`, verified in the
  network panel as `PUT …/frame-types/options`.
- `pnpm run format`; `make frontend-dev-check`; `make ci` green. Playwright MCP
  smoke per `planning/features/.instructions.md` browser lessons.

## Non-goals

- No new backend route or controller logic — both already exist and are tested.
- No change to inline "+ Add option" (already shipped in Phase 5a).
- Glazing types are out of scope unless their catalog grows single-selects (the
  generic wiring should make adding them cheap, per D-7).
