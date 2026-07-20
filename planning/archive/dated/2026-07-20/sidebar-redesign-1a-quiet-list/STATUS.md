---
DATE: 2026-07-20
TIME: 18:05 EDT
STATUS: Complete — all 5 phases implemented, verified, and closed out on branch
AUTHOR: Claude (Opus 4.8)
SCOPE: Current state / evidence for the 1A sidebar redesign.
RELATED: README.md, PRD.md, PLAN.md, decisions.md, research.md
---

# STATUS

**State:** Complete. All five phases (00–04) implemented and verified on
`feature/sidebar-redesign-1a-quiet-list`. Merge to `main` and production deploy
are Ed's call (Render auto-deploy is off).

## What shipped (the 1A "Quiet List" restyle of the shared `ElementSidebar`)
- **Phase 00** — added the neutral `--sidebar-row-hover` token to
  `styles/tokens.css`; confirmed the 1A→token mapping (no new font sizes).
- **Phase 01** — borderless ghost header buttons (scoped, global `.icon-button`
  untouched); two-tab `Alphabetical / Manual` underline order control
  (`role="tablist"`/`role="tab"`), "Order" label dropped.
- **Phase 02** — 40px rows; hover (neutral wash) split from selection (teal-only
  `--accent-light`); action cluster moved to an absolutely-pinned ghost group
  that fades in over a gradient scrim; dark `<Tooltip>` removed from row
  link/actions in favor of native `title` (header buttons keep their tooltip).
- **Phase 03** — hover-reveal drag grip; groups as label+hairline-rule dividers
  (collapse chrome dropped, `collapsed_group_ids` field preserved per D-5);
  quiet ghost "New group" (default label "Untitled group"); reduced-motion block.
- **Phase 04** — parity confirmed on both routes via browser smoke; docs
  refreshed; closeout gate passed.

## Decisions applied
- **D-2** — Envelope "Change type": KEPT as the 4th ghost button in the row
  cluster (confirmed rendering in `after-05`).
- **D-3** — Aperture rows: ICONLESS (reserved slot empty).
- D-1, D-4, D-5, D-6, D-7 implemented as recommended (see `decisions.md`).

## Bug found & fixed during smoke (regression-guarded)
The "New group" button used `onClick={organization.onAddGroup}`, so React passed
the click event as `onAddGroup`'s optional `label` argument — the SyntheticEvent
became the group's label and crashed the render. Pre-existing; the mocked tests
never exercised the real handler. Fixed by wrapping the handler
(`onClick={() => organization.onAddGroup()}`) and asserting
`toHaveBeenCalledWith()` (no args). Commit `11a4a861`.

## Verification evidence
- `make ci` green (backend + frontend) at each substantial phase and at closeout.
- `pnpm run check:all` (hex / css-vars / typography zero-debt / z-index / shape /
  sizes) green; `make typography-eval` — no new variants.
- Focused tests updated + green: `ElementSidebar.test.tsx` (tab roles, native
  title, always-expanded groups, New-group no-arg), `EnvelopePage.test.tsx`
  (native title, not portalled tooltip), `sidebar_views`, aperture adapter.
- Closeout: `/simplify` (4-agent) applied the tab-map dedup; two other
  candidates skipped by decision (AppSubTabs reuse — blast radius + stable-id
  contract; cluster merge — divergence is context-correct). `/docs-pass` synced
  `context/ui/pages/{envelope,apertures}-tab.md` + DESIGN_SYSTEM inventory.
- Browser smoke (`agent-browser.mjs`, signed in via the AGENT-BROWSER fixture),
  screenshots in `assets/`:
  - `after-02-envelope-alphabetical.png` — ghost header, two-tab underline,
    typed row icons.
  - `after-03-envelope-selected.png` — teal-only selection, others recede.
  - `after-04-envelope-manual.png` — faint reserved grips + ghost "New group".
  - `after-05-envelope-group-divider.png` — Untitled/Ungrouped label+rule
    dividers, empty-group placeholder, and a hovered row showing the scrim
    action cluster (move-select + Rename/Change-type/Duplicate/Delete → D-2/D-6).

## Residual / deferred (non-blocking)
- **Auto-inline-edit on group create** — 1A §8 says a new group should open in
  inline edit. Deferred: it crosses from restyle into behavior plumbing
  (surfacing the created group id into `GroupedList`'s edit state). The label is
  aligned ("Untitled group"); auto-edit is a future nicety.
- **Collapsible groups ("1B")** — chrome hidden, `collapsed_group_ids` preserved
  so 1B needs no migration.
- **Aperture-type icons** — deferred (D-3); reserved slot kept for later.
- Viewer/locked read-only calm-list rendering is covered by the "no organization
  renders no sort tabs" component test (not a separate browser capture).

## Next step
Ed's call: merge `feature/sidebar-redesign-1a-quiet-list` to `main`, then deploy
via the "Deploy Production" workflow.
