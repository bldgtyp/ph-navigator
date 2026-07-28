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
neither `total_q` nor `total_area`, emit no warnings, and produce no
per-element result row. Semantics: `window_u_value_w_m2k` stays the
area-weighted average over the real window; `total_area_m2` becomes the true
aperture area (void region is wall — correct for PHPP/takeoffs).

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

## Route-4 HBJSON export — `backend/features/aperture_hbjson_export/service.py`

In `export_apertures` (element loop at ~:73): skip voids — no
`WindowConstruction`, no identifier registered (cannot collide).

## Verify-no-change consumers (tests only, no code expected)

- Spec report / use-sites selectors (`features/apertures/selectors.py`,
  `project_document/apertures/`): a void references nothing → absent from
  `use_sites`. One test with a mixed document.
- Aperture drift (`features/aperture_drift/`): no refs on voids → no drift
  rows. One test.
- MCP `calculate_aperture_u_values` / `get_aperture_type` tools reflect the
  above through the service layer automatically.

## Tests

- Mixed aperture (S15-shaped fixture: 4 cols × 4 rows, door spanning r2–r3,
  two voids at r3): window U equals the weighted average of glazed elements
  only; `total_area_m2` excludes void cells; no warnings from voids.
- Route 3: void elements absent; `row_heights_mm`/`column_widths_mm` full;
  remaining `row_number`/`column_number` untouched.
- Route 4: no construction for voids; identifiers stable for the rest.
- Cache: kind flip → new hash.

Add the S15-shaped fixture as a shared pytest fixture — Phases 4–5 reuse it.

## Verification

`make ci` green. Manual spot-check via MCP against the local fixture project:
build the S15 layout with Phase-2 commands, read back
`calculate_aperture_u_values` and the route-3 JSON.
