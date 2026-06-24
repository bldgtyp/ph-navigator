---
DATE: 2026-06-20
TIME: 07:50 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Product contract for shared DataTable formula builder improvements.
RELATED:
  - planning/archive/data-table-formula-builder/README.md
  - planning/archive/data-table-formula-builder/PLAN.md
  - context/technical-requirements/data-table.md
  - context/UI_UX.md
---

# DataTable Formula Builder - PRD

## Problem

The current formula editor is technically functional but not discoverable.
The expression input is plain black text, starts as a cramped single-line
input, only expands after a source-length threshold, and shows parse/preview
messages as inline text that visually merges with the rest of the modal.

For common authoring cases, especially Display Name formulas and text labels,
users should be able to discover fields/functions, see formula structure while
typing, and understand errors without reading raw parser internals.

## Goal

Reach Airtable-style parity for the common formula-building loop:

1. User opens Add/Edit field and chooses Formula.
2. The expression editor is large enough to compose a real formula.
3. Field refs, string literals, and numeric literals are visually distinct.
4. Field/function suggestions appear while typing.
5. `&` concatenates values into text.
6. Parse and evaluation errors are clear, prominent, and actionable.
7. Save behavior stays consistent across every DataTable.

## User Stories

- As a project editor, I can type `{Number} & " - " & {Name}` and see fields,
  strings, and numbers highlighted as I type.
- As a project editor, I can type `N` or `{N` and get suggestions for fields
  like `Name`, `Notes`, and `Number`.
- As a project editor, I can select a suggested field and have the formula
  insert a valid `{Display Name}` reference at the caret.
- As a project editor, I can resize the formula editor when the expression is
  longer than the default panel.
- As a project editor, I can immediately see whether the formula parses and
  what the currently focused row would preview as.
- As a project editor, I see formula errors in a bordered alert card with a
  short message, location/detail where useful, and no run-together text.
- As a maintainer, I can add or fix the formula editor once in the shared
  DataTable layer and have every DataTable receive the same behavior.

## Functional Requirements

### Syntax Highlighting

- Highlight formula field references as purple.
- Highlight text/string literals as green.
- Highlight numeric literals as orange.
- Keep highlighting robust for partial drafts; an unfinished string or field
  ref should not break the editor.
- Preserve accessible plain-text editing semantics: normal typing, selection,
  copy/paste, keyboard navigation, screen-reader label, and form submission.
- Highlighting must be shared by create-field and edit-field modals.

### Editor Size And Resize

- Formula source should use a larger multiline editor by default, not wait
  until the source reaches 80 characters.
- The editor should support lower-right resizing for longer formulas while
  keeping the modal usable inside the viewport.
- The modal width should be reviewed for formula authoring; the formula editor
  may use a wider max-width when the formula section is active.

### Error And Preview Card

- Formula messages should render as a dedicated card, not as loose text.
- Error states should use `role="alert"` or an equivalent assertive pattern
  when they block save; neutral preview states can remain polite.
- The preview label and body must be separate elements so strings like
  `Preview based on row at modal openCouldn't parse...` cannot occur.
- Error copy should explain what to fix. Examples:
  - unexpected adjacent field refs: "Add an operator like `&`, `+`, `-`, or a
    comma between these values."
  - missing field: "No field named `Foo` exists in this table."
  - unsupported function: "Function `foo` is not supported. Try: concat, upper,
    lower, trim, text, number."
  - unknown character: "`&` is supported after this feature lands; any other
    unknown operator should name the character and position."

### `&` Concatenation

- `&` should be a first-class formula binary operator for text concatenation.
- It must parse, serialize, resolve dependencies, evaluate locally, evaluate
  on backend read overlays, and round-trip through stored AST JSON.
- It should support common Airtable-like coercion for scalar values:
  - text stays text;
  - number becomes its display string;
  - boolean becomes `true` / `false`;
  - null/blank becomes an empty string.
- Acceptance examples:
  - `{Number} & " - " & {Name}`
  - `{Notes} & " / " & {Name}`
  - `"HP-" & 4.0`
- The old `concat(...)` function remains supported.

### Autocomplete

- Suggestions should appear below the editor with an "Insert a field or
  function" affordance.
- Field suggestions should filter against the current token/caret text and
  include all referenceable fields except the formula field being edited.
- Function suggestions should include supported functions from the shared
  allow-list.
- Keyboard support:
  - Up/Down moves through suggestions.
  - Enter/Tab inserts the highlighted suggestion.
  - Escape closes suggestions without changing the source.
- Mouse insertion must preserve caret intent.
- Inserted fields must use valid formula syntax: `{Display Name}`.

## Non-Goals

- Full Airtable formula coverage.
- AI formula generation.
- Cross-table linked rollup authoring UI.
- Rich Monaco/CodeMirror dependency unless the implementation phase proves
  the existing textarea-overlay approach is insufficient.
- Per-table custom styling or table-local formula editor components.

## Acceptance Criteria

- Add/Edit formula modals use the same shared editor component.
- Every field-config-capable DataTable gets the same editor UI through
  `<DataTable>` wiring.
- `&` formulas pass frontend parser/evaluator parity tests and backend
  parser/evaluator/schema-mutation tests.
- Formula error cards are visually distinct and accessible.
- Autocomplete inserts field refs and supported functions at the caret.
- Existing formula behavior, `concat(...)`, field-ref resolution, dependency
  tracking, cycle detection, computed overlays, and type conversion behavior
  remain green.
- Focused shared Vitest tests and the relevant DataTable e2e tags pass before
  closeout.
