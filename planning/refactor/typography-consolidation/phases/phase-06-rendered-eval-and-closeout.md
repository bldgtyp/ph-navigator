---
DATE: 2026-07-17
TIME: afternoon ET
STATUS: Not started
AUTHOR: Codex
SCOPE: Hermetic rendered-contract evaluator, CI workflow, final visual audit,
  canonical docs reconciliation, and archive closeout
DEPENDS_ON: Phase 5
RELATED:
  - `../PRD.md`
  - `../TYPOGRAPHY-CONTRACT.md`
  - `../../../code-reviews/2026-07-17/font-audit/REPORT.md`
---

# Phase 6 — Rendered evaluation, CI, and closeout

## Goal

Prove semantic role consistency in the actual cascade, make the proof
repeatable, and leave the live documentation and CI controls able to prevent a
repeat of the original drift.

## Build

1. Add `font-audit-eval.mjs` (or equivalent) that consumes sweep JSON and a
   checked-in rendered contract. It exits non-zero on contract failure.
2. Assert exact state-manifest coverage; a failed/skipped state is a test
   failure, not a partial report.
3. Enforce PRD invariants: approved families/token-mapped sizes/weights,
   tracking, role budgets, modal-role reuse, exception IDs, and total variant
   ceiling.
4. Make the fixture hermetic: seed a stable project/user/grants/state through
   the supported test/seed pipeline. Remove dependence on a hand-granted local
   user, a fixed stale UUID, and an accidental recovered-draft modal.
5. Add `make typography-eval` for local use. Create a GitHub Actions workflow
   with `workflow_dispatch` and a scheduled run that boots the required
   services, runs the sweep/evaluator, and uploads JSON/report/screenshots.
6. After three consecutive reproducible workflow runs, decide whether runtime
   is acceptable for required PR CI. Static `check:typography` remains the
   required every-PR control regardless.
7. Regenerate the after report as `REPORT-after.md` without overwriting the
   baseline. Record a PRD exit-criteria table and screenshot links in
   `STATUS.md`.
8. Reconcile `frontend/src/styles/README.md`, `context/UI_UX.md`, and
   `context/CODING_STANDARDS.md` with final token values, roles, exception
   process, commands, and CI behavior.
9. Run `simplify` and `docs-pass`, then archive the packet per
   `planning/.instructions.md` after merge.

## Verification

- Full sweep collects every declared state and evaluator passes.
- Baseline report remains unchanged; `REPORT-after.md` records the new result.
- All PRD exit criteria pass with explicit evidence.
- Scheduled/manual workflow succeeds from a clean checkout with no manual DB
  grants or browser intervention.
- `pnpm run check:typography`, `make typography-eval`, `make format`, and
  `make ci` pass.

## Done when

The static and rendered controls are reproducible, canonical docs match the
implemented system, all visual evidence is recorded, the work is merged, and
the packet is archived.
