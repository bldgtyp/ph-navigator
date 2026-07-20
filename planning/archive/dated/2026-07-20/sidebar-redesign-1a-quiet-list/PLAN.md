---
DATE: 2026-07-20
TIME: 17:25 EDT
STATUS: Complete — implemented + verified 2026-07-20 (see STATUS.md)
AUTHOR: Claude (Opus 4.8)
SCOPE: High-level implementation sequence for the 1A sidebar restyle.
RELATED: PRD.md, research.md, decisions.md, phases/
---

# PLAN — 1A "Quiet List" Sidebar Restyle

## Shape of the work

One shared component (`frontend/src/shared/ui/element-sidebar/`) + two thin
adapters. No backend, no schema, no new command. Almost all diff is in
`element-sidebar.css`, `ElementSidebar.tsx`, `rows.tsx`, `GroupedList.tsx`, plus
token additions in `styles/tokens.css` and small adapter/test touch-ups.

Because it is one component, the phases are **layered by visual concern**, each
independently shippable and independently verifiable, ordered so early phases
de-risk the token/guard story before the higher-touch interaction phases.

## Phase map

| Phase | Title | Touches | Gate |
| --- | --- | --- | --- |
| 00 | Tokens & foundations | `styles/tokens.css`, DESIGN_SYSTEM snapshot | `check:css-vars`, `check:hex` |
| 01 | Header ghost buttons + two-tab Order control | `ElementSidebar.tsx`, `element-sidebar.css`, tests | render + ARIA + CI |
| 02 | Rows: 40px, neutral hover / teal selection, quiet action cluster, kill dark tooltip | `rows.tsx`, `element-sidebar.css`, tests | render + a11y + CI |
| 03 | Manual mode: hover-reveal grip, groups-as-dividers, ghost New group, reduced-motion | `rows.tsx`, `GroupedList.tsx`, `ElementSidebar.tsx`, `element-sidebar.css`, tests | render + a11y + CI |
| 04 | Cross-page parity, adapter deltas, browser smoke, docs-pass, closeout | adapters, docs, screenshots | full `make ci` + gates |

Each phase ends with `make format`; substantial phases run `make ci`. The
closeout gate (CLAUDE.md) — `simplify` skill, `docs-pass` skill, `make format`,
`make ci` — runs at the end of Phase 04 (and `simplify` after each phase that
adds meaningful CSS/TSX).

## Sequencing rationale

- **00 first** so every later phase draws from resolved tokens and never trips
  `check:hex`. Isolates the "map 1A hexes → tokens / add the few new ones"
  decision into one reviewable diff with no behavior change.
- **01 before 02/03** because the header + order control are the lowest-risk,
  highest-visibility "quiet" wins and validate the ghost-button + tab pattern the
  rest reuses.
- **02 before 03** because manual mode (03) builds on the row shell finalized in
  02 (grip slot, action cluster geometry, selection/hover split).
- **04 last** — the shared component means both pages already have the look by
  then; 04 is verification, the two adapter deltas (D-2, D-3), tests, docs, and
  the closeout gate.

## Risk register

| Risk | Mitigation |
| --- | --- |
| `check:typography` zero-debt / 29-variant ceiling rejects a new size | Map every 1A px to an existing `--fs-*` step; run `make typography-eval` in Phase 02. No new font-size literals. |
| Splitting hover/selected bg regresses selected-state contrast | Snapshot before/after in browser smoke; keep `--accent-light` for selection. |
| Removing `<Tooltip>` breaks tests asserting tooltip text | Update `ElementSidebar.test.tsx` to assert `title`/`aria-label` instead. |
| Absolute action cluster overlaps label on narrow 260px rail | Gradient scrim + `:focus-within`; verify at 260px and mobile (`@media max-width:768px`, css L382). |
| Reduced-motion missed | Add `@media (prefers-reduced-motion: reduce)` block in Phase 03; verify with emulation. |
| Adapter deltas (change-type, aperture icons) block | Captured as D-2/D-3; defaults chosen so implementation is unblocked. |

## Verification per phase

Every phase: `make format`; `make frontend-dev-check` (fast gate). Phases 02-04:
`make ci`. Phase 04: browser smoke on both routes (`agent-browser.mjs`), a11y
(keyboard + reduced-motion), `simplify` + `docs-pass` skills, then the CLAUDE.md
closeout gate before marking Merged/Complete.
