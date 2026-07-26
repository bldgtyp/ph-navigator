---
DATE: 2026-07-26
TIME: 10:14 EDT
STATUS: Active
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Reverse-engineering of the PHI Condensation Tool v1.7.5 and mapping of its
  inputs/outputs onto the existing PH-Navigator data model.
RELATED: ./PRD.md, ./decisions.md, ./STATUS.md,
  context/ui/pages/envelope-tab.md, context/ui/pages/climate.md,
  backend/features/envelope/thermal.py, backend/features/climate/record.py
---

# Research — Interstitial condensation risk (modified Glaser / ISO 13788)

Everything below was read directly out of
`~/Dropbox/bldgtyp-00/00_PHPP/Tools/PHI Condensation Tool/PHI_CondenstationTool_March_v1.7.5.xlsx`
(formulas, not just values) plus its manual
(`sinfonia_d47_annex-b_condensation_tool_manual_phi.pdf`), and cross-read
against the current PHN backend.

⚠️ **Licensing.** The workbook is PHI copyright ("Electronic copies may only be
distributed in its complete and unmodified form"). Nothing from it — formulas as
transcribed cells, its climate datasets, its PHI component limit tables, or its
embedded ISO 10456 / DIN / BSI / UNI tables — may be committed to this repo. See
`decisions.md` §D-7. The *method* is ISO 13788:2012, which we may implement from
the standard; the *data* has to be routed like every other licensed dataset.

---

## 1. What the tool actually is

A monthly-timestep, steady-state, 1-D vapour-diffusion assessment ("modified
Glaser") per **ISO 13788:2012**, with thermal resistances from ISO 6946. It
answers four questions for a single opaque assembly:

| # | Criterion | Physically |
| --- | --- | --- |
| a | Surface **condensation** | Is the interior surface warmer than the interior air's dew point? |
| b | Surface **mould growth** | Is it warmer than the 80 %-RH threshold temperature? |
| c | **fRsi** | Is the temperature factor above the climate-dependent minimum? |
| d | **Interstitial** condensation | Does moisture condense inside, and does it all dry out within 12 months without exceeding a mass limit? |

The tool's own Instructions sheet is unusually candid about its limits, and this
matters for how we present it:

> "The method is an assessment rather than an accurate prediction tool."
> "Using capillary-active and/or sorptive insulation materials, the obtained
> results are in general too pessimistic."
> "This method brings more reliable results for lightweight and airtight
> components that do not contain materials with a large water storage capacity."

It explicitly ignores: moisture-dependent λ, capillary suction/liquid transport,
sorption, 2-D/3-D transport, air leakage, rain/solar/wind, gravity.

**Implication for BLDGTYP's portfolio:** the EnerPHit interior-insulation
retrofit — our highest-risk assembly type and the one we most want screened — is
also the case where Glaser is *known* to be pessimistic (calcium silicate, wood
fibre, lime plasters are all capillary-active). The feature must never render a
bare red "FAIL". See `decisions.md` §D-2.

## 2. Workbook structure

| Sheet | State | Role |
| --- | --- | --- |
| `Instructions` | visible | Scope, method limits, per-area usage notes, references |
| `Climate` | visible | Exterior climate selection + **four** interior-climate models |
| `Assembly` | visible | One repeatable ~500-row block per assembly: boundary conditions → definition → monthly gc/Ma → verification → 12 monthly detail blocks |
| `Database as Standard` | visible | ISO 10456:2007 Tables 3/4/5 + Annex A (µ dry/wet, sd for foils, fT) |
| `Data` | hidden | Dropdown lists + constants (Rsi/Rse, δ₀, humidity classes, verdict strings) |
| `Data - Climate` | hidden | Bundled PHPP climate datasets |

The `Assembly` sheet is 8 788 rows because the block is copy-pasted per assembly
and then repeated 12× internally (one detail block per month). There is exactly
one algorithm.

## 3. The algorithm, as extracted

Constants (`Data!C37`, `Assembly!P168`):

- `δ₀ = 2 × 10⁻¹⁰ kg/(m·s·Pa)` — vapour permeability of still air.

### 3.1 Saturation vapour pressure (`Assembly!I191` etc.)

```
psat(θ) = 610.5 · exp(17.269·θ / (237.3 + θ))     θ ≥ 0 °C
psat(θ) = 610.5 · exp(21.875·θ / (265.5 + θ))     θ < 0 °C
```

Inverted for the dew-point / mould thresholds (`Assembly!O146`, `O150`):

```
θ(p) = 237.3·ln(p/610.5) / (17.269 − ln(p/610.5))    (and the <0 °C branch)
```

### 3.2 Per-layer quantities (`Assembly!F172:Q181`)

For each layer *j* with thickness `d_j` [m], conductivity `λ_j`, µ-value `µ_j`:

```
R_j  = d_j / λ_j                     [m²K/W]
sd_j = µ_j · d_j                     [m]          (equivalent air-layer thickness)
δ_j  = δ₀ / µ_j                      [kg/(m·s·Pa)]
```

Surface resistances come from a fixed lookup (`Data!D22:D24`, `D30:D32`):

| Element | Rsi | Rse |
| --- | --- | --- |
| Roof | 0.10 | outdoor air 0.04 · ground 0 · ventilated = Rsi |
| Wall | 0.13 | ” |
| Floor | 0.17 | ” |

Note a **second** Rsi = 0.25 m²K/W (`Data!D33`) used *only* for the surface
condensation / mould / fRsi checks (the ISO 13788 furniture-and-corner
allowance). Both are needed.

### 3.3 Temperature profile

```
θ_j = θe + (ΣR from exterior up to j) / R_total · (θi − θe)
R_total = Rsi + ΣR_j + Rse
```

`Ft` (`Assembly!L135`) scales the exterior side for assemblies facing an
unheated space: `θe,eff = θi − (θi − θe)·Ft`.

Roofs get ISO 13790's long-wave-radiation simplification: **θe − 2 K**
(`Data!E22`), applied automatically.

### 3.4 Vapour pressure profile and condensation (`Assembly!H191:J204`)

Ideal (no condensation) partial pressure is linear in cumulative sd:

```
pv_ideal(j) = pi − (Σsd up to j / Σsd_total) · (pi − pe)
psat(j)     = psat(θ_j)
```

A **condensing interface** is any *j* where `pv_ideal(j) ≥ psat(j)`
(`Assembly!D193 = IF(H193>=I193,"x","")`). Where that happens, the actual profile
is clamped to `psat` and re-drawn as straight segments between the interior
boundary, the condensing interface(s), and the exterior boundary — the Glaser
tangent construction.

### 3.5 Condensation rate and accumulation (`Assembly!K214:O223`)

For a condensing interface *c*, with `p_in`/`sd_in` the nearest upstream node and
`p_out`/`sd_out` the nearest downstream node:

```
gc = δ₀ · [ (p_in − p_c)/(sd_c − sd_in)  −  (p_c − p_out)/(sd_out − sd_c) ]   [kg/(m²·s)]
```

Positive = condensation, negative = evaporation. Monthly mass:

```
Ma_month = gc · (days · 24 · 3600) · 1000        [g/m²]
Ma_n     = max(0, Ma_(n−1) + Ma_month)           (clamped: cannot dry below zero)
```

### 3.6 Verification logic (`Data!C110:C122`, `Assembly!E589:L607`)

- **d1** No condensation in any month at any interface → verified.
- **d2** Condensation occurs but fully evaporates within the 12-month cycle → verified.
- **d3** Fully evaporates but peak `Ma` exceeds the **Ma limit** → not verified.
- **d4** Does not fully evaporate after 12 months → not verified.
- Surface condensation / mould / fRsi must each pass in **all 12 months**.
- The tool separately counts **condensing interfaces** and warns that ≥ 2
  interfaces "could easily bring misleading results … analyze with other
  methodologies or re-design".

**Ma limit reference values** (workbook `Assembly!E468:L497`, sourced to national
standards, default 200 g/m²):

| Source | Limit |
| --- | --- |
| DIN EN ISO 13788:2012 — prevent run-off from watertight surfaces | 200 g/m² |
| DIN 4108-3:2014 — general | 1000 g/m² |
| BS 5250:2011 — fine mist / drop formation, by surface angle | 30 – 250 g/m² |
| UNI EN ISO 13788:2012 — per material family, as `k·ρ·d` | material-dependent |

### 3.7 Start-month selection

The workbook makes the user pick a trial start month "2 or 3 months before the
coldest period" (`Assembly!E436`), and warns that a wrong pick gives wrong
answers. **This is automatable**: run the 12-month cycle from all 12 candidate
starts and take the one that closes (Ma returns to its starting value), i.e. the
month after the annual dry point. Removing this input is a genuine improvement
over the spreadsheet.

## 4. Required inputs → what PHN already has

| Input | Source in tool | PHN today | Gap |
| --- | --- | --- | --- |
| Layer thickness `d` | Assembly definition | `AssemblyLayer.thickness_mm` | ✅ none |
| Conductivity `λ` | Assembly definition | `ProjectMaterial.conductivity_w_mk` | ✅ none |
| **µ-value** | Assembly definition | — | ❌ **new material field** |
| Assembly type (Rsi/Rse, roof −2 K) | Dropdown | `Assembly.type` (`wall`/`roof`/`floor`/`other`) | ✅ maps directly |
| Layer order in/out | — | `Assembly.orientation` + `layers_outside_to_inside()` | ✅ already solved |
| Monthly exterior θe | PHPP dataset | `ClimateMonthlyTemps.air_c` (12) | ✅ none |
| Monthly exterior RH | derived from dew point | `ClimateMonthlyTemps.dewpoint_c` (12) | ✅ same derivation |
| Monthly interior θi, φi | 4 interior-climate models | — | ❌ **new settings** |
| Solar radiation (sol-air) | monthly kWh/m² by orientation | `ClimateMonthlyRadiation` (N/E/S/W/glob) | ✅ available — but **out of scope**, not in ISO 13788 |
| Heating/cooling design temps | PHPP peak loads | `ClimatePeakLoads` | ✅ available — out of scope for v1 |
| Ma limit | User input, default 200 | — | ❌ new setting (default 200) |
| Start month | User pick | — | auto-derived (§3.7) |

**The headline finding: the exterior climate side is already complete.**
`ClimateRecord` carries monthly air temperature *and* monthly dew-point
temperature, which is exactly the pair the PHI tool uses (its Climate sheet
derives exterior RH from dew point the same way). No new climate ingestion, no
new project settings for the exterior boundary.

## 5. The interior-climate models

The tool offers four. Formulas extracted from the `Climate` sheet:

**(1) Continental & tropical — ISO 13788 Annex A** (`Climate!E190:I242`).
A pure lookup on monthly θe, no project inputs at all:

- θi = 20 °C for θe ≤ 10 °C, ramping linearly to 25 °C at θe ≥ 20 °C.
- φi = base + (θe − θe_ref)·0.01, clamped: e.g. class **B-Normal** runs
  0.35 at θe = −10 °C → 0.55 at θe = 10 °C → 0.65 at θe ≥ 20 °C.
- Three occupancy classes: **A-Low / B-Normal / C-High**, offset ±0.05.

**(2) Maritime — ISO 13788 humidity classes** (`Climate!E371:F394`).
Interior vapour pressure = exterior vapour pressure + Δp, where Δp is a
class-dependent ramp:

| Class | Building | Δp at θe ≤ 0 °C | Δp at θe ≥ 20 °C |
| --- | --- | --- | --- |
| 5 | Laundry, brewery, pool | 1360 Pa | 200 Pa |
| 4 | Sports halls, kitchens, canteens | 1080 Pa | 100 Pa |
| 3 | Unknown occupancy | 810 Pa | 100 Pa |
| 2 | Offices, dwellings — normal occupancy/ventilation | 640 Pa | 100 Pa |
| 1 | Unoccupied, dry storage | 270 Pa | 100 Pa |

Linear between; θi comes from a set point or a 12-value manual series.

**(3) ACR + humidity sources.** Needs interior net volume, air-change rate
(fixed / `n = 0.2 + 0.04·θe` / user monthly), and a daily moisture production
rate. Substantially more project data.

**(4) Air-conditioned.** Straight set points for θi and φi, or 12 manual values.

**Recommendation:** ship (1) as the zero-config default with occupancy B-Normal,
add (2) and (4) as explicit choices. (3) is deferred — it needs volume + moisture
production, both of which are separate data-entry projects.

## 6. Material vapour data — what to store, and why it isn't "permeance"

The tool's material input is **µ**, the water-vapour diffusion resistance factor
(dimensionless, ratio of the material's resistance to that of still air), not a
permeance. µ is thickness-independent, which is what makes it a *material*
property suitable for a catalog row. Derived quantities:

```
sd = µ · d                [m]     equivalent air-layer thickness
δ  = δ₀ / µ               [kg/(m·s·Pa)]     permeability
W  = δ / d = δ₀ / sd      [kg/(m²·s·Pa)]    permeance of the layer
```

US units, with `1 perm = 5.72135 × 10⁻¹¹ kg/(m²·s·Pa)` and
`1 perm·in = 1.45322 × 10⁻¹² kg/(m·s·Pa)`:

```
µ  ≈ 137.6 / (permeability in perm·in)
sd ≈ 3.496 / (permeance in perms)        [m]
```

Sanity check: 6-mil (0.15 mm) polyethylene has ISO 10456 `sd = 50 m`
(`Database as Standard`), which back-converts to 0.07 perm — squarely inside the
0.04–0.08 perm range quoted for 6-mil poly. ✅

**Two fields, not one.** Thin sheets (membranes, foils, paints, smart vapour
retarders) are specified by `sd` or by permeance, *not* by µ — the PHI workbook
itself fudges these by inventing a 0.01 mm thickness with µ = 10 000, and
ISO 10456 Table 5 lists them as `sd` directly. Storing only µ forces that fudge
into our data. See PRD §4.

**The ∞ problem.** ISO 10456 lists metals, glass, and cellular glass as µ = ∞.
There is no clean float for that. PHI's own convention treats `sd ≥ 1500 m` as
vapour-tight; adopt that instead of a sentinel.

**Air cavities.** ISO 13788 says to use `sd = 0.01 m` for air cavities regardless
of actual dimension or orientation. PHN already has dedicated air-layer material
categories (`air_horizontal_heat_flow`, `air_upward_heat_flow`,
`air_downward_heat_flow`) — these should be auto-satisfied and must never block
the calculation.

## 7. Candidate data sources for µ

1. **`Database as Standard` sheet** — ISO 10456:2007 Tables 3, 4, 5 + Annex A.
   ~120 bulk-material rows with **µ dry and µ wet**, ~13 sheet-good rows with
   `sd` in metres. Covers concrete (µ 100–130), gypsum (10), timber (50–200),
   plywood (150–250), OSB (50), mineral wool (1), EPS (60), XPS (150), PIR (60),
   wood fibreboard (5), plasters (10), masonry, metals, plastics, rubbers.
   Well-matched to PHN's catalog categories.
2. **ASHRAE Handbook of Fundamentals 2017, Ch. 26** (`SI_F17_Ch26.pdf`,
   verified present) — Table 4 "Typical Water Vapor Permeance and Permeability".
   Broader on North-American products (sheathings, building papers, coatings,
   sidings) which ISO 10456 does not cover.
3. **Manufacturer datasheets** — the only source for proprietary membranes
   (Intello, Solitex, Siga, etc.). PHN already has a datasheet-evidence workflow
   per material; µ/sd slots straight into it.

Both (1) and (2) are licensed. See §D-7.

## 8. Structural mismatch: PHN assemblies are 2-D, Glaser is 1-D

`AssemblyLayer` holds **multiple side-by-side `AssemblySegment`s** with widths
(studs, cavities, continuous insulation), and `thermal.py` reduces them with the
ASHRAE Ch. 25 parallel-path / isothermal-planes average. ISO 13788 has no notion
of this — it takes one 1-D stack.

So a condensation run must first pick a 1-D path through the assembly. This is
the single biggest design decision in the feature; options are laid out in
`decisions.md` §D-1.

## 9. Ruthless scope cut

The workbook contains a great deal we should *not* build:

| Feature | Verdict |
| --- | --- |
| Sol-air / solar radiation on exterior surface | ❌ out — explicitly not in ISO 13788, the tool warns results "can vary significantly" |
| SRI / aged SRI (ASTM E1980, CA Title 24) | ❌ out |
| Variable-sd membranes (humidity-dependent lookup) | ❌ out of v1 — real and useful (Intello), but needs a per-material curve |
| Drying potential over 10 years + injected moisture source | ❌ out of v1 |
| Heating/cooling design-load stress test | ❌ out of v1 |
| ACR + moisture-source interior climate | ❌ out of v1 |
| 12 monthly detail blocks | ✅ in — but as data, one modal tier, not 12 screens |
| Four verification criteria | ✅ in — this is the product |
