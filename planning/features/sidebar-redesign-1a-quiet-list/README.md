---
DATE: 2026-07-20
TIME: 17:40 EDT
STATUS: Active — planning complete, awaiting Ed's sign-off on open decisions
AUTHOR: Claude (Opus 4.8)
SCOPE: Router for the 1A "Quiet List" sidebar redesign feature.
RELATED: context/DESIGN_SYSTEM.md, frontend/src/shared/ui/element-sidebar/
---

# Sidebar Redesign — 1A "Quiet List"

Apply the Claude-Design **Direction 1A "Quiet List"** to the shared element-list
sidebar used by the **Envelope → Assemblies** and **Apertures → Builder** pages.

## The one thing to know

**This is a restyle of ONE already-shared component** (`shared/ui/element-sidebar/`),
not a new feature. Sort mode (A–Z / Manual), dnd-kit drag-reorder, and groups
already ship and persist (in the per-user `user_sidebar_views` JSONB table). There
is **no domain-document schema migration and no new backend command.** The "loud"
before-state in the handoff is the real running app. See `research.md`.

## Read order

1. `research.md` — code-verification map (what exists, where, and every 1A→code delta).
2. `PRD.md` — behavior contract (1A reconciled to app tokens + guardrails).
3. `decisions.md` — open decisions (★ D-2, D-3 want Ed's call).
4. `PLAN.md` — phase map + sequencing rationale + risks.
5. `phases/phase-00..04` — implementation detail per phase.
6. `STATUS.md` — current state / next step.

## Source material (preserved in `assets/`)

- `1A-Quiet-List-Handoff.md` — the Claude-Design engineering spec (pixel source-of-truth).
- `Sidebar-Redesign-reference.dc.html` — interactive reference (option "1a").
- `before-01-alphabetical.png`, `before-02-manual.png` — current app (the "loud" state).
- `target-1a-01-alphabetical.png`, `target-1a-02-manual.png` — the 1A target.

## Phase map

| Phase | Title |
| --- | --- |
| 00 | Tokens & foundations |
| 01 | Header ghost buttons + two-tab Order control |
| 02 | Rows: density, neutral-hover/teal-selection, quiet action cluster, kill dark tooltip |
| 03 | Manual mode: hover-reveal grip, group dividers, ghost New group, reduced-motion |
| 04 | Parity, browser smoke, docs-pass, closeout |

## Primary files the implementation touches

- `frontend/src/shared/ui/element-sidebar/` — `ElementSidebar.tsx`, `rows.tsx`,
  `GroupedList.tsx`, `element-sidebar.css`, `types.ts`, `__tests__/`.
- `frontend/src/styles/tokens.css` — the few new tokens (Phase 00).
- `frontend/src/features/{envelope,apertures}/components/*Sidebar.tsx` — adapters
  (only the D-2/D-3 deltas).
- `context/ui/pages/{envelope,apertures}-tab.md`, `context/DESIGN_SYSTEM.md` — docs.

**Not touched:** any backend, the project document schema, `sidebar_views`
persistence contract, the assembly canvas, report tables.
