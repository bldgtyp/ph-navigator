---
DATE: 2026-06-24
TIME: 18:25 EDT
STATUS: Complete (2026-06-25) — spine extracted; four surfaces converted; suite green.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 1 — extract the shared backend write spine.
RELATED: ../PRD.md, planning/code-reviews/2026-06-24/backend-data-architecture-review.md (DOC-1, DOC-3, DOC-4)
DEPENDS_ON: aperture v12 WIP merged; sibling refactor Phase 3 (single validator + size guard) landed. ✅ both cleared.
---

# Phase 1 — Backend Write Spine

## Outcome (2026-06-25)
- Added `features/project_document/write_spine.py`: `apply_document_write`
  (load/ETag-gate → mutate → no-op short-circuit → optional asset-ref check →
  size guard → persist → ETag bump → optional `on_persisted` audit hook),
  plus `load_draft_context` moved in from `drafts.py` (drafts → spine is a
  single import direction; no cycle).
- Converted onto the spine: `replace_table_slice` and
  `apply_schema_mutation_to_draft` (`drafts.py`), `apply_aperture_command_to_draft`
  (`aperture_commands/service.py`), and `apply_envelope_command`
  (`envelope/service.py`). Deleted envelope's duplicate `_load_command_context`.
  Net −133 lines.
- Body-size guard now lives once, on the spine. Added 413 tests for the
  aperture/MCP and envelope command surfaces; table-replace + MCP-schema-mutation
  were already covered.
- Verification: `ty` clean on all changed modules; full backend suite
  **1107 passed, 2 skipped** (2 pre-existing warnings).
- Surgical-scope notes recorded in `../STATUS.md`: spine kept to a two-outcome
  (persist/no-op) model — heat-pumps dry-run preview fits it via an unchanged
  body + `details`; `apply_option_patch`/assets/save-paths left bespoke by scope.

## Goal
One place that owns the write lifecycle every document-write surface shares:
load/create draft → check `If-Match`/`If-Match-Version` ETags → apply the change
→ validate the document **once** → persist → bump `draft_etag` → enforce the
body-size guard. Today this plumbing is duplicated across `replace_table_slice`
(`drafts.py:94`), the heat-pumps service (`heat_pumps/service.py:115`), the
aperture-command dispatcher (`aperture_commands/dispatcher.py`), and the
envelope-command registry (`envelope/commands/registry.py`).

## Changes
- Add `project_document/write_spine.py` (or extend `drafts.py`) exposing a
  single entry point, e.g. `apply_document_write(access, *, expected_etags,
  mutate: Callable[[ProjectDocumentV1], ProjectDocumentV1 | None], updated_via)`
  that performs the full lifecycle above inside one transaction with the
  existing `FOR UPDATE` locks.
- Re-home the body-size guard (installed by the sibling Phase 3 on the current
  boundaries) onto the spine, so it is enforced exactly once, for every surface.
- Refactor `replace_table_slice` to call the spine (its `mutate` replaces a table
  slice). Behavior identical.
- Refactor the aperture-command and envelope-command dispatchers to call the
  spine (their `mutate` applies the semantic command). The *command* logic stays
  in those modules; only the surrounding draft/ETag/validate/persist plumbing
  moves to the spine.

## Step sequence
1. Write the spine + unit tests against a known body.
2. Move `replace_table_slice` onto it (lowest-risk; 16 tables already uniform).
3. Move the aperture-command dispatcher onto it (rebase onto the WIP's final shape).
4. Move the envelope-command registry onto it.
5. Confirm the size guard fires from the spine for every surface.

## Acceptance criteria
- One spine function; `replace_table_slice` + both command dispatchers call it.
- ETag semantics unchanged (existing concurrency tests green); one validation per
  write; size guard enforced per surface (test incl. MCP).
- `make ci` green; no behavior change.

## Risks
- WIP-hot dispatcher/registries — rebase onto the merged WIP. Keep heat-pumps on
  its bespoke path *for now* (it moves in Phase 2); the spine must support what
  it will need (cascade hook) — design the `mutate` signature with that in mind.
