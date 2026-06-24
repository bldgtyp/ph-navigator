---
DATE: 2026-06-24
TIME: 18:25 EDT
STATUS: Active — planning.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Product/behavior contract for the table-write-architecture unification.
RELATED: ./README.md, ./STATUS.md,
         planning/refactor/backend-data-architecture-cleanup/decisions.md (D5),
         planning/code-reviews/2026-06-24/backend-data-architecture-review.md (DOC-3, DOC-4)
---

# PRD — Table-Write-Architecture Unification

## 1. Goal

Collapse the project-document table-write surface to a single, uniform path on
both backend and frontend, so heat-pumps stops being a parallel write
architecture and the next table type is a one-place, copy-the-pattern change.
Behavior-preserving: no user-visible change except that heat-pumps editing goes
through the same plumbing (and gains the same guarantees) as every other table.

## 2. Background — the current state

- **Backend.** The registered table contract (`tables/registry.py`,
  `data-model.md` §6.6.7) keeps generic routes table-agnostic for 16 of 17
  tables via `replace_table_slice` (`drafts.py:94`). Heat-pumps
  (`heat_pumps/service.py:115`) is the exception: it registers four
  `TableContract`s *and* keeps a bespoke `apply_patch` / `JsonPatchOp` /
  `_apply_patch_to_body` service with its own delete-cascade, dry-run preview,
  ETag handling, draft creation, and a redundant double-validate (DOC-3,
  `service.py:202`). Separately, the aperture-command
  (`aperture_commands/dispatcher.py`) and envelope-command
  (`envelope/commands/registry.py`) paths each re-implement the same
  load-draft → check-ETag → apply → validate → persist → bump-etag plumbing.
- **Frontend.** Heat-pumps has its own `src/features/equipment/heat-pumps/`
  with bespoke `api.ts`, `payload-builders.ts`, and `types.ts`, distinct from
  the shared equipment-table write pattern used by Ventilators/Pumps/Fans/etc.

## 3. The keep-vs-fold rule (D5)

- **Fold:** heat-pumps is *CRUD over four sub-tables* — it belongs on the
  generic `replace_table_slice` surface like every other equipment table.
  Remove the bespoke backend service and the bespoke frontend client.
- **Keep (but share plumbing):** the aperture-command and envelope-command paths
  are *semantic operations* (merge/split, paste, refresh-from-catalog,
  manufacturer-filter) — not row replacement. They stay as command surfaces, but
  their duplicated draft/ETag/size/validation plumbing moves into one shared
  spine that `replace_table_slice` and the command dispatchers all call.

## 4. In scope

- A shared backend write spine (draft load, ETag check, apply, single
  validate, persist, etag bump, body-size guard) used by all write surfaces.
- Heat-pumps backend folded onto the registered contract + spine, preserving the
  delete-cascade and dry-run preview as a generic contract capability (not a
  heat-pump special case); double-validate removed (DOC-3); `tables/heat_pumps.py`
  split as it shrinks.
- Heat-pumps frontend rewired onto the generic table-write client; the bespoke
  `heat-pumps/{api,payload-builders}.ts` removed or reduced to column/field-def
  config only (matching how Ventilators/Pumps are configured).

## 5. Out of scope

- Forcing aperture/envelope semantic commands into the table contract (rejected
  in D5 — it would distort genuine semantic operations).
- The DB-schema / migration / relational work (that's the sibling refactor).
- New tables or fields.

## 6. Success criteria

- No bespoke heat-pump write service remains: `grep` for `JsonPatchOp` /
  `_apply_patch_to_body` is clean; heat-pumps writes go through
  `replace_table_slice`.
- Heat-pump add/replace/delete + delete-cascade + dry-run preview pass their
  existing (or ported) acceptance tests with **identical** outcomes.
- All three backend write surfaces (table replace, aperture commands, envelope
  commands) call the one shared spine; the body-size guard is enforced on each
  (test per surface, including the MCP path).
- The document is validated **once** per write (no model→json→model round-trip).
- Frontend heat-pumps editing uses the generic table-write client; the bespoke
  client is gone or reduced to declarative config; `heat-pumps` matches the
  Ventilators/Pumps shape.
- `make ci` (backend + frontend) green; dev reseed clean.

## 7. Risks & mitigations

- **Highest-risk change in the whole cleanup.** Heat-pumps cascade/preview
  semantics are subtle. Mitigation: port the acceptance tests first, delete the
  bespoke service second; the change moves the logic's *home*, not its behavior.
- **Cross-stack coordination.** Backend wire-shape change forces a frontend
  rewire. Mitigation: phase it — backend spine (P1), backend heat-pumps fold
  (P2, keeping the old endpoint until P3), frontend rewire (P3), then remove the
  old endpoint. Keep the app green at each step.
- **WIP collision.** The aperture-command path and registries are WIP-hot.
  Mitigation: start only after the aperture/glazing-frame v12 WIP lands; rebase
  the spine extraction onto its final dispatcher shape.
