---
DATE: 2026-05-27
TIME: 22:30 EDT
STATUS: Proposed. Foundation closeout — document the why, reorganize the tests.
AUTHOR: Claude (Opus 4.7)
SCOPE: Add the missing "why" docstrings on cross-cutting service and
       export entry points, anchor the thermal math to its source,
       and reorganize tests so a reader finds them by topic instead of
       by historical phase number.
RELATED:
  - planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md §L1, §L4, §L5, §M6
  - planning/archive/assembly-builder/PRD.md §§5, 11, 15
  - context/CODING_STANDARDS.md §Documentation Standard
---

# Phase 12 - Documentation And Test Reorganization

## Goal

Close out the foundation refactor by writing down the non-obvious
contracts that the code already enforces but does not yet explain, and
by renaming the test surface so future readers can find a test by what
it tests rather than by what phase shipped it. After this phase, a new
contributor (or Claude on a cold read) can land on
`apply_envelope_command`, `export_hbjson_constructions`, or
`_calculate_isothermal_planes_r_value` and understand **why** it is
shaped that way without reading the PRD end-to-end.

## Why Now

- The code review found that the strongest invariants in the feature
  (saved-version-only HBJSON, draft-vs-version ETag distinction,
  no-op-when-unchanged response, segment-width normalization,
  catalog-origin `local_overrides` tracking) live only as code. A
  reader debugging an issue six months from now will have to
  reconstruct each invariant from the implementation. The standard
  (`context/CODING_STANDARDS.md` §Documentation Standard) explicitly
  asks for **why**-bearing docstrings on this kind of policy code.
- The thermal math in `thermal.py` is correct but unanchored.
  Parallel-Path and Isothermal-Planes are textbook methods (ASHRAE
  Fundamentals Ch. 25 / PH Institute envelope guide). The code does
  not say so. A future engineer who is not a CPHC has no entry point.
- The test files are named `test_envelope_phase01.py` through
  `test_envelope_phase07.py`. The phase numbering ages badly — finding
  "the catalog-drift tests" today requires knowing they shipped in
  Phase 7. The project already has the same problem in
  `test_project_document_custom_fields_phase_1.py` through `_phase_4.py`.
  This phase fixes it for envelope and proposes the same convention to
  the project at large.

## In Scope

### Backend documentation

- Module top of `backend/features/envelope/service.py` (after Phase 9's
  split, possibly each new `commands/<topic>.py` module): a 4–6 line
  docstring naming the cross-cutting invariants this feature enforces.
  Candidates:
  - segment widths are normalized per layer at the document layer, not
    in the canvas;
  - project materials must exist before a segment can reference them;
  - draft ETag protects in-flight edits; version ETag protects the
    saved baseline; both can change between requests;
  - assembly-name uniqueness is case-insensitive and whitespace-trimmed.
- `apply_envelope_command` docstring: the no-op shortcut, the
  editor-only access requirement, the draft-vs-version ETag
  distinction, the `updated_via` tagging contract.
- `export_hbjson_constructions` (in `hbjson_export.py`) docstring: the
  saved-version-only invariant and the 422-on-incomplete behavior.
  Reference PRD §15 default ("HBJSON export reads the saved version
  body and rejects incomplete assemblies instead of silently omitting
  them") so a future reader sees the decision rather than re-derives it.
- `_load_command_context` docstring: the conflict-error contract
  (`expected` payload shape, structured 409 vs 422 distinction).
- `thermal.calculate_assembly_thermal` and the two underlying methods
  (`_calculate_parallel_path_r_value`,
  `_calculate_isothermal_planes_r_value`) get a 2–4 line block each
  citing the source method (ASHRAE Ch. 25 Parallel-Path and
  Isothermal-Planes), naming the edge-case guards (zero-width
  segments, single-segment fast path, `total_u > 0` guard), and
  explaining the PH-average choice (preview only, not certification
  output).
- One-line defensive comment on the unreachable
  `raise api_error(... "unknown_envelope_command" ...)` (post-Phase 9,
  this becomes the `KeyError` branch of the dispatch registry):
  Pydantic's discriminator already rejects unknown kinds at the route
  boundary, so this is defense-in-depth.

### Frontend documentation

- Top-of-file 4–6 line block on `EnvelopePage.tsx` and the
  post-Phase-10 `EnvelopeEditorDialogs.tsx`: what state the file owns
  (route guarding, dialog dispatch, copy buffer), what it does not own
  (server state — that's hooks; layout primitives — those are
  components).
- Top of `query-keys.ts`: one line on the keyspace shape and the
  invalidation contract `useEnvelopeCommandMutation` depends on.
- `useLengthDraft.ts` (extracted in Phase 10): top-of-file block on
  the sticky-unit-system behavior — that the modal captures its unit
  system at open time and does not respond to a mid-edit toggle, per
  PRD §15 default.

### Test reorganization

- Rename `tests/test_envelope_phase01.py` through `tests/test_envelope_phase07.py`
  to topic-organized files, ideally in a `tests/envelope/` folder:
  - `test_envelope_document_contracts.py`
    (was phase 01 — Pydantic shapes, schema validation, registry)
  - `test_envelope_commands_geometry.py`
    (was phase 03 — assembly/layer/segment CRUD)
  - `test_envelope_commands_materials.py`
    (was phase 04 — material pick/catalog/hand-enter/detach)
  - `test_envelope_thermal_and_export.py`
    (was phase 05)
  - `test_envelope_attachments.py`
    (was phase 06)
  - `test_envelope_catalog_drift.py`
    (was phase 07)
  - MCP envelope tests stay in `tests/test_mcp.py` since that file is
    already cross-feature.
- Keep `pytest` discovery working — no test bodies change, only file
  names and possibly the test folder.

## Out Of Scope

- Renaming the `test_project_document_custom_fields_phase_*.py` files.
  That is a project-wide decision to make in a separate planning
  thread, not inside the Assembly Builder bundle.
- New test cases. This phase is reorganization, not coverage growth.
- API-level documentation (`context/technical-requirements/api.md`).
  Phase 8's docs-pass owns that. This phase docs the code; that phase
  docs the contract.
- README or CONTEXT-level docs in the planning bundle. Those live in
  `planning/archive/assembly-builder/PRD.md` lessons log.

## Why Document Now, Not Earlier

Phases 9, 10, and 11 are file-shape changes. Writing the "why" before
those phases would mean rewriting half the comments after the file
moves. Doing it last means each comment lands in its final home and
references the post-refactor module layout.

The test rename is grouped here for the same reason: it depends on the
post-Phase-9 module structure, and it has the same low-risk character
(no behavior change, only file movement).

## Verification Gates

Backend:

```bash
cd backend
uv run ruff check features/envelope tests/envelope
uv run ty check features/envelope tests/envelope
uv run pytest tests/envelope tests/test_mcp.py
```

Frontend:

```bash
cd frontend
pnpm run format
pnpm exec eslint src/features/envelope
pnpm exec vitest run src/features/envelope/__tests__/
pnpm run build
```

Repo:

- `make test`
- `make typecheck`
- `make lint`

No browser smoke required. This phase changes only comments and file
names; if the gates above pass, the feature is unchanged at runtime.

## Success Criteria

1. Every public service entry point (`apply_envelope_command`,
   `get_envelope_read_model`, `get_assembly_thermal_model`,
   `get_project_material_drift_report`, `export_hbjson_constructions`)
   has a docstring explaining its policy contract (not its signature).
2. `thermal.py`'s two method functions cite the ASHRAE / PH Institute
   source method and name the edge-case guards.
3. No test file in the envelope feature is named by phase number.
4. The test renames are mechanical — running `git log --follow` on
   each new file finds the original phase-numbered file as its
   immediate parent.
5. A new reader can answer the question "why does HBJSON export
   reject incomplete assemblies?" from `hbjson_export.py` alone, not
   from the PRD.

## Risks

- **Docstrings drift from code.** Mitigation: write them after Phases
  9–11 have landed, so the documented contract matches the
  post-refactor implementation. Add a docs-pass step in Phase 8's
  release gate that compares each docstring's claim against current
  behavior.
- **Test rename breaks CI gating that references the old paths.**
  Mitigation: grep CI configs and Makefile recipes for
  `test_envelope_phase` before renaming; update references in the
  same commit.
- **STATUS.md, PRD.md, and prior phase docs reference the old test
  file names.** Mitigation: leave those alone — they are historical
  records. Only the live code, tests, and gating configs need to
  follow the new names.

## Sequencing

This phase lands last in the foundation-refactor bundle. It depends on
Phase 9 (module names to document), Phase 10 (frontend file names to
document), and Phase 11 (helper modules to document).

After this phase, the assembly-builder feature is ready for the polish
UI/UX phase that prompted the foundation review. Whatever the polish
phase decides to call itself (Phase 13, or a new feature bundle), it
starts on a foundation where every architectural decision is either
expressed in a focused module or written down in a docstring.
