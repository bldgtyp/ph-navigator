---
DATE: 2026-05-24
TIME: planning
STATUS: Draft overview + phasing. Architecture direction is settled
        with Ed in chat 2026-05-24; this revision adds pre-
        implementation contract gates that must be closed before
        Phase 1 code starts. Per-phase implementation plans will be
        written when each phase begins.
SCOPE: User-defined custom fields on project-document tables —
       AirTable-style "add field" affordance adapted to PH-Navigator's
       versioned-document model. Phase plan + architectural decisions
       record. **Catalog tables are out of scope for v1.**
RELATED:
  - context/user-stories/32-custom-fields.md (US-CF-1..12)
  - context/user-stories/30-tables-equipment.md (US-Builder-Tables)
  - context/user-stories/31-data-table-enhancements.md (parity bar)
  - context/technical-requirements/data-table.md (canonical contract)
  - context/technical-requirements/data-model.md (document shape)
  - context/technical-requirements/save-versioning.md (draft/version lifecycle)
  - context/technical-requirements/llm-mcp-schema.md (MCP + schema surface)
  - context/PRD.md §6 (data model), §10 (LLM/MCP), §11 (frontend)
  - context/GLOSSARY.md (Version / Draft / Save / Save As / Lock)
---

# Custom Fields — Architecture Overview & Phase Plan

## 1. Purpose

Allow editors to extend any project-document table (Rooms, ERVs,
Pumps, Fans, Thermal Bridges, ...) with their own fields, of types
they choose, while preserving:

- a fixed set of **Core (locked) fields** the app owns for API /
  MCP stability,
- the existing **version / Save / Save As / Lock** lifecycle,
- the typed **`FieldDef` + `WriteOp`** contract that the shared
  `<DataTable>` is built around,
- the **JSONB-document architecture** (no new relational shape).

User-facing acceptance criteria live in `32-custom-fields.md`. This
doc records the architecture and sequences the work.

## 2. Why this fits V2 cleanly

- The project body is already JSONB and already validated by a
  Pydantic `ProjectDocumentV1`. Adding a per-table schema block is
  additive, not structural.
- The body is already versioned. Renaming / retyping / deleting a
  custom field changes the **Draft** only; locked Versions retain
  their own schema + data. **No migration ladder, no destructive
  rewrites.** This is the single biggest architectural win and
  shapes several decisions below.
- `FieldDef` is already a closed discriminated union driving render,
  edit, clipboard coercion, sort, filter, and aggregation. Custom
  fields become the same frontend field-definition shape, not a
  parallel system.
- `ViewState` already keys columns by field identity. Custom field
  ids can drop in, but Phase 1 must tighten this interface: for a
  custom field, the DataTable / WriteOp / ViewState identity is the
  immutable `cf_*` id, not the human-readable slug.
- The DataTable spec already names a `FieldDefMutation` `WriteOp`
  kind (data-table.md "Write Pipeline") and reserves the tail `+`
  cell for "the future add-field feature." This plan replaces that
  placeholder with typed schema-mutation DTOs before UI work begins.

## 3. Resolved decisions (chat with Ed, 2026-05-24)

| # | Decision |
|---|---|
| D1 | **Type change is destructive-with-preflight.** Editor sees per-row coercion diagnostics; "Convert anyway" clears incompatible cells in the same atomic `WriteOp`. |
| D2 | **Formula syntax is AirTable-style.** Users write `{Display Name}`; parser resolves to `cf_*` id at commit; stored AST is id-only. Renames update the editor's displayed expression on next open without rewriting the AST. |
| D3 | **Computed (formula) values are present in JSON downloads but kept out of stored row values.** The download shape must mark formula results as read-only so consumers can ignore or strip them on round-trip. |
| D4 | **Catalog tables: no custom fields in v1.** Project-document tables only. Catalog migration is a separate later effort. |
| D5 | **Duplicate field names refused.** Per-table, case-insensitive, trimmed, across core + custom. Client preflights, server re-validates. |
| D6 | **Locked / unlocked indicator is orthogonal to view-state tints.** Non-background channel (icon + small border accent); header-only, never on data cells. |
| D7 | **Field editor is a popover** anchored to the target header cell (AirTable parity). Formula editor may escalate to a modal in phase 4 if config grows large. |
| D8 | **Formula live preview evaluates against the focused row only**, not every visible row. |
| D9 | **Field-permissions UI is deferred** (granular per-field). Schema mutations remain gated by editor login server-side; viewers and unauthenticated MCP are rejected. |
| D10 | **Duplicate-field and field-description are v1 features** (not phase 5 polish). They land in phase 2 alongside add / rename / delete. |
| D11 | **`created_by` accepts `null` for fixtures only.** API path requires a real user id; LLM/MCP writes get the token's user id. |
| D12 | **Custom field identity is `cf_*` everywhere mutations and view-state care about identity.** `CustomFieldDef.id` is the DataTable `FieldDef.field_key`, the `WriteOp.fieldKey`, formula dependency id, and persisted `ViewState` column id for custom fields. Any `field_key` / slug / export key is advisory only and may use a `u_` prefix for readability, but it is never the write identity. |
| D13 | **View state must be schema-aware.** Persisted view state remains per user/project/table, but each saved payload carries a table schema fingerprint. Loading a different version/schema sanitizes at render time and writes back only for that schema fingerprint, so switching versions does not erase custom-column order/widths from another version. |
| D14 | **Every custom-field-capable table gets a registered contract.** No table-specific branching in routes or services. The registry owns table path, row model, custom-field accessors, option-list namespace, schema endpoint slug, download shape, diff extraction, and schema-mutation apply/validate functions. |
| D15 | **Schema mutations are discriminated DTOs, not a vague before/after FieldDef.** Add / rename / delete / duplicate / change-type / set-description / set-formula each have a typed payload with `table_key`, `field_id`, expected schema fingerprint, and any dependent cell/option-list changes needed for one atomic undo/write. |
| D16 | **Draft mutation validation is immediate.** The backend validates the affected table envelope and full document references before accepting a schema mutation or custom-field cell write. Save re-validates, but malformed drafts should not be allowed to accumulate. |
| D17 | **Formula evaluation has hard resource limits.** Phase 4 defines max source length, AST depth/node count, dependency count, output string length, per-row evaluation timeout/budget, null/NaN/Infinity behavior, and division-by-zero semantics before implementation. |
| D18 | **Firm-standard repeated fields are not solved by ad hoc custom fields.** If a field should appear across many projects or tables as BLDGTYP standard vocabulary, it should become a core field or a later project-template/schema-copy feature. v1 custom fields are per project-version table extensions. |
| D19 | **Source-→-target type-conversion matrix is the canonical contract.** Pairs marked ✅ run `coerce_custom_value` per row; failures become preflight diagnostics. Pairs marked ❌ raise `custom_field_illegal_type_conversion` and the target pill greys out. Lives in `backend/.../schema_mutations.py::CONVERSION_MATRIX` and mirrored in `frontend/.../typeConversionMatrix.ts`. `formula` is forbidden in both directions (use `setFormula` mutation instead). Resolved 2026-05-24 alongside plan-16. |
| D20 | **`text → single_select` auto-creates options with a hard cap.** Distinct trimmed non-empty source values (case-insensitive distinctness via `normalize_display_name`) become fresh `opt_*` options in deterministic first-row-encounter order; colors cycle from `OPTION_COLOR_PALETTE`. Hard cap **50** options per conversion; rows whose normalized value first appears past the cap become coercion failures (cleared with acknowledgement). Resolved 2026-05-24 alongside plan-16. |
| D21 | **`single_select → text` substitutes the option label, not the option id.** The option-list namespace is removed at conversion time (field is no longer single_select), so id-preservation has no benefit; labels are user-readable. Resolved 2026-05-24 alongside plan-16. |
| D22 | **Formula numeric semantics: AirTable parity, ease-of-use over power.** All numbers are IEEE-754 binary64; no separate integer type (`42` parses to `float(42)`; `42 = 42.0` is true). Division (`/`) always returns float. Division by zero (any numerator including 0) produces structured `{"error": "div_by_zero"}` — never `Infinity` or `NaN`. Non-finite results from overflow / underflow are trapped and reported as `{"error": "type_mismatch"}`. Modulo (`%`) uses `math.fmod` semantics (sign follows dividend); both Python and TypeScript implement an explicit `_fmod` helper rather than the language's native `%` (JS `%` matches, but the helper makes the parity contract explicit and future-proofs against engine drift). Explicit `round(n, digits)` deferred to a later phase. Resolved 2026-05-25 (plan-17 P4.0). |
| D23 | **Hard resource limits on formula parsing and evaluation.** `source_length=1024` chars, `ast_node_count=256`, `ast_depth=24`, `dep_count=16`, `output_length=8000` chars, `per_row_budget=1024` nodes-evaluated (deterministic node-count fuse, not wall-clock — required for evaluator parity). Limits enforced at parse time (source / nodes / depth / deps) and at evaluate time (output / fuse). Breaches raise `custom_field_formula_resource_limit`. Defaults err toward restrictive; loosen during Phase 5 if real usage requires it. Resolved 2026-05-25 (plan-17 P4.0). |
| D24 | **`substring(s, start, end)` is 1-indexed, inclusive end (AirTable parity).** `substring("hello", 1, 3) == "hel"`. Out-of-range indices clamp to `[1, len(s)]`. Negative indices not supported in v1 — rejected at parse time when start/end are literals, at evaluate time when they are expressions. Resolved 2026-05-25 (plan-17 P4.0). |
| D25 | **Formula errors encoded as `{"error": "<token>"}` structured values in the read overlay.** `row.computed[cf_id]` is the raw scalar (`null`, string, number, bool) on success, or an object `{"error": "<token>"}` on failure where token is one of `div_by_zero`, `type_mismatch`, `missing_ref`, `fuse_tripped`, `output_too_long`. Grid render maps the token onto the existing `computed` field type's error state with a tooltip carrying the human-readable message. Resolved 2026-05-25 (plan-17 P4.0). |
| D26 | **Formula null coercion: AirTable parity.** String functions (`concat`, `upper`, `lower`, `replace`, `substring`, `len`, `trim`) coerce `null` arguments to `""`. `number(null) == null` and `text(null) == null` so explicit casts preserve the structured-error tier. Arithmetic on `null` produces `null` (null propagation): `null + 1 == null`, `null = null` is true, `null = 0` is false. Boolean `and` / `or` short-circuit on `null` the same way they do on `false`. Resolved 2026-05-25 (plan-17 P4.0). |

## 4. Architecture

### 4.1 Document shape

Reshape each project-document table from `Row[]` to
`{ custom_fields, rows }`:

```jsonc
"tables": {
  "rooms": {
    "custom_fields": [
      {
        "id": "cf_01HX...",                 // stable ULID; primary identity
        "field_key": "u_notes",             // optional export slug; advisory only
        "display_name": "Notes",
        "field_type": "long_text",
        "config": { /* type-specific */ },
        "description": null,
        "created_at": "2026-05-24T...",
        "created_by": "user_..."
      }
    ],
    "rows": [
      {
        "id": "rm_...",
        "name": "Master Bedroom",          // core, typed by Pydantic
        "floor_level": "L2",
        // ... other core fields ...
        "custom": { "cf_01HX...": "needs paint" }
      }
    ]
  }
}
```

Rules:

- Core fields stay strongly typed in Pydantic. They are **never**
  in `custom_fields`.
- Custom values are a sparse dict on each row keyed by stable
  `cf_*` id, **not** by display name or `field_key`. Renaming never
  rewrites any row.
- The stored custom-field `id` is also the frontend `FieldDef.field_key`
  for custom fields. This keeps `CellWrite.fieldKey`, filters, sort,
  group, column widths, formula deps, and undo semantics tied to the
  immutable identity the document already stores.
- `field_key` / slug / export key is advisory — used only for JSON
  readability and optional formula-editor display. The system of
  record is the id.
- Computed (formula) values are recomputed on read, not stored.
  They show up in downloads (D3) but are not part of the stored row
  and are rejected or stripped from inbound writes.
- The catalog tables (`catalog_materials`, frame, glazing) keep
  their current rigid shape (D4).

This is one `schema_version` bump. No back-compat shim — V2 is
pre-deploy (CLAUDE.md).

### 4.2 Field types — v1 closed set

| `field_type` | Notes |
|---|---|
| `short_text` | Single-line text. |
| `long_text` | Multi-line; cell renders truncated, popover editor expands. |
| `number` | SI semantics; per-field `precision` in config. **Unit dimension deferred** — start unitless to avoid coupling to the IP/SI machinery in v1. |
| `url` | URL-validated; renders as a link. |
| `single_select` | Options live in the existing document `single_select_options` map under `<table_path>.<cf_id>` — reuses the current core-single-select lifecycle. |
| `formula` | Read-only computed value (see §4.4). |

The Pydantic `FieldType` enum grows to include these. The frontend
`FieldDef` type and DataTable renderers extend in lockstep.

### 4.3 Backend shape

- **No new relational tables.** Custom field schema and values live
  in the JSONB body, validated by Pydantic.
- Per-table envelope models, e.g.

  ```python
  class RoomsTable(BaseModel):
      custom_fields: list[CustomFieldDef] = []
      rows: list[RoomRow] = []
  ```

  Nested tables use their registered table path, not ad hoc route
  branches. For example, future equipment tables should register
  `equipment.ervs`, `equipment.fans`, and `equipment.pumps` as
  separate table contracts even though they live under
  `tables.equipment` in the document.

- `RoomRow.custom: dict[str, CustomValue] = {}` where
  `CustomValue` is `str | int | float | bool | None` (plus any
  type the field types above produce). Strict per-row validation
  runs when a draft mutation is accepted and again on Save: every
  key in `custom` must map to a field in this table's
  `custom_fields`, and every value must coerce to that field's
  declared type.
- Uniqueness checks run when a schema mutation is accepted and again
  on Save across this table's full field set (core + custom),
  case-insensitive + trimmed (D5).
- Draft-patch endpoints accept typed schema-mutation ops alongside
  existing cell / row / paste / fill ops. The single FIFO
  persistence queue per draft already exists; schema ops slot in,
  but the backend remains authoritative and rejects stale schema
  fingerprints, duplicate names, invalid custom values, unsupported
  type conversions, and illegal formula refs before storing the draft.

### 4.3.1 Registered table contract extension

Phase 1 must extend `backend/features/project_document/tables/` with
an explicit custom-field-capable contract instead of adding
table-specific code paths. Each table that opts in declares:

- `table_key` and JSON document path, including nested paths like
  `equipment.ervs`;
- row model and table-envelope model;
- how to read / replace `custom_fields`;
- how to get / set a row's `custom` dict;
- the core field registry for duplicate-name checks and formula refs;
- the `single_select_options` namespace for custom option lists;
- JSON Schema slug and per-table schema endpoint metadata;
- download extraction, diff extraction, and MCP/table-query field
  discovery;
- schema-mutation apply and validation functions.

Phase 1 should prove this with Rooms only, but the abstraction must be
real enough that ERVs / Pumps / Fans / Thermal Bridges do not need
their own schema-editor services later.

### 4.3.2 Schema mutation DTOs

The existing frontend `fieldDefMutation` placeholder is too vague for
custom fields. Before Phase 2 UI work, define a discriminated mutation
shape shared by REST, MCP, and DataTable:

```ts
type FieldSchemaMutation =
  | { kind: "addField"; tableKey: TableKey; after: CustomFieldDef; insertAfterFieldId?: string; expectedSchemaFingerprint: string }
  | { kind: "renameField"; tableKey: TableKey; fieldId: string; displayName: string; expectedSchemaFingerprint: string }
  | { kind: "deleteField"; tableKey: TableKey; fieldId: string; clearValues: true; expectedSchemaFingerprint: string }
  | { kind: "duplicateField"; tableKey: TableKey; sourceFieldId: string; after: CustomFieldDef; expectedSchemaFingerprint: string }
  | { kind: "changeType"; tableKey: TableKey; fieldId: string; after: CustomFieldDef; cellWrites: CellWrite[]; expectedSchemaFingerprint: string }
  | { kind: "setDescription"; tableKey: TableKey; fieldId: string; description: string | null; expectedSchemaFingerprint: string }
  | { kind: "setFormula"; tableKey: TableKey; fieldId: string; config: FormulaConfig; expectedSchemaFingerprint: string };
```

The final code may choose different names, but it must preserve these
semantics: table-scoped identity, optimistic concurrency against the
schema seen by the editor, one semantic gesture / undo entry, and one
backend validation pass that applies dependent cell and option-list
changes atomically.

### 4.4 Formula evaluation — dual evaluator with shared semantics

Two non-negotiables:

1. **Never `eval()` user input on either side.** No `Function(...)`,
   no `eval`, no `vm.runInNewContext`. We parse a typed AST and
   evaluate it ourselves.
2. **Backend remains authoritative for computed values that ship
   off the frontend** (downloads, MCP reads). Frontend evaluator
   runs the same AST for live render only.

Grammar (v1):

```
expr     ::= ternary
ternary  ::= "if" "(" expr "," expr "," expr ")"
           | or_expr
or_expr  ::= and_expr ("or" and_expr)*
and_expr ::= not_expr ("and" not_expr)*
not_expr ::= "not" not_expr | cmp
cmp      ::= add ( ("=" | "!=" | "<" | "<=" | ">" | ">=") add )?
add      ::= mul ( ("+" | "-") mul )*
mul      ::= unary ( ("*" | "/" | "%") unary )*
unary    ::= ("-") atom | atom
atom     ::= number | string | bool | "null"
           | field_ref | func_call | "(" expr ")"
field_ref::= "{" display_name "}"
func_call::= name "(" [ expr ("," expr)* ] ")"
```

Functions (v1): `concat`, `upper`, `lower`, `replace`, `substring`,
`len`, `trim`, `number`, `text`.

Storage on the field def:

```jsonc
"config": {
  "source": "concat({Number}, \" — \", upper({Name}))",
  "ast": { /* resolved AST: refs are cf_* ids / core keys */ },
  "deps": ["number", "name"],   // for cycle / dead-ref detection
  "result_type": "text"         // inferred at parse time
}
```

Parity discipline:

- One shared **fixture corpus** of expression + row inputs + expected
  outputs lives at `backend/tests/fixtures/formula_corpus.json`.
- Backend tests (pytest) and frontend tests (Vitest) both run the
  corpus. Both must agree to the byte. CI fails if either side
  diverges.
- Cycles are rejected at parse time via dep graph.
- Missing refs (deleted field after the formula was saved) produce
  a structured `error: missing_ref` value rendered in the existing
  `computed` field error state.
- Formula parser and evaluator enforce explicit limits before any
  public Viewer or MCP read can evaluate formulas: source length,
  AST node count, AST depth, dependency count, output string length,
  and per-row evaluation budget. Null propagation, type coercion,
  division by zero, NaN, and Infinity must be specified in the
  phase-4 plan and locked into the shared corpus.

### 4.5 Frontend — `useTableSchema` is the seam

A single shared hook merges core + custom field defs into the
`FieldDef[]` that DataTable already consumes:

```ts
function useTableSchema(tableKey: TableKey): {
  fieldDefs: FieldDef[];           // core + custom, in column order
  coreFieldKeys: Set<string>;
  customFields: CustomFieldDef[];
  mutate: (op: FieldDefMutation) => void;
}
```

- Per-table wiring is one hook call: `useTableSchema("rooms")`.
- Adding custom-field support to Pumps / Fans is: (a) the Pydantic
  row model has `custom: dict`, (b) the frontend table calls
  `useTableSchema("pumps")`. No table-specific schema-editor code.
- For custom fields, the returned `FieldDef.field_key` is always the
  immutable `cf_*` id. Display names and advisory export slugs must
  never be used for cell writes, persisted view-state ids, or formula
  dependency identity.

The new header context-menu component (`<HeaderContextMenu>`) lives
inside `frontend/src/shared/ui/data-table/components/`. It reads
`fieldDef.read_only_schema` to choose between the core menu and the
custom menu (US-CF-6).

### 4.6 View state

Custom field ids (`cf_*`) drop into the existing `ViewState` column
identity slots (`columnOrder`, `columnWidths`, `hiddenColumns`,
`filter[*].fieldKey`, `sort[*].fieldKey`, `group[*].fieldKey`,
`aggregations`). The in-memory shape can stay the same, but persisted
view-state records need one new guardrail: a table schema fingerprint.

Why: custom schemas are version-scoped, while current project-table
view state is user/project/table-scoped. Without a schema fingerprint,
opening an older version that lacks a custom field could sanitize and
overwrite the saved order/widths for the newer version that still has
that field.

Rules:

- Compute a stable fingerprint from core field ids + custom field ids
  + custom field types, ordered by the table schema.
- Load persisted view state only when its fingerprint matches the
  active table schema. If it does not match, sanitize for render but
  do not overwrite the stored view state until the user changes view
  state under the active fingerprint.
- Persist writes with the active fingerprint.
- Phase 1 tests must cover version A with custom columns, version B
  without them, and a round-trip back to version A with column order /
  width / hidden state preserved.

### 4.7 LLM / MCP

- Project JSON downloads include `custom_fields` inline per table.
  An LLM reading the document can render and write custom values
  correctly without out-of-band knowledge (US-CF-10).
- `ProjectDocumentV1` JSON Schema declares the closed
  `CustomFieldDef` shape and leaves `row.custom` as
  `additionalProperties: true`. No per-project schema endpoint in
  v1.
- MCP tools added in phase 2: `add_custom_field`,
  `rename_custom_field`, `change_custom_field_type`,
  `delete_custom_field`, `duplicate_custom_field`,
  `set_custom_field_description`, and later `set_formula_config`.
  Each tool maps to the same `FieldSchemaMutation` service used by
  the browser. Scoped behind the editor MCP token, idempotency-aware,
  and audit-logged like every existing write.
- Cell writes to custom fields go through the existing
  `patch_draft` tool unchanged.
- MCP/schema write tools increase token blast radius. Phase 2 must
  include explicit structured error codes for duplicate field names,
  stale schema fingerprint, invalid field id, illegal type conversion,
  formula parse failure, formula cycle, and unauthorized schema write.

### 4.8 Visual indicator (US-CF-11)

- Lock glyph in the header cell for core fields; no glyph (or a
  subtle alternate glyph) for custom.
- Optional 2–3 px left border accent on core headers using a new
  token (`--phn-header-border-locked`).
- Header background tints stay reserved for the four view-state
  channels (filter / sort / group / future). No fifth channel for
  lock state.

### 4.9 JSON export / download shape

Stored document rows contain source values only:

```jsonc
{
  "id": "rm_...",
  "name": "Master Bedroom",
  "custom": {
    "cf_01HX_notes": "needs paint"
  }
}
```

Downloads and MCP reads may include computed formula values, but they
must keep source and read-only computed values distinct:

```jsonc
{
  "rooms": {
    "custom_fields": [ /* CustomFieldDef[] */ ],
    "rows": [
      {
        "id": "rm_...",
        "name": "Master Bedroom",
        "custom": { "cf_01HX_notes": "needs paint" },
        "computed": { "cf_01HX_label": "101 - MASTER BEDROOM" }
      }
    ]
  }
}
```

Inbound writes reject or strip `computed`. Formula fields remain
write-protected even though their values are visible in read surfaces.
If the implementation chooses a different read overlay name, it must
preserve this source-vs-computed separation.

## 5. Phasing

Five phases. Each is independently shippable; each ends with the
shared `<DataTable>` still passing all existing tests against Rooms.

### Phase 1 — Document shape + Pydantic + read path

- Reshape every project-document table to
  `{ custom_fields, rows }`. Update Pydantic models, golden fixtures,
  JSON Schema, MCP read tools.
- Extend the table registry with the custom-field contract in §4.3.1.
  Prove it with Rooms only, but keep the interface table-path-aware
  for future nested equipment tables.
- Settle the exact DataTable identity rule: custom `FieldDef.field_key`
  is the immutable `cf_*` id, not the advisory slug.
- Add schema-fingerprint support to persisted project table view state
  or explicitly mark it as a Phase 1 blocker if implementation reveals
  a better equivalent.
- Define the download/read overlay shape for formula outputs even
  though formula evaluation itself lands in Phase 4.
- No frontend UI yet for editing schema. Custom fields can be
  inserted only via fixture/admin/manual developer path in this phase
  and render through DataTable using the existing `text` / `number`
  renderers. Do not claim MCP schema writes are available until the
  Phase 2 tools exist.
- `useTableSchema` hook lands and merges core + (initially empty)
  custom field defs.
- `schema_version` bump + corpus drill.
- **Exit criteria:** a custom `short_text` field seeded through the
  Phase 1 developer path shows up in the Rooms grid, accepts cell
  writes, persists through Save / Save As, survives Lock +
  version-switch correctly, and does not corrupt persisted view state
  when switching between versions with different custom schemas.

### Phase 2 — Header context menu + add / rename / delete / duplicate / describe (text / long_text / number / url)

- `<HeaderContextMenu>` component + keyboard hookup.
- Field-editor **popover** (US-CF-2, D7): name, type picker (4
  simple types), optional description input (US-CF-14), per-type
  config panel.
- Rename + delete + locked-vs-unlocked visual indicator
  (US-CF-3 / 5 / 6 / 11).
- **Duplicate field** (US-CF-13, D10): one-click duplicate with
  uniquified name and empty row values.
- **Field description / tooltip** (US-CF-14, D10): `?` glyph
  adjacent to the locked/unlocked indicator, hover tooltip.
- Duplicate-name enforcement client + server (US-CF-12).
- Schema mutation DTOs (§4.3.2) become the browser write surface.
- MCP write tools: `add_custom_field`, `rename_custom_field`,
  `delete_custom_field`, `duplicate_custom_field`,
  `set_custom_field_description`. These call the same backend service
  as the browser and include idempotency/audit coverage.
- **Exit criteria:** Rooms can be extended end-to-end through the UI
  with the four simple types, including duplicate + description.
  Viewer mode hides the menu and the `+` tail cell, but renders
  descriptions.

### Phase 3 — Type change + custom single-select

- Change-type dialog with preflight + "convert anyway" (US-CF-4).
- `single_select` field type wired into the existing `single_select_options`
  machinery under `single_select_options["<table_path>.<cf_id>"]`
  (US-CF-7).
- Option editor (add / rename / reorder / color / delete).
- Match-or-create paste extends to custom single-selects for free.
- **Exit criteria:** Rooms can host a custom single-select with full
  option lifecycle, and any custom field type can be retyped to any
  other compatible type with preflight.

### Phase 4 — Formula fields

**Status (2026-05-25):** Backend half shipped (P4.0 → P4.6) plus
backend acceptance coverage from P4.10, AND P4.7 (TypeScript port +
shared corpora) shipped. 332 backend tests + 806 frontend tests
green; Python and TS parsers/evaluators agree byte-for-byte on
every case in the shared `formula_{grammar,evaluator}_corpus.json`
fixtures, with CI failing on the first divergence. Frontend UI half
(P4.8 popover, P4.9 grid wiring, P4.10 e2e + a11y) is the next phase
of work. See
`planning/archive/dated/2026-05-25/plan-17-custom-fields-phase-4-formula-fields.md`
for the per-sub-phase progress log and lessons learned.

- Grammar + AST + parser (Python + TS).
- Resource limits and deterministic null / numeric error semantics
  specified before implementation.
- Shared formula corpus + parity tests in CI.
- Formula editor (input + field palette + live preview against
  focused row).
- Dependency / cycle detection at parse time.
- Renders through the existing `computed` field type's
  ready / stale / loading / error states.
- Downloads inline computed values per row (D3).
- **Exit criteria:** a Rooms formula `concat({Number}, " — ",
  upper({Name}))` renders identically in the grid and in the JSON
  download; cycles and missing refs are caught with structured
  errors; computed outputs are present only in the read overlay;
  renaming a referenced field updates the editor display on next open
  without rewriting the stored AST.

### Phase 5 — Fan-out + polish

- Apply `useTableSchema` to ERVs, Pumps, Fans, Thermal Bridges.
- Add a project-template / schema-copy follow-up plan if repeated
  BLDGTYP-standard custom fields appear during real use; do not solve
  cross-project standardization through hidden ad hoc field reuse.
- Field permissions: still deferred (D9 — granular per-field;
  authentication-level gating is already in place from phase 2).
- Accessibility pass on the context menu, popover field editor,
  and formula editor.
- **Exit criteria:** every project-document table supports custom
  fields with no per-table editor code; a11y review signed off.

## 6. Out of scope for v1 (deferred)

- Catalog table custom fields (D4).
- Cross-row aggregations in formulas (e.g. `sum(...)` over rows).
- Cross-table lookups in formulas.
- Date / datetime field type and date-math functions.
- Field permissions (per-user / per-role).
- Field-level revision history beyond what version-level lockfiles
  already give.
- Per-project JSON Schema endpoint that bakes in concrete custom-
  field types (LLM consumers use the live document schema instead).
- Programmatic batch import of custom-field schemas from CSV /
  AirTable export.
- Cross-project custom-field templates / schema libraries.
- Unit-dimension awareness for custom numbers (no IP/SI toggle for
  user-defined number fields in v1).

## 7. Risks

- **R1. Frontend type erosion.** Custom values force `RoomRow.custom:
  Record<string, unknown>` on the typed row interface. Mitigation:
  consumers always go through the `FieldDef` accessor for custom
  values; lints disallow direct `row.custom[id]` access in render
  code. Phase 1 establishes the accessor pattern.
- **R2. Formula parity drift.** The two evaluators are different
  codebases and will drift unless tied together. Mitigation: shared
  fixture corpus + CI gate failing on first divergence (§4.4).
- **R3. Draft/save validation cost.** Per-row Pydantic validation of
  the `custom` dict adds work on every accepted draft mutation and
  save. Mitigation: validators short-circuit on absent / empty
  `custom`, schema mutations validate only the affected table before
  full-document reference validation, and Phase 1 profiles the largest
  real project before phase 5.
- **R4. View-state staleness across versions.** `sanitizeViewStateForSchema`
  strips unknown refs, but custom schemas are version-scoped while
  view state is currently project/table-scoped. Mitigation:
  schema-fingerprinted persisted view state (§4.6), plus tests for
  switching between versions with different custom field sets.
- **R5. Naming collision footgun.** Two layers:
  - **Structural (identity-level)** — eliminated by D12. Custom
    values, writes, formulas, and view state use the immutable
    `cf_*` id, not the advisory slug or display name. Pydantic
    models, JSON paths, and OpenAPI schemas are unambiguous by
    construction.
  - **Visual (display-name-level)** — residual. A user-chosen
    `display_name` like "Volume" could collide with a future core
    field also called "Volume" added in a later release. Two
    same-named columns then appear in the same table. Mitigation
    in two layers:
    1. The lock indicator (US-CF-11) is the user-facing
       disambiguator — the two columns are visually distinct as
       core vs custom.
    2. When a new core field is added in a future release whose
       `display_name` collides with an existing custom field in
       any saved version, the upgrade shim suffixes the custom
       field's `display_name` with " (custom)" and logs a
       warning. The custom field's `cf_*` id and stored values
       are untouched. (Phase 5 stub; no real shims exist
       pre-deploy.)
- **R6. MCP token blast radius.** An MCP write token can now mutate
  schema, not just data. Mitigation: schema mutations go through the
  same service, ETag / schema-fingerprint checks, idempotency, and
  audit-log path as browser writes. Phase 2 must include a focused
  security review before MCP schema tools ship.
- **R7. Placeholder mutation model.** The current DataTable
  `fieldDefMutation` shape is not rich enough for add / delete /
  duplicate / type-change with dependent value clears. Mitigation:
  land discriminated schema mutation DTOs (§4.3.2) before UI work.
- **R8. Formula resource abuse.** Public Viewer and MCP reads could
  evaluate formulas across many rows. Mitigation: hard parser/evaluator
  limits (§4.4), deterministic error values, and corpus tests for
  failure paths, not just successful expressions.
- **R9. Custom fields becoming informal firm schema.** Useful repeated
  BLDGTYP columns may appear across many projects. Mitigation: treat
  recurring fields as candidates for core schema or later template /
  schema-copy tooling, not silent ad hoc reuse.

## 8. Resolved questions

All open questions on this plan are resolved as of 2026-05-24
(see decisions D7–D11 in §3 and the resolutions in
`32-custom-fields.md` §"Resolved questions"):

- ~~**Q-CF-1.**~~ Popover (AirTable parity). Formula editor may
  escalate to a modal in phase 4 if needed.
- ~~**Q-CF-2.**~~ Focused row only.
- ~~**Q-CF-3.**~~ Granular per-field permissions deferred;
  schema-mutation gating by editor login remains in place from
  phase 2.
- ~~**Q-CF-4.**~~ Duplicate field shipped in v1 (phase 2,
  US-CF-13).
- ~~**Q-CF-5.**~~ Field description shipped in v1 (phase 2,
  US-CF-14).
- ~~**Q-CF-6.**~~ `created_by` accepts `null` for fixtures only;
  the API path requires a real user id.

## 9. Next steps

1. Before Phase 1 code starts, close the contract gates now called out
   in this overview: identity, view-state fingerprinting, table
   registry extension, mutation DTOs, validation timing, and export
   shape.
2. When phase 1 starts: write
   `plan-14-custom-fields-phase-1-document-shape.md` with the
   concrete Pydantic / fixture / migration / MCP-read changes,
   verification checks, and rollback notes. Include the schema-
   fingerprint and table-contract tests explicitly.
3. Subsequent phases each get their own dated plan in
   `planning/archive/dated/<YYYY-MM-DD>/` when work begins, following the
   plan-NN naming.
