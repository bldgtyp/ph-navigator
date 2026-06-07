---
DATE: 2026-06-07
TIME: (compiled)
STATUS: Active — four phase plans queued (C-01 from the original
        backlog plus C-02 / C-03 / C-04 from the 2026-06-07 code
        review). No code work in flight yet.
AUTHOR: Claude
SCOPE: Track which cleanup items from PRD.md have shipped and which
       are still queued. C-01 maps the original PRD §A.1–A.6 (+§B.2)
       into a concrete phase plan. C-02 / C-03 / C-04 cover the
       refactor candidates surfaced by the 2026-06-07 review that
       are not in the PRD.
RELATED:
  - planning/features/apertures-cleanup/PRD.md
  - planning/features/apertures-cleanup/phases/
  - planning/code-reviews/2026-06-07/aperture-builder-review.md
  - planning/archive/apertures/STATUS.md (final state of the 13-phase build)
---

# Apertures cleanup — status

Nothing in flight. The legacy backlog lives in `PRD.md`; the
2026-06-07 post-build review queued three additional phase plans
(C-02, C-03, C-04) under `phases/`. C-01 covers the PRD's §A.1–A.6
(+§B.2) rename items and also has a phase plan under `phases/`.

## Phase queue

| Phase  | Title                                | Status   | Plan |
|--------|--------------------------------------|----------|------|
| C-01   | `Window*` → `Aperture*` removal      | Plan ready, queued — first up | `phases/phase-c01-window-to-aperture-removal.md` |
| C-02   | Backend handler consolidation        | Plan ready, queued | `phases/phase-c02-backend-handler-consolidation.md` |
| C-03   | Drift correctness + cross-cutting    | Plan ready, queued | `phases/phase-c03-drift-cross-cutting.md` |
| C-04   | Frontend hygiene pass                | Plan ready, queued | `phases/phase-c04-frontend-hygiene.md` |

C-01 ships first because the rename touches files C-02 and C-04
also touch; doing it later means re-doing the rename through both
of those PRs. C-01 folds in PRD §A.1–A.6 plus §B.2 (`datasheet_url`
column) per the PRD note that it ships co-located with the rename.

C-02 and C-04 touch disjoint files and can ship in either order
or in parallel branches. C-03 sits between them on the dependency
graph — the frontend half of C-03 (drift-query invalidation) is
called out in C-04 Step 9 with a "do it here if C-03 hasn't shipped"
gate to avoid duplicate work.

## Suggested ship order

1. **Phase C-01** — `Window*` → `Aperture*` removal
   (PRD §A.1–A.6 + §B.2). Unblocks `aperture_default_refs_missing`
   503; eliminates the tracer-bullet coexistence pattern; folds in
   the `datasheet_url` ref-column add; biggest churn-cost saver if
   done before C-02 / C-04.
2. **Phase C-02** — Backend handler consolidation. Largest
   maintenance-cost payoff. Mechanical; low risk.
3. **Phase C-03** — Drift correctness + cross-cutting. Only
   phase with user-visible performance impact (drift N+1).
4. **Phase C-04** — Frontend hygiene pass. Smallest blast radius;
   can run in parallel with C-02 or C-03 if branch management
   permits.

## Blockers

- C-01's Alembic migration (PRD §A.4) is the gating step for
  PRD §A.1–A.3 — the persisted JSON has to migrate before the
  field rename's validation can run cleanly. Keep them in one PR.
- C-03 Step 5 (`_read_body` cannot return `None`) may require
  touching `raise_http_exception_as_mcp_error` in a shared MCP
  helper module outside the aperture surface area. Confirm the
  scope before opening the PR.

## How to start a phase

1. Open the relevant `phases/phase-c0N-*.md`.
2. Read P0 + P1 to scope. Read P2 to inventory file touches.
3. Branch from main (or from the unmerged C-01 base if C-01
   hasn't landed yet — see the memory note on
   `[[feedback_worktree_chain]]`).
4. Work through P3 steps in order; each step is a commit.
5. P4 verification gates the phase close; P5 risks list the
   things to watch for.
