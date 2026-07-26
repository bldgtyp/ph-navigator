---
DATE: 2026-07-26
TIME: 11:05 EDT
STATUS: Phase 1 complete — Phases 2–4 open
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers.
RELATED: ./README.md, ./PRD.md, ../assembly-condensation-risk/STATUS.md
---

# Status

## Phase ledger

| Phase | State | Notes |
| --- | --- | --- |
| **1** — fields + ISO 6946 resolver | ✅ **complete** | `exterior_condition`, `tables.assumptions.thermal_standard`, `boundary_conditions.py`, `update_assembly_exterior_condition`, HBJSON round-trip. No displayed number moved. |
| **2** — fold films into the calculation | ✅ **complete** | Films folded in, tooltip rewritten, PHPP kept construction-only with a regression test, hash extended, citation reconciled. **Every displayed number moved.** |
| **3** — rendering | ⬜ open | |
| **4** — ASHRAE set + selector | ⬜ open | |

### Phase 1 as-built

Delivered:
- `Assembly.exterior_condition: ExteriorCondition = "outdoor_air"` — an
  additive amendment, **no `schema_version` bump** (`context/technical-requirements/data-model.md`
  §6.2 permits this); the default is a faithful no-op for every existing document.
- `ProjectAssumptions` on `tables.assumptions`, holding `thermal_standard`.
  `None` means "all defaults". `ProjectDocumentTables.resolved_assumptions()`
  is the read accessor. This is the block `assembly-condensation-risk` should
  add `condensation_settings` to.
- `backend/features/envelope/boundary_conditions.py` — the ISO 6946 table,
  `heat_flow_direction()`, `resolve_surface_resistances()`, and
  `ISO_13788_SURFACE_CHECK_RSI = 0.25` for the condensation screen.
- `update_assembly_exterior_condition` command (+ `create_assembly` accepts
  the field). No interior counterpart: it is derived from `type`.
- `exterior_condition` rides in the HBJSON `ph_nav` round-trip block;
  foreign files default it, as Honeybee has no construction-level equivalent.

**One deliberate deviation from `PRD.md` §4.2.** The PRD writes
`thermal_standard: "iso_6946" | "ashrae"`. Phase 1 ships
`ThermalStandard = Literal["iso_6946"]` — a single-member literal — and
Phase 4 widens it when the ASHRAE values land. Reason: with both members
settable from Phase 1, a document (via MCP or the API) could hold
`"ashrae"` with no value table behind it, and the resolver would have to
either raise a 500 or silently return ISO numbers. Widening a Literal
later is the same class of additive amendment as adding the field, so
nothing is foreclosed. The field shape, the default, and the
"independent project setting" decision are unchanged.

Verification (2026-07-26): `uv run ty check` clean; `uv run pytest` 1513
passed / 7 skipped; `pnpm exec tsc --noEmit` clean. The schema-fingerprint
guard (`backend/tests/project_document_schema/schema_fingerprint.json`) and
the five golden upgrade snapshots were regenerated; a structural diff
confirmed the **only** change is `tables.assumptions: null` — the corpus
fixtures carry no assemblies, so no `exterior_condition` appears there.

Known gap, pre-existing and not introduced here: the golden upgrade corpus
has zero assemblies in every fixture, so the "old document gains the new
assembly field" path is covered by a model-level test
(`test_existing_assemblies_default_to_outdoor_air`) rather than by the
corpus.

## Original state (2026-07-26, pre-implementation)

**PRD drafted. No code written.** Raised by Ed on 2026-07-26 while resolving
`assembly-condensation-risk` Q-5 (floors on grade), on the observation that the
interior/exterior model doesn't handle ground, ventilated, or surface films.
Investigation confirmed the gap is wider than the original question.

Verified against the codebase, not assumed:
- `thermal.py` adds no Rsi/Rse — the calculation is construction-only by
  construction, so the header's "Effective U-Value" is `1/R_construction`.
- `Assembly.type` is consumed only by `hbjson_export.py`, `hbjson_import.py`, and
  the sidebar icon — it drives no physics.
- No "adjacent to" axis exists; ground, ventilated, and unconditioned assemblies
  are indistinguishable from outdoor-air ones.
- The `air_*` categories are air **cavities** (180 of 408 seeded rows, 1 mm
  thickness increments with an equivalent λ), not surface films.
- ISO 6946 resistance values recovered from the PHI workbook's `Data` sheet;
  ASHRAE equivalents still need extraction and private-DB routing.

Reviewed with Ed 2026-07-26, after reading the honeybee-energy source:
- Confirmed honeybee `OpaqueConstruction` carries no type/direction; films are
  ISO 10292 (glazing), reporting-only; E+ computes its own at runtime.
  PHN's assembly-level type is a deliberate and necessary divergence. (`PRD.md` §1a)
- **Q-B1 resolved: fold films into the thermal calculation.** Every displayed
  U-value moves.
- **Q-B3 resolved: four exterior options.** Initially cut to three on the
  grounds that ISO 6946 gives `unconditioned_space` the same `Rse = Rsi` as
  `ventilated`; **reversed the same day** — identical output today does not
  justify collapsing two different meanings, and the distinction cannot be
  recovered by migration once assemblies have been mislabelled. Ft math deferred
  to `assembly-condensation-risk`.
- **Q-B2 resolved: `other` → horizontal (Rsi 0.13)** — the mid-value and the
  least-wrong default when direction is unknown.
- **Q-B4 resolved: `air_*` cavity materials unchanged.**
- **Q-B5 resolved: the `#assembly-thermal-metric` tooltip is the announcement.**
- **Correction to an earlier claim in this folder:** the header metric does *not*
  overclaim today. `AssemblyHeader.tsx` labels it "Thermal" (not "Effective
  U-Value" — that string is from a stale ASCII mockup in
  `context/ui/pages/envelope-tab.md`) and its tooltip already states films are
  excluded. Phase 2 is therefore a change of convention, not a correctness fix.
- Two wrinkles found in that file: the metric **changes kind by unit system**
  (IP → R-value, SI → U-value), so both branches move and the tooltip title
  ("Effective Thermal Resistance") is IP-only; and the tooltip cites ASHRAE
  Ch. 27 where `thermal.py` cites Ch. 25 — reconcile in the same pass.
- **`thermal_standard` is an independent project setting, default ISO 6946.**
  The earlier "derive from `cert_programs`" idea is withdrawn — projects can be
  both PHI and Phius, or neither.
- Settings consolidated into one versioned `assumptions` block shared with
  `assembly-condensation-risk`.
- UI: the existing `exterior`/`interior` labels become the control.

### Phase 2 as-built

**This is the phase that changed reported numbers.** `r_effective_m2k_w` /
`u_effective_w_m2k` now mean `Rsi + R_construction + Rse`.

- `ThermalResult` / `AssemblyThermalResponse` carry **both** conventions:
  the new `r_construction_m2k_w` / `u_construction_w_m2k` are the old
  numbers under a new name, and `rsi_m2k_w` / `rse_m2k_w` /
  `heat_flow_direction` / `thermal_standard` disclose what was applied.
  The four film fields are never null — they hold even when missing
  materials null every R/U field, which is what Phase 3's interior label
  needs.
- Films add **in series with the PH average**, not inside each parallel
  path, per ISO 13788's `R_total = Rsi + ΣR + Rse`. So
  `r_parallel_path_m2k_w` / `r_isothermal_planes_m2k_w` stay
  construction-only and comparable to each other.
- **PHPP export kept construction-only, structurally.** This was a live
  double-count risk: `phpp_export.py` fed `calculate_assembly_thermal`
  straight into the worksheet's U-value cell while the same sheet declares
  `Rsi: 0.00` / `Rse: 0.00`. Rather than rely on the call site picking the
  right field, `thermal.py` now has two entry points —
  `calculate_construction_thermal()` returns a `ConstructionThermalResult`
  with **no film or effective field on it**, and
  `calculate_assembly_thermal()` wraps that and adds the films. PHPP takes
  the former, so the wrong value is unreachable, not merely untested.
  (Prompted by the altitude review, which correctly noted a naming
  convention plus one test was the only backstop.) Three tests pin it,
  including one asserting the exported value does **not** move with
  `exterior_condition`.
- `thermal_input_hash` gained the standard (it is not in the assembly
  subtree, so a project switching standards would otherwise serve stale
  cached previews).
- Tooltip rewritten (`AssemblyHeader.tsx`): title now tracks the unit
  system ("Effective R-Value" IP / "Effective U-Value" SI), states films
  **are** included, names the standard + Rsi/Rse + heat-flow direction,
  and shows the construction-only value. A frontend test asserts the old
  "are NOT included" sentence is gone.
- Citation reconciled on **Ch. 25** (the tooltip's Ch. 27 was the
  outlier; `thermal.py` and the contract doc both already said 25).

Measured impact on the test fixtures: IP `7.5 → 8.4 h-ft²-F/Btu` on the
1.316 m²K/W wall — the direction and rough magnitude the PRD predicted.

Verification (2026-07-26): `make ci` equivalent green — see below.

## Next step

**Phase 3** — rendering (`PRD.md` §5): exterior label becomes a select,
interior label shows the derived Rsi + heat-flow direction, tinted face
bands with distinct ground/ventilated treatments, no new design tokens.
The backend already returns everything this needs.

`assembly-condensation-risk` Phase 2 is **unblocked from this side** as of
Phase 1: `resolve_surface_resistances()` and `ISO_13788_SURFACE_CHECK_RSI`
are available. It still waits on `assembly-membrane-layers`.

## Dependencies

- **Blocks:** `assembly-condensation-risk` Phase 2 (the engine), alongside
  `assembly-membrane-layers` Phases 1–2.
- **Independent of** `assembly-membrane-layers` — the two can proceed in
  parallel; they touch different parts of the assembly model.

## Blockers

**None.** All design questions resolved 2026-07-26; only a deploy-time
communication detail is open.

| # | Question | Resolution |
| --- | --- | --- |
| ~~Q-B1~~ | Header U-value includes films? | ✅ yes |
| ~~Q-B2~~ | What does `type: "other"` resolve to? | ✅ horizontal, Rsi 0.13 — mid-value, least-wrong default; flagged visibly |
| ~~Q-B3~~ | `unconditioned_space` in the enum? | ✅ **yes, model it; defer Ft** — reverses the earlier same-day "no" |
| ~~Q-B4~~ | Do the `air_*` cavity materials change? | ✅ no — leave unchanged |
| ~~Q-B5~~ | How is the change communicated at Phase 2 deploy? | ✅ rewrite the `#assembly-thermal-metric` tooltip in `AssemblyHeader.tsx`; no in-app banner |

## Verification

Phase 1 gate: `(type, exterior_condition, standard)` resolves a deterministic
`(Rsi, Rse, heat_flow_direction)` triple for every combination, unit-tested
against the ISO 6946 table, **and no existing assembly's displayed thermal result
changes** (`PRD.md` §8, criteria 1–2).
