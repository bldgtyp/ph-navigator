---
DATE: 2026-05-25
TIME: P2.8
STATUS: Filed for plan-15 Phase 2.8. Focused accessibility notes for
        custom-field schema-editor surfaces.
RELATED:
  - planning/archive/dated/2026-05-24/plan-15-custom-fields-phase-2-schema-editor.md
  - context/user-stories/32-custom-fields.md
---

# Plan 15 P2.8 — custom-field a11y notes

## Scope

Focused pass over the Phase 2 schema-editor surfaces:

- header context menu;
- add-field popover;
- edit-description popover;
- locked indicator;
- description tooltip;
- viewer-mode suppression of schema-mutation controls.

## Findings

No critical findings remain open in P2.8.

Notes:

- Header context menu is keyboard-reachable via Shift+F10 /
  ContextMenu key, Escape-closeable through the Radix popover layer,
  and arrow-key focus movement is covered by
  `HeaderContextMenu.test.tsx`.
- Add-field popover exposes a dialog label, focuses the field-name
  input on open, keeps duplicate-name failures in a `role="alert"`
  inline region, and leaves Phase 3 / 4 type pills disabled.
- Edit-description popover exposes a dialog label and textarea label.
  P2.8 hardened the textarea input handler to accept both `change`
  and `input` events before save.
- Locked indicator uses a Lucide lock with `aria-hidden`; it does not
  pollute the column-header accessible name.
- Description tooltip trigger has the accessible name
  `Description for {fieldDisplayName}` and opens on focus as well as
  hover.
- Viewer mode renders lock / description read affordances and
  suppresses the context menu plus tail `Add field` button.

## Verification

- Unit / component coverage:
  - `RoomsTable.customFieldEditorE2E.test.tsx`
  - `EditFieldDescriptionPopover.test.tsx`
  - existing `HeaderContextMenu.test.tsx`,
    `AddFieldPopover.test.tsx`, and
    `RoomsTable.lockedIndicator.test.tsx`
- Browser walkthrough coverage is pinned in
  `frontend/tests/e2e/custom-fields-phase-2.spec.ts`.
  Screenshots are written to
  `planning/archive/dated/2026-05-24/screenshots/plan-15-p2-8/` when the
  Playwright spec runs.

## Deferred

No blocker for Phase 2. A later Phase 5 polish pass can replace the
current hand-rolled context-menu focus management with a dedicated menu
primitive if the dependency policy changes.
