---
DATE: 2026-06-20
TIME: 07:50 EDT
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

`Phase 00 - research and planning drafted; detailed phase handoff files
added for Phases 01-06`.

The current codebase already routes formula authoring through shared
DataTable components:

- `DataTable.tsx` supplies registry and preview context.
- `FieldConfigModal.tsx` and `CreateFieldConfigModal.tsx` both render
  `FieldConfigSectionFormula`.
- `FieldConfigSectionFormula.tsx` owns local parse, preview, palette
  insertion, and source state.
- Frontend and backend formula grammars are parity-tested through shared
  corpus fixtures.

Main confirmed gaps:

- formula-specific CSS classes are emitted but not styled;
- expression input is too small and only becomes textarea after a threshold;
- preview/error text is not carded and can visually run together;
- `&` is not part of the tokenizer/parser/evaluator;
- current field insertion is a static chip palette, not autocomplete.

## Next Step

Review the phase handoff files. If accepted, start Phase 01 with shared formula
editor UI extraction/styling and keep grammar changes for Phase 03 so UI and
parser risk stay separable.

## Phase Status

| Phase | State | Pointer |
|---|---|---|
| 00 - Research and planning | In review | `phases/phase-00-research-plan.md` |
| 01 - Shared formula editor UI | Planned | `phases/phase-01-shared-editor-ui.md` |
| 02 - Message card and error copy | Planned | `phases/phase-02-message-card-errors.md` |
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

Docs-only planning pass. No code tests run yet.

- `git diff --check` passed after the initial packet.
- `git diff --check` passed after adding detailed phase handoff files.
- New formula-builder files passed explicit untracked-file whitespace checks
  with `git diff --no-index --check /dev/null <file>`.
- New formula-builder files are ASCII-only.
