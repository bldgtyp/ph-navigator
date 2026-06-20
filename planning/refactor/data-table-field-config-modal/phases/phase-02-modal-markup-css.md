---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Pending
AUTHOR: Codex
SCOPE: Modal DOM and shared CSS cleanup
RELATED: planning/refactor/data-table-field-config-modal/phases/phase-01-field-type-select.md, frontend/src/shared/ui/data-table/DataTable.css
---

# Phase 02 - Modal Markup And CSS

## Goal

Make the modal visually match the Airtable-parity direction: name first,
one type dropdown, no visible modal title, no uppercase top labels, and a
secondary type-change preflight card.

## Markup Changes

### Dialog Title

Replace the visible title in both modals:

```tsx
<Dialog.Title className="data-table-field-config-modal-title">...</Dialog.Title>
```

with an accessible hidden title:

```tsx
<Dialog.Title className="sr-only">Edit field</Dialog.Title>
```

or:

```tsx
<Dialog.Title className="sr-only">Add field</Dialog.Title>
```

Do not keep `data-table-field-config-modal-title` in the DOM.

### Name / Description Labels

For top-level fields, keep semantic labels but hide them:

```tsx
<label className="sr-only" htmlFor={nameId}>Name</label>
<label className="sr-only" htmlFor={descriptionId}>Description</label>
```

This preserves tests and screen-reader semantics while removing the visible
uppercase label clutter.

### Type Label

Remove the visible `Type` span. The new `FieldTypeSelect` carries the
accessible name `Field type`.

### Type-Specific Labels

Retire `data-table-add-field-label` everywhere in the modal tree. For
controls that still need visible labels, introduce a lower-emphasis class:

```tsx
className="data-table-field-config-label"
```

Apply this to type-specific labels such as:

- Decimal precision;
- Units / Unit;
- SI / IP unit;
- Formula source;
- Linked record target table;
- Cardinality;
- Options;
- Preflight, if retained as a visible sub-label.

## CSS Changes

Remove:

```css
.data-table-field-config-modal-title
.data-table-add-field-label
.data-table-add-field-type-row
.data-table-add-field-type-pill
```

Add shared replacements in `DataTable.css`:

```css
.data-table-field-config-label { ... }
.data-table-field-config-type-select { ... }
.data-table-field-config-typechange { ... }
.data-table-field-config-preflight-heading { ... }
```

Styling direction:

- compact modal spacing close to Airtable;
- no nested card around the whole modal content;
- type-change card only when the type actually changes;
- border: `var(--border-subtle)`;
- radius: `var(--radius-sm)` or smaller;
- background: muted table/card mix using existing tokens;
- text: `var(--fs-sm)` / `var(--fs-xs)` where secondary.

## Type-Change Section

In `FieldConfigSectionTypeChange.tsx`:

- keep `role="group"` and the accessible label;
- replace `data-table-view-popover-heading` if it creates too much visual
  weight;
- use a smaller heading such as `short_text -> number` or a humanized
  label if easy;
- keep the preservation sentence as the main content;
- keep the incompatible row list readable;
- keep the acknowledgement checkbox visible when values will be cleared.

## Acceptance Criteria

- The visible modal starts with the Name input.
- There is no visible `Edit field - ...` / `Add field` title.
- There are no visible uppercase Name / Type / Description labels.
- The old label/title/pill classes are gone from source.
- Type-specific controls remain labeled and accessible.
- The preflight content reads as secondary background information.

