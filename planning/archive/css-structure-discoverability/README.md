---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Complete & archived (2026-06-14). Structure, discoverability,
  leaked-CSS promotion, the first god-stylesheet split, the .css size cap, and
  the TECH_STACK/UI_UX doc reconciliation all landed. The judgment-heavy tail
  (color-literal token sweep + check:hex extension + scale design pass) was
  carved out to ../css-token-guard-sweep/.
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: P3 of the 2026-06-14 CSS review — structure & discoverability
RELATED:
  - ../../code-reviews/2026-06-14/frontend-css-styling-review.md  (canonical findings; Themes 7 & 9, backlog items 9–10)
  - ../../archive/css-rationalization/  (parent effort — P0–P2 done & archived)
  - ../../archive/css-brand-dependency-resilience/  (P4 — done & archived; left a small doc-reconciliation tail here, PRD §4)
  - ../css-token-guard-sweep/  (the carved-out color-sweep + scale tail)
  - ../../code-reviews/2026-06-14/scopes/scope-A-global-tokens.md  (global layer detail)
  - ../../features/report-tables/  (the gold-standard co-located shared-UI pattern propagated here)
---

# CSS — Structure & Discoverability (P3)

> **STATUS: Complete & archived (2026-06-14).** The discoverability + structure
> work shipped: `frontend/src/styles/README.md` (token + shared-class catalog,
> import strategy, "how to style a new feature", god-stylesheet split plan), a
> `shared/ui/index.ts` barrel, one import strategy with the 6 double-imports
> removed, promotion of the leaked shared CSS (`.sr-only` → `reset.css`; the
> card-panel recipe → `styles/panels.css`; `attachments.css` → `shared/ui/`),
> the InlineHeaderNameEditor dependency inversion (now a
> `data-reveal-edit-on-hover` opt-in), the first cascade-safe `base.css` split
> (`reset.css` + `base-responsive.css`), and a `.css` line-size guard.
> `TECH_STACK.md` and `UI_UX.md` were reconciled off Tailwind/shadcn.
> **Carved out** (needs Ed's eye + per-literal browser verification): the
> `rgb/hsl` color-token sweep, the `check:hex` → `rgb/hsl`/`.ts` extension, and
> the spacing/type/radius design pass →
> [`../css-token-guard-sweep/`](../css-token-guard-sweep/).
> `TablePrimitiveStub.tsx` was found to be dead code (zero importers) and
> subsequently deleted in a follow-up commit.

The third remediation tranche from the **2026-06-14 frontend CSS/styling
review**. P0–P2 (correctness, token scales, chips, SVG color, canvas-widget
extraction) all landed on `main` and were archived under
[`../../archive/css-rationalization/`](../../archive/css-rationalization/).
P3 was pulled out of the archived backlog and **built on 2026-06-14** (see the
status banner above for the carve-out).

P3 is the review's **owner goal #3**: "Can downstream feature authors easily
find, access, and use the standard styles?" Before P3 the answer was *no* —
there was no map. This tranche made the standard styles discoverable
(`frontend/src/styles/README.md`) and untangled the import/structure mess.

## Read order

1. This README (scope).
2. [`PRD.md`](PRD.md) — the work items, evidence, and acceptance criteria.
3. [`STATUS.md`](STATUS.md) — current state + suggested first step.
4. The canonical findings:
   [`../../code-reviews/2026-06-14/frontend-css-styling-review.md`](../../code-reviews/2026-06-14/frontend-css-styling-review.md)
   Themes **7** (architecture/structure), **9** (discoverability), and
   backlog items **9–10**.

## Two work streams

- **Discoverability** (Theme 9, HIGH for goal #3): a `styles/README.md`
  token + shared-class catalog + "how to style a new feature" recipe; a
  `shared/ui/index.ts` barrel; propagate the `report-table/` co-located
  pattern across `shared/ui`.
- **Structure** (Theme 7, MED): pick one CSS import strategy (kill the 6
  double-imports), promote genuinely-shared CSS out of feature files, invert
  shared→feature selector dependencies, and begin splitting the `base.css`
  (~1,967 lines) and `DataTable.css` (2,830 lines) god-stylesheets behind a
  new `.css` line-size guard.

A small set of **deferred guard/scale follow-ups** (extend `check:hex`, add a
`.css` size cap, tighten the spacing/type scales, fold the last literal
radii) belong with this work because they only become green-able once the
split/sweep cleans up the pre-existing literals. See PRD §3.

A **doc-reconciliation tail from P4** also lands here: reconcile
`context/TECH_STACK.md` to the bespoke-CSS reality, and cross-link the new
`styles/README.md` from `context/UI_UX.md` §design-system. See PRD §4.

## Precedent already in the tree

Phase 7 (P2.7) seeded the direction: `shared/ui/report-table/` and the new
`shared/ui/info-tooltip/` both follow co-located-CSS + barrel + doc-ref.
`shared/ui/canvas/` was added as a shared home. P3 generalizes that pattern
and documents it.
