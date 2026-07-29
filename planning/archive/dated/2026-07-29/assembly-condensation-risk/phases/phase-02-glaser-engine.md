---
DATE: 2026-07-28
UPDATED: 2026-07-29
TIME: 22:52 EDT
STATUS: Complete — pure engine, synthetic PHI-workbook goldens, and edge-case
  matrix pass; route, persistence, and UI remain Phase 3+
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 2 — the pure ISO 13788 engine and its golden tests against the
  PHI workbook. Backend only; no routes, no persistence, no UI.
RELATED: ../research.md §§3/5, ../PRD.md §7, ../decisions.md §D-1/§D-8/§D-9/
  §D-13/§D-15, backend/features/envelope/thermal.py,
  backend/features/envelope/boundary_conditions.py,
  backend/features/envelope/membranes.py
---

# Phase 2 — The Glaser engine + golden tests

## Goal

A pure, deterministic, I/O-free function that reproduces the PHI workbook:

```
calculate_assembly_condensation(
    assembly, materials_by_id, climate_record, film_table, settings
) -> CondensationResult
```

Correctness provable by golden files before any product surface exists.

## The two standing hazards (read before coding)

1. **"Layers" ≠ "layers with an R-value"** (§D-15d). Membranes contribute
   **nothing** to the temperature profile and **dominate** the vapour
   profile. Every layer loop must state which set it iterates. This is the
   single most likely source of a silent wrong answer, and the membrane
   packet's five defects were mostly found in review, not by a green suite.
2. **No I/O in the engine** (§D-15c). Film table, climate record, and
   settings are arguments resolved at the service edge (Phase 3). The
   boundary-conditions work proved the alternative is an import cycle.

## Work

1. **Module + types** — `backend/features/envelope/condensation.py` (split to
   a `features/condensation/` sibling only if it outgrows one module).
   `CondensationSettings` (the engine-side input model mirroring PRD §5's
   `condensation_settings`, with the zero-config defaults:
   `iso13788_continental` / `normal` / `ma_limit_g_m2 = 200`);
   `CondensationResult` carrying the status/issues/flags triple in
   `thermal.py`'s shape, all four criteria, monthly gc/Ma series, per-layer
   monthly profiles, interface set, caveats, diagnostics, worst-path id.
   Named flag per distinguishable cause (`ThermalStatusFlag` /
   `no_thermal_layers` pattern); `unknown` never collapses into `pass`
   (`air_barrier.py` rule).
2. **Method parameters in code** (pipeline §D-11 line, values cited to
   ISO 13788 in the implementing code): psat coefficient pairs (≥ 0 °C and
   < 0 °C branches, `research.md` §3.1), δ₀ = 2×10⁻¹⁰, occupancy-class RH
   ramps, humidity-class Δp ramps, `sd = 0.01 m` for air categories.
3. **Per-layer sd resolution ladder** (PRD §4.1, exactly): sd wins → µ·d →
   air-category 0.01 m → **undetermined blocks**. A membrane
   (`membranes.is_membrane_layer()`) with no sd **blocks** — never µ·d, never
   air (E-6b). All-membrane assembly → named flag, no crash (E-6c). Σsd = 0
   guard (E-9).
4. **Temperature profile** — films via the passed-in
   `resolve_surface_resistances()` result; the second
   `ISO_13788_SURFACE_CHECK_RSI = 0.25` for the three surface criteria; roof
   −2 K on `type == "roof"` applied to the **temperature profile only**, with
   the E-16 rule pinned: interstitial detection covers interior interfaces;
   boundary nodes belong to the surface criteria.
5. **Interior climate models** (§D-13): continental (θi ramp 20→25 °C, φi
   class ramps, offset ±0.05), humidity-class (Δp on exterior vapour
   pressure + `setpoint_temp_c` for θi), fixed setpoint. Exterior φe derived
   from `dewpoint_c`; validate per-month `dewpoint_c ≤ air_c`, clamp φe to
   1.0 with a climate-data caveat (E-8).
6. **Glaser construction** — condensing-interface detection, tangent
   re-draw, gc per §3.5, monthly Ma with the zero clamp (E-10), start-month
   derivation over all 12 candidates with E-15's degenerate cases:
   non-closure **is** the d4 verdict, canonical display month = month after
   the annual Ma minimum, which also breaks multi-close ties (AC 16).
   Direction-agnostic throughout — summer reverse drive is a first-class
   result, not a special case (E-18).
7. **Path enumeration** (§D-1): reuse `thermal.py`'s parallel-path product;
   run every path, cap at 64, beyond the cap fall back to widest-segment with
   a named flag; report the worst path by verdict severity then peak Ma.
   Membranes are single-segment and never multiply paths.
8. **Verdicts, caveats, diagnostics** — d1–d4 + the three all-12-month
   surface criteria; caveats: high-storage (any `masonry` category),
   multiple interfaces ≥ 2 (§D-8, low-confidence state); diagnostics:
   `ventilated` stack-convention check (outermost layer is air-cavity or
   membrane → named diagnostic, E-17/AC 15); `ground` /
   `unconditioned_space` → not-screened status (Q-8 as decided in Phase 0).
9. **Golden tests** — fixtures with **synthetic µ/sd values** run through the
   PHI workbook locally (AC 7; film-fixture precedent `b869a8fc`). Cases:
   a reference wall (agreement on monthly gc, Ma, interface count, all four
   verdicts, to rounding — AC 3); a roof in a cold humid month (pins E-16
   against the workbook's own behaviour); a membrane-dominated wall (sd-wins,
   AC 10); a summer reverse-drive case (E-18); a d4 non-closing case (E-15).
   Plus unit tests per edge case E-1…E-11 and the cap fallback.

## Out of scope

Routes, services, caching, persistence of settings, UI, MCP.

## Verification

Golden agreement (AC 3); the blocked/exempt behaviours (AC 4, 10, 11); purity
(AC 13 — the backend-boundaries check passes with no storage import); AC 15/16
engine-side; `make ci` green. Then stop and re-read hazard 1 once more against
the diff before calling it done.

## Result — 2026-07-29

- Added the I/O-free typed engine in
  `backend/features/envelope/condensation.py`. It resolves all three interior
  climate models, the exact sd ladder, ISO surface films, the roof −2 K profile
  adjustment, bounded path enumeration, Glaser tangent profiles, raw monthly
  gc, zero-clamped Ma, d1–d4, caveats, diagnostics, and deterministic start
  months.
- Physical-layer and thermal-layer semantics remain separate: membranes retain
  their thickness/sd nodes, contribute zero R, and require direct sd. The final
  hazard review and independent quality review traced that distinction through
  path construction, temperature nodes, vapour nodes, and interface labels.
- Added 35 focused regressions plus the synthetic golden fixture at
  `backend/tests/fixtures/condensation/phi_reference_wall.json`. A locally
  recalculated PHI-workbook copy agrees on all 12 wall and roof gc/Ma values,
  interface counts, surface criteria, verdict, and peak/final Ma to `1e-6`.
  The workbook is not redistributed and no licensed material value entered the
  fixture.
- Explicit coverage pins direct-sd membranes, missing membrane sd, all-membrane
  stacks, air-layer sd, zero total sd, ground/unconditioned exclusions,
  impossible dew-point clamping, fixed/humidity settings, ventilated-stack
  diagnostics, 81-path fallback, orientation, all four verdicts, d4 canonical
  display month, summer reverse drive, and multiple active interfaces.
- The workbook comparison caught two pre-review defects: gc now preserves raw
  drying potential while only Ma clamps at zero, and fRsi no longer creates a
  denominator-sign failure when exterior air is warmer than indoors.
- Simplify review reused `membranes.assigned_materials()` and cached
  path-invariant R/sd/thickness profiles. Focused Ruff, `ty`, pytest, and the
  backend-boundary check pass. `PYTEST_WORKERS=0 make ci` passes: backend
  1704 passed / 7 skipped; frontend 247 files / 2314 tests; production build
  and version-marker checks pass.
- No route, storage lookup, document setting, cache, or UI was added. Phase 3
  owns that service-edge and product surface.
