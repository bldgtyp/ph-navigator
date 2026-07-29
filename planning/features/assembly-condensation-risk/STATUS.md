---
DATE: 2026-07-26
UPDATED: 2026-07-29 (Phases 0–1 complete)
TIME: 07:17 EDT
STATUS: Active — Phase 2 Glaser engine next
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers for the condensation-risk feature.
RELATED: ./README.md, ./research.md, ./PRD.md, ./decisions.md
---

# Status

## State

**Phases 0–1 complete. Material vapour data is available end-to-end and the
licensed local seed drill is proven. No condensation calculation exists yet.**

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

Not done: Phases 2–5; production apply.

## Next step

**Phase 2 — Glaser engine** — plan at `phases/phase-02-glaser-engine.md`.
Implement the pure typed monthly solver, bounded worst-path enumeration,
blocked-state diagnostics, uncertainty caveats, and synthetic workbook-derived
golden tests. No route or UI work belongs in this phase.

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
resolving 5/5 layers and 2/2 screened assemblies. Phase 2's future gate
remains acceptance criterion 3 in `PRD.md` §9: golden-file agreement with the
PHI workbook's outputs for synthetic inputs, to within rounding.

Both prerequisite packets ended up finding most of their real defects in review
or in a browser rather than from a green suite (membranes: five defects, four
found in review; boundary conditions: two rendering defects only a real browser
caught). Budget for that here — a passing `pytest` will not tell you the Glaser
engine is iterating the wrong set of layers.
