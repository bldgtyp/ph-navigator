---
DATE: 2026-06-20
TIME: 09:45 EDT
STATUS: Active
AUTHOR: Ed (via Codex)
SCOPE: Current state of DataTable formula builder planning.
RELATED:
  - planning/features/data-table-formula-builder/README.md
  - planning/features/data-table-formula-builder/PRD.md
  - planning/features/data-table-formula-builder/PLAN.md
  - planning/features/data-table-formula-builder/phases/phase-00-research-plan.md
---

# DataTable Formula Builder - Status

## Current State

`Implementation complete through Phase 06; feature packet is ready for review`.

The current codebase already routes formula authoring through shared
DataTable components:

- `DataTable.tsx` supplies registry and preview context.
- `FieldConfigModal.tsx` and `CreateFieldConfigModal.tsx` both render
  `FieldConfigSectionFormula`.
- `FieldConfigSectionFormula.tsx` owns local parse, preview, palette
  insertion, and source state.
- Frontend and backend formula grammars are parity-tested through shared
  corpus fixtures.

Main confirmed gaps after Phase 06:

- archive / PR handoff remains a workflow decision outside the implementation
  phases.

Phase 01 added:

- `FormulaSourceEditor`, a shared textarea-backed source editor used by the
  existing create/edit formula section.
- tolerant syntax highlighting spans for field refs, string literals, numeric
  literals, and partial drafts.
- formula-only modal widening, multiline default sizing, vertical resize, and
  CSS for the existing field palette and preview block.
- regression coverage for highlighter output, editor rendering, create/edit
  modal behavior, and palette insertion at the textarea caret.

Phase 02 added:

- structured formula preview cards with separate title/body/detail elements;
- `role="alert"` for dirty blocking local formula errors and `role="status"`
  for normal preview states;
- actionable local message copy for parse errors, missing refs, unsupported
  functions, resource limits, and self-reference cycles;
- support for surfacing available function names from local unsupported-function
  parse state;
- regression coverage for parse, missing-ref, unsupported-function, preview,
  and save-gating behavior.

Phase 03 added:

- `&` token/parser support in the shared frontend and backend formula grammar;
- `"&"` as a binary AST operator with the same precedence as `+` / `-`,
  left-associative;
- text-concat evaluation in frontend preview, backend row evaluation, and
  backend document overlay evaluation;
- backend `result_type: "text"` inference for `&` formulas;
- shared grammar/evaluator corpus cases for field, number, boolean, null, and
  precedence behavior;
- schema mutation coverage proving `setFormula` saves a formula using `&`.

Phase 04 added:

- caret-context and suggestion helpers for brace-prefixed field refs, bare
  partial tokens, quoted-string suppression, and closed-field suppression;
- `FormulaSuggestionPanel`, replacing the static formula field chip palette
  with an accessible listbox/option panel;
- field suggestions from the formula registry, excluding the field currently
  being edited to avoid self-reference;
- function suggestions from the supported frontend authoring parser;
- mouse, ArrowUp/ArrowDown, Enter, Tab, and Escape behavior, including Radix
  dialog Escape interception so Escape closes suggestions before the modal;
- create/edit modal regression coverage for insertion, current-field
  exclusion, and Escape behavior.

Phase 05 added:

- shared modal regression updates proving add/edit formula flows dispatch
  `&` sources and dependency lists;
- `frontend/tests/e2e/table-regression/table-formula.spec.ts`, tagged
  `@table-formula @table-regression`, covering the shared formula editor and
  suggestion panel across all 14 table-regression matrix surfaces;
- a Rooms persisted formula smoke using `"Room - " & {Name}` that verifies the
  computed overlay after route reload;
- `test:e2e:tables:formula` in `frontend/package.json` for the focused
  browser suite;
- a shared-import/CSS guard confirming formula editor UI remains in
  `frontend/src/shared/ui/data-table`.

Phase 06 added:

- durable DataTable UI and regression run-policy notes in
  `context/technical-requirements/data-table.md`;
- formula grammar/evaluator semantics for `&` in
  `context/technical-requirements/data-model.md`;
- user-facing field-config modal formula behavior in `context/UI_UX.md`;
- resolved implementation decisions in `PLAN.md`.

## Next Step

Review the completed feature packet and decide whether to archive the planning
folder or open a PR from the current commits.

## Phase Status

| Phase | State | Pointer |
|---|---|---|
| 00 - Research and planning | Complete | `phases/phase-00-research-plan.md` |
| 01 - Shared formula editor UI | Complete | `phases/phase-01-shared-editor-ui.md` |
| 02 - Message card and error copy | Complete | `phases/phase-02-message-card-errors.md` |
| 03 - `&` concat grammar | Complete | `phases/phase-03-ampersand-concat.md` |
| 04 - Autocomplete | Complete | `phases/phase-04-autocomplete.md` |
| 05 - All-table regression coverage | Complete | `phases/phase-05-regression-coverage.md` |
| 06 - Documentation and closeout | Complete | `phases/phase-06-docs-closeout.md` |

## Blockers

None.

## Open Decisions

None.

## Verification

Phase 00 docs-only planning pass:

- `git diff --check` passed after the initial packet.
- `git diff --check` passed after adding detailed phase handoff files.
- New formula-builder files passed explicit untracked-file whitespace checks
  with `git diff --no-index --check /dev/null <file>`.
- New formula-builder files are ASCII-only.

Phase 01 implementation checks:

- Pre-edit baseline passed:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx`
  (56 tests).
- Focused post-edit tests passed:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/FormulaSourceEditor.test.tsx src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx`
  (61 tests).
- `make frontend-dev-check` passed. Existing lint output still reports 13
  Fast Refresh warnings in unrelated files; no errors.
- `make format` passed with no file changes.
- `make ci` passed:
  - backend: Ruff format/lint, Ty, Alembic, pytest
    (`903 passed, 2 skipped`);
  - frontend: frozen pnpm install, Prettier, ESLint, structural guards,
    Vitest (`182 files`, `1742 tests`), production build.
- Live browser smoke against `http://localhost:5173` was not accepted because
  the existing server rendered stale pre-Phase-01 code. A temporary worktree
  server on `5174` was stopped; backend origin/CORS guards made that route an
  unreliable verification harness.

Phase 02 implementation checks:

- Focused modal tests passed:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx`
  (58 tests).
- `make format` passed.
- `make frontend-dev-check` passed. Existing lint output still reports 13
  Fast Refresh warnings in unrelated files; no errors.
- `make ci` passed:
  - backend: Ruff format/lint, Ty, Alembic, pytest
    (`903 passed, 2 skipped`);
  - frontend: frozen pnpm install, Prettier, ESLint, structural guards,
    Vitest (`182 files`, `1743 tests`), production build.

Phase 03 implementation checks:

- Pre-edit focused baseline passed:
  `cd backend && uv run pytest tests/test_project_document_formula_grammar.py tests/test_project_document_formula_evaluator.py tests/test_project_document_schema_mutations.py`
  (`189 passed`) and
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/formulaGrammarCorpus.test.ts src/shared/ui/data-table/__tests__/formulaEvaluatorCorpus.test.ts src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx`
  (`181 passed`).
- Focused post-edit tests passed:
  backend formula/schema tests (`198 passed`) and frontend formula/modal tests
  (`189 passed`).
- `make format` passed.
- `make frontend-dev-check` passed. Existing lint output still reports 13
  Fast Refresh warnings in unrelated files; no errors.
- `make ci` passed:
  - backend: Ruff format/lint, Ty, Alembic, pytest
    (`912 passed, 2 skipped`);
  - frontend: frozen pnpm install, Prettier, ESLint, structural guards,
    Vitest (`182 files`, `1751 tests`), production build.

Phase 04 implementation checks:

- Focused autocomplete/modal tests passed:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/formulaSuggestions.test.ts src/shared/ui/data-table/__tests__/FormulaSuggestionPanel.test.tsx src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx`
  (`67 passed`).
- `make format` passed.
- `make frontend-dev-check` passed. Existing lint output still reports 13
  Fast Refresh warnings in unrelated files; no errors.
- `make ci` passed:
  - backend: Ruff format/lint, Ty, Alembic, pytest
    (`912 passed, 2 skipped`);
  - frontend: frozen pnpm install, Prettier, ESLint, structural guards,
    Vitest (`184 files`, `1760 tests`), production build.

Phase 05 implementation checks:

- Shared DataTable tests passed:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table`
  (`79` files, `980` tests). Existing React `act(...)` warnings remain in
  older DataTable/number-units tests.
- Formula e2e passed after replacing stale local servers with current-worktree
  servers on `5173` and `8000`:
  `cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-formula`
  (`15 passed`).
- Existing table smoke passed:
  `cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke`
  (`14 passed`).
- Shared-import guard passed:
  `rg -n "FormulaSourceEditor|FormulaSuggestionPanel|formula-field-palette|data-table-formula-editor" frontend/src/features frontend/src/shared/ui/data-table`
  returned only shared `frontend/src/shared/ui/data-table` component, CSS, and
  test hits; no `frontend/src/features` direct formula-editor hits and no
  `formula-field-palette` hits.
- `make format` passed with no file changes.
- `make frontend-dev-check` passed. Existing lint output still reports 13
  Fast Refresh warnings in unrelated/shared files; no errors.
- `make ci` passed:
  - backend: Ruff format/lint, Ty, Alembic, pytest
    (`912 passed, 2 skipped`, one existing deprecation warning);
  - frontend: frozen pnpm install, Prettier, ESLint, structural guards,
    Vitest (`184 files`, `1760 tests`), production build.

Phase 06 closeout checks:

- `make format` passed with no file changes after durable docs updates.
- `make ci` passed after durable docs updates:
  - backend: Ruff format/lint, Ty, Alembic, pytest
    (`912 passed, 2 skipped`, one existing deprecation warning);
  - frontend: frozen pnpm install, Prettier, ESLint, structural guards,
    Vitest (`184 files`, `1760 tests`), production build.
- `graphify update .` passed after closeout.
- `git diff --check` passed.
