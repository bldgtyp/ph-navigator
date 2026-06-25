---
DATE: 2026-06-25
TIME: 00:30 EDT
STATUS: Active — Phase 1 implemented (backend write spine); Phases 2–3 unblocked and pending.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: State, blockers, sequencing for the table-write-architecture unification.
RELATED: ./README.md, ./PRD.md, planning/archive/dated/2026-06-24/backend-data-architecture-cleanup/
---

# STATUS

## Current state
Both external blockers cleared: the aperture/glazing-frame v12 work landed on
main and the sibling `backend-data-architecture-cleanup` Phase 3 (single
current-schema validator + body-size guard) is complete and archived.

**Phase 1 is implemented.** `features/project_document/write_spine.py` now owns
the draft write lifecycle (`apply_document_write` + the moved `load_draft_context`),
and `replace_table_slice`, `apply_schema_mutation_to_draft`, the aperture-command
service, and the envelope-command service all run through it (the envelope path's
duplicate `_load_command_context` is deleted). Net −133 lines of duplicated
plumbing. Body-size-guard tests added for the aperture/MCP and envelope command
surfaces; the table-replace and MCP-schema-mutation surfaces were already covered.

## Phase ledger
| Phase | State | Blocker |
|---|---|---|
| 1 — backend write spine | `Complete` | none — implemented, `ty` clean, backend suite 1107 passed / 2 skipped |
| 2 — heat-pumps onto registry (backend) | `Ready` | none (Phase 1 done) |
| 3 — frontend heat-pumps rewire | `Blocked` | Phase 2 here |

## Next step
Start Phase 2: fold heat-pumps onto the registered contract + spine. Port the
cascade/preview/ETag acceptance tests **first**, then add the generic cascade +
dry-run-preview contract capabilities and route heat-pump writes through
`replace_table_slice` → spine; keep the old endpoint delegating until Phase 3.

## Blockers
- None outstanding for Phases 1–2. Phase 3 (frontend rewire) still depends on
  Phase 2 landing the backend contract with the old endpoint kept alive.

## Notes carried forward (from the Phase 1 simplify pass)
- The spine intentionally keeps a **two-outcome** model (persist vs no-op). The
  heat-pumps dry-run preview fits this without a third outcome: its mutate
  returns the *unchanged* body plus the preview in `details`, so it rides the
  no-op path. Phase 2 should rely on that rather than adding a preview outcome.
- `heat_pumps.apply_option_patch` and the assets attachment write path are still
  bespoke. `apply_option_patch` is a clean spine fit (no dry-run); the assets
  path lacks a no-op short-circuit and returns surface-specific data. Both are
  out of this refactor's named scope — revisit in Phase 2 (heat-pumps) or a
  follow-up (assets) rather than special-casing the spine.
- `save_draft` / `save_draft_as` still hand-roll the version lock + version-ETag
  gate that overlaps `load_draft_context`; a `load_version_for_save` extraction
  is a possible follow-up (out of scope here — saves are not draft-mutates).

## Verification posture
Each phase ends green (`make ci` backend + frontend). The cross-stack cut keeps
the old heat-pumps endpoint alive through Phase 2 and removes it only after the
Phase 3 frontend rewire, so the app is never broken mid-flight. Heat-pumps
cascade/preview acceptance tests are ported **before** the bespoke service is
deleted.
