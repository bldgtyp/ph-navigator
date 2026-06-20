---
DATE: 2026-06-20
TIME: 08:42 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Shared formula source editor UI, syntax highlighting, sizing, and resize behavior.
RELATED:
  - planning/features/data-table-formula-builder/README.md
  - planning/features/data-table-formula-builder/PRD.md
  - planning/features/data-table-formula-builder/PLAN.md
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionFormula.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx
  - frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx
  - frontend/src/shared/ui/data-table/DataTable.css
---

# Phase 01 - Shared Editor UI

## Objective

Replace the current plain formula source input with a shared, larger,
resizable formula editor that provides basic syntax highlighting in both the
add-field and edit-field modals.

This phase should not change formula semantics. Existing valid/invalid
formulas must behave exactly as they do today.

## Entry Conditions

- Phase 00 packet is reviewed.
- No implementation from later phases is mixed into this phase.
- Existing formula tests are green before edits, or any pre-existing failures
  are recorded in `STATUS.md`.

## Implementation Files

Primary files:

- `frontend/src/shared/ui/data-table/components/FieldConfigSectionFormula.tsx`
- `frontend/src/shared/ui/data-table/DataTable.css`

Likely new files:

- `frontend/src/shared/ui/data-table/components/FormulaSourceEditor.tsx`
- `frontend/src/shared/ui/data-table/lib/formula/highlight.ts`
- `frontend/src/shared/ui/data-table/__tests__/FormulaSourceEditor.test.tsx`

Read-only orientation files:

- `frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx`
- `frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx`
- `frontend/src/shared/ui/data-table/lib/formula/parser.ts`
- `frontend/src/shared/ui/data-table/lib/formula/tokens.ts`

## Design Contract

- `FieldConfigSectionFormula` remains the only component mounted by create/edit
  field modals for formula source authoring.
- The editor must remain a real text control for accessibility and browser
  editing behavior. Preferred shape: transparent textarea over an aligned
  highlight layer, or a textarea with a mirrored underlay.
- The highlighting tokenizer must be tolerant. It should produce best-effort
  spans for incomplete drafts and never throw into React render.
- Do not use Monaco/CodeMirror unless this lightweight approach fails in a
  concrete way. If a dependency becomes necessary, stop and record the
  tradeoff in `STATUS.md` before adding it.
- Highlight colors:
  - field refs: purple;
  - string literals: green;
  - numeric literals: orange.
- All formula editor styles live in `DataTable.css` or shared DataTable CSS
  imports. No feature-local CSS.

## Work Plan

1. Add a tolerant highlighter.
   - Input: raw formula source.
   - Output: ordered spans `{ kind, text, start, end }`.
   - Minimum token kinds for this phase: `field`, `string`, `number`, `plain`.
   - Treat unterminated `{...` as a field-like span and unterminated `"..."` as
     a string-like span.
   - Preserve whitespace and newlines exactly in rendered highlight text.

2. Extract `FormulaSourceEditor`.
   - Props should include `id`, `value`, `maxLength`, `disabled`,
     `aria-invalid`, `aria-describedby`, `onChange`, `onKeyDown`, and a ref or
     imperative caret API needed by later autocomplete.
   - Always render as a multiline editor. Remove the input/textarea switch based
     on source length.
   - Default to a useful height, roughly Airtable-like: 5-6 rows.
   - Allow vertical resize from the lower-right corner; constrain max height so
     the modal stays usable inside `calc(100vh - 48px)`.

3. Wire `FieldConfigSectionFormula`.
   - Replace direct `<input>` / `<textarea>` rendering with
     `FormulaSourceEditor`.
   - Keep existing source state, validation state, preview calculation, and
     palette insertion behavior unchanged.
   - Keep `inputRef` or equivalent insertion support working for the existing
     field chip palette.

4. Update modal sizing.
   - Add a formula-active class only when a formula section is mounted, or use
     existing section classes if enough.
   - Allow a wider modal max-width for formula editing without affecting
     simpler field types.
   - Check narrow viewport behavior: no horizontal overflow; Save/Cancel remain
     reachable.

5. Add CSS.
   - Editor shell, underlay/overlay alignment, token colors, disabled state,
     focus state, resize affordance, scroll sync if needed.
   - Preserve current project typography and compact modal feel.
   - Do not introduce a one-note purple palette; purple is just the field token
     color.

6. Add tests.
   - Highlighter tokenizes field refs, strings, numbers, and partial drafts.
   - Create-field Formula still enables Save for a valid formula.
   - Edit-field Formula still dispatches `formulaSource` only when dirty.
   - Existing palette click still inserts at caret.

## Acceptance Criteria

- Both Add field and Edit field formula sections show the same shared editor.
- Formula source is multiline by default.
- Lower-right vertical resize is available.
- Fields, strings, and numbers receive distinct token classes/colors.
- Existing formula parse/preview/save behavior is unchanged.
- No feature table imports or renders a formula editor directly.

## Verification

Run focused tests first:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/FormulaSourceEditor.test.tsx
cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx
```

Then run the frontend gate:

```bash
make frontend-dev-check
```

Browser check if a local stack is already running:

```bash
curl -i http://localhost:8000/api/v1/auth/session
```

Then verify `http://localhost:5173` with `codex@example.com` / `password`:

- open Rooms;
- create or edit a Formula field;
- confirm highlighting, resizing, and no modal overflow on desktop;
- repeat at a narrow viewport if using Playwright.

## Risks And Watchpoints

- Overlay text and textarea text can drift if line height, padding, or
  horizontal scroll are mismatched. Keep styles locked together.
- Text selection/caret must remain native; do not make the highlight layer
  interactive.
- The current input-to-textarea threshold has behavior tied to Enter handling.
  Re-check Enter/Shift+Enter behavior after switching to multiline always.
- Existing tests may query `HTMLInputElement` for Expression. Update tests to
  accept `HTMLTextAreaElement` where appropriate.

## Handoff Notes

Keep this phase small. If autocomplete or `&` changes become tempting, defer
them to Phases 03 and 04. The desired result is a better shared editor shell
with unchanged formula language.

## Implementation Notes

- Implemented the shared formula source editor as
  `frontend/src/shared/ui/data-table/components/FormulaSourceEditor.tsx`.
- Added a tolerant highlighter at
  `frontend/src/shared/ui/data-table/lib/formula/highlight.ts`.
- Kept formula semantics unchanged; parser/evaluator work remains Phase 03.
- Preserved the existing field palette insertion behavior and added textarea
  caret regression coverage.
- Browser smoke against the already-running `5173` server was inconclusive
  because that server rendered stale pre-Phase-01 code from another checkout.
