---
DATE: 2026-05-26
TIME: ~ ET
STATUS: REVIEW — independent reading of plan-31-customizable-fields-prd.md
        against the current codebase + context docs. Findings ordered by
        load-bearing severity. The PRD is largely coherent; the load-
        bearing concern is a hidden architectural cost in P2.3 / P4.2
        that is sold as a small migration but is in fact a reshape of
        the document wire format, the JSON Schema surface, the
        validation layer, and the downstream consumer contract.
AUTHOR: Claude (Opus 4.7)
REVIEWED: docs/plans/2026-05-26/plan-31-customizable-fields-prd.md
SCOPE: Plan-review only. No implementation work.
RELATED:
  - docs/plans/2026-05-26/plan-31-customizable-fields-prd.md
  - docs/plans/2026-05-26/plan-30-datatable-identifier-column.md
  - context/PRD.md
  - context/technical-requirements/data-model.md §6.6
  - context/technical-requirements/data-table.md
  - backend/features/project_document/document.py
  - backend/features/project_document/custom_fields.py
  - backend/features/project_document/tables/contracts.py
  - backend/features/project_document/tables/rooms.py
  - frontend/src/shared/ui/data-table/types.ts
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
  - frontend/src/shared/ui/data-table/lib/identifier/resolve.ts
  - frontend/src/shared/ui/data-table/lib/typeConversionMatrix.ts
---

# Plan 31 — Customizable Built-In Fields — Independent Plan Review

## Summary

The PRD reads well and the user-facing goal (one config modal for every
field, locks declared by feature authors, identifier as a normal field)
is a clean direction. The frontend pieces it leans on are real — formula
engine, conversion matrix, `FieldConfigModal`, schema-mutation pipeline
all exist and work today.

**The plan is not actually a small extension.** P2.3 and P4.2 quietly
re-shape the document wire format, the JSON Schema, and the Pydantic
typing contract — and treat that reshape as a footnote rather than the
load-bearing decision it actually is. The motivation (users want to
retype `Number` from text to number for project A) is thin, and the
architectural cost of supporting it is high. Most of the user-visible
value the PRD wants — locks on a per-attribute basis, formula authoring
on `record_id`, double-click-to-edit, etc. — does **not** require moving
built-in values into `custom_values`. There is a much smaller version of
this plan that captures ~80 % of the value at ~20 % of the architectural
risk; see §E "Simpler Alternative" below.

There are also several smaller plan-level errors (the conversion matrix
section contradicts itself, `field_key`'s role is muddled, attachment
fields aren't addressed, lock-list-precedence on author tightening
contradicts the "never overwrites" rule, several pieces of cleanup are
not listed). Detail below.

---

## A. Load-Bearing Architectural Concerns

### A1. Demoting built-in fields into `custom_values` is far larger than the PRD acknowledges

P2.3 closes with: *"Recommendation: promote mutable built-in fields into
the same `custom_values` bag. … This is the smallest change and matches
the existing storage model for custom values."* That sentence is doing
an enormous amount of work.

Concretely, with the Rooms seed in §P5.1, every built-in except
`record_id` has `locked: ["display_name", "delete"]` — i.e., **none of
them lock `"field_type"`.** Under the PRD's rule ("built-in fields whose
`field_type` is user-mutable must move out of the typed RoomRow columns
into `custom_values`"), that means Rooms goes from:

```py
class RoomRow(BaseModel):
    id: str
    number: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    floor_level: str = Field(pattern=r"^opt_…")
    building_zone: str | None = Field(default=None, pattern=r"^opt_…")
    num_people: int = Field(default=0, ge=0)
    num_bedrooms: int = Field(default=0, ge=0)
    icfa_factor: float = Field(default=1.0, ge=0.0, le=1.0)
    erv_unit_ids: list[str]
    catalog_origin: dict | None
    notes: str | None
    custom: dict[str, CustomValue]
```

down to essentially:

```py
class RoomRow(BaseModel):
    id: str
    catalog_origin: dict | None
    erv_unit_ids: list[str]
    notes: str | None
    custom: dict[str, CustomValue]   # holds number, name, floor_level,
                                      # building_zone, num_people,
                                      # num_bedrooms, icfa_factor
```

That is a near-total reshape of the project document for Rooms, not "a
small change." It cascades into:

- **Wire format.** `context/technical-requirements/data-model.md` §6.6.1
  spells out that core fields stay strongly typed in the row model
  ("Core fields stay strongly typed in the row model and are **never**
  listed in `custom_fields`."). The PRD silently inverts this rule.
  The data-model.md contract therefore needs an explicit rewrite, and
  the PRD does not list it in the "things to update" pile.
- **Validation.** `RoomRow.num_people: int = Field(ge=0)` and
  `icfa_factor: float = Field(ge=0.0, le=1.0)` are domain invariants,
  not display preferences. Moving them into `custom_values`
  (`CustomValue = str | int | float | bool | None`) drops the
  positivity / range constraints. `coerce_custom_value` for `number`
  only validates `isinstance(value, (int, float))` — it does not
  enforce `ge=0` or `le=1`. The plan does not explain how these
  invariants survive the move.
- **`validate_document_references` cross-row checks.** Today the
  validator walks `room.floor_level` directly to confirm the option
  exists in the room-floor option list. Once `floor_level` lives in
  `room.custom["floor_level"]`, the validator has to be rewritten to
  consult the FieldDef list to learn that `floor_level` is a
  single-select rooted at a particular namespaced option key. This is
  doable but **non-trivial** and not flagged.
- **`catalog_origin`.** Bookshelf-copy provenance is stamped on
  rooms / project_materials / etc. at pick time. If the field whose
  value was picked is now in `custom_values`, the catalog_origin
  block — and refresh-from-catalog (§7.4) — needs rewriting to consult
  the bag rather than typed columns. Not addressed.
- **`ROOMS_CORE_FORMULA_TYPES`** in
  `backend/features/project_document/tables/rooms.py` and
  `_read_rooms_core_field_for_formula` both index by attribute name
  on `RoomRow`. Under the new shape, these read `room.custom[field_id]`
  — but only if the field's `field_type` hasn't been retyped by the
  user, in which case the formula evaluator needs to know what the
  current type *is*. The whole "core vs custom" abstraction in
  `CustomFieldCapability` (`core_field_keys`, `core_display_names`,
  `core_field_value_for_formula`, `core_field_type_for_formula`)
  becomes either vestigial or wrong. Not addressed.
- **JSON Schema / OpenAPI / MCP.** PRD §10 (LLM-friendliness) is built
  on the assumption that the published JSON Schema accurately describes
  the document shape. `RoomRow` currently advertises `number: string`,
  `num_people: integer >= 0`, etc. With the reshape, the JSON Schema
  collapses every built-in non-typed-locked field into the
  `CustomValue = str | int | float | bool | None` union. **The
  schema becomes a substantially weaker contract for both LLMs and
  human readers.** PRD §10 is one of the project's stated reasons for
  rebuilding (not a side feature), so this is a regression worth
  surfacing explicitly, not as a footnote.
- **Downstream consumers (PHX / honeybee_ph / GH).** PRD §2: *"A
  native file format for future exchange with honeybee_ph, PHX, ph-dash,
  and Grasshopper."* Those consumers look at `room.floor_level`
  directly. Plan-31's "PHX export keys off stable `field_key`s and
  unit-bearing field types" (P0) suggests built-ins should mostly
  lock `field_type` — but then the Rooms seed in P5.1 unlocks
  `field_type` on every field except `record_id`. The plan
  contradicts itself.

**Recommendation.** Either:

1. **Lock `field_type` on all domain-meaningful built-ins** (`number`,
   `name`, `floor_level`, `building_zone`, `num_people`, `num_bedrooms`,
   `icfa_factor`, etc.) and only unlock `display_name`, `description`,
   and (for `record_id`) `formula`. This is the smaller, safer plan.
   The Rooms seed table in P5.1 then mostly grows
   `["display_name", "field_type", "delete", "duplicate", "options",
   "description"]` on every entry. Domain stays sound; row model stays
   typed; JSON Schema stays informative.
2. **If you really do want users to retype `num_people` from `number`
   to `text`,** then the reshape is the load-bearing decision of this
   PRD, not a footnote — re-budget Phase 1 accordingly, and document
   the resulting JSON Schema / validation / downstream-consumer
   regressions as accepted trade-offs.

My read is that option (1) covers what the user-visible motivation
(M1, M3) actually wants. The M1 example *"One project wants `Number`
as text (`R-101A`), another wants it as a number (`101`)"* is a real
need, but it's also one extremely narrow case — and even there,
"`R-101A`" still parses as text under the current `number: str`
declaration. The retype-to-number user need looks invented to justify
the architecture, not the other way around.

### A2. The lock-list precedence rule is internally contradictory

P4.1: *"The lock list is read from `fieldDef.locked`, which the
persisted document inherits from the feature seed and **never
overwrites.** (Locks are author-controlled, not user-controlled.)"*

P3 principle 4: *"A developer tightening the lock list later does
**not** retroactively revert user customizations. Existing customizations
survive; the lock prevents *future* user edits."*

P4.2 "Seeding rules": *"Existing project + lock list tightened in
feature code → user's persisted customizations survive; the tighter
lock takes effect for *future* edits."*

These two cannot both be true if `locked` is a persisted property of
`TableFieldDef`. Either:

- **(a)** Locks are persisted, then the persisted lock list is what the
  app reads — and tightening the seed has zero effect on existing docs
  because the persisted (looser) list wins; or
- **(b)** Locks are derived from the seed at load time, never persisted
  — then "the document's stored field configs are the source of truth"
  (P0 point 2) is contradicted for the `locked` attribute specifically.

The plan needs to pick one and say so. The cleaner answer is **(b)**:
`locked` is *not* persisted; it is layered onto each FieldDef at load
time from the current feature seed. Persisted data is just `id`,
`field_key`, `display_name`, `field_type`, `config`, `description`.
The TableFieldDef Pydantic shape in P4.2 should reflect that.

This also resolves the "what happens on built-in field removal" edge
case more cleanly — the field just stops being seeded, so it stops
appearing in the merged FieldDef list.

### A3. `field_key` role is muddled

P4.2's `TableFieldDef` has both `id` and `field_key`:

```py
id: str            # stable id: built-in field_key or cf_*
field_key: str     # same as id for built-ins; advisory slug for custom
```

But the current frontend `FieldDef.field_key` is *the* identity carrier
— `CellWrite.fieldKey`, `WriteOp.fieldKey`, sort/filter/group keys,
formula refs, ViewState column ids all key off `field_key`
(`data-table.md`, "Field identity rule"). Under the rename to a
TableFieldDef with `id` as the identity, the frontend `FieldDef.field_key`
becomes the wire shape for "id." That's either a rename (everywhere it
was `field_key`, now `id`) or a divergence between backend `id` /
frontend `field_key`.

The plan does not say which. It needs to. The default I'd suggest:
**don't introduce a new `id` slot on TableFieldDef**. Reuse the
existing `FieldDef.field_key` as the identity. Built-ins use stable
keys (`"number"`, `"name"`, `"record_id"`); customs use `cf_*` ids
exactly as today. Drop the advisory `field_key` slug for customs;
nobody actually uses it for anything load-bearing
(`CustomFieldDef.field_key` is documented as advisory, and the closest
thing to a consumer is the JSON download — which is fine using
display_name or id).

If the slug really is wanted long-term, fine, but the PRD shouldn't
rename "identity" mid-doc.

### A4. The "field_key === 'record_id' is the signal" approach has rough edges

Q-F2 picks this over an `is_record_id` boolean. The simplicity is
attractive, but worth flagging:

- **Reservation enforcement.** `CustomFieldDef.field_key` currently
  accepts any string. To prevent a custom field's advisory slug from
  colliding with `"record_id"`, add a backend validator. The plan
  mentions this in P4.3 ("we add a guard against the advisory
  `field_key` slug colliding") but the wire-level validator is one
  line and should land in the plan-31-phase-2 implementation plan
  as a checkable item.
- **Exactly-one invariant.** "Exactly one FieldDef per table must have
  `field_key === 'record_id'`. Zero or many is a backend validation
  error on document write." This requires every existing table contract
  to grow that invariant. The plan should list this as a backend test
  per table.
- **Schema additions.** When a developer adds a new project-document
  table without remembering to add `record_id`, document save fails.
  That's the right failure mode, but the dev seed should ship with
  a registry assertion at module load (similar to the existing
  `_missing_formula_type_keys` check in
  `tables/rooms.py`) so the failure is at import time, not at first
  user save.

### A5. The conversion matrix section contradicts itself

P4.5 opening: *"Already exists (`lib/typeConversionMatrix.ts` + backend
mirror). What changes: …"*

P4.5 a few paragraphs later: *"A new responsibility lands here: the
matrix must extend to cover conversions to/from `formula`."*

Adding formula source/target to the matrix is **not** "already exists."
The current `CONVERSION_MATRIX` (backend
`mutations/models.py`, frontend `typeConversionMatrix.ts`) has zero
entries for `formula` as source or target. Adding them — especially the
"snapshot the computed value, drop the formula" leg — is real new logic
on both the parser/AST side and the value-coercion side.

Rewrite this section so the reader knows what's done vs. what's new.

---

## B. Plan-Level Errors / Gaps

### B1. Attachment fields are not addressed

`pumpsTableFieldDefs` includes a `datasheet` attachment field with
`read_only_schema: true`, and `AttachmentRowsTable` uses
`read_only_schema: true` for attachment rows. Attachment is a
`FieldType` (`"attachment"`) but *not* a `CustomFieldType` — by design
(`data-table.md`: "No schema-mutation menu entries — `addField` /
`deleteField` / `changeType` / `setFormula` do not apply.").

Under the new lock-list model, an attachment field needs every attribute
locked — `field_type`, `formula`, `delete`, `duplicate`, `options`,
plus probably `description` too. The plan does not list this case. The
modal's TypeChange section also doesn't know about `attachment`
(`CustomFieldType` doesn't include it). The PRD should either:

- explicitly say attachment FieldDefs are not openable in the modal
  (continue using a short-circuit, just keyed off `field_type ===
  "attachment"` instead of `read_only_schema`), or
- list the locks per attachment field and confirm the modal's sections
  all handle the lock cleanly.

### B2. Cleanup items not enumerated

The PRD lists most cleanups (P6 Phase 2 mentions deleting
`IdentifierConfig`, `IDENTIFIER_COLUMN_ID`, the synthetic-column branch
in `resolve.ts`, the view-state whitelist for `__record_id__`,
`roomsFormulaRegistry`), which is good. Items I think should also land
explicitly in the phase plans:

- **`ROOMS_CORE_DISPLAY_NAMES`** in `document.py` (used by the
  duplicate-name validator). With FieldDefs now persisted, the
  duplicate-name validator should walk the persisted FieldDef list
  instead of a hard-coded tuple. Hard-coded constant should be
  removed.
- **`CustomFieldCapability.core_field_keys` /
  `core_display_names` /`required_core_select_fields`** in
  `backend/features/project_document/tables/contracts.py`. Under the
  new model, "core vs custom" is no longer a meaningful distinction
  — there are just FieldDefs with locks. The capability's API needs
  re-shape: `field_keys` (canonical list per table), `record_id_key`
  (= `"record_id"` for now but parameterizable), `required_field_keys`
  (replacing `required_core_select_fields`).
- **`ROOMS_CORE_FORMULA_TYPES` + `_read_rooms_core_field_for_formula`
  + `_rooms_core_field_type_for_formula`** in `tables/rooms.py`. Once
  field values can move into `custom_values` and types can change,
  these helpers either (a) become trivial pass-throughs over the
  FieldDef list, or (b) go away entirely.
- **`Pumps.tag` Pydantic column.** The plan says `tag` is removed, but
  doesn't list the `validatePumpsPayload` path or the various places
  that read `pump.tag` (e.g., `sortedPumps` in
  `frontend/src/features/equipment/lib.ts:232`, which falls back to
  `tag ?? use ?? id`). Cleanup checklist for Phase 2.
- **`ROOMS_SCHEMA_CORE_FIELD_KEYS`** (frontend
  `features/equipment/lib.ts:59`) — currently hard-coded, needs to
  derive from the persisted FieldDef list.
- **`pumpsTableFieldDefs` `read_only_schema: true`** on the datasheet
  attachment row (see B1).
- **`coerceCustomFieldType.computeLocalPreflight` + the conversion
  matrix's `formula` extension** — this is new code, not cleanup.

### B3. Renaming Pumps' `tag` to `record_id` loses domain meaning

This is a UX call, not a code call, but worth flagging since it goes
against the user profile.

Mechanical-engineering and Phius-side workflows consume the **Pump
Tag** — a domain term that maps to drawing schedules ("HWP-1.1") and
to manufacturer submittal-package indexes. "Record-ID" is a generic
TypeForm name that has no domain meaning. Plan P5.2 sets
`display_name: "Record-ID"` and locks `display_name` — so the user
loses the ability to call this field "Tag" through the UI.

Two options:

- (a) Drop the universal-header rule. Allow per-feature `display_name`
  override on the `record_id` FieldDef. Pumps ships
  `display_name: "Tag"`, locked. Rooms ships `display_name: "Record-ID"`,
  locked.
- (b) Add `"display_name"` to the *un*-locked list on Pumps so the
  user can rename it back to "Tag" themselves.

(a) is the safer default — matches existing AirTable behavior (e.g.
their pinned column shows whatever the field is named), keeps domain
language correct, doesn't require user intervention. Q-F5 punted
this ("generic `Field Locked` string only") but the actual question is
*whether the header label is forced to `"Record-ID"` everywhere*.
Recommend revisiting.

### B4. Duplicate semantics for built-in fields are undefined

P5.1 / P5.2 lock `"delete"` and `"duplicate"` on `record_id` only.
Every other built-in is duplicate-able. But the `DuplicateFieldMutation`
backend path
(`backend/features/project_document/mutations/field_ops.py`) currently
operates only on custom fields — it deep-copies a `CustomFieldDef` and
mints a fresh `cf_*` id.

Duplicating `Floor` (a single-select built-in with an option list) would
need to produce a new custom field that copies the option list
namespace. Where do the options go — the same namespace
(`rooms.floor_level`) or a new namespace (`rooms.cf_NEWID`)? The plan
doesn't say. Pick a default and write it down. My suggestion: lock
`"duplicate"` on all built-ins by default. Loosen only if the feature
author has a specific reason.

### B5. Default-values communication for built-ins

P4.2 seeding rules: *"Existing project + new built-in field added in
feature code → on next document load, inject the new FieldDef and seed
every existing row with the field's default value."* But the proposed
`TableFieldDef` model doesn't include a `default` slot. Add one (or
reuse the existing `FieldDef.default`). Also specify whether seed
defaults flow through `coerce_custom_value` before landing in
`row.custom`.

### B6. The "register newly added built-in fields on existing projects" path is risky

The proposed flow ("on next document load, inject the new FieldDef and
seed every existing row's default value") is a write-on-read. That's
the kind of side-effect that, if it ever ships with a bug, leaves
documents with subtly-different shapes on different load orders.

Suggest: gate it behind a one-shot upgrade step that runs at the
service layer (not at load), produces a *new* document version, and
goes through the normal Save pipeline so it's etag-checked. Or — since
"clean rebuild migration posture" (P3.6) is acceptable here — make
this an explicit `schema_version` bump for *each* new built-in field
addition, with the upgrade applied at load with full validation. Don't
do silent inject-on-load.

### B7. `notes` and `erv_unit_ids` are mentioned but not placed

P5.1 explicitly excludes `erv_unit_ids` ("out of scope for now —
linked-record"). Fine. But `notes` and `catalog_origin` are typed
columns on `RoomRow` and are not in the seed FieldDef list either.
What is their lock-list / FieldDef shape under the new model?

- `notes` is conventionally hidden from the table view (lives in the
  detail modal). The plan should say "outside the table FieldDef
  registry" explicitly, or include it with `["display_name",
  "field_type", "delete", "duplicate"]` locks.
- `catalog_origin` is hidden from every read surface — it's plumbing
  metadata. Don't add a FieldDef.

### B8. Phase 1 is too big

Phase 1 = lock model + persistence reshape + delete `read_only_schema`
+ fingerprint update. This is too large to land safely in one phase.

Split into:

- **Phase 1a — lock model.** Add `locked` slot on FieldDef.
  `useTableSchema` stops stamping `read_only_schema`; instead, the
  core seed declares its own `locked` arrays. ColumnHeaderMenu,
  HeaderContextMenu, GridHeader, ColumnHeaderMenu, FieldConfigModal
  switch from `read_only_schema` checks to lock-list checks. **No
  persistence change yet** — built-in FieldDefs still live in feature
  code only. Custom fields still go through their existing
  `CustomFieldDef` path. The wire format is unchanged. The user-visible
  behavior changes only in that, under the right lock list, built-in
  fields can be edited from the modal (e.g., rename, formula edit).
- **Phase 1b — persistence reshape** (only if you decide to keep the
  reshape after re-considering A1). Move from `CustomFieldDef[]` to
  `TableFieldDef[]` per table, persist built-in fields, run the
  schema-version bump.

Phase 1a alone delivers nearly all of M1 + M2 + M3 (the modal opens for
built-ins, lock-list disables sections appropriately, `record_id` lands
as a `kind: "computed"` IdentifierConfig with a real formula, double-
click trigger works). Phase 1b is only needed if `field_type` becomes
mutable on built-ins.

---

## C. Smaller Issues

### C1. `formulaSourceFromFieldDef` and field-ref resolution under renaming

Formulas reference fields by display name (e.g. `{Number}`), resolved
to immutable ids at commit, then rebuilt back to display name on each
open. If a built-in field's `display_name` is locked, refs stay stable.
But if a built-in's `display_name` is *un*locked (allowed by the lock
model), then renaming "Number" to "Room Number" rewrites every formula
that referenced `{Number}`. Existing behavior handles this for custom
fields fine; the only thing to confirm is that the formula registry
treats built-in and custom uniformly (no `origin: "core"` short-
circuit). `buildRoomsFormulaRegistry` reads `read_only_schema` to
stamp `origin: "core" | "custom"`. Under plan-31 that becomes
"derived from where the FieldDef came from (seed vs. user-add)". Worth
a line in Phase 1a's plan.

### C2. View-state fingerprint under lock-list changes

The schema fingerprint includes `core` field keys + custom field
`(id, type)`. When `field_type` on a built-in becomes user-mutable
and the user changes it, the fingerprint changes — that's correct.
But changing `display_name` does *not* (and should not) change the
fingerprint. Today's behavior is consistent; just confirm the new
fingerprint stays type-only, no display-name component.

### C3. `read_only` (cell read-only) and `read_only_schema` (config read-only) are different

The codebase distinguishes:

- `FieldDef.read_only` — cell value is read-only (e.g. `erv_unit_ids`,
  computed formula columns).
- `FieldDef.read_only_schema` — schema-mutation menu items hidden.

Plan-31 deletes `read_only_schema`. It does **not** touch `read_only`,
and shouldn't — those are different concerns. Worth one sentence in
P4.1 to make it explicit, because the names invite confusion.

### C4. Lossy-conversion silent completion (Q10 → Q-F5 area)

The plan says lossy conversions show the preflight count and proceed
without further confirmation. That's the same UX as today's custom-
fields path, so fine. But for the Phius / certification audience, a
silent "3 cells were cleared" in a project-document table can mean
"the user's iCFA factor for row 17 just became null" — and that's
the kind of change that should land in the action log
(`user_action_log`, US-C1) for after-the-fact recovery. The plan
should confirm the action-log entry includes per-row before/after
for type-change conversions on built-ins. (For customs, the
ChangeType mutation already audits — verify the same wiring covers
built-ins under the new shape.)

### C5. `IDENTIFIER_HEADER_LABEL` constant fate

Once `record_id` is a real field, the `IDENTIFIER_HEADER_LABEL`
constant ("Record-ID") moves into the FieldDef's `display_name`. Either
delete the constant or keep it as the canonical seed default. If kept,
note that in Phase 2's cleanup.

### C6. Reserve `"record_id"` namespace early

If the plan ships Phase 1a first (per B8), and `"record_id"` only
becomes meaningful in Phase 2, there's a small window where a user
could add a custom field with slug `record_id` (today nothing prevents
this). Add the slug guard in Phase 1a even though it doesn't matter
for behavior yet — saves a foot-gun in Phase 2 rollout.

### C7. "AirTable parity for field configuration" needs caveats

Plan opens with: *"The goal is **AirTable parity for field
configuration**, with PH-domain locks where they protect downstream
consumers."* This frames the locks as a small carve-out, but in
practice the locks list is going to be ~6 entries per built-in
field × ~8 fields per table × ~5 tables ≈ ~200 lock-list entries
across the codebase. That's not "small carve-out"; that's a regime.
Worth saying so up front — feature authors will be writing a lot of
lock arrays. (See also §E for the simplification this implies.)

---

## D. Missing Edge Cases / Things The Plan Doesn't Think About

### D1. Catalog refresh under field-type retype

If a project picks a material from the catalog and copies values in,
then the user retypes the project's built-in field, what happens on
refresh-from-catalog (US-WIN-11 / §7.4)? The catalog row has a
canonical type; the project field is now a different type. Refresh
flow doesn't know how to surface this.

Resolution: lock `field_type` on every project field that ever carries
catalog-sourced data (`tag` on Pumps, every assembly / material /
glazing field). This is another argument for §A1's recommendation (1).

### D2. Schema mutation locks during pending writes

If user A opens the field-config modal on Rooms `name`, and user B
(or MCP) drops a write that changes the fingerprint mid-edit, the
existing R-S2 external-edit handling fires (already implemented in
`FieldConfigModal.tsx`). For built-ins this works the same. But what
if the *lock list itself* changes (developer redeploys with tighter
locks)? Per A2's resolution-(b), locks aren't persisted, so a redeploy
just changes which inputs are disabled on the next render. Test: open
modal, redeploy with a `display_name` lock added, observe that the
displayName input becomes disabled but the user's draft text isn't
lost. Spec.

### D3. MCP / LLM agents and built-in field edits

MCP currently has `schemaMutation` writes scoped to custom fields
(via the audit-kind map keyed off custom-field semantics: `_add`,
`_rename`, `_delete`, `_duplicate`, …). When built-ins become editable
through the same mutation pipeline, the audit kind map either needs
new entries (`project_version_built_in_field_rename`) or has to widen
to drop the `_custom_field_` namespace.

The plan doesn't address audit logging for built-in mutations.

### D4. Single-select option-list deletion cascades on built-ins

`EditOptionsMutation` for the `floor_level` core list — currently
guarded by `ROOMS_REQUIRED_CORE_SELECT_FIELDS` so a delete-with-no-
replacement is rejected. Under plan-31's "every built-in's options
are user-editable unless locked," this guard moves where? My read:
the guard moves into the lock list ("options" lock) — but it
needs to be **on `option deletion`**, not on the lock as a whole.
Today's `EditOptionsMutation.replacements` already handles the
required-core case. Confirm in Phase 3 that the lock-list version
preserves this distinction: a user can rename / reorder / recolor
floor options freely, but deleting `floor_level: "L0"` (a required
single-select) still requires `replacements`.

### D5. Pumps' `phase` validation

`PumpRow.phase: int | None` with `Field` validator restricting to
`{1, 3}`. If the user retypes `phase` from `number` to `text`, the
"1 or 3" constraint is lost. Same problem as `num_people: ge=0`.
Reinforces §A1.

---

## E. Simpler Alternative

The PRD's user-visible goals reduce to:

1. Header double-click opens the field config modal.
2. Modal opens for built-in fields too.
3. Inside the modal, the user can rename built-in fields (or not),
   edit the description, edit the formula (for built-ins that have
   one), edit single-select options (for built-ins that own them).
4. The pinned identifier column is configurable as a formula (rather
   than hard-coded by the feature author).
5. `tag` uniqueness on Pumps is gone (already shipped in plan-30).
6. Project-specific identifier formatting (Rooms wants `{number} —
   {name}`; Pumps wants `{tag}` or `{use}`; some future table wants
   `{building}::{system}` — the user picks per project).

**None of these require retyping `num_people` from number to text.**

A simplified plan that captures (1)–(6) without touching the wire
format:

### E.1 Backend changes
- Add a tiny per-table override store, keyed by `field_key`:
  ```python
  class BuiltInFieldOverride(BaseModel):
      field_key: str
      display_name: str | None = None       # rename, optional
      description: str | None = None
      formula_source: str | None = None     # only when field is computed
  ```
  Persist as `tables.<name>.built_in_overrides: list[BuiltInFieldOverride]`.
  Empty by default; non-empty only when the user edits something.
- Add `record_id` as a typed column on each row model that wants one
  (Pumps: `record_id: str | None`; Rooms: derive at read time from a
  per-project formula; defaults to `{Number} — {Name}` when no
  override).
- Built-in field types stay locked; the validator continues to enforce
  `ge=0`, `le=1.0`, option-list references, etc.

### E.2 Frontend changes
- Add `locked: FieldLockKey[]` to `FieldDef` (per A2-(b) — derived
  at load, not persisted).
- In `useTableSchema`, merge the feature seed FieldDefs with the
  document's overrides — apply `display_name` / `description` /
  `formula_source` from overrides onto the seed FieldDefs.
- Delete `read_only_schema`; replace consumers with lock-list
  checks. (Same change as plan-31 Phase 1a.)
- Header double-click opens FieldConfigModal regardless of lock list;
  modal sections disable inputs by lock.
- IdentifierConfig becomes `IdentifierConfig | { kind: "formula";
  formula_source: string; deps: string[] }` — i.e. a formula
  identifier that pulls the source from the per-table override
  store. (Or keep `kind: "computed"` and store the formula source
  in the override store.)

### E.3 What this skips
- No `TableFieldDef[]` reshape.
- No `RoomRow.num_people → custom_values["num_people"]`.
- No JSON Schema regression.
- No `CustomFieldCapability.core_field_keys` refactor.
- No type-conversion-matrix extension for built-ins.
- No `acknowledge_destructive` paths for built-in retypes.

### E.4 What this loses
- Users *cannot* change a built-in field's `field_type`. They can rename
  it, edit its formula (if it's computed), and edit its options
  (which is already supported as `EditOptionsMutation` on core
  single-selects).
- "Make Pumps' `tag` field a number" workflow is impossible. (But you
  can already type numbers into a text field.)

The trade is: lose ~one motivating example (M1's retype-Number case) in
exchange for keeping the document wire format, the JSON Schema, the
Pydantic validation layer, the LLM-friendliness contract, and the
catalog refresh pipeline all intact.

I'd recommend going this route, or at minimum, **starting with this and
adding the reshape later only if a real user need demonstrates the
limitation.**

---

## F. Action Items For The PRD

If the PRD goes ahead more-or-less as written, at minimum:

1. **Resolve §A1** — either lock `field_type` on all domain-meaningful
   built-ins (and update the P5.1 / P5.2 seed tables to show this) or
   re-frame the PRD as a wire-format reshape with explicit JSON Schema
   / validation / downstream-consumer trade-off acknowledgments.
2. **Resolve §A2** — pick (a) persist locks or (b) derive locks at
   load. Write it down. (Recommend (b).)
3. **Resolve §A3** — pick whether the identity carrier is `id` or
   `field_key`. (Recommend reusing existing `field_key`.)
4. **Fix §A5** — rewrite P4.5 so "already exists" vs "new responsibility"
   are not in the same paragraph.
5. **Address §B1** — write the attachment-field policy.
6. **Address §B2** — list every cleanup item explicitly (PRD currently
   misses ~6 of them).
7. **Address §B3** — decide whether `display_name` on `record_id` is
   universally `"Record-ID"` or per-feature (`"Tag"` for Pumps).
8. **Address §B4** — lock `"duplicate"` on built-ins by default unless
   there's a specific feature need.
9. **Address §B5 / §B6** — specify how seed defaults flow, and replace
   silent-inject-on-load with explicit schema-version-bump upgrade.
10. **Address §B7** — `notes` / `catalog_origin` / `erv_unit_ids`
    placement in the FieldDef registry.
11. **Address §B8** — split Phase 1 into 1a (lock model only) and 1b
    (persistence reshape, if pursued).
12. **Address §D1** — lock `field_type` on any field that ever carries
    catalog-sourced data.
13. **Address §D3** — audit-log shape for built-in mutations.

## G. Where The Plan Is Good

- **P0 / P1 motivation is well-stated.** The two-tier model is genuinely
  leaky; collapsing it is the right direction.
- **`record_id` as a real field is a clean simplification** at the
  IdentifierConfig level — the `kind: "field"` / `kind: "computed"` /
  `kind: "field-broken"` resolution gives way to "pin whichever FieldDef
  has `field_key === 'record_id'`." Even if the rest of the PRD shrinks
  (per §E), this part should stay.
- **The lock-list model is a clean abstraction.** Per-attribute locks
  are easier to reason about than a binary `read_only_schema`.
- **The principle "forward-looking locks"** (changes don't retroactively
  undo user customizations) is the right call, modulo §A2's
  internal-contradiction cleanup.
- **The phasing has the right shape** — schema first, identifier second,
  modal third. Just split Phase 1 (see §B8).
- **The PRD acknowledges that the formula engine, conversion matrix, and
  modal already exist.** That keeps the implementation surface
  realistic.
- **Q-F2's resolution** (the `field_key === "record_id"` signal) is
  simpler than carrying a parallel boolean. Just enforce the slug
  reservation per §A4 / §C6.

---

## H. Summary Recommendation

Land plan-31 as **Phase 1a only** (lock model, modal opens for
built-ins under lock-aware disabling, `read_only_schema` deleted) plus
**Phase 2 record_id-as-field** (with the small per-table built-in
override store from §E.1), and **skip the persistence reshape
indefinitely** unless a concrete user task demands user-mutable
`field_type` on a built-in field. The user-visible benefit is nearly
the same; the architectural risk is dramatically lower; the document
wire format, JSON Schema, and downstream consumer contracts all stay
intact.

If the persistence reshape goes ahead anyway, treat it as a major
schema-version-3 reshape with all the cost that implies, not as a
small extension to the existing custom-fields pipeline.
