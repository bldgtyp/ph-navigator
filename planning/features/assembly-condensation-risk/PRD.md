---
DATE: 2026-07-26
TIME: 10:14 EDT
STATUS: Draft — blocked on Q-1…Q-7 in decisions.md
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
comparable to the plywood sheathing — and PHN cannot represent either today.
Running the engine on membrane-less assemblies yields a confident number for a
wall that does not exist. (`decisions.md` §D-10.) The `vapor_sd_equivalent_m`
field in §4 is shared; whichever feature ships first lands it.

**2. `planning/features/assembly-boundary-conditions/` (Phase 1).** `thermal.py`
adds no Rsi/Rse at all. ISO 13788's entire temperature profile depends on
`R_total = Rsi + ΣR + Rse`, and **three of the four criteria** — surface
condensation, mould growth, fRsi — are evaluated at a second Rsi of 0.25 m²K/W.
Without a film model, three of four criteria cannot be computed.
(`decisions.md` §D-11.)

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

### 4.2 Backwards compatibility

This is designed to be a non-event for everything that exists:

- **Document:** both fields are `X | None = None` on `ProjectMaterial`. Old
  bodies validate unchanged under `extra="forbid"`; the `schema_version` bump is
  a **no-op upgrade step** — no data migration, no rewrite. (`upgrade.py` already
  supports pure-stamp steps; `_upgrade_v0_to_v1` is the precedent.)
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
to it as a second field — do not create a sibling block. Note the as-built
narrowing of `thermal_standard` to `Literal["iso_6946"]` until the ASHRAE
values land (`../assembly-boundary-conditions/PRD.md` §4.2).

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

## 7. Backend contract

New feature module `backend/features/envelope/condensation.py` (or a sibling
`features/condensation/` if it grows), following the repo's
routes/models/service/repository layering. All calculation is backend-side per
the hard rule.

- Pure engine: `(assembly, materials_by_id, climate_record, settings) → CondensationResult`.
  No I/O, deterministic, mirrors `thermal.py`'s shape including an
  issues/flags/status triple so the frontend handles blocked states the same way
  it already handles `missing_conductivity`.
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
| **1** | Material vapour fields end-to-end: models, migration, catalog columns, drift keys, editor UI, IP/SI conversion. No calculation. | materials can be specified; data entry can begin |
| **1½** | ✅ **`assembly-membrane-layers` Phases 1–2** (all four phases shipped 2026-07-26) and ✅ **`assembly-boundary-conditions` Phase 1** (landed 2026-07-26) — **both external dependencies are now cleared.** | assemblies can hold the layers that dominate the answer, and have surface films at all |
| **2** | Engine (incl. worst-of-all-paths per `decisions.md` §D-1, and the category-derived caveats per §D-9) + golden tests against the PHI workbook's own outputs. Backend only. | correctness, provable |
| **3** | Route + chip (tier 0) + the "what's missing" state (§6.2). | the feature is usable |
| **4** | Modal tiers 1–2 (verdict + Glaser/temperature diagrams). | the feature is legible |
| **5** | Modal tiers 3–4 (numbers + assumptions, incl. settings editing). | the feature is complete |

Phases 1–3 are independently valuable; the feature can pause after any of them.

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
   (`decisions.md` §D-7).
8. The word "pass" and the word "fail" appear nowhere in the user-facing copy.
9. An assembly containing any `masonry`-category material always renders the
   high-storage caveat, and a caveated clear result never renders as
   full-confidence green.
10. A membrane layer's `sd` is used directly (not `µ · d`), so changing its
    nominal thickness does not change the condensation result.
