---
DATE: 2026-06-08
TIME: -
STATUS: Active — PRD drafted; Q1–Q10 resolved 2026-06-08 through
        paired use-case discussion, Q11–Q28 resolved 2026-06-08
        through PRD review pass (wire shape, ETag, changeType,
        picker UX, perf gate, etc.). Next step is phase plans under
        `phases/`. No code work yet.
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
2. `PRD.md` — feature PRD built on Approach 2. §11 captures the
   28 resolved questions (Q1–Q10 use-case-driven, Q11–Q28
   implementation-shape).
3. `phases/` — implementation plans, one file per phase:
   - `phase-01-link-values.md` — new `linked_record` field type,
     picker, pill renderer, source-side editing. No inverse view.
   - `phase-02-inverse-view.md` — server-computed inverse overlay,
     cross-table ETag invalidation, perf gate.
   - `phase-03-rollups.md` — `linked(...)` / `linked_from(...)`
     formula primitives with `count` / `sum` / `avg`; document-
     level formula cycle detection.
4. *(future)* `STATUS.md` — add when implementation work begins.

## Current state

- **Approach 2 committed** as the baseline (see `options.md §5`).
- **PRD complete**: use-case questions Q1–Q10 and implementation-
  shape questions Q11–Q28 all resolved 2026-06-08. Wire shape,
  ETag scope, changeType-across-bag behavior, picker UX, and the
  per-request perf gate are all locked in §6 / §7 / §10 / §11.
- **Phase plans drafted** under `phases/`: Phase 1 (link values),
  Phase 2 (inverse view + perf gate), Phase 3 (rollups +
  document-level cycle detection).
- Next step: pick up Phase 1 implementation. No code work yet.
- A precedent exists: `RoomRow.erv_unit_ids: list[str]` is the
  half-implemented Room→ERV link from the V2 scaffold. PRD Q7
  decided to delete the typed column outright with no built-in
  replacement; users add their own linked_record fields if they
  want the relationship.
