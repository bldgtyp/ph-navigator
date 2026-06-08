---
DATE: 2026-06-08
TIME: -
STATUS: Active — research / discussion only. No PRD or implementation
        yet. The next step is reviewing `options.md` and picking an
        approach before a PRD is drafted.
AUTHOR: Ed May (with Claude)
SCOPE: Folder router for the record-linking feature investigation
       (AirTable-style linked-record + rollup between project-document
       tables, e.g. Pumps ↔ Rooms).
RELATED: options.md — architecture options memo with three approaches
                       and a recommendation.
         context/PRD.md §6, context/technical-requirements/data-model.md §6.3,
         §6.6.3, §6.6.4
---

# Record-linking — feature folder

Investigating whether and how to add AirTable-style record linking
(plus rollup/aggregation) between project-document tables in V2 —
e.g. linking a `Pump` row to one or more `Room` rows and rolling up
totals on the inverse side.

## Read order

1. `options.md` — the architecture options memo. Three approaches
   (typed columns, new `linked_record` field type, document-level
   relations array) with pros, cons, and the Approach-2 recommendation.
2. `PRD.md` — feature PRD draft built on Approach 2. §11 tracks the
   open questions that drive the current use-case conversation.
3. *(future)* `STATUS.md` / `phases/` — added when implementation work
   begins.

## Current state

- **Approach 2 committed** as the baseline (see `options.md §5`).
- PRD draft in place; resolving Q1–Q10 through paired use-case
  discussions before any code work begins.
- A precedent exists: `RoomRow.erv_unit_ids: list[str]` is already a
  half-implemented Room→ERV link whose values are rejected by the
  document validator until the ERV table contract is wired up. See
  `options.md §2` and PRD Q7 for what that means for the design space.
