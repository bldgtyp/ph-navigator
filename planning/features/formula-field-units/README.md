# Formula fields with units — convert a fixed-unit number field into a formula

```
DATE:    2026-07-09
TIME:    13:38 EDT
STATUS:  Scoped — Option B accepted (D1); revised after the 2026-07-09 pre-implementation
         code review (D12-D14, phases reordered: export lands FIRST). Implementation not started.
AUTHOR:  Ed + Claude
SCOPE:   SHARED data-table schema-mutation pipeline — lands for every FieldDef table at once (D9),
         not just Rooms. Backend: fixed-units guard, formula config, unit validation, set_formula,
         bundle wire model. Frontend: field-config modal payload, formula cell display, unit toggle.
         Plus the gh_api tabular export (computed values).
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
   display-label rule + unit-less-scalar corollary), the full edge-case / guard list
   (§7.12-7.16 are the 2026-07-09 review findings).
2. **`decisions.md`** — the accepted decisions (D1-D14) the phases assume. Read before the phases.
3. **`STATUS.md`** — current state and next step.
4. **`phases/`** — handoff-ready implementation plans, **in execution order**:
   - **`phase-01-export-computed-values.md`** — add computed/formula values to the Grasshopper
     export (`GET /tables/{table_name}`), ~25-40 LOC, all tables. **Lands first** so the guard
     relax never exposes a GH-exported built-in to an empty-value export (18 fixed-unit
     built-ins across 8 tables; only Rooms has a type-lock list). Standalone.
   - **`phase-02-backend.md`** — registry-drift closure + effective-units guard redesign (D13)
     + top-level `display_units` wire field (D12) + numeric-formula units + always-run
     `set_formula` reconciliation (D14) + carry-forward + reverse round-trip (undo-safe).
     The whole server contract; table-agnostic. No interim built-in lock.
   - **`phase-03-frontend.md`** — top-level `displayUnits` payload, render computed cells
     through the unit path, modal display-unit picker. The visible half.

Phase 1 → Phase 2 → Phase 3 in sequence (1 gates 2 by ordering policy, 2 gates 3 by API).

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

**Scoped, review-hardened.** Option B (unit-aware formula) accepted; a 2026-07-09
pre-implementation review verified the plans against the code and folded five findings back
in (wire-parse validation → D12; reverse/undo + fixed-on-formula enforcement → D13;
units-only retag → D14; built-in exposure → phases reordered, export first; registry drift →
Phase-2 prerequisite). Implementation not started. No external blockers — see `STATUS.md`.
