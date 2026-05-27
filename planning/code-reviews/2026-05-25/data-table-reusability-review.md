# DataTable — Reusability Code Review

DATE: 2026-05-25
TIME: 14:00 ET
SCOPE: Assess whether the V2 DataTable stack is fit for reuse across many
tables in the app (ERVs, Pumps, Fans, Window Types, Thermal Bridges, and the
Workspace Catalogs pages). Not a public-library review — internal reuse only.

Paths reviewed:

- `frontend/src/shared/ui/data-table/` (core library)
- `frontend/src/features/table_views/` (per-user view-state persistence)
- `frontend/src/features/equipment/components/RoomsTable.tsx`
- `frontend/src/features/equipment/routes/EquipmentTab.tsx` (the only live consumer)
- `backend/features/table_views/` (view-state CRUD)
- `backend/features/project_document/tables/` (per-table contract registry)
- `backend/features/project_document/routes.py` (generic table routes)

---

## TL;DR

The architecture is **well-aligned with the reuse goal**. The seams are in the
right places: `DataTable<TRow>` is genuinely generic; `WriteOp` is the only
write contract; view-state persistence is opaque and keyed on `(project_id,
table_key)`; the backend `TableContract` registry mirrors the same shape.
A new project-document table (e.g. ERVs) can plug in without touching the
shared library.

That said, **the system is well-architected for reuse but has not yet been
exercised that way**. Rooms is the only consumer. Two of the three target
surfaces — `window_types` (project-document) and the workspace **Catalog**
pages — will expose missing pieces:

1. ~400 lines of per-table glue between `<DataTable>` and the slice payload
   live in `EquipmentTab` + `equipment/lib.ts`. That glue will be cloned for
   each new project-document table unless we extract a hook.
2. Workspace Catalogs sit **outside** the `ProjectDocumentV1` tree. They have
   no `project_id`, no draft/version model, and no `TableContract` analogue.
   View-state persistence and custom-field schema-mutations both assume a
   project-scoped document — using DataTable for Catalogs needs a new
   persistence path, not a refactor.

Top three follow-ups, in priority order:

- **Land a second consumer (window_types).** It's the cheapest validator of
  the contract claim and will surface ~80% of the duplication before ERVs/
  Pumps/Fans/Thermal-Bridges arrive.
- **Extract `useProjectDocumentTableMutations`** to absorb the `handleTableWrite`
  switch and the `roomsPayloadFromCellWrites` family of helpers. Per-table
  differences (slice shape, option-key validator, empty-row factory) inject
  cleanly.
- **Decide the Catalogs strategy explicitly.** Either (a) workspace-scoped
  twins of `user_table_views` + a catalog-side custom-fields path, or (b)
  use DataTable as a presentational shell only, with no view-state
  persistence and no custom fields. Both are reasonable; both are real
  schema/routing decisions, not implementation details.

---

## Architecture Summary

### Frontend

```
shared/ui/data-table/
  DataTable.tsx            -- generic <TRow> grid, owns view + edit state
  types.ts                 -- public contracts: FieldDef, WriteOp, ViewState, DataTableProps
  hooks/useTableSchema.ts  -- merges core FieldDefs + custom_fields into one schema
  lib/customFieldMutations -- typed builders for FieldSchemaMutation (mirrors backend union)
  fields/registry.ts       -- field-type → cell-editor mapping
  fields/aggregations.ts   -- aggregation catalogue (sum, count, avg, ...)
  fields/filterOperators   -- per-field-type operator catalogue
  components/...           -- ~30 popovers / dialogs / cells (toolbar, fill handle, etc.)

features/table_views/
  api.ts, types.ts,
  useProjectTableViewState -- debounced load/save of opaque ViewState envelope keyed on (project_id, table_key)

features/equipment/
  components/RoomsTable    -- thin pass-through: builds columnDefs and forwards 16 props
  routes/EquipmentTab      -- the orchestrator: data query + schema + view + WriteOp dispatch
  lib.ts                   -- WriteOp → slice replace payload glue
```

### Backend

```
features/table_views/      -- generic per-user view-state CRUD, opaque JSON, table_key whitelist regex
                              (no awareness of which tables exist)

features/project_document/
  routes.py                -- generic routes:
                                GET/PUT /projects/{p}/versions/{v}/draft/tables/{table_name}
                                POST /draft/tables/{table_name}/custom-fields:mutate
                              -- all routes look up the contract from the registry
  tables/
    registry.py            -- {name → TableContract} dispatch
    contracts.py           -- TableContract + CustomFieldCapability dataclasses
    rooms.py               -- one contract per table
    window_types.py
    _fingerprint.py        -- schema-fingerprint, byte-for-byte identical to FE
  schema_mutations.py      -- typed FieldSchemaMutation union, mirrors FE builders
```

### The write contract

A single `WriteOp` discriminated union flows from grid → consumer:

```
cell | paste | fill | rowInsert | rowDelete | schemaMutation (typed | legacyOptions)
```

`DataTable` never knows what becomes of a WriteOp. The consumer translates it
into the table's slice-replace payload (or, for schema mutations, posts the
mirrored Pydantic envelope). This is the **single most important reuse seam**
and it is genuinely clean.

### View-state persistence

`user_table_views(user_id, project_id, table_key, view_state_schema_version,
view_state JSONB, view_state_size_bytes, updated_at)`. The backend treats
`view_state` as opaque; only the envelope (schema version, 64 KB cap,
`table_key ~ ^[a-z][a-z0-9_]*$`) is validated. The frontend wraps the
ViewState in a `{schema_fingerprint, view_state}` envelope so a load under
a different schema applies for render but doesn't clobber the saved record —
a non-obvious but well-judged invariant.

---

## Strengths

1. **`DataTable<TRow>` is genuinely generic.** No `Room`, no `rooms`, no slice
   names anywhere in `shared/ui/data-table/`. The 24-prop API is the price of
   that abstraction.

2. **`WriteOp` is the right seam.** One callback. One union. Closed enough to
   type-check end-to-end, open enough to grow (added `fill` and `schemaMutation`
   without breaking consumers).

3. **View-state persistence is fully generic.** Adding ERVs costs zero backend
   work in `features/table_views/` — `useProjectTableViewState({ tableKey:
   "ervs" })` just works. Excellent decoupling.

4. **Schema-fingerprint envelope.** Same algorithm on both sides
   (`_fingerprint.py` ↔ `useTableSchema.ts`). Cross-version, cross-schema
   view-state survives without clobbering. Worth keeping.

5. **Backend `TableContract` registry.** One dataclass per table; one dict
   in `registry.py`. Generic routes never branch on `table_name`. This is
   the backend's mirror image of the frontend's `WriteOp` discipline.

6. **`useTableSchema` is the right bridge.** Folds backend `custom_fields[]`
   into the same `FieldDef[]` shape the grid renders, so the grid can't tell
   custom from core. Custom-field column behavior is mechanically derived.

7. **Custom-field schema mutations** ride a typed FE/BE-mirrored union with
   builder helpers exported from the library. Adding `setFormula` later
   landed in lockstep without ad-hoc plumbing.

8. **Test coverage is real.** The library `__tests__/` covers selection, fill,
   row insert/delete, column drag, GridBody, keyboard, paste. The Rooms-side
   suite covers schema-editor flows end-to-end. Regressions when reorganizing
   should be loud.

9. **Composable through props.** Read-only viewer mode, density, overflow
   menu, footer action, custom row-open callback — flexible without making
   the API gigantic. Good restraint here.

10. **Doc comments earn their keep.** Dense code, but the inline `// Plan-N
    §X.Y` references and the `Why:` rationale on subtle invariants are exactly
    what future-you needs.

---

## Concerns

These are about **reuse friction**, not nits. Roughly ordered by impact.

### C1. Per-table glue in `EquipmentTab.handleTableWrite` will be cloned for every table

`EquipmentTab.handleTableWrite` (lines 289–356) is a switch on `op.kind` that
calls `roomsPayloadFromCellWrites` / `roomsPayloadFromRowInsert` /
`roomsPayloadFromRowDelete` etc. and feeds the result into a slice-replace
mutation. The legacy-options branch is another 25 lines of Rooms-specific
option-key handling.

Every other project-document table (ERVs, Pumps, Fans, Thermal Bridges,
Window Types) will need a function with the same shape. The per-table
differences are small:

- the slice query hook and slice type
- the option-key validator (which slice fields are single-selects)
- the row factory for `buildEmptyRow`
- the validation function

**Recommendation.** Before the second consumer lands, extract:

```
useProjectDocumentTableMutations<TRow, TSlice>({
  tableKey,
  sliceQuery,
  replaceMutation,
  schemaMutation,
  payloadBuilders: { fromCellWrites, fromRowInsert, fromRowDelete, replaceOptions },
  optionKeyValidator,
  validate,
}) → { handleTableWrite, commitSchemaMutation, ... }
```

That collapses ~200 lines per consumer into ~30. It also gives a single
place to evolve the draft-stale/version-locked handling — currently
duplicated in `withDraftConflictHandling`.

### C2. `RoomsTable.tsx` is a pass-through wrapper; the pattern should be codified

`RoomsTable` (252 lines) is ~95% forwarding. The 16-prop fan-out at the
bottom will recur identically in ERVsTable, PumpsTable, FansTable. Two
options:

- **(Simpler)** Collapse the per-table wrappers into the orchestrator
  (`EquipmentTab`) and let each tab render `<DataTable>` directly.
- **(More structured)** Build a `<ProjectDocumentTable<TRow, TSlice>>`
  component that consumes the `useProjectDocumentTableMutations` output
  plus per-table `columns: DataTableColumnDef<TRow>[]` and a `tableSchema`,
  and renders `<DataTable>`.

The structured option also gives a natural home for the
`buildRoomsFormulaRegistry` / `buildRoomFormulaRowValues` boilerplate
(see C5).

### C3. Workspace Catalogs are not a project-document table

Catalog pages (`features/catalogs/routes/{Materials,GlazingTypes,FrameTypes}-
CatalogPage.tsx`) currently render hand-rolled `<table>` markup against
`useMaterialsQuery()` etc. Moving them to `<DataTable>` is mostly mechanical
*for presentation*, but two stacks **don't apply**:

- **View-state persistence.** `user_table_views` is keyed on
  `(user_id, project_id, table_key)` and the routes are mounted under
  `/projects/{project_id}/table-views/`. Catalogs have no `project_id`.
  Options: (a) add a `workspace_table_views(user_id, workspace_id,
  table_key)` table + parallel routes, (b) reuse the same table with
  `project_id IS NULL` and relax the route prefix, or (c) skip persistence
  for Catalogs and let them re-default each load. (c) is fine for a first
  cut and avoids new schema.

- **Custom fields.** The whole `apply_schema_mutation_to_draft` pipeline
  assumes the row lives inside a `ProjectDocumentV1` draft. Catalogs are
  long-lived workspace entities edited via dedicated `useDeactivate…` /
  `useReactivate…` mutations against `catalog_*` tables. There is no
  "draft" concept and no `body.tables.<name>.custom_fields` mapping to
  add custom fields to. To support custom fields on a Catalog row, the
  custom-field storage and mutation surface would need a non-document
  parallel — non-trivial.

**Recommendation.** Decide explicitly which Catalog features we want at
phase 1:

- **Phase-1 (cheap):** plain `<DataTable readOnly columns={…}
  fieldDefs={…} view={defaultView} onViewChange={no-op}>` — gets sort,
  filter, group, copy, density, hide-fields, freeze-first-column. No
  persistence, no custom fields. Ships next week.
- **Phase-2:** workspace-scoped view-state persistence (small schema add).
- **Phase-3:** workspace-scoped custom fields (large investment; revisit
  whether Catalogs actually need it before doing it).

### C4. `DataTable.tsx` (1320 lines) and `lib.ts` (1189 lines) are too big to navigate

`DataTable.tsx` holds the orchestration plus the inline plumbing for at
least four sub-flows (formula editor popover, add-field popover, delete-
field dialog, row-delete dialog). `lib.ts` holds filter / sort / aggregate /
group / body-plan / paste / sanitize / option helpers.

Neither is broken — but both are at the size where the next contributor
(plausibly you, in 6 months, adding a feature for ERVs) will spend an
hour just finding the right spot. CLAUDE.md already advises splitting
large modules. Suggested splits:

- `lib.ts` → `lib/filter.ts`, `lib/sort.ts`, `lib/aggregate.ts`,
  `lib/group.ts`, `lib/bodyPlan.ts`, `lib/paste.ts`, `lib/sanitize.ts`,
  `lib/options.ts`.
- `DataTable.tsx` → lift the schema-editor scaffold (`AddFieldPopover`,
  `EditFieldDescriptionPopover`, `FormulaEditorPopover`, the delete-field
  `ConfirmDestructiveDialog`) into a `<DataTableSchemaEditorScaffold>`
  composed inside `<DataTable>`. A read-only Catalog mount could then
  skip it (smaller component tree, less prop-drilling guarding).

### C5. Formula registry / row-values rebuilders are per-table boilerplate

`EquipmentTab.tsx` has `ROOMS_FORMULA_FIELD_ID_BY_COLUMN_KEY`,
`buildRoomsFormulaRegistry`, `readRoomsFormulaValue`,
`buildRoomFormulaRowValues` (~80 lines). The first three are mechanical
transforms over `tableSchema.fieldDefs`; only the column-key ↔ formula-
id mapping is per-table, and that exists solely because the two Rooms
single-selects use namespaced column keys (`rooms.floor_level`) that don't
match their formula-side ids (`floor_level`).

**Recommendation.** Either (a) keep column keys and formula ids identical
across all future tables and provide a default registry-builder in the
shared library, or (b) make the mapping a property of `FieldDef`
(`field_key` for the column, `formula_field_id?` for the formula side) so
`useTableSchema` can synthesize the registry without consumer help.

### C6. The DataTable props surface is large (24+ props) and hard to scan

For a read-only Catalog table, the props that *don't* apply
(`onAddCustomField`, `onRenameCustomField`, `onDuplicateCustomField`,
`onSetCustomFieldDescription`, `onEditCustomFieldFormula`,
`formulaFieldRegistry`, `getFormulaRowValues`, `onDeleteCustomField`,
`buildEmptyRow`, `generateRowId`, `sessionKey`, `onResetView`) outnumber
the ones that do. Not a bug, but discoverability suffers.

**Lighter-touch fix:** group related props in nested objects:

```
<DataTable
  ...
  customFields={isEditor ? {
    onAddField, onRenameField, onDuplicateField, onDeleteField,
    onSetDescription, onEditFormula, formulaRegistry, getRowValues,
  } : undefined}
  rowInsert={canEdit ? { buildEmptyRow, generateRowId, sessionKey } : undefined}
/>
```

Same behavior, much easier to read at a call site and obvious from the
prop list which features are wired.

### C7. The barrel (`shared/ui/data-table/index.ts`) re-exports both public API and helpers

Some exports are clear library API (`DataTable`, `FieldDef`, `WriteOp`,
`useTableSchema`, the mutation builders). Some are internal helpers that
escape because RoomsTable / equipment/lib.ts needed them (`coerceCustomValue`,
`conversionPolicy`, `OPTION_COLOR_PALETTE`, `singleSelectOption` via
`./lib`, `formatDisplayCellValue` via `./lib`).

Not urgent. If/when this gets split into a workspace package, the boundary
will need to be drawn anyway. For now, a comment block in `index.ts`
labelling `// — Public API —` vs `// — Convenience exports —` is enough to
signal stability to future callers.

### C8. Backend per-table contract files duplicate a lot of structure

`rooms.py` is 438 lines. About 60% of it is mechanical: the option-key map,
the formula-type map, the lazy-imported schema-mutation hooks, the read/
write helpers for `row.custom`. Two tables is fine; at three it will start
to bite, and there are six target tables.

**Recommendation when adding the third custom-field-capable table:**
factor a `make_custom_field_capability(...)` builder that takes the small
per-table specifics (core field tuple, formula types, option-key map,
table envelope reader/writer) and produces a `CustomFieldCapability`. Don't
do it speculatively for two tables.

### C9. `coreFieldKeys` is a `Set` but the fingerprint is order-dependent

`TableSchema.coreFieldKeys` is typed as `Set<string>` but
`computeTableSchemaFingerprint` builds the digest payload via
`Array.from(coreFieldKeys)`, which preserves *insertion order* — not
schema order. The hook accepts a separate `fingerprintCoreFieldKeys:
readonly string[]` prop precisely to work around this. A reviewer would
have to read both call sites to discover why.

**Recommendation.** Take the canonical input as the ordered `readonly
string[]`, derive the `Set` for membership checks. Drop the second prop.

### C10. The FE↔BE custom-field-type mapping is hand-maintained in three places

Adding a new custom-field type (say `boolean`) requires lockstep edits to:

- backend `CustomFieldType` enum
- frontend `CUSTOM_FIELD_TYPE_TO_FIELD_TYPE` (useTableSchema.ts:60)
- frontend field-type registry (`fields/registry.ts`) + operator catalogue
- frontend type-conversion matrix (`lib/typeConversionMatrix.ts`)

No bug today — but a checklist in `CODING_STANDARDS.md` (or a comment at
the top of each touchpoint pointing at the others) would prevent the
inevitable forgotten file.

---

## Reuse Readiness — by Target Table

| Table | Backend lift | Frontend lift | Risks |
|---|---|---|---|
| **window_types** (already a contract, no custom fields yet) | Tiny — already registered. Add `CustomFieldCapability` if you want custom fields. | Small — build columnDefs, plumb WriteOp via the same `handleTableWrite` shape. | Will surface C1/C2 immediately — perfect first proof. |
| **ERVs, Pumps, Fans** (project-document) | Add `TableContract` + `CustomFieldCapability` (~400 LOC each, mostly mechanical). Backend tables exist in document already? — verify before estimating. | Same shape as Rooms; the right time to extract `useProjectDocumentTableMutations`. | Repetition of `rooms.py` structure. |
| **Thermal Bridges** | Same as ERVs (project-document). | Same. | Same. |
| **Catalog: Materials / Glazing / Frame** | Substantial — Catalogs are not project-document rows. View-state and custom-field paths need workspace-scoped twins (or be skipped). | Small for presentational reuse; large if persistence + custom fields are wanted. | C3 (architectural gap). Decide phase scope first. |

---

## Recommendations, prioritized

1. **(Now)** Land `window_types` on `<DataTable>` as the second consumer. It's
   the cheapest validator of the contract claim and the duplication will
   point at the right extraction.
2. **(Now or right after)** Extract `useProjectDocumentTableMutations` + a
   `<ProjectDocumentTable>` component to absorb the orchestrator boilerplate.
   Migrate Rooms to it; window_types lands on it natively.
3. **(Before Catalogs)** Decide and document the Catalog scope: read-only
   presentational reuse only (phase 1), or workspace-scoped persistence +
   custom fields (phase 2/3). Don't start the migration before the decision.
4. **(Maintenance)** Split `DataTable.tsx` and `lib.ts`. Lift the schema-
   editor scaffold out of `DataTable.tsx` so read-only mounts skip it.
5. **(Polish)** Group related props on `DataTableProps` (`customFields={…}`,
   `rowInsert={…}`); tighten the barrel; document the FE↔BE custom-field-type
   touchpoint set.
6. **(Backend, when adding the third custom-field-capable table)** Extract
   `make_custom_field_capability(...)` to absorb the mechanical 60% of
   per-table contract files.

None of these are blockers. The bones are right; the lift now is to prove
reuse on a second consumer and codify the orchestrator shape before
duplicating it five more times.
