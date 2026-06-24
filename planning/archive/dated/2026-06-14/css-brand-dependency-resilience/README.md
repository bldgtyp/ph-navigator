---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Complete — both items built, verified, merged to main 2026-06-14. Archived.
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: P4 of the 2026-06-14 CSS review — strategic decisions (Themes 8 & 10)
RELATED:
  - ../../code-reviews/2026-06-14/frontend-css-styling-review.md  (Themes 8 & 10; backlog items 11–12)
  - ../css-rationalization/  (parent effort — P0–P2 done & archived)
  - ../css-structure-discoverability/  (P3 — done & archived; reconciled this feature's TECH_STACK doc tail)
---

# CSS — Brand-Dependency Resilience & Doc Reconciliation (P4)

> **STATUS: Complete & archived (2026-06-14).** Both items shipped and
> merged to `main`; `make ci` green; offline render verified. See
> [`STATUS.md`](STATUS.md) for the implementation summary. One small
> doc-reconciliation tail (reconcile `context/TECH_STACK.md`; cross-link
> the `styles/README.md` from `UI_UX.md`) was handed to P3 and is now
> **done** —
> [`../css-structure-discoverability/`](../css-structure-discoverability/)
> (built & archived).

The fourth (strategic) tranche from the **2026-06-14 frontend CSS/styling
review**. Both items were **DECIDED on 2026-06-14** and **built the same
day** — this folder was pulled out of the archived
[`css-rationalization`](../css-rationalization/) backlog so the work
wasn't lost, then executed and archived in turn.

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

Both items shipped 2026-06-14 (Item 2's `UI_UX.md` §design-system + PRD §12
reconciliation, and Item 1's vendored tokens + self-hosted fonts + sync
script). The `TECH_STACK.md` reconciliation tail and the
`UI_UX.md` → `styles/README.md` cross-link were handed to P3 and are now
**done** ([`../css-structure-discoverability/`](../css-structure-discoverability/),
built & archived). See [`STATUS.md`](STATUS.md) for the full outcome.
