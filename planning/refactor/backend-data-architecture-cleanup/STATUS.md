---
DATE: 2026-06-24
TIME: 18:05 EDT
STATUS: Active — planning complete; D1/D2/D5 resolved. Phases 1/2/6 ready; 3/5 await WIP merge.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Current state, next step, blockers for the backend data-architecture cleanup.
RELATED: ./README.md, ./PRD.md, ./PLAN.md, ./decisions.md
---

# STATUS

## Current state

- **Planning docs written** (this folder). No code changed.
- Source of truth for findings:
  `planning/code-reviews/2026-06-24/backend-data-architecture-review.md`.
- Context-doc staleness from the review's §8 register: the `[FIXED]` items are
  done; the `[PENDING]` items are folded into Phase 1 (CODING_STANDARDS) and
  Phase 5 (remaining schema-doc reconciliation).

## Phase ledger

| Phase | State | Blocker |
|---|---|---|
| 1 — repo/layer consistency | `Ready` | none (coordinate `assets/registry.py` with WIP) |
| 2 — module splits | `Ready` | none (non-aperture files only) |
| 3 — document schema cleanup | `Blocked` | aperture v12 WIP must land (D2 resolved) |
| 4 — unify write architecture | `Promoted` | → `planning/refactor/table-write-architecture-unification/` (D5) |
| 5 — relational clean baseline | `Blocked` | run after Phase 3 (D1 resolved) |
| 6 — pre-deploy hardening | `Ready` | none (independent track) |
| 7 — schema-migration mechanism | `Deferred` | pre-first-deploy gate only |

## Next step

1. All decisions resolved (D1/D2/D5, Ed 2026-06-24). **Phases 1, 2, 6 are ready
   to execute now** — all WIP-independent — one PR each.
2. Hold **Phase 3** then **Phase 5** until the in-flight aperture v12 WIP lands.
3. The promoted sibling refactor
   (`table-write-architecture-unification/`) starts after this folder's Phase 3.

## Blockers

- **In-flight aperture v12 WIP** in the working tree (uncommitted at planning
  time; the `glazing-frame-documentation` feature folder): edits to
  `document.py`, `tables/apertures.py`, `project_document/aperture_commands/*`,
  `project_document/apertures/*` (+ new `apertures/lookup.py`),
  `assets/registry.py`, `envelope/commands/registry.py`. Phase 3 (and the
  sibling refactor) must wait for it. See [[feedback_concurrent_committer]].

## Verification posture

Every phase ends green: `simplify` + `docs-pass` on the diff, `make format`,
`make ci`, and (for shape-changing phases) a clean dev reseed + fixture regen.
Phase 5 additionally requires a `pg_dump --schema-only` diff proving the squash
reproduces the current schema.
