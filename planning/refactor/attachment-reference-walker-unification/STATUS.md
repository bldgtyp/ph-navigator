---
DATE: 2026-08-03
TIME: 15:35 EDT
STATUS: Active — Phase 01 complete; Phase 02 next
AUTHOR: Codex with Ed May
SCOPE: Remove hand-maintained attachment row traversal without losing support
  for irregular project-document tables.
RELATED:
  - ../../../context/DATA_STORAGE.md
  - ../../archive/dated/2026-08-03/public-attachment-access/STATUS.md
---

# Status — Attachment reference walker unification

## Why this exists

`iter_rows_for_raw_tables` is a guarded hand-written mapping. It now tolerates
both bare lists and `{field_defs, rows}` envelopes, but adding a document table
or changing its shape still requires manual synchronization. Attach/detach also
has a separate row-lookup path in `features.assets.downloads.find_row`.

## Deferred scope

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
