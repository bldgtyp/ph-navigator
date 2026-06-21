---
DATE: 2026-06-20
TIME: 07:50 EDT
STATUS: In review
AUTHOR: Ed (via Codex)
SCOPE: Research notes and docs-only planning for DataTable formula builder.
RELATED:
  - planning/archive/data-table-formula-builder/README.md
  - planning/archive/data-table-formula-builder/PRD.md
  - planning/archive/data-table-formula-builder/PLAN.md
  - planning/archive/data-table-formula-builder/STATUS.md
---

# Phase 00 - Research And Planning

## Research Performed

- Read repo and planning instructions:
  - `CLAUDE.md`
  - `planning/.instructions.md`
  - `planning/features/.instructions.md`
- Queried the existing graphify graph; it was too sparse for this specific
  formula-editor question, so current source inspection is the basis for this
  packet.
- Inspected shared DataTable formula editor code:
  - `frontend/src/shared/ui/data-table/DataTable.tsx`
  - `frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx`
  - `frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx`
  - `frontend/src/shared/ui/data-table/components/FieldConfigSectionFormula.tsx`
  - `frontend/src/shared/ui/data-table/components/FormulaFieldPalette.tsx`
- Inspected formula grammar/evaluator parity surfaces:
  - `frontend/src/shared/ui/data-table/lib/formula/*`
  - `backend/features/project_document/formula/*`
  - `backend/features/project_document/mutations/formula_ops.py`
  - `backend/tests/fixtures/formula_grammar_corpus.json`
  - `backend/tests/fixtures/formula_evaluator_corpus.json`
- Inspected table-wide rollout seams:
  - `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`
  - `frontend/src/shared/ui/data-table/feature/customFieldColumns.tsx`
  - `frontend/tests/e2e/table-regression/tableMatrix.ts`
  - `backend/features/project_document/tables/registry.py`
  - `backend/features/project_document/tables/contracts.py`

## Findings

### Shared Rollout

The formula editor is already parent-level DataTable infrastructure.
`DataTable.tsx` builds a default formula registry from `fieldDefs` and a
default preview value map from the active row/columns. Rooms overrides this
because its core/custom row shape needs special value reads, but it still
uses the same shared modal/editor components.

This means the work should not require table-local components. If a table
fails autocomplete or preview after shared changes, the likely fix is a
missing registry/value mapping, not local formula UI.

### UI Styling Gap

`FieldConfigSectionFormula.tsx` emits formula-specific classes, but
`DataTable.css` currently has no matching rules for:

- `data-table-formula-editor`
- `data-table-formula-editor-source`
- `data-table-formula-editor-preview`
- `formula-field-palette`

The current plain/unstyled appearance is therefore expected from the CSS.

### Parser Gap

The formula grammar supports:

- field refs like `{Name}`;
- string literals;
- numeric literals;
- arithmetic `+ - * / %`;
- comparisons;
- boolean operators;
- `if(...)`;
- functions including `concat`, `upper`, `lower`, `trim`, `text`, and
  `number`.

It does not support `&`. The tokenizer treats unknown characters as parse
errors, so `&` must be added to both frontend and backend tokenizers,
parsers, AST types, evaluators, source serializer, and parity corpuses.

### Error Gap

Local errors already classify parse/missing-ref/resource/unsupported-function
states, but the displayed copy is terse and the preview panel has no dedicated
card styling. The user-facing symptom in the screenshot is explained by the
preview label and body rendering as adjacent inline content.

## Recommended First Implementation Sequence

1. Style/refactor the shared editor and message card without changing grammar.
2. Add local error copy improvements.
3. Add `&` grammar/evaluator parity.
4. Add autocomplete.
5. Add all-table regression coverage.

This sequence keeps UI risk, grammar parity risk, and browser-matrix risk
separable.
