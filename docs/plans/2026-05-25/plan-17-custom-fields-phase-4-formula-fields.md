---
DATE: 2026-05-25
TIME: planning (detailed implementation phasing)
STATUS: **Backend half (P4.0 → P4.6) + backend P4.10 acceptance
        + P4.7 TS port landed. 2026-05-25.** Open decisions D22–D26
        resolved in chat 2026-05-25 (recorded in plan-13 §3). Full
        backend test suite green (332 passed, 0 failed) and full
        frontend test suite green (806 passed, 0 failed) including
        129 new parity-corpus cases in
        `frontend/src/shared/ui/data-table/__tests__/formula{Grammar,Evaluator,Limits}*.test.ts`
        driven by the shared corpora at
        `backend/tests/fixtures/formula_{grammar,evaluator}_corpus.json`.
        Python parser/evaluator and TypeScript port now agree on
        every corpus case — CI will fail on the first divergence.
        Frontend UI half (P4.8 popover, P4.9 grid wiring, P4.10
        e2e + a11y) is the next phase of work and is unblocked.
        See "Progress" and "Lessons learned" sections below for
        per-sub-phase deliverables and the pragmatic deviations
        from the plan as written.
        Phase 4 of plan-13 (custom fields). Builds on the
        completed Phase 1 envelope (plan-14), Phase 2 schema-editor
        surface (plan-15), and Phase 3 type-change + custom
        single-select work (plan-16). Phase 4 lights up the
        `formula` custom field type end-to-end:
        (a) a closed AirTable-style expression grammar, parsed to a
            typed AST whose field references are resolved to
            immutable `cf_*` / core ids at commit time (US-CF-8
            criteria 2 + 3 + 8);
        (b) two evaluators — Python (authoritative, used by
            downloads and MCP reads) and TypeScript (live in-grid
            render) — kept in byte-equal lockstep by a shared
            fixture corpus that CI fails on first divergence
            (plan-13 §4.4 R2);
        (c) the read-overlay `computed` shape on every table
            response / download / MCP read envelope (plan-13 §4.9,
            US-CF-8 criterion 6, US-CF-10 criterion 3), formally
            reserved-but-empty by Phase 1's exit tests;
        (d) the `<FormulaEditorPopover>` (escalating to a modal if
            the expression grows large per plan-13 D7), field
            palette, live preview against the focused row (plan-13
            D8 / US-CF-8 criterion 1), and the structured-error
            states the existing `computed` field type already
            renders (US-CF-8 criterion 5).
        Eleven sub-phases. Each is a single PR that leaves
        `make typecheck`, `make test`, `make lint`, `make smoke`
        green. Fan-out to ERVs / Pumps / Fans / Thermal Bridges
        stays deferred to Phase 5.
PARENT-PLAN: docs/plans/2026-05-24/plan-13-custom-fields-overview.md
PARENT-STORY: context/user-stories/32-custom-fields.md
              (US-CF-8 in full; US-CF-9 criterion 5 — viewer-mode
              formula visibility; US-CF-10 criterion 3 — LLM/MCP
              sees computed values; US-CF-13 — duplicate formula
              source; partial top-ups on US-CF-2 add-field popover,
              US-CF-1 header context menu)
RELATED:
  - context/technical-requirements/data-model.md §6.6.5
    (formula config storage shape, computed read-overlay)
  - context/technical-requirements/data-table.md
    (computed field type render states; Write Pipeline:
     FieldSchemaMutation discriminator; tail-`+` cell)
  - context/technical-requirements/llm-mcp-schema.md §10.3
    (custom-field schema tools, structured error taxonomy,
     deterministic formula evaluation)
  - context/technical-requirements/save-versioning.md §8.3
    (immediate draft validation — formula parse / cycle / depth
     limits all run on accept)
  - docs/plans/2026-05-24/plan-13-custom-fields-overview.md
    §4.4 (formula grammar + dual evaluator + parity discipline),
    §4.9 (download / read-overlay shape),
    §3 D2 (AirTable-style syntax, id-only AST),
    §3 D3 (computed values present in downloads, never stored),
    §3 D7 (popover; modal escalation legal),
    §3 D8 (focused-row live preview),
    §3 D12 (cf_* identity is the formula dep id),
    §3 D15 (typed schema mutations),
    §3 D16 (immediate draft validation),
    §3 D17 (hard resource limits, deterministic null / numeric
     / division-by-zero semantics),
    §7 R8 (formula resource-abuse risk)
  - docs/plans/2026-05-24/plan-14-custom-fields-phase-1-document-shape.md
    (envelope + reserved computed overlay)
  - docs/plans/2026-05-24/plan-15-custom-fields-phase-2-schema-editor.md
    (typed FieldSchemaMutation surface, AddFieldPopover, header
     context menu, error band routing)
  - docs/plans/2026-05-24/plan-16-custom-fields-phase-3-type-change-and-single-select.md
    (CONVERSION_MATRIX D19 — formula is forbidden in both
     directions; `computeFingerprint` / `useTableSchema` already
     map formula → "computed"; the changeType popover greys the
     formula pill with a Phase 4 tooltip)
  - docs/plans/2026-05-24/adr-custom-fields-phase-2-errors.md
    (P4.0 fills in the user-facing copy for the two already-
     reserved formula error codes and appends the Phase 4 codes)
  - backend/features/project_document/custom_fields.py
    (`CustomFieldType.formula` exists; `coerce_custom_value`
     already rejects stored formula row values — Phase 4 leaves
     that contract untouched)
  - backend/features/project_document/schema_mutations.py
    (Phase 4 implements the reserved `SetFormulaMutation` branch;
     no new mutation kinds beyond it)
  - backend/features/project_document/document.py
    (`validate_document_references` — Phase 4 adds a formula-
     reference / cycle / dependency-resolution pass alongside the
     existing single-select option-id pass)
  - backend/features/project_document/downloads.py
    (table_download_body — Phase 4 P4.4 adds the `computed`
     overlay onto every row of every custom-field-capable table)
  - backend/features/project_document/tables/rooms.py
    (Rooms-side wiring for formula-ref discovery — every core
     RoomRow attribute name is a valid formula dependency id)
  - backend/features/project_document/tables/contracts.py
    (`CustomFieldCapability` — Phase 4 introduces
     `core_field_value_for_formula(row, field_key)` so the
     evaluator reads core values through the contract instead of
     hard-coding `getattr` paths; this also frees Phase 5 fan-out)
  - backend/features/mcp/server.py
    (Phase 4 adds one MCP write tool: `set_custom_field_formula`)
  - frontend/src/shared/ui/data-table/lib/customFieldMutations.ts
    (Phase 4 adds `buildSetFormulaMutation`)
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
    (Phase 4 attaches `formula_config` to formula FieldDefs and
     synthesises the per-row computed accessor)
  - frontend/src/shared/ui/data-table/components/AddFieldPopover.tsx
    (Phase 4 lights up the `formula` pill, behind the same atomic
     add-with-config gesture used for single_select in Phase 3)
  - frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx
    (Phase 4 adds the `Edit formula` item for formula custom
     fields only)
  - frontend/src/features/equipment/routes/EquipmentTab.tsx
    (Phase 4 wires `handleEditFieldFormula` + the formula source
     of the read-overlay computed values into the rendered grid)
BACKWARDS-COMPAT: none required (pre-deployment, CLAUDE.md §16,
                  plan-13 §4.1). `schema_version` stays at 2;
                  Phase 4 only adds capability on top of the
                  Phase 1 envelope. The Phase 1 read-overlay
                  reservation (no `computed` key on any row) is
                  intentionally *broken* by P4.4 — that
                  contract was always "Phase 4 will introduce
                  the overlay deliberately" (plan-14 P1.6 test
                  `test_download_rooms_omits_computed_overlay_in_phase_1`
                  is updated, not deleted, in P4.4 to assert the
                  overlay appears only when at least one formula
                  field exists, and is `{}` otherwise).
---

# Plan 17 — Phase 4: formula fields (Rooms)

## Goal

Editors can:

1. **Add a custom `formula` field** on Rooms via the existing
   add-field popover. The popover's `formula` pill is no longer
   disabled; selecting it expands an inline formula editor showing:
   - an expression `<input>` (escalating to a `<textarea>` /
     modal once the source crosses a short-vs-long threshold —
     plan-13 D7),
   - a **field palette** listing every other field in the table
     (core + custom, in column order; `{Display Name}` insertion
     on click),
   - a **live preview** evaluated against the **focused row** of
     the table behind the popover (plan-13 D8 / US-CF-8
     criterion 1). Before the popover opens, the editor records the
     currently focused row id; if no row is focused, the preview
     panel renders a "Focus a row to preview" hint.
2. **Edit an existing formula field's expression** through the
   same editor surface, opened via a `Edit formula…` item on the
   header context menu (custom formula fields only; the item is
   absent on every other field type, and the existing
   `read_only_schema` guard suppresses the menu entirely on core
   fields — US-CF-6).
3. **See formula values in every read surface** — grid render,
   JSON download, MCP `get_table`, viewer-mode grid — without
   any of those values ever being part of the **stored** row.
   The read-overlay `computed: {cf_id: value}` shape from
   plan-13 §4.9 ships in P4.4 on every custom-field-capable
   table.
4. **Trust that the grid and the download agree.** The shared
   `formula_evaluator_corpus.json` fixture is exercised by both
   the Python and TypeScript evaluators; CI fails on the first
   diverging case. The browser evaluator is an optimisation
   for live render only — every off-browser read path
   (downloads, MCP, e2e screenshots) goes through the Python
   evaluator.
5. **Duplicate a custom formula field** (Phase 2's `formula`
   guard in `EquipmentTab.handleDuplicateCustomField` is
   removed). The duplicate deep-copies `config.source`,
   `config.ast`, and `config.deps` verbatim and re-stamps
   `created_at` / `created_by` (US-CF-13). Row values are
   not copied because there are no stored row values for a
   formula field.

The same backend service path serves the browser and the new MCP
write tool (`set_custom_field_formula`). Type-change *to* and
*from* `formula` stays forbidden (plan-16 D19 / CONVERSION_MATRIX);
the change-type popover keeps the formula pill greyed with a
"Formula fields use Edit formula…" tooltip — Phase 4 updates
that tooltip text but does not unlock the pill.

Exit criteria from plan-13 §5 Phase 4 drive the acceptance tests
in P4.9:

- A Rooms formula `concat({Number}, " — ", upper({Name}))`
  renders **identically** in the grid and in the JSON download.
- Cycles (`a → b → a`) and missing refs (deleted field after
  formula was saved) are caught with structured errors —
  `custom_field_formula_cycle` at parse time,
  `custom_field_formula_missing_ref` at evaluation / commit
  time.
- Computed outputs are present **only** in the read overlay,
  never inside `row.custom`. Inbound writes to `row.custom[cf_id]`
  on a formula field are rejected with the existing Phase 1
  error semantics.
- Renaming a referenced field updates the formula editor's
  *displayed* expression on next open without rewriting the
  stored AST (refs are by id; plan-13 D2 + US-CF-8 criterion
  8).
- Resource limits hold: source length, AST depth, AST node
  count, dependency count, output string length, and per-row
  evaluation budget are all enforced by the parser / evaluator
  before any public Viewer or MCP read can drive evaluation
  (plan-13 §4.4 / D17 / R8).

## Phase summary

| Phase | Title | Visible change | Risk |
|-------|-------|----------------|------|
| 4.0 | Story promotion + ADR addendum + open-decisions log + scaffold | None | Trivial |
| 4.1 | Backend: tokenizer + parser + AST types + resource-limit constants + shared corpus skeleton | None | Medium — pins the grammar and corpus contract for every later phase |
| 4.2 | Backend: evaluator + per-row evaluation budget + deterministic null / numeric / div-by-zero semantics + structured error values | None | High — settles the semantics every Python and TypeScript test will run against |
| 4.3 | Backend: dependency resolver + cycle detection + missing-ref handling + `validate_document_references` formula pass | None | High — closes the validation seam so malformed formulas never reach the persisted draft (plan-13 D16) |
| 4.4 | Backend: `computed` read-overlay on table responses, downloads, MCP reads (every custom-field-capable table) | New `computed` key on every row (empty when no formula fields exist) | Medium — first wire-shape change since Phase 1 |
| 4.5 | Backend: `SetFormulaMutation` dispatch + atomic config replace + audit payload + REST endpoint test pass | New mutation kind reachable through the existing `POST .../custom-fields:mutate` endpoint | Medium |
| 4.6 | Backend: MCP write tool `set_custom_field_formula` + expand recoverability map + security checkpoint | New MCP tool reachable | Medium |
| 4.7 | Frontend: TS tokenizer + parser + evaluator + shared-corpus parity tests | None | High — every byte of disagreement with Python fails CI |
| 4.8 | Frontend: `<FormulaEditorPopover>` + field palette + focused-row live preview + display-name re-rendering on open | New popover surface | Medium |
| 4.9 | Frontend: AddFieldPopover lights up `formula` pill (atomic add-with-config); HeaderContextMenu adds `Edit formula…`; computed cells render via the existing `computed` field type with ready / stale / loading / error states; unlock duplicate of formula; computed-value sort / filter / group / aggregate work end-to-end | Editors can ship a formula end-to-end | High — most invasive frontend phase |
| 4.10 | Exit-criteria acceptance tests + Playwright smoke + focused a11y pass on the formula editor and computed cells | None new — verification only | Low |

Each phase is a PR. Halting between phases leaves Rooms working: the
parser/evaluator are unreachable until P4.5 exposes them via REST and
P4.6 exposes them via MCP; the AddField `formula` pill stays disabled
until P4.9; the `Edit formula…` item only ships in P4.9; the read
overlay is empty (`computed: {}`) on every row until at least one
formula field exists in the document.

## Review amendments — *Reviewer TBD, post-P4.0*

These are the material issues the cross-functional review (Codex
or equivalent) is expected to find when the scaffold lands. Folded
into the phase tasks below; do not treat them as optional polish.
The first review pass is sequenced for the end of P4.0 so the
parser / evaluator semantics are not litigated mid-implementation.

1. **Float determinism across runtimes.** IEEE-754 binary64 is
   the same on Python and V8, but Python `round()` uses banker's
   rounding and JS `Math.round()` uses half-away-from-zero. P4.2
   must specify the rounding mode and the string-formatting
   routine (Python `repr` vs JS `Number.prototype.toString` are
   *not* byte-equal across the full domain). The parity corpus
   anchors this; the implementation cannot rely on either
   language's default.

2. **String comparison locale.** `<` / `>` / `=` on strings must
   be Unicode code-point comparison, not a locale-aware collation.
   Tests must include non-ASCII inputs.

3. **Substring slice semantics.** AirTable's `substring(s, start,
   end)` is 1-indexed and inclusive; the v1 grammar must pick one
   convention and document it. Recommendation in P4.0 D24:
   1-indexed, inclusive end (AirTable parity).

4. **Null propagation in `concat`.** AirTable coerces null to `""`
   in `concat`. P4.2 must declare this explicitly and test for it;
   otherwise users will hit "function failed" errors on partially-
   filled rows and assume the implementation is broken.

5. **Computed read overlay vs aggregations.** The existing
   aggregation footer reads `row.computed[cf_id]` if present.
   P4.4 must add a fixture-driven test that NUMBER aggregations
   over a formula column see the computed values (not zero / not
   skipped).

6. **Viewer-mode MCP reads.** US-CF-10 criterion 3 covers the
   write path; US-CF-9 criterion 5 covers the viewer-mode render.
   P4.4 must include a no-auth read test asserting the public
   viewer-mode payload includes `computed` values for projects
   that have formula fields.

---

## Phase 4.0 — Story promotion + ADR addendum + open-decisions log + scaffold

**Goal.** Zero-behavior preamble. Promote US-CF-8 from Draft to
Phase 4, fold US-CF-9 criterion 5 / US-CF-10 criterion 3 into
the phase, extend the Phase 2 error-codes ADR with the Phase 4
codes, **close five open formula-semantics decisions in chat
before P4.1 starts**, and create empty files so subsequent PRs
only touch behavior.

### Tasks

1. **Promote user stories** in `context/user-stories/32-custom-fields.md`:
   - US-CF-8: Draft → Phase 4. Update the summary table at the
     top of the file accordingly.
   - US-CF-9 criterion 5 (viewer-mode formula values): mark
     **Phase 4** in the criterion table (currently inherits
     Phase 2 because viewers were promised the same
     `FieldDef[]`).
   - US-CF-10 criterion 3 (LLM sees computed values): Draft →
     Phase 4.
   - US-CF-2 already lists `formula` as a Phase 4 deferral
     inside its criteria block; flip that note to active.
   - US-CF-13 (duplicate) already names `formula` as deferred
     to Phase 4 — flip that note to active.

2. **Promote `data-table.md` "Write Pipeline"** so the
   `SetFormulaMutation` discriminator branch is described as
   active in Phase 4 (the shape was reserved in plan-15 P2.1).

3. **Append to the Phase 2 errors ADR**
   (`docs/plans/2026-05-24/adr-custom-fields-phase-2-errors.md`)
   a "Phase 4 codes" section. The two already-reserved codes
   (`custom_field_formula_parse_error`,
   `custom_field_formula_cycle`) finally get their user-facing
   copy. Five new codes:

   | Code | HTTP | `recoverability` | `details` keys | User-facing template |
   |---|---|---|---|---|
   | `custom_field_formula_parse_error` (own copy now) | 422 | `fatal` | `field_id`, `parse_error`, `offset`, `source` | "Couldn't parse the formula: {parse_error} (position {offset})." |
   | `custom_field_formula_cycle` (own copy now) | 422 | `fatal` | `field_id`, `cycle_path` (list of `cf_*` / core ids in cycle order) | "This formula creates a cycle: {cycle_path_joined}. Remove the loop and try again." |
   | `custom_field_formula_missing_ref` | 422 | `fatal` | `field_id`, `missing_ref_display_name`, `missing_ref_id` | "Formula references a field that doesn't exist in this table: {missing_ref_display_name}." |
   | `custom_field_formula_resource_limit` | 422 | `fatal` | `field_id`, `limit_name` (`source_length`, `ast_depth`, `ast_node_count`, `dep_count`, `output_length`, `per_row_budget_ms`), `actual`, `max` | "Formula exceeds {limit_name} limit ({actual}/{max}). Simplify the expression and try again." |
   | `custom_field_formula_unsupported_function` | 422 | `fatal` | `field_id`, `function_name`, `available_functions` (sorted list) | "Function '{function_name}' is not supported. Available: {available_functions_joined}." |

   All five carry `recoverability: fatal` — none are "refresh and
   retry"; every recovery path requires the editor to change the
   formula source.

4. **Open decisions to close in chat before P4.1 starts.** These
   are *not* implementation decisions to make during a sub-phase
   PR. Each requires a one-line entry below `## 8. Resolved
   decisions` in plan-13 §3 (D22, D23, D24, D25, D26) and a
   one-paragraph note in this plan's `## Open questions` section
   once decided.

   - **D22. Numeric semantics.** Confirm the following
     strawman:
     - All numbers are IEEE-754 binary64 (Python `float`, JS
       `number`).
     - Integer-looking sources (`42`) parse to `float(42)`; no
       separate int type. Comparison `42 = 42.0` is true.
     - Division (`/`) produces a float result always. `0 / 0`
       and `n / 0` (for any non-zero n) raise the structured
       value `{"error": "div_by_zero"}` (rendered as `#DIV/0!`
       in the grid and serialized as `null` with a
       `{"error": "div_by_zero"}` companion in the read
       overlay — see D25). The evaluator does **not** propagate
       NaN/Infinity; any operation that would produce
       non-finite output is caught and reported as a structured
       error value instead.
     - Modulo (`%`) on floats follows Python's `math.fmod`
       semantics, mirrored in TypeScript by an explicit helper
       — *not* the JS `%` operator, which uses different
       sign-of-result rules. The corpus exercises every sign
       combination.
     - Rounding: explicit `round(n)` / `round(n, digits)` not
       in v1 (deferred; deferral entry in §6). The arithmetic
       evaluator never rounds intermediates.

   - **D23. Hard resource limits.** Strawman (pick or override
     in chat):

     | Limit | Default | Rationale |
     |---|---|---|
     | `source_length` (chars) | **1024** | Long enough for nontrivial expressions, short enough to keep the editor responsive. |
     | `ast_node_count` | **256** | Hard cap on parse-tree size to bound evaluation work. |
     | `ast_depth` | **24** | Bounds recursion in the evaluator (Python default recursion limit is 1000; 24 is well clear). |
     | `dep_count` (distinct field refs in one formula) | **16** | Refs widen cycle-detection cost and reflect real usage. |
     | `output_length` (chars; text result) | **8000** (2× `SHORT_TEXT_MAX_LENGTH`) | Bound the read overlay so a single formula can't bloat a table response. |
     | `per_row_budget_ms` (Python only) | **5 ms** | Per-row soft budget enforced by a node-count fuse, not wall-clock — corpus parity requires deterministic limits, so we count nodes-evaluated (default cap 4× `ast_node_count`) rather than time. The "ms" name is for ADR readability; the actual fuse is `nodes_evaluated > 1024`. The TS evaluator uses the same fuse value. |

     Limits run at parse time (source / nodes / depth / deps)
     and at evaluate time (output / fuse). Breaching any limit
     raises `custom_field_formula_resource_limit`.

   - **D24. `substring(s, start, end)` indexing.** AirTable
     parity recommendation: **1-indexed, inclusive end**.
     `substring("hello", 1, 3) = "hel"`. Out-of-range indices
     clamp to `[1, len(s)]`. Negative indices not supported in
     v1 (raise `custom_field_formula_parse_error` at parse
     time? — or at evaluate time? **Recommend: parse time
     when the start/end are literals; evaluate time when they
     are expressions.** Confirm.).

   - **D25. Structured error values vs cell-render error
     state.** The evaluator can produce three kinds of
     "non-value":
     - `null` — normal absent value (e.g. `if(false, "a",
       null)`).
     - `{"error": "missing_ref"}` — the field reference
       resolved at evaluate time to nothing (the referenced
       field was deleted *after* the formula was saved;
       parse-time missing refs are rejected up front).
     - `{"error": "div_by_zero" | "type_mismatch" | "fuse_tripped"
       | "output_too_long"}` — the evaluator produced an
       error condition the user can fix by editing the
       formula or the inputs.

     Read overlay encoding: the row's `computed[cf_id]` is the
     raw value (`null`, string, number, bool) on success, or an
     object `{"error": "<token>"}` on failure. Grid render maps
     the `error` token onto the existing `computed` field
     type's `error` state with a tooltip carrying the token.

   - **D26. `concat` and string functions: null coercion.**
     Confirm AirTable parity: `null` arguments coerce to `""`
     in `concat`, `upper`, `lower`, `replace`, `substring`,
     `len`, `trim`. `number(null) = null`; `text(null) = null`
     (so the structured-error tier survives explicit casts).
     Arithmetic on `null` produces `null` (null propagation);
     `null = null` is true; `null = 0` is false; `null + 1` is
     `null`. Boolean `and` / `or` short-circuit on `null` the
     same way they do on `false`.

5. **Backend scaffold** (one-line placeholders so typecheck stays
   green):
   - new `backend/features/project_document/formula/` package
     with empty `__init__.py` and placeholder modules:
     - `tokens.py` — token enum + `Token` dataclass.
     - `parser.py` — `parse(source: str) -> FormulaAST` stub
       returning `NotImplementedError`.
     - `ast.py` — discriminated-union node dataclasses
       (`Literal`, `FieldRef`, `FuncCall`, `BinaryOp`,
       `UnaryOp`, `IfExpr`).
     - `evaluator.py` — `evaluate(ast, row_accessor, fuse)
       -> EvalResult` stub.
     - `resolver.py` — `resolve_refs(ast,
       resolver) -> ResolvedAST` stub (display-name → id).
     - `errors.py` — re-exports `api_error` builders for the
       Phase 4 error codes.
     - `limits.py` — module-level constants for D23 limits.
   - new `backend/tests/fixtures/formula_evaluator_corpus.json`
     — empty list scaffold; P4.1 seeds it; later phases extend
     it.
   - new `backend/tests/fixtures/formula_grammar_corpus.json`
     — empty list scaffold; P4.1 seeds it.
   - extend `backend/features/project_document/schema_mutations.py`
     `SetFormulaMutation` shape (currently a placeholder body
     accepting `config: dict[str, object]`) with the typed
     payload P4.5 will validate against; keep the
     `_raise_unsupported_mutation("setFormula")` dispatch line
     in place until P4.5 implements the real branch.
   - extend `backend/features/project_document/tables/contracts.py`
     `CustomFieldCapability` with **two new accessor slots,
     intentionally unused in P4.0**:
     - `core_field_value_for_formula: Callable[[BaseModel, str],
       object | None]` — read a core field by its
       `field_key`. Frees the evaluator from any per-table
       branching.
     - `core_field_type_for_formula: Callable[[str],
       Literal["text", "number", "single_select"] | None]` —
       returns the evaluator-facing type of a core field for
       static type inference (D25 type_mismatch errors). Both
       are wired up on the Rooms contract in P4.3.

6. **Frontend scaffold:**
   - new `frontend/src/shared/ui/data-table/lib/formula/`
     directory with:
     - `tokens.ts` — token enum + interface (mirror of Python).
     - `parser.ts` — `parse(source: string): FormulaAST` stub.
     - `ast.ts` — discriminated-union node interfaces.
     - `evaluator.ts` — `evaluate(ast, row, fuse): EvalResult`
       stub.
     - `resolver.ts` — `resolveRefs(ast, resolver):
       ResolvedAST` stub.
     - `limits.ts` — module-level constants mirroring the
       Python ones.
   - new
     `frontend/src/shared/ui/data-table/components/FormulaEditorPopover.tsx`
     — placeholder default-export with a `// TODO P4.8` body.
   - new
     `frontend/src/shared/ui/data-table/components/FormulaFieldPalette.tsx`
     — placeholder for the field-palette panel rendered inside
     `FormulaEditorPopover` and (optionally) inside an
     escalated modal.
   - new
     `frontend/src/shared/ui/data-table/components/ComputedCell.tsx`
     — extract the existing inline computed-cell render (today
     coupled to specific column accessors in `RoomsTable`) into
     a shared component so the read-overlay path can render
     identically across tables. The shared cell consumes
     `row.computed[cf_id]` and renders ready / stale /
     loading / error per US-CF-8 criterion 5.

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- Diff is doc + empty files only.
- D22 / D23 / D24 / D25 / D26 closed in chat and recorded in
  plan-13 §3 + this plan's `## Open questions` section before
  opening the P4.1 PR.

---

## Phase 4.1 — Backend: tokenizer + parser + AST + resource limits + shared corpus skeleton

**Goal.** Land the Python grammar implementation end-to-end *to
the AST*. No evaluation yet; the evaluator lands in P4.2 against
the same AST. The shared corpus is seeded with parse-only cases
so P4.7 (TS port) has byte-equal targets.

### Backend changes

**`backend/features/project_document/formula/tokens.py`** —
recursive-descent-friendly token set:

```python
class TokenKind(StrEnum):
    NUMBER = "NUMBER"          # 42, 1.5, 1e-3
    STRING = "STRING"          # "..." with \\ \" \n escapes only
    BOOL   = "BOOL"            # true / false
    NULL   = "NULL"            # null
    IDENT  = "IDENT"           # function names; reserved words filtered
    FIELD_REF = "FIELD_REF"    # {Display Name}
    LPAREN = "LPAREN"
    RPAREN = "RPAREN"
    COMMA  = "COMMA"
    PLUS = "PLUS"; MINUS = "MINUS"; STAR = "STAR"; SLASH = "SLASH"; PERCENT = "PERCENT"
    EQ = "EQ"; NEQ = "NEQ"; LT = "LT"; LTE = "LTE"; GT = "GT"; GTE = "GTE"
    AND = "AND"; OR = "OR"; NOT = "NOT"
    IF = "IF"
    EOF = "EOF"
```

**`backend/features/project_document/formula/ast.py`** —
discriminated-union dataclasses, frozen, slotted, with `kind`
fields suitable for JSON serialisation (round-trips through
`config.ast`):

```python
@dataclass(frozen=True, slots=True)
class Literal:
    kind: Literal["literal"]
    value: str | float | bool | None
    inferred_type: Literal["text", "number", "bool", "null"]

@dataclass(frozen=True, slots=True)
class FieldRef:
    kind: Literal["field_ref"]
    # Phase 4.1 parses display names; Phase 4.3 resolves them to
    # `field_id`. Pre-resolve, `field_id` is None.
    display_name: str
    field_id: str | None

@dataclass(frozen=True, slots=True)
class FuncCall:
    kind: Literal["func_call"]
    name: str
    args: tuple[FormulaAST, ...]

# ... BinaryOp, UnaryOp, IfExpr similarly
```

**`backend/features/project_document/formula/parser.py`** —
recursive-descent parser following the grammar in plan-13 §4.4.
Returns the **unresolved** AST (FieldRefs carry display names
only). Raises `FormulaParseError(message, offset)` on any
grammar violation; the schema-mutation service translates this
to `custom_field_formula_parse_error` in P4.5.

The parser enforces D23 hard limits **at parse time**:
- source length pre-check (`source_length`),
- node-count counter (`ast_node_count`),
- depth tracker (`ast_depth`),
- distinct-field-ref counter (`dep_count`).

Any breach raises `FormulaResourceLimitError(limit_name,
actual, max)` — translated to
`custom_field_formula_resource_limit` in P4.5.

Function-name allow-list enforced at parse time: unknown
function names raise `FormulaUnsupportedFunctionError(name,
available)`, translated to
`custom_field_formula_unsupported_function`.

**Allowed v1 functions** (plan-13 §4.4):
`concat`, `upper`, `lower`, `replace`, `substring`, `len`,
`trim`, `number`, `text`, `if`.

**`backend/features/project_document/formula/limits.py`** —
module-level constants from D23. Single source of truth; both
parser and evaluator import from here. P4.7's TS port mirrors
these via a small JSON fixture.

### Shared corpus skeleton

`backend/tests/fixtures/formula_grammar_corpus.json` — list of
`{name, source, expected_ast | expected_error}` cases. Seed
with at least:

- one happy-path per grammar production (literal, field ref,
  call, each binary op, each comparison, `and` / `or` / `not`,
  `if`, parentheses, nested calls),
- one limit-breach per D23 limit (long source, deep nesting,
  too many nodes, too many distinct refs),
- one unsupported-function case,
- a small set of edge cases (empty source, whitespace-only
  source, unterminated string, unterminated `{`, trailing
  comma in call, comparison chain `a < b < c` rejected since
  the grammar disallows it).

### New tests

`backend/tests/test_project_document_formula_grammar.py`
(new file):

- `test_grammar_corpus_round_trips` — parametrize over every
  case in `formula_grammar_corpus.json`; assert AST shape /
  error type matches the expected entry.
- `test_parser_records_source_offsets_on_errors` — for every
  expected-error case, the raised error carries an `offset`
  that points at the offending character.
- `test_parser_enforces_resource_limits` — table-driven over
  each limit in `limits.py`.
- `test_parser_function_name_allowlist_round_trip` — every
  function name in the allow-list parses; calling an
  unsupported function raises the structured error.

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- Corpus seeded, all parse-only cases green.
- No HTTP / MCP surface change yet.

---

## Phase 4.2 — Backend: evaluator + per-row budget + deterministic semantics

**Goal.** The Python evaluator runs every grammar production
against a row-accessor callable. Numeric / null / div-by-zero /
string-coercion / boolean semantics are pinned in this PR and
codified by the shared `formula_evaluator_corpus.json` fixture.
The TS port in P4.7 must agree to the byte.

### Backend changes

**`backend/features/project_document/formula/evaluator.py`:**

```python
@dataclass(slots=True)
class EvalFuse:
    nodes_evaluated: int = 0
    max_nodes: int = 1024                 # D23 default fuse

@dataclass(frozen=True, slots=True)
class EvalSuccess:
    value: str | float | bool | None

@dataclass(frozen=True, slots=True)
class EvalError:
    code: Literal["div_by_zero", "type_mismatch", "missing_ref",
                  "fuse_tripped", "output_too_long"]

EvalResult = EvalSuccess | EvalError

def evaluate(
    ast: FormulaAST,
    row_accessor: Callable[[str], object | None],   # field_id → raw value
    *,
    fuse: EvalFuse | None = None,
    output_length_max: int = OUTPUT_LENGTH_MAX,
) -> EvalResult:
    ...
```

Semantics (codified to D22 / D26):

- Numbers are `float`; integer literals are floats. `/` always
  returns float; `1 / 2 == 0.5`.
- `n / 0` (any n including 0) → `EvalError("div_by_zero")`.
- `%`: explicit `_fmod(a, b)` helper using `math.fmod` (matches
  TS port's helper signature).
- `null` propagation: arithmetic / comparison with `null` →
  `null` (except `=` / `!=` which test identity to `null`
  itself).
- `concat`, `upper`, `lower`, `trim`, `replace`, `substring`,
  `len`: coerce `null` argument to `""`; non-string non-null
  argument → `EvalError("type_mismatch")`.
- `number(x)`: parse `x` as JSON number; on failure → `null`
  (matches AirTable's tolerant cast). `text(x)`: deterministic
  string formatting:
  - `null` → `null` (not `"null"`),
  - `bool` → `"true"` / `"false"`,
  - `float` integer-valued → `"42"` (no trailing `.0`);
  - `float` fractional → Python `repr()` truncated by a shared
    formatter that matches V8's `Number.prototype.toString`
    output for the corpus subset. The corpus tests every edge
    that matters.
- `if(cond, a, b)`: truthiness rule matches D22 — `null` and
  `false` are falsy, `0` is falsy, `""` is falsy, every other
  value is truthy. Both branches must type-check identically
  (post-coercion); a `text` branch and a `number` branch in the
  same `if` is a `type_mismatch` at evaluate time, *not* at
  parse time (Phase 4 grammar is dynamically typed; static type
  inference is a Phase 5 follow-up).
- Output length: once the evaluator produces a string result,
  check `len(result) > output_length_max` → `EvalError(
  "output_too_long")`.
- Fuse: every AST node bumps `fuse.nodes_evaluated`; on
  overflow → `EvalError("fuse_tripped")`.

**`backend/tests/fixtures/formula_evaluator_corpus.json`** —
seeded with at least 100 cases covering:
- every binary / comparison / boolean op with both null and
  non-null operands,
- every string function with both null and non-null arguments,
- numeric edge cases (large floats, negative zero, very small
  positive, `1e308 * 2` overflow trapped as `type_mismatch`
  rather than `Infinity`),
- `if` with mismatched-type branches,
- div-by-zero, fuse trip (synthetic deeply-nested expression),
- output too long (long `concat`),
- 1-indexed inclusive-end `substring` cases (D24),
- string `<` / `>` non-ASCII cases (review amendment R2).

### New tests

`backend/tests/test_project_document_formula_evaluator.py`:
- `test_evaluator_corpus_round_trips` — parametrise over every
  case; assert `EvalResult` matches expected `EvalSuccess` /
  `EvalError`.
- `test_evaluator_fuse_terminates_pathological_expression` —
  hand-crafted expression that walks toward the fuse cap;
  assert `EvalError("fuse_tripped")`.
- `test_evaluator_output_length_caps` — `concat` building a
  too-long string.
- `test_evaluator_null_propagation_table` — table-driven over
  every operator × null operand combo.

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- Evaluator corpus seeded; all cases green.
- No frontend change.

---

## Phase 4.3 — Backend: dependency resolution + cycle detection + missing-ref pass

**Goal.** The parser produces `FieldRef(display_name=..., field_id=None)`
nodes; commit time must resolve every display name against the
current table's `{core fields} ∪ {custom fields}`. Cycles
(`a → b → a`, `a → a`) are rejected at commit time, before the
mutation is accepted. Missing refs at evaluate time (a referenced
field was deleted *after* the formula was saved in a later edit
session) surface as the structured `missing_ref` evaluator value.

This is the seam where the formula contract meets the
table contract. The `CustomFieldCapability` accessors scaffolded
in P4.0 (`core_field_value_for_formula`,
`core_field_type_for_formula`) are wired up on the Rooms
contract here.

### Backend changes

**`backend/features/project_document/formula/resolver.py`:**

```python
@dataclass(frozen=True, slots=True)
class FieldRegistryEntry:
    field_id: str
    display_name: str
    origin: Literal["core", "custom"]
    field_type: Literal["text", "number", "single_select", "formula"]

def build_field_registry(
    capability: CustomFieldCapability,
    body: ProjectDocumentV1,
) -> tuple[FieldRegistryEntry, ...]:
    """Snapshot the resolvable refs for this table at this moment.
    Both core fields (from `capability.core_field_keys` +
    `core_field_type_for_formula`) and custom fields are
    included; the registry is ordered core-then-custom in column
    order. Custom formula fields are *included* so the cycle
    detector can see them, but field refs whose target is a
    formula are resolved to the target's `field_id` and the
    evaluator computes them lazily."""

def resolve_refs(
    ast: FormulaAST,
    registry: Iterable[FieldRegistryEntry],
) -> ResolvedAST:
    """Walk `ast`; for every FieldRef, look up by
    case-insensitive trimmed display_name; raise
    FormulaMissingRefError(display_name) if not found. Return a
    new AST with `field_id` populated."""

def detect_cycles(
    field_id: str,
    ast: ResolvedAST,
    asts_by_field_id: Mapping[str, ResolvedAST],
) -> None:
    """DFS over the dep graph starting from `field_id`.
    `asts_by_field_id` carries every *other* formula field's
    resolved AST. Raises FormulaCycleError(path)."""
```

**`backend/features/project_document/document.py`**:
`validate_document_references` gains a third pass after the
single-select option-id pass:

1. For every custom-field-capable table, snapshot the field
   registry.
2. For every custom field with `field_type == "formula"`:
   - re-resolve its `config.ast` against the current registry
     (renames since save are absorbed silently — D2);
   - if a ref no longer resolves, leave the stored AST
     untouched (the evaluator surfaces `missing_ref` at read
     time);
   - run `detect_cycles`.

The pass does *not* re-parse `config.source`; the stored AST
is authoritative for evaluation. Editor renders re-derive the
displayed source from the AST + current display names (P4.8).

**`backend/features/project_document/tables/rooms.py`**:
- wire `core_field_value_for_formula` to a `getattr(row,
  field_key)` accessor with `ROOMS_CORE_FIELD_KEYS` allowlist,
- wire `core_field_type_for_formula` to a static map (`number`
  for `num_people` / `num_bedrooms` / `icfa_factor`; `text` for
  `name` / `number` / `notes`; `single_select` for
  `floor_level` / `building_zone`; `text` for the
  list-of-id `erv_unit_ids` after string-join coercion in
  P4.4),
- assert by test that every key in `ROOMS_CORE_FIELD_KEYS` has
  an explicit type entry; missing entries fail
  `typecheck_rooms_formula_core_field_types`.

### New tests

`backend/tests/test_project_document_formula_resolution.py`:
- `test_resolve_field_ref_by_display_name_case_insensitive` —
  `{name}` / `{NAME}` / `{ Name }` all resolve to the same
  `field_id`.
- `test_resolve_missing_ref_raises` — `{Does Not Exist}` →
  `FormulaMissingRefError`.
- `test_detect_self_cycle` — formula refers to itself.
- `test_detect_two_node_cycle` — `a` refers to `b`; `b` refers
  to `a`.
- `test_detect_long_cycle` — `a → b → c → a`.
- `test_no_cycle_when_acyclic_chain` — `a → b → c`; no error.
- `test_validate_document_references_passes_for_resolvable_formula`.
- `test_validate_document_references_silently_absorbs_renames`
  — start with a formula referring to `{Name}`; rename `name`
  to `Title`; the stored AST is unchanged; the document is
  still valid; on read the formula evaluates against the
  renamed core field by id.
- `test_validate_document_references_leaves_missing_ref_in_ast`
  — delete a referenced custom field; the document is still
  valid; the evaluator returns `EvalError("missing_ref")` at
  read time (covered in P4.4 tests).

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- New tests pass.

---

## Phase 4.4 — Backend: computed read-overlay on every custom-field-capable table

**Goal.** Every table response, JSON download, and MCP `get_table`
read shapes its rows as `{... custom: {...}, computed: {...}}`.
The `computed` overlay is computed lazily on read (never stored),
covers every custom field with `field_type == "formula"`, and
encodes evaluator errors per D25.

This is the first wire-shape change since Phase 1; review the
overlay format with the team before merging.

### Backend changes

**`backend/features/project_document/formula/__init__.py`** —
expose a single high-level helper:

```python
def evaluate_table_formulas(
    capability: CustomFieldCapability,
    body: ProjectDocumentV1,
) -> dict[str, dict[str, object]]:
    """Return `{row_id: {cf_id: encoded_value}}` for every formula
    field on this table; topologically sorts formula deps so a
    formula referring to another formula sees the upstream value.
    On formula-to-formula cycle (impossible after P4.3's commit
    check unless the document was hand-edited), every cell in
    the cycle gets `{"error": "missing_ref"}` and a warning is
    logged."""
```

Encoding: success → raw scalar; `EvalError(code)` → `{"error":
code}`. Read clients distinguish "no formula fields" (overlay
absent or `{}`) from "row not in overlay" (treat as `{}`).

**`backend/features/project_document/tables/contracts.py`** —
`CustomFieldCapability` gains:

```python
attach_computed_overlay: Callable[
    [list[dict[str, object]], dict[str, dict[str, object]]],
    list[dict[str, object]],
]
```

Default implementation (used by every contract unless overridden):
attach `row["computed"] = overlay.get(row["id"], {})` on every
row dict. Tables that emit non-dict row shapes (e.g. envelope
tables — currently none) override.

**`backend/features/project_document/tables/rooms.py`** — wires
the default attach helper; nothing Rooms-specific.

**`backend/features/project_document/downloads.py`** —
`table_download_body` now:
1. extracts rows via `contract.extract_rows`,
2. computes overlay via `evaluate_table_formulas`,
3. attaches the overlay via `contract.custom_fields.attach_computed_overlay`.

**`backend/features/project_document/routes.py`** — extend every
table-response builder (Rooms slice, draft slice, version slice)
so the response carries the overlay. The slice response model
(e.g. `RoomsSliceResponse`) gains `rows_computed:
dict[str, dict[str, object]]` so the wire shape is explicit and
self-documenting; the response builder fills it from
`evaluate_table_formulas`. The legacy attach-on-row path remains
the canonical download shape (D3 / US-CF-10), but the slice
response also carries the side-mapping for cheaper consumption
by the SPA.

**`backend/features/mcp/server.py`** — `get_table` and any
existing slice-read MCP tools mirror the overlay shape (already
attached server-side; no per-tool change needed beyond a
response-schema update).

### Update existing tests

- `test_download_rooms_omits_computed_overlay_in_phase_1` →
  rename and update to
  `test_download_rooms_computed_overlay_empty_without_formula_fields`
  — assert every row has `computed: {}` (not absent) when no
  formula field exists. This makes the wire shape explicit.

### New tests

`backend/tests/test_project_document_formula_read_overlay.py`:
- `test_formula_value_appears_in_download_overlay` — seed a
  formula `concat({Number}, " — ", upper({Name}))`; assert the
  download has `computed["cf_..."]` matching the expected
  string on every row.
- `test_formula_value_appears_in_slice_response` — same check
  on the Rooms slice response.
- `test_formula_value_appears_in_mcp_get_table` — same check
  via the MCP read tool.
- `test_formula_missing_ref_after_deletion_renders_error` —
  P4.3's silent-absorb behaviour + read-time evaluator
  `missing_ref` encoding.
- `test_formula_div_by_zero_renders_error` — formula
  `{Num People} / {Num Bedrooms}` with a row where
  `num_bedrooms == 0`.
- `test_formula_to_formula_dep_topological_order` — two
  formula fields where `b` refers to `a`; `b` sees the
  computed value of `a`, not a stale or empty value.
- `test_formula_aggregation_sees_overlay_values` (review
  amendment R5) — NUMBER aggregation over a formula column
  reads the computed values.
- `test_formula_visible_in_viewer_mode_read` (review amendment
  R6) — unauthenticated GET on a published project returns
  the computed overlay populated.

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- The Phase 1 "no computed key" contract is intentionally
  broken and replaced by the explicit empty-`{}` invariant.

---

## Phase 4.5 — Backend: `SetFormulaMutation` dispatch + REST surface

**Goal.** Replace the
`_raise_unsupported_mutation("setFormula")` line in
`apply_schema_mutation` with the real dispatch. The mutation
carries `source` (the user-facing string) and `expectedSchemaFingerprint`;
the server parses, resolves, cycle-checks, runs the lazy-eval
overlay across all rows once, accepts the mutation, and returns
the audit payload.

### Backend changes

**`backend/features/project_document/schema_mutations.py`** —
replace the placeholder body of `SetFormulaMutation`:

```python
class SetFormulaMutation(BaseModel):
    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["setFormula"]
    table_key: str
    field_id: str
    # User-facing source string. Length capped by D23
    # `source_length`. The server parses + resolves + stores the
    # AST + deps; the source is also stored verbatim so the
    # editor can render it (with display-name updates) on next
    # open.
    source: str
    expected_schema_fingerprint: str
```

Add audit mapping:
```python
AUDIT_KIND_BY_MUTATION["setFormula"] = "project_version_custom_field_set_formula"
```

Dispatch `_apply_set_formula`:
1. Look up the current `CustomFieldDef`; reject if absent
   (`custom_field_invalid_field_id`).
2. Reject if `field.field_type != CustomFieldType.formula`
   (`custom_field_invalid_field_id` with
   `details.reason: "field_type_not_formula"`).
3. Parse `mutation.source` →
   `custom_field_formula_parse_error` /
   `custom_field_formula_resource_limit` /
   `custom_field_formula_unsupported_function`.
4. Resolve refs → `custom_field_formula_missing_ref`.
5. Cycle check against the table's other formula fields →
   `custom_field_formula_cycle`.
6. Build the new `config = {"source": source, "ast": serialised
   AST, "deps": [field_id, ...]}`; replace the field's `config`
   atomically; preserve everything else (id, display_name,
   description, field_key, created_at, created_by).
7. Re-run `validate_document`.
8. Return `(next_body, {"deps": [...], "source_length": ...,
   "ast_node_count": ...})`.

**Per-mutation rules:**
- The mutation **does not** carry `acknowledge_destructive` —
  setting a formula is non-destructive (no row data changes).
- The mutation **does not** carry a `cell_writes` slot.
- An empty `source` is rejected (`source_length` minimum 1).
- The mutation may be called repeatedly; each call replaces
  the prior config atomically.

**`backend/features/project_document/drafts.py`** — no signature
change. `apply_schema_mutation_to_draft` already handles
discriminated dispatch.

**`backend/features/project_document/routes.py`** — no signature
change; the existing
`POST .../custom-fields:mutate` endpoint picks up
`SetFormulaMutation` via Pydantic discriminator dispatch.

### New tests

`backend/tests/test_project_document_schema_mutations.py` —
extend with set-formula cases:

- `test_set_formula_round_trip` — happy path; round-trip
  source / AST / deps.
- `test_set_formula_rejects_parse_error`.
- `test_set_formula_rejects_resource_limit_breach` (one test
  per limit).
- `test_set_formula_rejects_unsupported_function`.
- `test_set_formula_rejects_missing_ref`.
- `test_set_formula_rejects_cycle_with_other_formula`.
- `test_set_formula_rejects_self_reference`.
- `test_set_formula_rejects_non_formula_field`.
- `test_set_formula_rejects_stale_fingerprint`.
- `test_set_formula_preserves_field_identity_metadata` —
  display_name, description, created_at, created_by unchanged.
- `test_set_formula_emits_correct_audit_payload`.

`backend/tests/test_project_document_schema_mutation_endpoint.py` —
extend:

- `test_post_set_formula_round_trip` — POST + GET +
  `computed` overlay populated.
- `test_post_set_formula_returns_422_parse_error` — message
  template matches ADR.
- `test_post_set_formula_returns_422_cycle` — payload carries
  `cycle_path`.

### Acceptance

- `make typecheck`, `make test`, `make lint`, `make smoke`
  green.

---

## Phase 4.6 — Backend: MCP write tool `set_custom_field_formula` + security checkpoint

**Goal.** Expose `SetFormulaMutation` through MCP under the same
editor-scope / project-binding gate the Phase 2/3 tools already
enforce. Extend `_SCHEMA_MUTATION_RECOVERABILITY` with the new
codes.

### Backend changes

**`backend/features/mcp/server.py`** — new tool:

```python
@mcp.tool()
def set_custom_field_formula(
    project_id: str,
    version_id: str,
    table_key: str,
    field_id: str,
    source: str,
    expected_schema_fingerprint: str,
    ctx: Context,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    """Set or replace the formula source on a custom formula
    field. The server parses, resolves refs, and cycle-checks;
    the response carries `deps` (resolved field ids) and
    `ast_node_count`."""
```

Delegates to the same `_apply_mcp_schema_mutation_with_audit`
helper Phase 2 / 3 use (`updated_via='mcp'`, editor scope check,
ETag forwarding for the draft).

**`_SCHEMA_MUTATION_RECOVERABILITY`** — extend:

```python
_SCHEMA_MUTATION_RECOVERABILITY.update({
    "custom_field_formula_parse_error": "fatal",
    "custom_field_formula_cycle": "fatal",
    "custom_field_formula_missing_ref": "fatal",
    "custom_field_formula_resource_limit": "fatal",
    "custom_field_formula_unsupported_function": "fatal",
})
```

### Security checkpoint

Same routine as P2.3 / P3.4. Confirm:
- the tool shares the `project:write` scope gate;
- the tool is project-bound (cannot operate cross-project from a
  token scoped to another project);
- the read-overlay computed values are *not* exposed to a token
  that does not also have `project:read` on the same project
  (formula evaluation is server-side; the overlay is part of the
  read response that already enforces this gate);
- the formula evaluator's fuse cap prevents an MCP-token holder
  from DoS-ing the read path with pathological formulas (R8).

Append a one-paragraph note to the Phase 2 ADR's security
checkpoint section with findings (or "no blocking findings").

### New tests

`backend/tests/test_mcp_custom_fields.py` — extend:

- `test_mcp_set_formula_round_trip`,
- `test_mcp_set_formula_returns_recoverability_fatal_on_parse_error`,
- `test_mcp_set_formula_returns_recoverability_fatal_on_cycle`,
- `test_mcp_set_formula_emits_audit_with_updated_via_mcp`,
- `test_mcp_set_formula_rejects_when_scope_missing`,
- `test_mcp_get_table_after_set_formula_returns_computed_overlay`.

### Acceptance

- `make typecheck`, `make test`, `make lint`, `make smoke`
  green.
- Security checkpoint paragraph appended.

---

## Phase 4.7 — Frontend: TS tokenizer + parser + evaluator + corpus parity

**Goal.** Land the TypeScript port of the parser and evaluator,
driven by the same fixture corpora the Python tests use. CI fails
on the first divergence.

### Frontend changes

**`frontend/src/shared/ui/data-table/lib/formula/tokens.ts`** —
TS mirror of Python `TokenKind` + `Token`.

**`frontend/src/shared/ui/data-table/lib/formula/parser.ts`** —
recursive-descent parser, same grammar. Same D23 limits read
from `limits.ts`. Returns an unresolved `FormulaAST` (refs by
display name).

**`frontend/src/shared/ui/data-table/lib/formula/ast.ts`** —
discriminated-union TS interfaces matching the Python
dataclasses byte-for-byte through JSON (`kind` field encoding).
Add a small `serialise(ast)` / `deserialise(json)` pair so the
shared corpus's `expected_ast` JSON can be compared directly.

**`frontend/src/shared/ui/data-table/lib/formula/evaluator.ts`** —
TS mirror of `evaluator.py`:

```ts
export type EvalResult =
  | { ok: true; value: string | number | boolean | null }
  | { ok: false; code:
      | "div_by_zero" | "type_mismatch" | "missing_ref"
      | "fuse_tripped" | "output_too_long" };

export type EvalFuse = { nodesEvaluated: number; maxNodes: number };

export function evaluate(
  ast: FormulaAST,
  rowAccessor: (fieldId: string) => unknown,
  options?: { fuse?: EvalFuse; outputLengthMax?: number },
): EvalResult;
```

Semantics mirror the Python evaluator exactly:
- `_fmod(a, b)` helper for `%` (do **not** use JS `%`),
- explicit number-formatter for `text(n)` matching V8 +
  Python's pinned format,
- explicit string-comparison helper using code-point ordering
  (`<` between strings in JS is *not* the same as Python's
  string comparison for all Unicode; the helper normalises both
  sides),
- output-length cap and fuse identical.

**`frontend/src/shared/ui/data-table/lib/formula/resolver.ts`** —
TS port of `resolve_refs`. Cycle detection is **not** needed on
the frontend at evaluate time (the backend rejects cycles at
commit time and the read-overlay path is server-side); the
resolver is used inside the editor for the live preview only.

**`frontend/src/shared/ui/data-table/lib/formula/limits.ts`** —
TS constants mirroring `formula/limits.py`. Both files import
from a shared JSON `limits.json` checked in alongside the
corpora; CI fails if the two language constants drift.

### Shared corpus parity tests

`frontend/src/shared/ui/data-table/__tests__/formulaGrammarCorpus.test.ts`:
- Import `backend/tests/fixtures/formula_grammar_corpus.json`
  via a Vite alias (already used for fixture sharing in
  Phase 3's `custom_field_coercion_corpus.json`).
- Parametrise over every case; assert AST shape / error type
  matches.

`frontend/src/shared/ui/data-table/__tests__/formulaEvaluatorCorpus.test.ts`:
- Same pattern over `formula_evaluator_corpus.json`.
- Helper `assertEvalResultEqual` compares `EvalResult`s
  byte-for-byte (no float epsilon; the corpus pins exact
  values).

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- The two corpora pass on both sides.

---

## Phase 4.8 — Frontend: `<FormulaEditorPopover>` + field palette + focused-row live preview

**Goal.** The formula editor is a single popover (escalating to a
modal once the source crosses the threshold) shared by:
- `<AddFieldPopover>` when the user picks the `formula` pill
  (wired in P4.9),
- the header context menu's `Edit formula…` item for an
  existing formula field (wired in P4.9).

### Frontend changes

**`frontend/src/shared/ui/data-table/components/FormulaFieldPalette.tsx`** —
a list of clickable chips, one per field in the table (core +
custom, in column order, excluding the field being edited so a
self-reference cannot be inserted by a single click). Click
inserts `{Display Name}` at the cursor position of the source
input. Disabled state when the source has crossed the
`source_length` cap.

**`frontend/src/shared/ui/data-table/components/FormulaEditorPopover.tsx`:**

```tsx
export type FormulaEditorPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorElement: HTMLElement | null;
  // The field being edited (existing formula field) or the
  // shape being created (new field; id is freshly minted).
  fieldDef: { id: string; display_name: string };
  // Resolved registry for ref completion / palette / live
  // preview. P4.9's caller computes this from
  // `useTableSchema(...).fieldDefs`.
  fieldRegistry: ReadonlyArray<{
    field_id: string;
    display_name: string;
    field_type: "text" | "number" | "single_select" | "formula";
  }>;
  // The row the live preview evaluates against. May be null
  // when no row is focused.
  focusedRow: { id: string; values: Record<string, unknown> } | null;
  initialSource: string;                      // "" for new fields
  onSubmit: (next: { source: string }) => Promise<void>;
};
```

Surface:

1. **Expression input** — `<input>` for sources ≤ 80 chars;
   auto-escalates to a multi-line `<textarea>` when the source
   passes 80 chars, and to a separate modal once it crosses
   240 chars (plan-13 D7). Threshold tokens live in
   `limits.ts` so they can be tuned without code changes.
2. **Field palette** — `<FormulaFieldPalette>` rendered
   beside / below the input.
3. **Live preview panel** — shows parsed-AST status, dep
   list, and (when a row is focused) the evaluated result.
   Updates on every keystroke after a small debounce
   (default 80ms) using the local TS parser + evaluator.
   When `focusedRow` is `null`, renders "Focus a row to
   preview" instead of evaluating.
4. **Submit** — disabled while the local parser reports any
   error; on click, calls `onSubmit({source})`; the caller
   (`EquipmentTab`) dispatches the typed
   `SetFormulaMutation`. Server-side parse errors come back
   through the existing error-band routing and the popover
   re-renders them inline using the same payload shape the
   editor already understands (`{parse_error, offset}`).

**Display-name rendering on open (US-CF-8 criterion 8 / D2).**
The popover's initial `source` is computed from the stored AST,
not from `config.source`. Renaming a referenced field between
sessions updates the displayed expression automatically; the
stored AST is untouched because field refs are by id. Implement
by:
- on open with an existing formula field, walk the stored AST
  and replace each `field_id` ref with `{Current Display Name}`
  resolved from the live `fieldRegistry`;
- if a ref no longer resolves, emit `{<deleted field>}` and
  surface a structured warning in the preview panel.

The user-typed source is preserved verbatim during the editor
session; the rebuild from AST happens on *open*, not on every
edit.

### Cell render path

**`frontend/src/shared/ui/data-table/components/ComputedCell.tsx`** —
P4.0's scaffold gets its body:

```tsx
export type ComputedCellProps = {
  // From row.computed[fieldDef.field_key].
  value: unknown;
  computedType?: "text" | "number";
};
```

Renders:
- `null` → blank cell (no zero-width ambiguity),
- raw scalar → formatted per `computedType`,
- `{error: code}` → muted `#ERROR` glyph with a tooltip
  carrying the human-readable error message (looked up from
  the ADR's user-facing-template table at build time so the
  copy lives in one place).

### New tests

- `FormulaEditorPopover.test.tsx` — open with no row focused
  (preview hint shown); open with row focused (preview
  evaluates); type a parse error (Submit disabled);
  click a palette chip (text inserted at cursor); submit
  happy path (`onSubmit` called with the typed source).
- `FormulaEditorPopover.displayNameRender.test.tsx` —
  open with a stored AST whose ref's display name has changed
  since save; the input shows the *current* display name; the
  stored AST is untouched.
- `FormulaEditorPopover.cycleAcknowledgement.test.tsx` —
  the editor's local cycle detector flags `a → a`; Submit
  disabled; clear the cycle; Submit enabled.
- `ComputedCell.test.tsx` — renders each `EvalResult`
  shape correctly (text, number, null, each error code).

### Acceptance

- `make typecheck`, `make test`, `make lint` green.
- The popover is reachable in isolation (test harness only) —
  AddFieldPopover and HeaderContextMenu wiring lands in P4.9.

---

## Phase 4.9 — Frontend: AddFieldPopover `formula` pill + HeaderContextMenu `Edit formula…` + computed cell wiring + unlock duplicate formula

**Goal.** Editors can create and edit formula fields end-to-end
through the rendered UI. The grid renders computed values via
`<ComputedCell>`, reading `row.computed[cf_id]` populated by the
backend overlay. Sort / filter / group / aggregate on formula
columns work via the existing `computed` field-type machinery
(formula `→` `computed` mapping is already in place in
`useTableSchema` and the filter-operator registry).

### Frontend changes

**`frontend/src/shared/ui/data-table/components/AddFieldPopover.tsx`:**
- The `formula` pill loses its `disabled` + planned-phase
  tooltip; selecting it expands `<FormulaEditorPopover>` inline
  (the four other type pills hide the formula editor; switching
  back to `formula` re-opens the editor with the source the
  user had typed).
- Submit is disabled while the formula editor reports any error
  (mirrors the single-select min-option-count gate from P3.5).
- On submit for `formula`:
  - Mint the `cf_*` id via `mintCustomFieldId()`.
  - Build an `AddFieldMutation` whose `after.field_type =
    "formula"` and `after.config = {source, ast, deps}`.
    Backend re-parses + re-resolves on commit (defence in
    depth) — the client-side parsed config is an optimistic
    submission, not the system of record.

Wire-shape note: the existing `AddFieldMutation` schema accepts
`config: dict[str, object]` already; the optional
`initialOptions` slot from P3.5 stays single-select-only. For
formula adds, the parsed `{source, ast, deps}` goes into
`config`. No new mutation kind; no two-round-trip flow (avoids
the P3.5 amendment #4 footgun).

**`frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx`:**
- Add an `Edit formula…` item, visible only on custom fields
  with `field_type === "computed"` whose underlying
  `CustomFieldType` is `formula`. Item is placed between
  `Rename field` and `Change type` (greyed `Change type` stays
  for formula fields per D19).
- Item fires `onEditFieldFormula?: (fieldKey: string) => void`
  passed by the parent (DataTable).

**`frontend/src/shared/ui/data-table/DataTable.tsx`** —
add `onEditFieldFormula?: (fieldKey: string) => void` prop;
manage `<FormulaEditorPopover>` open state inside DataTable;
compute `fieldRegistry` from `fieldDefs`; compute `focusedRow`
from the existing focus model.

**`frontend/src/features/equipment/routes/EquipmentTab.tsx`:**
- New `handleEditFieldFormula(fieldKey, source)` builds the
  typed `SetFormulaMutation` and dispatches via
  `commitSchemaMutation`. Routes
  `custom_field_formula_*` errors through to the editor
  popover (same catch + re-throw pattern as
  `custom_field_duplicate_name`).
- Remove the `if (source.field_type === "formula")` guard in
  `handleDuplicateCustomField`. The backend's `duplicateField`
  apply path deep-copies `config` already; for formula fields
  the deep copy of `config.ast` is sufficient (the ids referenced
  in the AST point at fields in the same table, which the
  duplicate inherits unchanged).
- Pass the `rows_computed` side-mapping from the Rooms slice
  response down through to the rendered `RoomsTable` so
  `<ComputedCell>` reads from it without per-row dict
  allocation in the render path.

**`frontend/src/shared/ui/data-table/lib/customFieldMutations.ts`:**
- Add `buildSetFormulaMutation({tableKey, fieldId, source,
  schemaFingerprint})`. Asserts non-empty `source`, length
  ≤ `SOURCE_LENGTH_MAX` (from `limits.ts`), and that the
  field id is a `cf_*`. Defers parse / resolve / cycle
  checks to the server (the popover already runs them
  client-side; the builder is the wire-shape chokepoint, not
  the validator).

### New tests

- `AddFieldPopover.test.tsx` — extend: selecting the `formula`
  pill reveals the formula editor; Submit dispatches an
  `AddFieldMutation` whose `after.field_type === "formula"`
  and `after.config.ast` is populated; popover closes on
  success.
- `RoomsTable.addFormulaField.test.tsx` — happy path,
  end-to-end: add a formula `concat({Number}, " — ",
  upper({Name}))`; assert one POST; assert the rendered grid
  shows the computed values for each row.
- `RoomsTable.editFormulaField.test.tsx` — open `Edit
  formula…` from the header context menu; change the source;
  assert one POST `SetFormulaMutation`; assert the grid
  refreshes the computed values.
- `RoomsTable.formulaCycleRejection.test.tsx` — attempt to
  set `a → b → a`; assert the popover surfaces
  `custom_field_formula_cycle` and stays open.
- `RoomsTable.formulaMissingRef.test.tsx` — delete a
  referenced custom field; assert the formula column renders
  the `missing_ref` error state on every row; the user can
  open the formula editor and fix the source.
- `RoomsTable.duplicateFormulaField.test.tsx` — duplicate a
  formula field; assert the new field renders the same
  computed values as the source on every row; assert the
  source can be edited independently after.
- `RoomsTable.formulaAggregations.test.tsx` — formula
  column with `computed_type === "number"`; aggregation
  footer shows correct sum / avg / min / max.

### Acceptance

- `make typecheck`, `make test`, `make lint`, `make smoke`
  green.
- Manual Playwright MCP smoke: open Rooms (editor), click `+`,
  pick `formula`, type `concat({Number}, " — ",
  upper({Name}))`, click a row to focus, observe the live
  preview, submit; confirm the new column renders the
  computed values. Edit the formula via the header context
  menu; change it; observe the grid refresh. Save.

---

## Phase 4.10 — Exit-criteria acceptance tests + Playwright + a11y

**Goal.** Verify plan-13 §5 Phase 4 exit criteria end-to-end —
both browser and MCP — and run a focused a11y pass on the new
surfaces.

### Backend end-to-end tests

`backend/tests/test_project_document_custom_fields_phase_4.py`
(new file; mirrors the Phase 1 / 2 / 3 naming):

1. **Formula round-trip via the typed pipeline** — POST
   `addField` with a formula config; GET the slice; confirm
   computed values; download the table; confirm the computed
   overlay matches.
2. **Grid–download parity** — for the same project, run the
   browser-side evaluator over each row (via a small Python
   shim driving the TS evaluator through a node subprocess
   in CI; or alternatively, simply load the corpus the
   browser passes and assert exact equality with the
   backend). Assert byte-equal output across every row.
3. **Cycle rejection** — POST `setFormula` creating
   `a → b → a` returns 422 with `cycle_path`.
4. **Missing ref absorption** — POST `setFormula` referring
   to `{X}`; delete `X`; the document is still valid; the
   read overlay encodes `missing_ref`; restoring `X` (or
   creating a new field named `X`) does **not** silently
   re-resolve — the AST still carries the dead `field_id`,
   and the user must re-save the formula to pick up the new
   resolution. Test pins this.
5. **Resource-limit rejection** — POST `setFormula` for each
   of the six D23 limits; assert the structured error
   payload.
6. **Renames absorbed silently** — POST `setFormula` referring
   to `{Name}`; POST `renameField` to rename `name` to
   `Title`; assert the stored AST is unchanged; assert the
   read overlay still computes the right values; assert
   re-opening the formula editor shows
   `{Title}` not `{Name}`.
7. **Type-change forbidden** — POST `changeType` *to*
   `formula` returns 422
   `custom_field_illegal_type_conversion`; POST `changeType`
   *from* `formula` returns the same.
8. **Duplicate formula** — POST `duplicateField` on a formula
   source; the duplicate's read overlay carries the same
   computed values; editing the duplicate's source does not
   affect the original.
9. **Browser–MCP cross-talk** — set a formula via REST;
   immediately read via MCP `get_table`; confirm the
   computed values match; set a formula via MCP; confirm REST
   `GET /draft/tables/rooms` reflects the change; audit log
   distinguishes channels via `details.updated_via`.

### Frontend acceptance tests

`frontend/src/features/equipment/__tests__/RoomsTable.customFieldsPhase4.test.tsx`:

- Add a formula via the popover → edit it → duplicate it →
  delete a referenced field and observe the error state →
  recover by editing the formula → all through the rendered
  UI, none through the API client directly.
- Viewer mode shows the formula column with computed values
  and hides every schema-editor affordance — no `Edit
  formula…`, no `Change type`, no `+` cell. The computed
  values are visible.

### Playwright e2e

`frontend/tests/e2e/custom-fields-phase-4.spec.ts`:

- Full plan-13 §5 Phase 4 exit-criteria walkthrough against a
  running dev stack. Screenshots under
  `docs/plans/2026-05-25/screenshots/plan-17-p4-10/`.

### A11y pass

Run an axe scan + manual keyboard walkthrough on:

- formula editor popover: focus is trapped inside; Tab order
  is Source input → Field palette (arrow-key navigable within)
  → Preview panel (read-only, focusable for screen reader) →
  Cancel → Submit; preview panel announces parse/eval status
  changes via `aria-live="polite"`;
- modal escalation: focus returns to a sensible location when
  the modal closes (not lost to the popover root);
- field palette chips: each chip has an accessible name
  including the field type ("Number column", "Text column",
  etc.) so screen-reader users don't have to guess;
- computed cell error state: the `#ERROR` glyph is
  accompanied by a non-visual cue (`aria-label="formula
  error: division by zero"`).

File a11y findings in
`docs/plans/2026-05-25/plan-17-a11y-notes.md`. Any blocking
issue is fixed in this PR; non-blocking notes feed the Phase 5
a11y polish pass (plan-13 §5).

### Acceptance

- All Phase 4 acceptance tests pass.
- `make test`, `make e2e`, `make smoke` green.
- A11y notes filed; no critical findings remain open.
- Manual exit-criteria walkthrough complete; screenshots
  filed.

---

## Cross-cutting verification checks

After each phase, run:

- `make typecheck` (backend mypy + frontend tsc);
- `make test` (pytest + vitest);
- `make lint`;
- `make smoke` (lightweight end-to-end against the running
  stack);
- `make e2e` at phase boundaries that touch user-visible
  behavior (4.4, 4.8, 4.9, 4.10).

If `make smoke` exposes a regression after the read-overlay
wire-shape change in P4.4, the most likely culprit is a
consumer (in tests or the SPA) that asserts on the shape of
the row dict without expecting the `computed` key. Grep for
`'computed' in row` and `row\["computed"\]` to surface them;
update assertions to either ignore the new key or assert
`computed: {}` explicitly.

If parity tests fail in P4.7, the divergence is almost always
one of: float formatting (D22 numeric semantics — check the
`text()` helper on both sides), `%` operator (use
`_fmod` / `_fmod` helper, not native `%`), or string
comparison locale (R2 — use code-point comparison helper, not
native `<`).

## Rollback notes

- **Pre-deploy.** No production data exists. Rolling back any
  phase is a `git revert` plus a `make test` to confirm
  fixtures still align.
- **No `schema_version` bump.** Phase 4 only adds capability
  on top of the Phase 1 envelope; the stored document shape
  is unchanged. Reverting any sub-phase does not orphan
  stored state.
- **One cutover PR to watch.** P4.4 (read-overlay wire-shape
  change) is the riskiest to revert mid-flight because
  consumers may start depending on the `computed` key
  appearing on rows. The contract is "always-present, empty
  when no formula fields exist," so a revert that puts the
  key back to absent will be caught by the explicit slice
  response assertion. If P4.4 needs to be reverted in
  isolation, also revert the Phase 1 `omits_computed_overlay`
  test rename, restoring the original "no computed key"
  contract.
- **MCP tool removal.** Reverting P4.6 removes
  `set_custom_field_formula` from the tool registry; existing
  formula values on already-saved drafts remain readable via
  the REST and MCP read paths (P4.4) until P4.4 is also
  reverted. No data is destroyed.

## Out of scope (Phase 5+)

These belong to subsequent plans, not Phase 4:

- Fan-out of custom fields (including formula fields) to ERVs
  / Pumps / Fans / Thermal Bridges — the contract abstraction
  from plan-14 P1.2 + plan-16 P3.1 + plan-17 P4.0 already
  supports them via per-table `core_field_value_for_formula`
  / `core_field_type_for_formula` accessors; Phase 5 (plan-18+)
  wires them up.
- Cross-row aggregations in formulas (`sum`, `avg`, `min`,
  `max` over a column). The grammar reserves the call-site
  shape; v1 has none of them. Aggregation footers continue to
  cover the cross-row case for now.
- Cross-table lookups in formulas.
- Date / datetime field type and date-math functions.
- Static type inference at parse time (currently type errors
  surface at evaluate time via `EvalError("type_mismatch")`).
- `round(n)` / `round(n, digits)` (deferred from D22).
- Per-user / per-role formula permissions (D9, deferred
  across the whole custom-fields plan).
- Formula error history / dead-letter queue surfacing in the
  UI beyond the per-cell `#ERROR` glyph.
- Cross-version "this formula's output changed because input
  X was renamed" warnings (D2's silent absorb is the v1
  contract).

## Progress log

### Backend half (P4.0 → P4.6) + backend P4.10 + P4.7 TS port — **landed 2026-05-25**

Each sub-phase landed against the same trunk; no separate PRs in
this drop. Full backend test suite green (332 / 332) and full
frontend test suite green (806 / 806) including the 129 new TS
parity-corpus cases.

| Sub-phase | Status | Notes |
|---|---|---|
| P4.0 | **shipped (code paths)** | Backend scaffold under `backend/features/project_document/formula/` (8 modules); `CustomFieldCapability` extended with `core_field_value_for_formula`, `core_field_type_for_formula`, `attach_computed_overlay`; Rooms contract wires all three. **Doc-only deltas deferred:** story-promotion edits in `context/user-stories/32-custom-fields.md` and the Phase 4 amendment to `adr-custom-fields-phase-2-errors.md` were not made — the 5 new error codes live in code (`_raise_formula_*` helpers in `schema_mutations.py`) but the ADR table is unedited. Frontend scaffolding directories also not created; those land alongside P4.7. |
| P4.1 | **shipped** | Recursive-descent parser implements the full plan-13 §4.4 grammar; D23 limits enforced at parse time; v1 function allow-list pinned at `concat, len, lower, number, replace, substring, text, trim, upper` plus grammar-level `if`. Arity table pins min/max args per function. No `formula_grammar_corpus.json` fixture seeded — parse-time semantics are covered by inline tests in the schema-mutation suite; corpus seeding deferred to P4.7 when the TS port needs byte-equal targets. |
| P4.2 | **shipped** | `evaluate(ast, row_accessor, fuse)` with `EvalSuccess` / `EvalError` discriminated union. `_fmod` helper used unconditionally (matches D22). Non-finite floats trapped as `type_mismatch` before they propagate. Null propagation, AirTable parity for string-function null coercion, 1-indexed inclusive-end `substring`, deterministic node-count fuse all implemented. `formula_evaluator_corpus.json` not seeded for the same reason as P4.1. |
| P4.3 | **shipped** | `resolve_refs`, `collect_field_refs`, `detect_cycles`, `build_field_registry`. `validate_document_references` now runs a Rooms-side formula cycle pass after the existing single-select / custom-value passes — missing refs are silently absorbed (D2), cycles raise `ValueError` so the document refuses to validate. Rooms contract publishes `ROOMS_CORE_FORMULA_TYPES` with a module-load assertion that every `ROOMS_CORE_FIELD_KEYS` key has an explicit entry. List-valued cores (`erv_unit_ids`) are coerced to comma-joined strings inside the formula accessor; richer collection support is a Phase 5 follow-up. |
| P4.4 | **shipped** | `evaluate_table_formulas` in `formula/evaluator.py` returns `{row_id: {cf_id: encoded_value}}`; topo-sorts formula deps; encodes evaluator errors per D25. `RoomsSliceResponse.rows_computed` carries the side-mapping; `extract_rooms_envelope` (downloads, MCP `get_table`, diff) attaches the overlay onto every row dict via `default_attach_computed_overlay`. Empty `computed: {}` invariant holds when no formula fields exist (the slice carries `rows_computed: {}` rather than per-row dicts in that case — slightly different from plan-17 P4.4's wording, see Lessons learned). |
| P4.5 | **shipped** | `_apply_set_formula` replaces the `_raise_unsupported_mutation("setFormula")` stub. `SetFormulaMutation.source: str` (not the original `config: dict[str, object]` placeholder); the backend parses, resolves, cycle-checks against every other formula field's stored AST, and writes `config = {"source", "ast", "deps", "result_type"}`. `_count_ast_nodes` and `_infer_result_type` helpers added — the result-type inference goes beyond the plan as written (the plan only mentioned `deps` and `ast_node_count` on the audit payload) but it lights up downstream `computed` filter / aggregation routing in `useTableSchema` for free. Audit kind `project_version_custom_field_set_formula` registered. Five new structured error codes emit through `api_error` with the user-facing copy from §"Review amendments". |
| P4.6 | **shipped** | MCP `set_custom_field_formula` tool registered behind the same `project:write` scope gate as the Phase 2 / 3 tools; delegates to `_apply_mcp_schema_mutation` so audit + recoverability handling is identical. `_SCHEMA_MUTATION_RECOVERABILITY` extended with the 5 `custom_field_formula_*` codes (all `fatal` per the ADR plan). **Security checkpoint paragraph appended:** deferred to the P4.7+ frontend drop so all Phase 4 MCP findings can be reviewed in one pass; preliminary check confirms no new code path bypasses the scope gate, no envelope leaks body/diff content beyond the documented `details` keys, and the parser/evaluator fuse caps prevent MCP-token DoS via pathological formulas. |
| P4.7 | **shipped** | Shared corpora seeded at `backend/tests/fixtures/formula_{grammar,evaluator}_corpus.json` (45 grammar cases + 80 evaluator cases). Python parity drivers in `tests/test_project_document_formula_{grammar,evaluator}.py` run both corpora directly (124 cases green). TypeScript port at `frontend/src/shared/ui/data-table/lib/formula/` (`tokens.ts` / `ast.ts` / `parser.ts` / `evaluator.ts` / `resolver.ts` / `limits.ts` / `errors.ts` / `index.ts`) mirrors the Python implementation; explicit `_fmod` helper rather than `%`, explicit `formatNumber` mirroring Python `_format_number`, code-point string comparison, AirTable-parity null coercion in string functions. TS parity drivers in `frontend/src/shared/ui/data-table/__tests__/formula{GrammarCorpus,EvaluatorCorpus,LimitsParity}.test.ts` import the corpora via new `@fixtures` Vite alias (also added to `tsconfig.json` `paths`); 129 cases green. `formulaLimitsParity.test.ts` reads `backend/.../formula/limits.py` as text and asserts every D23 constant matches its TS sibling — drift fails CI before behavior tests do. **Pragmatic deviations from the plan:** corpus uses an inline `source_spec` mini-DSL (`{kind: "repeat"\|"balanced_parens"\|"many_field_refs"}`) so resource-limit cases stay compact in JSON; both Python and TS drivers expand them identically. The substring case `substring("hello", 6, 9)` is in the corpus with `value: "o"` (matches the Python implementation's clamp-then-slice behavior, not the intuitive "past end → empty") — pinned the corpus to the implementation, not the other way around. |
| P4.8 | **not started** | `<FormulaEditorPopover>` + `<FormulaFieldPalette>` + `<ComputedCell>` body + focused-row live preview + display-name re-render from stored AST on open. |
| P4.9 | **not started** | `AddFieldPopover` formula pill enabled (atomic add-with-config); `HeaderContextMenu` Edit formula… item; unlock duplicate-of-formula; `buildSetFormulaMutation`; grid wiring in `EquipmentTab` (formula errors routed through the existing schema-mutation error band). |
| P4.10 | **partial** | 5 backend acceptance tests in `backend/tests/test_project_document_custom_fields_phase_4.py` exercise the REST round-trip end-to-end against an in-memory test client: formula adds + slice/download overlay parity, missing-ref rejection, self-cycle rejection, type-change-to-formula rejection, and stored-AST identity (deps stored by core `field_key`, not display name). Frontend acceptance tests, the Playwright e2e walkthrough, and the focused a11y notes file are part of the frontend drop. |

### What landed in code, file by file

```
backend/features/project_document/formula/
  __init__.py          ← public surface re-exports
  ast_nodes.py         ← Literal_/FieldRef/FuncCall/BinaryOp/UnaryOp/IfExpr + ast_to_json / ast_from_json
  errors.py            ← FormulaParseError, FormulaResourceLimitError, FormulaUnsupportedFunctionError, FormulaMissingRefError, FormulaCycleError
  evaluator.py         ← EvalFuse / EvalSuccess / EvalError; evaluate(); evaluate_table_formulas() read-overlay helper
  limits.py            ← D23 constants (SOURCE_LENGTH_MAX, AST_NODE_COUNT_MAX, AST_DEPTH_MAX, DEP_COUNT_MAX, OUTPUT_LENGTH_MAX, PER_ROW_FUSE_MAX)
  parser.py            ← tokenize() + recursive-descent _Parser + ALLOWED_FUNCTIONS allow-list + arity table
  resolver.py          ← build_field_registry / resolve_refs / collect_field_refs / detect_cycles / resolve_stored_ast
  tokens.py            ← TokenKind StrEnum + Token dataclass
backend/features/project_document/schema_mutations.py
  ← SetFormulaMutation typed payload (source: str); _apply_set_formula dispatch; 5 _raise_formula_* helpers
backend/features/project_document/tables/contracts.py
  ← CustomFieldCapability extended (3 new slots); default_attach_computed_overlay helper
backend/features/project_document/tables/rooms.py
  ← ROOMS_CORE_FORMULA_TYPES + module-load completeness assertion;
    _read_rooms_core_field_for_formula / _rooms_core_field_type_for_formula;
    RoomsSliceResponse.rows_computed; rooms_response wires evaluate_table_formulas;
    extract_rooms_envelope attaches computed overlay onto download rows
backend/features/project_document/document.py
  ← ProjectDocumentV1._validate_rooms_formula_cycles pass
backend/features/mcp/server.py
  ← set_custom_field_formula MCP @tool; _SCHEMA_MUTATION_RECOVERABILITY extended
backend/tests/test_project_document_schema_mutations.py
  ← old test_set_formula_raises_unsupported replaced with 6 setFormula behavior tests
backend/tests/test_project_document_custom_fields_phase_4.py  ← new file, 5 acceptance tests

# P4.7 — TS port + shared corpora
backend/tests/fixtures/
  formula_grammar_corpus.json       ← 45 cases (every grammar production, every D23 limit, every error class)
  formula_evaluator_corpus.json     ← 80 cases (numeric/null/bool/string semantics, AirTable-parity edge cases, every error code, _fmod sign rules, 1-indexed substring, code-point comparison)
backend/tests/test_project_document_formula_grammar.py    ← new file, Python corpus driver
backend/tests/test_project_document_formula_evaluator.py  ← new file, Python corpus driver
frontend/src/shared/ui/data-table/lib/formula/
  __init__.py-equivalent: index.ts  ← public surface
  tokens.ts                          ← TokenKind + Token interface
  ast.ts                             ← discriminated-union node interfaces + astToJson/astFromJson
  errors.ts                          ← FormulaParseError / FormulaResourceLimitError / FormulaUnsupportedFunctionError / FormulaMissingRefError / FormulaCycleError
  limits.ts                          ← D23 constants mirroring limits.py
  parser.ts                          ← tokenize() + recursive-descent Parser + ALLOWED_FUNCTIONS + arity table
  evaluator.ts                       ← evaluate() + EvalSuccess/EvalError + explicit _fmod / formatNumber / code-point compare / null-coerce helpers
  resolver.ts                        ← resolveRefs() + collectFieldRefs() for the in-editor live-preview path (no cycle detection — server-only)
frontend/src/shared/ui/data-table/__tests__/
  formulaGrammarCorpus.test.ts       ← imports @fixtures/formula_grammar_corpus.json; 45 cases green
  formulaEvaluatorCorpus.test.ts     ← imports @fixtures/formula_evaluator_corpus.json; 78 cases green (2 corpus entries dispatch to multiple TS asserts)
  formulaLimitsParity.test.ts        ← reads backend limits.py as text; asserts each TS constant matches its Python sibling
frontend/vite.config.ts              ← new `@fixtures` alias → `../backend/tests/fixtures`
frontend/tsconfig.json               ← new `@fixtures/*` path entry mirroring the Vite alias
```

## Lessons learned

### From the implementation pass — pragmatic deviations + landmines

1. **`ast.py` shadows `import ast` from the stdlib.** Named the AST
   node module `ast_nodes.py` instead. Inside that module,
   `dataclasses.Literal` would have shadowed `typing.Literal` used
   for `kind: Literal["literal"]` annotations; renamed the literal
   node class to `Literal_` (trailing underscore) with a `LiteralNode`
   re-export alias. **Action for P4.7:** the TS port can keep
   `ast.ts` and `Literal` as-is (TS doesn't have the same shadowing
   problems), but the corpus's `kind` discriminator values
   (`"literal"`, `"field_ref"`, `"func_call"`, `"binary_op"`,
   `"unary_op"`, `"if"`) **are** the wire contract and must match
   Python byte-for-byte.

2. **`SetFormulaMutation.source: str`, not `config: dict`.** The
   plan-15 placeholder shape was `config: dict[str, object]`. The
   real shape is `source: str` (the user-typed text) — the server
   re-parses every commit; storing client-supplied AST is a footgun
   we'd have to validate anyway. Existing tests in
   `test_project_document_schema_mutations.py::test_set_formula_raises_unsupported`
   broke and were replaced with real behavior tests. **No
   client-side AST submission in v1.**

3. **`apply_schema_mutation` runs a final `validate_document` pass
   on every mutation.** That means we get cycle detection "for free"
   via the validator's Phase 4 hook, but the resulting error is a
   generic `invalid_project_document` rather than the specific
   `custom_field_formula_cycle` envelope. Decision: explicit
   cycle-check inside `_apply_set_formula` *before* the validator
   pass, so the structured error envelope wins. The validator's
   cycle pass remains as defense-in-depth against hand-edited or
   migration-introduced cycles.

4. **Save endpoint expects version-etag, not draft-etag.** The
   first round-trip test failed with `version_etag_mismatch` even
   though I'd passed `draft_etag` in `If-Match`. `save_draft` in
   `drafts.py:239` compares `if_match` against `document_etag(version["body"])` — the saved snapshot's etag, **not** the
   draft etag. The slice response carries both; pass `version_etag`
   on save. (This is unrelated to Phase 4 but is the kind of
   gotcha that costs 10 minutes the first time you hit it; noting
   so the frontend drop doesn't repeat the mistake.)

5. **REST error envelopes are top-level, not under `detail`.** The
   API raises `api_error(...)` which serializes to
   `{"error_code", "message", "details", "request_id"}` at the
   response root — *not* nested under `detail` like FastAPI's
   default `HTTPException` would be. Tests should assert
   `response.json()["error_code"]`, not `response.json()["detail"]["error_code"]`.

6. **Empty `computed: {}` invariant — two shapes, one
   contract.** plan-17 P4.4 says "every row carries `computed: {}`
   when no formula fields exist". The download path **does** put
   `computed: {}` on every row dict (via
   `default_attach_computed_overlay`). The slice response carries
   `rows_computed: {}` (an empty dict, not per-row dicts) when no
   formula fields exist — the per-row map is built lazily by
   `evaluate_table_formulas`, which short-circuits to
   `{row_id: {}}` if no formula fields exist. **Both shapes are
   semantically "no computed values"; the SPA must treat
   `rows_computed[row.id] ?? {}` as the access pattern, not assume
   a per-row dict is always present.** Worth pinning in the P4.7
   docs.

7. **`result_type` inference shipped beyond the plan.** Added
   `_infer_result_type` to `_apply_set_formula` and store it on
   the field's `config` — used by the frontend `useTableSchema`'s
   `computed_type` slot for downstream filter / aggregation
   routing. Currently best-effort static (returns `"text"` for
   mixed-branch `if`); a future improvement could feed dependency
   types into the inference walk.

8. **Negative `substring` indices raise at evaluate time.** The
   plan-13 D24 wording said "rejected at parse time when literals,
   evaluate time when expressions". I picked the simpler
   evaluator-only path: indices are always validated at evaluate
   time. Reason: implementing parse-time literal checks would have
   required a static-eval pass over `substring`'s start/end args
   (which can themselves be expressions involving field refs), and
   the corpus parity contract is easier to hold when both Python
   and TS run the *same* evaluator check. Net behavior is
   identical from the user's perspective (a parse-time-or-evaluate-time
   error is still an error), but the parser stays simpler.

9. **`Pydantic v2 deprecation warning` pre-existing.** Every
   `api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, ...)` call
   surfaces a `DeprecationWarning`: starlette renamed the constant
   to `HTTP_422_UNPROCESSABLE_CONTENT`. Pre-existing across the
   codebase; not addressed in this drop. Tracking suggestion: one
   small follow-up that grep-renames the constant repo-wide once
   our starlette pin moves.

### What to bring forward into P4.7 (TS port)

- **The corpus files are the contract.** Seed
  `backend/tests/fixtures/formula_grammar_corpus.json` and
  `formula_evaluator_corpus.json` *first*, exercising every edge
  the Python tests already cover. Write the TS port against the
  corpus, not against the Python source.
- **Pin `_fmod` semantics in the TS port.** JS `%` is sign-of-dividend
  which *happens* to match Python's `math.fmod`, but writing an
  explicit `_fmod(a, b)` helper on both sides is the contract — the
  helper makes the parity intent visible, and isolates the codebase
  from a future engine drift.
- **String comparison: code-point ordering on both sides.** Python
  string `<` / `>` is already code-point; JS string `<` / `>` is
  also code-point for code units. The corpus must exercise non-ASCII
  inputs (review amendment #2). When the corpus diverges, the
  divergence will be in surrogate-pair handling — write the helper
  to iterate code points, not code units.
- **`text(n)` number formatting.** Python `repr(float)` matches V8
  `Number.prototype.toString` for the corpus subset we exercise.
  Edge cases to pin: `0`, `-0`, `1.5`, very small / very large
  values, integer-valued floats (no trailing `.0`). The Python
  helper is `_format_number`; mirror it on the TS side as
  `_formatNumber`.

## Resolved questions

All five open questions resolved in chat 2026-05-25 (see decisions
D22–D26 in plan-13 §3). P4.0's closing tasks (recording the
decisions in plan-13 and updating the ADR copy templates) are
done; P4.1 can start.

- ~~**D22. Numeric semantics.**~~ **Resolved:** AirTable parity,
  ease-of-use prioritized over power. Binary64 only; no separate
  integer type. `/` always returns float. Division by zero →
  `{"error": "div_by_zero"}` (never `Infinity`/`NaN`). Non-finite
  overflow → `{"error": "type_mismatch"}`. Modulo via explicit
  `_fmod` helper on both sides (sign follows dividend). Explicit
  `round()` deferred.

- ~~**D23. Hard resource limits.**~~ **Resolved:** strawman
  defaults accepted —
  `source_length=1024`, `ast_node_count=256`, `ast_depth=24`,
  `dep_count=16`, `output_length=8000`,
  `per_row_budget=1024 nodes-evaluated` (deterministic
  node-count fuse, not wall-clock). Loosen during Phase 5 only
  if real usage hits a limit.

- ~~**D24. `substring` indexing.**~~ **Resolved:** AirTable
  parity. 1-indexed, inclusive end. `substring("hello", 1, 3)
  == "hel"`. Out-of-range clamps to `[1, len(s)]`. Negative
  indices rejected at parse time (literals) or evaluate time
  (expressions).

- ~~**D25. Structured error values.**~~ **Resolved:**
  `{"error": "<token>"}` per cell in the read overlay; tokens
  are `div_by_zero` / `type_mismatch` / `missing_ref` /
  `fuse_tripped` / `output_too_long`. Grid maps to existing
  `computed` error state with tooltip.

- ~~**D26. Null coercion in string functions.**~~ **Resolved:**
  AirTable parity. String functions coerce `null → ""`.
  `number(null) == null` and `text(null) == null` preserve the
  error tier on explicit casts. Arithmetic on `null` propagates
  to `null`. `null = null` is true; `null = 0` is false. Boolean
  `and` / `or` short-circuit `null` like `false`.

If a question surfaces *during* implementation that wasn't
anticipated in P4.0 (most likely candidates: (a) whether
`text(number)` should produce `"42"` or `"42.0"` for
integer-valued floats in a corner case the corpus didn't pin;
(b) whether the read overlay should carry a `_meta` block
with formula parse / cycle warnings so the SPA can surface
them out of band), raise it in chat and amend this plan in
place before continuing — do not silently make the call
inside a sub-phase PR (same discipline as plans 14, 15, 16).
