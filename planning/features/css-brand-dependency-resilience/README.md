---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Deferred — decided, written up as backlog; not built.
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: P4 of the 2026-06-14 CSS review — strategic decisions (Themes 8 & 10)
RELATED:
  - ../../code-reviews/2026-06-14/frontend-css-styling-review.md  (Themes 8 & 10; backlog items 11–12)
  - ../../archive/css-rationalization/  (parent effort — P0–P2 done & archived)
  - ../css-structure-discoverability/  (P3 — sibling backlog)
---

# CSS — Brand-Dependency Resilience & Doc Reconciliation (P4)

The fourth (strategic) tranche from the **2026-06-14 frontend CSS/styling
review**. Both items were **DECIDED on 2026-06-14 but never built** — this
folder pulls them out of the archived
[`css-rationalization`](../../archive/css-rationalization/) backlog so they
aren't lost.

## The two decided items

1. **Vendor + self-host the brand assets** (Theme 8). The brand `tokens.css`
   and the Geist fonts are today **render-blocking runtime fetches** from
   `bldgtyp.github.io` + Google Fonts, with **no local fallback and no
   `var()` fallbacks**. Offline, in CI, if the brand site is down, or if a
   brand token is *renamed* upstream, `--accent` (101 uses), `--ease` (48
   uses) and every text/border/bg token collapse to initial values —
   **silently**, with no build error and no guard able to catch it.
   *Decision: vendor a pinned copy + self-host the fonts, with a sync
   script.*
2. **Reconcile the docs with the bespoke-CSS reality** (Theme 10).
   `context/UI_UX.md` §design-system and PRD §12 prescribe **Tailwind +
   shadcn/ui**; the app is in fact **hand-written plain CSS** with a 3-tier
   token system. The stale docs mislead new contributors and keep the
   shadcn-vocabulary "ghost tokens" reappearing. *Decision: update the docs
   to describe the bespoke-CSS reality; **no** migration.*

## Read order

1. This README (scope + decisions).
2. [`PRD.md`](PRD.md) — work items, evidence, acceptance criteria.
3. [`STATUS.md`](STATUS.md) — current state + next step.
4. Canonical findings:
   [`../../code-reviews/2026-06-14/frontend-css-styling-review.md`](../../code-reviews/2026-06-14/frontend-css-styling-review.md)
   Themes **8** and **10**, backlog items **11–12**.

## Note

The decisions are settled; this is an **execution** backlog, not an open
question. Item 2 (doc reconciliation) is small and can ship independently of
item 1.
