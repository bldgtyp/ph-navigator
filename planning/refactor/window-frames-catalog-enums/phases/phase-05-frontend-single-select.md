---
DATE: 2026-06-23
TIME: 18:25 EDT
STATUS: Draft — depends on Phases 1–4 (backend complete)
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 5 — frontend: six fields → single_select (unlocked), read-only derived name, manage-options wired to the catalog store
RELATED:
  - ../decisions.md D-3 (read-only name), D-4 (inline add + manage-options)
  - ./phase-01 (options API), ./phase-03 (name composer)
  - frontend/src/features/catalogs/frame-types/{fieldDefs.ts,controller.ts}
---

# Phase 5 — Frontend single-select + read-only name + manage-options

## Goal

In the frame-types DataTable: render the six fields as **single_select** with
options fetched from the new catalog option store, render `name` **read-only/
derived**, and wire inline "+ Add option" and a "manage options"
(rename/merge/reorder/delete) path to the Phase 1 endpoints. The merge path is the
user-facing `OP-TO-FIX` cleanup tool.

## Depends on / unblocks

- **Depends on:** Phases 1–4 (options API, derived name, import v2). This is the
  last build phase.
- **Unblocks:** Phase 6 closeout.

## The core integration risk (read first)

The DataTable single-select machinery (`SingleSelectPopover`, `OptionListDelta`
with `newOptions`/`removedOptions`, the `legacyOptions` `schemaMutation` variant —
`shared/ui/data-table/types.ts:255-258,357-367`) was built for the
**project-document** custom-field mutation pipeline. Catalogs do **not** use that
pipeline. So the frame-types `controller.ts` must **translate** option-list
changes into **catalog option-store REST calls** (`PUT …/frame-types/options`),
not emit document schema-mutations. This translation is the real work of Phase 5;
budget for it.

## Scoping (2026-06-24) — id↔label impedance + sub-phase split

A frontend exploration surfaced a complication the original plan under-weighted:
**the DataTable single-select stores the option `id` as the cell value** (materials
maps `opt_<id>`→its category id), but **frame-types stores the label string**
(D-2). So this phase needs a **bidirectional id↔label translation** that exists in
no current precedent:
- **rows → grid:** map `row[field]` (label) → option `id` (via a label→id map
  built from fetched options) so the pill renders;
- **cell write → backend:** map the grid's option `id` → label before PATCH;
- **inline add:** the cell op carries `newOptions[field]=[{id,label,color,order}]`
  (a client-minted id) + a cell write whose value is that id → the controller must
  `PUT …/options` (persist the option) **and** PATCH the row with the **label**;
- **manage-options:** `schemaMutation`/`legacyOptions` `after.options` → `PUT
  …/options`; option deletes cascade as `cellWrites` (id→id) that must map to the
  backend's label-keyed `replacements`.

Key WriteOp shapes (from `shared/ui/data-table/types.ts`): `FieldOption =
{id,label,color,order}` (118-123); cell op `{kind:"cell",writes,newOptions?,
removedOptions?}` (340-342); `{kind:"schemaMutation",variant:"legacyOptions",
before,after,cellWrites?}` (358-367). Options are fed via the fieldDef/overlay
`options: FieldOption[]`; the controller currently **throws** on `schemaMutation`
(`controller.ts:147-150`).

Because of the impedance + the editable-options translation, Phase 5 is **split
into sub-phases** (each independently shippable):

- **Phase 5a — single-select display + read-only name. ✅ Complete (2026-06-24).**
  Options-fetch hook/api/types/query-key; promote the six `short_text` →
  `single_select` with fetched options injected via overlay; id↔label translation
  for row display + cell-pick writes; **inline-add** (cell `newOptions` → PUT +
  PATCH label — couldn't be deferred since the popover create-footer isn't gated
  by the `options` lock); `name` read-only (`read_only: true` + controller skips
  name writes) + dropped from the create payload. Field-config manage-options
  (`schemaMutation`) still locked/throwing → Phase 5b. 18 vitest tests. **Browser-
  smoked** (Playwright MCP): pills render the right labels, derived name renders,
  options API returns canonical counts. The smoke caught that the **dev DB was
  unmigrated** (`0036`) — `make migrate` applied `0037`–`0039`.
- **Phase 5b — editable options (the integration risk).** Unlock `options`; handle
  inline-add (`cell.newOptions` → `PUT …/options` + PATCH label) and manage-options
  (`schemaMutation`/`legacyOptions` → `PUT …/options` + `replacements`). Merge is
  the `OP-TO-FIX` cleanup tool. Playwright MCP smoke.
- **Phase 5c — import dialog v2.** Bump the frontend import schema to 2; render the
  new `new_option:<field>` warnings + the `dropped` count from the preview.

## Work items

### 5.1 `fieldDefs.ts` — promote the six, fetch options, leave unlocked

Current state: all six are `builtInFieldDef(..., "short_text")`
(`fieldDefs.ts:27-35`), overlays carry `locked: DEFAULT_BUILT_IN_LOCKS`
(`:51-59`), no `options`. PRD-D4 deferral comment at `:45-48`.

- Change the six `builtInFieldDef(...)` calls from `"short_text"` →
  `"single_select"`.
- Provide each field's `options` from the catalog store via TanStack Query
  (new `useFrameTypeOptions()` hook → `GET …/frame-types/options`,
  `CatalogFrameTypeOptionsResponse.fields`). Map each backend `SingleSelectOption`
  → the frontend `FieldOption` (`types.ts:118-123`) shape (id/label/color/order —
  identical fields, direct map).
- **Do NOT** lock `options` (unlike materials `category` which locks
  `["field_type","options","delete","duplicate"]` — `materials/fieldDefs.ts:83-87`).
  For frame-types the `options` attribute stays **unlocked** so inline add and
  manage-options work. Keep `field_type`/`delete`/`duplicate` locked as
  appropriate (these are built-ins).

### 5.2 `name` → read-only derived

- `fieldDefs.ts:26` (`builtInFieldDef("name","Name","short_text")`) + overlay
  `:50` (`name: { locked: DEFAULT_BUILT_IN_LOCKS, required: true }`): make `name`
  non-editable. Either keep `short_text` but lock editing, or model it as a
  display-only/`formula`-style read cell. Simplest: keep the column, mark it
  read-only and drop `required` (the client no longer supplies it).
- `controller.ts` `buildCreatePayload` (`:61-75`): today it sets `name`
  explicitly (`:63-66`) and skips it from the extras loop (`:69`). With derived
  name, **remove `name` from the create payload entirely** — the backend computes
  it (Phase 3 rejects inbound name). Drop `DEFAULT_NEW_FRAME_NAME` usage.
- Optimistic display: optionally mirror `compose_frame_name` in TS so the grid
  shows the new name immediately on edit before the server round-trips; the
  server value remains authoritative.

### 5.3 Inline "+ Add option" → catalog store

- When `SingleSelectPopover` create-flow yields a new option (the popover supports
  create at the parent-reducer level — `SingleSelectPopover` props
  `types.ts` / component), intercept in `controller.ts` and call
  `PUT …/frame-types/options` with the field's full option list + the new option,
  then invalidate the `useFrameTypeOptions` query so the new label is selectable.
  **Add-then-write ordering** (Phase 2 contract): persist the option before the
  row cell write that uses it.

### 5.4 Manage-options path (rename / merge / reorder / delete)

- Add a field-config "manage options" affordance for the six. It issues
  `PUT …/frame-types/options` with the full edited list and, for deletes of in-use
  labels, the `replacements` map (Phase 1 cascade-guard / merge). **Merge** =
  select `OP-TO-FIX`, set replacement `OP-to-FX`, delete → backend rewrites rows.
- Surface the backend `catalog_option_in_use` rejection as a "pick a replacement"
  prompt rather than a hard error.

### 5.5 Import dialog → v2

- Bump the frontend import/export types + dialog to `schema_version: 2`
  (mirror `file_format.py` v2). The preview surfaces the new `new_option` warning
  (Phase 4) — render it. Export already serializes computed `name` + labels.

## Tests

- **vitest** `fieldDefs.test.ts`: the six are `single_select`; `options` unlocked;
  `name` read-only.
- **vitest** `controller.test.tsx`: create payload omits `name`; cell write to a
  known option succeeds; add-option calls the options endpoint before the row
  write.
- **Playwright MCP smoke** (per `planning/features/.instructions.md` browser
  lessons): pick an option from the dropdown; add a new option and confirm it
  **persists across reload**; edit `operation` and confirm `name` recomposes;
  confirm `name` cell is not editable; run a merge and confirm rows update.

## Exit criteria

- `pnpm run format`; `make frontend-dev-check`; `make ci` green.
- Manual smoke: option add persists, name derives from parts, name read-only,
  merge cleans a typo.

## Risks / notes

- **Translation layer (5.3/5.4)** is the risk — the DataTable wants to emit
  document-style `OptionListDelta`/`legacyOptions`. Keep frame-types' option
  mutations flowing to the catalog REST store; do not route them through the
  project-document mutation pipeline.
- All calculation stays backend (CLAUDE.md hard rule): the TS `compose_frame_name`
  mirror is **display-only**; never the source of truth.
- Glazing/materials are out of scope (D-7) but the hook + translation layer should
  be written generically enough to lift later.
