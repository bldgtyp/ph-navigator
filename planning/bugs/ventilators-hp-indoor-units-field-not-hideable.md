---
DATE: 2026-07-09
TIME: 11:50
STATUS: Open
AUTHOR: Ed May (reported), Claude (recorded)
SCOPE: EQUIPMENT / VENTILATORS table — "HP Indoor Units" field
RELATED:
  - feedback_datatable_uniformity_ironlaw
  - context/UI_UX.md
---

# VENTILATORS: "HP Indoor Units" field cannot be hidden or reordered

## Summary

In **EQUIPMENT / VENTILATORS**, the **"HP Indoor Units"** column/field
behaves differently from every other field and appears to be missing the
standard DataTable affordances.

## Observed behavior

1. **Cannot be hidden.** Neither the right-click context menu nor the
   "Hide Fields" control will hide it. The field stays visible regardless.
2. **Cannot be reordered.** Attempting to drag/reorder it always snaps it
   back to the **last position** — it will not hold any other position.
3. **Missing the built-in field bottom-border highlight.** It does not
   render the standard "built-in" field bottom border that other built-in
   fields show.

## Why it matters

This violates the DataTable uniformity iron-law
([[feedback_datatable_uniformity_ironlaw]]): basic affordances
(hide, reorder, built-in styling) are supposed to be parent-owned and
uniformly enforced, not opt-in per field. This field is escaping that
contract.

## Hypothesis / where to look

The always-last-position + can't-hide + missing-built-in-border trio
suggests "HP Indoor Units" is being treated as a special/pinned or
computed/derived column outside the normal field list — likely appended
by the table config rather than registered as a normal built-in field, so
the hide/reorder/border machinery never sees it.

Start in the VENTILATORS table definition and the shared DataTable
field-config / column-ordering logic.

## Repro

1. Open a project → EQUIPMENT → VENTILATORS.
2. Right-click the "HP Indoor Units" header → note no working "hide" option.
3. Open "Hide Fields" → note it can't be toggled off.
4. Try to drag it left → note it snaps back to the last position.
5. Compare its header bottom border to adjacent built-in fields.

## Status

Open — not yet triaged or fixed. Recorded from user report.
