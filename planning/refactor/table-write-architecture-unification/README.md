---
DATE: 2026-06-24
TIME: 18:25 EDT
STATUS: Active — Phase 1 (backend write spine) implemented; Phases 2–3 pending.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Router for the table-write-architecture unification refactor (cross-stack).
RELATED:
  - planning/refactor/backend-data-architecture-cleanup/ (sibling; this was its Phase 4, promoted out)
  - planning/code-reviews/2026-06-24/backend-data-architecture-review.md (DOC-3, DOC-4; D5)
  - context/technical-requirements/data-model.md §6.6.7 (registered table contract)
---

# Table-Write-Architecture Unification — Router

Make adding/editing a project-document table go through **one** CRUD write path,
and give the legitimately-distinct *semantic command* paths **one** shared
draft/ETag/size/validation spine. Today heat-pumps is an unjustified second
write architecture — on **both** backend and frontend — and three backend paths
(heat-pumps, aperture commands, envelope commands) each re-implement the same
draft plumbing.

## Why this is a separate refactor

This was Phase 4 of `backend-data-architecture-cleanup/`. It was promoted to its
own refactor (Ed, 2026-06-24, decision D5) because:

1. **It's cross-stack.** Heat-pumps has a bespoke frontend client
   (`src/features/equipment/heat-pumps/{api,payload-builders,types}.ts`) that
   must be rewired onto the generic table-write client the other equipment
   tables use — significant frontend work, unlike the rest of the data-cleanup.
2. **It's a different concern.** That refactor is about *data shape / DB schema /
   persistence hygiene*; this is about *application write-path architecture and
   extensibility*. Keeping them separate keeps each legible and independently
   shippable.
3. **It's the highest-risk piece.** Heat-pumps' delete-cascade + dry-run preview
   must be preserved exactly; it deserves its own PRD, acceptance tests, and
   frontend coordination.

## Goal (the extensibility headline)

After this: there is exactly one way to do CRUD on a document table (backend +
frontend), heat-pumps included; semantic commands share one spine; and adding
the next equipment/table type is a uniform, documented, one-place change.

## Read order
1. `PRD.md` — scope (in/out), the keep-vs-fold rule, success criteria.
2. `STATUS.md` — state, blockers, sequencing.
3. `phases/phase-01-backend-write-spine.md` — extract the shared spine.
4. `phases/phase-02-heatpumps-onto-registry.md` — fold heat-pumps (backend).
5. `phases/phase-03-frontend-heatpumps-rewire.md` — frontend onto the generic client.

## Sequencing (both external dependencies satisfied ✅)
- **Aperture/glazing-frame v12 WIP** — landed on main; this refactor's Phase 1
  rebased onto its final dispatcher shape.
- **`backend-data-architecture-cleanup` Phase 3** (document schema cleanup /
  single validator) — complete and archived; Phase 1 re-homed the body-size
  guard it installed onto the shared spine.
- Phase 1 (backend write spine) is implemented; Phase 2 (heat-pumps backend) is
  the next phase to start, Phase 3 (frontend rewire) follows it.
