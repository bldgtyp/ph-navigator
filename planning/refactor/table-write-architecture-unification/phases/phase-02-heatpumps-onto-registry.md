---
DATE: 2026-06-24
TIME: 18:25 EDT
STATUS: Ready (Phase 1 complete 2026-06-25) — next phase to implement
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 2 — fold heat-pumps backend onto the registered contract + spine.
RELATED: ../PRD.md, planning/code-reviews/2026-06-24/backend-data-architecture-review.md (DOC-3, DOC-4),
         context/technical-requirements/data-model.md §6.6.7
DEPENDS_ON: Phase 1 (the shared spine + cascade-capable mutate).
---

# Phase 2 — Heat-Pumps onto the Registered Contract (backend)

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
