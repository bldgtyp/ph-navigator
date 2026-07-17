# Typography consolidation — status

- DATE: 2026-07-17
- TIME: 12:38
- STATUS: Active
- AUTHOR: Claude (Fable 5) with Ed May
- REVISED: 2026-07-17 afternoon ET by Codex
- SCOPE: Execution state for this packet
- RELATED: `PRD.md`, `PLAN.md`

## Current state

Packet reviewed and expanded from the 2026-07-17 font audit
(`planning/code-reviews/2026-07-17/font-audit/`). Baseline: **55 rendered
variants**, 9 off-scale/invalid entries, weights 550/650, and 9 non-zero
tracking values. Static preflight also shows the migration is broader than the
rendered sample: 398 font-size declarations (340 token-based), 180 weights,
93 tracking declarations, 111 families, and 94 line heights outside vendored
brand CSS. Parser-derived Phase 1 inventory will replace these preflight
counts as the source baseline. No implementation started.

## Next step

Phase 1 (`phases/phase-01-contract-and-ratchet.md`): resolve D1–D5, add the
token/role contract, and land a blocking no-new-debt CI ratchet before visual
migration. Proposed defaults apply unless Ed overrides; record outcomes here
and in `PRD.md` when confirmed.

## Phase ledger

| Phase | State | Variant count after | Evidence |
| --- | --- | --- | --- |
| 1 — Contract + ratchet | Not started | — (baseline 55) | Plan complete |
| 2 — Shared primitives | Not started | — | — |
| 3 — Data surfaces | Not started | — | — |
| 4 — Technical workspaces | Not started | — | — |
| 5 — Remaining features / zero debt | Not started | — | — |
| 6 — Rendered eval + closeout | Not started | — | — |

## Blockers

None.

## Planning review

`reviews/plan-review.md` records the initial packet gaps and adopted changes:
day-one blocking ratchet, owner-based migration, token-backed exceptions, and
separate static/rendered controls.

## Verification notes

Sweep prerequisites (fixture login, local `catalog.edit` +
`admin.users.manage` grants for codex@example.com, recovered-draft-modal
`Close` quirk) are documented in the audit README — re-grant after any dev-DB
reset or the admin states regress to "NOT AUTHORIZED".
