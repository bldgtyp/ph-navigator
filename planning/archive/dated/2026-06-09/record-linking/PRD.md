---
DATE: 2026-06-08
TIME: -
STATUS: Complete and archived on 2026-06-09 for the canonical
        Rooms→Pumps record-linking workflow. Phase 1 + Phase 1.b
        source-side linking, Phase 2 inverse view, and the backend
        Phase 3 rollup/validator slice are implemented, manually
        verified, and green under `make format` / `make ci`. Deferred
        polish is tracked in `STATUS.md`.
AUTHOR: Ed May (with Claude)
SCOPE: Add AirTable-style record-linking between project-document
       tables in PHN V2 — a new user-creatable `linked_record` field
       type plus a server-side inverse view and (later) cross-table
       rollups via the existing formula evaluator.
RELATED: options.md (architecture options memo with the recommendation
                     this PRD builds on)
         context/PRD.md §6, §11.3
         context/technical-requirements/data-model.md §6.3, §6.6.3, §6.6.4
         context/technical-requirements/data-table.md
         backend/features/project_document/{document.py, custom_fields.py,
           tables/contracts.py, tables/rooms.py, tables/pumps.py}
---

# Record-linking — PRD

## 1. Goal

Let an editor add a "linked-record" column to any project-document
table the same way they add a single-select or number column today.
A linked-record cell holds one or more references to rows in a chosen
target table. The target table renders the inverse view (incoming
links) as a server-computed column. A later phase adds cross-table
rollups via the existing formula field type.

Concretely, the canonical user story:

> On the Rooms table, an editor adds a `Pump` column of type "linked
> record" targeting the Pumps table. They click a Room's `Pump` cell,
> pick one or more pumps from a search/pick dialog, and confirm. The
> Pumps table now shows, for each Pump, an inverse "Rooms" column
> listing every Room that points at it, plus an optional rollup such
> as "total wattage installed across linked rooms."

## 2. Non-goals (v1 of this feature)

- **Per-link metadata** ("how many of this Pump in this Room"). The
  link is a plain set of row ids. If per-link metadata becomes needed,
  the storage shape (§5) can grow without rewriting consumers — see
  options.md §4 Approach 3.
- **Catalog linking via this field type** (Q23). A linked-record cell
  points at another row in the *same* project document. Linking to
  global catalog records (Materials, Frame Types, Glazing Types) will
  ship as a *separate* field type (e.g. `linked_catalog_record`) if
  and when needed. `linked_record.config.target_table_path` will
  never accept catalog paths.
- **Cross-project linking.** V2 has no cross-project queries; this
  feature does not change that.
- **Dedicated mass-assignment UI** ("link these 12 rooms to that pump
  in one shot"). The picker is single-cell. Fill-handle drag and
  paste are the bulk primitives (Q24) and behave identically to the
  same primitives for any other field type. No bulk-link dialog.
- **Frontend-computed rollups.** All rollup math runs server-side via
  the existing formula evaluator. Frontend renders the computed
  overlay only.
- **MCP-driven schema mutation for linked-record fields** is in scope
  only to the extent the existing schema-mutation MCP tool already
  covers field add / edit / delete. No new MCP tools.
- **Manual pill reordering** (Q20). Insertion order is preserved on
  storage; the cell editor has no drag-to-reorder affordance in v1.
- **Editing `target_table_path` on an existing linked_record field**
  (Q13). The schema-mutation validator rejects it. To change a
  field's target, the editor deletes the field and re-adds with the
  new target.
- **Self-links** (Q2). Reopen trigger documented in Q22 below.

## 3. User stories

- **US-LR-1 — Add a linked-record column.** Editor opens any FieldDef-
  capable table, opens the field-config modal, picks "linked record"
  as the type, picks a target table from a dropdown of permitted
  targets, names the field, and saves. The new column appears with
  empty cells.
- **US-LR-2 — Link a row.** Editor clicks a linked-record cell and
  the record-picker dialog opens, showing the target table's rows by
  `record_id` with a search box. Editor picks one or more rows and
  confirms. The cell renders the picked rows as a pill list.
- **US-LR-3 — Inverse view.** Without any editor action on the target
  table, the target table renders an inverse column (named after the
  source field) showing every row in the source table that links to
  this target row.
- **US-LR-4 — Navigate.** Clicking a pill in either direction jumps
  to the linked row in its native table.
- **US-LR-5 — Unlink.** Editor opens a linked cell, deselects a row in
  the picker (or hits ⌫ on the pill), confirms. The row disappears
  from both directions on save.
- **US-LR-6 — Rollup *(Phase 3 only)*.** Editor adds a `formula`
  column on the target table whose source references
  `linked_from(<source_table>, <source_field_key>).<field_key>` with
  a `count`, `sum`, or `avg` aggregator. The cell renders the
  computed value per target row.
- **US-LR-7 — Survive a target delete.** Editor deletes a target row
  that incoming links point at; on next save the orphan ids are
  silently dropped from every source cell and a toast surfaces the
  cleanup. *(Per Q5: read filter is against the snapshot being read,
  not "the live target table" — see Q5 below.)*
- **US-LR-8 — Viewer mode.** Read-only viewers see linked-record
  pills, can navigate via pill click, and see inverse columns and
  rollups. They cannot open the picker.
- **US-LR-9 — Bulk fill via fill-handle.** Editor links one Room to
  Pump A, then drags the fill-handle down 50 rows. All 50 destination
  rows now point at Pump A (full id-list copy, not union — see Q24).

## 4. Approach — committed

From `options.md §5`: a new closed-set `CustomFieldType.linked_record`
plugged into the existing `TableFieldRegistry`. The field's stored
value is `list[str]` of target row ids. The inverse view and rollups
are server-side read overlays — never double-stored.

Three implementation phases (sequencing TBD in `phases/`):

- **Phase 1 — Link values.** New field type; schema-mutation,
  document validation, frontend picker + pill renderer. No inverse
  view, no rollup. Cell navigation works in the source direction
  only. Phase 1 also lands the shared `RowWithCustomFields` mixin /
  `_validate_rows_custom_links` validator refactor and the
  `link_targetable` flag on `TableContract` (Q15).
- **Phase 2 — Inverse view.** Server-side read overlay projects
  incoming links onto the target table. Inverse column appears in
  the wire response; frontend renders identically to a source-side
  linked-record column except for being read-only. Phase 2 lands
  cross-table ETag invalidation (Q14) and the per-request inverse-
  view perf gate (Q27).
- **Phase 3 — Rollups.** Formula grammar gains `linked_from(...)`
  (and possibly `linked(...)` for source-side rollups). Document-
  level formula cycle detection lands here, structured as a
  topological sort across the document's formula graph treating
  `linked_from` / `linked` edges as dependencies (Q26).

## 5. Data model — committed shape

**Storage on the row.** Parallel `custom_links: dict[str, list[str]]`
bag, always list-shaped regardless of `max_links` (a single-link cell
is `[]` or `["pmp_xyz"]`). `CustomValue` stays scalar. **A given
`field_key` appears in exactly one of `custom_values` /
`custom_links`** based on its FieldDef's `field_type`; the validator
rejects co-existence in both bags (Q16). Insertion order in the list
is preserved across save round-trips (Q20).

```jsonc
// inside a RoomRow:
{
  "id": "rm_abc",
  "floor_level": "opt_...",         // existing typed column
  "custom_values": {                 // unchanged scalar bag
    "cf_wattage": 240
  },
  "custom_links": {                  // NEW — link ids only
    "cf_pumps":        ["pmp_xyz", "pmp_qrs"],   // multi-link
    "cf_assigned_erv": ["erv_001"],              // single-link, len 1
    "cf_unused":       []                         // single-link, empty
  }
}
```

To keep the row-model surface small across the nine `*Row` models, a
shared `RowWithCustomFields` Pydantic mixin owns both `custom_values`
and `custom_links` with their default factories. Each row class
inherits the mixin (see §9 Phase 1 deliverables).

**Field definition.** A new entry in the table's `field_defs` array:

```jsonc
{
  "field_key":   "cf_<ulid>",
  "field_type":  "linked_record",
  "display_name":"Pump",
  "config":      {
    "target_table_path": ["equipment", "pumps"],
    "max_links":         1            // default single; null = unbounded multi
  },
  "default":     null,
  "origin":      "custom",
  "created_at":  "...",
  "created_by":  "..."
}
```

The schema fingerprint includes both `config.target_table_path` and
`config.max_links` (Q11). Renaming `display_name` does not change the
fingerprint; re-targeting or changing cardinality does — and
re-targeting is rejected at the schema-mutation validator anyway
(Q13).

**CustomFieldType enum** gains one member:

```python
class CustomFieldType(StrEnum):
    short_text    = "short_text"
    long_text     = "long_text"
    number        = "number"
    url           = "url"
    single_select = "single_select"
    color         = "color"
    formula       = "formula"
    linked_record = "linked_record"   # NEW
```

`linked_record` is **unlocked** for `changeType` (not added to any
`field_type_locked_keys`) — the editor can retype a custom
linked-record field to any other type, and vice versa. Row data on
both sides of the bag boundary is wiped for that `field_key` on
changeType (Q12), the same precedent as `single_select` → `number`
clearing the option id.

**`TableContract` gains `link_targetable: bool = True`** (Q15). Every
FieldDef-capable table opts in by default; future per-table opt-outs
are a one-line change without reshaping the data model. The
field-config modal's target-table dropdown lists only contracts where
`link_targetable is True` and `table_path != self`.

**Validator additions** in `validate_document_references`:

- Each `field_defs` entry of type `linked_record` must declare a
  `config.target_table_path` that resolves to a registered FieldDef-
  capable project-document table whose contract has
  `link_targetable=True`.
- `config.target_table_path` must NOT equal the field's own
  `table_path` (self-links disallowed per Q2 / Q22).
- A given `field_key` on a row must appear in `custom_values` XOR
  `custom_links` based on its FieldDef's `field_type`; co-existence
  is rejected (Q16).
- Each linked-record cell's id list contains only ids that exist in
  the resolved target table at validate time, **filtered against the
  snapshot being read** (Q5 amendment, see Q5 below). Orphans are
  silently stripped on save.
- Cardinality respected per `config.max_links` (Q3).
- Within-cell duplicates are silently deduped — `["x", "x"]` becomes
  `["x"]` without error (Q25).

The shared validator helper `_validate_rows_custom_links` mirrors the
existing `_validate_rows_custom_values` so per-table validation stays
declarative.

**Inverse view (Phase 2)** is a per-request read overlay computed by
walking every linked-record field on every table. Shape: each target
row gains an `inverse_links` map keyed by `<source_table>.<field_key>`
whose value is the list of source row ids pointing at this target.
Render-time the frontend headers this column as `<source_table_
display> ← <source_field_display_name>` (e.g. "Rooms ← Pump") so
multiple incoming links from the same source table disambiguate
visually (Q21). The inverse overlay rides alongside the existing
`rows_computed` overlay on the table's wire response.

## 6. API / wire surface

**Cell write op.** A single `cell` `WriteOp` variant (Q11). The
existing `cell` op gains a `linked_ids: list[str] | None` field
alongside the scalar value slot. The validator dispatches by the
resolved FieldDef's `field_type`: if `field_type is linked_record`
the write reads `linked_ids` and writes to `row.custom_links`; for
any other type it reads the scalar slot and writes to
`row.custom_values`. A write that supplies the wrong slot for the
field's type is rejected at draft sync with `422 invalid_cell_value`.
No new op type; one cell write, one cell undo, one cell paste path,
one MCP tool — all already exist.

**Schema mutation.** The existing schema-mutation surface gains
`linked_record` as a valid `field_type` for `addField` and
`changeType`:

- `addField`: validates `config.target_table_path` resolves, target
  contract is `link_targetable`, and target is not self.
- `changeType to linked_record` (or away from it): row data for that
  `field_key` is wiped on both bags on every row in the same
  transaction (Q12). The mutation's response includes the count of
  cleared rows in its standard `summary` envelope.
- `editField` rejects any change to `config.target_table_path` for
  linked-record fields (Q13). `config.max_links` is freely editable
  (no row migration needed per Q4); the validator's cap check is the
  only consumer of that config field.

**Per-table replace endpoints** absorb the new `custom_links` bag
without a new route; the request model widens by one optional field.

**ETag / inverse fingerprint scope.** The API currently exposes
document-level `version_etag` / `draft_etag`, not per-table ETags.
Source writes rotate those document-level ETags as before. Target
table responses additionally expose `inverse_links_fingerprint`, a
content hash of every incoming linked-record field's id-list contents
from every source table that targets it (Q14). A write on Rooms that
touches `cf_pumps` therefore changes the document ETag and the Pumps
`inverse_links_fingerprint`. Without this, a client with a cached
Pumps response would not have a stable inverse-content change signal.

**Diff.** `diff.py` renders `custom_links.<field_key>` changes as
list-aware add/remove pairs over the id arrays — the same shape it
uses for the namespaced single_select option list today. Pill-aware
rendering (resolving ids to `record_id`) is a frontend concern; the
backend diff stays id-level.

**Inverse view (Phase 2).** Read endpoints add an `inverse_links`
overlay on the target table's wire response alongside the existing
`rows_computed` overlay. Overlay shape per row:

```jsonc
{
  "id": "pmp_xyz",
  ...,
  "inverse_links": {
    "rooms.cf_pumps": ["rm_a", "rm_b", "rm_c"]
  }
}
```

## 7. Frontend surface

- `FieldType` union widens by one.
- `FieldConfigModal` exposes a target-table picker (only when the
  type picker is set to "linked record"). Dropdown lists every
  `TableContract` where `link_targetable=True` and `table_path` is
  not the current table's path. A cardinality toggle ("Single record
  / Multiple records") sets `max_links` to `1` or `null`; default is
  Single (Q3).
- **Cell renderer** is a pill list using the target row's `record_id`
  field. When `record_id` is empty / null, the pill falls back to the
  row id (e.g. `pmp_a1b2`) rendered in a muted/italic style (Q18).
  Multi-link cells wrap pills inside the cell; the row height
  expands. No truncation in v1.
- **Cell editor** is a modal record-picker. Columns: `record_id` and
  the target table's `display_name` field if present. Search:
  case-insensitive substring on `record_id` (using the document's
  existing display-name normalization). Sort: `record_id` ascending.
  Past 100 candidate rows the picker virtualizes (Q17). "Show which
  source rows already link to this target" is a Phase-2 polish, not
  v1. Reuses the catalog-picker modal shell.
- **Pill click navigation** routes to the target table with
  `?focus=<row_id>` (Q19). The destination table reads `focus` on
  mount, scrolls to that row, and applies a transient highlight
  class. This reuses the existing route-with-query primitive — no
  new routing infrastructure.
- **Inverse column header** is rendered as `<source_table_display>
  ← <source_field_display_name>` so two source fields from the same
  source table disambiguate (Q21).
- **Fill-handle drag** copies the source cell's full id list to every
  destination cell (Q24). No union with existing destination
  contents, no dedupe across cells. Same as how fill-handle copies
  `single_select` option ids today.
- **Paste** between linked-record cells succeeds only when source and
  destination `target_table_path` match. Mismatched paths reject at
  draft sync (`422 invalid_cell_value`). Paste of non-link types
  into a link cell, or of stringified pill text, rejects (Q24).
- **WriteOp** rides the existing `cell` op variant (per §6 / Q11).
- **Formula editor (Phase 3)** learns `linked_from(...)` and
  `linked(...)` ref completion from a new `FieldRegistryEntry` kind.
- **Picker for viewer mode** does not open; pills still click-
  navigate.

## 8. Migration

- The pre-existing `RoomRow.erv_unit_ids: list[str]` typed column is
  **deleted outright** (Q7). No replacement FieldDef is seeded;
  editors add a `linked_record` field targeting `equipment.ervs`
  themselves if they want the relationship. The validator rule that
  rejected non-empty `erv_unit_ids` is removed in the same change.
- `ROOMS_TYPED_COLUMN_FIELD_KEYS` and
  `ROOMS_TYPED_COLUMN_FORMULA_TYPES` drop their `erv_unit_ids`
  entries.
- Every dev seed, test fixture, factory, and JSON fixture that
  references `erv_unit_ids` is purged in the same change. Fixture
  sweep runs in lockstep with the `schema_version 4 → 5` bump so CI
  stays green on a single commit.
- Pre-deploy posture (no production data) means no data-migration
  script is required; dev DBs rebuild on the schema-version bump.
- No other tables ship built-in linked-record FieldDefs at v1.
- **HBJSON / download export** (Q28): the document JSON download
  emits raw id arrays in `custom_links`. Round-trips cleanly through
  the validator on re-read. Downstream HBJSON / PHX / WUFI export is
  a downstream consumer concern and is **not in this feature's
  scope**. If downstream consumers want resolved row data inlined,
  they dereference using the same document.

## 9. Phasing

See §4. Phase boundaries and concrete deliverables go in
`phases/phase-01-link-values.md` etc. once phase plans are written.
Notable cross-phase deliverables:

- **Phase 1 also lands**: shared `RowWithCustomFields` mixin
  across the nine `*Row` models, shared `_validate_rows_custom_links`
  helper, and the `link_targetable: bool` flag on `TableContract`
  (defaults `True` on every existing contract).
- **Phase 2 also lands**: inverse-link fingerprinting for target-table
  read responses (Q14) and the perf gate fixture + CI assertion (Q27).
- **Phase 3 also lands**: document-level formula cycle detector
  structured as a topological sort over the formula graph (Q26).

## 10. Acceptance criteria (v1 — Phases 1 + 2)

- [x] Editor can add a linked-record column on any FieldDef-capable
  `link_targetable` table targeting any permitted target table (Q1,
  Q15). Backend contract is general; frontend has been manually
  verified for the canonical Rooms→Pumps path. Other target page
  wiring is deferred until those targets need first-class navigation.
- [x] Editor can link / unlink rows through the picker for
  Rooms→Pumps.
- [x] Pills render the linked row's `record_id` (with row-id fallback
  when `record_id` is empty per Q18) and click-navigate via the
  `?focus=` query param (Q19) for Rooms→Pumps.
- [x] Wire response on the target table includes the inverse view
  (Phase 2) for the current canonical Rooms→Pumps target surface.
- [x] Validator rejects unknown `target_table_path` on field add.
- [x] Validator rejects editing `target_table_path` on an existing
  linked_record field (Q13).
- [x] Validator rejects a `field_key` co-existing in `custom_values`
  and `custom_links` (Q16).
- [x] Validator silently dedupes within-cell duplicate ids (Q25).
- [x] Validator handles orphan target ids per Q5 (filter against the
  snapshot being read; strip silently on save).
- [x] changeType to/from `linked_record` wipes row data for that
  `field_key` on both bag sides and reports the cleared row count in
  the mutation summary (Q12).
- [x] deleteField for `linked_record` removes row data for that
  `field_key` on both bag sides. Regression coverage:
  `test_project_document_linked_record.py::TestDeleteFieldDispatcher`.
- [x] Source-table writes that touch `custom_links` change the target
  table response's `inverse_links_fingerprint` (Q14). API-shape
  adjustment: write concurrency still uses document-level
  `version_etag` / `draft_etag`, not per-table ETags.
- [x] Fill-handle drag copies the full id list to destination cells;
  no union with existing contents (Q24).
- [x] Paste between linked-record cells of matching
  `target_table_path` succeeds; mismatched paths reject at draft sync
  with `422` (Q24).
- [x] Frontend Viewer mode renders linked + inverse columns read-only
  for the current Rooms→Pumps surface.
- [x] Document JSON download round-trips persisted `custom_links`
  through validator on re-read.
- [x] **Deferred** — JSON Schema export includes the new field type and the
  `custom_links` row shape (`dict[str, list[str]]` with id pattern).
  No generated schema artifact is currently shipped; regenerate/audit
  when PHN publishes a schema artifact.
- [x] **Deferred** — Diff between two versions renders `custom_links.<field_key>`
  changes as list-aware add/remove pairs. Acceptance audit still
  needed when linked-record diffs become a user-facing review surface.
- [x] **Phase 2 perf gate (Q27):** total inverse-view build for a
  single read response on the pinned synthetic fixture (4000 source
  rows × 50 target rows × 3 linked fields, plus 5 additional tables
  each with 200 rows × 1 linked field) completes in under 100ms on the
  pinned CI runner class. Direct local perf test exists and passes;
  current full CI closeout is green.
- [x] All `make ci` gates green. Current checkout passed `make ci` on
  2026-06-09; `make format` left files unchanged.

Phase 3 acceptance criteria live in the Phase 3 plan. Closeout status:
backend parsing/evaluation, author-time linked-ref validation, and
document-level cross-table cycle detection are implemented and covered
by `test_project_document_record_linking_rollups.py`. Frontend formula
authoring/completion, JSON Schema regeneration, and the extended
combined perf gate are deferred follow-ups.

## 11. Open questions

Each anchor is resolved through a paired use-case discussion (Q1–Q10)
or through the PRD review pass (Q11–Q28). When an answer lands, the
relevant section above is updated and the anchor is marked
**RESOLVED** with a one-line summary.

### Use-case-driven (Q1–Q10)

- **Q1. Allowable target tables.** **RESOLVED 2026-06-08:** open
  baseline. Every FieldDef-capable project-document table with
  `link_targetable=True` is a valid link target, with no curated
  per-table allow-list. Catalogs remain out of scope (see §2). The
  `link_targetable` flag (Q15) is the one-line opt-out path if a
  recurring cross-link footgun emerges.

- **Q2. Self-links.** **RESOLVED 2026-06-08:** disallowed. The
  field-config modal hides the current table from the target-table
  dropdown; the validator rejects a `linked_record` field whose
  `config.target_table_path` equals the field's own table_path. See
  Q22 for the reopen trigger.

- **Q3. Cardinality.** **RESOLVED 2026-06-08:** field config exposes
  a "Single record / Multiple records" toggle. **Default = single
  (`max_links: 1`)**; editor opts in to multi-link explicitly. No
  arbitrary numeric caps (`max_links: N>1` is not offered). Picker
  UX switches between radio (single) and checkbox (multi). The
  cell-write validator rejects writes that exceed the configured
  cap.

- **Q4. Storage shape inside the row.** **RESOLVED 2026-06-08:**
  parallel bag `custom_links: dict[str, list[str]]`, always list-
  shaped regardless of `max_links` config. `CustomValue` stays
  scalar. The `TableFieldRegistry` gains `read_row_links` /
  `set_row_links` accessors mirroring the existing custom-values
  pair. Flipping a field's `max_links` config from `1` to `null`
  (or vice versa) requires no row-data migration — only the
  validator's cap check changes.

- **Q5. Cascade on delete.** **RESOLVED 2026-06-08 (amended):**
  permissive delete with read-time filter + lazy persistence cleanup
  (Stance 2c). Deleting a target row replaces only the target
  table's slice; no cross-table cascade write. **Amendment:** every
  wire response (cells + inverse view) filters orphan ids against
  *the snapshot being read*, not "the live target table." For draft
  reads "the snapshot" is the current draft state; for saved-version
  reads it is the rows present in that immutable version. This means
  reading version N six months from now will still surface the link
  ids that were valid in version N's snapshot, even if those target
  rows have been deleted from later drafts. Whenever a source row is
  later saved, the validator silently strips orphan ids from its
  `custom_links` cells (current-draft snapshot only). An optional
  toast on delete ("Pump A removed; unlinked from 3 rooms") is a
  Phase-2 polish.

- **Q6. Validation timing.** **RESOLVED 2026-06-08:** split by error
  kind. **Shape errors** (not-a-list, wrong id prefix, exceeds
  `max_links`, wrong cell-write slot per Q11, mismatched
  `target_table_path` on paste per Q24) fail-closed at every
  checkpoint — picker prevents at source, draft sync rejects
  malformed paste / fill / MCP writes, Save hard-fails (422).
  **Referential errors** (well-formed id whose target row doesn't
  exist in the snapshot) follow Q5: never blocking, orphans silently
  stripped at save time, save succeeds with the cleaned cells. The
  MCP response includes dropped ids in a `warnings` envelope so LLM
  clients can self-correct; editor-driven writes never trigger this
  because the picker only surfaces live rows.

- **Q7. Existing `erv_unit_ids` retirement.** **RESOLVED 2026-06-08:**
  delete the typed column entirely; do NOT seed any built-in
  linked-record FieldDef in its place. Every project starts with no
  linked-record fields; editors add the relationships they want
  through the field-config modal like any other custom field. The
  validator rule that rejected non-empty `erv_unit_ids` goes away,
  the `RoomRow.erv_unit_ids` Pydantic field is removed,
  `ROOMS_TYPED_COLUMN_FIELD_KEYS` / `ROOMS_TYPED_COLUMN_FORMULA_TYPES`
  drop the entry, every fixture / seed / factory referencing
  `erv_unit_ids` is purged in lockstep, and the document
  `schema_version` bumps from 4 → 5. v1 ships with zero built-in
  linked-record FieldDefs anywhere; if PH-canonical built-in pairs
  become useful later they land as deliberate follow-ups.

- **Q8. Rollup grammar (Phase 3).** **RESOLVED 2026-06-08:** Phase 3
  ships `count`, `sum`, and `avg` only. Both directions are
  supported via two new formula primitives: `linked(<field_key>)`
  (forward — rows the current row's link field points at) and
  `linked_from(<table>, <field_key>)` (inverse — rows on another
  table that point at the current row). `min`, `max`, `concat`,
  `array_join`, `count_unique`, and boolean aggregators are deferred
  until a concrete PH use case justifies them. Phase 3 also lands
  document-level formula cycle detection (see Q26 for evaluation-
  order shape).

- **Q9. MCP write surface.** **RESOLVED 2026-06-08:** full read /
  write in Phase 1, riding the existing MCP tools. No new MCP tools.
  The existing schema-mutation tool admits `field_type:
  "linked_record"` and the existing cell-write tool admits the new
  `linked_ids` slot on the `cell` op (Q11). Safety boundaries are
  layered at the validator (Q2, Q3, Q5, Q6, Q16, Q25) so MCP
  inherits them automatically — bad ids get silently stripped with a
  `warnings` envelope, cap violations and self-link attempts hard-
  fail at 422. Audit-log + idempotency-key middleware covers the new
  field type the same as any other. A "preview write" tool (Option C
  in the use-case) is deferred — ship if Phase 2/3 LLM workflows
  show real friction.

- **Q10. Performance budget.** **RESOLVED 2026-06-08 (superseded by
  Q27).** See Q27 for the sharpened gate.

### Implementation-shape decisions (Q11–Q28)

- **Q11. Cell write-op wire shape.** **RESOLVED 2026-06-08:** single
  `cell` `WriteOp` variant carries both scalar and link payloads.
  Adds `linked_ids: list[str] | None` to the existing op alongside
  the scalar value slot. The validator dispatches by the resolved
  FieldDef's `field_type` — `linked_record` writes go to
  `row.custom_links`, every other type goes to `row.custom_values`.
  Wrong-slot writes reject at draft sync (`422
  invalid_cell_value`). One op, one undo, one paste path, one MCP
  tool. Rejected the alternative `cellLink` op variant because it
  would fork the entire WriteOp pipeline for no payoff over a single
  optional field on the existing op.

- **Q12. changeType across the bag boundary.** **RESOLVED 2026-06-08:**
  changeType to/from `linked_record` (in either direction) wipes the
  row data for that `field_key` on **both** bag sides on every row
  in the same transaction. Precedent: `single_select → number`
  already clears the option id today. The mutation's response
  includes the cleared row count in its `summary` envelope so the
  editor can see what was lost. linked-record fields are
  **unlocked** for changeType — they live in
  `field_type_locked_keys` for built-ins only (none ship in v1).

- **Q13. Editing `target_table_path` on an existing linked-record
  field.** **RESOLVED 2026-06-08:** rejected at the schema-mutation
  validator. The editor must delete the field and re-add with the
  new target. The "smart re-target with orphan strip" alternative
  is deferred until a real use case surfaces — closing it now keeps
  the schema-mutation surface narrow and avoids a quietly-destructive
  edit path. `config.max_links` remains freely editable.

- **Q14. Target-table inverse fingerprint.** **RESOLVED 2026-06-09:**
  the API does not expose per-table ETags. Source writes rotate the
  document-level `version_etag` / `draft_etag` as before. Target table
  responses additionally expose `inverse_links_fingerprint`, a content
  hash of every incoming linked-record field's id-list contents from
  every source table that targets it. A write to Rooms that touches
  `cf_pumps` therefore changes the document ETag and the Pumps
  inverse fingerprint. The hash is cheap (one pass over each source
  table's `custom_links` slice keyed by target path). Without this, a
  cached Pumps response would not have a stable inverse-content change
  signal. Regression tests assert the fingerprint changes only when
  the target table's incoming links change.

- **Q15. `link_targetable` per-table opt-out flag.** **RESOLVED
  2026-06-08:** every `TableContract` gains `link_targetable: bool
  = True`. Phase 1 ships every existing FieldDef-capable contract
  with the default `True`. Future per-table opt-outs (e.g.
  Attachments, Thermal Bridges, anything we decide shouldn't be a
  user-facing link target) are a one-line change. Cheap to add now,
  expensive to retrofit later.

- **Q16. Bag exclusivity.** **RESOLVED 2026-06-08:** a `field_key`
  may appear in exactly one of `custom_values` / `custom_links`
  based on its FieldDef's `field_type`. The validator rejects
  co-existence with `invalid_project_document`. Prevents drift
  between the two bags on a changeType-during-merge race.

- **Q17. Picker UX defaults.** **RESOLVED 2026-06-08:** columns =
  target row's `record_id` + the target table's `display_name`
  field if present. Search = case-insensitive substring on
  `record_id` using the document's existing display-name
  normalization. Sort = `record_id` ascending. Virtualize past 100
  candidate rows. "Show which source rows already link to this
  target" is a Phase-2 polish — useful, but not v1-blocking.

- **Q18. Pill fallback when `record_id` is empty.** **RESOLVED
  2026-06-08:** the pill renders the row id (e.g. `pmp_a1b2`) in
  muted / italic style. Same fallback in the picker. Prevents blank
  pills when an editor adds a linked-record field before backfilling
  the target table's `record_id` formula inputs.

- **Q19. Pill click navigation.** **RESOLVED 2026-06-08:** pill
  click routes to the target table with `?focus=<row_id>`. The
  destination table reads `focus` on mount, scrolls to that row,
  and applies a transient highlight class. Reuses the existing
  route-with-query primitive. No new routing infrastructure.

- **Q20. Pill ordering.** **RESOLVED 2026-06-08:** insertion order
  preserved on storage. No manual drag-to-reorder affordance in v1.
  If a use case surfaces (e.g. "primary pump must be listed first")
  it can ship as a Phase-2 polish; storage doesn't change.

- **Q21. Inverse-column header naming.** **RESOLVED 2026-06-08:**
  header reads `<source_table_display> ← <source_field_display_
  name>` (e.g. "Rooms ← Pump"). Lives in the `inverse_links`
  overlay namespace so structural collision is impossible; only the
  rendered header needs disambiguation. Two source fields from the
  same source table targeting the same target table therefore read
  as "Rooms ← Primary Pump" and "Rooms ← Backup Pump."

- **Q22. Self-link reopen trigger.** **RESOLVED 2026-06-08:**
  deferred use cases that would justify reopening Q2 include
  Room ↔ Room adjacency (heat flow through internal partitions —
  Phius / PHI care about this), Aperture ↔ Aperture twinning,
  Pump ↔ Pump primary/backup chains. Re-open when any of these
  becomes a real product ask. Cost to reopen: remove the validator
  block, ship an `allow_self: bool` config flag on the field, and
  lean on the document-level cycle detector already landing in
  Phase 3 (Q26).

- **Q23. Catalog linking direction.** **RESOLVED 2026-06-08:**
  catalog linking will ship as a *separate* field type (working
  name `linked_catalog_record`) when a use case demands it. Do not
  extend `linked_record.config.target_table_path` to accept catalog
  paths. Reason: catalog records are global, addressed by `rec*`
  ids, lifecycle is decoupled from the project document, and
  validation must hit the catalog read-model rather than walking
  the document. Sharing the field type would conflate two storage
  shapes inside one type.

- **Q24. Fill-handle and paste semantics.** **RESOLVED 2026-06-08:**
  fill-handle drag copies the source cell's full id list to every
  destination cell. No union with existing destination contents, no
  cross-cell dedupe. Same as how fill copies `single_select` ids
  today. Paste between linked-record cells of matching
  `target_table_path` succeeds; mismatched paths reject at draft
  sync with `422 invalid_cell_value`. Paste of non-link cell types
  into a link cell rejects. Paste of stringified pill text rejects
  (no parsing of `"Pump A, Pump B"` into ids). The non-goal in §2
  is reworded accordingly — fill and paste *are* the bulk
  primitives.

- **Q25. MCP within-cell dedupe.** **RESOLVED 2026-06-08:**
  validator silently dedupes within-cell duplicates: `["x", "x"]`
  becomes `["x"]` without error or warning. Across-cell consistency
  (e.g. "Pump A linked from 47 rooms") is the editor's
  responsibility and is exposed visually through the inverse view.
  Cap violations (over `max_links`) still hard-fail at 422.

- **Q26. Cross-table formula evaluation order (Phase 3).**
  **RESOLVED 2026-06-08 (shape only):** evaluation is a topological
  sort across the document's formula graph treating `linked_from`
  and `linked` edges as dependencies in addition to the existing
  per-table ref edges. Cycles reject at `validate_document_
  references` with a hard error (not silently absorbed). The Phase 3
  plan owns implementation details (graph construction, cache
  shape, error envelope). Locking the *shape* now lets Phase 2 plan
  the inverse-view overlay without locking in a structure that
  conflicts.

- **Q27. Performance gate sharpening.** **RESOLVED 2026-06-08:**
  - **Gate is per request, not per inverse build.** The total
    inverse-view build time across all tables in a single read
    response must complete in **under 100ms** on the pinned CI
    profile.
  - **Pinned fixture**, committed as a test asset: 4000 source rows ×
    50 target rows × 3 linked-record fields (the "fat single
    relation" worst case), plus 5 additional tables each with 200
    rows × 1 linked-record field (the "broad cross-linking" case).
  - **Profile pin**: GitHub Actions `ubuntu-latest` (current
    pinned runner class for `make ci`). If we change runner class,
    we re-baseline.
  - **Regression check**: CI fails if the measured time exceeds the
    rolling baseline by >20% on 3 consecutive CI runs. Single-run
    spikes do not fail (flake tolerance).
  - **Escalation path**: if real telemetry ever shows >100ms p95 in
    production, ship per-`(project_id, version_id, document_hash)`
    in-process LRU. Saved versions are immutable so cache hits would
    dominate. A relational sidecar index is explicitly out-of-scope.

- **Q28. HBJSON / download export of linked-record cells.**
  **RESOLVED 2026-06-08:** the document JSON download emits raw id
  arrays in `custom_links` as-is. Round-trips cleanly through the
  validator on re-read. Downstream HBJSON / PHX / WUFI export is a
  downstream consumer concern and is **out of scope** for this
  feature. If downstream consumers want resolved row data inlined
  alongside the ids, they dereference using the same document
  they're already reading. Keeps this feature decoupled from the
  honeybee-ph / PHX export surface.
