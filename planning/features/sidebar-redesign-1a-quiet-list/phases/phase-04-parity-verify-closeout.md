---
DATE: 2026-07-20
TIME: 17:38 EDT
STATUS: Not started
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 04 — cross-page parity, adapter deltas, browser smoke, docs-pass,
  closeout gate.
RELATED: ../PRD.md §5, ../decisions.md D-2/D-3, ../../../CLAUDE.md (closeout gate)
DEPENDS-ON: phase-00..03
---

# Phase 04 — Parity, Verification, Docs, Closeout

**Goal:** confirm both pages look/behave per 1A, resolve the two adapter deltas,
update stale docs, and pass the closeout gate.

## Tasks

### A. Adapter deltas
- **D-2 (envelope change-type):** default is keep the 4th ghost button. If Ed
  chose relocate, remove the `change-type` action from `EnvelopeSidebar.tsx`
  L60-65 and wire it into the assembly canvas `⋯` overflow instead.
- **D-3 (aperture icons):** default is iconless apertures. If Ed chose icons, add
  a `leadingIcon` mapping in `ApertureSidebar.tsx` and a stable type signal.
- Confirm viewer/locked rendering on both pages: no order tabs, no grip, no
  actions, no New group — calm read-only list.

### B. Browser smoke (both routes)
- Per `context/USING_A_WEB_BROWSER.md`: `make agent-browser-ready`, then
  `node frontend/scripts/agent-browser.mjs /projects/<id>/envelope/assemblies
  --out assets/smoke-envelope-*.png` and the apertures builder route. Capture:
  alphabetical, manual (with a group), a hovered row (actions + scrim), a selected
  row, collapsed/expanded sidebar, viewer mode. Save screenshots to `assets/`.
- Sign in per repo rule (`codex@example.com`); do not take over Ed's session
  (single-active-session). Catalog/sidebar data is fine to smoke as codex.

### C. Accessibility pass
- Keyboard: order tabs, action cluster (`:focus-within`), dnd keyboard sensor,
  group-assign select all reachable. `prefers-reduced-motion` honored.
- Optional: `chrome-devtools-mcp:a11y-debugging` skill or a Lighthouse a11y pass.

### D. Tests
- `frontend/src/shared/ui/element-sidebar/__tests__/ElementSidebar.test.tsx` —
  updated for tab roles, native title, divider markup, no collapse button,
  hover/selected split.
- `frontend/src/features/sidebar_views/__tests__/*` and aperture adapter tests —
  green (no behavior change expected).
- `backend/tests/test_sidebar_views.py` — untouched, green.

### E. Docs-pass (CLAUDE.md closeout)
- Update `context/ui/pages/envelope-tab.md` §2.7.2 and
  `context/ui/pages/apertures-tab.md` §2.6.1 to describe the shipped sidebar
  (sort modes, manual drag, groups) **and** the 1A look — they currently describe
  the pre-`ElementSidebar` simple list (research.md §7).
- Add an "Element sidebar" row to the `context/DESIGN_SYSTEM.md` component
  inventory; refresh the token snapshot + date if Phase 00 added tokens.
- Run the `docs-pass` skill on the full diff.

### F. Closeout gate (CLAUDE.md)
1. `simplify` skill on the full diff.
2. `docs-pass` skill.
3. `make format`.
4. `make ci` (green — fix and rerun until clean).
5. If `make format` changed files, re-inspect + rerun `make ci`.

## Done when
Both pages match 1A, deltas resolved, screenshots in `assets/`, docs updated,
closeout gate green. Then set STATUS → Implemented on branch / Merged to main and
archive per `planning/.instructions.md`.
