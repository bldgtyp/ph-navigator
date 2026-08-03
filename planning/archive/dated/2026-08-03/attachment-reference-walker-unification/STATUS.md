---
DATE: 2026-08-03
TIME: 15:43 EDT
STATUS: Complete — implemented, verified, and archived
AUTHOR: Codex with Ed May
SCOPE: Remove hand-maintained attachment row traversal without losing support
  for irregular project-document tables.
RELATED:
  - ../../../../../context/DATA_STORAGE.md
  - ../public-attachment-access/STATUS.md
---

# Status — Attachment reference walker unification

## Why this exists

Before this refactor, `iter_rows_for_raw_tables` was a guarded hand-written
mapping: adding a document table or changing its shape required manual
synchronization, and attach/detach had a separate row-lookup path in
`features.assets.downloads.find_row`.

## Original deferred scope

1. Derive direct-table mappings where a project-document `TableContract`
   already owns the table path.
2. Add contracts or explicit adapters for unregistered `project_frames` and
   `project_glazings`; give the registered, nested `assembly_segments` path an
   explicit flattening adapter.
3. Consolidate read/reference traversal and mutation row lookup behind one
   tested adapter contract without widening anonymous asset access.
4. Preserve the schema-derived registration/reachability guards and the
   list/envelope shape pin introduced by Public Attachment Access.

## Done when

- Adding a contract-backed attachment table requires no new walker branch.
- Irregular-table adapters are explicit and independently tested.
- Anonymous reads, reference validation, orphan protection, bulk download, and
  attach/detach share the same table-shape authority.

## Implementation sequence

1. **Phase 01 — Adapter authority:** derive ordinary table paths from
   `TableContract`, add explicit irregular adapters, and retain the registered
   attachment-field reachability and list/envelope guards.
2. **Phase 02 — Mutation unification:** route attach/detach row lookup through
   the same adapter authority and remove the duplicate lookup in bulk-download
   code.
3. **Phase 03 — Verification and closeout:** run focused and repository gates,
   fold the stable contract into `context/`, and archive this packet.

The `implement-loop` invocation on 2026-08-03 authorized this packet for
implementation.

## Verification log

### Phase 01

- `uv run pytest tests/test_assets_registry.py tests/test_attachment_reachability_guards.py -q`
  — `56 passed`.
- Focused Ruff and ty checks passed for the adapter, registry, contract, heat
  pump, and reachability-guard changes.
- `make format` and `make ci` passed: backend `1824 passed, 7 skipped`; frontend
  `2396 passed` across `263` files; production build passed. Existing warning
  output remained non-failing.
- `graphify update .` completed; generated graph output was already current.
- `simplify` removed redundant adapter identity state, preserved lazy nested
  lookup, and eliminated a duplicate heat-pump alias derivation in tests.
- `docs-pass` found no stable-context update appropriate before mutation lookup
  is unified in Phase 02.

### Phase 02

- `uv run pytest tests/test_assets_registry.py tests/test_attachment_reachability_guards.py tests/test_assets_service.py tests/envelope/test_envelope_attachments.py -q`
  — `84 passed`.
- Focused Ruff and ty checks passed for all changed asset modules and tests.
- `make format` and `make ci` passed: backend `1828 passed, 7 skipped`; frontend
  `2396 passed` across `263` files; production build passed. Existing warning
  output remained non-failing.
- `graphify update .` completed; generated graph output was already current.
- `simplify` made direct and nested row readers lazy, preserving short-circuit
  lookup without double materialization; reuse and quality reviews were clean
  after that fix.
- `docs-pass` replaced the deleted walker and separate-assembly-lookup wording
  in `context/DATA_STORAGE.md` and the attachment security contract.

### Phase 03

- `uv run pytest tests/test_assets_registry.py tests/test_attachment_reachability_guards.py tests/test_assets_service.py tests/envelope/test_envelope_attachments.py -q`
  — `77 passed` after obsolete path-map and duplicate manual-path tests were
  removed.
- Focused Ruff and ty checks passed for the final asset registry, adapters, and
  guard tests.
- An isolated `features.assets.registry` import measured about `161 ms`; the
  contract-derived adapter map is cached and loaded lazily, and row iteration
  remains lazy so lookup short-circuits.
- Three parallel `simplify` reviews were clean after adding the lazy-import
  rationale and renaming the historical deferred-scope heading.
- `docs-pass` confirmed the stable adapter contract is recorded in
  `context/DATA_STORAGE.md` and
  `context/technical-requirements/attachments.md`; the deferred aperture plan
  now relies on `TableContract` registration rather than a manual walker path.
- Final `make format`, `graphify update .`, and `make ci` passed: backend
  `1821 passed, 7 skipped`; frontend `2396 passed` across `263` files;
  production build and version-marker verification passed. Existing warning
  output remained non-failing.
- No browser check was applicable because this refactor changes backend table
  traversal only. No deployment or production data write was performed.
- Residual risk is limited to future irregular document shapes: those still
  require an explicit adapter and are guarded by reachability tests.
