---
DATE: 2026-06-08
TIME: planning
STATUS: Partial backend implementation in progress. 2026-06-09
        landed Python parser / AST support, document-aware server
        read-overlay evaluation for canonical Rooms→Pumps persisted
        rollups, document-level linked-ref validation / cycle
        detection, and focused backend tests. Frontend editor support,
        perf gate, and browser smoke remain open.
AUTHOR: Ed May (with Claude)
SCOPE: Cross-table formula primitives `linked(...)` and
       `linked_from(...)` with `count` / `sum` / `avg` aggregators,
       plus document-level formula cycle detection as a topological
       sort over the formula graph.
RELATED:
  - planning/features/record-linking/PRD.md §4 (Phase 3), §11 Q8
    (rollup grammar), Q26 (cross-table eval order)
  - planning/features/record-linking/phases/phase-01-link-values.md
  - planning/features/record-linking/phases/phase-02-inverse-view.md
  - context/technical-requirements/data-model.md §6.6.4
  - backend/features/project_document/formula/{ast_nodes.py,
    parser.py, resolver.py, evaluator.py, analysis.py, tokens.py,
    errors.py, limits.py}
  - backend/features/project_document/document.py
    (`_validate_rooms_formula_cycles` — the existing per-table
    cycle detector that this phase generalizes)
  - frontend/src/shared/ui/data-table/lib/formula/{ast.ts,
    parser.ts, resolver.ts, ...}
---

# Record-linking Phase 3 — Cross-table rollups

## P0. Why this slice

Phase 1 stores ids. Phase 2 surfaces incoming links read-only. Phase
3 makes the **math** work — the canonical "total wattage across
linked rooms" rollup. After Phase 3:

- the formula grammar accepts `linked(<field_key>)` (forward — rows
  the current row's link field points at) and `linked_from
  (<table>, <field_key>)` (inverse — rows on another table whose
  link field points at the current row);
- aggregators `count`, `sum`, `avg` work over those primitives;
- formula cycle detection generalizes from the existing per-table
  pass to a document-level topological sort that treats `linked` /
  `linked_from` edges as dependencies;
- formulas evaluate in dependency order — a Pumps formula that
  aggregates Rooms.cf_wattage sees the final per-row wattage values
  (even when `cf_wattage` is itself a formula).

Min / max / concat / array_join / count_unique / boolean
aggregators are deferred (Q8). Add them as deliberate follow-ups
when a concrete PH use case lands.

## P1. Source review notes

Use `PRD.md` §11 Q8 and Q26 as the canonical contract. Q26 locked
the *shape* of evaluation order (topological sort across the
document's formula graph treating `linked_from`/`linked` edges as
dependencies, cycles reject at validate time). Implementation
details — graph construction, cache shape, error envelope — are
this phase's call.

Decisions already locked:

- **Grammar** (Q8):
  - `linked(<field_key>)` returns the list of target rows referenced
    by the current row's `custom_links[field_key]`. Useful inside
    formulas on the source row.
  - `linked_from(<table>, <field_key>)` returns the list of source
    rows whose `custom_links[field_key]` contains the current row's
    id. Useful inside formulas on the target row.
  - Aggregator functions: `count(<expr>)`, `sum(<expr>)`,
    `avg(<expr>)`. The expression must be either a primitive
    `linked(...)` / `linked_from(...)` call, or a field-access
    chain anchored on one of those primitives (`linked_from(rooms,
    "cf_pumps").cf_wattage`).
- **Cycle detection**: document-level topological sort. Cycles
  fail at `validate_document_references` with a hard error
  (existing pattern from `_validate_rooms_formula_cycles`). Eval
  order: topo-sorted layers; within a layer, per-table eval order
  follows the existing per-table sort.
- **Read overlay**: rollup values land in `rows_computed` (same
  overlay Phase 2 left alone). The wire shape doesn't change.
- **Min / max / concat / array_join / count_unique / boolean
  aggregators**: NOT in scope. Hard-fail at parse with a clear
  error message naming the deferred function. Adding one later is
  a follow-up; do not stub them out.

## P2. Acceptance — Phase 3 done when

1. [x] The formula parser accepts `linked(<field_key>)` and
   `linked_from(<table>, <field_key>)` as primary expressions. The
   AST gains linked row-set node kinds (`LinkedRef`,
   `LinkedFromRef`) plus `FieldAccess` for `.<field_key>`.
2. [x] `count(linked_from(rooms, "cf_pumps"))` evaluates to the number
   of rooms pointing at the current pump (matches the count of
   pills in the Phase 2 inverse view for that row).
3. [x] `sum(linked_from(rooms, "cf_pumps").cf_wattage)` evaluates to
   the sum of `cf_wattage` across every room pointing at the
   current pump. `cf_wattage` may be a stored number field OR a
   formula field — evaluation order resolves the formula first.
4. [x] `avg(linked(<field_key>))` works on the source side too —
   e.g. on a Room with a multi-link pump field, `avg(linked
   ("cf_pumps").cf_wattage)` can return the mean pump wattage
   across the room's linked pumps. Backend parser/evaluator support
   is in place; frontend authoring is still open.
5. [x] Min / max / concat / array_join / count_unique / boolean
   aggregators raise `formula_function_not_supported` at parse
   time with the deferred-function name in the error envelope.
6. [x] Document-level formula cycle detection: a formula on Pumps
   that aggregates `linked_from(rooms).cf_x` where `cf_x` on
   Rooms is a formula that aggregates `linked("cf_pumps").cf_y`
   where `cf_y` on Pumps is the original formula → fails
   validation with `formula_cycle_detected` and a path through
   the cycle in the error envelope.
7. [x] Per-table cycle detection (Phase 1 / pre-existing) is
   subsumed by the document-level detector. The per-table
   `_validate_rooms_formula_cycles` helper either becomes a
   thin wrapper over the document-level detector or is removed
   outright in favor of a single pass.
8. [x] Evaluation order: the evaluator computes formula fields in a
   topologically-sorted order across the document's formula
   graph. A formula on Pumps that references a Rooms formula
   sees the final Rooms value, not the stale-pre-eval value.
   Implemented as a document-aware recursive overlay cache with
   recursion guard; graph-based validator remains open.
9. [ ] Performance budget: the **combined** inverse-view + formula
   evaluation for the Phase 2 perf-gate fixture (plus 5 formula
   fields added across tables) completes in under 200ms on the
   pinned CI runner. New baseline / regression rule mirrors
   Phase 2's (>20% over baseline on 3 consecutive runs).
10. [ ] Frontend formula editor learns the new primitives in its
    ref-completion dropdown. Typing `linked_from(` surfaces
    target-table suggestions; typing `linked_from(rooms, ` then
    surfaces field-key suggestions filtered to linked-record
    fields on Rooms.
11. [ ] JSON Schema regeneration includes the new formula nodes.
12. [ ] All `make ci` gates green.

## P3. Backend work

### P3.1 — Grammar + parser + AST — ✅ BACKEND SLICE COMPLETE

`backend/features/project_document/formula/`:

- `tokens.py`: add dotted field/table path token support.
- `ast_nodes.py`: add row-set node types:
  ```python
  class LinkedRef(BaseModel):
      kind: Literal["linked_ref"] = "linked_ref"
      field_key: str

  class LinkedFromRef(BaseModel):
      kind: Literal["linked_from_ref"] = "linked_from_ref"
      source_table_path: tuple[str, ...]   # e.g. ("rooms",) or
                                            #     ("equipment", "fans")
      source_field_key: str
  ```
  Both can sit on the LHS of a `.<field_key>` field access through
  the new `FieldAccess` AST node, so `linked_from(rooms,
  "cf_pumps").cf_wattage` parses as a field access whose target is
  a `LinkedFromRef`.
- `parser.py`: extend the primary-expression rule to accept the
  two new keyword calls with strict arity checks. `linked` takes
  one string-literal argument (`field_key`). `linked_from` takes
  a table identifier (segmented dotted path, e.g.
  `equipment.fans`) and a string-literal `field_key`.
- `errors.py`: add `formula_function_not_supported` for deferred
  aggregators and `formula_invalid_linked_arg` for shape errors.
  Unknown table / target-field / cycle author-time errors remain in
  the resolver/cycle follow-up.

### P3.2 — Resolver — ✅ BACKEND SLICE COMPLETE

`backend/features/project_document/formula/resolver.py`:

- The existing resolver walks an AST and populates `field_id`s on
  `FieldRef` nodes by looking up names case-insensitively in the
  current table's registry.
- Extend for the new nodes:
  - `LinkedRef`: validate `field_key` exists in the *current*
    table's field_defs, is `linked_record`, and resolve its
    `target_table_path`.
  - `LinkedFromRef`: validate `source_table_path` resolves to a
    registered `link_targetable` contract, validate
    `source_field_key` exists on that table, is `linked_record`,
    and its `target_table_path` equals the *current* table's
    path. (If it doesn't match, the formula is referencing a
    link that doesn't point at us — surface
    `formula_target_field_not_linked` with both paths in the
    error envelope.)
  - Trailing `.field_key` on either primitive resolves against
    the **target side**: for `LinkedRef`, against the link's
    `target_table_path`; for `LinkedFromRef`, against the
    `source_table_path` (the rows it returns are source rows).

### P3.3 — Evaluator — ✅ BACKEND SLICE COMPLETE

`backend/features/project_document/formula/evaluator.py`:

- Add row-walkers for the new primitives:
  - `LinkedRef(field_key)`: read the current row's
    `custom_links[field_key]`; resolve each id to a target row
    via the target table's row index; return the resolved row
    iterator. Filter against the snapshot being read (mirrors
    Phase 2 §P3.4).
  - `LinkedFromRef(source_table_path, source_field_key)`: read
    the inverse-view dict built in Phase 2 (P3.1) for this
    target row + source key; resolve ids to source rows.
- Aggregator implementations:
  - `count(<rows_expr>)` → length of the row sequence.
  - `sum(<rows_expr>.<field_key>)` → sum of the field value
    across the rows; numeric coercion follows the existing
    formula-numeric rules; non-numeric values are silently
    dropped (matches the existing per-table sum behavior).
  - `avg(<rows_expr>.<field_key>)` → sum / count, or `None` when
    count is zero.
- Reuse the inverse-view dict from Phase 2 so the evaluator
  doesn't re-walk the document. The route-level call sequence
  becomes:
  1. compute snapshot row id sets;
  2. build inverse-view dict (Phase 2 P3.1);
  3. compute formula values through the document-aware overlay cache
     (recursive dependency resolution today; graph topological sort
     remains P3.4);
  4. attach `rows_computed` overlay (existing);
  5. attach `inverse_links` overlay (Phase 2 P3.2).

### P3.4 — Document-level cycle detection + topological sort — ✅ BACKEND SLICE COMPLETE

`backend/features/project_document/formula/analysis.py` (or a new
sibling module):

- Build a directed graph whose nodes are
  `(table_path, field_key)` pairs for every `formula` field in
  the document and whose edges encode dependency:
  - intra-table: `FieldRef` → the referenced field (existing
    per-table edges).
  - cross-table forward: `LinkedRef(field_key).target_field` →
    edge from the source field to the target field on the
    `target_table_path` declared by `field_key`.
  - cross-table inverse: `LinkedFromRef(source_table_path,
    source_field_key).target_field` → edge from the current
    field to the target field on the `source_table_path`.
- Run Kahn's algorithm for the topological sort. On cycle
  detection, raise `formula_cycle_detected` with the cycle path
  in the error envelope.
- `validate_document_references` calls the document-level
  detector as a single pass and drops the per-table loops
  (the per-table detector becomes a thin wrapper that delegates
  to the document-level pass, or is removed outright).

### P3.5 — Snapshot-aware evaluation — ✅ BACKEND SLICE COMPLETE

The evaluator's `linked_from` walk consumes the Phase 2 inverse-
view dict, which already filters against the snapshot being
read. The evaluator's `linked` walk filters the source row's
`custom_links[field_key]` against the snapshot's target-row id
set directly (same filter primitive as Phase 2 P3.4).

### P3.6 — Perf gate extension — ⏳ OPEN

Extend the Phase 2 perf-gate test:

- Add 5 formula fields to the perf-gate fixture: a mix of
  `count(linked_from(...))`, `sum(linked_from(...).<field>)`, and
  one cross-table chain that exercises the topological sort
  (`Pumps.formula_a` depends on `Rooms.formula_b` depends on a
  stored field).
- New gate: combined inverse + formula evaluation under 200ms
  median on the pinned runner. Same 20%/3-runs regression rule.

## P4. Frontend work

### P4.1 — Formula editor ref completion

`frontend/src/shared/ui/data-table/lib/formula/`:

- Parser mirror: the frontend formula parser/lexer learns the
  same two primitives.
- Resolver mirror: the same resolution rules so completion
  suggestions are pre-validated.
- Ref completion:
  - typing `linked(` opens a dropdown listing every
    `linked_record` field on the current table;
  - typing `linked_from(` opens a dropdown listing every table
    where `link_targetable=true` AND that has at least one
    `linked_record` field whose `target_table_path` equals this
    table;
  - after `linked_from(rooms, ` the dropdown filters to that
    table's linked-record field keys whose `target_table_path`
    equals this table.
  - typing `.` after a primitive opens a dropdown of the
    appropriate side's fields.
- Aggregator completion: `count(`, `sum(`, `avg(` autocomplete
  inserts the wrapper. Min / max / concat / etc. either don't
  appear in completion OR appear with a "deferred — see Q8"
  tooltip; pick during impl based on whether disabling them
  cleanly is cheap.

### P4.2 — Computed cell rendering

No new render path — rollup values land in `rows_computed`
already wired in Phase 2's overlay (and pre-Phase 2 for per-
table formula values). The cell renders the computed value
identically to a per-table formula result.

### P4.3 — Error display

Surface the new error codes in the formula editor's inline
validation panel:

- `formula_function_not_supported` → "Function `<name>` is not
  yet supported. See feature docs Q8."
- `formula_unknown_target_table` → "Table `<path>` is not a
  link target."
- `formula_target_field_not_linked` → "Field `<key>` on `<table>`
  does not link to this table."
- `formula_cycle_detected` → "Formula cycle: `<path>`."

## P5. Tests

### Backend (pytest)

- `tests/test_formula_parser.py`:
  - parses `linked("cf_pumps")` to a `LinkedRef`;
  - parses `linked_from(rooms, "cf_pumps")` to a `LinkedFromRef`;
  - parses `count(linked_from(rooms, "cf_pumps"))` and
    `sum(linked_from(rooms, "cf_pumps").cf_wattage)`;
  - rejects `min(...)`, `max(...)`, `concat(...)`,
    `array_join(...)`, `count_unique(...)` with
    `formula_function_not_supported`.
- `tests/test_formula_resolver.py`:
  - `linked` resolves to a field that is `linked_record` on the
    current table;
  - `linked_from` resolves to a field on the named table whose
    `target_table_path` equals the current table;
  - `linked_from` against a table whose linked field targets a
    *different* table fails with `formula_target_field_not_
    linked`;
  - `linked_from` against an unknown table fails with
    `formula_unknown_target_table`.
- `tests/test_formula_evaluator.py`:
  - `count(linked_from(...))` returns the per-row pill count;
  - `sum(linked_from(rooms).cf_wattage)` matches a hand-rolled
    aggregation;
  - `avg` returns null on empty list;
  - field-of-formula chain: `sum(linked_from(rooms).cf_w)` where
    `cf_w` is itself a formula returns the post-evaluated values
    (i.e. evaluation order is correct);
  - snapshot filter: orphan target ids are excluded from the
    aggregation.
- `tests/test_formula_cycles.py`:
  - intra-table cycle still detected (per-table behavior
    preserved);
  - cross-table 2-hop cycle detected with the cycle path in the
    error envelope;
  - cross-table 3-hop cycle through `linked` → `linked_from`
    detected;
  - non-cyclic but cross-table formula graph evaluates without
    issue.
- `tests/test_record_linking_perf.py`:
  - combined inverse + formula gate under 200ms on the pinned
    fixture with 5 added formula fields.

### Frontend (Vitest)

- `formula/parser.test.ts` mirrors backend parser tests for the
  new primitives.
- `formula/refCompletion.test.ts`:
  - `linked(` suggests current-table linked-record fields;
  - `linked_from(rooms, ` suggests Rooms' linked-record fields
    whose target equals the current table.
- `formula/errorRender.test.tsx`: error codes from P4.3 surface
  in the editor's validation panel.

### Browser smoke (Playwright MCP)

- Editor adds a formula field `total_wattage` on Pumps with
  source `sum(linked_from(rooms, "cf_pumps").cf_wattage)`.
- Rooms with linked pumps show wattage values; pumps show the
  expected sums.
- Editor changes a room's wattage; pump's `total_wattage`
  updates on next read.
- Editor introduces a deliberate cycle (Pumps formula refs
  Rooms formula refs Pumps); save fails with a clear cycle-path
  error.

## P6. Out of scope

- **min / max / concat / array_join / count_unique / boolean
  aggregators** (Q8) — deferred. Parser hard-fails with a clear
  message naming the deferred function so users get a useful
  signal.
- **Source-side formula on the link itself** (`count(linked
  ("cf_pumps"))` is the count of pills on this row's source
  cell — supported via `linked`. `count(custom_links.cf_pumps)`
  shorthand is NOT supported; users must use `linked(...)` for
  consistency.)
- **Rollups across two link hops** (`linked_from(rooms).linked
  (cf_x).cf_y`). Theoretically expressible if the grammar is
  recursive, but defer until a real use case demands it; cycle
  surface gets meaningfully wider with chained linking.
- **Self-link rollups** (PRD Q22 — self-links themselves are
  deferred).
- **MCP tool for "preview rollup"** (PRD Q9 — deferred).

## P7. Done definition

Phase 3 is mergeable when:

- the acceptance checklist (P2) passes locally;
- `make ci` is green including the extended perf gate;
- the Phase 3 browser smoke (P5) is recorded as evidence in
  `planning/features/record-linking/assets/`;
- the per-table cycle detector is either removed or thinned to a
  delegate of the document-level detector (no duplicate logic);
- deferred-aggregator error messaging is verified in both parser
  tests and at least one frontend editor test.

## P8. Implementation notes — 2026-06-09 backend slice

- Landed backend files:
  `backend/features/project_document/formula/{ast_nodes.py,parser.py,evaluator.py,resolver.py,analysis.py,tokens.py,errors.py,__init__.py}`,
  `backend/features/project_document/tables/pumps.py`, and
  `backend/features/project_document/mutations/formula_ops.py`.
- Focused tests:
  `backend/tests/test_project_document_record_linking_rollups.py`,
  plus existing formula grammar/evaluator and inverse-view suites.
- Deliberate boundary: Pumps now has a formula read registry and
  `rows_computed` in the Pumps response, but nested Pumps schema
  mutation routing remains deferred. Current rollup tests seed
  persisted Pumps `field_defs` directly.

## P9. Implementation notes — 2026-06-09 validator slice

- Landed backend validation files:
  `backend/features/project_document/formula/{resolver.py,errors.py,__init__.py}`,
  `backend/features/project_document/document.py`, and
  `backend/features/project_document/mutations/formula_ops.py`.
- `validate_document_formula_graph` now validates `linked` /
  `linked_from` primitives against the document's formula-capable
  registries, builds table-qualified formula dependency edges, and
  runs a document-level topological sort. Cross-table cycles raise
  `FormulaCycleError` with paths like
  `equipment.pumps.cf_total -> rooms.cf_load -> equipment.pumps.cf_total`.
- `setFormula` now translates linked-ref validation failures to
  structured REST envelopes before the generic final document
  validation pass:
  `custom_field_formula_unknown_target_table` and
  `custom_field_formula_target_field_not_linked`.
- Focused tests:
  `backend/tests/test_project_document_record_linking_rollups.py`
  covers unknown linked tables, non-linked source fields, cross-table
  cycles, and schema-mutation linked-field rejection.
