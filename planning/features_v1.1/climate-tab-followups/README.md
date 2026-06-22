---
DATE: 2026-06-14
TIME: -
STATUS: Superseded (2026-06-21) — folded into
  planning/archive/climate-auto-populate (D-CL-25). Retained for history.
AUTHOR: Claude (for Ed)
SCOPE: Router for small follow-ups on the (complete) Climate tab — the
  custom-record entry form, sun-path cardinal labels, attached-source charts,
  and promoting the ClimateRecord contract to a context/ reference doc.
RELATED:
  - STATUS.md
  - planning/archive/climate/ (the complete Climate feature these refine)
  - planning/archive/climate/phases/phase-03b-climate-source-attach-select.md
    (§Outcome — custom-record form deferred)
  - planning/archive/climate/phases/phase-03c-climate-visualization.md
    (§Outcome — sun-path labels + attached-source charts deferred)
---

# Climate tab — small follow-ups

> **Superseded 2026-06-21** — all four items are folded into
> `planning/archive/climate-auto-populate/` (D-CL-25); see its P4/P2. This
> folder is kept for history. Item→phase mapping in `STATUS.md`.

A grab-bag of small, **independent** refinements left over from the completed
Climate Phase 3. None is large enough to warrant its own feature folder; pick
any one off the backlog when convenient. See `STATUS.md` for the item table.

These were recorded as deferred follow-ups in the Climate phase docs; they
were collected here when Climate Phases 1–3 completed and the feature was
archived (2026-06-14).

## The items (summary)

1. **Custom-record entry form** — UI to enter a standardized `ClimateRecord`
   for a `custom` source. The backend already accepts it; only the form is
   missing.
2. **Sun-path cardinal labels** — N/E/S/W letters on the sun-path compass.
   Needs the project true-north passed to the diagram (the DTO carries no
   label geometry).
3. **Attached-source charts** — render an *attached* source's record (not just
   the browsed reference record) in the Phase-3c graphs, by resolving the
   source `ref`/`data` to a `ClimateRecord`.
4. **Promote `ClimateRecord` to a `context/` reference doc** — the contract
   currently lives in `backend/features/climate/record.py` docstrings + the
   archived PRD §4.3.

Each item has acceptance notes in `STATUS.md`.
