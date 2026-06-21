---
DATE: 2026-06-20
TIME: 09:14 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Field/function autocomplete for the shared formula editor.
RELATED:
  - planning/archive/data-table-formula-builder/PRD.md
  - planning/archive/data-table-formula-builder/PLAN.md
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionFormula.tsx
  - frontend/src/shared/ui/data-table/components/FormulaSuggestionPanel.tsx
  - frontend/src/shared/ui/data-table/lib/formula/parser.ts
  - frontend/src/shared/ui/data-table/lib/formula/resolver.ts
---

# Phase 04 - Autocomplete

## Implementation Summary

Complete on 2026-06-20.

- Replaced the static `FormulaFieldPalette` chip surface with
  `FormulaSuggestionPanel`.
- Added `lib/formula/suggestions.ts` for caret context detection, matching,
  ranking, insertion text, and stable ARIA option ids.
- Wired suggestions into `FieldConfigSectionFormula` with mouse insertion,
  ArrowUp/ArrowDown selection, Enter/Tab insertion, and Escape dismissal.
- Added parent modal Escape coordination so Radix Dialog does not close before
  an open suggestion panel is dismissed.
- Suggestions use field registry entries, exclude the currently edited field,
  insert fields as `{Display Name}`, and insert functions as `name(`.
- Added focused helper, panel, create-modal, and edit-modal coverage.

## Objective

Replace or evolve the static field chip palette into an Airtable-like
"Insert a field or function" suggestion panel that filters as the user types
and inserts valid formula tokens at the caret.

## Entry Conditions

- Phase 01 editor exposes reliable caret/selection access.
- Phase 02 message card behavior is stable.
- Phase 03 `&` support is either complete or explicitly deferred; autocomplete
  should not depend on `&`, except that examples may include it after Phase 03.

## Implementation Files

Primary files:

- `frontend/src/shared/ui/data-table/components/FieldConfigSectionFormula.tsx`
- `frontend/src/shared/ui/data-table/components/FormulaSourceEditor.tsx`
- `frontend/src/shared/ui/data-table/DataTable.css`

Likely new files:

- `frontend/src/shared/ui/data-table/components/FormulaSuggestionPanel.tsx`
- `frontend/src/shared/ui/data-table/lib/formula/suggestions.ts`
- `frontend/src/shared/ui/data-table/__tests__/formulaSuggestions.test.ts`
- `frontend/src/shared/ui/data-table/__tests__/FormulaSuggestionPanel.test.tsx`

Removed files:

- `frontend/src/shared/ui/data-table/components/FormulaFieldPalette.tsx`

Read-only references:

- `frontend/src/shared/ui/data-table/lib/formula/parser.ts` for
  `ALLOWED_FUNCTIONS`.
- `frontend/src/shared/ui/data-table/lib/formula/resolver.ts` for
  `FieldRegistryEntry`.

## Design Contract

- Suggestions are shared formula editor behavior, not table-local UI.
- Field suggestions use the formula registry already passed into
  `FieldConfigSectionFormula`.
- The current field being edited must be excluded to avoid self-reference.
- Inserted field tokens use `{Display Name}`.
- Inserted functions use `name(`, or a richer snippet only if caret placement
  remains simple and reliable.
- The suggestion list must be keyboard accessible and must not break modal
  Escape handling.

## Work Plan

1. Build caret context helper.
   - Input: source string, selection start/end.
   - Output:
     - `mode`: `field | bare | none`;
     - `query`;
     - replacement range.
   - Cases:
     - `{N` -> field mode, query `N`, replacement starts at `{`.
     - `N` -> bare mode, query `N`, replacement is current word.
     - inside a quoted string -> no suggestions.
     - after closing `}` with no partial token -> no suggestions.

2. Build suggestion model.
   - Field suggestions:
     - label: display name;
     - detail: field type;
     - insert text: `{Display Name}`.
   - Function suggestions:
     - label: function name;
     - detail: `function`;
     - insert text: `function(`.
   - Sort:
     - prefix matches first;
     - then substring matches;
     - stable by display name/function name.
   - Limit visible suggestions to a small number, e.g. 8-10.

3. Render suggestion panel.
   - Title: `Insert a field or function`.
   - Use listbox/option semantics or equivalent accessible pattern.
   - Show field/function type on the right, matching the Airtable reference.
   - Use shared DataTable CSS.

4. Wire keyboard behavior.
   - Down/Up moves active option.
   - Enter/Tab inserts active suggestion when panel is open.
   - Escape closes the panel.
   - Typing continues normal text entry when no suggestion is active.
   - Mouse down should not steal focus before insertion.

5. Replace static palette behavior.
   - If keeping the old `FormulaFieldPalette`, make it the suggestion panel or
     a fallback when the editor is empty.
   - Avoid showing every field chip all the time once autocomplete is present.
   - Preserve existing click insertion behavior in tests via suggestion click.

6. Add tests.
   - `{N` filters to matching fields.
   - bare `N` offers matching fields/functions.
   - suggestion click inserts `{Name}` at the selected range.
   - Enter/Tab insertion works.
   - Escape closes suggestions and leaves source unchanged.
   - Current formula field is excluded.
   - Quoted strings do not show suggestions.

## Acceptance Criteria

- Typing `{N` shows matching fields like `Name`, `Notes`, `Number`.
- Typing bare `N` can show matching fields/functions.
- User can insert a suggestion by mouse or keyboard.
- Caret lands after the inserted token.
- Existing formula validation and preview update immediately after insertion.
- Autocomplete works in both Add field and Edit field modals.

## Verification

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/formulaSuggestions.test.ts
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/FormulaSuggestionPanel.test.tsx
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx
make frontend-dev-check
```

Phase completion evidence:

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

Browser check with local stack:

- open Rooms;
- open Add field -> Formula;
- type `{N`;
- verify `Name`, `Number`, and any matching fields appear;
- insert by keyboard and mouse;
- verify save gating reacts to inserted formula.

## Risks And Watchpoints

- Keyboard behavior can conflict with textarea Tab and modal focus trapping.
  Keep behavior scoped to an open suggestion list.
- Field display names may contain spaces or punctuation. Always insert braces.
- Duplicate display names should already be rejected by schema rules, but do
  not assume uniqueness beyond the provided registry.
- Do not expose linked-rollup helper functions in the UI unless they are
  actually supported by the frontend authoring parser.

## Handoff Notes

Phase 04 shipped with helper/component/modal tests. Add browser/all-table
coverage in Phase 05 rather than making this phase depend on all-table e2e.
