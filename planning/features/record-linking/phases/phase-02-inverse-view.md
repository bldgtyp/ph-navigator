---
DATE: 2026-06-08
TIME: planning
STATUS: COMPLETE for the current link-target surface (canonical
        Rooms→Pumps). Focused backend/frontend checks pass. Browser
        smoke/e2e evidence is recorded by
        `frontend/tests/e2e/record-linking-rooms-pumps.spec.ts` with
        screenshots under `../assets/e2e/rooms-pumps/`.
AUTHOR: Ed May (with Claude)
SCOPE: Server-computed inverse view: target tables surface "incoming
       links" as read-only columns, target-table inverse fingerprints
       land, perf gate ships as a CI assertion.
RELATED:
  - planning/features/record-linking/PRD.md §4 (Phase 2), §5 (inverse
    view section), §6 (ETag + inverse overlay), §10 acceptance,
    §11 Q14, Q21, Q27 (inverse fingerprint, header naming, perf gate)
  - planning/features/record-linking/phases/phase-01-link-values.md
  - context/technical-requirements/data-model.md §6.3, §6.6.4
  - context/technical-requirements/data-table.md
  - backend/features/project_document/tables/contracts.py
    (`default_attach_computed_overlay`)
  - backend/features/project_document/validation.py (ETag /
    fingerprint surface)
  - backend/features/project_document/repository.py
---

# Record-linking Phase 2 — Inverse view + perf gate

## P0. Why this slice

Phase 1 made `linked_record` a working source-side field with no
visible effect on the target table. Phase 2 closes the loop:

- the target table's wire response gains a top-level `inverse_links`
  overlay alongside the existing `rows_computed` overlay;
- the frontend renders inverse columns as **read-only pill lists**
  with headers like `Rooms ← Pump`;
- the target table response includes an `inverse_links_fingerprint`
  content hash of every incoming `custom_links` field; concurrency
  remains on the existing document-level `version_etag` /
  `draft_etag`;
- the perf gate (PRD Q27) lands as a CI assertion on a committed
  synthetic fixture.

After Phase 2, the user-visible flow matches the PRD's canonical
story: a pump shows the rooms that point at it without any data
duplication. Phase 3 then adds the *math* on top (count / sum /
avg via formula).

## P1. Source review notes

Use `PRD.md` §11 Q14, Q21, and Q27 as the canonical contract.
Phase 2 does **not**:

- introduce any new write paths (no inverse-side editing);
- change the storage shape from Phase 1;
- add formula grammar — Phase 3 owns that;
- ship Redis or any caching layer. The perf gate uses the
  document-walk implementation; the escalation path (in-process
  LRU) is documented in Q27 but only triggered by real telemetry.

Decisions already locked:

- **Read overlay shape** (PRD §5 inverse-view section).
  ```jsonc
  // per target row, alongside `rows_computed`
  "inverse_links": {
    "rooms.cf_pumps": ["rm_a", "rm_b", "rm_c"]
  }
  ```
  Key is `<source_table>.<source_field_key>`, value is the list of
  source row ids whose `custom_links[field_key]` contains this
  target row's id.
- **Header rendering** (Q21): `<source_table_display> ← <source_
  field_display_name>`. Two fields from the same source table
  targeting the same target table disambiguate by source field
  display_name: "Rooms ← Primary Pump", "Rooms ← Backup Pump".
- **ETag / fingerprint scope** (Q14): this API does not currently
  expose per-table ETags. Source writes rotate the document-level
  draft/version ETags as before; target-table responses additionally
  expose `inverse_links_fingerprint`, a stable hash of incoming
  linked-record id-list content from every source table that targets
  that table.
- **Perf gate** (Q27): per-request, <100ms total inverse build on
  pinned CI runner + pinned fixture, regression check fails if
  >20% over baseline on 3 consecutive CI runs.
- **Read-time filter** (PRD Q5 amendment): inverse view filters
  against the snapshot being read, not "the live target table."
  For draft reads this means the current draft; for saved-version
  reads it means rows present in that immutable version.

## P2. Acceptance — Phase 2 done when

1. The current link-target surface's wire response (Pumps, plus the
   generic Rooms response hook for future sources) carries an
   `inverse_links` overlay keyed by `<source_table>.<field_key>`
   whose value is the list of source row ids pointing at that target
   row in the current snapshot.
2. The overlay rides alongside `rows_computed` (re-using
   `default_attach_computed_overlay`-style merge for the new
   field; do NOT collapse the two overlays into one wire field —
   they have different lifecycles).
3. Frontend renders each `inverse_links` entry as a read-only
   pill column with header `<source_table_display> ← <source_
   field_display_name>`. Pill click navigates to the source table
   with `?focus=<row_id>` (re-using the Phase 1 highlight
   primitive).
4. Read-only / Viewer mode renders the inverse view identically;
   inverse columns have no editor affordances in any mode (no
   picker, no ⌫, no fill-handle source).
5. The inverse view filters orphan ids against the snapshot being
   read. A draft read sees only ids present in the current draft;
   a saved-version read sees ids present in that immutable
   version.
6. `inverse_links_fingerprint` changes when any source table's
   `custom_links` slice changes such that the target's incoming-
   links content hash changes. Document-level ETags still cover write
   concurrency.
7. Source-table write semantics stay unchanged — writes to Rooms still
   rotate the document-level draft/version ETag because the document
   changed.
8. JSON download includes the `inverse_links` overlay on every
   target row. Round-trip through validator strips the overlay
   (overlay is a read-only computed view; persistence stays on
   `custom_links`).
9. Optional polish: a toast on Pump delete reads "Pump A removed;
   unlinked from 3 rooms" — counted by walking incoming links
   before the delete commits. Ship if implementation is cheap;
   defer to Phase 3 polish if it isn't.
10. Perf gate fixture is committed at
    `backend/tests/fixtures/record_linking_perf_doc.json` (or
    similar): 4000 source rows × 50 target rows × 3 linked
    fields, plus 5 additional tables each 200 rows × 1 linked
    field. CI invokes the inverse-view build on this fixture and
    asserts total time under 100ms on the pinned runner class.
    Failure mode: >20% over the rolling baseline on 3 consecutive
    runs (single-run spikes do not fail).
11. All `make ci` gates green.

## P3. Backend work

### P3.1 — Inverse view builder

Status: ✅ COMPLETE — `backend/features/project_document/inverse_view.py`
walks raw `ProjectDocumentV1.tables` by `TableContract.table_path`,
collects `linked_record` fields, filters target ids against explicit
snapshot row ids, and returns the target-row inverse overlay plus
column metadata helpers.

New module: `backend/features/project_document/inverse_view.py`.

```python
def build_inverse_links(document: ProjectDocumentV1) -> dict[
    tuple[str, ...],  # target table_path
    dict[str, dict[str, list[str]]],  # target_row_id ->
                                       # source_key -> [source_row_ids]
]:
    """Walk every linked_record field on every table, projecting
    incoming links per target row, filtered against the snapshot.
    """
```

Implementation outline:

- Read every `TableContract`'s field_registry; collect every field
  whose `field_type == linked_record`.
- Pre-build a `target_path → {row_id: True}` set per target table
  for the snapshot-being-read filter.
- Single pass through every source table's rows; for each row's
  `custom_links[field_key]`, look up the resolved
  `target_table_path` from the field def, filter ids against the
  pre-built target set, and accumulate into the result.
- Returns a nested dict keyed by `target_path → target_row_id →
  source_key`.

Complexity: O(N + M) per linked-record field where N = source rows
and M = target rows.

### P3.2 — Attach overlay to per-table responses

Status: ✅ COMPLETE for current target surface — Rooms and Pumps table
responses now expose top-level `inverse_links`,
`inverse_link_fields`, and `inverse_links_fingerprint`; Rooms and
Pumps JSON table downloads attach `inverse_links` into derived row
dicts. The response overlay is top-level rather than persisted on row
models so validation round-trips keep stripping the read-only view.

Each FieldDef-capable table's `build_response` (today returns the
`{rows, field_defs, ...}` envelope) gains an `inverse_links`
attachment step:

- After existing `attach_computed_overlay` (the
  `rows_computed` merge), call a new
  `attach_inverse_links_overlay(rows, target_path, inverse_data)`
  helper that decorates each row with its `inverse_links` map
  (falling back to `{}` when the row has no incoming links).
- The helper mirrors `default_attach_computed_overlay`'s shape so
  consumers see a deterministic merge.
- Single-table slice responses call `build_inverse_table_view(...)`
  for their target path so they do not compute whole-document inverse
  overlays when only one target table is being read.

### P3.3 — Target-table fingerprint includes incoming hashes

Status: ✅ COMPLETE with API-shape adjustment —
`inverse_fingerprint_for_table(...)` provides the stable incoming-link
content hash used by tests, and Rooms/Pumps responses expose it as
`inverse_links_fingerprint`. The public API still carries
document-level `version_etag` / `draft_etag`, so this is an explicit
fingerprint rather than a per-table ETag.

Actual implementation:

- `inverse_fingerprint_for_table(...)` builds a stable hash from the
  target table's computed inverse overlay.
- Hash input is a sorted list of `(source_key, target_row_id,
  source_row_ids_tuple)` encoded through the inverse-view helper.
- Source-table write concurrency stays on document-level
  `version_etag` / `draft_etag`; the target response's
  `inverse_links_fingerprint` is the cache/refresh signal for
  incoming-link changes.
- Regression tests assert the fingerprint changes when a Rooms
  `custom_links` write changes Pumps' incoming links, and does not
  change when an unrelated Rooms scalar value changes.

### P3.4 — Snapshot-aware orphan filter

Status: ✅ COMPLETE — `build_inverse_links(..., snapshot_row_ids=...)`
requires callers/tests to make the snapshot filter explicit when they
need non-default semantics; the default derives row ids from the body
being read.

The inverse-view builder accepts an explicit `snapshot_row_ids:
dict[tuple[str, ...], frozenset[str]]` parameter:

- For draft reads, callers pass the current draft's row id sets.
- For saved-version reads, callers pass the immutable version's
  row id sets.

This makes the "filter against the snapshot being read" rule
(Q5 amendment) explicit in the function signature instead of
implicit via "current state."

### P3.5 — Optional delete toast count (acceptance #9)

If cheap: in the per-table delete-row path, count incoming links
before the slice replace commits. Return the count in the
mutation summary so the frontend can render the toast. Skip if
implementation friction surfaces; defer to a polish PR.

### P3.6 — Perf gate fixture + CI assertion

Status: ✅ COMPLETE with fixture-shape adjustment — added
`backend/tests/builders/record_linking_perf_doc.py`,
`backend/tests/baselines/record_linking_perf.json`, and
`backend/tests/test_record_linking_perf.py`. The fixture is generated
deterministically in memory instead of committed as a large JSON file:
4000 Rooms × 3 linked fields, 50 Pumps, plus 5 equipment tables × 200
rows × 1 linked field. The test warms the builder, asserts the fixture
shape, and asserts median inverse build under 100ms.

- Commit `backend/tests/fixtures/record_linking_perf_doc.json`
  generated by a deterministic builder function (also committed
  — `tests/builders/perf_doc.py` or similar) so the fixture is
  reproducible.
- Add `tests/test_record_linking_perf.py`:
  - load the fixture;
  - time `build_inverse_links(doc, snapshot_row_ids=...)` over N
    iterations (median, not mean);
  - assert median < 100ms on the pinned CI runner;
  - on failure, write the measurement + baseline diff to a
    structured log so the CI failure message is actionable.
- Baseline storage: a small JSON file at
  `backend/tests/baselines/record_linking_perf.json` updated by
  the implementer; the test reads the baseline and applies the
  20%/3-runs rule. Single-run spikes do not fail (the test
  records the run + warns; flake-suppression is part of the gate
  design).

## P4. Frontend work

### P4.1 — Inverse-column rendering

Status: ✅ COMPLETE for canonical Rooms→Pumps target —
`PumpsTable` appends read-only inverse columns from the response
`inverse_link_fields` metadata and renders pill lists from
`inverse_links[row_id][source_key]` using the Phase 1
`LinkedRecordCell` primitive. Inverse pills use the source row-id
fallback label and click through to the source row based on
`source_table_path`.

`frontend/src/shared/ui/data-table/fields/linkedRecord/
InverseColumn.tsx` (or extend the existing renderer):

- A new column type (or a flag on the existing linked-record
  column type) for "this is an inverse column."
- Reads `row.inverse_links[<source_key>]`, renders as a pill list
  using the same `LinkedRecordCell` rendering primitive from
  Phase 1 — but with all editor affordances disabled:
  - no click-to-open picker;
  - no ⌫ on focused pill;
  - no fill-handle source.
- Header text: `<source_table_display> ← <source_field_display_
  name>` (Q21).
- Pill click navigates to the **source** table with
  `?focus=<row_id>` reusing the Phase 1 highlight primitive.

### P4.2 — Column discovery + ordering

Status: ✅ COMPLETE for canonical Rooms→Pumps target — inverse columns
are discovered from `pumpsSlice.inverse_link_fields`, appended after
the persisted Pump columns, and registered as read-only derived
DataTable fields so column-order/hide/filter/sort surfaces can see
them without persistence.

The inverse columns are not in `field_defs` on the target table
— they're a derived list discovered from the wire response's
`inverse_links` keys.

- Discover the column set per render by walking `inverse_links`
  keys across all rows.
- Insertion position: append inverse columns to the end of the
  current column order by default; persist column ordering
  through the existing per-user view-state surface.
- Column header carries `data-inverse-of="<source_key>"` for
  Playwright targeting.

### P4.3 — JSON Schema regeneration

Status: ✅ NO-OP — this repo serves JSON Schemas at runtime from
Pydantic models (`/api/v1/schemas/...`) rather than committing
generated schema artifacts. Row schemas intentionally remain
persistence-only; the inverse overlay is represented on table slice
responses/download envelopes, not on persisted row models.

The exported JSON Schema describes `inverse_links` as an
additional-properties read-only field on each row. Regenerate
after backend changes land.

## P5. Tests

### Backend (pytest)

- `backend/tests/test_project_document_inverse_view.py`:
  - happy path: 3 rooms link to 1 pump → pump's inverse_links
    contains all 3 room ids;
  - multi-field: rooms have `cf_primary_pump` and `cf_backup_
    pump` both targeting pumps → pump's inverse_links has 2 keys;
  - orphan strip: rooms link to a pump id that does not exist in
    the snapshot → inverse_links does not include that id and the
    rooms-side cell remains untouched (Phase 1's silent-strip is
    a save-time concern; the read-time view filter is what this
    test asserts);
  - snapshot semantics: same document, two different
    `snapshot_row_ids` inputs → different inverse views;
  - empty case: no linked_record fields anywhere → builder
    returns `{}` and per-row overlays are `{}`.
- `backend/tests/test_record_linking_perf.py`:
  - deterministic in-memory fixture builds the Phase-02 shape;
  - warmup asserts target row count + incoming-link count;
  - perf gate runs under the baseline in
    `backend/tests/baselines/record_linking_perf.json`.

### Frontend (Vitest)

- `frontend/src/features/equipment/__tests__/PumpsTable.reuse.test.tsx`:
  - renders pill list from `row.inverse_links[source_key]`;
  - header reads `<source_table> ← <source_field>`;
  - pill click navigates to source table with `?focus=`;
  - all editor affordances disabled in every mode.
- `frontend/src/shared/ui/data-table/__tests__/DataTable.linkedRecordTargets.test.tsx`:
  - preserves the linked-record target-table config surface used by
    Phase 1/2 target resolution.

### Browser smoke (Playwright MCP / e2e follow-up)

- [ ] Editor on Rooms links 3 rooms to Pump A; opens Pumps; sees a
  "Rooms ← Pump" column on Pump A's row with 3 pills.
- [ ] Click a pill → lands on Rooms with the room highlighted.
- [ ] Add a second field "Backup Pump" on Rooms targeting Pumps;
  link a different room; Pumps now shows "Rooms ← Pump" and
  "Rooms ← Backup Pump" as two columns.
- [ ] Viewer mode: inverse columns visible, click-navigate works, no
  picker affordances.

## P6. Out of scope

- **Formula primitives `linked(...)` / `linked_from(...)`** —
  Phase 3.
- **Document-level formula cycle detection** — Phase 3.
- **In-process LRU cache / Redis cache** — only ships if Q27's
  escalation trigger fires.
- **MCP cell-write tool for inverse columns** — inverse view is
  read-only by design; no editing.
- **Inverse-view diff rendering between versions** — diff already
  shows source-side `custom_links` changes (Phase 1). The inverse
  view is derived; a separate diff entry would double-count. If
  product feedback later asks for an "incoming pills changed"
  diff line, ship as a follow-up.
- **Sortable inverse columns by pill count** — defer until
  asked.

## P7. Done definition

Phase 2 is mergeable when:

- the acceptance checklist (P2) passes locally;
- `make ci` is green, including the perf gate assertion;
- the Phase 2 browser smoke (P5) is recorded as evidence or tracked
  as an explicit e2e follow-up if full CI and focused tests cover the
  code path;
- the perf baseline file is committed alongside the test;
- the ETag invalidation pair test exists and passes.

Current audit 2026-06-09: met for implementation and CI. Browser
smoke/e2e evidence was not recorded because the local frontend was not
already running; it is tracked as a follow-up in `../STATUS.md`.
