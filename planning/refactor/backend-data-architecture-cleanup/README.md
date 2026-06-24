---
DATE: 2026-06-24
TIME: 18:05 EDT
STATUS: Active — planning. No code changed yet.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Router for the backend data-architecture cleanup refactor.
RELATED:
  - planning/code-reviews/2026-06-24/backend-data-architecture-review.md (source findings)
  - context/DATA_STORAGE.md, context/TECH_STACK.md, context/CODING_STANDARDS.md
  - context/technical-requirements/data-model.md, save-versioning.md, llm-mcp-schema.md
---

# Backend Data-Architecture Cleanup — Router

This refactor turns the 2026-06-24 backend data-architecture review into
executable, phased work. It exists to **use the current no-backwards-compat
window** (no real users, no real DB, no deploy) to make the backend data
shapes and patterns as clean, consistent, and extensible as possible *before*
the first real save makes clean cuts expensive.

## The thesis (read this first)

> We can change **any** data shape we want, right now, for free. The moment a
> real project is saved on the remote DB, that freedom ends. So: front-load
> every clean-cut shape change and accreted-cruft deletion now; defer only the
> machinery whose value depends on data existing (the schema-migration shim
> chain, observability/APM). Priority order, in Ed's words: **consistency,
> cleanliness, maintainability, extensibility** — performance and observability
> are secondary and tracked separately (Phase 6).

## Read order

1. `PRD.md` — why, the no-backcompat principle, scope (in/out), success criteria.
2. `decisions.md` — the handful of forks that shape the phases, with
   recommendations. **Confirm these before Phase 3+ starts.**
3. `PLAN.md` — the phase map, dependency graph, and sequencing constraints
   (incl. the in-flight aperture WIP hazard).
4. `STATUS.md` — current state, next step, blockers.
5. `phases/phase-NN-*.md` — load only the phase in hand.

## Phase map (one line each — full detail in `PLAN.md` / each phase doc)

| Phase | Title | Theme | WIP-safe now? |
|---|---|---|---|
| 1 | Repository & layer consistency | consistency | mostly (coordinate `assets`) |
| 2 | Module splits | maintainability | yes (non-aperture files) |
| 3 | Document schema cleanup | cleanliness | **after aperture WIP lands** |
| 4 | ~~Unify the table-write architecture~~ → **promoted to its own refactor** | extensibility | see below |
| 5 | Relational clean baseline (migration squash) | cleanliness | near-last |
| 6 | Pre-deploy operational hardening (pool + observability) | operational | independent track |
| 7 | Schema-migration mechanism | *deferred gate* | **pre-first-deploy only** |

> **Sibling refactor (D5).** The table-write-architecture unification (old
> Phase 4) was promoted to `planning/refactor/table-write-architecture-unification/`
> because it is cross-stack (heat-pumps frontend rewire) and a distinct concern.
> `phases/phase-04-*.md` here is a redirect stub; the phase numbers 05/06/07 are
> retained for stable references.

## What this refactor is NOT

- Not a re-architecture. The review's headline conclusion stands: the
  **JSONB-document + thin-relational shape is correct — keep it.** This is
  cleanup *within* that architecture, not a move away from it.
- Not a perf project. Cheap perf fixes ride along where they touch the same
  files; nothing here is driven by a measured perf problem.
- Not a feature. No user-visible behavior changes are intended (except the
  body-size 413 guard and any deliberate data-shape simplifications, which are
  invisible pre-deploy).
