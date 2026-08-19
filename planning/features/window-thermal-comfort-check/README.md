---
DATE: 2026-08-18
TIME: 10:52 EDT
STATUS: Draft — not started
AUTHOR: Ed May / Claude
SCOPE: Router for the window thermal-comfort compliance check
RELATED:
  - planning/features/window-thermal-comfort-check/PRD.md
  - planning/features/window-thermal-comfort-check/STATUS.md
---

# Window Thermal Comfort Check

Automatic Phius window thermal-comfort screening on the Apertures page:
derive each lite's head height above finished floor, compute the Phius
`U_max` for that height and the project's ASHRAE 99% heating design
temperature, and report pass/fail per lite — mirroring the condensation
check already shipped in Envelope / Assemblies.

## Read order

1. `PRD.md` — the behaviour contract, the rule mechanics, and the new
   parameters.
2. `STATUS.md` — current state, next step, blockers.

No phase plans yet; the feature is unstarted and has one open design
question that could reshape it (PRD §10.2).

## Why this exists

PHN computes aperture U-values but carries no vertical datum, so it cannot
evaluate the one Phius fenestration criterion that depends on geometry. On
2441 Arverne East (Building D) that gap meant a storefront glass
substitution could not be assessed without rebuilding the geometry by hand
against shop drawings — and the answer, once computed, was that both the
proposed *and* previously approved packages fail at the tallest lites.

## Shape of the work

| Layer | Change |
| --- | --- |
| Document model | `sill_height_mm` on `ApertureTypeEntry`; NFRC standard-size whole-window U on the window construction |
| Backend | Head-height derivation, criterion evaluation, per-lite + roll-up status model, route |
| Frontend | Status chip + detail modal on Apertures, reusing the condensation components |

## Precedent to copy, not reinvent

- Status model / blocked states: `backend/features/envelope/condensation.py`
- Chip presentation: `frontend/src/features/envelope/condensation-chip.ts`
- Modal panel structure: `frontend/src/features/envelope/components/CondensationRiskModal.tsx`
- Criterion port + tests: `phius-rules/rulesets/phius-2024-r1/calculators/window-comfort/`

## Rules source

The criterion, its exemptions and the accepted data routes live in the
`phius-rules` corpus, not in this repo:
`rulesets/phius-2024-r1/` — `N-3`, `1.3.3.3`, `1.4.2.6`, `checklists/windows.md`.
Do not re-derive them from the Phius PDFs.
