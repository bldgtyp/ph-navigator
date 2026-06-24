---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Done (2026-06-24) — code implemented; tsc + vite build + vitest green (21 catalog tests). Browser smoke pending Phase 6.
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 5 — frontend: manufacturer + brand → single_select, read-only name, inline-add
RELATED:
  - ../decisions.md D-3 (read-only name), D-4 (inline-add; manage-options modal deferred)
  - frontend/src/features/catalogs/frame-types/{fieldDefs.ts,controller.ts} (the mirror)
  - frontend/src/features/catalogs/routes/FrameTypesCatalogPage.tsx (the wiring mirror)
  - planning/archive/dated/2026-06-23/window-frames-catalog-enums/phases/phase-05-frontend-single-select.md
---

# Phase 5 — Frontend single-select + read-only name

## Goal

In the glazing-types DataTable: render `manufacturer` + `brand` as **single_select**
with options fetched from the catalog store, render `name` **read-only/derived**,
and wire inline "+ Add option" to `PUT …/glazing-types/options`. The
manage-options *modal* (rename/merge/reorder UI) is **out of scope** — it inherits
the shared-DataTable blocker (see "Scope boundary" below); the option-edit
translation *logic* may be built + unit-tested to match frame, but it has no reach
yet.

## Depends on / unblocks

- **Depends on:** Phases 1–4 (options API, derived name, import v2). Last build phase.
- **Unblocks:** Phase 6 closeout.

## The core integration risk (read first)

Same as frame: the DataTable single-select machinery stores the option **id** as
the cell value, but glazing stores the **label** string (D-2). So `controller.ts`
must do **bidirectional id↔label translation** (rows→grid: label→id for the pill;
cell write→backend: id→label for PATCH; inline-add: persist option, then PATCH the
label). This is the real work — budget for it. The frame `controller.ts` is a
complete, tested template; glazing's is the same with **two** single-select fields
instead of six.

## Scope boundary — manage-options modal (D-4)

Confirmed: **neither** `FrameTypesCatalogPage` nor `GlazingTypesCatalogPage` passes
`onEditCustomFieldBundle`/`editConfigEnabled` to the DataTable, so the field-config
"manage options" modal is **unreachable** for catalog single-selects. Wiring it is
a shared-DataTable task tracked as `planning/features_v1.1/catalog-manage-options-modal/`.
Glazing **inherits** that dependency. What ships in this phase: single-select
display, read-only name, and **inline-add** (which works because the
`SingleSelectPopover` create-footer is not gated by the options lock). Casing
cleanup is already handled server-side (Phase 0/4), so glazing does not need the
merge UI to ship.

## Work items

### 5.1 Shared frontend additions (`catalogs/{api,query-keys,hooks,types}.ts`)

Mirror the frame additions:

- `api.ts`: `getGlazingTypeOptions()` (`GET …/glazing-types/options`) and
  `putGlazingTypeOptions(payload)` (`PUT …/glazing-types/options`).
- `query-keys.ts`: `glazingTypeOptions()` key.
- `hooks.ts`: `useGlazingTypeOptionsQuery()` selecting `payload.fields`.
- `types.ts`: `CatalogGlazingTypeOption`, `CatalogGlazingTypeOptionsResponse`,
  `EditCatalogGlazingTypeOptionsPayload` (field_key, options[], replacements) —
  **two** fields only.

### 5.2 `glazing-types/fieldDefs.ts`

- Add `export const GLAZING_TYPES_SINGLE_SELECT_FIELDS = ["manufacturer", "brand"] as const;`.
- Change `manufacturer` + `brand` `builtInFieldDef(...)` from `"short_text"` →
  `"single_select"`.
- Replace the static `GLAZING_TYPES_FIELD_OVERLAY` export with:
  `SINGLE_SELECT_BASE_OVERLAY` (`locked: [...DEFAULT_BUILT_IN_LOCKS, "field_type"]`,
  options **unlocked**), `GLAZING_TYPES_STATIC_OVERLAY` (`name: { locked: …,
  read_only: true }` — drop `required: true`; keep the existing `u_value`/`g_value`
  /color/source/comments overlays + the `suffix` lock), and a
  `buildGlazingTypesFieldOverlay(optionsByField)` that injects each field's options
  + merges the static overlay. Direct mirror of `frame-types/fieldDefs.ts:60-137`.
- Import the `FieldOption` type.

### 5.3 `glazing-types/controller.ts`

Mirror `frame-types/controller.ts`:

- `buildGlazingTypeOptionMaps(optionsByField)` → `{ idToLabel, labelToId }` over
  the two fields; `toGlazingTypeRow(record, maps)` maps stored labels → option ids
  for display.
- `valueForField(fieldKey, value, idToLabel)`: **drops `name`** (`include: false`);
  for single-select fields maps id → label (nulls pass through); other fields
  verbatim. Use it in `groupCellWritesByRow` and `buildCreatePayload`.
- `buildCreatePayload(fieldDefaults, idToLabel)`: **omit `name`** entirely (server
  derives it; drop `DEFAULT_NEW_GLAZING_NAME`); map option defaults id → label.
- inline-add: `persistNewOptions(op.newOptions, optionsByField)` → `PUT …/options`
  with the field's full list + the new option, **before** the row PATCH; merge the
  new id→label so the same cell write resolves.
- `schemaMutation` handler: replace the unconditional throw — accept
  `variant === "legacyOptions"` for the two fields and dispatch
  `editGlazingTypeOptions` (logic mirrors frame's `buildLabelReplacements` →
  backend `replacements`); still throw for custom-field mutations. (No reach until
  the v1.1 modal lands, but the logic + tests match frame 5b.)
- `GlazingTypesCatalogControllerArgs` gains `optionsByField: Record<string,
  FieldOption[]>`; `invalidate` also invalidates `glazingTypeOptions()`.

### 5.4 `routes/GlazingTypesCatalogPage.tsx`

- `const optionsQuery = useGlazingTypeOptionsQuery();`
- `const optionsByField = useMemo(() => optionsQuery.data ?? {}, [optionsQuery.data]);`
- `const optionMaps = useMemo(() => buildGlazingTypeOptionMaps(optionsByField), [optionsByField]);`
- Pass `fieldOverlay: buildGlazingTypesFieldOverlay(optionsByField)` to
  `buildTableSchema` (update its deps to include `optionsByField`).
- Pass `optionsByField` into the controller. Map rows through
  `toGlazingTypeRow(record, optionMaps)`.
- Do **not** add `onEditCustomFieldBundle`/`editConfigEnabled` here (out of scope —
  the v1.1 modal task owns that across both catalog pages).

### 5.5 `glazing-types/import_export/types.ts`

- `CURRENT_SCHEMA_VERSION` 1 → 2; update the FILE_KIND comment.
- Add `dropped: number` to `PreviewCounts`. The `ImportDialog` already renders
  `schema_version` and a conditional `dropped` count + the generic `new_option:…`
  warnings via `ReasonList` — **no dialog changes needed**.

## Tests (vitest — mirror the frame `__tests__`)

- `fieldDefs.test.ts`: `manufacturer`/`brand` are `single_select`; `options`
  unlocked; `name` read-only; overlay injects fetched options.
- `controller.test.tsx`: single-select cell write maps id → label; `name` writes
  dropped; create payload omits `name`; inline-add persists option **before** the
  row PATCH; `legacyOptions` mutation → `PUT …/options` (rename + merge
  replacements); custom-field mutation rejected.
- `export.test.ts` (new): schema v2; `name` round-trips; `manufacturer`/`brand`
  serialize as labels.

## Browser smoke (Playwright MCP — per `planning/features/.instructions.md`)

Sign in as **Ed** (`ed@example.com`) — the seeded project/catalog data is his
(`project_dev_seed_project_owner` memory). Ensure the dev DB is migrated (the
frame session found it stale at `0036`; `make migrate`). Smoke: pick a
`manufacturer`/`brand` option; add a new option and confirm it **persists across
reload**; edit `brand` and confirm `name` recomposes (`manufacturer | brand |
suffix`); confirm the `name` cell is not editable.

## Exit criteria

- `pnpm run format`; `make frontend-dev-check`; `make ci` green.
- Manual smoke: option add persists, name derives from parts, name read-only.

## Risks / notes

- **Translation layer is the risk** — keep glazing option mutations flowing to the
  catalog REST store; never route them through the project-document mutation
  pipeline. All calc stays backend; the TS name mirror (if added) is display-only.
- The manage-options modal gap is **expected** and documented (D-4) — do not try to
  wire `onEditCustomFieldBundle` here; that is the shared v1.1 task.
