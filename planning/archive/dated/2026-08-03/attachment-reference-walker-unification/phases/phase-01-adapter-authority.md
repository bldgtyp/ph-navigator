---
DATE: 2026-08-03
TIME: 15:35 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Replace the hand-written attachment table traversal map with a
  contract-derived adapter registry and explicit irregular adapters.
RELATED:
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 01 — Adapter authority

## Work

1. Add an optional attachment-table alias to `TableContract` for public table
   keys that intentionally differ from generic route names.
2. Build ordinary adapters from the registered contracts and their owned
   `table_path` values.
3. Add explicit adapters for `project_frames`, `project_glazings`, and flattened
   `assembly_segments`.
4. Route reference traversal through the adapter registry without changing the
   `ATTACHMENT_FIELDS` allowlist.
5. Strengthen guards for contract derivation, irregular paths, and list/envelope
   normalization.

## Exit checks

- Focused registry and reachability tests pass.
- `simplify`, `docs-pass`, formatting, and applicable backend checks pass.

## Completion evidence

- Added `features.assets.table_adapters` as the row-shape authority.
- Ordinary adapters derive keys and paths from `TableContract`; only the four
  heat-pump public aliases require explicit contract metadata.
- `project_frames`, `project_glazings`, and `assembly_segments` have explicit
  adapters; nested assembly lookup remains lazy.
- Registry/reachability suite: `56 passed`.
- Focused Ruff and ty checks: passed.
- `make format`: passed.
- `make ci`: passed (`1824` backend tests passed, `7` skipped; `2396` frontend
  tests passed across `263` files; production build passed).
- `graphify update .`: completed with no tracked graph delta.
- `simplify`: passed with three findings fixed.
- `docs-pass`: planning status updated; stable context intentionally deferred
  until Phase 02 completes the shared mutation path.
