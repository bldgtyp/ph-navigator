---
DATE: 2026-06-24
TIME: 18:05 EDT
STATUS: Blocked (aperture v12 WIP must land; confirm D5)
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 4 — one CRUD write path for document tables; one shared spine for semantic commands.
RELATED: ../decisions.md (D5), ../PLAN.md,
         planning/code-reviews/2026-06-24/backend-data-architecture-review.md (DOC-3, DOC-4),
         context/technical-requirements/data-model.md §6.6.7 (registered table contract)
DEPENDS_ON: aperture v12 WIP merged; D5 resolved; Phase 3 landed (size guard moves through this boundary).
---

# Phase 4 — Unify the Table-Write Architecture

## Goal

The extensibility headline. Make adding/editing a document table go through
exactly **one** CRUD write path, and give the legitimately-distinct *semantic
command* paths **one** shared draft/ETag/size/validation spine. Today
heat-pumps is an unjustified second write architecture, and three paths
(heat-pumps, aperture commands, envelope commands) each re-implement the same
draft plumbing.

## Background
The registered table contract (`tables/registry.py`, `data-model.md` §6.6.7)
already keeps generic routes table-agnostic for 16 of 17 tables via
`replace_table_slice` (`drafts.py:94`). Heat-pumps (`heat_pumps/service.py:115`)
is the exception: it registers four `TableContract`s *and* keeps a bespoke
`apply_patch` / `JsonPatchOp` / `_apply_patch_to_body` service with its own
delete-cascade, dry-run preview, ETag handling, draft creation, and a redundant
double-validate (DOC-3, `service.py:202`).

## Changes

### 4.1 Fold heat-pumps onto the registered contract (DOC-4, D5)
- Move heat-pump add/replace/delete onto the generic `apply_replace` surface so
  the four heat-pump leaf tables behave like every other equipment table.
- **Preserve exactly**, only relocate: the delete-cascade semantics (clearing
  dependent unit links) and the dry-run preview. Express the cascade as a
  contract-level hook on the registry rather than a bespoke service, if the
  registry supports it; if not, add a minimal, generic "replace with cascade"
  capability the contract can opt into (so it's reusable, not heat-pump-special).
- Remove `apply_patch`/`JsonPatchOp`/`_apply_patch_to_body` and the
  double-validate (DOC-3) — the single write boundary validates once.

### 4.2 `heat_pumps.py` split falls out (§6.3)
With the bespoke write path gone, `tables/heat_pumps.py` (843) shrinks; split
the remaining Pydantic models from the registry/option machinery if still > ~600.

### 4.3 Extract the shared write spine (D5)
Aperture-command (`aperture_commands/dispatcher.py`) and envelope-command
(`envelope/commands/registry.py`) paths stay — they are semantic operations
(merge/split, paste, refresh-from-catalog, manufacturer-filter), not row
replacement. But their duplicated "load draft → check ETag → apply → validate →
persist → bump etag → enforce size guard" plumbing should move into one shared
helper (e.g. `project_document/write_spine.py` or extend `drafts.py`) that all
three surfaces — `replace_table_slice`, aperture commands, envelope commands —
call. The Phase-3 body-size guard lives here, so it applies uniformly.

### 4.4 Size-guard coverage check
Confirm the Phase-3 `MAX_BODY_BYTES` guard now sits on the single spine and
covers every write path (browser + MCP, table replace + semantic command).

## Step sequence
1. 4.3 extract the shared spine first (gives heat-pumps a target to land on).
2. 4.1 move heat-pumps onto the contract + spine; preserve cascade/preview with
   dedicated tests *before* deleting the bespoke service.
3. 4.2 split the shrunk module.
4. 4.4 verify guard coverage.

## Acceptance criteria
- No bespoke heat-pump write service remains; `grep` for `JsonPatchOp` /
  `_apply_patch_to_body` is clean.
- Heat-pump add/replace/delete + cascade + dry-run preview pass their existing
  (or ported) acceptance tests with identical outcomes.
- All three write surfaces call the one shared spine; the size guard is enforced
  on each (test per surface, incl. MCP).
- The document is validated **once** per write (no model→json→model round-trip).
- `make ci` green; reseed clean.

## Risks
- **Highest-risk phase.** Heat-pumps cascade/preview semantics are subtle —
  port tests first, delete second. Keep the change behavior-preserving; only the
  *home* of the logic moves.
- **WIP collision** — the aperture-command path and registries are WIP-hot;
  start only after that lands, and rebase the spine extraction onto the WIP's
  final dispatcher shape.
