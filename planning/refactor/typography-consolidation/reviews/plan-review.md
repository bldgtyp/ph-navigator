---
DATE: 2026-07-17
TIME: afternoon ET
STATUS: Complete
AUTHOR: Codex
SCOPE: Review of the initial typography-consolidation packet against the
  rendered audit, current CSS ownership, styling documentation, and CI guards
RELATED:
  - `../README.md`
  - `../PRD.md`
  - `../PLAN.md`
  - `../../../../planning/code-reviews/2026-07-17/font-audit/REPORT.md`
---

# Typography consolidation — plan review

## Outcome

The initial packet had the right product goal and a useful rendered baseline,
but it was not yet implementation-ready. The revised packet keeps the target
role system and replaces the five-item outline with an ownership-based,
six-phase implementation sequence. It also makes anti-drift enforcement a
first-phase deliverable rather than a closeout task.

## Findings

### P0 — the proposed lint scope was much larger than the phase worklists

The rendered audit found 55 variants across 1,707 visible elements. Static
source inventory tells a different, complementary story: excluding vendored
brand CSS, the current tree contains 398 `font-size`, 180 `font-weight`, 93
`letter-spacing`, 111 `font-family`, and 94 `line-height` declarations.
`font-size` is already tokenized in 340 of 398 declarations, but no weight or
tracking declarations use tokens yet.

The original plan named the visible outliers but did not partition the full
source migration implied by a guard that rejects every literal weight and
tracking value. A Phase 5 "long tail" would therefore have hidden hundreds of
edits and many states not reached by the 22-state browser fixture.

**Resolution:** Phase 1 creates a machine-readable debt baseline and a ratchet.
Phases 2–5 retire that baseline by CSS owner, including selectors not reached
by the rendered audit. The final baseline must be empty.

### P0 — warn-only enforcement would permit new drift during the migration

A warning in Phase 1 and an error in the final phase leaves the app unprotected
for the longest part of the work. It also makes review dependent on noticing
console output.

**Resolution:** the new source guard is blocking from its first merge. Existing
violations are accepted only when their normalized fingerprints appear in a
checked-in debt baseline. Any new violation fails CI. Resolved baseline entries
also fail until the baseline is reduced, so debt can only move downward.

### P0 — source lint and rendered evaluation answer different questions

A token-only source rule can prove that values come from the approved
vocabulary. It cannot prove that a selector uses the correct role; a modal
button could use a valid table-header token and still be wrong. Conversely, the
rendered sweep cannot see dormant selectors, responsive states, pseudo-elements,
or routes absent from its fixture.

**Resolution:** retain both controls:

1. Blocking static guard in every `pnpm run check:all` / PR CI run.
2. Computed-style evaluation for role budgets, coverage, and rendered
   exceptions. It becomes a hermetic scheduled/manual workflow in Phase 6 and
   a required local closeout gate for typography changes.
3. Targeted screenshots remain human visual evidence; they are not the
   machine-readable contract.

### P1 — role-based phases would repeatedly churn the same owners

The original phases separately addressed shared chrome, buttons, headings,
modals, and the long tail. In practice those concerns repeatedly reopen
`base.css`, `DataTable.css`, and feature sheets. That raises cascade risk and
makes phase attribution unclear.

**Resolution:** migrate by CSS ownership boundary. Each stylesheet is assigned
to one migration phase; role outcomes are verified after that owner is done.

### P1 — the styling guide currently leaves the drift path open

`frontend/src/styles/README.md` says em font sizes are intentional, while the
audit identifies em-of-em compounding as a direct cause of off-scale output.
It has no canonical role table, weight/tracking/line-height tokens, exception
process, or prohibition on feature-local overrides of shared primitives.

**Resolution:** `TYPOGRAPHY-CONTRACT.md` defines the proposed authoring rules.
Phase 1 folds the active rules into the canonical styling guide and
`context/UI_UX.md`; Phase 6 reconciles final decisions and enforcement details.

### P1 — literal allowlists are the wrong default for design exceptions

The initial packet proposed allowing raw values for the sign-in display heading
and canvas annotations. That prevents the guard from distinguishing a deliberate
role from an accidental copy of the same value.

**Resolution:** intentional exceptions receive named semantic tokens (for
example, auth display and canvas annotation roles). The exception registry is
for unavoidable technical/library boundaries, not a shortcut around the token
system.

### P1 — the tracking baseline was understated

The rendered report contains nine non-zero tracking values (`0.04`, `0.05`,
`0.06`, `0.08`, `0.09`, `0.10`, `0.12`, `0.13`, and `0.15em`), not four.

**Resolution:** the PRD and status now use the report-derived count. Phase 1
also makes the report/evaluator, rather than prose, the numeric source of truth.

## Recommended control model

| Control | Runs | Proves | Does not prove |
| --- | --- | --- | --- |
| `check:typography` | every PR and `frontend-dev-check` | approved tokens, no new source debt, no undocumented inline type styles | correct semantic role or visual fit |
| `typography-eval` | typography closeout; scheduled/manual CI | rendered families/sizes/weights/tracking, role budgets, state coverage | subjective hierarchy or clipping |
| screenshot set | each visual migration phase | hierarchy, density, clipping, control geometry | whole-repo source compliance |

## Planning decision

Proceed with the six phases in `PLAN.md`. Do not start selector migration
before Phase 1's contract, baseline, and blocking ratchet exist.
