---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Not started
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 3 — U-value, cache key, route-3 GH export, route-4 HBJSON export;
  verify spec-report/drift untouched.
RELATED: ../PRD.md §4 §6
---

# Phase 3 — Consumers

## U-value — `backend/features/aperture_u_value/service.py`

In `calculate_aperture_u_values` (the loop at ~:61): `continue` on
`element.kind == "void"` **before** `_calculate_element` — voids contribute to
neither `total_q` nor `total_area`, emit no missing-assignment warnings, and
produce no per-element result row. Semantics: `window_u_value_w_m2k` stays the
area-weighted average over the real window; `total_area_m2` becomes the true
aperture area (void region is wall). NB (review): `total_area_m2`'s only
consumer today is a TS type in `hooks/useApertureUValues.ts` — fix the
semantics, but don't frame "correct PHPP area" as a shipped deliverable.

### New warning kinds (same `ApertureUValueWarning` channel)

- **`no_glazed_elements`** (review F-5): aperture type contains only voids.
  Reachable via `deleteRow`/`deleteColumn`; without this, GH builds nothing
  for faces using the type and nobody is told. Emit at the aggregate level.
- **`mullion_frame_at_void_boundary`** (review F-2, PRD §2.1): a glazed
  element carries a frame whose `mull_type` marks it as a mullion on an edge
  adjacent to a void — that edge is now a window-to-wall junction (jamb /
  sill / head: different width, U_f, and a real Ψ_install where mullions are
  conventionally 0). Adjacency is computable from spans; `mull_type` lives on
  `FrameRef`/`ProjectFrame` (`envelope_models.py:102/:397`). Warning-only —
  never block on it.

## Cache key — `backend/features/aperture_u_value/cache.py:77`

`content_hash_for_aperture` deliberately excludes `name`/`operation`.
**`kind` affects the result and must be included** in the hashed subtree.
Update the function + its docstring (which enumerates exclusions). Add a test:
flipping an element's kind changes the hash; renaming still does not.

## Route-3 GH export — `backend/features/gh_api/aperture_types_export.py`

In `_aperture_type` (:52): emit only non-void elements; grid dims stay full.
**Do not** add any new field to the payload — omission is the contract
(decisions.md A-3): the GH consumer places elements by absolute grid indices,
so old definitions keep working. Duplicate-name rejection unchanged.

### Export guards (422, alongside the duplicate-names guard)

- **Fully-void grid column** in any exported type (review F-1, PRD §6):
  `WindowUnitType.build()` enumerates *occupied* columns positionally, so a
  fully-void column silently shifts every later column left in Rhino. Error
  names the aperture type + column index. This guard is **permanent** — old
  GH installs persist even after the GH-side fix ships. (Fully-void *rows*
  are fine — rows index by value — do not block them.)
- **All-void aperture type** (review F-5): would emit `elements: []` and GH
  would silently build nothing. Error names the type.

## Route-4 HBJSON export — `backend/features/aperture_hbjson_export/service.py`

In `export_apertures` (element loop at ~:73): skip voids — no
`WindowConstruction`, no identifier registered (cannot collide).

## Verify-no-change consumers (tests only, no code expected)

- Spec report / use-sites selectors (`features/apertures/selectors.py`,
  `project_document/apertures/`): a void references nothing → absent from
  `use_sites`. One test with a mixed document.
- Aperture drift (`features/aperture_drift/`): no refs on voids → no drift
  rows. One test.
- **Orphaned refs** (review note): glazed→void clears ref ids but no
  `project_frames`/`project_glazings` GC exists — orphans linger in the spec
  report with empty `use_sites`. Pre-existing (`deleteRow` does the same);
  add a test documenting the behavior. GC itself is out of scope.
- MCP `calculate_aperture_u_values` / `get_aperture_type` tools reflect the
  above through the service layer automatically.

## MCP `list_aperture_types` — `backend/features/apertures_mcp/tools.py:77`

`element_count` counts voids (review note). Add `glazed_element_count`
alongside it (keep `element_count` for wire stability) and note the
distinction in the tool description so agents don't miscount.

## Tests

- Mixed aperture (S15-shaped fixture: 4 cols × 4 rows, door spanning r2–r3,
  two voids at r3): window U equals the weighted average of glazed elements
  only; `total_area_m2` excludes void cells; no missing-assignment warnings
  from voids.
- Warnings: all-void type → `no_glazed_elements`; mullion-`mull_type` frame
  on a void-adjacent edge → `mullion_frame_at_void_boundary` (and no warning
  when the adjacent frame is not a mullion type, or the edge borders glazing).
- Route 3: void elements absent; `row_heights_mm`/`column_widths_mm` full;
  remaining `row_number`/`column_number` untouched; fully-void column → 422
  naming type + column; fully-void **row** exports fine; all-void type → 422.
- Route 4: no construction for voids; identifiers stable for the rest.
- Cache: kind flip → new hash — load-bearing (review-confirmed): a void and
  an unassigned glazed element are otherwise hash-identical, so a stale entry
  would silently return the wrong U-value after Phase 3's skip.

Shared pytest fixtures (Phases 4–5 reuse them):
1. **S15**: the shape above.
2. **Fully-void column** (review): the shape that triggers the F-1 export
   guard — used for guard tests here and the Phase-5 GH assertions.

## Verification

`make ci` green. Manual spot-check via MCP against the local fixture project:
build the S15 layout with Phase-2 commands, read back
`calculate_aperture_u_values` and the route-3 JSON.
