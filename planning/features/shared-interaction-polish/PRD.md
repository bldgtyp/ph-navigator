---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — behavior contract ready
AUTHOR: Ed May / Codex
SCOPE: Shared UI interaction and expanded-row visual contract
RELATED:
  - planning/features/shared-interaction-polish/README.md
  - planning/features/shared-interaction-polish/STATUS.md
  - context/DESIGN_SYSTEM.md
---

# PRD — Shared Interaction Polish

## 1. SegmentedControl affordance

The exact reported surface is:

`phn-segmented-control phn-segmented-control--sm phn-segmented-control--equal-width`.

Its current unselected hover changes only text color. Required behavior:

- Unselected actionable options gain a visible background and/or state ring,
  not merely a subtle text-color shift.
- The pointer cursor remains and the entire segment is the hit target.
- Selected, selected-hover, unselected-hover, keyboard-focus, and disabled
  states are visibly distinct and continue to use design-system tokens.
- No transform or size change may move adjacent segments on hover.
- Each segment in the reported small/equal-width variant shows a delayed
  tooltip. Extend
  `SegmentedControlOption<T>` with explicit tooltip copy; fall back to
  `ariaLabel ?? label` when a consumer has no richer explanation.
- Use the shared `Tooltip` and shared medium hover delay. Do not use the native
  `title` attribute as the primary tooltip.
- Tooltip placement must flip/shift to remain within the viewport and above
  modals/popovers. Typography, colors, shadow, and spacing come from the shared
  tooltip implementation.
- Tooltip content is also reachable from keyboard focus without interfering
  with native radio arrow-key behavior.
- The native radio trigger itself receives the tooltip's `aria-describedby`;
  describing only its wrapping label is insufficient.
- Preserve the control's existing group-level `title` error channel (including
  `TopbarUnitToggle`). The new option tooltip replaces no validation feedback.
- Apply through the primitive so every small/equal-width app-wide instance
  inherits it. Other variants render a tooltip only when explicitly supplied;
  this packet does not silently add fallback copy to every segmented control.

Update `context/DESIGN_SYSTEM.md` and
`frontend/scripts/interaction-states-baseline.json` if the accepted shared
state changes.

## 2. Expandable ReportTable seam

The shared CSS already attempts the desired frame with split inset shadows and
an opaque sticky lane. Therefore Phase 00 is a mounted-consumer investigation,
not an assumption that those rules are absent. Capture the reported notch and
identify the actual computed-style, sticky-layer, radius, or subpixel cause
before changing shared CSS. If the current build cannot reproduce it at the
reported geometry, record that evidence and close this half without speculative
style churn.

The expanded row and its immediately following expansion must read as one
continuous framed unit:

- no gap/notch where the row highlight meets the left or right accent edge;
- no rounded white bite at the top-left/top-right edge;
- no seam between row and expansion;
- one continuous top, side, and bottom accent boundary;
- no layout shift when expansion opens;
- frozen gutter/primary-column backgrounds remain opaque while horizontally
  scrolled;
- hover and expanded backgrounds remain distinguishable;
- nested ReportTables keep their current non-sticky behavior.

Any confirmed fix belongs in shared `ReportTable.css`; do not special-case
Envelope Materials. Verification must assert rendered seam/edge geometry or
pixels, not merely the already-existing expanded class names. The matrix
includes expanded first, middle, and last rows, with and without a row action,
plus a horizontally scrollable report.

## 3. Acceptance

- Every small equal-width segmented control has an obvious hover affordance and
  delayed viewport-safe tooltip.
- Mouse, keyboard, selected, and disabled states pass the interaction-state
  guard and visual inspection.
- Envelope → Materials shows a continuous expanded-row border with no notches.
- Aperture U-Values and other expandable report consumers retain alignment,
  expansion behavior, and horizontal scrolling.
- No feature-local override is added for either primitive.

## 4. Non-goals

- Replacing true tablists with `SegmentedControl`.
- Redesigning SegmentedControl sizes or labels.
- Changing ReportTable data, expansion content, or row-toggle semantics.
