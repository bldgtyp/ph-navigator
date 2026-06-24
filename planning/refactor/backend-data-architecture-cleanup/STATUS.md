---
DATE: 2026-06-24
TIME: 18:05 EDT
STATUS: Active — planning complete; awaiting decision confirmation + WIP merge before code.
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
| 3 — document schema cleanup | `Blocked` | aperture v12 WIP must land; D2 confirmed |
| 4 — unify write architecture | `Blocked` | aperture v12 WIP must land; D5 confirmed |
| 5 — relational clean baseline | `Blocked` | D1 confirmed; run after 3/4 |
| 6 — pre-deploy hardening | `Ready` | none (independent track) |
| 7 — schema-migration mechanism | `Deferred` | pre-first-deploy gate only |

## Next step

1. **Ed:** confirm `decisions.md` D1 (migration squash), D2 (schema_version
   reset + shim deletion), D5 (write-unification scope). D3/D4 are pre-resolved.
2. Once confirmed, start **Phase 1** and **Phase 2** (and optionally **Phase 6**)
   — all WIP-independent — in parallel-ish, one PR each.
3. Hold **Phases 3–5** until the in-flight aperture v12 WIP lands on main.

## Blockers

- **In-flight aperture v12 WIP** in the working tree (uncommitted at planning
  time): edits to `document.py`, `tables/apertures.py`,
  `project_document/aperture_commands/*`, `project_document/apertures/*` (+ new
  `apertures/lookup.py`), `assets/registry.py`, `envelope/commands/registry.py`.
  Phases 3/4 must wait for it. See [[feedback_concurrent_committer]].
- **Open decisions** D1/D2/D5 gate Phases 3–5.

## Verification posture

Every phase ends green: `simplify` + `docs-pass` on the diff, `make format`,
`make ci`, and (for shape-changing phases) a clean dev reseed + fixture regen.
Phase 5 additionally requires a `pg_dump --schema-only` diff proving the squash
reproduces the current schema.
