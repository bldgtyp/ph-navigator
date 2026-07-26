---
DATE: 2026-07-26
TIME: 10:14 EDT
STATUS: Active — open questions unresolved, awaiting Ed
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Interrogation of the feature from several angles, the design decisions it
  forces, edge cases, and the open questions that block a build.
RELATED: ./research.md, ./PRD.md, ./STATUS.md
---

# Decisions, interrogation, and open questions

## Part 1 — Is this worth building?

### A-1. The job to be done ✅ strong

BLDGTYP's portfolio is dominated by two assembly families where interstitial
condensation is the live risk: **EnerPHit townhouse retrofits with interior
insulation** (vapour drive inward-to-outward across a cold, wet masonry wall) and
**thick, vapour-open wood-framed assemblies** in NY/NJ climate zones 4A–6A.

Today, answering "is this wall going to rot?" requires: export or retype the
assembly into the PHI spreadsheet, pick a climate, pick an interior profile,
guess a start month, read four scattered verdict cells. Call it 15 minutes per
assembly. At 15 assemblies per project, nobody does it for all of them — it gets
done for the two that "look scary", which is exactly the selection bias that lets
the third one through.

The value is **not the math** — it is that the answer appears next to the U-value
in the tool where the assembly is already being drawn, at zero marginal cost per
assembly. That is a real change in behaviour, not a convenience.

### A-2. Is Glaser the right method? ⚠️ the strongest objection

The tool's own manual says results are "in general too pessimistic" for
capillary-active and sorptive insulation. That is precisely the material family
used in the EnerPHit interior-insulation retrofits we most want to screen —
calcium silicate, wood fibre, lime plaster, aerogel-lime.

So the naive framing ("green = fine, red = fail") would produce **false alarms on
our most important use case**, and would train users to ignore the chip. That is
worse than not shipping it.

This does not kill the feature; it constrains the product:

1. The headline is a **risk screen**, never a certification verdict. Language:
   "No condensation predicted" / "Condensation predicted — review" / "Screen not
   available".
2. When any layer in the condensing zone is capillary-active, the result carries
   an explicit "Glaser is pessimistic here — confirm in WUFI (EN 15026)"
   qualifier rather than a bare fail.
3. The method-limits statement is **always visible** in the modal, not buried.

**This constraint shapes the UI copy more than any other single input.**

### A-3. Precedent ✅ neutral-positive

Ubakus, Dämmwerk, and various PHPP add-ons all ship an ISO 13788 check; it is an
expected feature of an envelope tool. But PHN is not sold to third parties, so
"table stakes" is not the argument — the argument is A-1. Precedent mainly tells
us the UI conventions users will recognise (the Glaser pressure diagram is the
canonical picture; don't invent a new one).

### A-4. Data-availability risk ❌ **this is the kill risk**

If µ is unknown for most catalog materials, the chip reads "not available" on
most assemblies, and the feature is dead weight that still costs maintenance.

Mitigations, in order:
- The material catalog is *ours* and small; seeding µ by category from ISO 10456
  covers concrete, masonry, gypsum, timber, wood panels, plasters, metals, and
  the common foam/mineral insulations — i.e. most layers of most real assemblies.
- The residue is membranes, coatings, and proprietary products. These are
  exactly the layers that *dominate* the answer, so they cannot be defaulted —
  they have to be entered per product.
- **Gate the build on a measured coverage number**, not an assumption. See
  Q-1 below: probe the production catalog and the real assemblies in live
  projects before committing to the modal work.

### A-5. Build and maintenance cost ✅ favourable

The engine is a pure function: assembly + climate + settings → results. No I/O,
no state, deterministic, trivially unit-testable, and gold-file testable against
the PHI workbook's own outputs (which we can run locally without redistributing
it). Estimate ~400–500 lines of backend Python plus tests. The expensive parts
are the settings model and the modal UI — hence the phasing in `PRD.md` §8, which
lets the engine + chip ship before the full modal exists.

### A-6. Scope creep ⚠️ real, but containable

The workbook carries sol-air radiation, SRI/aged-SRI, variable-sd membranes,
10-year drying potential with injected moisture sources, design-load stress
tests, and an ACR/moisture-source interior climate model. Each is individually
defensible and collectively a second product. `research.md` §9 is the cut list;
it should be treated as binding for v1.

### A-7. Verdict

**Build it — conditional on Q-1 (catalog coverage) clearing, and on the "risk
screen, not verdict" framing being accepted.** If coverage comes back poor, the
correct first shipment is the *material field plus a data-entry push*, and the
calculation waits.

---

## Part 2 — Design decisions this forces

### D-1. Which 1-D path do we run? ✅ **DECIDED 2026-07-26 (Ed): option (b)**

PHN assemblies are 2-D (layers × width-weighted segments); ISO 13788 is 1-D.
Options:

| Option | Behaviour | Assessment |
| --- | --- | --- |
| **(a) Widest-segment path** | Take the widest segment in each layer | Simple, deterministic, matches "the field" of a stud wall. Misses the stud path, which is colder and usually the actual condensation site. |
| **(b) All paths, report worst** | Enumerate the cartesian product (as `thermal.py` already does), run each, surface the worst | Most correct. Cost: path count explodes on multi-segment assemblies. Reporting "which path" needs UI. |
| **(c) User picks a path** | Explicit selector in the modal | Honest, but adds a required input to a feature whose whole point is zero friction. |
| **(d) Equivalent-λ homogenisation** | Collapse each layer to one λ (width-weighted, as `hbjson_export.py` already does) and one µ | Cheapest; physically wrong for vapour — a vapour-open cavity beside a vapour-tight stud does not average. |

**Decided: (b), bounded.** Run every path, report the worst, and name it
("worst path: stud"). Cap the enumeration (e.g. ≤ 64 paths) and fall back to (a)
with a visible note beyond the cap. `thermal.py:_calculate_parallel_path_r_value`
already builds exactly this product, so the plumbing exists. (d) is discarded
outright — averaging µ across a stud and a vapour-open cavity is not a defensible
number.

Note the interaction with membranes (§D-10): membrane layers are full-width and
single-segment, so they are shared by every path and do **not** multiply the path
count. Path explosion comes only from framed layers.

### D-2. Result framing

Accepted per A-2: risk screen, not verdict. Explicit method limits, always
visible. No "PASS"/"FAIL" wording anywhere. The per-assembly uncertainty callouts
are specified separately in **§D-9**.

### D-3. Where do the settings live? — **recommendation: in the document**

Ed asked whether this needs a settings sub-modal, project-level settings, or a
home on the Climate page. Analysis:

- **Climate tab** — wrong. That tab is unversioned *reference* data (which
  datasets the project draws on). The interior-climate assumption is a design
  decision, not a reference dataset.
- **`ProjectSettingsModal`** — wrong. That is project *metadata* (name, client,
  location, MCP tokens), unversioned. A condensation result that can silently
  change because someone edited an unversioned setting is not defensible in a
  certification context.
- **The versioned project document** — right. Add an optional
  `condensation_settings` block to `ProjectDocumentTables` (or a new
  `assumptions` sibling), following the exact `manufacturer_filters: X | None =
  None` precedent already in `document.py`. It travels with the saved version,
  it diffs, it survives review rounds.

**Surface:** an "Assumptions" tier *inside* the condensation modal that writes to
that document block — not a separate settings location. Zero-config default
(ISO 13788 continental, occupancy B-Normal, Ma limit 200 g/m²) means the tier is
optional to ever open.

### D-4. Materials DB: two optional fields, not one

```python
vapor_diffusion_resistance_mu: float | None = None   # µ, dimensionless, ≥ 1
vapor_sd_equivalent_m:         float | None = None   # sd [m], for thin sheets
```

Resolution rule: **if `sd` is set it wins** (thickness-independent); otherwise
`sd = µ · d`; otherwise the material is *undetermined* and blocks the run.

Rationale in `research.md` §6. One field would force the PHI workbook's own fudge
(0.01 mm at µ = 10 000) into our data, which is a lie about the material and
breaks the moment someone edits the layer thickness.

**Backwards compatibility is free.** Both are `X | None = None` on models that
already use `extra="forbid"`; old document bodies validate unchanged, so the
schema-version bump is a no-op step (no data migration). Catalog side is two
nullable `double precision` columns in `catalog_materials`, plus two entries in
`PROJECT_MATERIAL_CATALOG_FIELDS` so the existing drift/refresh machinery picks
them up for free.

### D-5. None-handling — Ed's assumption is right, with one refinement

Ed: *"the calc should just not run if there are any none or invalid cases."*
Agreed — a Glaser run with a guessed µ on the vapour-control layer is worse than
no run, because the guess dominates the answer.

**Refinement:** don't render the blocked state as a dead grey chip. Run the
*diagnostic* always, and make the blocked state a **to-do**: the chip reads
"needs vapour data — 3 materials", and clicking opens the modal in a
"what's missing" state listing exactly which materials, on which layers, with a
direct edit affordance. This converts the most common state at launch from a
dead end into the on-ramp that fixes the coverage problem in A-4.

**Air cavities are exempt.** PHN's `air_*_heat_flow` categories get ISO 13788's
`sd = 0.01 m` automatically and never block.

### D-6. Auto start-month

Derive it (`research.md` §3.7) rather than asking. Run all 12 candidate starts,
take the cycle that closes. Surface the chosen month in the Assumptions tier as
read-only, with an override only if a real case demands it.

### D-7. 🔴 Licensed data — hard rule collision

`CLAUDE.md`: *"This repo is public. Never commit PHI / Phius / PHPP / WUFI-derived
or otherwise licensed data."*

The µ data we want is licensed twice over — ISO 10456 tables (via the PHI
workbook, itself redistribution-restricted) and ASHRAE F17 Ch. 26. **A seed file
of ISO 10456 µ values committed to `backend/seeds/` would violate the repo's
own hard rule.**

Options:
1. Route the µ seed through the private object store / production DB only, the
   same way other source-of-truth data is routed. Repo carries the *loader*, not
   the *values*.
2. Enter µ as ordinary catalog data via the existing Catalogs UI, per material,
   citing the source in the existing `source`/`url` fields — no bulk table at all.
3. Use only values that are genuinely public-domain or manufacturer-published.

**Recommendation: (1) for the bulk seed, (2) for products.** Either way, this must
be settled *before* anyone writes a seed file. → **Ed's call.**

### D-8. Two or more condensing interfaces

The workbook warns these "could easily bring misleading results". Treat as a
distinct low-confidence result state, not a number: report the interface count
and route to a dynamic method rather than showing a precise Ma.

### D-9. Uncertainty caveats — a named set, not one flag ✅ decided 2026-07-26

Ed asked for an additional flag when the assembly contains stone, brick, cement,
etc. Right instinct, but two *different* uncertainty mechanisms were being
conflated and they point in opposite directions. They need separate copy because
they imply different actions:

| Caveat | Trigger | Physics | Direction | Recommended action |
| --- | --- | --- | --- | --- |
| **Pessimistic** | capillary-active materials (calcium silicate, wood fibre, lime plaster, cellulose) | Glaser ignores liquid transport and sorption, so condensate that would in reality wick away and dry shows as accumulation | **over-predicts risk** | confirm in WUFI before redesigning |
| **High storage / masonry** | brick, stone, concrete, mortar | tool's own words: reliable only for components "that do not contain materials with a large water storage capacity". Also ignores **driving rain**, which for solid masonry usually dominates diffusion entirely. And ISO 10456 µ for masonry is highly variable (e.g. sedimentary rock 250 dry / 200 wet; limestone 30→250 by hardness) while we store one value | **can under-predict**, and the input itself is uncertain | this screen is not sufficient; use EN 15026 / WUFI |
| **Multiple interfaces** | ≥ 2 condensing interfaces | per §D-8 and the workbook's own warning | unreliable | re-design or use a dynamic method |
| **Unknown behaviour** | (v1.1) materials with no moisture-behaviour data in the condensing zone | we don't know which of the above applies | unknown | enter the data |

**Detection — v1 uses categories only, zero new fields.** PHN's existing category
enum already has `masonry`, so the high-storage caveat is free. The
capillary-active caveat cannot be derived from categories (`insulation` holds
both mineral wool and wood fibre; `finishes` holds both gypsum and lime plaster),
so it would need a per-material field we cannot populate reliably yet — and a
*wrong* caveat is worse than no caveat.

Fortunately this costs less than it looks: **EnerPHit interior insulation on
brick or stone trips the masonry caveat anyway**, so the single category-derived
rule already covers the false-alarm case A-2 was most worried about.

**v1.1:** add an optional `moisture_behavior` enum
(`capillary_active | high_storage | low_storage | null`) alongside the vapour
fields — same migration, same drift machinery — which enables the pessimism
caveat and the honest "unknown for N materials" caveat.

**Chip interaction:** a "none predicted" result carrying caveats must not render
as confident green. Use a muted success tone plus a caveat count; caveats render
as a stack of callouts at the top of modal tier 1.

### D-10. Membranes are a prerequisite ✅ decided 2026-07-26

Split out to `planning/features/assembly-membrane-layers/`. A wall's sd is
dominated by its membranes and coatings — in a typical 2×6 wall, 6-mil poly is
~95 % of the total, and the interior paint is comparable to the plywood — and
PHN cannot represent either today. Running the engine on membrane-less
assemblies produces a confident number for a wall that does not exist, wrong in a
direction that depends on which membrane is missing.

**`assembly-membrane-layers` Phases 1–2 gate this feature's Phase 2.** The
`vapor_sd_equivalent_m` field defined in `PRD.md` §4 is shared between the two;
whichever ships first lands it.

The air-barrier designation in that feature is explicitly **not** an input here —
ISO 13788 ignores air leakage. But the two belong together in copy: convective
transport through an air-barrier defect typically moves more moisture than
diffusion does, and the method-limits line should say so.

### D-11. Boundary conditions are a second prerequisite ✅ decided 2026-07-26

Q-5 (exclude floors on grade) was accepted, but Ed correctly identified that the
underlying model is missing, not just the floor case. Verified against the code:

- `thermal.py` adds **no Rsi/Rse at all** — the U-value is construction-only.
- `Assembly.type` is decorative (HBJSON metadata + sidebar icon only).
- There is no "adjacent to" axis: ground, ventilated, and unconditioned-space
  assemblies are indistinguishable from outdoor-air ones.
- The `air_*` categories are air **cavities**, not surface films.

This blocks us harder than it first appears. ISO 13788's temperature profile is
`θ_j = θe + (ΣR up to j / R_total)·(θi − θe)` with `R_total = Rsi + ΣR_j + Rse`,
and **three of the four criteria** (surface condensation, mould growth, fRsi) are
evaluated at a *second* Rsi of 0.25 m²K/W. With no film model, three of four
criteria cannot be computed.

Split out to `planning/features/assembly-boundary-conditions/`. **Its Phase 1
gates this feature's Phase 2**, alongside `assembly-membrane-layers` Phases 1–2.
The two prerequisites are independent of each other and can proceed in parallel.

That feature also carries Q-B1 — whether the header "Effective U-Value" starts
including films — which is a live semantics question in today's app, independent
of condensation.

### D-12. Q-1 coverage — preliminary read, and a new problem ⚠️

Measured against `backend/seeds/catalogs/materials.v1.json` (408 rows). This is
the *seed*, not the production catalog, and not weighted by what actually appears
in real assemblies — the full probe still stands. But it is enough to change the
plan:

| Category | Rows | Vapour-data outlook |
| --- | --- | --- |
| `air_*` (cavities) | 180 (44 %) | ✅ **exempt** — ISO 13788 `sd = 0.01 m`, zero data needed |
| `insulation` | 76 (19 %) | ✅ maps cleanly from ISO 10456 Table 4 by name |
| `stud_layers_steel` + `stud_layers_wood` | 99 (24 %) | ⚠️ **composite pseudo-materials** — see below |
| `masonry`, `finishes`, `woods`, `metals`, `rainscreen_insulation`, `doors` | 53 (13 %) | mostly mappable; proprietary `finishes` (DensElement, Densglas) and `doors` need product data |

**The new problem:** a quarter of the catalog is rows like
`wd std w R-3/in [1.5in]` and `stl std w No Insul [0.75in]` — a stud *and* its
cavity homogenized into one equivalent-λ pseudo-material at a fixed thickness.
These are a V0/AirTable-era workaround for not having segments.

For vapour they are ambiguous in a way they are not for heat: a wood stud is
µ ≈ 50 and the insulated cavity beside it is µ ≈ 1, and averaging those is exactly
the move §D-1 rejected. Options: (i) assign the cavity's µ, since the cavity is
~85 % of the area and is the through-path that matters, plus a caveat;
(ii) block them and push users to model studs as real segments — which PHN can
now do and V0 could not. **Recommendation: (i) for v1** so the feature isn't held
hostage to re-modelling legacy assemblies, with (ii) as the encouraged path.
→ folded into the Phase 0 probe.

### D-13. Q-4 — confirmed against the tool, with two corrections ✅

Confirmed: the recommendation ships **3 of the PHI tool's 4** interior-climate
models — ① Continental/tropical (ISO 13788 Annex A), ② Maritime (humidity
classes 1–5), ④ Air-conditioned (as our `fixed_setpoint`, simplified by dropping
the tool's 12-value manual entry). ③ ACR + humidity sources is deferred.

Checking it against the workbook surfaced two things the original PRD got wrong:

**(a) The humidity-class model also needs an interior temperature.** The class
only supplies the vapour-pressure excess Δp added to the *exterior* vapour
pressure; θi still comes from a set point or a 12-month series
(`Climate!E299:E304`). `PRD.md` §5's settings block had `humidity_class` with no
temperature, which would not compute. Fixed: `setpoint_temp_c` applies to both
the humidity-class and fixed-setpoint models.

**(b) The occupancy default is a real disagreement with PHI, and I'd hold the
line.** The workbook's dropdown reads *A - Normal occupancy EN 15026 /
B - Normal occupancy / C - High occupancy*, but the underlying lookup columns are
Low (30–60 % RH) / Normal (35–65 %) / High (40–70 %). So PHI relabelled the
ISO 13788 **low** column as an EN 15026 profile, and the Instructions sheet
recommends it: *"This profile seems the most suitable for Passive House building
in cold climate."*

That profile is the **driest**, so it predicts the **least** condensation.
Defaulting a risk screen to the least conservative available assumption is the
wrong instinct even when the tool's authors suggest it. **Decided: default to B
(ISO 13788 normal, 35–65 %)** — Ed signed off 2026-07-26. A remains available,
explicitly labelled with PHI's rationale so choosing it is deliberate rather than
a hidden default.

### D-14. Q-7 — screen-only, preview not compliance ✅ decided 2026-07-26

No export path. The result is internal to PH-Navigator and is a **preview**, not
a compliance artifact. Reinforces §D-2's framing and adds a constraint: no
"download report" affordance in v1, because a downloadable artifact is what turns
a preview into something that gets attached to a submission.

Ed's related note — that HBJSON has no place to put membranes — is taken for the
`assembly-membrane-layers` export decision (its Q-M1): membranes export as a thin
`EnergyMaterial` with real thickness and conductivity, which round-trips today,
with the membrane identity carried in the existing `ph_nav` block.

---

## Part 3 — Edge cases

| # | Case | Handling |
| --- | --- | --- |
| E-1 | µ = ∞ (metals, glass, cellular glass) | No float sentinel. Use `sd ≥ 1500 m` as PHI's vapour-tight convention; document it. |
| E-2 | Air cavity layers | ISO 13788 override `sd = 0.01 m`; never blocks (D-5). |
| E-3 | Assembly with a single layer | Valid; only surface criteria are meaningful. |
| E-4 | `Assembly.type == "other"` | No Rsi/Rse mapping and no roof −2 K rule. Either require a real type or default to wall with a visible note. → open. |
| E-5 | Ground-contact floors | Rse = 0 and monthly ground temperature (PHN has `ClimateMonthlyTemps.ground_c`) — but ISO 13788's model is for air-facing elements. Recommend: **exclude floors-on-grade from v1** rather than produce a wrong answer. |
| E-6 | Ventilated assemblies (rainscreen) | Workbook sets Rse = Rsi and treats the cavity as exterior. PHN has `rainscreen_insulation` category but no per-assembly "ventilated" flag. → needs a flag or an exclusion. |
| E-7 | No climate source attached | Chip = "needs climate"; deep-link to the Climate tab. |
| E-8 | Climate record missing dew point | Some EPW-derived / custom records may have `dewpoint_c` unset or zeroed. Must be validated, not assumed. |
| E-9 | Assembly is all-insulation, zero R elsewhere | Guard divide-by-zero on `Σsd = 0` (a fully vapour-open stack). |
| E-10 | Evaporation clamped at zero | Per §3.5, `Ma` cannot go negative — must clamp, or the annual cycle reports fictitious drying credit. |
| E-11 | Interior insulation flagged | `CreateAssemblyCommand` has no interior-insulation flag; the PHI tool does (`Assembly!J135`). Detectable from layer order + material category, or added as a hint. |
| E-12 | Unit display | Engine is SI-canonical (µ, sd in m, Ma in g/m²). The IP/SI toggle needs an IP presentation: perms / perm·in and gr/ft². Input affordance should accept perms and convert. |
| E-13 | Draft vs saved version | Should the chip compute against the live draft (immediate feedback while editing) or the saved version? `thermal.py` computes on the draft; follow that for consistency. |
| E-14 | Result caching | `thermal.py` already hashes inputs (`thermal_input_hash`). Condensation adds climate + settings to the hash — a bigger key, same pattern. |

---

## Part 4 — Open questions (blocking)

| # | Question | Owner |
| --- | --- | --- |
**All seven resolved 2026-07-26.** Retained for the record; the live consequences
are folded into `PRD.md` and §§D-1, D-9, D-10, D-11.

| # | Question | Resolution |
| --- | --- | --- |
| Q-1 | Catalog coverage after an ISO 10456 seed | ✅ **build it** — Ed leaning include; preliminary seed-file read in §D-12 supports it, with one new problem (composite stud materials) |
| Q-2 | Which 1-D path through a 2-D assembly? | ✅ worst of all paths, capped (§D-1) |
| Q-3 | Licensed µ data in a public repo | ✅ **values live in the private DB**; repo carries the loader only |
| Q-4 | Which interior-climate models in v1? | ✅ confirmed — matches 3 of the PHI tool's 4; see §D-13 for two corrections this surfaced |
| Q-5 | Floors-on-grade and ventilated rainscreens | ✅ **excluded from the screen** — and the underlying gap became its own prerequisite feature (§D-11) |
| Q-6 | Ma limit per project or per material? | ✅ per project, default 200 g/m² |
| Q-7 | Export path or screen-only? | ✅ **screen-only, internal to PHN, preview not compliance** (§D-14) |

## Part 5 — Non-blocking questions

- Should the condensation result appear on the **Status tab** as a project-wide
  roll-up ("3 assemblies with predicted condensation")? Attractive, but a v1.1
  item.
- Should MCP expose a `get_assembly_condensation` tool? Cheap once the service
  layer exists, and it would let an agent screen a whole project. Probably yes,
  as a follow-on phase.
- Variable-sd membranes (Intello) are common in our details and materially change
  the answer. Deferred from v1, but the data model should not preclude a
  humidity-dependent sd curve later — keep `vapor_sd_equivalent_m` scalar for
  now and add a curve field beside it if needed, rather than overloading it.
