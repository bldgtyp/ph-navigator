---
DATE: 2026-07-26
UPDATED: 2026-07-28 — both prerequisites shipped; as-built reconciliation
TIME: 10:14 EDT
STATUS: Ready — all questions resolved, both prerequisites cleared, Phase 0 next
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Product and behaviour contract for an ISO 13788 interstitial-condensation
  risk screen on the Envelope ▸ Assemblies page, plus the material vapour-data
  and project-assumption model it requires.
RELATED: ./research.md, ./decisions.md, ./STATUS.md,
  context/ui/pages/envelope-tab.md, context/DESIGN_SYSTEM.md,
  context/DATA_STORAGE.md, backend/features/envelope/thermal.py
---

# PRD — Assembly condensation risk screen

## 1. One-paragraph summary

The Envelope ▸ Assemblies page already shows Total Thickness and Effective
U-Value for the active assembly. Add a third header fact: an interstitial
**condensation risk screen** per ISO 13788:2012 (the modified Glaser method as
implemented by the PHI Condensation Tool). It reads as a single chip at rest;
clicking it opens a modal that discloses, in four widening tiers, the verdict →
where and when it condenses → the underlying numbers → the assumptions behind
them. The calculation runs on the backend from data PHN mostly already has; the
one genuinely new requirement is a **water-vapour diffusion resistance** value on
materials.

## 2. Goals

- Answer "will this assembly accumulate interstitial moisture?" **in the tool
  where the assembly is drawn**, at zero marginal cost per assembly.
- Make the answer legible to a PH consultant without them having to re-derive the
  Glaser construction — but keep every intermediate number reachable.
- Be honest about the method's limits, loudly enough that the chip is never
  mistaken for a certification result.
- Add the vapour-data material field in a way that is invisible to every existing
  workflow that doesn't use it.

## 2a. Hard dependencies — two prerequisite features

Both gate this feature's **Phase 2** (the engine). They are independent of each
other and can proceed in parallel.

**1. ✅ `planning/archive/dated/2026-07-26/assembly-membrane-layers/` (Phases 1–2, shipped 2026-07-26).** A wall's
vapour resistance is dominated by its membranes and coatings — 6-mil poly is
≈ 95 % of a typical 2×6 wall's total sd, and the interior latex paint is
comparable to the plywood sheathing — and PHN could represent neither. Running
the engine on membrane-less assemblies would have yielded a confident number for
a wall that does not exist. (`decisions.md` §D-10.) **Cleared 2026-07-26** —
all four membrane phases shipped. The vapour fields in §4 are *not* shared:
membranes deliberately left them, so they are this feature's Phase 1.

**2. ✅ `planning/archive/dated/2026-07-28/assembly-boundary-conditions/` (all
four phases, shipped 2026-07-26 → 2026-07-28).** Was blocking because
`thermal.py` added no Rsi/Rse at all, while ISO 13788's temperature profile
depends on `R_total = Rsi + ΣR + Rse` and **three of the four criteria** —
surface condensation, mould growth, fRsi — are evaluated at a second Rsi of
0.25 m²K/W. (`decisions.md` §D-11.)

As-built, what this feature now inherits:

| What | Where |
| --- | --- |
| `resolve_surface_resistances(assembly_type, exterior_condition, table)` → `SurfaceResistances(rsi, rse, heat_flow_direction)` | `backend/features/envelope/boundary_conditions.py` |
| `ISO_13788_SURFACE_CHECK_RSI = 0.25` — reserved for this screen, never in a U-value | same |
| `SurfaceFilmTable` as a **passed-in value**, ISO 6946 in code, ASHRAE from the private object store | same + `surface_film_store.py` |
| `Assembly.exterior_condition` — `outdoor_air` / `ventilated` / `ground` / `unconditioned_space` | `project_document/envelope_models.py` |
| `tables.assumptions.thermal_standard` — `"iso_6946" \| "ashrae"`, both live | `project_document/document.py` |

Two inherited caveats this feature now owns:

- **`ventilated` and `unconditioned_space` resolve `Rse = Rsi`** via ISO 6946 §6
  under *whichever* table is loaded, so an ASHRAE project gets ASHRAE numbers
  under an ISO rule on those two faces. Disclosed in the thermal-standard
  selector's help text. `outdoor_air` and `ground` are clean.
- **The Ft temperature factor is explicitly deferred to this feature.**
  `unconditioned_space` exists as a value and gets a film, but the far-side
  temperature is not modelled anywhere. See §6.5.

## 2b. Standing constraint — preview, not compliance

Decided 2026-07-26 (Ed): the result is **screen-only and internal to
PH-Navigator**, a preview calculation with no compliance role and no export path.
Concretely, that means **no "download report" affordance in v1** — a downloadable
artifact is what turns a preview into something that gets attached to a
submission. (`decisions.md` §D-14.)

## 3. Non-goals (v1)

Per `research.md` §9: no sol-air / solar radiation, no SRI, no variable-sd
membrane curves, no 10-year drying-potential run, no injected moisture sources,
no heating/cooling design-load stress test, no ACR + moisture-source interior
climate model. No PHPP/HBJSON export of condensation results. No project-wide
roll-up on the Status tab (v1.1 candidate).

## 4. Material vapour data

### 4.1 Fields

Two optional fields, added in parallel to `catalog_materials` (relational) and
`ProjectMaterial` (versioned document):

| Field | Unit | Meaning |
| --- | --- | --- |
| `vapor_diffusion_resistance_mu` | – (≥ 1) | µ, water-vapour diffusion resistance factor. The material property; thickness-independent. |
| `vapor_sd_equivalent_m` | m (≥ 0) | sd, equivalent air-layer thickness. For thin sheets, membranes, foils, coatings, where µ is not the natural datum. |

Resolution, per layer, at calculation time:

1. `vapor_sd_equivalent_m` set → use it directly (ignores layer thickness).
2. else `vapor_diffusion_resistance_mu` set → `sd = µ · d`.
3. else material category is an air layer (`air_horizontal_heat_flow`,
   `air_upward_heat_flow`, `air_downward_heat_flow`) → `sd = 0.01 m` per
   ISO 13788.
4. else **undetermined** → the assembly does not compute (§6.2).

Rationale in `research.md` §6; the two-field decision is `decisions.md` §D-4.
A fully vapour-tight layer is expressed as `sd ≥ 1500 m`, not ∞ (E-1).

**Step 1 is now load-bearing, not merely preferable.** As shipped, a membrane
layer's `thickness_mm` is decoupled from everything the user can see: it is not
drawn to scale (membranes get a fixed 9 mm band), it is excluded from Total
Thickness, it carries no R — and `membranes.should_snap_membrane_thickness`
auto-corrects it to 1 mm when it is implausible for a membrane. So `µ · d` on a
membrane layer would be computed from a number nobody is maintaining and that
the app may silently rewrite. `vapor_sd_equivalent_m` must win, and for
membranes it is effectively the *only* valid source. (`membranes.total_thickness_mm`'s
own docstring already anticipates this rule.)

**A membrane with no `sd` blocks the calculation.** It cannot fall through to
step 2, and it must not be treated like an air cavity. Membranes are the
dominant sd contributor in most assemblies (`decisions.md` §D-10), so a missing
value there is the single most consequential gap the "what's missing" state
(§6.2) will report.

### 4.2 Backwards compatibility

This is designed to be a non-event for everything that exists:

- **Document:** both fields are `X | None = None` on `ProjectMaterial`. Old
  bodies validate unchanged under `extra="forbid"`, and — per the shipped
  precedent (`air_permeance_l_s_m2_at_75pa` and `Assembly.exterior_condition`
  both landed as "additive amendment, no `schema_version` bump") — there is
  **no schema-version bump at all**: the document stays at v8, and only the
  table fingerprint and corpus snapshot are regenerated.
  (`migrations/upgrade.py` is not involved. Corrected 2026-07-28; an earlier
  draft called for a no-op bump, which contradicts the as-built pattern.)
- **Catalog:** two nullable `double precision` columns on `catalog_materials`.
  Existing rows read `NULL`.
- **Drift/refresh:** add both keys to `PROJECT_MATERIAL_CATALOG_FIELDS` /
  `ProjectMaterialDriftFieldKey`. The existing drift, override, and
  take-catalog/keep-mine machinery then covers them with no new code.
- **Thermal:** `thermal_input_hash` intentionally does *not* include vapour
  fields; U-value results and their cache keys are untouched.
- **Exports:** HBJSON and PHPP U-Values exports do not read these fields. No
  export changes, no export regressions.

### 4.3 Entry and units

Catalog and project material editors gain a "Vapour" field group. Engine and
storage are SI-canonical (µ dimensionless, sd in m); the IP presentation shows
**perms** and **perm·in** and accepts them as input, converting with the factors
in `research.md` §6. Provenance uses the existing `source` / `url` /
datasheet-evidence fields — no new evidence concept.

## 5. Project assumptions

A new optional `assumptions` block on the **versioned document**
(`decisions.md` §D-3), following the `manufacturer_filters: X | None = None`
precedent. It is **shared with `assembly-boundary-conditions`**, which
contributes `thermal_standard` — one block for versioned calculation
assumptions rather than two siblings.

**The block now exists** (landed 2026-07-26): `ProjectAssumptions` in
`backend/features/project_document/document.py`, reachable as
`tables.assumptions` with `ProjectDocumentTables.resolved_assumptions()` as
the None-means-defaults accessor. This feature adds `condensation_settings`
to it as a second field — do not create a sibling block.

`thermal_standard` shipped narrowed to a single-member literal and was
**widened to `Literal["iso_6946", "ashrae"]` on 2026-07-28** when the ASHRAE
values were published to the private object store. Both standards are live;
neither is a placeholder.

Precedent worth copying from that work: **a standard with no published table
raises rather than falling back**, surfacing as a typed 409
`surface_film_table_unavailable`, and the write path rejects an unavailable
standard so a document can never name a convention this deployment cannot
compute. Serving one standard's numbers under another's label would be a wrong
answer confidently presented — the same principle as §6.2's refusal to compute
on missing vapour data.

```
assumptions:
  thermal_standard: "iso_6946" | "ashrae"    # default iso_6946 — owned by
                                             # assembly-boundary-conditions
  condensation_settings:
    interior_climate_model:  "iso13788_continental" | "iso13788_humidity_class" | "fixed_setpoint"
    occupancy_class:         "low" | "normal" | "high"    # continental model
    humidity_class:          1 | 2 | 3 | 4 | 5             # humidity-class model
    setpoint_temp_c:         float | null                  # humidity-class AND fixed-setpoint
    setpoint_rh:             float | null                  # fixed-setpoint only
    ma_limit_g_m2:           float                         # default 200
```

These are three of the PHI tool's four models (`decisions.md` §D-13); its ACR +
moisture-source model is deferred.

Note `setpoint_temp_c` serves **both** the humidity-class and fixed-setpoint
models: a humidity class supplies only the vapour-pressure excess Δp added to the
exterior vapour pressure, so θi still has to come from somewhere.

**Defaults make it zero-config**: `iso13788_continental` + `normal` +
`200 g/m²` runs on a brand-new project with no user input at all. Absence of the
block means defaults; it is only written when a user changes something.

✅ **The `normal` default is a knowing departure from PHI's own guidance, signed
off by Ed 2026-07-26.** The workbook recommends its `low`/EN 15026 profile
(30–60 % RH) for Passive House buildings in cold climates — but that is the
driest profile and therefore predicts the least condensation, and defaulting a
*risk screen* to the least conservative assumption is the wrong instinct. `low`
remains available, labelled with PHI's rationale so choosing it is deliberate.
(`decisions.md` §D-13b.)

Exterior climate is **not** a setting — it comes from the climate source already
attached on the Climate tab (`research.md` §4). Start month is derived, not
entered (`decisions.md` §D-6).

## 6. Behaviour

### 6.1 The chip (tier 0)

In `AssemblyHeader`, beneath Effective U-Value, a `.chip` in the
`report-status-chip` tone family (the canonical chip pattern in this repo):

| State | Chip reads | Tone |
| --- | --- | --- |
| Clear | `Condensation: none predicted` | success |
| Clear, with caveats | `Condensation: none predicted (2 caveats)` | success, muted |
| Risk | `Condensation: predicted — review` | warning |
| Over limit / no dry-out | `Condensation: exceeds limit` | danger |
| Low confidence | `Condensation: multiple interfaces` | warning, muted |
| Blocked — data | `Condensation: needs vapour data (3)` | neutral, interactive |
| Blocked — climate | `Condensation: needs a climate source` | neutral, interactive |
| Out of scope | `Condensation: not screened` | neutral |

Every state is clickable. The chip carries an `InfoTooltip` (ⓘ) matching the
existing Thickness / U-Value pattern.

### 6.2 The blocked state is a to-do, not a dead end

Per `decisions.md` §D-5: when µ/sd is missing, the diagnostic still runs.
Clicking the chip opens the modal in a **"what's missing"** state that lists each
offending material, the layer(s) it sits on, and an inline affordance to enter
the value. This is the on-ramp that fixes catalog coverage; at launch it will be
the most common state, so it must be the best-designed one.

Two shipped precedents to follow rather than reinvent:

- **`ThermalStatusFlag` is the model.** It gained `no_thermal_layers` when
  membranes landed, so an all-membrane assembly reports *why* it cannot compute
  instead of falling through to `invalid_geometry`. This feature's flags follow
  the same shape — a named flag per distinguishable cause, never a generic
  failure.
- **`unknown` must stay distinct from `pass`.** `envelope/air_barrier.py`
  returns three states and deliberately does not let an unrecorded permeance
  read as passing, on the grounds that a face not shown to qualify has not
  qualified. The same rule holds here: an assembly whose vapour data is
  incomplete is never "no condensation predicted".

### 6.3 The modal — progressive disclosure

`ModalDialog` + `DialogActions`, wide, with `.pill-tab-list` section switching.
Four tiers, opening on tier 1:

**Tier 1 — Verdict** *(what do I do about this?)*

- One sentence, plain language, with the risk framing from `decisions.md` §D-2 —
  never "PASS"/"FAIL".
- Four criterion tiles in a 2×2: **Surface condensation · Mould growth · fRsi ·
  Interstitial accumulation**, each a status chip with the worst month named.
- One hero chart (Recharts, already a dependency): the **12-month accumulated
  moisture Ma curve** with the Ma-limit reference line. This is the picture that
  answers the question; nothing else is needed to act.
- A persistent one-line method statement: *ISO 13788 monthly steady-state
  assessment. It ignores capillary and sorption effects, driving rain, and air
  leakage — which typically moves more moisture than diffusion does.*
- **Uncertainty caveats** (`decisions.md` §D-9) as a stack of callouts directly
  under the verdict, before the criterion tiles. v1 fires two, both derived from
  existing data with no new fields:
  - *High-storage materials* — any `masonry`-category material. Copy names the
    driving-rain omission and routes to EN 15026 / WUFI.
  - *Multiple condensing interfaces* — ≥ 2, per `decisions.md` §D-8.
  The v1.1 `moisture_behavior` field adds the *capillary-active / pessimistic*
  and *unknown behaviour* caveats.
- When the run used the worst of several paths, one line naming it
  ("worst path: stud").

**Tier 2 — Where & when** *(where in the wall, and in which month?)*

- The canonical **Glaser diagram**: saturation pressure vs partial pressure
  across the sd-axis, with the condensing interface marked and labelled by layer
  name. A second toggle plots against real thickness (the workbook offers both).
- A month selector defaulting to the worst month.
- A companion temperature profile through the layers, with the mould-growth,
  condensation, and surface-temperature thresholds drawn at the interior
  boundary (as the workbook does, using the Rsi = 0.25 allowance).

**Tier 3 — The numbers** *(show me everything)*

- **Layer table** for the selected month: layer, material, d, λ, R, µ, sd, θ,
  psat, pv, RH.
- **Monthly table**: month × (gc, Ma, condensing-interface count, per-criterion
  verdict), 12 rows.
- **Per-interface breakdown**: gc and Ma per interface per month — the
  workbook's collapsed "+" table.
- Standard `DataTable` behaviour throughout (uniformity is an iron-law here) and
  copy/export affordances.

**Tier 4 — Assumptions** *(why these numbers?)*

- Exterior climate: which source, monthly θe and derived φe, read-only, with a
  link to the Climate tab.
- Interior climate: the model selector and its parameters — this is where
  §5's settings are edited, writing to the document draft.
- Ma limit, with the national-standard reference values as guidance text.
- Derived start month, surface resistances used, roof −2 K applied or not.
- Per-material provenance: µ/sd value, source, and whether it came from the
  catalog or a project override.

### 6.4 Editing and freshness

Computed against the **live draft** (matching `thermal.py`'s behaviour), so the
chip updates as layers are edited. Results are cached on an input hash covering
assembly + referenced vapour/thermal fields + climate record identity + settings
block.

`thermal_input_hash` has since had to absorb two inputs that live outside the
assembly subtree — material `category` (it now decides membrane-ness) and
`thermal_standard` (a project switching standards would otherwise serve stale
previews). Both apply here too, plus climate identity, `exterior_condition`, and
the whole `condensation_settings` block. **Anything that can change the answer
and is not in the assembly subtree has to be in the key**; that has now been the
cause of two near-misses in this codebase, so treat it as a checklist rather than
an afterthought.

### 6.5 Exterior conditions — what each one means here

`Assembly.exterior_condition` now exists with four values, and the condensation
screen has to say what it does with each. Only the first is fully modelled.

| Condition | Films (inherited) | Condensation screen |
| --- | --- | --- |
| `outdoor_air` | Rse from the standard | ✅ **in scope** — monthly θe from the attached climate source |
| `ventilated` | `Rse = Rsi` (ISO 6946 §6) | ✅ in scope — treat the far side as outdoor air, per ISO 6946's own logic that everything outboard of a well-ventilated cavity is ignored |
| `ground` | `Rse = 0` | ❌ **not screened** (`decisions.md` E-5). ISO 13788 is an air-facing method; `ClimateMonthlyTemps.ground_c` exists but producing a Glaser answer for a slab would be a wrong answer confidently presented. Chip reads "not screened". |
| `unconditioned_space` | `Rse = Rsi` | ⚠️ **needs Ft, which does not exist yet** — see below |

**`ventilated` carries an unstated modelling convention that vapour makes
load-bearing** *(added 2026-07-28)*. ISO 6946 §6's rule is that the ventilated
cavity *and everything outboard of it* are dropped and `Rse = Rsi` stands in
for them — which means a `ventilated` assembly is expected to be modelled
**only up to the inboard face of the cavity**. Neither `thermal.py` nor this
engine truncates layers; both take the stack as given. For heat this
convention-violation costs a little extra R; for vapour it is catastrophic — a
metal or vapour-tight cladding modelled outboard of the cavity would show as a
condensation trap that does not exist in the real, vented wall. The engine
should therefore emit a named diagnostic (not a silent result) when
`exterior_condition == "ventilated"` and the outermost layer is an air-cavity
category or a membrane — the two signatures of a stack that kept its cavity.
The Assumptions tier states the convention.

**The Ft obligation is now this feature's.** Both prerequisite packets deferred
it here explicitly. The films treat `unconditioned_space` identically to
`ventilated`, but the *temperature* on the far side is what actually
distinguishes them, and nothing models it: an unheated garage is neither
outdoor air nor indoor air. The PHI tool handles this with a temperature factor
(`Assembly!L135`): `θe,eff = θi − (θi − θe)·Ft`.

Options, in the order I would take them:

1. **v1: do not screen `unconditioned_space`.** Chip reads "not screened —
   adjacent space temperature not modelled". Honest, costs nothing, and matches
   how `ground` is handled.
2. **v1.1: add `adjacent_temp_factor: float | None` to the assembly** and screen
   when it is set. One nullable field, the PHI formula, and a clear "you told us
   this" provenance line in the Assumptions tier.

Recommend (1) for v1 — the alternative is inventing a temperature for a space
nobody has described. → open question Q-8.

## 7. Backend contract

New feature module `backend/features/envelope/condensation.py` (or a sibling
`features/condensation/` if it grows), following the repo's
routes/models/service/repository layering. All calculation is backend-side per
the hard rule.

- Pure engine:
  `(assembly, materials_by_id, climate_record, film_table, settings) → CondensationResult`.
  No I/O, deterministic, mirrors `thermal.py`'s shape including an
  issues/flags/status triple so the frontend handles blocked states the same way
  it already handles `missing_conductivity`.
- **The film table and the climate record are passed in, resolved at the service
  edge — not looked up inside the engine.** This is not a style preference: the
  boundary-conditions work drafted the lookup inside `thermal.py` and produced a
  genuine import cycle through the storage layer, and the cycle was the design
  saying a pure calculation should not reach for I/O. `calculate_assembly_thermal
  (assembly, materials_by_id, film_table=ISO_6946_TABLE)` is the shipped shape;
  copy it.
- **Reuse, do not re-derive:** `boundary_conditions.resolve_surface_resistances()`
  for Rsi/Rse/direction, `ISO_13788_SURFACE_CHECK_RSI` for the surface criteria,
  `membranes.is_membrane_layer()` for the sd resolution ladder, and
  `thermal.calculate_construction_thermal()` if a construction-only R is needed.
  Every one of these already exists and is tested.
- **Layers ≠ layers with an R-value.** The membrane work's closing lesson was
  that "every place that assumed those were the same set needed revisiting once
  membranes existed, and the passing tests said nothing about any of it." The
  Glaser engine inverts the usual bias: membrane layers contribute **nothing** to
  the temperature profile and **dominate** the vapour profile. Any loop that
  filters layers must state which of the two sets it means.
- `GET /api/v1/projects/{id}/assemblies/{assembly_id}/condensation` returning the
  full result (all tiers' data in one payload — it is small: 12 months × ~12
  layers).
- Settings read/write ride the existing document draft/save spine.
- MCP tool exposure deferred to a follow-on phase (`decisions.md` Part 5).

## 8. Phasing

Deliberately ordered so value lands before the expensive UI, and so the coverage
risk (A-4) is retired first.

| Phase | Content | Ships |
| --- | --- | --- |
| **0** | **Coverage probe** (Q-1) — measure µ availability across the production catalog and live-project assemblies. No code. | a number, and a go/no-go |
| **1** | Material vapour fields end-to-end: models, migration, catalog columns, drift keys, editor UI, IP/SI conversion. No calculation. **The µ seed path itself** (Q-3/D-7) is owned by `planning/features/licensed-data-pipeline/` (split out 2026-07-28, Ed) — **whose mechanics are now implemented** (Phases 1–2: publisher + CI, PHN `datasets` registry, `applied_datasets`, guarded apply CLIs, all drilled on the films dataset). The ISO 10456 dataset is authored in the private `ph-navigator-data` repo and applied through the `db_seed` machinery — pipeline Phase 4 is this seed's local dry-run, resumed once this phase lands the columns and Phase 0 lands the roster. This feature keeps ownership of the µ *content* (which rows get which values, the §D-12 composite-stud call); the pipeline owns the publish/apply mechanics. Production apply is Ed-dispatched, on this feature's schedule. | materials can be specified; data entry can begin |
| ~~**1½**~~ | ✅ **Both external dependencies cleared.** `assembly-membrane-layers` — all four phases, shipped 2026-07-26 (rendering reworked 2026-07-27). `assembly-boundary-conditions` — all four phases, 2026-07-26 → ASHRAE set + selector 2026-07-28. | assemblies hold the layers that dominate the answer, and have surface films at all |
| **2** | Engine (incl. worst-of-all-paths per `decisions.md` §D-1, and the category-derived caveats per §D-9) + golden tests against the PHI workbook's own outputs. Backend only. | correctness, provable |
| **3** | Route + chip (tier 0) + the "what's missing" state (§6.2). | the feature is usable |
| **4** | Modal tiers 1–2 (verdict + Glaser/temperature diagrams). | the feature is legible |
| **5** | Modal tiers 3–4 (numbers + assumptions, incl. settings editing). | the feature is complete |

Phases 1–3 are independently valuable; the feature can pause after any of them.

Per-phase implementation plans live in `./phases/` (drafted 2026-07-28).

## 9. Acceptance criteria

1. A material with no vapour data behaves exactly as today everywhere — U-value,
   HBJSON export, PHPP export, drift, HBJSON import — with no new warnings.
2. An existing saved project document loads without migration work and reports
   the blocked state, not an error.
3. For a reference assembly, the engine reproduces the PHI workbook's monthly
   gc, Ma, interface count, and all four verdicts to within rounding.
4. Air-cavity layers never block a run.
5. Editing a layer thickness updates the chip without a page reload.
6. A user who has never opened the Assumptions tier still gets a computed result
   (zero-config defaults hold).
7. No PHI/ISO/ASHRAE-sourced tabular data is committed to this repository
   (`decisions.md` §D-7) — **including golden-test fixtures**, whose material
   µ/sd inputs are synthetic values run through the workbook locally, following
   the surface-film fixture precedent (commit `b869a8fc`).
8. The word "pass" and the word "fail" appear nowhere in the user-facing copy.
9. An assembly containing any `masonry`-category material always renders the
   high-storage caveat, and a caveated clear result never renders as
   full-confidence green.
10. A membrane layer's `sd` is used directly (not `µ · d`), so changing its
    nominal thickness — including an automatic snap by
    `should_snap_membrane_thickness` — does not change the condensation result.
11. A membrane layer with no `vapor_sd_equivalent_m` blocks the calculation and
    is named in the "what's missing" state; it never falls through to `µ · d`
    and is never treated as an air cavity.
12. A `ground` assembly reports "not screened" rather than a Glaser result; an
    `unconditioned_space` assembly does the same until Ft exists (§6.5, Q-8).
13. The engine performs no I/O: the film table, climate record, and settings are
    all arguments. Enforced by the existing backend-boundaries check.
14. The condensation input hash changes when any of material `category`,
    `thermal_standard`, `exterior_condition`, the climate source, or any
    `condensation_settings` field changes.
15. A `ventilated` assembly whose outermost layer is an air-cavity category or
    a membrane surfaces the named stack-convention diagnostic (§6.5, E-17)
    rather than a silent result.
16. When no start month closes the annual cycle, the result is the d4 verdict
    reported from the canonical display month — never an error or an empty
    chip (E-15).
