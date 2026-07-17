# Typography consolidation — router

- DATE: 2026-07-17
- TIME: 12:38
- STATUS: Active
- AUTHOR: Claude (Fable 5) with Ed May
- REVISED: 2026-07-17 afternoon ET by Codex
- SCOPE: Site-wide CSS/typography consolidation driven by the 2026-07-17
  rendered-typography audit; all pages, modals, headers, buttons, dropdowns,
  tables, labels, source guardrails, and rendered-contract evaluation
- RELATED: `planning/code-reviews/2026-07-17/font-audit/` (audit + REPORT),
  `frontend/src/styles/tokens.css`, `frontend/scripts/font-audit-sweep.mjs`

## What this is

The 2026-07-17 audit measured **55 unique rendered typography variants**
across 22 page/modal states (7 off-scale sizes, weights 550/650, nine non-zero
tracking values, one raw `monospace` leak). This packet reduces the app to a
minimum set of typography roles on the existing token scale, centralizes role
ownership, and adds both source and rendered enforcement so drift cannot
silently return.

## Read order (implementation agent)

1. `reviews/plan-review.md` — gaps found in the initial outline and the
   resulting control/phase design.
2. `PRD.md` — target type system, role map, open decisions, exit criteria.
3. `TYPOGRAPHY-CONTRACT.md` — proposed authoring, ownership, exception, and
   enforcement rules.
4. `PLAN.md` — phase sequence and cross-phase operating rules.
5. `phases/phase-*.md` — implementation-ready file scopes, steps, and
   verification for the active phase.
6. `STATUS.md` — current state and next step. Keep it updated per phase.
7. Reference data: `planning/code-reviews/2026-07-17/font-audit/REPORT.md`
   (every variant with selectors/pages) and per-state JSONs regenerable via
   `frontend/scripts/font-audit-sweep.mjs` (see the audit README for setup —
   fixture login, local grants, recovered-draft modal quirk).

## Phase map

| Phase | Scope | Risk |
| --- | --- | --- |
| 1 | Contract, token groups, debt inventory, blocking CI ratchet | low |
| 2 | Shared primitives: shell, buttons, headings, forms, modals | medium |
| 3 | Data surfaces: DataTable, ReportTable, catalogs, equipment | high |
| 4 | Technical workspaces: apertures, envelope, canvas/shared chrome | high |
| 5 | Remaining feature owners; reduce source debt to zero | medium |
| 6 | Hermetic rendered evaluator, CI workflow, docs/closeout | medium |

## Verification model

Every phase runs the blocking source guard introduced in Phase 1. Visual
migration phases run focused audit states and screenshots; Phase 6 runs the
full hermetic sweep and evaluator.

```bash
make agent-browser-ready
cd frontend && node scripts/font-audit-sweep.mjs && \
  node scripts/font-audit-aggregate.mjs --out /tmp/font-report.md
```

Compare against the exit criteria in `PRD.md` §Exit criteria and the baseline
`REPORT.md`. Do not overwrite the baseline; final output is
`REPORT-after.md`.
