# Typography consolidation — router

- DATE: 2026-07-17
- TIME: 12:38
- STATUS: Active
- AUTHOR: Claude (Fable 5) with Ed May
- SCOPE: Site-wide CSS/typography consolidation driven by the 2026-07-17
  rendered-typography audit; all pages, modals, headers, buttons, dropdowns,
  tables, labels
- RELATED: `planning/code-reviews/2026-07-17/font-audit/` (audit + REPORT),
  `frontend/src/styles/tokens.css`, `frontend/scripts/font-audit-sweep.mjs`

## What this is

The 2026-07-17 audit measured **55 unique rendered typography variants**
across 22 page/modal states (7 off-scale sizes, weights 550/650, four
uppercase tracking values, one raw `monospace` leak). This packet reduces the
app to a minimum set of typography roles on the existing token scale,
centralizes the CSS, and adds enforcement so drift cannot silently return.

## Read order (implementation agent)

1. `PRD.md` — target type system, role map, open decisions, exit criteria.
2. `PLAN.md` — phase sequence; each phase is independently shippable and
   verified with the font-audit sweep.
3. `STATUS.md` — current state and next step. Keep it updated per phase.
4. Reference data: `planning/code-reviews/2026-07-17/font-audit/REPORT.md`
   (every variant with selectors/pages) and per-state JSONs regenerable via
   `frontend/scripts/font-audit-sweep.mjs` (see the audit README for setup —
   fixture login, local grants, recovered-draft modal quirk).

## Phase map

| Phase | Scope | Risk |
| --- | --- | --- |
| 1 | Foundations: weight/tracking tokens, reset gaps, lint (warn) | low |
| 2 | Shared chrome: DataTable, app shell, catalog toolbar | medium |
| 3 | Buttons: consolidate ~25 variants → 4 tiers | medium |
| 4 | Modals + headings alignment | medium |
| 5 | Long tail, lint → error, final sweep vs exit criteria | low |

## Verification (all phases)

```bash
make agent-browser-ready
cd frontend && node scripts/font-audit-sweep.mjs && \
  node scripts/font-audit-aggregate.mjs --out /tmp/font-report.md
```

Compare against the exit criteria in `PRD.md` §Exit criteria and the
baseline `REPORT.md`.
