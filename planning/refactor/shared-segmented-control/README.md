---
DATE: 2026-08-03
TIME: 09:16 EDT
STATUS: Deferred — scoped, not started
AUTHOR: Claude with Ed May
SCOPE: Replace four divergent segmented-toggle implementations with one
  blessed `SegmentedControl` primitive in `shared/ui`, and add it to the
  design-system component inventory.
RELATED:
  - ./PRD.md
  - ./STATUS.md
  - ../../../context/DESIGN_SYSTEM.md
  - ../../../frontend/src/styles/README.md
---

# Shared segmented control

Planning router for extracting one segmented-control primitive from the four
that exist today.

## Why this exists

The design system's component inventory has **no segmented control**, so every
screen that needed one built its own. There are now four, all on the same
tokens, all doing "pick one of N, mutually exclusive, inline":

| # | Class | Component | Shape |
|---|---|---|---|
| 1 | `.topbar-unit-toggle` (`styles/base.css:561`) | `shared/ui/TopbarUnitToggle.tsx` | Pill track, sliding `::before`, 32px square cells, 2 options |
| 2 | `.modal-unit-toggle` (`features/envelope/envelope.css:1573`) | `features/envelope/components/ModalUnitToggle.tsx` | Same recipe at 26px, 2 options |
| 3 | `.pill-tab` / `.pill-tab-list` (`styles/base.css:1530`) | class-only; 4+ consumers | Separated bordered pills, N options, `role="tablist"` or `role="group"` |
| 4 | `.drift-choice` (`features/envelope/envelope.css:1393`) | `features/envelope/components/MaterialDrift.tsx` | Pill track, real `<input type="radio">`, 3 text-width options |

#4 is the newest (2026-08-03) and is what surfaced this. Two independent
reviewers flagged it as "reuse before inventing" — correctly. It was restyled
to match #2's visual family rather than extracted, because #2's sliding
indicator hard-codes two equal-width cells and cannot serve three text-width
options without rework. That was the right call for that session's scope and
the wrong one to leave standing.

The cost is concrete: a restyle of the app's segmented-toggle look currently
has to be applied in four places, and the next person who needs one will make
a fifth.

## Read order

1. `PRD.md` — the inventory, the API, the migration order.
2. `STATUS.md` — state, next step, verification.

## Not in scope

- `.pill-tab`'s **tab** usages (`role="tablist"`, e.g. `CondensationRiskModal`)
  if analysis shows tabs and single-select toggles want to stay distinct.
  Decide this in the PRD's Q1, don't assume it.
- `StatusSelect`, `AutocompleteSelect`, `StatusFilterChips` — different
  interaction models, not segmented controls.
