---
DATE: 2026-05-26
TIME: 14:10 ET (rev 2026-05-26 — review fold-in)
STATUS: PRD — requirements + intent locked, with rev fold-in from
        docs/code-reviews/2026-05-26/plan-31-customizable-fields-prd-review.md.
        Detailed implementation plans for each phase land as separate
        docs under `docs/plans/2026-05-26/plan-31-phase-N-*.md` once
        this PRD is accepted.
AUTHOR: Claude (Opus 4.7)
SCOPE: Unify the built-in / custom field distinction in the DataTable
       contract. Built-in field configuration becomes user-editable on
       a per-attribute basis (locked-attributes whitelist), all field
       configs (built-in + custom) persist in the project document,
       and the pinned identifier column is recast as a real
       `record_id` field rather than a synthetic, prop-driven slot.
       Rooms is the worked example; rules apply to every DataTable.
       Includes user-driven `field_type` changes on built-in fields as
       a first-class requirement — see P2.3 for the architectural
       implications.
RELATED:
  - docs/code-reviews/2026-05-26/plan-31-customizable-fields-prd-review.md
  - docs/plans/2026-05-26/plan-30-datatable-identifier-column.md
  - context/PRD.md §11.3 (Data Tables)
  - context/UI_UX.md §1.7 (Table interaction model)
  - context/technical-requirements/data-table.md
  - context/technical-requirements/data-model.md §6.6
  - frontend/src/shared/ui/data-table/types.ts
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
  - frontend/src/shared/ui/data-table/lib/identifier/resolve.ts
  - frontend/src/shared/ui/data-table/lib/typeConversionMatrix.ts
  - frontend/src/shared/ui/data-table/lib/formula/ (engine is built)
  - frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx
  - frontend/src/features/equipment/components/RoomsTable.tsx
  - backend/features/project_document/document.py
  - backend/features/project_document/custom_fields.py
  - backend/features/project_document/schema_mutations.py
  - backend/features/project_document/tables/contracts.py
  - backend/features/project_document/tables/rooms.py
---

# Plan 31 — Customizable Built-In Fields (PRD)

## P0. Intent

Today the DataTable distinguishes "core" (built-in, code-declared) fields
from "custom" (user-created) fields with a binary
`read_only_schema: true` flag. Core fields can't be renamed, typed,
re-typed, deleted, or formulated; custom fields can. Identity (which
field is the pinned "Record-ID") is configured by a separate `identifier`
prop on the DataTable that resolves to either a promote-existing-column
shape or a synthetic `__record_id__` column.

This PRD replaces that two-tier model with one:

1. **Every field's configuration is editable by default.** The feature
   author declares per-field which attributes are *locked* (forbidden
   from user edits). Everything else is mutable through the same modal
   custom fields already use — including `field_type`.
2. **Every field's configuration persists in the project document.** The
   feature code's field list seeds new projects and registers newly
   added built-in fields on existing projects, but once a project exists,
   the document's stored field configs are the source of truth for
   attribute *values*. Lock lists themselves stay in feature code
   (see §P3 principle 4 and §P4.1).
3. **The pinned identifier is a real `record_id` field on every table.**
   The synthetic `__record_id__` column and the `IdentifierConfig<TRow>`
   prop go away. `record_id` is a regular FieldDef, persisted, sortable,
   typeable like any other field — usually a formula (e.g. for Rooms,
   `{number} — {name}`), but the user can change it.

The user-visible effect: double-click any column header — built-in or
custom — and you get the same field config modal. Locked attributes
appear disabled with a tooltip. Everything else is editable. The
Record-ID column behaves like any other field, just with a privileged
position and a default formula (or text identifier, per feature).

### P0.1 Acknowledged architectural cost

User-driven `field_type` changes on built-in fields are a load-bearing
requirement of this PRD, not an incidental capability. That requirement
forces a real reshape of the project-document storage model:

- Built-in fields whose `field_type` is user-mutable cannot live as
  typed Pydantic columns on `RoomRow` / `PumpRow` (a `number` column
  cannot hold a `text` value). Their values move into the existing
  generic `custom_values` bag (per P2.3). The bag is field-keyed by
  the same stable built-in `field_key`s the code already uses.
- Domain validators that ride on typed columns (`ge=0` on
  `num_people`, `le=1.0` on `icfa_factor`, `pattern=r"^opt_…"` on
  `floor_level`, `phase ∈ {1, 3}` on Pumps) cannot survive a retype
  to `text`. The lock-list policy is the only place those invariants
  live going forward — feature authors lock `"field_type"` on fields
  with hard domain constraints (see §P5).
- The published JSON Schema and the MCP / LLM read surface
  (`context/PRD.md` §10) advertise less type information on mutable-
  type fields after the reshape (`number | text | url | …` rather than
  `integer >= 0`). This is an accepted trade-off in exchange for
  AirTable-parity field configuration.
- `validate_document_references` and `catalog_origin` checks that
  consult typed columns (`room.floor_level`, etc.) read through the
  FieldDef list and the `custom_values` bag instead. See §P4.2.
- `CustomFieldCapability` (`backend/.../tables/contracts.py`) loses its
  meaningful "core vs custom" distinction. The capability shrinks to
  a per-table FieldDef registry + accessors. See §P4.2 and §P6 Phase 1b.

The pre-deploy / clean-rebuild posture (§P3.6) is what makes this cost
acceptable. **There is no production data to preserve.** Schema-version
bumps run once, validate the resulting documents, and ship.

## P1. Motivation

Three things drive this.

**M1 — Users need to adapt field semantics to their projects.** In
practice, every project has minor variations. One project wants `Number`
as text (`R-101A`), another wants it as a number (`101`). One project
wants the Record-ID formatted as `Room-{number} [{name}]`, another wants
`{number}: {name}`. The current "core fields are immutable" rule forces
every such variation into a *new custom field* with a new key, which
breaks downstream consumers that key off the core field name.

**M2 — The custom/core split is a leaky abstraction.** The DataTable
already merges core + custom into one `FieldDef[]` (`useTableSchema`).
The header context menu, the inline editor, the sort/filter/group
pipeline, the conversion matrix, the formula resolver — none of them
*need* the distinction. The only real difference is "which attributes
can the user touch." Modeling that distinction directly (per-attribute
locks) collapses the two paths into one.

**M3 — The identifier-column abstraction has accumulated special
cases.** Plan 30's `IdentifierConfig<TRow>` carved out a synthetic
column with its own header label, reserved id, view-state whitelist,
read-only paste behavior, broken-state ERROR rendering, and duplicate
warning chip. Most of those mechanisms are already general-purpose
features of the DataTable (read-only paste, header context menu, etc.).
Promoting `record_id` to a normal field deletes the special cases.

## P2. Current State Research

### P2.1 What's already built

The repo is further along than a naive read of plan-30 would suggest:

- **Type taxonomy.** `FieldType = "text" | "number" | "single_select" | "computed" | "attachment" | "argb_color"` is the *renderer* taxonomy. `CustomFieldType = "short_text" | "long_text" | "number" | "url" | "single_select" | "formula"` is the *user-authorable* taxonomy. `useTableSchema` maps custom → renderer (e.g. `formula → computed`). `attachment` and `argb_color` are renderer-only — not user-authorable, and not subject to the user-driven type-change pipeline (see P4.5 + P5.5).
- **Custom field schema mutations** (`WriteOp.schemaMutation` with `variant: "typed"`) carry add/rename/delete/duplicate/changeType/setDescription/setFormula through one backend endpoint (`/custom-fields:mutate`). Optimistic concurrency via `expectedSchemaFingerprint`; dependent cell writes ride in the same op (one undo entry).
- **`FieldConfigModal`** is fully built and operates on a single `FieldDef`. It composes sections: `FieldConfigSectionTypeChange`, `FieldConfigSectionOptions`, `FieldConfigSectionNumber`, `FieldConfigSectionFormula`. The modal *currently* short-circuits when `read_only_schema: true` — the change we want is to keep the modal open and disable specific inputs based on the lock list.
- **Type conversion matrix** (`lib/typeConversionMatrix.ts` + backend `schema_mutations.py::CONVERSION_MATRIX`) defines convertibility between pairs of *non-formula* `CustomFieldType`s with a policy: `"lossless" | "lossy" | "create_options" | "substitute_labels"`. Frontend `coerceCustomFieldType.computeLocalPreflight` runs the per-row preflight; the modal surfaces the count of rows that would lose data. **The matrix does not currently cover any conversion to or from `"formula"`** — that's new responsibility this PRD adds (see §P4.5).
- **Formula engine** (`lib/formula/`) is operational end-to-end for custom formula fields: tokenizer, parser, AST, evaluator, resolver, error types, depth / node-count / dependency / fuse / source / output limits, mirrored Python implementation on the backend. The engine itself doesn't need new work; what's new is exposing it on built-in `record_id` fields (see §P4.6).
- **Identifier column** (`lib/identifier/resolve.ts`) implements plan-30's `kind: "field"` + `kind: "computed"` split, the synthetic `__record_id__` column, the duplicate warning chip, and the broken-field ERROR state. This whole module retires in Phase 2.
- **TableSchema fingerprint** stabilizes view-state across schema changes; persisted ViewState records carry the fingerprint and only write back under a matching one.

### P2.2 What's not yet generalized

- `useTableSchema` stamps `read_only_schema: true` on every core field unconditionally. There's no per-attribute lock signal.
- Built-in field configs live entirely in feature code (`coreFieldDefs` passed to `useTableSchema` — for Rooms, declared as `roomsTableFieldDefs` in feature land plus inline column defs in `RoomsTable.tsx`). They don't round-trip through the document JSON.
- Backend row models (`RoomRow`, `PumpRow`) are statically-typed Pydantic models (`number: str`, `num_people: int`). They don't accommodate user-changed field types on built-in fields.
- The `record_id` slot doesn't exist as a stored field. The pinned column is either a promoted core column (Pumps' `tag`) or a synthesized one (Rooms' computed).
- The header trigger for the field-config modal is the **header context menu** ("Edit field" or similar), not double-click. (User's intent in this PRD is to also support double-click.)
- The conversion matrix has no `formula` entries (P4.5).
- `CustomFieldCapability` in `backend/features/project_document/tables/contracts.py` carries `core_field_keys`, `core_display_names`, `required_core_select_fields`, `core_field_value_for_formula`, and `core_field_type_for_formula`. Under the new model the "core" prefix becomes meaningless — these fields name the unified registry, not a sub-class.

### P2.3 Backend dynamic-typing reshape

Built-in fields with `"field_type"` locked stay as today (typed Pydantic
columns on the row model). Built-in fields whose `field_type` is
user-mutable **move out of the typed `RoomRow`/`PumpRow` columns and
into the generic `custom_values: dict[str, CustomValue]` bag that
custom fields already use.** The bag is field-keyed; built-in fields
use their stable `field_key` (`"number"`, `"name"`, …) where custom
fields use `cf_*`. The Pydantic row model keeps only locked-type fields
as typed columns (e.g. `id: str`, `catalog_origin`,
`erv_unit_ids`).

Consequences the implementation has to handle (see also §P0.1):

1. **Domain validators don't ride along.** A `ge=0` validator on
   `num_people: int` doesn't translate into `custom_values["num_people"]
   = -3`. The lock list is the only thing protecting domain invariants
   on mutable-type fields. Per-field choices in §P5 reflect this: any
   field with a hard PH-domain invariant (e.g. `icfa_factor` ∈ [0, 1])
   locks `"field_type"`.

2. **`validate_document_references` cross-row checks consult the
   FieldDef list, not row attributes.** The current Rooms validator
   walks `room.floor_level` to confirm it references an existing floor
   option. After the reshape, the validator iterates the persisted
   FieldDef list, learns which fields are single-selects with which
   namespace, then reads from typed columns or `custom_values` based
   on where each field's value lives now.

3. **`catalog_origin` semantics survive at the row level**, not the
   field level. Catalog-sourced values land in typed columns (for
   locked-type fields like materials' `u_value_w_m2k`) and never in
   user-mutable type columns. **Mutable-type built-ins do not carry
   catalog provenance.** Project-side catalog refresh (US-WIN-11) is
   only meaningful for locked-type fields. See §P5.3 and §D1.

4. **`CustomFieldCapability` becomes a per-table FieldDef registry.**
   `core_field_keys` → `field_keys` (canonical order). `core_display_names`
   moves out entirely (display names now live on persisted FieldDefs).
   `required_core_select_fields` → `required_field_keys` (still a
   feature-author-declared whitelist). `core_field_value_for_formula`
   becomes `field_value_for_formula` and reads from the appropriate
   typed column or `custom_values` slot based on the FieldDef's
   `field_type` lock state.

5. **JSON Schema regression is accepted.** Mutable-type built-in
   fields are no longer typed as `integer >= 0` etc. in the published
   schema; they advertise the union `CustomValue = str | int | float
   | bool | None`. PRD §10 (LLM-friendliness) trade-off is documented
   here and in the data-model.md update Phase 1b ships.

6. **Downstream PHX / honeybee_ph consumers are forward-looking.** No
   V2 PHX export code exists today; that integration lives in future
   work. The contract those consumers should rely on is **the
   persisted FieldDef list + the stable `field_key` namespace**, not
   the Pydantic row shape. The reshape forces that contract to be
   true today rather than only after a future surprise.

## P3. Design Principles

1. **One configuration model.** A `FieldDef` carries everything the
   renderer + editor + formula resolver + clipboard pipeline needs.
   Built-in vs custom is a *configuration* difference (locked attributes,
   deletable flag), not a *type* difference.
2. **Locks are opt-in.** Default behavior: every attribute is editable
   by the user. Locks are declared explicitly in feature code, per
   built-in field. Forgetting to lock something is recoverable
   (re-lock + ship; existing edits survive per Q13).
3. **Stored values win for *attribute values*. Feature code wins for
   *lock lists*.** Once a project document is written, the stored
   field configs are the source of truth for `display_name`,
   `field_type`, `config`, `description`, `formula_source`. The
   `locked` array is **not persisted** — it's derived at load time
   from the feature seed. This resolves the previously contradictory
   "never overwrites" vs "forward-looking locks" rules.
4. **Forward-looking locks.** A developer tightening the lock list
   later does **not** retroactively revert user customizations. The
   user's persisted attribute values survive; the tighter lock takes
   effect for *future* edits (because locks are derived at load,
   today's lock list is always today's lock list). Loosening the lock
   list lets users edit going forward.
5. **No hidden identifier slot.** The pinned column is a normal field
   with `field_key: "record_id"`. Pinning, header label, hide / reorder
   suppression, and duplicate-warning chip live on that field's
   FieldDef configuration, not on a parallel `IdentifierConfig` prop.
6. **Clean-rebuild migration posture.** No production data, no users,
   no deployed databases. Schema reshapes do not carry compatibility
   shims, dual-key reads, or rename scripts. Each phase that touches
   the wire shape bumps `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION`.

## P4. Architecture

### P4.1 Per-Attribute Lock Model

Add a single optional field to `FieldDef`:

```ts
type FieldDef = {
  // ... existing fields ...
  /**
   * Attributes the user cannot edit through the field-config modal or
   * header context menu. Default `[]` (fully editable). The renderer
   * and header menu check this list per attribute; locked attributes
   * appear disabled with a uniform tooltip ("Field Locked", per Q-F5).
   *
   * `locked` is layered onto the FieldDef at load time from the feature
   * seed. It is NOT persisted in the project document. The persisted
   * document carries only attribute values; lock lists evolve with code.
   *
   * Recognized lock keys:
   *   - "display_name"   — header rename forbidden
   *   - "field_type"     — type change forbidden
   *   - "options"        — single-select option list frozen
   *                        (rename / reorder / recolor / delete all blocked)
   *   - "default"        — default value frozen
   *   - "description"    — description rewrite forbidden
   *   - "formula"        — formula source frozen
   *   - "delete"         — field cannot be deleted (built-ins default)
   *   - "duplicate"      — field cannot be duplicated (built-ins default)
   */
  locked?: ReadonlyArray<FieldLockKey>;
};

type FieldLockKey =
  | "display_name"
  | "field_type"
  | "options"
  | "default"
  | "description"
  | "formula"
  | "delete"
  | "duplicate";
```

**Implicit / structural locks:**

- `field_key` is *always* immutable. There is no lock key for it
  because there is no UI to edit it. Renames change `display_name`,
  never `field_key`.
- Attachment FieldDefs (renderer type `"attachment"`) are not
  user-authorable. They behave as if every lock key is set — the modal
  still opens but every section is disabled. Implementation note: the
  caller passes `locked: ["display_name", "field_type", "options",
  "default", "description", "formula", "delete", "duplicate"]` on
  attachment seeds, and the modal renders accordingly. See P5.5.
- `argb_color` follows the same rule as attachment until it becomes
  user-authorable.

**`read_only` vs `read_only_schema`:** these are different concerns
and `plan-31` deletes only the second. `FieldDef.read_only` continues
to mean "cell value is read-only" (e.g. `erv_unit_ids` until linked-
records ship; computed formula columns). `read_only_schema` was
"schema-mutation menu items hidden" and is fully replaced by the
lock list.

**Header context menu and modal behavior:**

- Each menu item / modal section consults the lock list. Locked
  entries render disabled with the uniform tooltip ("Field Locked").
- For locked single-select fields with `"options"` locked, the options
  section renders read-only — the user sees the list but cannot
  rename / reorder / recolor / delete options.

### P4.2 Unified Field Persistence

The project document stores all field configs in a per-table array
that supersedes the current `custom_fields` array.

```python
class TableFieldDef(BaseModel):
    """
    Per-table field config. Replaces the existing `custom_fields` list
    on each table and adds entries for every built-in field.
    """
    field_key: str                    # stable id: built-in key or cf_*
                                      # — identity; never renamed
    display_name: str                 # user-edited per project (unless locked)
    field_type: CustomFieldType       # user-edited within conversion matrix
    config: dict                      # per-type config (options, precision,
                                      # formula source/ast/deps, ...)
    description: str | None = None
    default: object | None = None     # seed default; coerced into rows on
                                      # first save and on built-in field
                                      # additions (P4.2.3)
    origin: Literal["built_in", "custom"] = "custom"
    created_at: datetime
    created_by: str | None = None
```

Notes:

- The existing `CustomFieldDef` evolves into `TableFieldDef`. The model
  drops the advisory `field_key` slug on custom fields — for both
  built-ins and customs, `field_key` is the identity carrier
  (matching the existing frontend convention). For built-ins,
  `field_key` is the stable code-declared key (`"number"`,
  `"record_id"`, …). For customs it remains the `cf_*` ULID-style id.
  The frontend `FieldDef.field_key` continues to be the wire shape for
  identity — no rename to `id` is introduced.
- `locked` is **not** persisted. The frontend's `useTableSchema` (or
  its replacement) layers the seed-declared lock list onto each loaded
  FieldDef at render time. Backend services that need lock-awareness
  consult the per-table registry (e.g. `rooms_custom_fields` capability
  + its successor) at request time.
- `origin` is persisted so feature code can find "the built-in entry
  for `field_key='number'`" when seeding / upgrading without having to
  re-match by key.
- The fingerprint algorithm (`computeTableSchemaFingerprint`) includes
  every entry (built-in + custom), keyed by `field_key` and `field_type`,
  ordered by the seed order then by creation order for custom fields.
  View-state persistence is unchanged except that the fingerprint now
  also moves when a user changes a built-in field's type.
- Row values for fields with mutable types move into the generic
  `custom_values` bag. Row values for fields with `"field_type"` in
  the seed's `locked` list stay as typed Pydantic columns on the row.

**Row model changes (Phase 1b):** see §P5 for which fields stay typed.
The row model's `custom` dict is renamed conceptually to
`custom_values` and now holds both built-in mutable-type values and
custom-field values, keyed uniformly by `field_key`.

#### P4.2.1 Seeding rules (new project)

On first save of a new project, the feature code's seed FieldDef list
is written into the document verbatim (with `origin: "built_in"`).
Default values populate each row by running each FieldDef's `default`
through `coerce_custom_value` for its declared type.

#### P4.2.2 Seeding rules (existing project + tightened/loosened lock list)

- **Lock tightened in feature code.** No persisted-data change. On
  next load, the user sees previously-editable inputs disabled. The
  user's prior customizations survive.
- **Lock loosened in feature code.** No persisted-data change. On next
  load, the user sees previously-disabled inputs enabled.
- **Built-in field removed from feature code.** Log a warning and
  drop the FieldDef from the document on the next document save under
  an explicit schema-version bump (no silent inject-on-load). Stored
  values for that field stop being read by the renderer.
- **Display name override on a built-in field's seed default.** The
  user's persisted `display_name` survives — feature code changes to
  the seed default do not retroactively overwrite project data.

#### P4.2.3 Seeding rules (existing project + new built-in field)

When a feature ships with a new built-in FieldDef, an explicit upgrade
step runs at the service layer (not at load time): bump
`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION`, write an upgrade function
that injects the new FieldDef into the per-table registry, coerces its
`default` into each existing row, validates the resulting document, and
runs through the normal save path. Document load itself does **not**
mutate documents — the upgrade is a controlled write with the same
guarantees as any other Save (etag, audit log, structured errors).

### P4.3 Record-ID As A Real Field

**Delete:** the `IdentifierConfig<TRow>` prop and `IDENTIFIER_COLUMN_ID`
constant. Delete: the synthetic-column branch in
`lib/identifier/resolve.ts`. Delete: the view-state whitelisting for
`__record_id__`. Delete: `IDENTIFIER_HEADER_LABEL` (the header label
now lives on each table's `record_id` FieldDef as `display_name`).

**Replace with:** every table has a FieldDef whose `field_key` is
exactly `"record_id"`. **The field_key itself is the identifier
signal** — no separate `is_record_id` boolean is needed. `"record_id"`
becomes a *reserved* field_key:

- Exactly one FieldDef per table must have `field_key: "record_id"`.
  Zero or many is a backend validation error on document write.
- A module-load assertion in every table contract (similar to
  `_missing_formula_type_keys` in `tables/rooms.py`) verifies the seed
  has a `record_id` entry. This catches "developer added a new table
  and forgot record_id" at import time, not at first user save.
- No custom field may use `"record_id"` as its `field_key`. The
  custom-field ULID generator already produces `cf_*` ids (no
  collision risk in normal flow), and an explicit guard rejects
  pathological MCP / hand-edited payloads with `field_key: "record_id"`
  on a custom field. This guard ships in Phase 1a (before `record_id`
  has any semantic meaning) to lock the namespace early.
- The renderer pins whichever FieldDef has `field_key === "record_id"`
  to slot 0, regardless of `view.columnOrder`.

**Header label is per-feature, not universal.** The header label is
just the `display_name` on each table's `record_id` FieldDef. Pumps
ships `display_name: "Tag"` (locked) — the term carries domain meaning
(drawing schedules, submittal package indexes), and replacing it with
a generic "Record-ID" would be a semantic loss. Rooms ships
`display_name: "Record-ID"` (locked) by default.

**For Rooms,** the seed `record_id` FieldDef is:

```ts
{
  field_key: "record_id",
  display_name: "Record-ID",
  field_type: "computed",       // renderer type — derives from custom_field_type
  custom_field_type: "formula",
  formula_config: { source: "{Number} — {Name}", ast: …, deps: [...], result_type: "text" },
  locked: ["display_name", "delete", "duplicate"],
  description: "Computed identifier. Defaults to {Number} — {Name}; edit the formula or change the type to enter values directly.",
}
```

**For Pumps,** the seed `record_id` FieldDef is a plain text field —
no formula — and replaces the old `tag` field entirely:

```ts
{
  field_key: "record_id",
  display_name: "Tag",
  field_type: "text",
  custom_field_type: "short_text",
  locked: ["display_name", "delete", "duplicate"],
  description: "Drawing-schedule tag (was: Tag).",
}
```

**Universal Record-ID rules** (apply to the FieldDef with
`field_key: "record_id"`):

- Pinned to slot 0; cannot be reordered out of position.
- Cannot be hidden.
- Cannot be deleted or duplicated (enforced by the conventional lock
  list above; the `"record_id"` field_key does not by itself enforce
  these — feature code is responsible for including `"delete"` and
  `"duplicate"` in the lock list).
- `display_name` is locked by convention to the per-feature label
  (e.g. "Tag" for Pumps, "Record-ID" for Rooms). Feature authors can
  drop `"display_name"` from the locked array if they want users to
  rename the identifier column themselves; the renderer pins by
  `field_key`, never by display name.
- Duplicate-value warning chip applies to the field's value across
  all rows in the table (already implemented by
  `computeIdentifierDuplicates` in `lib/identifier/resolve.ts`; that
  helper is the one piece of `resolve.ts` Phase 2 keeps, retargeted
  at "any field with `field_key === 'record_id'`").
- The field's value is read-only when `custom_field_type === "formula"`
  (the computed value is what the user sees; cell edits go to the
  formula source via the field config modal, not into the cell).
- Cell edits are allowed when `custom_field_type !== "formula"`
  (user types directly into the Record-ID cell).
- Type change from `formula → short_text` (or `→ number`) snapshots
  the computed value per row into the row's stored `custom_values`
  bag, drops the formula, and from then on the cell is directly
  editable. (Standard conversion-matrix behavior; see §P4.5.)

### P4.4 Customize-Field Modal Extension

The existing `FieldConfigModal` already accepts a single `FieldDef`.
The extension:

1. **Remove the `read_only_schema` short-circuit** in the consumers
   that open the modal. Allow built-in fields to open the modal.
2. **Wire each modal section to the lock list.** Each section
   (`FieldConfigSectionTypeChange`, `FieldConfigSectionOptions`,
   `FieldConfigSectionFormula`, etc.) reads the relevant lock keys and
   disables its inputs accordingly. Locked sections render with a
   muted heading and the uniform tooltip "Field Locked" (Q-F5).
3. **`display_name` input** disables when `"display_name"` is locked.
4. **Type picker** disables when `"field_type"` is locked. Attachment
   fields are not selectable in the picker (P5.5).
5. **Delete button** hides when `"delete"` is locked (always true for
   built-ins).
6. **Duplicate button** hides when `"duplicate"` is locked (always
   true for built-ins by default — see §B-decisions / Q-F8).
7. **Formula section** disables editing when `"formula"` is locked.
   The formula preview / dep list / palette still render — locking
   formula doesn't hide it; it freezes it.
8. **Header trigger.** Both right-click → "Edit field" (current) and
   double-click on the header (new) open the modal. The double-click
   is on the header cell, not the resize handle (which already
   double-clicks to fit-to-content).

The modal does not need new sections for built-ins; the existing
sections cover every attribute that can be unlocked.

**R-S2 (external-edit) behavior under lock changes.** If a redeploy
changes the seed lock list mid-edit (developer ships a new build
while the user has the modal open), the next render re-derives the
lock list from the new seed and disables / enables inputs
accordingly. The user's in-flight draft text is preserved; the user
sees the input disable but their typed value survives. This is a
test in Phase 3.

### P4.5 Type Conversion Matrix

The current matrix (`lib/typeConversionMatrix.ts` + backend mirror)
covers the four primitive `CustomFieldType`s (`short_text`,
`long_text`, `number`, `url`) and `single_select`. **It does not
cover any conversion to or from `"formula"`.** This PRD adds those
entries — that is **new logic, not a re-use** of the existing matrix:

| From            | To `formula`                       | From `formula` to text/number             |
|-----------------|------------------------------------|-------------------------------------------|
| `short_text`    | user authors a new formula source from scratch; previous row values are discarded (replaced by the computed value) | snapshot the computed value as text |
| `long_text`     | same                               | same                                       |
| `number`        | same                               | snapshot as number (parse the result string; null on parse failure) |
| `url`           | same                               | snapshot as text                           |
| `single_select` | same                               | snapshot the *label* of the resulting option (substitute_labels) |
| `formula`       | n/a (already formula)              | (covered above)                            |

The "→ formula" conversion has no automatic data preservation — the
user is authoring a new computed expression, and the previously stored
column values are discarded (they're recomputed from the formula).
The preflight surfaces a count of non-empty rows that will be
replaced.

**Other matrix updates (existing behavior; documenting for clarity):**

- Apply to every field with `"field_type"` unlocked, not just custom
  fields. The same preflight, the same coerce-or-null behavior, the
  same per-row affected-count surface.
- When a built-in field with `"field_type"` locked appears as the
  source of a paste or fill that would require coercion, the
  existing per-cell coercion still runs (it doesn't require schema
  mutation). Type *changes* are blocked; type *coercion at value
  ingest* continues.
- **Silent on lossy conversion completion (per Q10).** The modal
  already shows the affected-count preflight; the conversion proceeds
  without an additional confirmation. Lossless conversions show
  nothing extra. *Optional polish, not part of this PRD's scope: a
  banner-style toast on lossy completion ("3 values were cleared").*
- **Audit log entries for built-in retypes.** The current `editFieldBundle`
  / `changeType` mutations audit with `project_version_custom_field_change_type`.
  Phase 1b renames these audit kinds to drop the `_custom_field_`
  namespace (e.g. `project_version_field_change_type`) so built-in
  retypes are logged uniformly. Per-row before/after values land
  in the action log payload (US-C1 dependency) for after-the-fact
  recovery.

### P4.6 Formula Evaluation

Already operational for custom formula fields. Two consequences for
this PRD:

1. **Built-in formula fields work out of the box.** Once a built-in
   field has `field_type: "computed"` + `custom_field_type: "formula"`
   + `formula_config.source`, the existing evaluator picks it up via
   the `useTableSchema` → `rows_computed` pipeline. No new engine work.
2. **Field-ref resolution.** Formulas reference fields by display
   name (e.g. `{Number}`) — the resolver maps display name → stable
   `field_key`. When a built-in's `display_name` is locked, refs stay
   stable across projects. When `display_name` is unlocked and the
   user renames "Number" to "Room Number," every formula that
   referenced `{Number}` rebuilds its source on next open — the
   existing custom-field rename behavior already does this; the only
   change is dropping the `origin: "core"` short-circuit in
   `buildRoomsFormulaRegistry` so built-in and custom fields go
   through the same code path.

## P5. Per-Table Specifications

### P5.0 Default lock policy for built-ins

Unless a per-field override is declared, every built-in FieldDef ships
with `locked: ["delete", "duplicate"]`. This means:

- Built-ins are never deletable or duplicatable through the UI.
- `display_name`, `field_type`, `options`, `default`, `description`,
  and `formula` are editable by default — the feature author opts in
  to additional locks per field.

Feature authors lock `"field_type"` on any field with hard PH-domain
invariants (range checks, option-list references, downstream consumer
contracts). Feature authors lock `"display_name"` on identifier
columns where the label is a domain term (Pumps' "Tag", catalog
columns' "Manufacturer" / "Brand").

### P5.1 Rooms (the worked example)

Seed FieldDef list (in feature code; persisted to document on first
save):

| field_key      | display_name | field_type        | custom_field_type | locked                                                                  | Why                                                                  |
|----------------|--------------|-------------------|-------------------|-------------------------------------------------------------------------|----------------------------------------------------------------------|
| `record_id`    | Record-ID    | computed          | formula           | `["display_name", "delete", "duplicate"]`                                | Pinned column; default formula                                       |
| `number`       | Number       | text              | short_text        | `["delete", "duplicate"]`                                                | Motivating retype-to-number case (M1); user can rename / retype      |
| `name`         | Name         | text              | short_text        | `["delete", "duplicate"]`                                                |                                                                      |
| `floor_level`  | Floor        | single_select     | single_select     | `["field_type", "delete", "duplicate"]`                                  | Option-list reference; retype would break `floor_level` ref          |
| `building_zone`| Zone         | single_select     | single_select     | `["field_type", "delete", "duplicate"]`                                  | Same                                                                 |
| `num_people`   | People       | number            | number            | `["delete", "duplicate"]`                                                | User-retypeable (per requirement); domain validator `ge=0` lost on retype to text — accepted |
| `num_bedrooms` | Bedrooms     | number            | number            | `["delete", "duplicate"]`                                                | Same                                                                 |
| `icfa_factor`  | iCFA         | number            | number            | `["field_type", "delete", "duplicate"]`                                  | Hard PH-domain invariant ∈ [0, 1]; locked to keep `ge=0, le=1.0`     |
| `erv_unit_ids` | ERVs         | (linked-record — out of scope; not in v1 FieldDef registry)              |                   |                                                                         |                                                                      |

`record_id`'s default formula source: `"{Number} — {Name}"`. The
existing `roomsFormulaRegistry` is no longer needed once `record_id` is
a real formula field (the generic formula resolver covers it).

Out of the table FieldDef registry (rendered in the detail modal,
never in the grid):

- `notes`: typed column on `RoomRow`, edited via detail modal.
- `catalog_origin`: provenance metadata; never a FieldDef.
- `erv_unit_ids`: linked-record, out of v1 scope.

After Phase 1b, `RoomRow` shrinks to:

```python
class RoomRow(BaseModel):
    id: str = Field(pattern=r"^rm_…")
    floor_level: str = Field(pattern=r"^opt_…")            # field_type-locked
    building_zone: str | None = Field(default=None, …)     # field_type-locked
    icfa_factor: float = Field(default=1.0, ge=0.0, le=1.0)  # field_type-locked
    erv_unit_ids: list[str] = Field(default_factory=list)   # out of registry
    catalog_origin: dict | None = None
    notes: str | None = Field(default=None, max_length=4000)
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)
    # number, name, num_people, num_bedrooms live in custom_values
```

### P5.2 Pumps

Seed FieldDef list:

| field_key      | display_name | field_type    | custom_field_type | locked                                                                  | Why                                                                  |
|----------------|--------------|---------------|-------------------|-------------------------------------------------------------------------|----------------------------------------------------------------------|
| `record_id`    | Tag          | text          | short_text        | `["display_name", "delete", "duplicate"]`                                | Replaces `tag` directly. Display name keeps domain term ("Tag")       |
| `device_type`  | Device       | single_select | single_select     | `["field_type", "delete", "duplicate"]`                                  | Option-list reference                                                |
| `use`          | Use          | text          | short_text        | `["delete", "duplicate"]`                                                |                                                                      |
| `manufacturer` | Manufacturer | text          | short_text        | `["delete", "duplicate"]`                                                |                                                                      |
| `model`        | Model        | text          | short_text        | `["delete", "duplicate"]`                                                |                                                                      |
| `volts`        | Volts        | number        | number            | `["delete", "duplicate"]`                                                |                                                                      |
| `phase`        | Phase        | number        | number            | `["field_type", "delete", "duplicate"]`                                  | `phase ∈ {1, 3}` invariant lives in row validator; locked            |
| `horse_power`  | Horse Power  | number        | number            | `["delete", "duplicate"]`                                                |                                                                      |
| `wattage`      | Wattage      | number        | number            | `["delete", "duplicate"]`                                                |                                                                      |
| `flow_gpm`     | Flow - GPM   | number        | number            | `["delete", "duplicate"]`                                                |                                                                      |
| `runtime_khr_yr` | Runtime - kHR/YEAR | number  | number            | `["delete", "duplicate"]`                                                |                                                                      |
| `link`         | Link         | text          | url               | `["delete", "duplicate"]`                                                |                                                                      |
| `notes`        | Notes        | text          | long_text         | `["delete", "duplicate"]`                                                |                                                                      |
| `datasheet`    | Datasheet    | attachment    | (n/a)             | `["display_name", "field_type", "options", "default", "description", "formula", "delete", "duplicate"]` | Attachment field; not user-authorable (P5.5) |

`tag` is removed from `PumpRow`. The frontend's `sortedPumps` fallback
`tag ?? use ?? id` migrates to `record_id ?? use ?? id`. The frontend
identifier resolution that current code points at `tag` (`PUMPS_IDENTIFIER:
{ kind: "field", field: "tag" }` in `PumpsTable.tsx`) is deleted with
the rest of `IdentifierConfig`.

Pumps' `PumpRow` after Phase 1b:

```python
class PumpRow(BaseModel):
    id: str = Field(pattern=r"^pmp_…")
    device_type: str | None = Field(default=None, pattern=r"^opt_…")   # field_type-locked
    phase: int | None = …                                              # field_type-locked
    link: str | None = …                                               # field_type-locked (URL validator on)
    notes: str | None = …
    datasheet_asset_ids: list[str] = Field(default_factory=list)       # attachment, not in registry value
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)
    # record_id (replacing tag), use, manufacturer, model, volts,
    # horse_power, wattage, flow_gpm, runtime_khr_yr live in custom_values
```

### P5.3 Catalogs (Materials / Glazing / Frame)

Same shape — but with substantially heavier `field_type` locking. Every
field that carries catalog-sourced data (`u_value_w_m2k`,
`g_value`, `manufacturer`, `brand`, `name`, etc.) locks `"field_type"`
to keep refresh-from-catalog (US-WIN-11) coherent: a project field
whose type changed cannot be diff'd against the catalog's typed row.

`name` becomes `record_id` with `display_name: "Name"` (per-feature;
"Name" is the domain term in the bookshelf-picker UX).

The catalog-uniqueness validators (currently still in place for catalog
`name`) are dropped here, with the bookshelf-picker UX adjustments
that plan-30 P4 noted as deferred. **Catalog rollout is downstream of
this PRD's Phase 1**; the catalog UX work happens together with the
catalog phase whenever that lands.

### P5.4 Window Types, Fans, ERVs, Thermal Bridges (later)

Same pattern as they come online. Each declares a `record_id` field
appropriate to the domain.

### P5.5 Attachment FieldDefs

Attachment is a `FieldType` but **not** a `CustomFieldType`. Per
`data-table.md`: *"No schema-mutation menu entries — `addField` /
`deleteField` / `changeType` / `setFormula` do not apply."*

Under the new lock-list model, attachment FieldDefs ship with every
lock key set:

```ts
locked: [
  "display_name", "field_type", "options", "default",
  "description", "formula", "delete", "duplicate",
]
```

The modal opens for attachment fields but every section renders
disabled. Type-picker excludes `"attachment"` (and `"argb_color"`)
from the conversion matrix — attachment cannot be converted to or
from any other type, and `field_type` is always locked on attachment
seeds.

The ## P6. High-Level Phasing

Each phase has its own implementation plan doc, written after this PRD
is accepted.

**Phase 1a — Lock model on FieldDef.** *(plan-31-phase-1a)*
- Introduce `locked: FieldLockKey[]` on `FieldDef` (frontend type +
  feature seeds).
- `useTableSchema` stops stamping `read_only_schema`; instead, the
  core seed declares its own `locked` arrays per field.
- Modal openers (`DataTable.tsx`, `ColumnHeaderMenu`, `GridHeader`,
  `HeaderContextMenu`) switch from `read_only_schema` checks to
  per-attribute lock-list checks. Built-in fields can now open
  `FieldConfigModal`; each section consults the lock list.
- Add header double-click trigger.
- Reserve `"record_id"` field_key namespace: backend guard rejects
  custom-field writes with `field_key: "record_id"` even though the
  reserved field doesn't exist yet (catches the foot-gun before
  Phase 2 ships).
- Delete `FieldDef.read_only_schema` and every reference to it
  (DataTable, ColumnHeaderMenu, GridHeader, HeaderContextMenu,
  AttachmentRowsTable, EquipmentPage, lib.ts, roomsFormulaRegistry,
  tests).
- **No wire-format change.** Built-in FieldDefs still live in feature
  code only. Custom fields still go through the existing
  `CustomFieldDef` path. The user-visible behavior changes only in
  that, under the right lock list, built-in fields can be renamed /
  formula-edited / option-edited / described directly from the
  modal.
- Tests: lock-list-driven input disabling on every section; double-
  click trigger; redeploy mid-edit retains user's draft text;
  `record_id` slug guard rejects offending writes.

**Phase 1b — Persistence reshape backbone.** *(plan-31-phase-1b)*

*Note (2026-05-26): Phase 1b was split into two passes during
implementation. Phase 1b landed the canonical v3 backbone (type
shapes, row reshape, envelope rename, schema_version=3, audit-log
kind renames, doc updates). The mechanical follow-on work —
cascade rename through every caller, fixture rewrites, frontend
reshape, transitional-alias removal — moved to
`plan-31-phase-1c-rename-cascade-and-fixtures.md`. Items below
describe the full Phase 1b scope; the 1b/1c split is execution-
level, not architectural.*
- Migrate `CustomFieldDef` → `TableFieldDef`; drop the advisory
  `field_key` slug on custom fields (identity is `field_key` for both
  built-in and custom).
- Persist built-in FieldDef entries in the document under the same
  per-table array.
- Backend `RoomRow` / `PumpRow` shed their mutable-type columns into
  the unified `custom_values` bag (was `custom`). Locked-type
  built-ins (`floor_level`, `building_zone`, `icfa_factor`,
  `device_type`, `phase`, `link`, etc.) stay as typed Pydantic
  columns.
- Update the schema fingerprint to include built-in entries.
- `CustomFieldCapability` renames: `core_field_keys` → `field_keys`;
  drop `core_display_names`; `required_core_select_fields` →
  `required_field_keys`; `core_field_value_for_formula` →
  `field_value_for_formula` (and reads through both typed columns and
  `custom_values`).
- Audit-log kinds drop the `_custom_field_` namespace
  (`project_version_field_change_type`, etc.) so built-in mutations
  log uniformly.
- Update `validate_document_references` to walk the persisted
  FieldDef list rather than hard-coded constants (`ROOMS_CORE_DISPLAY_NAMES`,
  `ROOMS_CORE_FORMULA_TYPES` become trivial pass-throughs or are
  removed).
- Bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` from 2 to 3. No
  back-compat reader for v2 (per P3.6).
- Update `context/technical-requirements/data-model.md` §6.6.1: the
  "Core fields stay strongly typed in the row model" rule is
  superseded; document the new mixed-storage rule and the JSON Schema
  trade-off.
- Tests: round-trip a project through save → load and confirm
  built-in field configs persist; lock-list precedence (derived at
  load, not persisted); fingerprint stability across rebuilds;
  catalog_origin behavior on locked-type fields only; explicit
  upgrade step for built-in field additions (no silent inject-on-load).

**Phase 2 — `record_id` as a real field.** *(plan-31-phase-2)*
- Reserve `"record_id"` as a special field_key with full enforcement
  (Phase 1a shipped the guard; Phase 2 shipped the semantics).
- Add `record_id` to Rooms and Pumps seeds. Replace Pumps' `tag` with
  `record_id` end-to-end (incl. `sortedPumps` fallback, every
  `pump.tag` reader in `applyWriteToPump`, the JSON download shape).
- Delete `IdentifierConfig<TRow>`, `IDENTIFIER_COLUMN_ID`,
  `IDENTIFIER_HEADER_LABEL`, the synthetic-column branch in
  `lib/identifier/resolve.ts`, and the view-state whitelist for
  `__record_id__`. Replace with renderer logic that pins the FieldDef
  whose `field_key === "record_id"` to slot 0.
- Backend validates "exactly one field with `field_key === 'record_id'`"
  per table on document write; module-load assertion catches missing
  seeds at import time.
- Migrate the duplicate-warning chip from "identifier resolution" to
  "any field with `field_key === 'record_id'`." Keep
  `computeIdentifierDuplicates` / `describeDuplicateRows` — those
  helpers are reused; the rest of `resolve.ts` retires.
- Wire the Rooms `record_id` formula through the existing formula
  evaluator (delete `roomsFormulaRegistry`; drop the `origin: "core"`
  short-circuit in `buildRoomsFormulaRegistry`).
- Tests: identifier rendering, hide/reorder suppression, duplicate
  chip on direct text record_id (Pumps) and on formula record_id
  (Rooms), backend rejection of zero or many `record_id` fields,
  module-load assertion in every contract.

**Phase 3 — Built-in field type changes.** *(plan-31-phase-3)*
- Allow `field_type` change on unlocked built-in fields. Run the
  existing conversion matrix and preflight.
- Extend the conversion matrix (frontend + backend) to cover
  `formula` as source and target — new logic (§P4.5 table).
- Allow `formula` editing on the Record-ID field (and any other
  built-in field whose `"formula"` lock is absent).
- Catalog-origin awareness: built-in fields with `"field_type"`
  unlocked do not accept catalog-sourced values (refresh-from-catalog
  silently skips those columns; see §D1).
- Tests: type change on a built-in field round-trips through the
  conversion matrix; formula edit on Record-ID updates the rendered
  identifier; locked-attribute tooltip; catalog refresh skips
  unlocked-type fields cleanly; audit-log entries include per-row
  before/after for retypes.

**Phase 4 — Per-table seeding for remaining tables.** *(plan-31-phase-4)*
- Author seed FieldDef lists for the remaining project-document tables
  (Fans, ERVs, Thermal Bridges, Windows / Window Types) as they come
  online. Each declares `record_id`.
- Catalog tables (Materials / Glazing / Frame) coordinate with the
  catalog rollout — `field_type` mostly locked across the board so
  refresh-from-catalog stays coherent. The seed shape is the same.

**Phase 5 — Polish & follow-ups.** *(plan-31-phase-5; optional)*
- Optional: lossy-conversion completion toast.
- Optional: visual treatment of locked attributes (subtle muted icon
  in the modal section heading).
- Optional: lock-list documentation in the field config modal's
  description tooltip.
- Optional: "Duplicate record" right-click context-menu action
  (the plan-30 deferred follow-up). Independent of this PRD but a
  natural fit alongside Phase 3's modal work.

## P7. Out Of Scope

- **Building a new formula engine.** It already exists.
- **Extending the conversion matrix.** Adding `formula` to the matrix
  is in scope (§P4.5) — that's new logic, not a separate engine.
- **Renaming all built-in fields.** `display_name` is unlocked by
  default but feature authors lock it on identifier columns where the
  label is domain-meaningful (Pumps' "Tag", catalog "Name", etc.).
- **Catalog uniqueness relaxation.** That rides with the catalog
  rollout — bookshelf-picker UX and `catalog_origin` provenance need
  coordinated changes.
- **User-configurable lock lists.** Locks are author-controlled in
  feature code. A future plan could expose lock authoring to
  end-users, but that is well outside this PRD.
- **Dynamic per-document Pydantic row models.** The recommendation in
  P2.3 is to use the existing generic `custom_values` bag for fields
  with mutable types. A future plan could replace the typed row
  Pydantic models entirely with dynamic ones; not in scope here.
- **`erv_unit_ids` / linked-record fields.** Excluded from Rooms'
  seed list in P5.1. Linked-record support is a separate track
  (see `data-table.md` Deferred list).
- **Data-table user-story rewrites.** This PRD is the technical
  contract change; user-facing stories (`context/user-stories/...`)
  get a follow-up pass once Phase 1–3 land.
- **Migrations of any kind.** No production data exists. Rebuilds
  are clean.
- **Restoring lost domain validators automatically.** A user who
  retypes `num_people` from `number` to `text` permanently loses the
  `ge=0` invariant on that field. Re-locking the field later does not
  retroactively re-validate stored values. Acceptable in dev-only world.

## P8. Open Questions

Each item has a recommended default in bold. Resolved items are
marked ✅ with the decision recorded; unresolved items still need
a confirmed answer before the relevant phase starts.

**Q-F1 — Expose formula editing on built-in `record_id` in Phase 3,
or defer?**
✅ **Resolved: expose from day one (Phase 3).** The formula engine is
operational; built-in formula authoring lights up alongside the
modal extension.

**Q-F2 — Identifier-field enforcement model.**
✅ **Resolved: the field_key `"record_id"` is the signal.** No
separate `is_record_id` boolean. Exactly one FieldDef per table
must have `field_key === "record_id"`; the backend rejects
documents with zero or many on write; a module-load assertion catches
missing seeds at import time (Phase 2).

**Q-F3 — `record_id` formula default for Pumps.**
✅ **Resolved: leave blank, `field_type: "text"` /
`custom_field_type: "short_text"`.** No formula seed. User types
identifiers directly. Display name is `"Tag"`, not `"Record-ID"`
(keeps domain term).

**Q-F4 — Modal trigger consolidation.**
✅ **Resolved: keep both.** Right-click context-menu "Edit field"
and header double-click both open the same FieldConfigModal.

**Q-F5 — Per-attribute lock tooltip wording.**
✅ **Resolved: generic `"Field Locked"` string only.** No per-field
override slot on FieldDef. Uniform tooltip on every locked input.

**Q-F6 — Backend storage migration timing.**
✅ **Resolved: one-pass rewrite (Phase 1b).** Bump
`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` to 3 and treat the new
shape as v3. No backward-compat reader for v2. If the dev DB ends
up incoherent during the cutover, rebuild from scratch — no
existing data is worth preserving.

**Q-F7 — Lock semantics for `"delete"` on built-ins.**
✅ **Resolved: explicit.** Every built-in seed lists `"delete"` in
its `locked` array. The lock-list-check pattern is uniform across
built-in and custom fields; reading a FieldDef tells you exactly
what's blocked. No implicit "built-ins are undeletable" rule.

**Q-F8 — Lock semantics for `"duplicate"` on built-ins.**
✅ **Resolved: explicit + locked by default.** Every built-in seed
lists `"duplicate"` in its `locked` array. Duplicating a built-in
field (especially a single-select with a project-namespaced option
list) has undefined semantics; locking sidesteps the problem until
a feature author has a concrete need. (The `DuplicateFieldMutation`
backend path stays custom-fields-only.)

**Q-F9 — Persistence of `locked` arrays.**
✅ **Resolved: not persisted.** Locks are derived at load time from
the feature seed. Tightening / loosening locks in code takes effect
on next load; persisted attribute *values* survive lock changes. This
resolves the "never overwrites" vs "forward-looking locks" contradiction
in the earlier draft.

**Q-F10 — Identity carrier on `TableFieldDef`.**
✅ **Resolved: `field_key`.** Both built-in (`"number"`) and custom
(`cf_*`) fields use `field_key` as the identity slot. The previously-
advisory custom-field `field_key` slug drops out of the model. No
rename to `id` is introduced.

**Q-F11 — `display_name` on `record_id` — universal "Record-ID" or
per-feature?**
✅ **Resolved: per-feature.** Pumps ships `display_name: "Tag"`
(locked). Rooms ships `display_name: "Record-ID"` (locked). Pinning
is by `field_key === "record_id"`, not by display name, so the header
label is free to carry domain meaning.

**Q-F12 — Default-value flow on built-in field additions.**
✅ **Resolved: explicit schema-version-bump upgrade step.** No
silent inject-on-load. Adding a built-in field to a table requires a
service-layer upgrade function: bump
`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION`, inject the FieldDef into
the per-table registry, coerce its `default` through
`coerce_custom_value`, validate the resulting document, and run
through the normal save pipeline.

**Q-F13 — Domain validators on retyped built-ins.**
✅ **Resolved: not preserved.** `num_people: ge=0` and similar
domain constraints live only on typed Pydantic columns. Once a
field's `"field_type"` is unlocked and the user retypes, the
constraint is lost. Re-locking later does not re-apply the
constraint to stored values. Feature authors must lock
`"field_type"` on any field where the constraint is non-negotiable
(e.g. `icfa_factor`, `phase`).

## P9. References

Code:

- `frontend/src/shared/ui/data-table/types.ts` — FieldDef shape;
  `IdentifierConfig<TRow>` (to delete); `IDENTIFIER_COLUMN_ID`
  (to delete); `IDENTIFIER_HEADER_LABEL` (to delete).
- `frontend/src/shared/ui/data-table/hooks/useTableSchema.ts` —
  core+custom merge; `read_only_schema` stamping (to remove); schema
  fingerprint algorithm.
- `frontend/src/shared/ui/data-table/lib/identifier/resolve.ts` —
  identifier resolution (mostly to delete in Phase 2;
  `computeIdentifierDuplicates` + `describeDuplicateRows` are reused).
- `frontend/src/shared/ui/data-table/lib/typeConversionMatrix.ts` —
  conversion matrix (extend to cover `formula` source/target in
  Phase 3).
- `frontend/src/shared/ui/data-table/lib/coerceCustomFieldType.ts` —
  preflight (apply to built-ins as well in Phase 3).
- `frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx`
  — modal entry point; lock-list wiring lives here and in its child
  sections (Phase 1a).
- `frontend/src/shared/ui/data-table/lib/formula/` — formula engine
  (already operational).
- `frontend/src/features/equipment/components/RoomsTable.tsx` —
  Rooms feature; replace `ROOMS_IDENTIFIER` with seed `record_id` FieldDef.
- `frontend/src/features/equipment/components/PumpsTable.tsx` —
  Pumps feature; replace `PUMPS_IDENTIFIER` / `pump.tag` with
  `record_id`. `sortedPumps` fallback migrates `tag ?? use ?? id` →
  `record_id ?? use ?? id`.
- `frontend/src/features/equipment/lib.ts` — `validatePumpsPayload`,
  `applyWriteToPump`, `pumpsTableFieldDefs` rewrites for the
  attachment / record_id changes.
- `frontend/src/features/equipment/lib/roomsFormulaRegistry.ts` —
  becomes redundant once `record_id` is a real formula field (the
  `origin: "core"` short-circuit drops out).
- `backend/features/project_document/document.py` — `RoomRow`,
  `PumpRow`, `ProjectDocumentV1` shape; bump schema version to v3
  (Phase 1b). `ROOMS_CORE_DISPLAY_NAMES` (to remove).
- `backend/features/project_document/custom_fields.py` —
  `CustomFieldDef` evolves into `TableFieldDef`.
- `backend/features/project_document/schema_mutations.py` —
  validators for built-in fields' user edits (mostly reuses existing
  custom-field paths; audit-kind map renames).
- `backend/features/project_document/mutations/models.py` —
  `CONVERSION_MATRIX` extended for `formula` in Phase 3.
- `backend/features/project_document/tables/contracts.py` —
  `CustomFieldCapability` reshape (`core_field_keys` → `field_keys`,
  etc.).
- `backend/features/project_document/tables/rooms.py` —
  `ROOMS_CORE_FORMULA_TYPES`, `_read_rooms_core_field_for_formula`,
  `_rooms_core_field_type_for_formula` either become trivial
  pass-throughs over the FieldDef list or are removed.

Plans / context:

- `docs/plans/2026-05-26/plan-30-datatable-identifier-column.md` —
  predecessor PRD this supersedes for the identifier-column
  abstraction.
- `docs/code-reviews/2026-05-26/plan-31-customizable-fields-prd-review.md`
  — independent review whose findings are folded into this revision.
- `context/PRD.md §10` — LLM-friendliness; this PRD documents an
  accepted JSON Schema regression on mutable-type built-in fields.
- `context/PRD.md §11.3` — product-level data-table scope.
- `context/UI_UX.md §1.7` — table interaction model; will need a
  follow-up update once Phase 3 ships header double-click.
- `context/technical-requirements/data-table.md` — durable
  technical contract; will absorb the post-Phase-3 state.
- `context/technical-requirements/data-model.md §6.6` — needs an
  explicit update in Phase 1b: the "core fields stay strongly typed
  in the row model" rule is superseded.
- `context/user-stories/30-tables-equipment.md` — acceptance criteria
  for project tables; will need a follow-up pass.

## P10. Acceptance Criteria For This PRD

This PRD is locked when:

1. The per-attribute lock model and its keys (P4.1) are agreed —
   including the load-time derivation of `locked` (Q-F9).
2. The acknowledged-architectural-cost section (P0.1) is reviewed
   and the JSON Schema / validation / downstream consumer trade-offs
   are accepted.
3. The persistence model — full FieldDef list in the document JSON,
   built-in field values flowing through `custom_values` for mutable
   types (P4.2 + P2.3) — is agreed.
4. The `record_id` field replaces `IdentifierConfig` (P4.3) and the
   Rooms/Pumps seed shapes (P5.1 + P5.2) are agreed, including
   per-feature `display_name` on the identifier column (Q-F11).
5. The phasing in P6 is agreed (Phases 1a / 1b / 2 / 3 mandatory,
   4 + 5 optional / staged).
6. Q-F1 through Q-F13 each have a confirmed answer.

Once those are confirmed, the next step is to write
`plan-31-phase-1a-lock-model.md` — the detailed implementation plan
for Phase 1a — and proceed phase-by-phase from there.
