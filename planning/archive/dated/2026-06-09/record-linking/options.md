---
DATE: 2026-06-08
TIME: -
STATUS: Research / discussion — options memo before any PRD or
        implementation work. No code change implied yet.
AUTHOR: Ed May (with Claude)
SCOPE: Architecture options for adding AirTable-style record-linking
       (and rollup/aggregation) between project-document tables in PHN
       V2 — e.g. linking a `Pump` row to one or more `Room` rows.
RELATED: context/PRD.md §6, §11.3
         context/technical-requirements/data-model.md §6.3, §6.6.3, §6.6.4
         context/technical-requirements/data-table.md
         backend/features/project_document/document.py (RoomRow.erv_unit_ids precedent)
         backend/features/project_document/tables/contracts.py (TableContract / TableFieldRegistry)
         backend/features/project_document/custom_fields.py (CustomValue / CustomFieldType)
         backend/features/project_document/tables/rooms.py + pumps.py + ventilators.py
---

# Record-linking — architecture options

## 1. Why this memo exists

The user story:

1. **Link.** Open Rooms → a row → a `Pump` lookup cell → pick from a
   list of all Pumps → the chosen Pump is now linked to that Room. The
   Pumps table shows the same link from the inverse side ("which Room").
2. **Aggregate / rollup.** A single Pump may be linked from many Rooms.
   In the Pumps table the user wants to see *all* linked Rooms and a
   total — count, or a sum like total installed wattage across rooms.

This is AirTable's "Linked Record" + "Lookup" + "Rollup" trio, and the
question is whether to add it to V2 and, if so, how. The user explicitly
said: no existing deploy, no backwards-compatibility constraints, can
change anything, priority is maintainability and extensibility.

## 2. What the current architecture commits us to

Surfaced from the code and `context/`:

- **JSON-document storage.** `project_versions.body` is a JSONB column.
  Project tables (Rooms, Pumps, ERVs, …) live inside that document, not
  in relational tables. `data-model.md §6.3`:
  > "No relational shadow. Adding a new table type is a code change,
  > not a schema migration."
- **Table shape.** Each table is `{ field_defs: TableFieldDef[], rows:
  Row[] }`. `rows` are typed Pydantic models. Each row has:
  - **Typed Pydantic columns** for built-ins whose `field_type` is
    locked (e.g. `RoomRow.floor_level: str | None`, `icfa_factor:
    float`). Locked-type means the user cannot change the field's type
    through the field-config modal because the column carries a domain
    invariant that wouldn't survive a retype.
  - **A `custom_values: dict[str, CustomValue]` bag** for everything
    else (mutable-type built-ins and all user-created custom fields),
    keyed by `field_key`.
- **The closed `CustomValue` scalar set:**
  `str | int | float | bool | None`. **Not** `list`, `dict`, or any
  reference type. That is a load-bearing constraint of this proposal —
  every option below either lives outside `custom_values` (typed
  column / sidecar table) or widens the bag.
- **The closed v1 field-type set** (`CustomFieldType`): `short_text`,
  `long_text`, `number`, `url`, `single_select`, `color`, `formula`.
  `data-model.md §6.6.3` is explicit:
  > "Future types (date, attachment, **cross-table lookup**, **cross-row
  > aggregations**) are out of scope for v1; see plan-13 §6."
  So adding a `linked_record` field type was already projected as the
  natural future direction — it just wasn't part of v1.
- **There is already a half-built precedent**:
  `RoomRow.erv_unit_ids: list[str] = Field(default_factory=list)`.
  The data-model PRD describes this as
  `"erv_unit_ids": ["erv_..."]    // N:M with tables.equipment.ervs`,
  and `validate_document_references` currently *rejects* non-empty
  values with the explicit message `"Room ERV assignments are deferred
  until the ERV table is available"`. So one shape of the answer has
  already been sketched in code; the question is whether to ship that
  shape, generalize it, or pivot to something else.
- **Single-select is the existing reference type.** `single_select`
  cells store the option id `"opt_..."` as a `str`, and the option
  catalog lives at the document root in
  `single_select_options["<table>.<field_key>"]`. The reference is
  validated on every write. This is the existing template for "cell
  holds an id, referent lives elsewhere in the document, validation
  runs at the document boundary."
- **Save / version model.** A saved version is a snapshot of the
  whole JSON document. Anything we add must round-trip cleanly through
  the existing draft/save/Save-As pipeline and through JSON Schema
  export.
- **Formulas already exist** as a field type with a typed AST,
  per-table cycle detection, and a read-overlay (`rows_computed`) that
  carries the computed result for each row in the wire response. They
  resolve refs only within the current table today, but the
  infrastructure is in place — extending it to cross-table refs is an
  evolution of an existing mechanism, not a new one.
- **All calculations live in the backend.** Frontend renders + edits
  only. Rollups must be computed server-side.
- **No SQLAlchemy ORM.** Raw parameterized SQL through narrow
  repositories. Adding a relational shadow for links would mean
  hand-written tables, migrations, repository modules, ETag work, and
  draft-sync surgery — which is exactly what V2 was designed to avoid.

So the architecture's grain is clear: links live **inside the project
document**, alongside the rows they connect. The remaining design space
is *how* they're shaped.

## 3. The design axes

Three orthogonal decisions:

**Axis A — Where the link value lives.**
1. A typed Pydantic column on the source row (`room.linked_pump_ids:
   list[str]`). One typed column per pair of tables you want to link.
2. Inside `custom_values` (requires widening `CustomValue` to admit
   `list[str]`, or carving a parallel bag `custom_links: dict[str,
   list[str]]`).
3. In a top-level link table on the document
   (`tables.relations: list[Relation]`), referenced by field_key.

**Axis B — Who owns the link (storage symmetry).**
1. One side owns it (source table stores ids); the other side projects
   an inverse view at read time.
2. Both sides store a copy (denormalized, requires bidirectional
   write).
3. Neither side owns it — a separate relations array holds the truth;
   both sides project views.

**Axis C — How rollups / aggregations get computed.**
1. Extend the existing `formula` field type to cross link boundaries
   (`sum(linked(pumps).wattage)`).
2. Introduce a separate `rollup` field type with its own config.
3. Don't ship rollups in v1; user stares at the count themselves.

The recommended combination falls out of the analysis below.

## 4. Approaches

### Approach 1 — Typed row columns, hand-coded per link
*(Axis A1 + B1 + C3, plus formulas can be extended later)*

Continue what `erv_unit_ids` already does. For every pair of tables we
want to link, add a new typed `list[str]` column on the source row
model (or a `str | None` for 1:N), wire it through `validate_document_
references` to enforce existence in the target table, and add a
frontend renderer for "list of row ids → pill list" + a record-picker
cell editor.

**Pros:**
- Smallest jump from the current architecture.
- Fully typed end-to-end. Pydantic catches every invalid id at validate
  time.
- Domain-specific validators are easy to bolt on
  (e.g. "ERV phase must match Room electric phase").
- Already half-implemented (`erv_unit_ids`) — finishing that wiring
  would deliver the first concrete link.

**Cons:**
- **Each link is a code change.** Adding "Pumps in Rooms" = a new
  typed column + validator + frontend renderer + schema-mutation
  carve-out + tests. Same for "Fans in Rooms," "Pumps in Apertures,"
  etc.
- **Not user-createable.** PHN's field-config modal lets the user add
  a `cf_*` field on any FieldDef-capable table. Typed columns are
  feature-author-only. The user story is "user adds a Pump LOOKUP
  field on Rooms" — i.e. exactly the kind of add the field-config
  modal already handles for short_text/number/single_select. This
  approach can't fulfill that user story directly; the developer has
  to extend the row model first.
- **Inverse views are per-pair custom code.** To show "Rooms linked to
  this Pump" on the Pumps table, every consumer that needs the
  inverse has to walk the source table. There's no generic mechanism.
- **Doesn't scale to the "we'll want this everywhere" case.** Linking
  Pumps to Rooms is just the first ask; Fans-to-Rooms, Heaters-to-
  Rooms, Pumps-to-Hot-Water-Tanks, ERVs-to-Apertures all sit behind
  the same door.

**Fit for the user story:** Partial. The link works. The
user-self-service field add does not.

### Approach 2 — A new `linked_record` field type in the registry (RECOMMENDED)
*(Axis A2 + B1 + C1)*

Add `linked_record` to the `CustomFieldType` enum. The field's `config`
carries the target — `{ "target_table_path": ["equipment", "pumps"] }`.
The field's stored value is a `list[str]` of target row ids. This
field type is creatable through the existing field-config modal on
any FieldDef-capable table — same affordance as adding a `single_
select` column today. The inverse view ("which Rooms link to this
Pump") is a server-computed read overlay; nothing is double-stored.

Concrete touch points:

**Backend**
- `CustomValue` widened to `str | int | float | bool | None | list[str]`,
  *or* a parallel bag `custom_links: dict[str, list[str]]` on the row
  so the scalar set stays scalar. Parallel-bag is the cleaner choice
  — keeps JSON Schema for value cells simple and forbids confusion
  between "a number field" and "a link field." Validation walks the
  bag and confirms each id exists in the target table.
- `linked_record` added to `CustomFieldType`; `coerce_custom_value`
  routes it; `validate_number_config`-style validator confirms
  `config.target_table_path` exists in the registry and isn't the
  field's own table (or *is*, if we choose to allow self-links —
  see open questions).
- `TableFieldRegistry` gains a tiny `read_row_links` /
  `set_row_links` accessor pair (mirrors the existing
  `read_row_custom_values` / `set_row_custom_values`).
- `validate_document_references` walks every linked-record field on
  every table, asserts each id resolves to a row in the target table,
  and decides cascade policy (recommended default: orphaned ids are
  silently dropped on next save; the validator emits a warning the
  frontend can render — never errors out, because a save that ran
  half a second after the user deleted the target should still land).
- Inverse views and rollups: extend the existing
  `evaluate_table_formulas` overlay so a formula in the *target*
  table can reference incoming links. Syntax sketch
  (mirrors AirTable):

      // In a formula field on the Pumps table:
      count(linked_from(rooms, "linked_pumps"))            // → 3
      sum(linked_from(rooms, "linked_pumps").wattage)      // → 240

  i.e. one new grammar primitive that resolves "rows on table X whose
  link field Y points at me." Cycles are detected by the same per-
  table evaluator extended to a per-document graph; this is real but
  bounded work.
- Schema-mutation pipeline already routes
  `FieldSchemaMutation` to per-table registries; adding `linked_
  record` is one new branch in the validate / apply / fingerprint
  path.

**Frontend**
- `FieldType` union widens by one. `FieldDef.config` gains the
  target.
- `FieldConfigModal` gets a "Linked Record" picker option with a
  one-shot dropdown of available tables (the registry already
  enumerates table contracts; that list is reachable from the wire).
- Cell renderer: a pill list of "Pump A, Pump B" using the linked
  row's `record_id` formula field (every FieldDef-capable table is
  already required to have `record_id` — designed for exactly this
  display use). Pill click jumps to the linked row.
- Cell editor: a modal record-picker that lists the target table's
  rows by `record_id`, with filter / search reusing the existing
  toolbar primitives. Reuse the catalog-picker shell.
- `WriteOp` gets a `cellLink` variant or rides through the existing
  `cell` op with a new value shape — the latter is cheaper if we
  pick the parallel-bag form on the backend.
- Rollups display as ordinary computed cells; the formula editor's
  ref completion learns `linked_from(...)` from a new
  `FieldRegistryEntry` kind.

**Pros:**
- **Fits the user story verbatim.** The user adds a "Pump" linked-
  record field on Rooms through the normal field-config modal, picks
  Pumps, and starts linking. No developer involvement.
- **Symmetric without double-storage.** The inverse view is a
  computed overlay — adding a link from one side immediately appears
  on the other without write fan-out and without drift risk.
- **Aligns with where the architecture was already pointing.**
  `data-model.md §6.6.3` already named "cross-table lookup" and
  "cross-row aggregations" as the next field-type frontier. The
  TableFieldRegistry was designed so new field types plug in
  uniformly.
- **Snapshots cleanly.** A saved version is still one JSON document;
  link ids inside it stay valid for that version because the target
  rows are also in that same snapshot. No referential dangling
  across versions.
- **MCP gets it for free.** Linked records are typed JSON; the MCP
  surface needs no new tool, just the new field type in the JSON
  Schema.
- **Rollups reuse the existing formula evaluator.** The hardest piece
  — cross-table aggregation — slots into an evaluator that already
  understands typed ASTs, cycle detection, and read overlays.
- **One conceptual model for every pair.** Pumps↔Rooms, Fans↔Rooms,
  ERVs↔Apertures all use the same machinery. Maintenance scales by
  feature, not by pair.

**Cons / costs:**
- **Real backend scope.** Roughly five surfaces touched:
  CustomValue/parallel-bag, schema-mutation, document validation,
  formula grammar + evaluator (cross-table), schema fingerprint.
  Not trivial, but each surface already has a defined extension
  pattern.
- **Real frontend scope.** Roughly five surfaces touched: FieldType
  union, FieldConfigModal, cell renderer, cell editor (the record-
  picker is genuinely new UI), formula registry.
- **Cascade semantics need a decision** (open question §6.1). What
  happens to `room.cf_pumps` when the linked Pump row is deleted?
  Recommended: silently drop orphan ids on the next save, surface a
  toast.
- **Cycle/perf surface widens.** A formula on Pumps that aggregates
  linked Rooms whose formula aggregates linked Pumps is a cycle the
  evaluator must catch. Bounded: extend the existing
  `_validate_rooms_formula_cycles` to a document-level cycle check.
- **Inverse-view cost is O(N·M).** Building "Rooms linked to this
  Pump" reads the whole source table once. For PHN's expected sizes
  (Rooms < ~300, Pumps < ~50, both per-project) this is trivially
  fine; worth a perf sanity check before committing.
- **Power tool risk.** The user can build link graphs the PH domain
  doesn't actually validate (a kitchen sink linking everything to
  everything). Mitigation is UX — the inverse-view rollup makes
  bad graphs visually obvious — not a model-level constraint.

**Fit for the user story:** Direct.

### Approach 3 — Document-level relations array (graph-style)
*(Axis A3 + B3 + C1)*

Add a top-level `relations: list[Relation]` array (or
`tables.relations`) where each entry is
`{ id, from_table, from_row_id, from_field_key, to_table, to_row_id,
attributes?: dict }`. Field definitions on each side declare themselves
as `linked_record` and reference the relation by `field_key`. Both
sides project views at read time; neither side stores the ids
inside the row.

**Pros over Approach 2:**
- **Truly symmetric storage.** Neither table is the "owner"; both
  views are derived equally.
- **Per-link metadata** comes for free — `Relation.attributes` can
  carry "quantity = 4," "installed = 2026-01-01," etc. Useful for the
  user's example "total *installed capacity* — sum of pump wattages,"
  if the per-room install count differs from the pump's nominal
  wattage.
- **Cascade is centralized.** Deleting a row prunes relations
  involving it in one pass.
- **Easy to index in memory.** A single flat array is trivial to
  group by `from_*` or `to_*` and serve back-references in O(N).

**Cons:**
- **Bigger conceptual shift.** The mental model moves from "tables of
  rows" to "tables of rows + a relations graph." Every consumer that
  walks the document (downloads, diff, MCP, HBJSON exporters,
  validators) now has to know about a second top-level entity.
- **Wire shape grows two write paths.** Ordinary `custom_values`
  mutations stay one shape; relation mutations are a new shape. The
  WriteOp surface widens, undo gets more cases, the draft buffer
  gains another op type. Approach 2 keeps everything riding on the
  existing cell-write path.
- **Diff becomes harder to read.** A version-to-version diff that
  used to show "room rm_A.linked_pumps changed from [] to [pmp_X]"
  becomes "two new entries in the relations array, identifiable only
  by id." Solvable, but more diff-renderer work.
- **More indirection for the same user story.** The user wants a
  field they can edit on Rooms. Approach 2 stores that field where
  the user expects; Approach 3 puts the truth elsewhere and projects
  it back. Indirection that has no payoff in v1 is technical debt.
- **Per-link metadata is a feature we don't need yet.** The user
  story is "Pump X is linked to Room Y" — no per-link attributes.
  Approach 2 can grow them later (extend `custom_links` bag values
  from `list[str]` to `list[{id, attrs}]`) if and only if it turns
  out we need them.

**Fit for the user story:** Works, but solves a problem we don't have
yet, at the cost of a larger up-front jump.

### Approach 4 — Don't ship semantic linking; ship a `list_of_text` field
*(Listed for completeness only.)*

Add a `multi_text` field type whose value is `list[str]`. The user
types pump names in. No ids, no referential validation, no inverse
view, no rollup.

**Pros:** trivially small.

**Cons:** doesn't actually solve the user story. Renames and deletes
break silently. Inverse view impossible. Aggregation impossible. The
moment the user wants "total wattage across rooms" we have to do
Approach 2 anyway. Skip.

## 5. Recommendation

**Approach 2** — add `linked_record` as a first-class custom field type.

Reasons in priority order:

1. **It fits the user story directly.** "User goes to the Rooms table
   where there is a Pump LOOKUP field" reads as "the user added a
   linked-record custom field on Rooms." That's exactly what this
   approach makes possible.
2. **It moves with the architecture's grain.** The data-model PRD
   explicitly anticipates this field-type slot; the table contract,
   schema-mutation pipeline, formula evaluator, and read overlay are
   all designed to absorb new field types without per-table branching.
3. **It avoids relational shadows.** V2's whole thesis is "the
   document is the source of truth." Approach 2 stays inside that
   thesis; Approach 3 puts a graph next to it, and Approach 1 misses
   the user-self-service goal.
4. **Rollups land naturally.** Cross-table formula refs are the next
   step after linked-record values; we get them by extending an
   evaluator we already have. (We can ship rollups in a second phase
   — the linked-record field alone delivers the first user story.)
5. **It's reversible.** If, later, per-link metadata becomes
   important enough to want a relations array, we can lift
   `custom_links[field_key] = list[str]` to
   `custom_links[field_key] = list[{id, attrs}]` without rewriting
   the rest of the system. Approach 2 doesn't paint us into a
   corner.

Cost honesty: this is a multi-phase chunk of work. A reasonable phasing
is probably:

- **Phase 1 — link values only.** New `linked_record` field type,
  schema-mutation, validation, frontend record-picker cell editor,
  pill renderer. No inverse view. No rollups. Useful by itself
  because the user can already navigate from a Pump cell on a Room
  to that Pump row.
- **Phase 2 — inverse view.** Server-side read overlay that
  projects "incoming links" onto the target table's rows. Surfaces
  in the Pumps table as a column. No formula grammar change yet.
- **Phase 3 — rollups.** Extend the formula grammar with
  `linked_from(...)` (and possibly `linked(...)` for the forward
  direction if formulas inside the source row want to compute their
  own totals). Document-level cycle detection.

Whether to bundle all three into one merge or stage them is a
sequencing call after the PRD lands.

## 6. Open questions (to resolve in the PRD pass)

1. **Cascade on delete.** When the linked target row is deleted, do
   we (a) silently drop orphan ids on next save and toast,
   (b) hard-error the delete until the user clears the links,
   (c) keep dangling ids and render them greyed out? Recommended (a).
2. **Self-links.** Should a table be allowed to link to itself
   (Room ↔ Room "adjacent to")? Cheap to allow; cycles in formula
   evaluation are already a problem we're solving.
3. **Cardinality.** Default to many-to-many (the user story's
   one-pump-many-rooms is exactly that). Allow a `max_links: 1`
   config option for 1:1 cases? Defer until a concrete need.
4. **Allowable target tables.** Should every FieldDef-capable table
   be a valid link target, or do some tables (e.g. catalogs) opt out?
   Catalogs are global, not project-document-scoped — linking to
   them needs a different storage shape (catalog record ids, not
   row ids in the document). Recommended: v1 scope is project-
   document tables only; catalog linking is a follow-up.
5. **Storage shape inside the row.** Parallel bag (`custom_links:
   dict[str, list[str]]`) vs widened `CustomValue` to admit
   `list[str]`. Parallel bag keeps each typing path narrower; widening
   is fewer surfaces but invites confusion ("can my number column
   hold a list now?"). Recommended: parallel bag.
6. **Rollup grammar surface area.** Just `count` + `sum`, or the full
   AirTable rollup list (`avg`, `min`, `max`, `concatenate`,
   `array_join`)? Lean: ship `count` + `sum` + `avg` in Phase 3 and
   add on demand.
7. **What to do with the existing `erv_unit_ids` typed column.** If
   we ship Approach 2, the right migration is to delete that column
   and reintroduce the Room→ERV link as a built-in linked-record
   FieldDef. This keeps one mechanism; the row model gets simpler.
   The pre-deploy posture (no production data) makes this free.
8. **MCP write surface.** Should LLM clients be able to create
   linked-record fields and write link cells in Phase 1? Lean yes —
   the schema-mutation API and cell-write API are already MCP-exposed
   so this is mostly a JSON Schema regeneration.
9. **Validation timing for inbound cell writes.** Today single-select
   cell writes validate the option id at the document-validator
   boundary, which is after the whole replace lands. Linked-record
   writes should match that pattern — fail-closed on save, not on
   keystroke — so the user can stage edits without races against the
   target table's mutation state.
10. **Performance budget.** At the upper end of PHN-sized projects
    (~300 rooms × ~50 pumps), one read overlay = ~15k id lookups per
    response. Cheap. Worth measuring on a real document before
    committing to the inverse view in Phase 2, but no reason to expect
    trouble.

## 7. What this memo intentionally does not do

- Pick a phasing. The recommendation names a plausible 3-phase split
  but the PRD pass should re-examine it.
- Specify the wire shape, JSON Schema names, or API routes. Those land
  in the PRD + technical-requirements update once an approach is
  picked.
- Touch any code.
- Decide whether catalog-linking (linking project rows to global
  catalog records like `recXXX` material ids) should ride the same
  field type. That's a related but separable design question.
