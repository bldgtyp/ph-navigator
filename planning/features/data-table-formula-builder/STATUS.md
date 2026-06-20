---
DATE: 2026-06-20
TIME: 08:52 EDT
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

`Phase 02 - message card and error copy complete; Phase 03 is next`.

The current codebase already routes formula authoring through shared
DataTable components:

- `DataTable.tsx` supplies registry and preview context.
- `FieldConfigModal.tsx` and `CreateFieldConfigModal.tsx` both render
  `FieldConfigSectionFormula`.
- `FieldConfigSectionFormula.tsx` owns local parse, preview, palette
  insertion, and source state.
- Frontend and backend formula grammars are parity-tested through shared
  corpus fixtures.

Main confirmed gaps after Phase 02:

- `&` is not part of the tokenizer/parser/evaluator;
- current field insertion is a static chip palette, not autocomplete.

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

## Next Step

Start Phase 03 with `&` concat tokenizer/parser/evaluator support and keep
autocomplete deferred to Phase 04.

## Phase Status

| Phase | State | Pointer |
|---|---|---|
| 00 - Research and planning | Complete | `phases/phase-00-research-plan.md` |
| 01 - Shared formula editor UI | Complete | `phases/phase-01-shared-editor-ui.md` |
| 02 - Message card and error copy | Complete | `phases/phase-02-message-card-errors.md` |
| 03 - `&` concat grammar | Planned | `phases/phase-03-ampersand-concat.md` |
| 04 - Autocomplete | Planned | `phases/phase-04-autocomplete.md` |
| 05 - All-table regression coverage | Planned | `phases/phase-05-regression-coverage.md` |
| 06 - Documentation and closeout | Planned | `phases/phase-06-docs-closeout.md` |

## Blockers

None.

## Open Decisions

- Confirm `&` precedence and coercion against Airtable before implementation.
- Confirm whether autocomplete should open on bare partial tokens as well as
  brace-prefixed field refs.
- Confirm final modal max-width/resizing constraints after a quick browser
  pass on desktop and narrow viewport.

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
