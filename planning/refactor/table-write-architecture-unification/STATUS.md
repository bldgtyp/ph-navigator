---
DATE: 2026-06-25
TIME: 02:00 EDT
STATUS: Active — Phases 1, 2, 3a complete (all backend); Phase 3b (frontend rewire) is the only remaining work, needs an interactive app pass.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: State, blockers, sequencing for the table-write-architecture unification.
RELATED: ./README.md, ./PRD.md, planning/archive/dated/2026-06-24/backend-data-architecture-cleanup/
---

# STATUS

## Current state
Both external blockers cleared (aperture v12 + sibling Phase 3). **The backend
half of the refactor is done.**

- **Phase 1** — `features/project_document/write_spine.py` owns the draft write
  lifecycle (`apply_document_write` + `load_draft_context`); `replace_table_slice`,
  schema-mutation, aperture-command, and envelope-command surfaces all run through
  it (envelope's duplicate `_load_command_context` deleted). −133 lines.
- **Phase 2** — heat-pumps folded onto the registered contract + spine. New
  generic `tables/dependent_links.py` (declarative cross-table delete cascade:
  block required / clear optional + dry-run preview); the bespoke heat-pump write
  service (`JsonPatchOp`/`_apply_patch_to_body`/`_validate_slice`/`_delete_preview`/
  `_apply_delete_cascades` + double-validate) is gone; the old PATCH endpoints
  survive as a thin shim until Phase 3. `make ci` green (BE 1111, FE 1900).

## Phase ledger
| Phase | State | Blocker |
|---|---|---|
| 1 — backend write spine | `Complete` | none — `make ci` green |
| 2 — heat-pumps onto registry (backend) | `Complete` | none — `make ci` green (BE 1111, FE 1900) |
| 3a — generic table-replace cascade preview (backend) | `Complete` | none — `:preview-replace` route; BE suite 1113 |
| 3b — frontend heat-pumps rewire + shim removal | `Ready` | none — needs an interactive app pass (Vitest/Playwright as Ed) |

## Next step
Phase 3b (the only remaining work) — the interactive frontend rewire. Follow the
ordered 6-step plan in `phases/phase-03-*.md` §"Phase 3b — ordered plan":
options→generic replace, delete-cascade→`:preview-replace`, rewire
`VentilatorsTableSlot`, drop the bespoke FE client + `heatPumpsQueryKeys`, remove
the backend PATCH shim + rename `dependent_link_delete_blocked`, tests + browser
smoke. **Do it with the app running** — it's UX-critical and the endpoint removal
must co-land with the frontend so the live Equipment tab never breaks. A
fresh-budget implementation pass judged a blind (no-browser) rewire too risky.

## Blockers
- None technical. 3b is gated only on doing it as a verified interactive pass
  (running app) rather than autonomously, per the keep-the-app-green principle.

## Deferred follow-ups (recorded)
- **Module split** of `tables/heat_pumps.py` (~982 lines): soft target, high-churn
  re-export wiring; recipe in `phases/phase-02-*.md`. Optional.
- **Rename `heat_pump_delete_blocked`** → neutral code: do in Phase 3 with the
  frontend (wire-contract change).
- **Migrate ventilators/rooms** onto the generic `dependent_links` cascade (TODO
  comments left in both files) — collapses the last two hand-rolled cascades.
- **Assets attachment path** + **`save_draft`/`save_draft_as`** still hand-roll
  spine-overlapping plumbing (divergent no-op / not-draft-mutate semantics) —
  possible follow-ups, out of this refactor's named scope.

## Design note carried forward
The spine keeps a **two-outcome** model (persist vs no-op). Heat-pumps' dry-run
preview fits it: the preview is computed read-only (`preview_dependent_link_cascade`)
and returned with the unchanged body — no third "compute-but-don't-persist"
outcome was needed on the spine.

## Verification posture
Each phase ends green (`make ci` backend + frontend). The cross-stack cut keeps
the old heat-pumps endpoint alive through Phase 2 and removes it only after the
Phase 3 frontend rewire, so the app is never broken mid-flight. Heat-pumps
cascade/preview acceptance tests are ported **before** the bespoke service is
deleted.
