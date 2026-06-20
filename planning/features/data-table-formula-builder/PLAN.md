---
DATE: 2026-06-20
TIME: 07:50 EDT
STATUS: Active
AUTHOR: Ed (via Codex)
SCOPE: Phase plan for shared DataTable formula builder improvements.
RELATED:
  - planning/features/data-table-formula-builder/README.md
  - planning/features/data-table-formula-builder/PRD.md
  - planning/features/data-table-formula-builder/STATUS.md
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionFormula.tsx
  - frontend/src/shared/ui/data-table/lib/formula/parser.ts
  - backend/features/project_document/formula/parser.py
---

# DataTable Formula Builder - Plan

## Research Findings

Current shared seams are good enough for a parent-level rollout:

- `DataTable.tsx` builds `effectiveFormulaFieldRegistry` and
  `effectiveGetFormulaRowValues` for every table. Consumers can override row
  value mapping, but the modal UI is shared.
- `FieldConfigModal.tsx` and `CreateFieldConfigModal.tsx` both mount
  `FieldConfigSectionFormula`.
- `FieldConfigSectionFormula.tsx` owns expression source, local parse state,
  preview evaluation, and palette insertion.
- `FormulaFieldPalette.tsx` already inserts `{Display Name}` tokens, but it
  shows all chips all the time and has no caret-aware filtering.
- The TypeScript formula library mirrors the Python backend formula library.
  Any grammar change must update both implementations plus the shared grammar
  and evaluator corpuses.
- `DataTable.css` has general add/edit field styles but no matching styles
  for `formula-field-palette`, `data-table-formula-editor`, or
  `data-table-formula-editor-preview`. This explains the current unstyled
  preview/error presentation.

Current product gaps:

- The source field is an `<input>` until 80 chars, then a textarea at 4 rows,
  and only escalates to 8 rows after 240 chars.
- The preview panel renders a label and body in one flow, allowing label/body
  text to visually run together.
- Parser errors expose useful but terse technical messages, e.g.
  `unexpected token '{Number}' (position 27)`, without suggesting the likely
  missing operator.
- `&` is not tokenized today, so Airtable-style concat formulas fail at parse.
- String concatenation with `+` is deliberately rejected; `concat(...)` works.

## Architectural Rule

All authoring UI changes belong under:

```text
frontend/src/shared/ui/data-table/components/
frontend/src/shared/ui/data-table/lib/formula/
frontend/src/shared/ui/data-table/DataTable.css
```

All grammar/evaluation authority changes must be mirrored under:

```text
backend/features/project_document/formula/
backend/tests/fixtures/formula_grammar_corpus.json
backend/tests/fixtures/formula_evaluator_corpus.json
frontend/src/shared/ui/data-table/__tests__/
```

Feature table changes are allowed only when they expose missing registry/value
data to the shared editor. They must not add local editor components or local
formula CSS.

## Phase Plan

Detailed handoff plans live in `phases/phase-01-shared-editor-ui.md`
through `phases/phase-06-docs-closeout.md`. The sections below are the
high-level router; use the phase files for implementation.

### Phase 00 - Research And Planning

Status: complete when this docs-only packet is reviewed.

- Map the shared formula editor flow.
- Identify frontend/backend formula parity surfaces.
- Record no-per-table-editor rollout rule.
- Route this feature from `planning/STATUS.md`.

Verification:

```bash
git diff --check
```

### Phase 01 - Shared Formula Editor UI

Detailed handoff: `phases/phase-01-shared-editor-ui.md`.

Build the editor as a shared component extracted from
`FieldConfigSectionFormula`.

Implementation shape:

- Introduce a shared formula source editor subcomponent, likely
  `FormulaSourceEditor.tsx`, consumed only by `FieldConfigSectionFormula`.
- Prefer a textarea-backed overlay: the textarea remains the real input, and
  an aligned token layer provides highlighting. Use a tolerant tokenizer for
  draft highlighting so partial strings/field refs do not suppress the editor.
- Make formula source multiline by default.
- Add shared CSS in `DataTable.css` for:
  - editor shell;
  - highlighted field/text/number spans;
  - resizable source panel;
  - formula-active modal sizing;
  - palette/suggestion list baseline.
- Update tests around create/edit formula sections.

Verification:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx
make frontend-dev-check
```

### Phase 02 - Message Card And Error Copy

Detailed handoff: `phases/phase-02-message-card-errors.md`.

Make formula feedback visually and semantically explicit.

Implementation shape:

- Refactor `FormulaPreviewPanel` into structured title/body/detail rows.
- Render parse/eval/missing-ref/cycle/resource-limit states as bordered alert
  cards.
- Keep neutral preview/empty/focus-a-row states visually quieter.
- Add local formatter cases for common parse failures:
  - adjacent field refs / trailing field refs;
  - unterminated field ref;
  - unterminated string;
  - unsupported function;
  - missing field.
- Ensure backend schema-mutation errors still surface inline in the modal and
  use the same card treatment where possible.

Verification:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx
```

### Phase 03 - `&` Concatenation Grammar

Detailed handoff: `phases/phase-03-ampersand-concat.md`.

Add Airtable-style concat at the grammar/evaluator layer.

Implementation shape:

- Add `AMPERSAND` / `&` token to TS and Python tokenizers.
- Add binary AST op `"&"` to TS and Python AST types.
- Parse `&` at a defined precedence. Candidate: same precedence as `+` /
  `-`, left-associative, unless an Airtable check proves otherwise.
- Evaluate `&` by coercing scalar values to text:
  - null/undefined -> `""`;
  - string -> unchanged;
  - number -> finite numeric string;
  - boolean -> `true` / `false`;
  - unsupported values -> `type_mismatch`.
- Update `infer_result_type` / result-type analysis so `&` returns text.
- Update source rebuilding so stored ASTs emit `left & right`.
- Add grammar corpus cases and evaluator corpus cases.
- Add backend schema mutation tests for saved formulas using `&`.

Verification:

```bash
cd backend && uv run pytest tests/test_project_document_formula_grammar.py tests/test_project_document_formula_evaluator.py tests/test_project_document_schema_mutations.py
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/formulaGrammarCorpus.test.ts src/shared/ui/data-table/__tests__/formulaEvaluatorCorpus.test.ts
```

### Phase 04 - Autocomplete

Detailed handoff: `phases/phase-04-autocomplete.md`.

Replace the always-visible chip palette with a caret-aware insertion panel.

Implementation shape:

- Keep `FormulaFieldPalette` or replace it with a shared
  `FormulaSuggestionPanel`; either way, the behavior remains under shared
  DataTable components.
- Build a small tokenizer/caret helper that identifies the current partial
  token:
  - `{N` filters fields to `Name`, `Notes`, `Number`, etc.;
  - bare `N` can offer both fields and functions, inserting fields with
    braces and functions with `name(`.
- Include function suggestions from the shared allow-list.
- Preserve click-to-insert behavior and add keyboard navigation.
- Ensure the active suggestion list does not trap focus or break modal Escape.

Verification:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx
```

### Phase 05 - All-Table Regression Coverage

Detailed handoff: `phases/phase-05-regression-coverage.md`.

Prove the shared rollout reaches every DataTable.

Implementation shape:

- Add focused React tests for:
  - syntax highlight token classes;
  - error card rendering;
  - suggestion filtering and insertion;
  - `&` source accepted in create and edit modal flows.
- Add a DataTable e2e tag, likely `@table-formula`, that uses the existing
  table-regression matrix to open every field-config-capable table, create or
  edit a formula field where allowed, and assert the shared editor UI is
  present.
- Add at least one persisted end-to-end formula case that saves
  `{Number} & " - " & {Name}`, reloads the table, and verifies computed
  overlay display.
- Confirm no feature table imports formula editor CSS/components directly.

Verification:

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-formula
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke
```

### Phase 06 - Documentation And Closeout

Detailed handoff: `phases/phase-06-docs-closeout.md`.

- Fold accepted formula editor and `&` grammar behavior into
  `context/technical-requirements/data-table.md` and
  `context/technical-requirements/data-model.md`.
- Update the feature `STATUS.md` with actual verification evidence.
- Run the repo closeout sequence required by `CLAUDE.md`.

Verification:

```bash
make format
make ci
```

## Open Decisions

- Exact precedence for `&` relative to arithmetic and comparison. Default plan:
  same precedence as `+` / `-`, left-associative, unless Airtable behavior
  says otherwise.
- Exact number-to-text formatting for `&`. Default plan: reuse the existing
  formula `text()` formatting helper where possible.
- Whether bare `N` should suggest fields immediately or only after `{N`.
  Default plan: support both because the Airtable example surfaces suggestions
  under bare function/field typing.
- Whether autocomplete should include only fields in v1 or fields plus
  functions. Default plan: include both under the "Insert a field or function"
  affordance.
