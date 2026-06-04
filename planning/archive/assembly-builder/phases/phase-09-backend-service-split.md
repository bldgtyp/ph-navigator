---
DATE: 2026-05-27
TIME: 22:30 EDT
STATUS: Proposed. Foundation refactor before serious UI/UX work begins.
AUTHOR: Claude (Opus 4.7)
SCOPE: Restructure backend envelope service so adding the next command,
       reading a single workflow, or onboarding a new contributor stops
       requiring a 1000-line file scan.
RELATED:
  - planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md §H1, §H2, §M3
  - planning/archive/assembly-builder/PRD.md §§5, 7
  - context/CODING_STANDARDS.md §Module Size And Splitting, §Required Feature Shape
---

# Phase 9 - Backend Envelope Service Split And Command Dispatch

## Goal

Bring `backend/features/envelope/service.py` back under the project's
module-size discipline and replace the long `isinstance` cascade with a
typed dispatch surface that scales with the number of commands. The
behavior on the wire does not change — every existing command still
applies through the same draft / ETag / audit / `updated_via` path —
but a future contributor (or Claude) reading the feature should land on
a focused file instead of a 1061-line scroll.

## Why Now

- `service.py` (1061 lines) is currently the largest service module in
  the repo and is past the 1000-line hard limit documented in
  `context/CODING_STANDARDS.md` §Module Size And Splitting.
- Phase 8 still owes scale fixtures and additional browser hardening.
  Touching a 1000-line file repeatedly is where regressions hide.
- The polished editor UX will likely add new commands (multi-segment
  edits, undo, drag-reorder candidates per PRD §15). Each new command
  adds another branch to the existing `isinstance` cascade. Replacing
  the cascade once costs less than rewriting it under deadline.

## In Scope

- Split `backend/features/envelope/service.py` along workflow lines
  (assemblies, layers, segments, materials, drift, refresh) so each
  module owns one workflow concern. Cross-cutting document helpers
  (`_update_assembly`, `_update_layer`, `_update_segment`,
  `_replace_assemblies`, `_replace_project_materials`, `_find_*`,
  `_renumber_*`) move to a single small module so the seams stay
  visible.
- Replace the `_apply_command` `isinstance` cascade with a typed
  dispatch registry keyed by `EnvelopeCommand` discriminator. Each
  workflow module registers its handlers; the entry point in
  `service.py` stays small (auth, transaction, ETag bookkeeping,
  audit log, response build) and delegates to the registry.
- Thread the connection through `get_project_material_drift_report` so
  `_load_catalog_material_rows` stops opening its own transaction.
  Symmetry with the rest of the service matters more than saving one
  argument.
- Keep `apply_envelope_command`, `get_envelope_read_model`,
  `get_assembly_thermal_model`, and `get_project_material_drift_report`
  as the public surface — callers (routes, MCP tools) should not need
  to change imports.

## Out Of Scope

- New commands, new command behavior, new endpoints, new fields.
- Changes to the draft / version / ETag / `updated_via` contract.
- Changes to the audit log shape.
- Frontend changes. Phase 10 owns those.
- Documentation passes on docstrings or module headers. Phase 12 owns
  those.
- Performance work. Phase 8 still owns the scale fixture.

## Why This Split, Not Another

`context/CODING_STANDARDS.md` says "split by workflow first, then by
policy boundary." `project_document/` already follows that shape
(`drafts.py`, `versions.py`, `refresh.py`, `validation.py`,
`custom_fields.py`). The assembly-builder commands cluster naturally
along the same axis (geometry vs. material picking vs. catalog drift /
refresh). Splitting by helper bucket (`utils.py`) is explicitly
discouraged and would not solve the readability problem.

The dispatch registry mirrors the pattern in
`backend/features/project_document/tables/registry.py` — a typed
mapping keyed by a discriminator literal — so the project already
has one precedent for this style.

## Verification Gates

Backend:

```bash
cd backend
uv run ruff check features/envelope
uv run ty check features/envelope tests/test_envelope_phase0*.py
uv run pytest tests/test_envelope_phase0*.py tests/test_mcp.py
```

Repo:

- `make test`
- `make typecheck`
- `make lint`
- (skip `make smoke` if the shared Docker container conflict from
  STATUS.md is still active; otherwise run it)

Browser:

- spot-check on a seeded project: rename one assembly, add one layer,
  add one segment, pick a catalog material, save, reload. Each of
  those exercises a handler from a different new submodule and proves
  the dispatch wiring landed.

No new tests required — existing `test_envelope_phase0*.py` already
exercises every command path. If the split is mechanical, those tests
pass unchanged.

## Success Criteria

1. No single `backend/features/envelope/*.py` module exceeds the
   600-line soft limit; nothing exceeds the 1000-line hard limit.
2. `_apply_command` is gone, replaced by a registry call that fails
   loudly (not silently) on an unknown command kind.
3. `_load_catalog_material_rows` no longer opens its own transaction;
   the drift route owns transaction scope.
4. Every existing backend test passes without modification of test
   bodies. Import paths in tests may change, but assertions do not.
5. Routes and MCP tools still import the same public names from
   `features.envelope.service`. No caller outside the envelope package
   needs to know that the split happened.

## Risks

- **Hidden coupling surfaces during the split.** Mitigation: lean on
  the existing test suite — every command has at least one path
  covered. Run the suite after each topic-module extraction, not only
  at the end.
- **Dispatch table loses Pydantic narrowing.** Mitigation: keep each
  handler signature typed against its specific command DTO; the
  registry can hold `Callable[..., ProjectDocumentV1]` with a cast at
  the dispatch site, or use a small `@register("kind")` decorator that
  preserves the per-handler type. Either is acceptable as long as
  `ty check` stays clean.
- **Drift transaction threading affects the read response shape.**
  Mitigation: it does not — the response model is identical; only the
  connection lifecycle changes.
- **Commit gets too big to review.** Mitigation: land the workflow
  split first as one commit, then the dispatch-table conversion as a
  second, then the drift transaction fix as a third. They are
  independent.

## Out Of This Phase, Into Phase 10

- The frontend half of the foundation cleanup is its own phase because
  it touches different files, different test runs, and different
  reviewers' attention.

## Sequencing

This phase should land before:

- Phase 10 (frontend split) — independent, can land in either order,
  but landing 9 first means the next command added during Phase 10
  testing already lives in the right place.
- The next polish-phase command (multi-segment edits, undo, etc.) —
  no new command should be added to the legacy cascade.

This phase has no blockers from earlier phases. It can begin on a
fresh branch off `main`.
