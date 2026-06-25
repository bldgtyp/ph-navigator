---
DATE: 2026-06-24
TIME: 18:25 EDT
STATUS: Complete (2026-06-25) — heat-pumps folded onto the registered contract + spine; suite green.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 2 — fold heat-pumps backend onto the registered contract + spine.
RELATED: ../PRD.md, planning/code-reviews/2026-06-24/backend-data-architecture-review.md (DOC-3, DOC-4),
         context/technical-requirements/data-model.md §6.6.7
DEPENDS_ON: Phase 1 (the shared spine + cascade-capable mutate).
---

# Phase 2 — Heat-Pumps onto the Registered Contract (backend)

## Outcome (2026-06-25)
- New `tables/dependent_links.py`: generic, declarative cross-table delete
  cascade — `DependentLink` (config on `TableContract`, lives in `contracts.py`)
  + `apply_dependent_link_cascade` (block required / clear optional inside
  `apply_replace`) + `preview_dependent_link_cascade` (pure analysis backing the
  dry-run). Reuses `read_table_envelope`/`replace_table_envelope`.
- Heat-pump leaf contracts declare `dependent_links` (outdoor-equip←outdoor_units
  required; indoor-equip←indoor_units required + ←outdoor_equip.paired optional;
  outdoor_units←indoor_units.outdoor_unit_id optional) — exactly the old
  block/clear behavior, now config-driven.
- `features/heat_pumps/service.py` rewritten onto the spine: `apply_patch`
  translates a single-row patch → generic slice-replace through the contract;
  dry-run computes the preview without persisting; `apply_option_patch` goes
  through `apply_document_write`. Deleted `JsonPatchOp`/`_apply_patch_to_body`/
  `_validate_slice`/`_delete_preview`/`_apply_delete_cascades` + the
  model→json→model double-validate. service.py 554→403 lines.
- The old `PATCH /equipment/heat-pumps/{table}` endpoints stay alive as a thin
  shim (no bespoke plumbing) until the Phase-3 frontend rewire.
- Verification: `grep` for the deleted symbols is clean (doc comments only);
  `ty` clean; `make ci` green (backend 1111, frontend 1900).
- `test_heat_pumps_rejects_missing_fk` updated: the unified path returns the
  shared validator's `invalid_project_document` (was bespoke
  `heat_pump_validation_error`) — same 422, intended error-envelope unification.
  Delete-block 409 + dry-run preview assertions pass unchanged. Added
  `test_dependent_link_cascade.py` proving the cascade is table-agnostic.

## Deferred follow-ups (recorded, not done)
- **Module split** of `tables/heat_pumps.py`: the plan assumed it would *shrink*,
  but it grew (843→~982) because the generic cascade declarations + leaf
  write-specs live here while the bespoke code that was deleted lived in
  `service.py`. It's a soft ~600 target and a high-churn mechanical extraction
  (re-export wiring for 6+ importers), so deferred. Clean cut if wanted:
  constants + 4 `*_BUILT_IN_FIELD_DEFS` + `*Options`/`*ReplaceRequest`/`*Response`
  models → `heat_pumps_models.py`, re-exported.
- **Rename `heat_pump_delete_blocked`** (in `dependent_links.py`) to a neutral
  code: deferred to Phase 3 since the live frontend still keys on it — a
  wire-contract change must land with the frontend rewire.
- **Migrate ventilators/rooms** off their hand-rolled cross-table cascades onto
  the generic `dependent_links` mechanism (TODO comments left in both files).
  Behavior-preserving but out of this refactor's heat-pumps scope; must keep the
  *silent* (no-preview) UX.

## Goal
Remove the bespoke heat-pumps write architecture. Heat-pump add/replace/delete
goes through the generic registered-contract `apply_replace` → spine, exactly
like Ventilators/Pumps. Preserve the two genuinely-special behaviors —
delete-cascade (clearing dependent unit links) and dry-run preview — but express
them as **generic, reusable contract capabilities**, not heat-pump specials.

## Changes
- Add a contract-level "replace with cascade" capability (an optional hook on the
  `TableContract` the registry already defines) that the heat-pump leaf tables
  opt into; the cascade clears dependent links during the replace mutation
  (mirroring the existing `_apply_patch_to_body` cascade semantics).
- Add a generic dry-run/preview path on the contract surface (return the computed
  diff/cascade effect without persisting) so heat-pumps' preview is preserved
  generically.
- Move heat-pump add/replace/delete onto `replace_table_slice` (→ spine).
- Delete `apply_patch` / `JsonPatchOp` / `_apply_patch_to_body` and the
  double-validate (DOC-3, `heat_pumps/service.py:202`) — the spine validates once.
- Split the now-smaller `tables/heat_pumps.py` (843) if still > ~600 (models vs
  registry/option machinery).
- **Keep the old heat-pumps endpoint alive** (delegating to the new path) until
  the Phase-3 frontend rewire lands, so the app never breaks; remove it in Phase 3.

## Step sequence
1. **Port heat-pumps acceptance tests first** (cascade + preview + ETag) so the
   behavior contract is pinned before any deletion.
2. Add the generic cascade + preview capabilities to the contract/registry.
3. Route heat-pump writes through `replace_table_slice` → spine; keep old
   endpoint delegating.
4. Delete the bespoke service + double-validate.
5. Split the module.

## Acceptance criteria
- `grep` for `JsonPatchOp` / `_apply_patch_to_body` is clean.
- Ported cascade/preview/ETag tests pass with identical outcomes.
- Heat-pump writes validate once and enforce the size guard via the spine.
- Cascade + preview are generic capabilities (another table could opt in), not
  heat-pump-special code.
- `make ci` green; old endpoint still answers (removed in Phase 3).

## Risks
- **The riskiest change.** Cascade/preview must be byte-for-byte behavior-stable.
  Tests-first, delete-last. If the generic cascade hook proves awkward, prefer a
  small generic capability over re-introducing a heat-pump special case.
