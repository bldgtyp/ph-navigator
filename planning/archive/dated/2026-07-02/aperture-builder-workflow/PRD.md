---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Product contract for Aperture Builder workflow improvements.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./STATUS.md
---

# PRD - Aperture Builder Workflow

## Problem

The Aperture Builder currently makes copy/paste attribute transfer feel too
indirect: after the picker tool selects a valid source window/element, paste is
not immediately armed and visually obvious. The builder also lacks a horizontal
mirror command, forcing manual segment/frame edits when a user needs the same
aperture mirrored left/right.

## Desired Behavior

### Picker to Paste

- User activates the picker/copy-attributes tool.
- User selects a valid aperture element/window.
- The builder immediately enters paste-ready mode without requiring an
  intermediate toolbar click.
- The toolbar clearly communicates paste-ready state by changing the icon and
  highlight/active treatment.

### Flip Left/Right

- The builder exposes a `Flip left/right` action comparable to Envelope Builder.
- The command mirrors the aperture's actual element/segment arrangement.
- Frame assignments mirror with the elements.
- This action is distinct from `View from Exterior` / `View from Interior`,
  which should remain a viewing-orientation control.

## Acceptance Criteria

- Picking a valid source element immediately enables/arms paste.
- Paste-ready state has visible toolbar feedback.
- Invalid source selections do not arm paste.
- `Flip left/right` reverses horizontal element order.
- Left/right frame assignments are remapped correctly after flip.
- Head/sill assignments remain vertically correct after horizontal flip.
- Multi-segment apertures and frames remain internally consistent after flip.
- Existing exterior/interior view toggle behavior is unchanged.
- Focused frontend tests cover picker state transitions and flip remapping.
- Browser smoke verifies both workflows in the Aperture Builder.

## Non-Goals

- No new persistence model beyond the existing aperture save path.
- No change to frame compatibility rules; that is tracked separately in
  `planning/archive/dated/2026-07-02/aperture-frame-compatibility-rules/`.
- No redesign of the whole builder toolbar.

## Investigation Notes

- Inspect Envelope Builder's left/right flip behavior and reuse the same command
  semantics where possible.
- Locate the Aperture Builder state machine for picker/copy/paste modes before
  editing toolbar UI.
