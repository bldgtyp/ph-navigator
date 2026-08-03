---
DATE: 2026-08-03
STATUS: Complete
AUTHOR: Codex with Ed May
SCOPE: Rename Status to Overview and replace its record tree with counts-only
  Documentation progress meters.
RELATED:
  - ../PLAN.md
  - ../PRD.md
  - ../decisions.md
---

# Phase 04 — Overview rollup

## Outcome

`overview` is the default project tab. Legacy `status` URLs redirect with
suffix/search/hash preservation. Roadmap remains independent; the right pane
uses draft/saved `documentation-rollup` endpoints containing only section and
group counts/anchors. Section and group meters deep-link to Documentation's
URL filters and anchors, with session-scoped section disclosure.

## Verification evidence

- Backend rollup projection and access tests passed (7 focused tests total).
- Frontend router/component tests passed (36 focused tests total); production
  build passed.
- Editor browser: Overview and Documentation both showed Equipment `0/1` on
  Spec. Status, Datasheets, and Site Photos; Ventilators disclosure matched.
- Legacy `/status/detail?needs=photo#equipment` redirected to
  `/overview/detail?needs=photo#equipment`.
- Anonymous browser: Overview used saved data, displayed read-only chrome, and
  exposed no Roadmap edit controls.
- Three-lens simplify review consolidated axis/count helpers, hardened and
  project-keyed disclosure persistence, and closed all owning-surface cache
  invalidation gaps. The proposed direct count traversal was not adopted:
  this phase's accepted contract explicitly reuses the Documentation builders
  and strips records at the response boundary.
- Docs pass updated the current Overview, workspace, and dashboard contracts.
- Full CI passed: backend 1,832 passed / 7 skipped; frontend 2,397 passed;
  production build and static gates green.

## Invariants

- The Overview response contains no `records` key.
- Empty sections/groups do not render.
- Roadmap and Documentation progress failures do not blank each other.
