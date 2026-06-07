---
DATE: 2026-06-07
TIME: 16:55 EDT
STATUS: Complete (2026-06-07) — Phase 2 implementation plan for the
        Assembly-Builder hardening pass. Shipped: multi-segment thermal
        hand-calc, thermal input-hash semantics, invalid_geometry and
        broken_material_reference flag tests, three drift states
        (in_sync, customized, source_missing), HBJSON last_layer_outside
        ordering, 8 untested geometry command kinds + pick_project_material,
        paste-assignment no-op short-circuit.
AUTHOR: Ed May (with Claude)
SCOPE: Close the backend test gaps identified in the 2026-06-07 review:
       thermal multi-segment math, thermal input-hash semantics,
       untested command kinds, drift report states, and HBJSON
       layer-ordering on flipped orientation. Steel-stud handling
       (Q-ENV-4) is explicitly out of scope per the 2026-06-07
       resolution of Q-AB-1.
RELATED:
  - ../PRD.md §4 (deferred steel-stud), §7 Q-AB-1 (resolved)
  - planning/code-reviews/2026-06-07/assembly-builder-review.md §4.1
  - backend/features/envelope/thermal.py
  - backend/features/envelope/drift.py
  - backend/features/envelope/hbjson_export.py
  - backend/features/envelope/commands/
  - backend/tests/envelope/
---

# Phase 2 — Backend Test Coverage

## P0. Why this slice

The 2026-06-07 review found that backend tests are layered correctly
(route + Postgres + FakeR2 fake) but leave the parts that matter most
silently uncovered:

- **Thermal multi-segment math is unexecuted.** Both
  `_calculate_parallel_path_r_value` and
  `_calculate_isothermal_planes_r_value` exist precisely to compute the
  ASHRAE Ch. 25 hybrid-layer R-value. Current tests only exercise the
  single-segment fast path. The combinatorial cross-product code at
  `thermal.py:130-141` and the resistor-network code at `163-169` have
  never run under test.
- **`thermal_input_hash` semantics asserted only on length.** A change
  to conductivity, thickness, or material name should each produce a
  predictable hash response (different / different / same). None of
  this is checked.
- **`invalid_geometry` and `broken_material_reference` flag emission
  paths in `thermal.thermal_issues` are unreached.**
- **Three of five drift states untested**: `source_missing`,
  `customized`, `in_sync` (only `drifted` and `source_deactivated` have
  fixtures).
- **HBJSON `last_layer_outside` orientation reversal is uncovered.**
  Layer ordering is the whole point of `_layers_outside_to_inside`.
- **9 command kinds have no direct test**: `update_assembly_type`,
  `delete_assembly`, `flip_orientation`, `flip_layers`, `add_layer`,
  `add_segment`, `update_segment`, `delete_segment`,
  `pick_project_material`. `add_layer` and `delete_segment` have
  non-trivial logic (target-index resolution, `last_segment` 409 guard)
  that is silently uncovered.
- **Service no-op short-circuit** at `service.py:198-209` is a defensive
  branch that costs little to test.

Phase 2 closes those gaps without changing production code (except for
the rare case where a test surfaces a real bug — Phase 1's
`rename_assembly` fix is the only one currently known).

## P1. Acceptance — Phase 2 done when

- [ ] **Thermal multi-segment fixture exists** and exercises both
      methods through a hand-calc:
  - A 2-layer assembly where layer 1 is single-segment insulation
    (e.g., 100 mm at 0.04 W/mK) and layer 2 is hybrid (e.g., 38 mm
    steel stud at 16 W/mK occupying 9% width alongside 0.04 W/mK
    cavity insulation at 91% width on 16" o.c. — pick fixture numbers
    that produce a hand-calculable answer to 2 decimal places).
  - Assert `_calculate_parallel_path_r_value` value within ±0.5% of
    hand calc.
  - Assert `_calculate_isothermal_planes_r_value` value within ±0.5%
    of hand calc.
  - Assert `r_effective` equals the simple average of the two.
- [ ] **`thermal_input_hash` semantics**: four assertions —
  - identical input → identical hash;
  - conductivity change → different hash;
  - thickness change → different hash;
  - material *name* change → same hash (hash covers physics only).
- [ ] **`invalid_geometry` flag**: assembly with a zero-thickness layer
      (or zero-width segment) emits `invalid_geometry` from
      `thermal_issues` and the export route returns a 422 carrying
      that flag in the error payload.
- [ ] **`broken_material_reference` flag**: this branch is downstream of
      the document validator, which already rejects orphan
      `project_material_id` values at save time. Confirm via direct
      `thermal_issues` call (not via the route) that the flag is
      emitted; if the route can never reach this branch in practice,
      add a comment to `thermal.py` documenting that the flag exists
      for defensive depth, and either delete the branch (preferred if
      truly unreachable) or test it through a direct call.
- [ ] **Drift states `source_missing`, `customized`, `in_sync`** each
      have a dedicated test in `test_envelope_catalog_drift.py`.
- [ ] **HBJSON `last_layer_outside` orientation**: a fixture sets the
      assembly's `orientation = "last_layer_outside"` and asserts the
      exported `layers` array is reversed relative to the document
      order, matching the contract in `hbjson_export._layers_outside_to_inside`.
- [ ] **9 untested command kinds** each have at least one happy-path
      pytest. `add_layer` and `delete_segment` additionally exercise
      their conflict cases (`last_segment` 409 guard; target-index
      resolution).
- [ ] **Service no-op short-circuit**: a paste-assignment whose
      assignment matches the current segment values returns HTTP 200
      with no new `draft_etag`.
- [ ] All new tests pass.
- [ ] `make ci` is green.

## P2. Implementation steps

### P2.1 Thermal multi-segment fixture (highest priority)

File: `backend/tests/envelope/test_envelope_thermal_and_export.py`
(extend existing file).

Build a fixture assembly: a single-segment outer layer of mineral wool
(say, 100 mm at λ = 0.040 W/m·K), and an inner hybrid layer with two
segments of equal thickness but **different** conductivity — for
example, 140 mm depth, one segment at λ = 0.040 W/m·K (cavity
insulation) occupying 85% of the width and one segment at
λ = 0.13 W/m·K (a wood-stud-like conductivity) occupying 15%. The
choice of materials is deliberately **non-steel-stud** per Q-AB-1; the
goal is to exercise the multi-segment math, not the steel-stud cavity
correction.

Pick numbers that produce a hand-calculable R per ASHRAE Ch. 25 §4 or
equivalent:

- Parallel-Path: R_eff = (Σ width × R_layer)^(-1) etc. — compute by
  hand, document the calc in the test file's docstring.
- Isothermal-Planes: identical layer thickness across segments means
  the cross-section reduces to a series-parallel resistor network with
  layer-bounded parallel zones. Document the resistor diagram in the
  docstring.

Tolerance: ±0.5% on both methods. The point is to catch regressions in
the math, not to pin a specific implementation detail.

Test layer: this is the one place where a **direct unit test against
`thermal.calculate_assembly_thermal`** is genuinely better than a
route-level test — the failure message stays useful.

### P2.2 `thermal_input_hash` semantics

Same file. Four small tests, each constructs two minimal assemblies and
calls `thermal_input_hash` directly. Cover:

- Identical inputs → identical hash.
- Change `conductivity_w_mk` on one material → different hash.
- Change `thickness_mm` on one layer → different hash.
- Change `name` on one material → same hash.

Document the contract intent in the test docstring: "Hash covers
physically relevant fields only so UI caching is keyed to thermal
identity, not display identity."

### P2.3 `invalid_geometry` and `broken_material_reference` flags

Three small tests:

- `invalid_geometry`: zero-thickness layer → `thermal_issues` returns
  `["invalid_geometry"]`. Confirm the export route returns 422 with the
  flag visible in the payload.
- `invalid_geometry` (segment width): zero-width segment → same.
- `broken_material_reference`: call `thermal_issues` directly with an
  assembly whose segment carries a `project_material_id` not present
  in `tables.project_materials`. If the document validator makes this
  unreachable in the route layer, document that in a comment and
  proceed with the direct-call test only. If the branch can never run
  in any code path, **delete it** as part of this phase rather than
  testing dead code.

### P2.4 Drift state coverage

File: `backend/tests/envelope/test_envelope_catalog_drift.py`.

Three tests:

- `test_drift_marks_source_missing`: catalog row deleted entirely from
  `catalog_materials` (or simulated by setting the join target to a
  nonexistent id). Assert `source_missing`.
- `test_drift_marks_customized`: project material's `is_overridden ==
  True` on at least one field while other fields still match catalog.
  Assert `customized`.
- `test_drift_marks_in_sync`: project material fields exactly match the
  catalog row, no overrides. Assert `in_sync`.

Use the existing `_truncate()` fixture from this file.

### P2.5 HBJSON `last_layer_outside` ordering

File: `backend/tests/envelope/test_envelope_thermal_and_export.py`
(extend the disambig test or add a new one).

Add a test that builds an assembly with `orientation =
"last_layer_outside"` and at least three named layers. Export through
the route. Assert the emitted `layers` order is the document order
**reversed**, matching `_layers_outside_to_inside`.

### P2.6 (intentionally omitted)

Originally planned as a Q-ENV-4 steel-stud verification. Removed per
the 2026-06-07 resolution of Q-AB-1 — steel-stud handling is out of
scope for this hardening pass. Test fixtures in this phase **must
not** set `is_a_steel_stud_cavity` or `steel_stud_spacing_mm`. If a
multi-segment fixture (P2.1) accidentally exercises a steel-stud code
path, choose different conductivity values.

### P2.7 Nine untested command kinds

For each command listed below, add at least one happy-path test under
`backend/tests/envelope/`. Place each in the file whose existing tests
target the same domain (assemblies tests live in
`test_envelope_commands_geometry.py`; material tests in
`test_envelope_commands_materials.py`; etc.).

| Command | File | Notes |
|---|---|---|
| `update_assembly_type` | `test_envelope_commands_geometry.py` | Verify type round-trips through the document; verify Pydantic rejects bad types at the model layer. |
| `delete_assembly` | `test_envelope_commands_geometry.py` | Happy path + 404 for unknown id. |
| `flip_orientation` | `test_envelope_commands_geometry.py` | Toggle behavior — two flips return original. |
| `flip_layers` | `test_envelope_commands_geometry.py` | Verify layer order reverses; segment ids preserved. |
| `add_layer` | `test_envelope_commands_geometry.py` | Cover both "above" and "below" target-index resolution; assert new layer has default thickness from command body. |
| `add_segment` | `test_envelope_commands_geometry.py` | Cover both "left" and "right"; assert width split policy matches `ops.add_segment`. |
| `update_segment` | `test_envelope_commands_geometry.py` | Edit width / CI / spacing — verify only addressed fields change. |
| `delete_segment` | `test_envelope_commands_geometry.py` | Happy path + `last_segment` 409 guard. |
| `pick_project_material` | `test_envelope_commands_materials.py` | Verify the pick is applied to the addressed segment; verify 404 for unknown project_material_id. |

Use existing fixtures and the existing `_envelope_commit` helper (or
its equivalent in each file — read before writing).

### P2.8 Service no-op short-circuit

File: `test_envelope_commands_geometry.py` or a new
`test_envelope_service_noop.py`.

One test:

1. Set up a draft with a known segment assignment.
2. POST a `paste_assignment` command whose `assignment` matches the
   existing segment values byte-for-byte.
3. Assert HTTP 200.
4. Assert the response `draft_etag` is unchanged.
5. Assert no audit-log row was written (if the audit-log surface is
   already tested elsewhere, follow that pattern; otherwise omit and
   document why).

## P3. Verification

- Per-file targeted runs as you go:
  - `cd backend && uv run pytest tests/envelope/test_envelope_thermal_and_export.py -x`
  - `cd backend && uv run pytest tests/envelope/test_envelope_catalog_drift.py -x`
  - `cd backend && uv run pytest tests/envelope/test_envelope_commands_geometry.py -x`
  - `cd backend && uv run pytest tests/envelope/test_envelope_commands_materials.py -x`
- Full suite at end: `make ci` from repo root, green.

## P4. Risks

- **Hand-calc tolerance**: 0.5% feels right; if the math implementation
  rounds at intermediate steps, you may need to widen to 1% or assert
  against a captured reference rather than a pure hand-calc. Document
  whatever you settle on in the test docstring.
- **Steel-stud creep**: the temptation to "while I'm here, just add a
  steel-stud assertion" is real. Resist — Q-AB-1 explicitly defers
  this. If the multi-segment fixture in P2.1 makes it tempting to use
  a steel-like conductivity for the second segment, pick a different
  number (wood-stud or hardwood values work fine for exercising the
  math).
- **Document validator vs `thermal_issues`**: the
  `broken_material_reference` branch may be genuinely unreachable. If
  so, delete it; do not write a defensive test for dead code.

## P5. Out of scope

- Refactoring `thermal.py` internals (defer to a thermal-math feature
  folder if needed).
- New command kinds.
- Frontend tests (covered in Phase 3).
- Anything steel-stud (Q-ENV-4 / Q-AB-1) — explicitly deferred.
