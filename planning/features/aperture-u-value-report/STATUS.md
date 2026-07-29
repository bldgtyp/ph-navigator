---
DATE: 2026-07-29
UPDATED: 2026-07-29 — Ed resolved all open decisions; ready for Phase 01
TIME: 14:17 EDT
STATUS: Active — planning complete, all decisions resolved; Phase 01 kickoff next
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, and verification ledger for the Aperture
  U-Value Detail Report feature.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./PLAN.md
---

# STATUS — Aperture U-Value Detail Report

## Current state (2026-07-29)

Planning package written (this session): PRD, decisions, research, PLAN.
No code changes. No branch yet.

- Research complete: backend calc code map, Phius example spreadsheet fully
  decoded (formulas extracted), frontend page + export precedents,
  edge-case inventory. See `research.md`.
- Behavior contract drafted in `PRD.md`, including the two hazards most
  likely to bite: unfinished elements currently weight into U-w as zeros,
  and the legacy sheet's corner convention differs from the code's 45°
  split.

## Decisions — resolved 2026-07-29

Ed accepted: **D-4** export saved version, **D-6** glazing-area-weighted
SHGC, **D-7** option (a) rollup mirrors the chip (include-as-zero, loudly
annotated), **D-8** `APERTURE_EXPORT_U_VALUE_REPORT` capability, **D-9**
consolidate IP conversion constants. D-1..D-3, D-5 stand as
recommended-accepted (presented for veto; none raised). PRD and PLAN
updated to match.

## Next step

Detailed phase plans written 2026-07-29 (`phases/phase-01..06`). Start
Phase 01 (`phases/phase-01-breakdown-refactor.md` — pin tests first, then
the backend per-side breakdown refactor) on branch
`feature/aperture-u-value-report`.

## Blockers

- None.

## Verification ledger

- 2026-07-29 — Example artifact decoded programmatically (openpyxl) from
  `_260701 Window Unit Detailed U-Values.xlsx`; formulas quoted in
  `research.md` §2 were read from the file, not inferred.
- No code verification yet (planning only).
