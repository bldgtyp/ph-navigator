---
DATE: 2026-05-25
TIME: post-implementation review (P4.10)
STATUS: A11y notes for the Phase 4 formula UI surfaces — popover,
        field palette, computed-cell error state, and modal
        escalation. Derived from a focused source review of:
        - `frontend/src/shared/ui/data-table/components/FormulaEditorPopover.tsx`
        - `frontend/src/shared/ui/data-table/components/FormulaFieldPalette.tsx`
        - `frontend/src/shared/ui/data-table/components/ComputedCell.tsx`
        - the existing isolation tests in
          `frontend/src/shared/ui/data-table/__tests__/FormulaEditorPopover.test.tsx`
        plus the Phase-4 acceptance tests in
        `frontend/src/features/equipment/__tests__/RoomsTable.customFieldsPhase4.test.tsx`.
        No blocking findings. Non-blocking follow-ups are flagged for
        the Phase 5 a11y polish pass (plan-13 §5).
PARENT-PLAN: docs/plans/2026-05-25/plan-17-custom-fields-phase-4-formula-fields.md
RELATED:
  - context/UI_UX.md (focus management, ARIA patterns)
  - frontend/src/shared/ui/data-table/components/FormulaEditorPopover.tsx
  - frontend/src/shared/ui/data-table/components/FormulaFieldPalette.tsx
  - frontend/src/shared/ui/data-table/components/ComputedCell.tsx
---

# Phase 4 — Formula UI a11y notes

## Scope

A focused review of the new Phase 4 surfaces against the checklist in
plan-17 P4.10:

1. **`<FormulaEditorPopover>`** — focus trap, tab order, `aria-live`
   preview, dialog labelling.
2. **Modal escalation** (`escalateToModal` at 240-char source) — focus
   restoration when the popover/modal closes.
3. **`<FormulaFieldPalette>`** — chip accessible names that include
   the field type.
4. **`<ComputedCell>`** — non-visual cue for the `#ERROR` glyph in the
   structured-error state.

This is a code-level review, not a live screen-reader pass. The
findings below mark which checks are met by the current code, where
the implementation differs from the plan's wording, and which items
warrant follow-up in Phase 5.

## Findings

### ✅ Dialog labelling

`Popover.Content` carries `role="dialog"` and
`aria-label={`Edit formula for ${fieldDef.display_name}`}` (see
`FormulaEditorPopover.tsx:226-227`). The acceptance test asserts the
exact label match, so a regression would fail loudly. Screen readers
announce the dialog name on open.

### ✅ Source input labelling and validity

The expression input is bound to a `<label htmlFor={sourceInputId}>`
("Expression") and carries `aria-invalid` when the local parser
reports an error (`FormulaEditorPopover.tsx:205,235-250`). The
`aria-describedby={previewLabelId}` ties the input to the preview
panel so screen readers read the live parse status as part of the
input's description.

### ✅ Preview panel `aria-live`

The preview panel uses `role="status"` with
`aria-live="polite"` (`FormulaEditorPopover.tsx:315-317`). Parse
errors, missing-ref hints, and evaluated results all announce
politely without stealing focus.

### ✅ Field palette accessible chip names

Every chip carries `aria-label="${FIELD_TYPE_LABEL[entry.field_type]} ${entry.display_name}"`
(e.g. `"Text column Name"`, `"Number column Bedrooms"`,
`"Single-select column Floor"` — see
`FormulaFieldPalette.tsx:15-21,39,46`). The acceptance test in
`FormulaEditorPopover.test.tsx:108-112` asserts the exact
`Text column Name` label, so the pattern is regression-protected.

### ✅ Computed cell error state has non-visual cue

`<ComputedCell>` renders the `#ERROR` glyph with `role="img"` and
`aria-label={`Formula error: ${message}`}` plus a matching `title`
tooltip (`ComputedCell.tsx:19-32`). The error-code-to-message map
lives in
`frontend/src/shared/ui/data-table/lib/formula/computedValues.ts`
(`COMPUTED_ERROR_MESSAGES`), shared by the popover preview and the
cell. The Phase-4 acceptance test in
`RoomsTable.customFieldsPhase4.test.tsx` (delete-referenced-field
case) asserts the exact aria-label substring "Formula error: Formula
references a field that no longer exists" so the wire copy is
test-pinned.

### ✅ Palette mousedown preserves source-input caret

The palette chip's `onMouseDown={(event) => event.preventDefault()}`
(`FormulaFieldPalette.tsx:50`) prevents the chip from stealing focus
from the source input, so the inserted `{Display Name}` lands at the
caret position the user expected. Without this the caret would jump
to start-of-input on every insertion — an a11y *and* UX regression
that the implementation has already guarded against.

### ✅ Escape key closes the popover

`handleKeyDown` listens for `Escape` on the dialog root and dispatches
`onOpenChange(false)` when `pending` is false
(`FormulaEditorPopover.tsx:166-174`). This matches the existing
header-context-menu / add-field-popover Escape behaviour, so the
mental model stays consistent.

### ✅ Submit gating is announced via the disabled state, not silent

The submit button uses `disabled={!canSubmit}` and changes its label
to "Saving…" while the mutation is in flight
(`FormulaEditorPopover.tsx:284-286`). Screen readers announce both
the disabled state and the label transition. The preview panel's
`aria-live` carries the *reason* the submit is gated (parse error,
cycle, missing ref), so users hear "why" alongside "can't submit".

## Non-blocking follow-ups for Phase 5

These don't block shipping Phase 4 but should land in the Phase 5
a11y polish pass (plan-13 §5 Phase 5 — "Accessibility pass on the
context menu, popover field editor, and formula editor"):

### 1. Focus-trap inside the popover/modal

The popover relies on Radix's built-in focus management
(`@radix-ui/react-popover`), which does trap focus inside the
`Popover.Content` by default. However:

- `onOpenAutoFocus={(event) => event.preventDefault()}` opts out of
  Radix's autofocus so we can focus the expression input ourselves
  via a `setTimeout(...)` in `useEffect`
  (`FormulaEditorPopover.tsx:84-94,228`). This means the first
  Tab press from outside the popover (if it ever happens — Radix
  normally keeps focus inside) would land on whatever the browser
  considers first-focusable.
- Phase 5 should add a manual Tab-cycle test against the popover
  in `frontend/tests/e2e/custom-fields-phase-4.spec.ts` to confirm
  the Tab order matches the plan's contract:
  Source input → Field palette (arrow-key navigable within) →
  Preview panel (read-only, focusable for screen reader) → Cancel
  → Submit.

### 2. Field palette arrow-key navigation

The palette is `role="group"` with chip `<button>` children. Today
each chip is independently tab-focusable; Tab walks through every
chip one at a time. A `role="toolbar"` or `role="listbox"` pattern
with arrow-key navigation between chips would reduce the Tab burden
for screen-reader and keyboard users when the palette has many
entries.

Recommended Phase 5 change: wrap the chips in a roving-tabindex
pattern so only one chip is in the tab order at a time and arrow keys
move between them. The accessible-name pattern stays as-is.

### 3. Focus restoration after modal escalation

`escalateToModal` (240-char source) currently applies a CSS modifier
(`data-table-formula-editor-modal`) but does *not* change the focus
trap or restore strategy. Today the popover and the escalated modal
are the same DOM node — Radix just restyles the container. Focus
returns to the popover anchor (the header context menu's anchor cell)
when the popover closes. That's correct for the popover case but
could feel jarring in the modal case if the anchor scrolls
off-screen while the modal is open.

Phase 5 should test: open the popover near the right edge of a wide
grid (so the anchor is near the right edge), type enough source to
escalate to modal, close the modal. Confirm focus lands on a sensible
target (anchor cell if visible; otherwise the row's first focusable
cell).

### 4. Preview-panel focusability for screen readers

The plan's checklist says "Preview panel (read-only, focusable for
screen reader)". Today the panel is `role="status"` and
`aria-live="polite"` (correct for announcing changes) but it is *not*
focusable. Screen-reader users can usually navigate to `role="status"`
elements via virtual-cursor navigation, so this likely is not a
blocker. Phase 5 should validate with NVDA / JAWS / VoiceOver and
add `tabindex="0"` if real-world navigation is awkward.

### 5. Disabled-state announcement for the formula pill in change-type

The change-type popover greys the `formula` pill with a
"Formula fields use Edit formula…" tooltip (plan-16 D19 carryover).
The tooltip is keyboard-accessible via hover/focus on the pill, but
the disabled state itself doesn't currently announce *why* the pill
is disabled to a screen reader without focus reaching the tooltip.
Phase 5 should add an `aria-describedby` to the disabled pill that
points at the tooltip text, so AT users hear the reason at the same
moment they hit the disabled control.

### 6. Color-only signal for chip field type

The chips use `data-field-type` to drive a CSS color/style hint per
field type (text vs number vs single-select etc.). The
`aria-label` already names the field type so screen-reader users
aren't disadvantaged. Phase 5 should verify the color palette meets
WCAG AA contrast against the popover background and add a non-color
indicator (icon glyph) for users with color-vision differences if
the palette has any borderline pairs.

## Verification artifacts

- **Component-level**: `FormulaEditorPopover.test.tsx` (9 cases,
  covers parse-error gate, missing-ref gate, self-cycle gate,
  palette insertion, happy-path submit, server-error surface,
  display-name rebuild).
- **Acceptance via UI**:
  `RoomsTable.customFieldsPhase4.test.tsx` (5 cases, covers
  add-formula wire-shape, edit-formula popover seeding,
  duplicate-field, missing-ref overlay, viewer-mode read-only).
- **End-to-end against running stack**:
  `frontend/tests/e2e/custom-fields-phase-4.spec.ts` (full
  walkthrough with screenshots under
  `docs/plans/2026-05-25/screenshots/plan-17-p4-10/`).

---

# Phase 5a.7 — Field config modal a11y notes

## Scope

Acceptance review for Plan 21's unified custom-field config modal:

- `frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx`
- `frontend/src/shared/ui/data-table/components/GridHeader.tsx`
- `frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx`
- `frontend/src/shared/ui/data-table/components/ColumnHeaderMenu.tsx`

This is a source + component-test + browser acceptance pass. It records
the modal's focus trap, Escape, and screen-reader behavior as the single
a11y checklist for the Plan 21 P5a acceptance step.

## Findings

### Dialog semantics and focus trap

`FieldConfigModal` is a Radix `Dialog`; while open, focus is trapped
inside the dialog content. The dialog is labelled by the modal title
(`aria-labelledby`) and the title includes the current field display
name, so screen readers announce the edited field on open.

### Open gestures and focus return

Editable custom-field headers open the same modal from double-click,
the header `Edit field...` menu item, the header chevron menu, and
keyboard Enter on the focused column header. Core fields and viewer
mode suppress those edit entry points. On close, focus returns to the
originating header cell through the stored trigger element.

### Keyboard dismissal and pending-save lockout

Escape and backdrop click close the modal while the form is idle. While
Save is pending, Escape, backdrop close, and Cancel are suppressed and
form controls are disabled; this avoids losing the user's draft during
an unresolved schema mutation.

### Form order and live feedback

The keyboard order follows the form declaration: Name, Type, the active
type-specific section, Description, Cancel, Save. Type-change preflight
messages use alert/status semantics inside the type section, and the
formula preview keeps its polite live-region behavior after moving into
the modal.

## Verification artifacts

- `frontend/src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx`
  covers Escape/backdrop behavior, pending-save lockout, source-field
  removal, external-change conflict handling, and focus return.
- `frontend/src/shared/ui/data-table/__tests__/columnHeaderDoubleClick.test.tsx`
  covers custom-header double-click, viewer-mode suppression, and the
  Plan 21 keyboard Enter open path.
- Browser acceptance on `http://localhost:5173`: focused the `Finish`
  custom-field header, dispatched Enter, confirmed `Edit field -
  Finish` opened with the Name input focused, pressed Escape, and
  confirmed focus returned to the originating column header.
- `pnpm exec playwright test tests/e2e/custom-fields-phase-2.spec.ts`
  passed and covers the header menu `Edit field...` path through a
  real Rooms project.

## Sign-off

No critical a11y findings for Phase 4 or Plan 21 P5a.7. Phase 4's
non-blocking items above roll into the Phase 5 a11y polish
ADR-equivalent.
