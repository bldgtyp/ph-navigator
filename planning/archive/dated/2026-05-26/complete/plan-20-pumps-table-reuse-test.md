---
DATE: 2026-05-25
TIME: 14:30 ET
STATUS: Proposal. Ready to scope into PRs once shape is agreed.
PARENT-REVIEW: planning/code-reviews/2026-05-25/data-table-reusability-review.md
RELATED:
  - planning/archive/dated/2026-05-24/plan-13-custom-fields-overview.md
    (custom-fields phase 5 calls out ERVs/Pumps/Fans/Thermal-Bridges
    as the next custom-field-capable tables; this plan stages the
    presentation layer for Pumps ahead of that)
  - planning/archive/dated/2026-05-24/plan-14-custom-fields-phase-1-document-shape.md
    (RoomsTableEnvelope precedent — Pumps follows the same shape
    when custom fields land in Phase 3 of this plan)
  - context/technical-requirements/data-table.md (write pipeline,
    WriteOp contract, view-state envelope)
---

# Plan 20 — Pumps table: first proof of DataTable reuse

## 1. Goal

Stand up a **Pumps** table inside the Equipment tab as the second real
consumer of `<DataTable>`. The point is not Pumps for their own sake —
it is to **validate the reuse claim** made by the V2 DataTable
architecture by going through the full motion of adding a new
project-document table end-to-end, using the existing patterns.

Pumps was chosen (over ERVs / Fans / Thermal Bridges / Window Types)
because it is the simplest *project-side* table in scope:

- self-contained line-item rows (no list-typed fields, no foreign
  references to other tables);
- one single-select (`device_type`) but **none required** — Rooms
  forces `floor_level` to a non-null option id, which drives a chunk
  of `required_core_select_fields` validation that Pumps avoids;
- no formula needs in the MVP (no `rows_computed` overlay);
- no draft / catalog refresh story (Pumps don't sync from a workspace
  catalog the way window_types or assemblies do).

Rooms has two namespaced single-selects, one required; Pumps has one
namespaced single-select, none required. The shape is the same — the
edge cases are fewer. If the reuse pattern doesn't fit Pumps cleanly,
it doesn't fit anything.

## 2. Non-goals for this plan

- **Custom fields on Pumps.** Deferred to Phase 3 (below). MVP Pumps is
  a fixed-column table.
- **Formula support.** Deferred — no `rows_computed` overlay.
- **Catalog refresh.** No `catalog_origin` field, no
  `refresh-from-catalog` route.
- **The Workspace Catalog DataTable migration.** Out of scope. See
  the parent review §C3 — Catalogs need a separate decision.
- **Refactoring `DataTable.tsx` / `lib.ts`.** Parent-review C4. Worth
  doing, but unrelated to whether Pumps can ride the existing pattern.

## 3. Phasing

Three phases, sequenced so each one is independently shippable and
each one answers a specific question.

| Phase | Ships | Answers |
|---|---|---|
| **P1 — Clone the pattern.** Stand up Pumps end-to-end by copying the Rooms shape. No abstraction work. | A working Pumps subtab with view/sort/filter/group/edit/copy/paste/fill/row-insert/row-delete/keyboard, backed by a draft round-trip. | "Does the existing pattern actually reach end-to-end without the library blocking us?" |
| **P2 — Extract the orchestrator helper.** With two real consumers in hand, factor out `useProjectDocumentTableMutations` (and `useTableDraftBroadcast` if duplication justifies it) and migrate both Rooms and Pumps onto it. | One hook shared by both consumers; per-tab orchestrator code drops from ~400 LOC to ~80. | "Is the duplication mechanical enough to factor cleanly?" |
| **P3 (deferred) — Custom fields on Pumps.** When (and only when) the certification team asks for them, add a `PumpsTableEnvelope` + `CustomFieldCapability` mirror of Rooms. | Pumps with the same custom-field surface as Rooms. | Not asked yet — don't build it yet. |

The plan describes P1 and P2 in detail. P3 is a one-paragraph
forward-looking note.

## 4. The MVP Pump shape

Locked, app-defined core columns. No required fields in MVP — rows
can be added blank and filled progressively. Column display order
matches the order below; the **first column (`device_type`) is the
sticky/frozen column** in the grid unless §10 OQ-1 chooses otherwise.

Backend `PumpRow` (Pydantic, all `extra="forbid"`):

| # | Field | Backend type | Header label | Editor | Notes |
|---|---|---|---|---|---|
| 1 | `device_type` | `str \| None`, `^opt_[A-Za-z0-9_-]+$` | Device Type | single-select pill | Namespaced option list `pumps.device_type`. Not required. |
| 2 | `use` | `str \| None`, max 200 | Use | inline text | Free-text describing what the pump serves (e.g. "DHW recirc"). Trimmed; empty → None. |
| 3 | `tag` | `str \| None`, max 80 | Tag | inline text | Schedule identifier (e.g. "P-1"). Trimmed; **unique-if-present** (see §5.1). |
| 4 | `manufacturer` | `str \| None`, max 200 | Manufacturer | inline text | |
| 5 | `model` | `str \| None`, max 200 | Model | inline text | |
| 6 | `volts` | `float \| None`, ≥ 0 | Volts | inline number | Typical: 120 / 208 / 240 / 277 / 480. |
| 7 | `phase` | `int \| None`, in {1, 3} | Phase | inline number | Motor phase; 1 or 3. Validated as `int` ∈ {1,3} if present. |
| 8 | `horse_power` | `float \| None`, ≥ 0 | Horse Power | inline number | Mechanical output rating. |
| 9 | `wattage` | `float \| None`, ≥ 0 | Wattage | inline number | Electrical input. Not auto-derived from HP — motor efficiency varies. |
| 10 | `flow_gpm` | `float \| None`, ≥ 0 | Flow - GPM | inline number | Design-point flow. |
| 11 | `runtime_khr_yr` | `float \| None`, ≥ 0 | Runtime - kHR/YEAR | inline number | Annual operating hours / 1000. Feeds energy rollup. |
| 12 | `notes` | `str \| None`, max 4000 | Notes | inline text | Defaults to wide column (~280px). |
| 13 | `link` | `str \| None`, max 2000 | Link | inline text + click-through | Manufacturer datasheet URL. Validated as a plausible URL (`https?://…`) on the backend; rendered as a clickable `<a target="_blank" rel="noopener">` in the cell. See §5.2 for the column `render`. |

Plus the row id:

| `id` | `str`, `^pmp_[A-Za-z0-9_-]+$`, max 80 | (not a column) | Stable id; scoped prefix. |

### Field-type notes

- **Device Type (single-select).** Namespace key
  `pumps.device_type` (per `option_list_namespace_prefix = "pumps"`
  on the contract). Seed options on first-run / fixture:
  *Circulator*, *Recirculation*, *Booster*, *Well*, *Sump*,
  *Condensate*, *Other*. Editors can add / rename / recolor via the
  same option-editor used on Rooms.
- **Short text vs long text.** The library's core `FieldDef.field_type`
  is `"text"` for all of them; `useFieldEditor` produces a
  single-line input by default. **Notes** wants multi-line input —
  see §5.2 OQ-2 for the recommended path (column-level `render` +
  `defaultWidth`; library-level multi-line core text-editor is a
  separate, larger change).
- **URL.** No dedicated `"url"` field-type in the core library today.
  Treat as plain text for storage + edit; add click-through via a
  column `render: (row) => row.link ? <a href={row.link} … /> : null`.
  Backend regex-validates `^https?://`. A future library-level
  `"url"` field-type would unify this — out of scope for P1.
- **Phase as number.** Stored as `int \| None`; validated to {1, 3}
  on the backend. Considered making this a single-select (only two
  realistic values) but user requested number — keep as number and
  rely on backend validation. The numeric editor already accepts
  integer typing; alternative is a custom-field-style single-select
  in P3.
- **Tag uniqueness.** Validated case-insensitively after trim:
  duplicate non-null tags rejected by `validate_document_references`
  (mirrors `Rooms.number`). Empty / null tag is allowed and not
  considered a duplicate of another empty tag.

### Frontend mirror

```ts
export type PumpRow = {
  id: string;
  device_type: string | null;     // opt_* id
  use: string | null;
  tag: string | null;
  manufacturer: string | null;
  model: string | null;
  volts: number | null;
  phase: number | null;            // 1 | 3 in practice
  horse_power: number | null;
  wattage: number | null;
  flow_gpm: number | null;
  runtime_khr_yr: number | null;
  notes: string | null;
  link: string | null;
};
```

No `custom` field until P3.

### Width budget

13 columns × ~140px avg = ~1820px. **Will not fit** on a 13" laptop
without horizontal scroll — that's fine, and it's an honest test of
the freeze-first-column + column-resize behavior (parent review C4
notes these are tested on Rooms but never exercised at this column
count).

## 5. Phase 1 — Clone the pattern

### 5.1 Backend additions

**`backend/features/project_document/document.py`**

- Add `PumpRow(BaseModel)` mirroring §4 above. Validators:
  - `strip_optional_strings` (use / tag / manufacturer / model /
    notes / link): trim, coerce empty → None — same pattern as
    `RoomRow.strip_optional_notes`.
  - `validate_phase` (`@field_validator("phase")`): if not None,
    must be in `{1, 3}`.
  - `validate_link` (`@field_validator("link")`): if not None, must
    match `^https?://`.
- Add option keys + namespace constants:
  ```python
  PUMP_DEVICE_TYPE_OPTION_KEY = "pumps.device_type"
  PUMP_OPTION_KEYS = (PUMP_DEVICE_TYPE_OPTION_KEY,)
  PUMPS_CORE_DISPLAY_NAMES: tuple[str, ...] = (
      "Device Type", "Use", "Tag", "Manufacturer", "Model",
      "Volts", "Phase", "Horse Power", "Wattage", "Flow - GPM",
      "Runtime - kHR/YEAR", "Notes", "Link",
  )
  ```
- Lift `pumps` out of `EmptyEquipmentTables`. The current shape is
  `pumps: list[dict[str, object]] = Field(default_factory=list)` —
  replace with `pumps: list[PumpRow] = Field(default_factory=list)`.
  Keep `fans` and `ervs` as untyped placeholders for now.
- Extend the `single_select_options` default factory to seed
  `PUMP_DEVICE_TYPE_OPTION_KEY: []`. Add `PUMP_OPTION_KEYS` to the
  `setdefault` loop inside `validate_document_references`.
- Add a `validate_document_references` block for Pumps mirroring
  the Rooms block:
  - reject duplicate `pump.id`;
  - reject duplicate normalized `pump.tag` (skip when `tag is None`);
  - reject a `pump.device_type` that is not in
    `single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]`;
  - reject duplicate normalized `pump.use` only if uniqueness is
    requested (it isn't — `use` is descriptive, not an identifier).

Pre-deploy project, no shim chain (CLAUDE.md §16) — but bump
`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` only if anything is
already persisted with a non-empty `equipment.pumps`. Since pumps
is empty in every current dev document (placeholder), **no schema
bump is needed**; the type change is backwards-compatible at the
JSON wire because `[]` validates as `list[PumpRow]`.

Verify before merging: `psql -c "SELECT count(*) FROM project_versions
WHERE body -> 'tables' -> 'equipment' -> 'pumps' != '[]';"` should
return 0 on dev. If non-zero, add a one-shot reshape script.

**`backend/features/project_document/tables/pumps.py`** (new file)

Sits **between** `window_types.py` (no custom fields, no option lists)
and `rooms.py` (custom fields + two option lists) in complexity. P1
Pumps has no custom fields but does have one core single-select, so
the file needs option-list scaffolding similar to Rooms's
`RoomsSliceOptions` but without the `cf_*` extras allowance.

```python
class PumpsSliceOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    pumps_device_type: list[SingleSelectOption] = Field(
        alias=PUMP_DEVICE_TYPE_OPTION_KEY,
    )

    def by_option_key(self) -> dict[str, list[SingleSelectOption]]:
        return {PUMP_DEVICE_TYPE_OPTION_KEY: self.pumps_device_type}

class PumpsSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pumps: list[PumpRow]
    single_select_options: PumpsSliceOptions

class PumpsSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    pumps: list[PumpRow]
    single_select_options: dict[str, list[SingleSelectOption]]

def apply_pumps_replace(body, payload):   # parallel to apply_rooms_replace,
                                          # minus the custom_fields branch
def pumps_response(...):                  # builds the response envelope
def extract_pumps_rows(body):             # list[dict] for downloads / diff
def extract_pumps_diff_value(body):       # {pumps, single_select_options}

pumps_contract = TableContract(
    name="pumps",
    schema_slug="pump",
    schema_model=PumpRow,
    replace_request_model=PumpsSliceReplaceRequest,
    build_response=pumps_response,
    apply_replace=apply_pumps_replace,
    extract_rows=extract_pumps_rows,
    extract_diff_value=extract_pumps_diff_value,
    table_path=("equipment", "pumps"),  # nested under equipment
    custom_fields=None,                  # opt into in P3
)
```

Note `table_path=("equipment", "pumps")` — Pumps lives under
`equipment` in the document tree, unlike Rooms which is at the
top level (`("rooms",)`). The generic routes already accept this —
they use `table_name` (URL segment) for the registry lookup and read
`table_path` from the contract for any document-tree access.
Confirm `service.replace_table_slice` and the
schema-mutation service walk the `table_path` tuple before merging
— the current code may assume length-1 (this is the **highest-risk
backend item** in P1; see §8 R1).

Seed `PUMP_DEVICE_TYPE_OPTION_KEY` with the seven canonical
options (Circulator / Recirculation / Booster / Well / Sump /
Condensate / Other) in a `_dev_seed.py` snippet — wired only when
running locally with the dev-seed flag the existing fixtures use.
Real projects start with `[]` and editors add their own options.

**`backend/features/project_document/tables/registry.py`**

Register `pumps_contract.name → pumps_contract`.

**`backend/features/project_document/tables/__init__.py`**

Add `PumpsSliceResponse` to the `RegisteredTableResponse` union.

**`backend/features/project_document/repository.py` / `service.py`**

Audit `replace_table_slice` and `apply_schema_mutation_to_draft` for
single-segment `table_path` assumptions. If they exist, generalize
to walk the tuple. This is the **highest-risk part of P1** — if the
service layer hard-codes `body.tables.rooms`, the "table_path is
generic" claim is aspirational rather than real, and the plan grows
by a day.

**Tests.**

- Add `tests/test_pumps_contract.py` covering: empty replace,
  duplicate id rejection, duplicate name rejection, draft round-trip
  through `apply_pumps_replace`, version etag headers.
- Extend `tests/test_routes_table.py` (if it exists; otherwise model
  after `test_routes_rooms.py`) covering GET/PUT/draft round-trip for
  Pumps using the generic routes.

### 5.2 Frontend additions

**`frontend/src/features/equipment/types.ts`**

```ts
export const PUMPS_TABLE_NAME = "pumps";

// Single-select uses namespaced key for storage; the column id is
// the short form (same convention as Rooms — see ROOM_FLOOR_LEVEL_*).
export const PUMP_DEVICE_TYPE_KEY = "pumps.device_type";
export const PUMP_DEVICE_TYPE_COLUMN_ID = "device_type";
export const PUMP_OPTION_KEYS = [PUMP_DEVICE_TYPE_KEY] as const;
export type PumpOptionKey = (typeof PUMP_OPTION_KEYS)[number];

export type PumpRow = { ...as in §4 };

export type PumpsOptionMap = Record<PumpOptionKey, SingleSelectOption[]>;

export type PumpsSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  pumps: PumpRow[];
  single_select_options: PumpsOptionMap;
};

export type PumpsReplacePayload = {
  pumps: PumpRow[];
  single_select_options: PumpsOptionMap;
};
```

No `custom_fields`, no `rows_computed` — that's what keeps Pumps
meaningfully simpler than Rooms despite the one single-select.

**`frontend/src/features/equipment/api.ts`**

```ts
export const pumpsSliceFeature = createTableSliceFeature<
  PumpsSlice,
  PumpsReplacePayload
>({
  tableName: PUMPS_TABLE_NAME,
  missingVersionMessage:
    "Cannot update Pumps without an active project version.",
});
```

Already-factored! `createTableSliceFeature` handles all four hooks
(`useSliceQuery`, `useReplaceSliceMutation`, `useSchemaMutationMutation`,
`fetchSlice`/`replaceSlice`). This validates one slice of the reuse
claim immediately — the data-fetching layer needs zero new code.

**`frontend/src/features/equipment/hooks.ts`**

Re-export hooks (mirroring `useRoomsSliceQuery` etc.). Add
`useReplacePumpsSliceMutation`. Skip the draft-broadcast channel for
P1 — the BroadcastChannel only matters when two tabs are editing the
same draft, and Pumps without modal-style edit conflicts can survive
P1 without it. Add in P2 or whenever a real multi-tab issue lands.

**`frontend/src/features/equipment/lib.ts`** (extend, don't duplicate)

Add payload builders mirroring the Rooms set:

- `pumpsTableFieldDefs(slice) → FieldDef[]` — the 13 core FieldDefs,
  with `pumps.device_type` carrying its `options` from
  `slice.single_select_options`.
- `pumpsTableColumnsForSanitize(fieldDefs) → DataTableColumnDef[]` —
  stubs for view-state sanitization (mirrors `roomsTableColumnsForSanitize`).
- `pumpsPayloadFromCellWrites(slice, writes, newOpts?, removedOpts?) → PumpsReplacePayload`
- `pumpsPayloadFromRowInsert(slice, rows, build) → PumpsReplacePayload`
- `pumpsPayloadFromRowDelete(slice, rows) → PumpsReplacePayload`
- `replacePumpOptionsPayload(slice, key, nextOptions, replacements) → PumpsReplacePayload`
  — option-list editor path (mirrors `replaceRoomOptionsPayload`, but
  only the one namespace key).
- `validatePumpsPayload(payload) → string | null` — duplicate-id +
  duplicate-tag checks.

No custom-field handling in P1.

**`frontend/src/features/equipment/components/PumpsTable.tsx`** (new)

Mirror `RoomsTable.tsx` structure. ColumnDefs (in display order;
column 1 is the frozen column per §10 OQ-1):

```ts
const columns: DataTableColumnDef<PumpRow>[] = [
  { id: PUMP_DEVICE_TYPE_COLUMN_ID, fieldKey: PUMP_DEVICE_TYPE_KEY,
    header: "Device Type", defaultWidth: 140,
    accessor: (p) => p.device_type,
    render: (p) => optionPill(p.device_type, fieldDefByKey.get(PUMP_DEVICE_TYPE_KEY)) },
  { id: "use", fieldKey: "use", header: "Use",
    accessor: (p) => p.use, defaultWidth: 180 },
  { id: "tag", fieldKey: "tag", header: "Tag",
    accessor: (p) => p.tag, defaultWidth: 100 },
  { id: "manufacturer", fieldKey: "manufacturer", header: "Manufacturer",
    accessor: (p) => p.manufacturer, defaultWidth: 160 },
  { id: "model", fieldKey: "model", header: "Model",
    accessor: (p) => p.model, defaultWidth: 140 },
  { id: "volts", fieldKey: "volts", header: "Volts",
    accessor: (p) => p.volts, defaultWidth: 80,
    className: "numeric-cell" },
  { id: "phase", fieldKey: "phase", header: "Phase",
    accessor: (p) => p.phase, defaultWidth: 70,
    className: "numeric-cell" },
  { id: "horse_power", fieldKey: "horse_power", header: "Horse Power",
    accessor: (p) => p.horse_power, defaultWidth: 100,
    className: "numeric-cell" },
  { id: "wattage", fieldKey: "wattage", header: "Wattage",
    accessor: (p) => p.wattage, defaultWidth: 100,
    className: "numeric-cell" },
  { id: "flow_gpm", fieldKey: "flow_gpm", header: "Flow - GPM",
    accessor: (p) => p.flow_gpm, defaultWidth: 100,
    className: "numeric-cell" },
  { id: "runtime_khr_yr", fieldKey: "runtime_khr_yr",
    header: "Runtime - kHR/YEAR",
    accessor: (p) => p.runtime_khr_yr, defaultWidth: 140,
    className: "numeric-cell" },
  { id: "notes", fieldKey: "notes", header: "Notes",
    accessor: (p) => p.notes, defaultWidth: 280 },
  { id: "link", fieldKey: "link", header: "Link",
    accessor: (p) => p.link, defaultWidth: 180,
    render: (p) =>
      p.link ? (
        <a href={p.link} target="_blank" rel="noopener noreferrer"
           className="data-table-link-cell">{shortenUrl(p.link)}</a>
      ) : null,
    // The accessor still returns the raw URL — sort / filter / copy
    // operate on the string, not the rendered anchor.
    measureText: (p) => p.link ?? "" },
];
```

`optionPill` is the same helper Rooms uses (move it from
`RoomsTable.tsx` to a shared `equipment/lib.ts` export, or — better —
to `shared/ui/data-table/components/SingleSelectPill.tsx` so future
tables don't keep redefining it).

FieldDefs (from `pumpsTableFieldDefs`):

```ts
[
  { field_key: PUMP_DEVICE_TYPE_KEY, field_type: "single_select",
    display_name: "Device Type", options: slice.single_select_options[PUMP_DEVICE_TYPE_KEY] },
  { field_key: "use", field_type: "text", display_name: "Use" },
  { field_key: "tag", field_type: "text", display_name: "Tag" },
  { field_key: "manufacturer", field_type: "text", display_name: "Manufacturer" },
  { field_key: "model", field_type: "text", display_name: "Model" },
  { field_key: "volts", field_type: "number", display_name: "Volts" },
  { field_key: "phase", field_type: "number", display_name: "Phase" },
  { field_key: "horse_power", field_type: "number", display_name: "Horse Power" },
  { field_key: "wattage", field_type: "number", display_name: "Wattage" },
  { field_key: "flow_gpm", field_type: "number", display_name: "Flow - GPM" },
  { field_key: "runtime_khr_yr", field_type: "number",
    display_name: "Runtime - kHR/YEAR" },
  { field_key: "notes", field_type: "text", display_name: "Notes" },
  { field_key: "link", field_type: "text", display_name: "Link" },
]
```

No formula registry, no `onAddCustomField` etc. Pass through
`<DataTable>` with ~10 props (rows, columnDefs, fieldDefs,
getRowId, view, onViewChange, onWrite, buildEmptyRow,
generateRowId, sessionKey, emptyMessage, readOnly,
overflowMenuActions, footerAction). The 14 custom-field /
formula props that Rooms uses are absent.

**`frontend/src/features/equipment/routes/EquipmentTab.tsx`**

Wire a second subtab. The Pumps button is already in the JSX as
`disabled`; flip it to active when the active subtab is `"pumps"`.

Add state for which subtab is active. Render `<RoomsTable>` or
`<PumpsTable>` based on the choice. Each table calls its own
`useTableSchema` (Pumps just has core fields), its own
`useProjectTableViewState({ tableKey: PUMPS_TABLE_NAME })`, its own
`handlePumpsTableWrite` (a copy of `handleTableWrite` minus the
single-select / custom-field / formula branches).

This is the **deliberate duplication** that will motivate P2.

**Tests.**

- Component test: render `<PumpsTable>` with seed rows, edit a cell,
  assert the `onWrite` callback fires with the expected `WriteOp`.
- Integration test: mount `<EquipmentTab>` with the Pumps subtab
  active, run the full edit → save → refetch → reconcile loop using
  `msw`. Mirror the simpler bits of `RoomsTable.customField.test.tsx`.
- E2E (`make e2e`, Playwright): one happy-path test under
  `frontend/tests/e2e/pumps-edit.spec.ts` covering add row →
  edit cell → reload → row persisted.

### 5.3 What "P1 done" looks like

- A signed-in editor can switch to the Pumps subtab, add a pump,
  edit any cell, copy/paste a range, sort by Power, group by
  Manufacturer, hide a column, save, reload, and see persisted state.
- All of that uses the **unchanged** `<DataTable>` from
  `shared/ui/data-table/`. Any change to that directory during P1 is
  a smell — flag it for review.
- The new file count is ~6 (1 backend contract, 1 backend test,
  1 FE types extension, 1 FE PumpsTable, 1 FE component test,
  1 E2E spec) plus extensions to ~4 existing files (document.py,
  tables registry, equipment lib.ts / api.ts / hooks.ts / EquipmentTab).
- The total LOC delta should be **under ~800** if no backend
  generalization is needed in service.py / repository.py. Over that
  and we are missing an extraction opportunity.

## 6. Phase 2 — Extract the orchestrator helper

With Rooms and Pumps both on the same shape, the duplication is real
and visible. Extract two helpers:

### 6.1 `useProjectDocumentTableMutations<TRow, TSlice, TReplaceBody>`

Lives at `frontend/src/features/project_document/use-table-mutations.ts`.
Inputs:

```ts
{
  tableKey: string;
  sliceQuery: UseQueryResult<TSlice>;
  replaceMutation: ReturnType<typeof useReplaceSliceMutation>;
  schemaMutation?: ReturnType<typeof useSchemaMutationMutation>;
  payloadBuilders: {
    fromCellWrites: (slice, writes, newOpts?, removedOpts?) => TReplaceBody;
    fromRowInsert: (slice, rows, build) => TReplaceBody;
    fromRowDelete: (slice, rows) => TReplaceBody;
    replaceOptions?: (...) => TReplaceBody;
  };
  validate: (payload: TReplaceBody) => string | null;
  conflictMessages: { active: string; delete: string; fallback: string };
}
```

Outputs:

```ts
{
  handleTableWrite: (op: WriteOp) => Promise<void>;
  commitSchemaMutation?: (mutation: FieldSchemaMutation) => Promise<void>;
  actionError: string | null;
  editBlocker: EditBlocker | null;
  setEditBlocker, reloadDraft, ...
}
```

This collapses the per-table `handleTableWrite` switch (currently
~70 lines in `EquipmentTab`) into a single shared function. Per-table
specifics live in the small `payloadBuilders` map.

The bits **not** to absorb into this hook (consciously):

- The slice-specific row factory (`buildEmptyRoomRow` /
  `buildEmptyPumpRow`) — too tied to the row type to generalize
  usefully; keep per-table.
- The schema-mutation builders (`buildAddFieldMutation` etc.) — already
  exported from the library, no extra wrapping needed.

### 6.2 `useTableDraftBroadcast<TSlice>`

Generic version of `useRoomsDraftBroadcast`. The whole file is
~95 lines; ~80 are mechanical. Generic shape:

```ts
useTableDraftBroadcast<TSlice extends BaseTableSlice>({
  channelName,    // e.g. "phn-pumps-draft-v1"
  projectId,
  versionId,
  enabled,
  onRemoteSlice,
  queryKey,       // from the slice feature
});
```

Pumps in P2 picks this up "for free"; Rooms migrates onto it without
behavioral change.

### 6.3 Optional: `<ProjectDocumentTable>` thin wrapper

If `RoomsTable` and `PumpsTable` collapse to the same 50-line
"build columns, forward props" shape, fold them into a single
`<ProjectDocumentTable<TRow>>` component parametrized on `columns`
and `tableSchema`. Defer this until both wrappers exist in P1 — the
shape becomes obvious once duplicated.

### 6.4 What "P2 done" looks like

- `EquipmentTab.tsx` shrinks from ~780 LOC to ~400. Most of the
  removed code lives in `useProjectDocumentTableMutations`.
- The Rooms behavior is bit-for-bit identical — covered by the
  existing test suite.
- Adding the *next* project-document table (window_types, ERVs,
  Fans, Thermal Bridges) requires writing one backend contract,
  one FE types extension, one column list, and one
  `payloadBuilders` map. Everything else is reused.

## 7. Phase 3 (forward-looking) — Custom fields on Pumps

Not in scope; written here so future-us doesn't re-derive it.

When the certification team asks for user-defined columns on Pumps
(e.g. "Refrigerant", "Sound Rating dB(A)", a formula "Total power" =
`{Power (W)} * {Qty}`), the work is the Rooms playbook applied to
Pumps:

1. **Backend.** Convert `tables.equipment.pumps` from `list[PumpRow]`
   to `PumpsTableEnvelope(custom_fields, rows)`. Bump
   `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` (real reshape this
   time — existing draft documents have rows). Add `custom` dict to
   `PumpRow`. Register `pumps_custom_fields` `CustomFieldCapability`
   on the contract. Add option-list namespace `pumps.<cf_id>` —
   though without core single-selects, the
   `core_option_key_by_field_id` map is `{}` and most of the
   `rooms.py` boilerplate around required-core-selects collapses.
2. **Frontend.** Extend `PumpsSlice` with `custom_fields`,
   `single_select_options`, `rows_computed`. Wire `useTableSchema`
   in PumpsTab (already in place — the helper handles no-options
   tables cleanly). Wire the custom-field handlers on the WriteOp
   dispatch (the `useProjectDocumentTableMutations` hook from P2
   should accept these as optional `payloadBuilders`).

If P2 was done correctly, P3 backend work is ~300 LOC (mostly
mechanical) and P3 frontend work is ~50 LOC. If it's more than that,
the P2 abstraction missed.

## 8. Risks and unknowns

- **R1 — `table_path` may not be generic on the backend.** The
  contract claims it is (Pumps would live under
  `equipment.pumps` not at the table root) but the service layer
  may have shortcut assumptions. First task of P1: read
  `service.replace_table_slice` and `apply_schema_mutation_to_draft`
  and confirm both walk an arbitrary `table_path` tuple. If they
  don't, generalize before adding Pumps.
- **R2 — `EmptyEquipmentTables` is a placeholder struct that may
  be referenced elsewhere.** Confirm with `grep -r
  "EmptyEquipmentTables" backend/` that lifting `pumps` out
  doesn't break a fixture loader or migration. Likely safe (the
  struct is only used for typing the empty defaults).
- **R3 — P2 extraction premature with only 2 consumers.** Real risk.
  Mitigation: do not extract speculatively in P1; only extract in P2
  what is already duplicated. If the duplication is small enough that
  the abstraction reads worse than the duplication, ship Pumps without
  P2 and revisit at consumer #3.
- **R4 — `<DataTable>` may need to change after all.** If P1 turns
  up a behavior bug or missing prop that blocks Pumps, that is a
  finding worth more than the Pumps feature — fix it in `shared/ui/
  data-table/`, write a regression test, and call it out in P1's PR
  description. (Parent-review C4: this is also the moment to
  reconsider `DataTable.tsx`'s size.)
- **R5 — Subtab visual.** EquipmentTab already shows disabled
  "Pumps / Fans / ERVs / Thermal Bridges" buttons. Enabling Pumps
  alone leaves the others disabled — fine, but the visual
  inconsistency should be acceptable as a known-temporary state.

## 9. Acceptance criteria

P1 ships when:

- [ ] An editor can switch to a Pumps subtab and complete the full
      edit loop (add / edit / copy / paste / fill / row-delete / sort
      / filter / group / hide / view-state persistence).
- [ ] No file under `frontend/src/shared/ui/data-table/` is modified
      (or, if one is, the change has a regression test and an
      explicit note).
- [ ] Backend `tables.equipment.pumps` is typed and validated.
- [ ] Two new test suites pass: backend pumps contract round-trip,
      frontend PumpsTable component + integration.
- [ ] One Playwright E2E covers the golden path.

P2 ships when:

- [ ] `useProjectDocumentTableMutations` exists, is used by both
      Rooms and Pumps, and the per-tab orchestrator code is reduced
      to ≤80 LOC each.
- [ ] All existing Rooms tests continue to pass with no
      behavioral changes.
- [ ] Adding a third consumer in a follow-up PR (window_types is
      the natural next pick — already has a backend contract) is
      a < 1-day effort. This is the dry-run for ERVs / Fans /
      Thermal Bridges.

## 10. Resolved decisions and remaining open questions

### Resolved (2026-05-25 review pass)

- **Subtab order.** Leave the existing `Rooms / Thermal Bridges /
  ERVs / Pumps / Fans` order in `EquipmentTab`. No reordering.
- **Pump fields.** Locked to the 13 app-defined columns in §4
  (Device Type, Use, Tag, Manufacturer, Model, Volts, Phase, Horse
  Power, Wattage, Flow - GPM, Runtime - kHR/YEAR, Notes, Link).
- **P1 / P2 PR shape.** Ship separately. P1 lands first as a
  feature PR; P2 follows as a refactor PR once Rooms + Pumps are
  both green on `main`.

### Remaining open questions

- **OQ-1: Frozen column choice.** §4 column order puts `device_type`
  first, which would make it the sticky frozen column. The visual
  identifier on a Pumps schedule is usually `Tag` (P-1, P-2, …), not
  the device kind. Three options:
  - (a) Render in §4 order; `device_type` is frozen. Matches user's
    field order verbatim.
  - (b) Move `tag` to column 1 in the *display* order (the FieldDef
    list stays as listed). `tag` is frozen.
  - (c) Both columns rendered first, with `tag` frozen and
    `device_type` immediately after. Hybrid.
  **Recommendation: (b).** Tag is the row's natural identifier; the
  frozen column should be what users glance at to navigate. The
  `FieldDef` order in §4 is reference material — `columnOrder` in
  the ViewState defaults is what the user sees.
- **OQ-2: Notes multi-line editor.** Notes are spec'd as long-text
  but the library's core text editor is single-line. Three options:
  - (a) Ship P1 with single-line inline edit + click-to-expand-in-
    modal (build a small `<NotesCellEditor>` consumer-side).
  - (b) Add a `text_multiline` field-type to the core library now.
    Larger surface; touches `fields/registry.ts`, the inline editor,
    the filter operators registry. Belongs in its own plan.
  - (c) Ship P1 with single-line edit only; revisit when a user
    complains.
  **Recommendation: (c).** Single-line text editing of Notes works
  acceptably for typical 1–2 sentence cell content; multi-line is
  a separate plan that benefits every table, not just Pumps.
- **OQ-3: Required fields.** §4 marks every field as optional. Two
  candidates for promotion to required:
  - `device_type` — would force editors to pick a kind before save.
    Argument against: blank rows during data-entry workflow.
  - `tag` — would force a schedule identifier on save.
    Argument against: same as above.
  **Recommendation: leave all optional in P1**, validate uniqueness
  only (tag, id). Promote to required in P3 if certification needs
  push that way.
