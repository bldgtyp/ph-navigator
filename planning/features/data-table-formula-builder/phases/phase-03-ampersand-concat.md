---
DATE: 2026-06-20
TIME: 08:05 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Add Airtable-style `&` text concatenation to frontend and backend formula engines.
RELATED:
  - planning/features/data-table-formula-builder/PRD.md
  - planning/features/data-table-formula-builder/PLAN.md
  - frontend/src/shared/ui/data-table/lib/formula/parser.ts
  - frontend/src/shared/ui/data-table/lib/formula/evaluator.ts
  - backend/features/project_document/formula/parser.py
  - backend/features/project_document/formula/evaluator.py
  - backend/tests/fixtures/formula_grammar_corpus.json
  - backend/tests/fixtures/formula_evaluator_corpus.json
---

# Phase 03 - Ampersand Concatenation

## Objective

Add `&` as a first-class text concatenation operator with frontend/backend
parity, so common Airtable-style formulas like
`{Number} & " - " & {Name}` can be authored, saved, and evaluated.

## Entry Conditions

- Phase 01 and Phase 02 are either complete or explicitly deferred.
- Current formula grammar/evaluator parity tests are green before edits.
- Decide and record `&` precedence before coding. Default:
  same precedence as `+` / `-`, left-associative.

## Implementation Files

Frontend:

- `frontend/src/shared/ui/data-table/lib/formula/tokens.ts`
- `frontend/src/shared/ui/data-table/lib/formula/ast.ts`
- `frontend/src/shared/ui/data-table/lib/formula/parser.ts`
- `frontend/src/shared/ui/data-table/lib/formula/evaluator.ts`
- `frontend/src/shared/ui/data-table/lib/formula/analysis` if a TS analysis
  helper exists; otherwise confirm no TS result-type inference is needed.
- `frontend/src/shared/ui/data-table/lib/formula/displayName.ts`
- `frontend/src/shared/ui/data-table/lib/formula/highlight.ts` if Phase 01
  created one.

Backend:

- `backend/features/project_document/formula/tokens.py`
- `backend/features/project_document/formula/ast_nodes.py`
- `backend/features/project_document/formula/parser.py`
- `backend/features/project_document/formula/evaluator.py`
- `backend/features/project_document/formula/analysis.py`
- `backend/features/project_document/formula/resolver.py` if AST walking needs
  exhaustiveness updates.
- `backend/features/project_document/mutations/formula_ops.py` only if error
  translation needs adjustment.

Tests/fixtures:

- `backend/tests/fixtures/formula_grammar_corpus.json`
- `backend/tests/fixtures/formula_evaluator_corpus.json`
- `backend/tests/test_project_document_formula_grammar.py`
- `backend/tests/test_project_document_formula_evaluator.py`
- `backend/tests/test_project_document_schema_mutations.py`
- `frontend/src/shared/ui/data-table/__tests__/formulaGrammarCorpus.test.ts`
- `frontend/src/shared/ui/data-table/__tests__/formulaEvaluatorCorpus.test.ts`

## Design Contract

- `&` is stored in the same AST `binary_op` family as existing operators.
- Existing `concat(...)` remains supported.
- Existing `+` behavior remains numeric-only and still rejects string
  concatenation.
- Field dependencies collected from `&` operands behave like all other binary
  ops.
- Cycle detection and document-level formula graph validation continue to walk
  through `&` operands.
- Stored AST JSON round-trips through both languages.

## Work Plan

1. Add token support.
   - Add `AMPERSAND` to TS and Python token enums.
   - Tokenize single `&`.
   - Leave `&&` unsupported unless deliberately added later.

2. Add AST operator support.
   - Add `"&"` to TS `BinaryOp`.
   - Add `"&"` to Python `BinaryOperator`.
   - Update all AST JSON round-trip helpers as needed.
   - Re-run type checks early; exhaustiveness failures are useful here.

3. Parse `&`.
   - Decide precedence and implement in both parsers.
   - Default implementation can extend the existing additive parse loop:
     `add ::= mul (("+" | "-" | "&") mul)*`.
   - If Airtable precedence check contradicts this, record the decision in
     `STATUS.md` and implement the checked behavior.

4. Evaluate `&`.
   - Add a string-coercion helper specific to `&`.
   - Proposed coercion:
     - null / undefined -> empty string;
     - string -> itself;
     - finite number -> existing `text()` formatting behavior;
     - boolean -> `true` / `false`;
     - other values -> `type_mismatch`.
   - Enforce output length limit after concatenation.
   - Keep `+` numeric-only.

5. Update result-type inference.
   - In backend `analysis.py`, infer `text` for `&`.
   - Confirm any frontend computed type inference or display fallback remains
     correct.

6. Update source serialization/highlighting.
   - `rebuildSourceFromStoredAst` should emit `left & right`.
   - Highlighting should classify `&` as operator/plain, not error.

7. Add corpus cases.
   - Grammar:
     - `{Number} & " - " & {Name}`;
     - `"HP-" & 4.0`;
     - `1 + 2 & " kW"` if precedence decision needs pinning.
   - Evaluator:
     - text + text;
     - number + text;
     - null + text -> empty string behavior;
     - boolean + text;
     - output-too-long if easy to exercise.

8. Add schema mutation test.
   - Save a formula using `&`.
   - Assert config includes source, ast, deps, and `result_type: "text"`.
   - Assert computed overlay evaluates after reload if an existing backend test
     seam makes that cheap.

## Acceptance Criteria

- `{Number} & " - " & {Name}` parses in TS and Python.
- The formula can be saved through `setFormula`.
- Dependencies include both referenced fields.
- Computed overlay renders the expected text.
- Existing corpus cases stay green.
- `+` still rejects string concatenation.

## Verification

Backend:

```bash
cd backend && uv run pytest tests/test_project_document_formula_grammar.py tests/test_project_document_formula_evaluator.py tests/test_project_document_schema_mutations.py
```

Frontend:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/formulaGrammarCorpus.test.ts src/shared/ui/data-table/__tests__/formulaEvaluatorCorpus.test.ts
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx
```

Broader gate:

```bash
make frontend-dev-check
```

## Risks And Watchpoints

- Frontend-only success is a bug. Backend parser/evaluator must land in the
  same phase.
- Python formula AST includes linked/field-access nodes not mirrored in the TS
  preview parser. Do not remove or simplify backend nodes while touching binary
  operators.
- Existing stored ASTs do not need a migration; this adds a new operator only.
- Be careful with number formatting. Reuse the existing `text()` behavior where
  possible so `&` and `text(...)` do not diverge.

## Handoff Notes

This is the highest semantic-risk phase. Keep the diff tight, lean on corpus
tests, and do not bundle autocomplete or visual polish changes here.
