---
DATE: 2026-06-08
TIME: -
STATUS: DRAFT — Approach-2 baseline committed (see options.md §5).
        Open questions are tracked in §11; each is resolved through
        a use-case conversation and the relevant section is updated
        in place when an answer lands. No code work begins until
        every Q1–Q10 anchor below is resolved (or explicitly
        deferred).
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
- **Catalog linking.** A linked-record cell points at another row in
  the *same* project document. Linking to global catalog records
  (Materials, Frame Types, Glazing Types) is a separate design.
- **Cross-project linking.** V2 has no cross-project queries; this
  feature does not change that.
- **Mass-assignment UI** ("link these 12 rooms to that pump in one
  shot"). The picker is single-cell. Bulk fill via fill-handle and
  paste is the same primitive as for any other field type.
- **Frontend-computed rollups.** All rollup math runs server-side via
  the existing formula evaluator. Frontend renders the computed
  overlay only.
- **MCP-driven schema mutation for linked-record fields** is in scope
  only to the extent the existing schema-mutation MCP tool already
  covers field add / edit / delete. No new MCP tools.

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
  cleanup. *(Resolution depends on Q5; current draft assumes
  silent-drop-with-toast.)*
- **US-LR-8 — Viewer mode.** Read-only viewers see linked-record
  pills, can navigate via pill click, and see inverse columns and
  rollups. They cannot open the picker.

## 4. Approach — committed

From `options.md §5`: a new closed-set `CustomFieldType.linked_record`
plugged into the existing `TableFieldRegistry`. The field's stored
value is `list[str]` of target row ids. The inverse view and rollups
are server-side read overlays — never double-stored.

Three implementation phases (sequencing TBD in `phases/`):

- **Phase 1 — Link values.** New field type; schema-mutation,
  document validation, frontend picker + pill renderer. No inverse
  view, no rollup. Cell navigation works in the source direction
  only.
- **Phase 2 — Inverse view.** Server-side read overlay projects
  incoming links onto the target table. Inverse column appears in
  the wire response; frontend renders identically to a source-side
  linked-record column except for being read-only.
- **Phase 3 — Rollups.** Formula grammar gains `linked_from(...)`
  (and possibly `linked(...)` for source-side rollups). Document-
  level formula cycle detection lands here.

## 5. Data model — committed shape

**Storage on the row.** Parallel `custom_links: dict[str, list[str]]`
bag, always list-shaped regardless of `max_links` (a single-link cell
is `[]` or `["pmp_xyz"]`). `CustomValue` stays scalar.

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

**Validator additions** in `validate_document_references`:

- Each `field_defs` entry of type `linked_record` must declare a
  `config.target_table_path` that resolves to a registered FieldDef-
  capable project-document table.
- `config.target_table_path` must NOT equal the field's own
  table_path (self-links disallowed per Q2).
- Each linked-record cell's id list must contain only ids that exist
  in the resolved target table at validate time (cascade behaviour
  per Q5).
- Cardinality respected per `config.max_links` (Q3).

**Inverse view (Phase 2)** is a per-request read overlay computed by
walking every linked-record field on every table. Shape: each target
row gains an `inverse_links` map keyed by source `<table>.<field_key>`
whose value is the list of source row ids pointing at this target.

## 6. API / wire surface

TBD when Q4 (storage shape) and Q5 (cascade) are resolved. Expect:

- Existing per-table slice-replace endpoints absorb the new
  `custom_links` bag without a new route.
- Existing schema-mutation surface gains `linked_record` as a valid
  `field_type` for `addField` / `changeType`.
- Existing read endpoints add the `inverse_links` overlay in Phase 2
  alongside the existing `rows_computed` overlay.

## 7. Frontend surface

TBD when storage shape and picker UX are resolved. Expect:

- `FieldType` union widens by one.
- `FieldConfigModal` exposes a target-table picker (only when the
  type picker is set to "linked record").
- New cell renderer (pill list using the linked row's `record_id`).
- New cell editor (modal record-picker reusing the catalog-picker
  shell).
- Formula editor (Phase 3) learns `linked_from(...)`.

## 8. Migration

- The pre-existing `RoomRow.erv_unit_ids: list[str]` typed column is
  **deleted outright** (Q7). No replacement FieldDef is seeded;
  editors add a `linked_record` field targeting `equipment.ervs`
  themselves if they want the relationship. The validator rule that
  rejected non-empty `erv_unit_ids` is removed in the same change.
- `ROOMS_TYPED_COLUMN_FIELD_KEYS` and
  `ROOMS_TYPED_COLUMN_FORMULA_TYPES` drop their `erv_unit_ids`
  entries.
- Pre-deploy posture (no production data) means no data-migration
  script is required; dev DBs rebuild on the schema-version bump
  (document `schema_version` goes from 4 → 5 when this feature
  lands).
- No other tables ship built-in linked-record FieldDefs at v1.

## 9. Phasing

See §4. Phase boundaries and concrete deliverables go in
`phases/phase-01-link-values.md` etc. once open questions are
resolved.

## 10. Acceptance criteria (v1 — Phases 1 + 2)

- Editor can add a linked-record column on any FieldDef-capable
  table targeting any permitted target table (Q1).
- Editor can link / unlink rows through the picker.
- Pills render the linked row's `record_id` and click-navigate.
- Wire response on the target table includes the inverse view.
- Validator rejects unknown target_table_path on field add.
- Validator handles orphan target ids per Q5.
- Frontend Viewer mode renders linked + inverse columns read-only.
- Document JSON download round-trips through validator on re-read.
- JSON Schema export includes the new field type.
- All `make ci` gates green.

Phase 3 acceptance criteria land in the Phase 3 plan.

## 11. Open questions (driving the use-case conversation)

Each anchor is resolved through a paired use-case discussion. When an
answer lands, the relevant section above is updated and the anchor is
marked **RESOLVED** with a one-line summary.

- **Q1. Allowable target tables.** **RESOLVED 2026-06-08:** open
  baseline. Every FieldDef-capable project-document table is a valid
  link target, with no curated per-table allow-list. Catalogs remain
  out of scope (see §2). If a recurring cross-link footgun emerges,
  a curation layer can be added later without reshaping the data
  model.

- **Q2. Self-links.** **RESOLVED 2026-06-08:** disallowed. The
  field-config modal hides the current table from the target-table
  dropdown; the validator rejects a `linked_record` field whose
  `config.target_table_path` equals the field's own table_path. If
  a same-table relation use case emerges later (e.g. Room ↔ Room
  "adjacent to") it can be reopened — closing it now keeps the
  rollup / cycle surface narrower.

- **Q3. Cardinality.** **RESOLVED 2026-06-08:** field config exposes
  a "Single record / Multiple records" toggle. **Default = single
  (`max_links: 1`)**; editor opts in to multi-link explicitly. No
  arbitrary numeric caps (`max_links: N>1` is not offered). Picker
  UX switches between radio (single) and checkbox (multi). The
  cell-write validator rejects writes that exceed the configured
  cap.

- **Q4. Storage shape inside the row.** **RESOLVED 2026-06-08:**
  parallel bag `custom_links: dict[str, list[str]]`, always list-
  shaped regardless of `max_links` config (a single-link cell is
  `[]` or `["pmp_xyz"]`). `CustomValue` stays scalar. The
  `TableFieldRegistry` gains `read_row_links` / `set_row_links`
  accessors mirroring the existing custom-values pair. Flipping a
  field's `max_links` config from `1` to `null` (or vice versa)
  requires no row-data migration — only the validator's cap check
  changes.

- **Q5. Cascade on delete.** **RESOLVED 2026-06-08:** permissive
  delete with read-time filter + lazy persistence cleanup (Stance
  2c). Deleting a target row replaces only the target table's slice;
  no cross-table cascade write. Every wire response (cells + inverse
  view) filters orphan ids against the live target table so the
  editor never sees a dangling pill. Whenever a source row is later
  saved, the validator silently strips orphan ids from its
  `custom_links` cells. No error is raised at any point; the save
  succeeds. An optional toast on delete ("Pump A removed; unlinked
  from 3 rooms") is a Phase-2 polish.

- **Q6. Validation timing.** **RESOLVED 2026-06-08:** split by error
  kind. **Shape errors** (not-a-list, wrong id prefix, exceeds
  `max_links`) fail-closed at every checkpoint — picker prevents at
  source, draft sync rejects malformed paste / fill / MCP writes,
  Save hard-fails (422). **Referential errors** (well-formed id whose
  target row doesn't exist) follow Q5: never blocking, orphans
  silently stripped at save time, save succeeds with the cleaned
  cells. The MCP response includes dropped ids in a `warnings`
  envelope so LLM clients can self-correct; editor-driven writes
  never trigger this because the picker only surfaces live rows.

- **Q7. Existing `erv_unit_ids` retirement.** **RESOLVED 2026-06-08:**
  delete the typed column entirely; do NOT seed any built-in
  linked-record FieldDef in its place. Every project starts with no
  linked-record fields; editors add the relationships they want
  through the field-config modal like any other custom field. The
  validator rule that rejected non-empty `erv_unit_ids` goes away,
  the `RoomRow.erv_unit_ids` Pydantic field is removed,
  `ROOMS_TYPED_COLUMN_FIELD_KEYS` / `ROOMS_TYPED_COLUMN_FORMULA_TYPES`
  drop the entry, and the document `schema_version` bumps from 4 →
  5. v1 ships with zero built-in linked-record FieldDefs anywhere;
  if PH-canonical built-in pairs become useful later they land as
  deliberate follow-ups.

- **Q8. Rollup grammar (Phase 3).** **RESOLVED 2026-06-08:** Phase 3
  ships `count`, `sum`, and `avg` only. Both directions are
  supported via two new formula primitives: `linked(<field_key>)`
  (forward — rows the current row's link field points at) and
  `linked_from(<table>, <field_key>)` (inverse — rows on another
  table that point at the current row). `min`, `max`, `concat`,
  `array_join`, `count_unique`, and boolean aggregators are deferred
  until a concrete PH use case justifies them. Phase 3 also lands
  document-level formula cycle detection (extension of the existing
  per-table check).

- **Q9. MCP write surface.** **RESOLVED 2026-06-08:** full read /
  write in Phase 1, riding the existing MCP tools. No new MCP tools.
  The existing schema-mutation tool admits `field_type:
  "linked_record"` and the existing cell-write tool admits the new
  `custom_links` bag. Safety boundaries are layered at the validator
  (Q2, Q3, Q5, Q6) so MCP inherits them automatically — bad ids get
  silently stripped with a `warnings` envelope, cap violations and
  self-link attempts hard-fail at 422. Audit-log + idempotency-key
  middleware covers the new field type the same as any other.
  A "preview write" tool (Option C in the use-case) is deferred —
  ship if Phase 2/3 LLM workflows show real friction.

- **Q10. Performance budget.** **RESOLVED 2026-06-08:** compute the
  inverse view on every read, no caching layer (Option A). Cost is
  bounded by document size (O(N + M) per linked-record field, not
  O(N×M)); even worst-case multifamily projects sit well under the
  per-request budget. **Measurement gate before Phase 2 ships:** a
  smoke-level perf test with a synthetic 4000-source-row ×
  50-target-row × 3-linked-field document must build the inverse
  view in under 50ms on the dev profile; CI fails if it regresses.
  If real telemetry ever shows >100ms p95, the cheap escalation is
  per-`(project_id, version_id)` memoization in Redis or in-process
  LRU — saved versions are immutable so cache hits would dominate.
  A relational sidecar index is explicitly out-of-scope because it
  reintroduces the relational shadow V2 was designed to avoid.
