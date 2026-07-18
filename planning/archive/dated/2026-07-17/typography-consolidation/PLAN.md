# Typography consolidation — implementation plan

- DATE: 2026-07-17
- TIME: 12:38
- STATUS: ✅ Complete 2026-07-17 (all 6 phases; see STATUS.md)
- AUTHOR: Claude (Fable 5) with Ed May
- REVISED: 2026-07-17 afternoon ET by Codex
- SCOPE: Phase sequence for PRD.md; each phase independently shippable
- RELATED: `PRD.md`, `planning/code-reviews/2026-07-17/font-audit/REPORT.md`

Work on a feature branch and keep `main` deployable. The implementation order
is mandatory because Phase 1 establishes the guard used to control every later
phase.

## Operating rules

1. Migrate by CSS owner, not by whichever visible selector is easiest. Each
   owner is assigned to one phase.
2. The Phase 1 guard is blocking immediately. The checked-in baseline may only
   shrink; never refresh it to bless new debt.
3. Use the static inventory as the source worklist and the rendered audit as
   the semantic/cascade check. Neither substitutes for the other.
4. During a phase, run focused scanner/tests, `make frontend-dev-check`, and
   focused browser states. Before marking that phase complete, run
   `make format` and `make ci` and record evidence in `STATUS.md`.
5. Do not overwrite the baseline `REPORT.md`. Final output is
   `REPORT-after.md`.
6. Run `simplify` and `docs-pass` at overall closeout, after the final
   implementation phase and before archive.

## Phase sequence

| Phase | Plan | Exit signal |
| --- | --- | --- |
| 1 | `phases/phase-01-contract-and-ratchet.md` | new typography debt fails CI; current debt is reproducibly fingerprinted |
| 2 | `phases/phase-02-shared-primitives.md` | shell/buttons/headings/forms/modals use shared roles |
| 3 | `phases/phase-03-data-surfaces.md` | DataTable/ReportTable/catalog owners compliant without density regression |
| 4 | `phases/phase-04-technical-workspaces.md` | aperture/envelope/canvas owners compliant; exceptions token-backed |
| 5 | `phases/phase-05-remaining-features.md` | source debt baseline empty |
| 6 | `phases/phase-06-rendered-eval-and-closeout.md` | hermetic evaluator and docs/CI controls complete; all PRD criteria pass |

## Commit boundaries

Each phase is independently reviewable. Within Phases 3–5, use one commit per
large owner (`DataTable.css`, apertures/envelope, model viewer) so visual or
cascade regressions can be isolated without reverting the guard or contract.

## Scope control

Typography class wiring is in scope. Color, borders, spacing, and component
behavior are not, except for surgical adjustments needed to prevent clipping
or geometry regressions caused by an accepted typography change. Record any
broader design issue as a follow-up rather than folding it into this refactor.
