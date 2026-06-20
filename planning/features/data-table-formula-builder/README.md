---
DATE: 2026-06-20
TIME: 07:50 EDT
STATUS: Active
AUTHOR: Ed (via Codex)
SCOPE: Shared DataTable formula editor usability and Airtable-parity planning.
RELATED:
  - planning/features/data-table-formula-builder/PRD.md
  - planning/features/data-table-formula-builder/PLAN.md
  - planning/features/data-table-formula-builder/STATUS.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/data-model.md
---

# DataTable Formula Builder - Feature Folder

## Scope

Make PH-Navigator's shared DataTable formula authoring experience more
discoverable, forgiving, and Airtable-like across every field-config-capable
DataTable.

The work covers:

- syntax highlighting in the formula expression editor;
- a larger, resizable formula input panel;
- clear alert-card treatment for formula preview/errors;
- support for the common `&` string-concatenation operator;
- field/function autocomplete while typing.

This is shared DataTable infrastructure. Feature tables may keep supplying
table-specific formula registries or preview value readers when their row
shape requires it, but no table should build its own formula editor UI,
styling, parser, autocomplete, or error presentation.

## Read Order

1. `STATUS.md` - current state, next step, blockers, open decisions.
2. `PRD.md` - product behavior and acceptance criteria.
3. `PLAN.md` - architecture findings and phase sequence.
4. `phases/phase-00-research-plan.md` - docs-only research record.
5. `phases/phase-01-shared-editor-ui.md` through
   `phases/phase-06-docs-closeout.md` - handoff-grade phase plans.

## Phase Map

| Phase | Scope | File |
|---|---|---|
| 00 | Research and planning | `phases/phase-00-research-plan.md` |
| 01 | Shared editor UI, syntax highlighting, sizing, resize | `phases/phase-01-shared-editor-ui.md` |
| 02 | Preview/error card and clearer error copy | `phases/phase-02-message-card-errors.md` |
| 03 | Frontend/backend `&` concat grammar parity | `phases/phase-03-ampersand-concat.md` |
| 04 | Field/function autocomplete | `phases/phase-04-autocomplete.md` |
| 05 | All-table regression coverage and persisted formula smoke | `phases/phase-05-regression-coverage.md` |
| 06 | Durable docs, closeout gates, graph update | `phases/phase-06-docs-closeout.md` |

## Current Architecture Summary

Formula authoring already lives in shared DataTable components:

- `frontend/src/shared/ui/data-table/DataTable.tsx` builds the default
  formula registry and preview row, then passes them into the shared create
  and edit modals.
- `frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx`
  renders the edit-field modal.
- `frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx`
  renders the add-field modal.
- `frontend/src/shared/ui/data-table/components/FieldConfigSectionFormula.tsx`
  owns the formula expression input, suggestion state, local parse state,
  and preview panel.
- `frontend/src/shared/ui/data-table/components/FormulaSuggestionPanel.tsx`
  renders the field/function autocomplete list.
- `frontend/src/shared/ui/data-table/lib/formula/*` is the TypeScript
  parser/resolver/evaluator used by local preview.
- `backend/features/project_document/formula/*` is the authoritative Python
  parser/resolver/evaluator used by schema mutations and computed overlays.
- `backend/tests/fixtures/formula_grammar_corpus.json` and
  `backend/tests/fixtures/formula_evaluator_corpus.json` pin frontend /
  backend parity.

## Boundaries

- Do not fork the formula editor per feature table.
- Do not add a frontend-only grammar feature; backend save and read overlays
  must accept and evaluate the same syntax.
- Do not replace backend formula validation authority. The browser may provide
  faster local feedback, but backend mutation errors remain authoritative.
- Do not broaden this phase into unrelated formula functions, linked rollup
  authoring, comments, or full spreadsheet formula parity.
- Do not move the DataTable browser matrix into default CI as part of this
  feature; use focused tags and existing run policy.
