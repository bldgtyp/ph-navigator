# Formula fields with units — convert a fixed-unit number field into a formula

```
DATE:    2026-07-09
TIME:    11:46 EDT
STATUS:  Scoped — Option B accepted (D1). Phases 1-3 planned, implementation not started.
AUTHOR:  Ed + Claude
SCOPE:   SHARED data-table schema-mutation pipeline — lands for every FieldDef table at once (D9),
         not just Rooms. Backend: fixed-units guard, formula config, unit validation, set_formula.
         Frontend: field-config modal payload, formula cell display, unit toggle.
RELATED: context/ui/pages (data-table), planning refactor/attachment-cell-ux (sibling table work),
         ip-si-unit-switching (unit toggle precedent), record-linking (schema-mutation precedent)
```

## One-liner

Let a user turn a **number field that has units** (e.g. Rooms → "Supply airflow rate",
CFM ↔ M³/h) into a **formula field** that computes its value from other fields — **without
losing the unit display / SI-IP toggle** on the result. Today this is blocked outright by
`"Fixed unit config cannot be edited."`, and even if unblocked the formula result would
render as a bare, unit-less number.

## Read order

1. **`PRD.md`** — the use-case, the two-part root cause, the design (§4/§4a: free-choice
   display-label rule + unit-less-scalar corollary), the full edge-case / guard list.
2. **`decisions.md`** — the accepted decisions (D1-D9) the phases assume. Read before the phases.
3. **`STATUS.md`** — current state, the one external risk that gates the built-ins, next step.
4. **`phases/`** — handoff-ready implementation plans:
   - **`phase-01-backend.md`** — guard relax + numeric-formula units + `set_formula` reconciliation
     + carry-forward + reverse round-trip. The whole server contract; table-agnostic.
   - **`phase-02-frontend.md`** — carry units on convert, render computed cells through the unit
     path, modal display-unit picker. The visible half.
   - **`phase-03-export-computed-values.md`** — add computed/formula values to the Grasshopper
     export (`GET /tables/{table_name}`), an in-repo ~25-40 LOC change that fixes computed
     export for *all* tables and removes the built-in-airflow gate. Then unlock the two built-in
     airflow fields.

Phase 1 → Phase 2 in sequence. Phase 3 is independent, in-repo, and needs no external answer
(the earlier "confirm the export" gate was dissolved by the 2026-07-09 finding that computed
values are simply omitted by one exporter). The mechanism (Phases 1-2) ships for **custom fields
on every table**; Phase 3 improves the export and lets the built-in airflow fields opt in.

## The problem in one breath

- `supply_airflow_m3h` is a **built-in number field** with `units.mode == "fixed"`,
  `unit_type == "airflow"` (`backend/features/project_document/tables/rooms.py:104-118`).
- It is **not** in `ROOMS_FIELD_TYPE_LOCKED_KEYS`, so the type picker *offers* "formula" —
  but two independent facts block the outcome:
  1. A guard rejects the write because the new (formula) config drops `units`
     (`bundle.py:80`, `type_conversion.py:276`).
  2. Formula fields carry **no** `units` config at all, so a formula result is displayed
     as a bare number with no CFM/M³h formatting and no SI/IP toggle
     (`ComputedCell.tsx`, `lib/rows/format.ts`).

Fixing (1) alone unblocks the gesture but ships a unit-less airflow column — a regression.
The real feature is **(1) + (2): unit-aware formula fields.**

## Status snapshot

**Scoped.** Option B (unit-aware formula) accepted; phases 1-3 written for handoff.
Implementation not started. The only remaining external unknown gates the two **built-in**
airflow fields (Phase 3), not the general feature — see `STATUS.md`.
