---
DATE: 2026-05-24
TIME: planning (detailed implementation phasing)
STATUS: Draft. Phase 1 of plan-13 (custom fields). Concrete Pydantic /
        fixture / JSON Schema / MCP-read / table-registry / view-state-
        fingerprint changes needed to land the `{custom_fields, rows}`
        envelope on Rooms and the `useTableSchema` frontend seam. No
        schema-editor UI in this phase — custom fields are seeded only
        through a developer-only fixture path and render through the
        existing `text` / `number` cell renderers. Six sub-phases; each
        is a single PR that leaves `make typecheck`, `make test`,
        `make lint` green.
PARENT-PLAN: planning/archive/dated/2026-05-24/plan-13-custom-fields-overview.md
PARENT-STORY: context/user-stories/32-custom-fields.md
              (US-CF-10 read-side criteria 1, 2, 4; remaining stories
              are Phase 2+)
RELATED:
  - context/technical-requirements/data-model.md §6.6 (contract gates)
  - context/technical-requirements/data-table.md
    (FieldSchemaMutation, identity rule, fingerprint, indicator)
  - context/technical-requirements/llm-mcp-schema.md §10.6
  - context/technical-requirements/save-versioning.md §8.3
    (immediate draft validation)
  - backend/features/project_document/document.py
    (ProjectDocumentV1 / RoomRow / ProjectDocumentTables)
  - backend/features/project_document/tables/{contracts,registry,rooms,window_types}.py
  - backend/features/project_document/{validation,diff,downloads}.py
  - backend/features/schemas/routes.py
  - backend/features/mcp/server.py
    (get_table / get_document — no code change in P1; new envelope
    rides through unchanged)
  - frontend/src/features/equipment/components/RoomsTable.tsx
  - frontend/src/features/equipment/lib.ts (roomsTableFieldDefs)
  - frontend/src/features/table_views/useProjectTableViewState.ts
  - frontend/src/shared/ui/data-table/lib.ts
    (sanitizeViewStateForSchema)
BACKWARDS-COMPAT: none required (pre-deployment, CLAUDE.md §16,
                  plan-13 §4.1). `schema_version` bumps 1 → 2; the
                  reshape of `tables.rooms` from `list[RoomRow]` to
                  `RoomsTableEnvelope` is a one-shot change with no
                  shim chain. Existing fixtures, tests, and seeders
                  are updated in lockstep.
---

# Plan 14 — Phase 1: document shape + Pydantic + read path (Rooms)

## Goal

Land everything needed for **Rooms to host a developer-seeded custom
`short_text` field end-to-end** — Pydantic envelope, JSON Schema,
MCP / download read alignment, table-contract abstraction, frontend
`useTableSchema` seam, and schema-fingerprinted view state — without
shipping any schema-editor UI. Editor UI, MCP write tools, formula
fields, and fan-out to other tables are Phase 2 / 3 / 4 / 5.

The exit criteria from plan-13 §5 phase 1 — a seeded `short_text`
field appears in the Rooms grid, accepts cell writes, survives Save /
Save As / Lock / version-switch, and does not corrupt persisted view
state across versions with different custom schemas — drive the
acceptance tests below.

## Phase summary

| Phase | Title | Visible change | Risk |
|-------|-------|----------------|------|
| 1.0 | Story + schema-bump note + scaffold | None | Trivial |
| 1.1 | Pydantic reshape + `schema_version` 1→2 | None (shape only; no Rooms columns added) | High — touches every fixture and every test that constructs a project document |
| 1.2 | TableContract extension + Rooms opt-in | None | Medium — registry abstraction grows |
| 1.3 | Download / JSON Schema / MCP read alignment | New keys appear in document/JSON-Schema responses | Low |
| 1.4 | Frontend `useTableSchema` seam + typed `custom` accessor | None (Rooms renders same columns) | Medium — refactor of RoomsTable wiring |
| 1.5 | Schema-fingerprinted persisted view state | None visible; fingerprint round-trips | Medium — touches `useProjectTableViewState` and the saved JSONB envelope |
| 1.6 | Developer seed path + exit-criteria acceptance tests | A seeded custom column appears in Rooms in tests / dev | Low |

Each phase is a PR. Halting between phases leaves Rooms working: the
envelope reshape (1.1) is the only structurally invasive change, and
1.2–1.6 only add capability on top.

---

## Phase 1.0 — Story + schema-bump note + scaffold

**Goal.** Zero-behavior preamble. Promote the read-side acceptance
criteria, document the deliberate non-shimmed schema bump, and create
empty files so subsequent PRs only touch behavior.

### Tasks

1. **Promote US-CF-10 read criteria** in
   `context/user-stories/32-custom-fields.md` from Draft to
   "Phase 1 (read)" for criteria 1, 2, 4 (document advertises
   `custom_fields`, row `custom` keyed by `cf_*` ids, JSON Schema
   declares `CustomFieldDef` closed and `row.custom` open).
   Other criteria stay Draft.
2. **Record the schema bump.** Append a one-line note to
   `planning/archive/dated/2026-05-14/REMOVED.md` (or a new `docs/SCHEMA_VERSIONS.md` if that
   file doesn't exist yet) recording: "schema_version 1 → 2 on
   plan-14 P1.1 — adds `{custom_fields, rows}` envelope to
   custom-field-capable project-document tables (Rooms in P1.1;
   ERVs/Pumps/Fans/Thermal Bridges in plan-13 phase 5). Pre-deploy,
   no shim chain (CLAUDE.md §16)."
3. **Backend scaffold** (each file gets a one-line placeholder so
   typecheck stays green):
   - `backend/features/project_document/custom_fields.py` — will hold
     `CustomFieldDef`, `FieldType` enum extension, fingerprint
     helper.
   - `backend/features/project_document/tables/_fingerprint.py` —
     stable fingerprint over core + custom field ids and types.
4. **Frontend scaffold:**
   - `frontend/src/shared/ui/data-table/hooks/useTableSchema.ts` —
     hook to be implemented in P1.4.
   - `frontend/src/shared/ui/data-table/lib/customFieldAccessor.ts`
     — `getCustomValue(row, fieldDef)` helper to be implemented
     in P1.4.

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- Diff is doc + empty files only.

---

## Phase 1.1 — Pydantic reshape + `schema_version` 1 → 2

**Goal.** Reshape `ProjectDocumentTables.rooms` from `list[RoomRow]`
to a `RoomsTableEnvelope` (`{ custom_fields, rows }`); add a sparse
`custom` dict to `RoomRow`; bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION`
to `2`. No Rooms columns change. No custom fields are seeded. Every
existing fixture, test, and seed path is updated in lockstep.

This is the riskiest phase because the shape change ripples into every
test that constructs a project body. Doing it as its own PR keeps the
diff bounded and the bisection target obvious if anything regresses.

### Backend changes

**`backend/features/project_document/custom_fields.py`** — new closed
discriminated union plus envelope helper:

```python
class CustomFieldType(StrEnum):
    short_text   = "short_text"
    long_text    = "long_text"
    number       = "number"
    url          = "url"
    single_select = "single_select"
    formula      = "formula"

class CustomFieldDef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^cf_[A-Za-z0-9_-]+$", max_length=80)
    field_key: str | None = Field(default=None, max_length=80)   # advisory only
    display_name: str = Field(min_length=1, max_length=120)
    field_type: CustomFieldType
    config: dict[str, object] = Field(default_factory=dict)
    description: str | None = Field(default=None, max_length=280)
    created_at: datetime
    created_by: str | None                                       # fixtures may pass null (D11)
```

Phase 1 only exercises `short_text` end-to-end, but the enum closes
the v1 set up front so JSON Schema is authoritative from day 1.
`config` validation per `field_type` lands in Phase 2/3/4.

**`backend/features/project_document/document.py`:**

1. Bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 2` and
   `schema_version: Literal[2]`.
2. Add to `RoomRow`:
   ```python
   custom: dict[str, JsonScalar] = Field(default_factory=dict)
   ```
   where `JsonScalar = str | int | float | bool | None`. Tests in
   later phases cover richer values; Phase 1 only writes/reads `str`.
3. Introduce `RoomsTableEnvelope`:
   ```python
   class RoomsTableEnvelope(BaseModel):
       model_config = ConfigDict(extra="forbid")
       custom_fields: list[CustomFieldDef] = Field(default_factory=list)
       rows: list[RoomRow] = Field(default_factory=list)
   ```
4. Change `ProjectDocumentTables.rooms: list[RoomRow]` →
   `rooms: RoomsTableEnvelope = Field(default_factory=RoomsTableEnvelope)`.
   Leave other tables untouched in Phase 1.
5. Extend `validate_document_references` (the existing
   `model_validator(mode="after")`) with:
   - duplicate `cf_*` id check inside `tables.rooms.custom_fields`;
   - case-insensitive trimmed display-name uniqueness across
     **core + custom** field names for the Rooms table (D5; the
     core key list comes from the registered table contract in
     P1.2 — for P1.1 hard-code the Rooms core names);
   - for every `room.custom` dict: each key must appear in
     `custom_fields`; each value must coerce to the declared
     `field_type` (Phase 1 needs `short_text` only — `str | None`
     with `≤ 4000` chars).

**`backend/features/project_document/tables/rooms.py`:**

- `RoomsSliceReplaceRequest` carries `custom_fields: list[CustomFieldDef]`
  (allowed to be empty in Phase 1). Replace requests that mutate
  `custom_fields` are accepted at the bytes level but the schema-
  mutation typed surface (`FieldSchemaMutation`) lands in Phase 2;
  Phase 1 just allows the existing "replace whole table" route to
  carry the envelope verbatim.
- `RoomsSliceResponse` adds `custom_fields: list[CustomFieldDef]`.
- `apply_rooms_replace` reads `payload.custom_fields` and
  `payload.rooms`, replaces both inside the envelope, and re-runs
  whole-document validation.
- `extract_room_rows` now returns `{ "custom_fields": [...], "rows":
  [...] }` shape (for downloads / diff / MCP). Update the function
  signature/name if cleaner — e.g. `extract_rooms_envelope`.
- `extract_rooms_diff_value` includes the `custom_fields` array so
  diffs detect schema changes alongside row changes.

**Fixtures and tests** — find every constructor of `ProjectDocumentV1`
or `tables.rooms`:

- `backend/features/projects/service.py::empty_project_document`
- `backend/tests/test_project_document.py::room_payload` and any
  inline rooms shapes (see lines 85–113 and references after)
- `backend/tests/test_project_document_refresh.py`
- `backend/tests/test_mcp.py`
- `backend/tests/test_table_views.py`
- `backend/tests/test_schemas.py` (asserts the JSON Schema shape)

For each, update `tables.rooms` from `[...]` to
`{"custom_fields": [], "rows": [...]}` and add `"custom": {}` to
every row literal.

### New tests

- `test_rooms_envelope_empty_round_trips` — empty Rooms returns
  `{ custom_fields: [], rows: [] }` on read and accepts the same
  on replace.
- `test_rooms_envelope_rejects_unknown_custom_key` — a row with
  `custom: { "cf_unknown": "x" }` and `custom_fields: []` is
  rejected with `invalid_project_document`.
- `test_rooms_custom_field_duplicate_display_name` — two custom
  fields with display names `"Notes"` and ` "notes "` are rejected.
- `test_rooms_custom_field_collides_with_core_display_name` — a
  custom field named `"Name"` is rejected because core `name`
  already exists.

### Acceptance

- All existing tests pass after the lockstep fixture update.
- `make typecheck`, `make test`, `make lint`, `make smoke` green.
- No frontend changes in this phase — the existing Rooms slice API
  response now carries `custom_fields: []` and `rows: [...]`; the
  frontend currently reads `body.rooms` and will break until P1.4.
  **Open the P1.1 PR together with a minimal RoomsTable shim** that
  reads `roomsSlice.rooms ?? roomsSlice` so the frontend smoke test
  still passes. P1.4 removes the shim. (This is the only forward-
  compat seam in the plan and it lives for one PR.)

### Rollback

Revert the PR. No data migration is needed — pre-deploy, no saved
documents in the wild.

---

## Phase 1.2 — TableContract extension + Rooms opt-in

**Goal.** Land the registered-table-contract extension from
data-model.md §6.6.7. Only Rooms opts in; other tables (window_types)
opt out via explicit `None` for the custom-field accessors. The
abstraction must be real enough that ERVs/Pumps/Fans/Thermal Bridges
plug in later by registering their contract, not by editing routes
or services.

### Backend changes

**`backend/features/project_document/tables/contracts.py`** — extend
`TableContract`:

```python
@dataclass(frozen=True)
class TableContract:
    name: str
    table_path: tuple[str, ...]           # e.g. ("rooms",) or ("equipment", "ervs")
    schema_slug: str
    schema_model: type[BaseModel]
    replace_request_model: type[BaseModel]
    build_response: Callable[..., BaseModel]
    apply_replace: Callable[[ProjectDocumentV1, BaseModel], ProjectDocumentV1]
    extract_rows: Callable[[ProjectDocumentV1], list[object]]
    extract_diff_value: Callable[[ProjectDocumentV1], object]

    # Custom-field capability — None on tables that don't opt in.
    custom_fields: CustomFieldCapability | None = None
```

```python
@dataclass(frozen=True)
class CustomFieldCapability:
    core_field_keys: tuple[str, ...]
    option_list_namespace_prefix: str           # e.g. "rooms"
    read_custom_fields: Callable[[ProjectDocumentV1], list[CustomFieldDef]]
    replace_custom_fields: Callable[[ProjectDocumentV1, list[CustomFieldDef]], ProjectDocumentV1]
    read_row_custom: Callable[[object], dict[str, JsonScalar]]
    set_row_custom: Callable[[object, dict[str, JsonScalar]], object]
    compute_schema_fingerprint: Callable[[ProjectDocumentV1], str]
    # Phase 2: apply_schema_mutation, validate_schema_mutation
```

The two schema-mutation hooks (`apply_schema_mutation`,
`validate_schema_mutation`) are deliberately omitted in Phase 1 —
they land in Phase 2 alongside the MCP schema tools.

**`backend/features/project_document/tables/_fingerprint.py`** — pure
function that returns a stable hex digest over:

- `core_field_keys` in declared order;
- `(cf_id, field_type)` pairs from `custom_fields` in stored order;
- a constant version tag (so we can re-shape the fingerprint algorithm
  later without colliding with old persisted fingerprints).

```python
def compute_table_schema_fingerprint(
    core_field_keys: Iterable[str],
    custom_fields: Iterable[CustomFieldDef],
) -> str: ...
```

Unit tests: stable across reordering of `custom_fields` only when
order matches; changes when a field is renamed-by-id (it won't —
rename only mutates `display_name`) but does change when a field's
`field_type` changes or when a field is added / removed.

**`backend/features/project_document/tables/rooms.py`:**

- Build a `rooms_custom_fields = CustomFieldCapability(...)` with the
  Rooms core field keys (`id`, `number`, `name`, `floor_level`,
  `building_zone`, `num_people`, `num_bedrooms`, `icfa_factor`,
  `erv_unit_ids`, `catalog_origin`, `notes`).
- Set `rooms_contract.custom_fields = rooms_custom_fields` and
  `rooms_contract.table_path = ("rooms",)`.

**`backend/features/project_document/tables/window_types.py`:**

- Set `table_path = ("window_types",)` and leave `custom_fields = None`.

### New tests

- `test_rooms_contract_exposes_custom_field_capability` — registry
  lookup returns a contract with non-None `custom_fields` for Rooms
  and `None` for window_types.
- `test_rooms_fingerprint_changes_when_custom_field_added` —
  fingerprint of an empty Rooms envelope differs from one with one
  custom field.
- `test_fingerprint_independent_of_display_name_changes` — renaming
  a custom field does not change the fingerprint (because ids and
  types didn't change).

### Acceptance

- All previous tests still pass.
- New tests pass.
- `make typecheck`, `make test`, `make lint` green.

---

## Phase 1.3 — Download / JSON Schema / MCP read alignment

**Goal.** Verify the read path exposes the new envelope through every
public surface, and pin the JSON Schema posture (closed
`CustomFieldDef`, open `row.custom`) per llm-mcp-schema.md §10.6. No
formula `computed` overlay yet — formulas land in Phase 4 — but the
overlay shape must be documented so consumers know to expect it.

### Backend changes

**`backend/features/project_document/downloads.py`** — confirm
`download_project_json` and `download_table_json` for Rooms return
the new envelope verbatim. Add an assertion-style check that
`custom_fields` is always an array (never absent) and that
`computed` is **not** present on any row in Phase 1 (formulas defer
to Phase 4).

**`backend/features/schemas/routes.py`** — add a dedicated endpoint
for the Rooms table envelope, since `room/v1.json` currently returns
the bare `RoomRow` schema and consumers also need the envelope:

```python
@router.get("/rooms-table/v1.json")
def rooms_table_v1_schema() -> dict[str, Any]:
    return model_schema(RoomsTableEnvelope)
```

Keep the existing `/room/v1.json` for the bare row shape.

**`backend/features/mcp/server.py`** — no code change required.
`get_table("rooms")` calls `contract.extract_rows(body)`, which after
P1.1 returns the envelope shape; that propagates through
`McpTableEnvelope.rows` unchanged. Update the docstring on `get_table`
to note that rows for custom-field-capable tables are wrapped in
`{ custom_fields, rows }`. Optionally rename the MCP response field
`rows` → `table` for custom-field-capable tables (defer if invasive;
acceptable to ship the wrapped shape under the existing `rows` key
with a docstring callout).

### New tests

- `test_schemas_rooms_table_v1_endpoint` — fetches
  `/api/v1/schemas/rooms-table/v1.json`, asserts:
  - `$defs.CustomFieldDef.additionalProperties === false`
    (closed shape);
  - `properties.rows.items.properties.custom.additionalProperties
    === true` (open user-keyed dict).
- `test_download_rooms_includes_empty_custom_fields` — JSON
  download for a Rooms-only project has
  `tables.rooms.custom_fields === []`.
- `test_download_rooms_omits_computed_overlay_in_phase_1` —
  no `computed` key on any row. Pin the contract so Phase 4 can
  introduce the overlay deliberately.
- `test_mcp_get_table_returns_rooms_envelope` — `get_table("rooms")`
  returns `rows = { custom_fields: [], rows: [] }` shape (or the
  renamed equivalent if the field-name decision above swings the
  other way).

### Acceptance

- All tests pass.
- Manual: hit `/api/v1/schemas/rooms-table/v1.json` and confirm the
  closed/open shape with `jq`.

---

## Phase 1.4 — Frontend `useTableSchema` seam + typed `custom` accessor

**Goal.** Refactor RoomsTable to consume `useTableSchema("rooms")`
instead of inlining `roomsTableFieldDefs(roomsSlice)`. Establish the
**custom-value accessor pattern** so component code never touches
`row.custom[id]` directly (R1 mitigation from plan-13). No visible
change to the Rooms grid in this PR.

### Frontend changes

**`frontend/src/shared/ui/data-table/hooks/useTableSchema.ts`:**

```ts
export type CustomFieldDef = { /* mirror of backend CustomFieldDef */ };

export type TableSchema = {
  fieldDefs: FieldDef[];               // core first, then custom in stored order
  coreFieldKeys: Set<string>;
  customFields: CustomFieldDef[];
  schemaFingerprint: string;           // matches backend fingerprint
};

export function useTableSchema(args: {
  tableKey: TableKey;
  coreFieldDefs: FieldDef[];           // table-specific, provided by caller
  customFields: CustomFieldDef[];      // from the table envelope read
}): TableSchema;
```

Rules:

- For custom fields, `FieldDef.field_key` is the `cf_*` id (D12).
- The hook synthesizes a `FieldDef` per `CustomFieldDef` using the
  same `text` / `number` / etc. renderers core fields use.
- `read_only_schema: true` is set on every core field; absent on
  custom (header-context-menu wiring lives in Phase 2 but the flag
  ships now so the schema is consistent).

**`frontend/src/shared/ui/data-table/lib/customFieldAccessor.ts`:**

```ts
export function getCustomValue(
  row: { custom?: Record<string, unknown> },
  fieldDef: FieldDef,
): unknown | undefined {
  if (!isCustomFieldKey(fieldDef.field_key)) return undefined;
  return row.custom?.[fieldDef.field_key];
}
```

Add an ESLint rule (or a `// eslint-disable` audit) banning direct
`row.custom[id]` access in render code. If the lint rule is too much
infra for one phase, ship the accessor and add a TODO comment in
RoomsTable.

**`frontend/src/features/equipment/components/RoomsTable.tsx`:**

- Replace `const fieldDefs = useMemo(...)` with
  `const { fieldDefs, customFields, schemaFingerprint } =
   useTableSchema({ tableKey: "rooms", coreFieldDefs:
   roomsCoreFieldDefs(roomsSlice), customFields:
   roomsSlice.custom_fields });`
- Drop the P1.1 shim that reads `roomsSlice.rooms ?? roomsSlice`.
- Pass `schemaFingerprint` through to `useProjectTableViewState`
  in P1.5.
- For each custom `FieldDef`, the `DataTableColumnDef.accessor` reads
  via `getCustomValue(row, fieldDef)`; for cell edits, the existing
  `CellWrite` path writes to `row.custom[cf_id]` via a typed updater
  (add a small helper in `customFieldAccessor.ts`).

### New tests

- `useTableSchema.test.ts` — given two core fields and two custom
  fields, returns merged `fieldDefs` in core-then-custom order with
  the right `field_key`, `read_only_schema`, and `field_type`.
- `customFieldAccessor.test.ts` — `getCustomValue` returns
  `undefined` for missing keys, returns the stored value for present
  keys, refuses to read using a core `field_key`.
- `RoomsTable.test.tsx` regression — Rooms grid renders the same
  columns it rendered before, with no visible diff.

### Acceptance

- Frontend Vitest green; `pnpm run typecheck`, `pnpm run lint` green.
- Manual Playwright MCP smoke: open Rooms, confirm grid renders
  identically to pre-P1.4.

---

## Phase 1.5 — Schema-fingerprinted persisted view state

**Goal.** Close gate D13. Persisted view-state records carry a
`schema_fingerprint`. Loading view state across schemas applies the
state for render but does not overwrite the persisted entry for a
different schema fingerprint. This protects column order / width /
hidden / sort / filter / group across version switches with
divergent custom-field sets.

### Backend changes

`user_table_views.view_state` is already JSONB-opaque
(data-table.md "View State"). The fingerprint rides inside the
stored JSON envelope; no schema migration is needed.

Optional: add a top-level `schema_fingerprint: str | None` column to
`user_table_views` if we want server-side filtering by fingerprint
later. Phase 1 does **not** need that — the frontend handles the
match. Defer the column to Phase 5 or whenever a real use case
appears.

### Frontend changes

**`frontend/src/features/table_views/useProjectTableViewState.ts`:**

- Add `schemaFingerprint: string` to `UseProjectTableViewStateArgs`.
- On load: parse the stored envelope `{ schema_fingerprint, view_state }`.
  - If `schema_fingerprint` matches the active fingerprint → apply
    `view_state` as before and keep saving on changes.
  - If it doesn't match → apply `view_state` for render
    (`sanitizeViewStateForSchema` already drops unknown refs), but
    **freeze writes** until the user makes a view-state change under
    the active fingerprint. The first user change kicks off a normal
    save with `schema_fingerprint = active`.
- On save: always write `{ schema_fingerprint: active, view_state }`.

**`frontend/src/features/equipment/components/RoomsTable.tsx`:**

- Pass `schemaFingerprint` from `useTableSchema` into
  `useProjectTableViewState`.

### New tests

- `useProjectTableViewState.test.ts`:
  - load with matching fingerprint → applies stored state and saves
    on change as usual;
  - load with mismatching fingerprint → applies for render but does
    not save until a user gesture; after a user gesture the save
    payload carries the new fingerprint;
  - round-trip across A → B → A: A's persisted state survives
    untouched after B's session, even if B made view changes under
    B's fingerprint.
- `test_table_views.py` (backend) — backend stores the envelope
  bytes verbatim and round-trips; no semantic check needed beyond
  size/syntax envelope rules already in place.

### Acceptance

- All existing view-state tests green.
- New round-trip test demonstrates the cross-schema preservation.

---

## Phase 1.6 — Developer seed path + exit-criteria acceptance tests

**Goal.** Make the exit criteria from plan-13 §5 phase 1 enforceable
without shipping any user-facing schema-editor UI: a custom
`short_text` field seeded through a developer-only path renders in
the Rooms grid, accepts cell writes, survives Save / Save As / Lock /
version-switch, and does not corrupt persisted view state across
versions with different custom schemas.

### Backend changes

**Developer seed helper** in
`backend/features/project_document/tables/_dev_seed.py`:

```python
def seed_rooms_custom_field(
    body: ProjectDocumentV1,
    *,
    display_name: str,
    field_type: CustomFieldType = CustomFieldType.short_text,
    description: str | None = None,
) -> tuple[ProjectDocumentV1, CustomFieldDef]:
    """TEST/DEV ONLY. Append a custom field to Rooms with created_by=None
    (D11). Not exposed through any HTTP / MCP surface in Phase 1."""
```

Used by acceptance tests and by a manual CLI smoke (`uv run
python -m features.project_document.tables._dev_seed`). The function
panics if invoked outside tests / dev shell — no production import.

### New end-to-end tests

`backend/tests/test_project_document_custom_fields_phase_1.py`:

1. **Seed + read** — seed a `short_text` field, GET the Rooms slice,
   confirm `custom_fields[0].id` is a `cf_*` ULID and
   `custom_fields[0].field_type == "short_text"`.
2. **Write + read** — PUT the Rooms slice with one row carrying
   `custom: { "<cf_id>": "needs paint" }`, GET back, confirm value
   round-trips.
3. **Reject orphan custom value** — PUT with `custom: { "cf_unknown":
   "x" }` and `custom_fields: []`; assert 422 with
   `invalid_project_document`.
4. **Save** — flush the draft to the version body via the existing
   Save endpoint; GET the saved Rooms slice; confirm
   `custom_fields` and `custom` survived.
5. **Save As** — Save As into a new version; confirm both versions
   carry the same `custom_fields` and `custom` values.
6. **Lock + draft** — lock the source version; PUT the Rooms draft
   returns 409 `version_locked`; Save As remains permitted.
7. **Version-switch view-state preservation** — set view state
   (column widths) under fingerprint A (has custom field);
   switch to a version with fingerprint B (no custom field) and
   change view state there; switch back to A; confirm A's saved
   widths are intact. This belongs at the frontend Vitest layer
   primarily (P1.5 already covers it), but mirror it as a
   backend-side round-trip to be sure persistence doesn't drop
   the envelope.

`frontend/src/features/equipment/__tests__/RoomsTable.customField.test.tsx`:

- Render Rooms with a seeded `short_text` custom field, type a value
  in the cell, confirm `WriteOp` fires with `kind: "cell"` and
  `fieldKey === <cf_id>` (D12 identity).

### Manual exit-criteria smoke

Run via Playwright MCP after the PR is in place:

1. Start backend + frontend (`make dev`).
2. Use the dev seed CLI to add a `short_text` field "Notes" to the
   active project's Rooms.
3. Open the Rooms table in the browser; confirm the new column
   appears at the end with default width and the locked-state
   indicator **absent** (custom field). Resize and reorder.
4. Type a value in one cell. Save. Confirm the value persists across
   page reload.
5. Save As to a new version. Open the new version. Confirm the
   custom field and value.
6. Lock the source version. Confirm Save returns 409 in the network
   panel and the UI surfaces it.
7. Switch back to the source version. Confirm column widths /
   order set in step 3 are intact.

### Acceptance

- All Phase 1 acceptance tests pass.
- `make test`, `make e2e`, `make smoke` green.
- Manual smoke completed; screenshots filed under
  `planning/archive/dated/2026-05-24/screenshots/plan-14-p1-6/`.

---

## Cross-cutting verification checks

After each phase, run:

- `make typecheck` (backend mypy + frontend tsc)
- `make test` (pytest + vitest)
- `make lint`
- `make smoke` (lightweight end-to-end against the running stack)
- `make e2e` only at phase boundaries that touch user-visible
  behavior (1.4, 1.6).

If `make smoke` exposes a regression after the schema bump in 1.1,
the most likely cause is a fixture that wasn't updated in lockstep —
diff search for `"rooms": [`/`tables.rooms` should find any
stragglers.

## Rollback notes

- **Pre-deploy.** No production data exists. Rolling back any phase
  is a `git revert` plus a `make test` to confirm fixtures still
  align.
- **schema_version 1 → 2** has no shim chain by design (plan-13
  §4.1; CLAUDE.md §16). If we ever need to migrate post-deploy
  documents, the `upgrade_v1_to_v2.py` shim hook described in
  `llm-mcp-schema.md` §10.5 is where it would land — but no such
  shim ships in Phase 1.
- **Custom-field state in tests** is created by the dev seed helper
  only. Rolling back removes the helper, the new tests, and the
  envelope shape together; no orphan rows persist anywhere.

## Out of scope (Phase 2+)

These belong to subsequent plans, not Phase 1:

- Header context menu and field-editor popover (Phase 2;
  US-CF-1..5, US-CF-11..14).
- MCP schema-mutation tools (Phase 2; llm-mcp-schema.md §10.3
  custom-field tool block).
- `FieldSchemaMutation` discriminated DTOs as a *write* surface
  (Phase 2; data-table.md "Write Pipeline"). Phase 1 only needs
  the *read* envelope to expose `custom_fields`; the existing
  whole-table replace route is enough to seed via tests.
- Custom `single_select` and option-list lifecycle (Phase 3).
- Formula grammar, AST, evaluator parity, and the `computed`
  overlay (Phase 4).
- Fan-out to ERVs / Pumps / Fans / Thermal Bridges (Phase 5).
- Field-permission UI (deferred, D9).

## Open questions

None at plan-draft time. All Phase 1 architectural questions were
closed in plan-13 §3 and §8 and propagated into the context docs by
the Phase 1.0 gate-closing pass (this is `plan-14`'s precondition).
If a question surfaces during implementation, raise it in chat and
amend this plan in place before continuing — do not silently make
the call inside a sub-phase PR.
