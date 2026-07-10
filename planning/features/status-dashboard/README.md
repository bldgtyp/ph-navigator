---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Redesign the project Status landing page and add a lightweight DATA-TABLE completeness summary.
RELATED: context/ui/pages/status-tab.md; context/technical-requirements/data-table.md; frontend/src/features/project_status/
---

# Status Dashboard

Planning packet for turning `/projects/{id}/status` into a calm project landing page with two complementary views:

1. **Record status** — an attention-first, progressively disclosed summary of the 12 DATA-TABLE record types that carry the shared `status` field.
2. **Roadmap** — the existing user-managed lifecycle milestones, redesigned as a compact timeline.

This is a docs-only design pass. No application code has been changed.

## Product decision

Keep both views on the existing **Status** page. They answer different questions—"what needs information?" and "what happens next?"—but belong to the same project-orientation task. A second top-level page would add navigation cost without resolving a distinct workflow.

The desktop composition is a quiet two-column project brief: the wider **Record status** pane and a narrower, sticky-within-the-page **Roadmap** pane. At narrower widths they stack, with Record status first. Neither pane is presented as a large nested card.

## Read order

1. [PRD.md](PRD.md) — behavior and UX contract.
2. [research.md](research.md) — current-code findings and table inventory.
3. [PLAN.md](PLAN.md) — implementation sequence and verification.
4. [STATUS.md](STATUS.md) — current state and next action.
5. `phases/` — detailed implementation handoffs.

## Phase map

| Phase | Outcome |
|---|---|
| 00 | Lock the summary read model, status semantics, and route map. |
| 01 | Add one purpose-built summary endpoint that reads the project document once. |
| 02 | Build the independently loading Record status summary and deep links. |
| 03 | Lighten the Roadmap and move editor actions behind hover/focus disclosure. |
| 04 | Verify authorization, accessibility, responsive behavior, cold-load UX, and performance. |

## Non-goals

- No new top-level navigation tab.
- No editing DATA-TABLE records from the Status page; rows click through to the owning table.
- No aggregation of arbitrary custom fields or record specifications.
- No percentage-based project score or inferred status from blank specifications.
- No change to the four canonical DATA-TABLE status values.

