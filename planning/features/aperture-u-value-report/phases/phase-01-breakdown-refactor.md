---
DATE: 2026-07-29
TIME: 14:31 EDT
STATUS: Ready — no prerequisites; first phase on the feature branch
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 1 — parity-locked refactor of the aperture U-value service so
  the per-side intermediates (areas, lengths, heat-loss terms) are emitted
  instead of discarded. Backend only; existing endpoint byte-identical.
RELATED: ../PRD.md §3/§6, ../research.md §1, ../decisions.md §D-2/§D-3,
  backend/features/aperture_u_value/service.py,
  backend/features/aperture_u_value/models.py,
  backend/features/aperture_u_value/cache.py
---

# Phase 1 — Emit the per-side breakdown (parity-locked)

## Goal

`calculate_aperture_u_values` keeps its exact current behavior, and a new
sibling entry point returns the same numbers **plus** every intermediate
the report needs: per-edge frame areas (center strip + two half-corners),
interior lengths, and the individual Q terms. Correctness = "the refactor
changed nothing", proven by tests written *before* the refactor.

## Hazards (read before coding)

1. **Parity is the contract.** The existing endpoint response, the values
   the builder chip and canvas display, and the cache behavior must be
   byte-identical after this phase. Write the pin tests first, against the
   *current* code, then refactor under them.
2. **Do not let names near the cache.** `cache.py`'s content hash
   deliberately excludes `name`/`operation`/`catalog_origin`. The
   breakdown models in this phase carry **ids and numbers only** — names
   join in Phase 2's report service, which does not use this cache.
3. **Public repo** — all test fixtures use synthetic values only (never
   PHI/Phius/manufacturer data).

## Work

1. **Pin tests first** (`backend/tests/test_aperture_u_value_parity.py`):
   run `calculate_aperture_u_values` over in-test synthetic fixtures and
   assert exact current outputs (`u_value_w_m2k`, areas, warning kinds,
   `window_u_value_w_m2k`, `content_hash`). Fixture set:
   - single-element window, four distinct frames (asymmetric widths and
     U's so the 45° corner split is load-bearing);
   - 2×2 grid, mixed glazings, shared mullion frames;
   - element with an **unassigned** frame (`frames.top = None`);
   - element with an **assigned-but-incomplete** frame (null `psi_g_w_mk`);
   - element with missing glazing;
   - `non_positive_glazing_area` case (frames wider than element);
   - aperture with a void element (excluded; rollup over glazed only);
   - all-void aperture (`no_glazed_elements`, U-w = 0).
2. **Breakdown models** (`models.py`, additive):
   `ApertureEdgeBreakdown` — `side: Literal["top","right","bottom","left"]`,
   `frame_id`, `width_m`, `u_value_w_m2k`, `psi_g_w_mk`,
   `psi_install_w_mk` (informational passthrough), `edge_length_m`,
   `interior_length_m`, `center_strip_area_m2`, `corner_area_a_m2`,
   `corner_area_b_m2`, `frame_area_m2`, `q_frame_w_k`, `q_spacer_w_k`.
   `ApertureElementDetail` — existing element fields + `glazing_id`,
   `glazing_u_w_m2k`, `glazing_g_value`, `width_m`, `height_m`,
   `interior_width_m`, `interior_height_m`, `q_glazing_w_k`,
   `q_frame_total_w_k`, `q_spacer_total_w_k`,
   `edges: list[ApertureEdgeBreakdown]`.
   `ApertureUValueDetailResult` — mirrors `ApertureUValueResult` with
   detail elements.
3. **Refactor `service.py`**: `_side_frame_q` returns the edge breakdown
   (keep a thin wrapper or sum at the call site for the legacy path);
   `_calculate_element` builds `ApertureElementDetail`; the legacy
   `ApertureElementUValue` is derived *from* the detail (single source of
   math — no parallel computation paths). New public
   `calculate_aperture_u_values_detailed(entry, tables)`; the legacy
   function delegates to it and projects down.
4. **Sharpen the missing-frame distinction** (PRD §6.3): new warning kind
   `incomplete_frame_data` (assigned frame with null `width_mm` /
   `u_value_w_m2k` / `psi_g_w_mk`, naming the null fields) vs the existing
   `missing_frame` (no assignment). Grep frontend + MCP consumers for
   switches on warning `kind` before adding (research says only
   `warnings.length` is consumed today — verify). This is the one
   *deliberate* delta from parity; pin tests assert the new kinds
   explicitly.
5. **Detail invariant tests**: for every fixture element,
   `Σ edge.frame_area == frame_area_m2` (6dp), `q_glazing + Σ q_frame +
   Σ q_spacer == u_value * area` (pre-rounding), corner halves symmetric
   with adjacent edges, void elements produce no detail rows.

## Out of scope

Routes, report DTOs with names, SHGC rollup, exports, caching changes,
frontend, MCP.

## Verification

Pin tests green before and after the refactor with unchanged expected
values (except the named warning-kind delta); invariant tests green;
`make check-backend`; existing aperture/MCP test suites untouched and
green; `make ci` before hand-off.
