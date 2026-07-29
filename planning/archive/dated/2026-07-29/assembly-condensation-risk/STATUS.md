---
DATE: 2026-07-26
UPDATED: 2026-07-29 (implementation complete)
TIME: 08:47 EDT
STATUS: Complete — verified; production data apply remains operator-held
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers for the condensation-risk feature.
RELATED: ./README.md, ./research.md, ./PRD.md, ./decisions.md
---

# Status

## State

**Phases 0–5 complete. Material vapour data is available end-to-end, the
licensed local seed drill is proven, the pure ISO 13788 engine agrees with
synthetic PHI-workbook goldens, and every assembly now has a live route, chip,
complete blocked/not-screened correction workflow, and actionable verdict and
profile diagrams, number tables, and versioned assumptions editor.**

Done:
- Full teardown of `PHI_CondenstationTool_March_v1.7.5.xlsx` — all six sheets,
  formulas extracted (not just values): saturation-pressure equations, layer
  R/sd/δ derivations, the Glaser tangent construction, gc/Ma accumulation, the
  four verification criteria, the four interior-climate models, and the national
  Ma-limit reference tables. → `research.md` §§1–3, 5.
- Input inventory mapped against the live PHN data model
  (`envelope/models.py`, `project_document/envelope_models.py`,
  `climate/record.py`, `envelope/thermal.py`, `catalog_materials` baseline
  migration). → `research.md` §4.
- Material-property analysis (µ vs sd vs permeance, US-unit conversions,
  verified against ISO 10456's 6-mil-poly value). → `research.md` §6.
- Feature interrogated from seven angles; verdict **build, conditionally**. →
  `decisions.md` Part 1.
- Eight design decisions taken or recommended, 14 edge cases enumerated, 7
  blocking open questions raised. → `decisions.md` Parts 2–4.
- Product contract drafted incl. progressive-disclosure modal design and a
  six-phase plan. → `PRD.md`.

Added 2026-07-26 (Ed's review of the above):
- **Q-2 resolved** — worst-of-all-paths, bounded enumeration (`decisions.md` §D-1).
- **Uncertainty caveats designed** as a named set rather than one flag, because
  capillary-active and high-storage materials fail in *opposite* directions and
  imply different actions. v1 fires two caveats derived from existing categories
  with **no new fields**; the per-material `moisture_behavior` enum is v1.1.
  (`decisions.md` §D-9)
- **Membrane layers spun out as a prerequisite feature** —
  `planning/archive/dated/2026-07-26/assembly-membrane-layers/` (complete). Membranes and coatings dominate
  a wall's sd, and PHN could represent neither; the engine must not ship before
  they land. (`decisions.md` §D-10, `PRD.md` §2a) — **shipped 2026-07-26.**

Resolved 2026-07-26 (Ed, second review) — **all seven open questions closed**:
- Q-1 build it (with a preliminary coverage read in `decisions.md` §D-12 that
  surfaced the composite stud-material problem); Q-3 µ values live in the private
  DB; Q-4 confirmed against the tool, with two corrections in §D-13; Q-5 floors
  on grade excluded — **and the underlying boundary-condition gap became a second
  prerequisite feature** (§D-11); Q-6 per-project Ma limit, default 200; Q-7
  screen-only preview, no export, no download-report affordance (§D-14).

### As-built reconciliation, 2026-07-28

Both prerequisites are shipped and deployed. Reviewing their archived packets and
the merged code produced four tightenings to this packet, recorded in
`decisions.md` §D-15 — none a reversal:

- **The "sd wins" rule is now load-bearing.** A membrane's `thickness_mm` is not
  drawn to scale, is excluded from Total Thickness, carries no R, and is
  **auto-snapped to 1 mm** by `membranes.should_snap_membrane_thickness` when
  implausible. `µ · d` on a membrane would read a number the app itself mutates.
  A membrane with no `sd` now **blocks** rather than falling through.
- **Total Thickness excludes membranes** (reversed 2026-07-27; moved to
  `membranes.total_thickness_mm`). Cosmetic here, but the chip sits beside that
  metric.
- **The engine must take its film table and climate as arguments.** The
  boundary-conditions work drafted the lookup inside `thermal.py` and produced a
  real import cycle through the storage layer. `calculate_assembly_thermal
  (assembly, materials_by_id, film_table=…)` is the shipped shape to copy.
- **"Layers" ≠ "layers with an R-value."** The membrane packet's closing lesson,
  worth five defects — four found in review, not by a green suite. Glaser
  inverts the bias: membranes contribute nothing to the temperature profile and
  dominate the vapour profile. Highest-risk source of a silent wrong answer in
  Phase 2.

Two obligations came back **to** this feature from the boundary-conditions work:
Ft for `unconditioned_space` (nothing models the far-side temperature → new Q-8,
recommendation is "not screened" in v1), and the disclosed seam that
`ventilated` / `unconditioned_space` apply ISO 6946 §6's `Rse = Rsi` under
whichever standard is loaded.

Also inherited, and directly reusable: `ThermalStatusFlag` gained
`no_thermal_layers` (the named-flag-per-cause pattern), and
`envelope/air_barrier.py` keeps `unknown` strictly distinct from `pass` — the
same rule this feature's blocked state needs.

### Independent review pass, 2026-07-28 (Fable 5)

Full packet re-verified against the merged code (every inherited-API claim,
the seed-file counts, the unit conversions, and the psat/gc formulas check
out). Five corrections applied directly to the docs:

- **Schema-version claim fixed** — `PRD.md` §4.2 and §D-4 called for a no-op
  `schema_version` bump; the shipped precedent (`air_permeance…`,
  `exterior_condition`, both commented "additive amendment, no bump" in
  `envelope_models.py`) needs **no bump at all**. STATUS had it right; the
  other two docs now agree.
- **Golden-fixture licensing corollary added to §D-7** — AC 3's gold files
  need µ inputs, and ISO 10456 values are licensed; fixtures use synthetic
  values run through the workbook locally (film-store precedent, `b869a8fc`).
  AC 7 amended to say so.
- **The µ seed had no phase** — Q-3 decided *where* the values live, but
  nothing scheduled building the dataset, loader, and production seeding run.
  Folded into Phase 1 (`PRD.md` §8).
- **`ventilated` stack convention made explicit** (`PRD.md` §6.5, E-17, AC 15)
  — ISO 6946 §6 assumes the assembly is modelled only inboard of the cavity;
  nothing truncates layers, and a vapour-tight cladding modelled outboard
  would fabricate a condensation trap. Engine emits a named diagnostic.
- **Four edge cases added, one extended** — E-15 start-month non-closure
  (non-closure *is* d4; canonical display month; also the multi-close
  tie-break — AC 16), E-16 roof −2 K vs exterior vapour pressure, E-18 summer
  reverse drive (direction-agnostic UI), and E-8 extended to cover
  `dewpoint_c > air_c` records (φe > 100 %).

### Phase planning pass, 2026-07-28 (Fable 5)

- **The licensed-data pipeline went from decision to machinery.** Its Phases
  1–3 are implemented (pipeline STATUS 2026-07-28): the private
  `bldgtyp/ph-navigator-data` repo publishes schema-validated, versioned
  datasets to R2 via CI (immutable keys, manifest-last), and PHN's
  `backend/features/datasets/` feature (registry, `applied_datasets` audit
  table, guarded `datasets_status`/`datasets_apply` CLIs) is merged on the
  `feat/licensed-data-pipeline` branch. **The D-7/Q-3 "data issue" is
  resolved in mechanism, not just in principle** — what remains for the µ
  seed is content (Phase 0's roster) and columns (Phase 1), exactly the split
  recorded in the pipeline's `phases/phase-04-mu-dataset-dry-run.md`.
- **Six phase plans drafted** under `./phases/` (00–05), mapping 1:1 to
  `PRD.md` §8 and folding in the §D-15 as-built lessons, the E-15…E-18 edge
  cases, and the pipeline hand-off points.
- **Phase 0 coverage probe complete** — deterministic catalog coverage is
  381/408 rows (93.4%) before per-product entry; the proposed private dataset
  roster has 201 stable ids; 26 proprietary rows remain product-entry and one
  generic Stone row remains unmappable. The committed dev-seed assembly proxy
  resolves 5/5 layers and 2/2 outdoor-air/ventilated assemblies.
  Composite rows use their named cavity/base family with a caveat, and
  `unconditioned_space` is not screened in v1. Ed explicitly accepted both
  policies on 2026-07-29. Go. See `phases/phase-00-report.md`.

Completed 2026-07-29:
- **Phase 1 Part A:** nullable µ/sd fields landed across the catalog DB/API,
  public import/export, project documents, drift/refresh, table unit metadata,
  and both material editors. SI/IP conversion and backwards compatibility are
  covered by focused tests and live browser verification.
- **Phase 1 Part B:** the private 201-row `iso10456-vapor-mu` dataset, typed
  `db_seed` registry/applier, and full local MinIO/Postgres drill are complete.
  The drill proved loud unmatched reporting, 201/201 matching after stable
  catalog seeding, idempotent re-apply, a one-row v2 change, and rollback to
  reviewed v1. Final status is clean; no licensed value entered this repo.
- **Production remains held:** no production publish/apply was run.
- **Phase 2:** the pure typed condensation engine, bounded worst-path
  enumeration, blocked/not-screened states, d1–d4 verdicts, caveats,
  diagnostics, and all monthly profiles are implemented. Thirty-five focused
  tests pass, including exact synthetic PHI-workbook agreement for wall and
  roof gc/Ma/interface results, direct-sd membranes, summer reverse drive, d4
  non-closure, and the 64-path cap. The backend boundary check confirms the
  engine has no storage dependency.
- **Phase 3:** persisted zero-config assumptions, project climate resolution,
  a bounded input-hash cache, and the version-scoped condensation route now
  serve live draft or saved results. The header exposes all eight chip states;
  the wide modal's blocked state groups missing materials/layers, focuses µ or
  membrane sd correctly, links to Climate, explains excluded boundaries, and
  refreshes after envelope or climate writes. Focused backend/frontend suites
  and the live edit roundtrip are green.
- **Phase 4:** the screened modal now carries risk-framed d1–d4 verdicts,
  worst-path and caveat disclosure, four criterion tiles, a 12-month
  accumulated-Ma plot with the selected limit, and month-selectable
  vapour-pressure/temperature profiles on sd or physical-thickness axes.
  Chart thresholds extend their domains rather than clipping. Component tests
  cover all verdict and caveat variants; the clear live route was browser-smoked
  through month/axis interactions with no horizontal overflow.
- **Phase 5:** three shared read-only DataTables expose the selected-month layer
  intermediates, 12-month cycle, and per-interface accumulation. Quantitative
  fields use the shared Unit-field header/bare-cell pipeline, follow SI/IP
  display, and omit view controls on this fixed analytical screen. The
  Assumptions tier shows monthly
  exterior climate, edits all three interior models and Ma limit through a
  complete versioned settings command, and discloses method facts plus
  per-material provenance. Live verification proved settings/hash/chip updates
  for humidity-class and fixed models without reload, then restored the default
  continental/normal block. Invalid persisted settings remain repairable.

Feature implementation is complete. No production licensed-data publish/apply
was run.

## Next step

**Operator-held production data sequence only:** Ed dispatches the existing
licensed-data pipeline after its production secrets/deploy/manifest checks.
That action is not part of this implementation branch and remains intentionally
held.

## Blockers

**All seven original open questions are resolved** (`decisions.md` Part 4). What
remains is sequencing, not decisions:

| Blocker | Nature |
| --- | --- |
| ✅ `assembly-boundary-conditions` | **cleared — all four phases, 2026-07-26 → 2026-07-28.** `boundary_conditions.py` exposes `resolve_surface_resistances()` → `(Rsi, Rse, heat_flow_direction)` and `ISO_13788_SURFACE_CHECK_RSI = 0.25`. Films are now in the thermal metric; `Assembly.exterior_condition` has four values; `thermal_standard` carries both ISO 6946 (in code) and ASHRAE (private object store), with a typed 409 rather than a fallback when a table is unpublished. Archived to `planning/archive/dated/2026-07-28/assembly-boundary-conditions/`. |
| ✅ `assembly-membrane-layers` **Phases 1–2** | **cleared 2026-07-26** — in fact all four phases shipped. Assemblies hold membrane layers, which are excluded from the R calculation and carry the `air_permeance_l_s_m2_at_75pa` datum. Archived to `planning/archive/dated/2026-07-26/assembly-membrane-layers/`. It deliberately did **not** land the vapour fields (its Phase 1 was scoped to air permeance), so `vapor_diffusion_resistance_mu` + `vapor_sd_equivalent_m` are **this feature's Phase 1**, exactly as `PRD.md` §4 and §8 already specify. Not a shared or unowned field — see the note below. |
| ✅ Composite stud materials | Phase 0 accepted the named cavity/base family plus an uncertainty caveat; real segments remain the encouraged model. |
| ✅ `planning/features/licensed-data-pipeline/` **Phases 1–2** | **Mechanics implemented 2026-07-28** — publisher + CI in `ph-navigator-data` (branch `b0bd933`), PHN `datasets` feature (registry, `applied_datasets`, guarded CLIs) in `06064906`. Phase 4's private µ payload and local db-seed drill completed 2026-07-29. Only the *production* publish/apply waits on Phase 3 + Ed's dispatch. |
| ✅ **Q-8 — screen `unconditioned_space`?** | **No in v1.** Report not screened because Ft is not modelled; a nullable `adjacent_temp_factor` remains additive v1.1 scope. |
| ✅ Occupancy-class default | `decisions.md` §D-13b — `normal`, a knowing departure from PHI's `low`/EN 15026 suggestion. Signed off by Ed 2026-07-26. |

**All external prerequisites are cleared, including the pipeline's mechanics.**
The remaining Ed-gated external event is the pipeline's production sequence,
which gates just the production µ apply.

### The vapour fields are this feature's own work, not a dependency

`vapor_diffusion_resistance_mu` (µ) and `vapor_sd_equivalent_m` (sd) are
specified in `PRD.md` §4 — units, constraints, the four-step per-layer
resolution ladder, and the `sd ≥ 1500 m` convention for a vapour-tight layer —
and scheduled as **Phase 1** in §8. They need no separate feature packet: they
have exactly one consumer, the Glaser engine in Phase 2, and a field pair whose
only user is the feature that defines it is not a feature.

The earlier "whichever feature ships first should land that field" note was
about sequencing two features that were then running in parallel. That
ambiguity is gone. `air_permeance_l_s_m2_at_75pa` (shipped 2026-07-26) is a
complete worked example of threading one nullable material field end-to-end —
migration, catalog columns, document model, drift keys, refresh choices,
import/export, both editors, SI/IP display — and confirms the additive-field
path needs no document schema-version bump, only a regenerated fingerprint and
corpus snapshot.

## Verification

Phase 0 evidence is in `phases/phase-00-report.md`: 408 catalog rows accounted
for, 201 stable target ids, no licensed values, and a committed dev-seed proxy
resolving 5/5 layers and 2/2 screened assemblies. Phase 2 satisfies acceptance
criterion 3 in `PRD.md` §9: the committed synthetic fixture agrees with a
locally recalculated PHI workbook on the wall and roof monthly outputs to
`1e-6`; the workbook and licensed material values are not redistributed.

Both prerequisite packets ended up finding most of their real defects in review
or in a browser rather than from a green suite (membranes: five defects, four
found in review; boundary conditions: two rendering defects only a real browser
caught). Budget for that here — a passing `pytest` will not tell you the Glaser
engine is iterating the wrong set of layers.

### Acceptance evidence

| AC | Evidence |
| --- | --- |
| 1 | Phase 1 threaded nullable µ/sd through catalog/project models, drift, HBJSON and PHPP regressions; full `make ci` remains green. |
| 2 | `test_missing_climate_and_vapor_are_200_blocked_states` loads the additive document shape and returns a typed blocked payload rather than an error. |
| 3 | `test_reference_wall_matches_locally_recalculated_phi_workbook_golden`, `test_roof_profile_offset_matches_locally_recalculated_phi_workbook_golden`, and the membrane golden agree to the committed tolerance using synthetic inputs. |
| 4 | `test_air_layer_uses_iso_sd_exemption` proves air cavities do not block. |
| 5 | `test_layer_thickness_command_invalidates_the_live_result` proves the input hash changes; the frontend's assembly-scoped invalidation refreshes the open chip/result without reload. |
| 6 | `test_settings_zero_config_defaults_are_versioned_method_defaults` plus the fresh-project route/browser flow proves tier 4 is not required to compute. |
| 7 | Golden inputs are synthetic; repo/source scans and full CI confirm no PHI/ISO/ASHRAE licensed table is committed here. The 201-row µ payload remains private. |
| 8 | Verdict/component tests and the user-facing source scan contain no pass/fail verdict copy. |
| 9 | `test_reference_wall_returns_complete_monthly_profiles_and_masonry_caveat` plus chip/panel tests prove masonry always caveats and a caveated clear is muted. |
| 10 | `test_direct_sd_wins_over_mu_times_thickness` and `test_membrane_uses_direct_sd_and_contributes_zero_thermal_resistance` prove nominal membrane thickness cannot move the result. |
| 11 | `test_membrane_without_direct_sd_blocks_even_when_mu_exists` proves the missing membrane and corrective path. |
| 12 | Engine and route parameterized boundary tests return not-screened for `ground` and `unconditioned_space`. |
| 13 | The engine takes climate/film/settings arguments; `scripts.check_backend_boundaries` passes in `make ci`. |
| 14 | Input-hash tests cover material category/vapour data, climate identity, thermal standard, exterior condition, all settings fields, thickness, and the live settings command. Browser verification observed distinct hashes for continental, humidity-class, and fixed models. |
| 15 | `test_ventilated_outer_air_layer_reports_stack_diagnostic` proves the named convention diagnostic. |
| 16 | `test_verdict_ladder_distinguishes_d1_d2_d3_and_d4` proves non-closing cycles return d4 and the canonical month after the last annual minimum. |

Phase 5 focused verification: backend condensation suites **47 passed**;
frontend Phase 5 plus Envelope integration suites **67 passed**; TypeScript
passed. Browser smoke covered the three tables, July month selection, absent
download actions, SI/IP conversions, all interior-model controls,
settings/hash/chip refresh, Climate routing, and zero horizontal overflow at
1280 px and 900 px widths. Full `make ci` is the final phase gate.
