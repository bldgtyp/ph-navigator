---
DATE: 2026-07-26
TIME: 11:05 EDT
STATUS: Accepted — Phase 1 implemented; Phases 2–4 open (see ./STATUS.md)
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: A real boundary-condition model for assemblies — exterior condition
  (outdoor air / ground / ventilated / unconditioned), standard-based surface
  resistances, heat-flow direction, and a graphic interior/exterior indication
  on the section.
RELATED: ./README.md, ./STATUS.md,
  ../assembly-condensation-risk/PRD.md (depends on this),
  ../../archive/dated/2026-07-26/assembly-membrane-layers/PRD.md (complete),
  backend/features/envelope/thermal.py, context/ui/pages/envelope-tab.md
---

# PRD — Assembly boundary conditions and surface films

## 1. What PHN has today (verified 2026-07-26)

Ed's read is correct, and the gap is wider than floors-on-grade:

1. **There are no surface films at all.** `thermal.py` sums only
   `_segment_r_value = thickness / conductivity`. No Rsi, no Rse, anywhere in the
   calculation. The docstring is explicit that this is a "construction-only"
   preview.
2. **The header metric is honest about this today — correcting my earlier
   claim.** I previously wrote that the header "overclaims"; reading
   `frontend/src/features/envelope/components/AssemblyHeader.tsx` shows it does
   not. The metric is labelled **"Thermal"** (not "Effective U-Value" — that
   string comes from the ASCII mockup in `context/ui/pages/envelope-tab.md`,
   which does not match the shipped component), and its `InfoTooltip` states
   plainly:

   > *Note: Surface film resistances (air films) are NOT included in the value
   > shown here.*

   So this is not a correctness or honesty fix. It is a deliberate change of
   convention, motivated by ISO 13788 needing films and by PHPP-consistency
   wanting them — and the disclosure has to change with it.

   Two wrinkles found in the same file:
   - The displayed value **changes kind with the unit system**: IP renders
     `r_effective` (R-value, 1 dp), SI renders `u_effective` (U-value, 3 dp). So
     folding films in moves R *up* for IP users and U *down* for SI users, and
     the tooltip's title ("Effective Thermal Resistance") is only accurate on the
     IP branch.
   - The tooltip cites *ASHRAE Fundamentals Ch. 27* while
     `backend/features/envelope/thermal.py` cites *Ch. 25* for the same two
     methods. Both are arguably defensible (Ch. 25 describes them, Ch. 27 works
     examples) but they should agree. Fix in the same pass.
3. **`Assembly.type` (`wall`/`floor`/`roof`/`other`) is decorative.** Grep shows
   it consumed only by `hbjson_export.py` (as metadata), `hbjson_import.py`
   (prefix inference), and the sidebar icon. It drives no resistance, no
   heat-flow direction, nothing physical.
4. **There is no "adjacent to" concept.** Outdoor air, ground, ventilated cavity,
   and unconditioned space are indistinguishable. The PHI tool has exactly this
   axis (`1 - Outdoor Air` / `2 - Ground` / `3 - Ventilated`) and it drives Rse
   (0.04 / 0 / = Rsi respectively).
5. **The `air_*` catalog categories are cavities, not films.** 180 of the 408
   seeded materials are `Air layer, unventilated, <direction>, thickness: N mm`
   with an equivalent λ — air *spaces* inside the construction. Nothing in the
   catalog represents a surface film.
6. **Heat-flow direction is a manual chore.** The catalog encodes direction for
   cavities (`air_upward` / `air_downward` / `air_horizontal_heat_flow`), but
   nothing derives it from `Assembly.type`. The user picks the right cavity
   material by hand, and nothing catches it if they pick the wrong one.

Net: the most consequential thermal assumption in the assembly — what is on
either side of it, and what film resistance that implies — is currently invisible
and unmodelled.

## 1a. How honeybee-energy handles this (source-verified 2026-07-26)

Read from `~/Dropbox/bldgtyp-00/00_PH_Tools/honeybee-energy/honeybee_energy/`.
This matters because it tells us what we can and cannot inherit, and it confirms
that PHN's assembly model is deliberately *different* from Honeybee's in the one
way that makes a Glaser analysis possible at all.

**Constructions carry no type and no heat-flow direction.**
`OpaqueConstruction` (via `construction/_base.py`) has no assembly type, no tilt,
no direction. Direction only exists once the construction is assigned to a
`Face`, whose boundary condition and geometry supply it. PHN — like PHPP — puts
type on the *assembly*, which is what lets us resolve Rsi and heat-flow direction
without a geometric model. That divergence is a feature, not drift.

**`r_value` excludes films; `r_factor` includes them — and they are not ASHRAE.**

```python
r_value  = sum(mat.r_value for mat in materials)        # no films
r_factor = r_value + 1/out_h_simple() + 1/in_h_simple() # with films
out_h_simple() -> 23                                    # → Rse = 0.0435, fixed
in_h_simple()  -> 3.6 + 4.4 * inside_emissivity / 0.84   # → Rsi ≈ 0.120 at ε 0.9
```

The docstrings attribute these to **EN 673 / ISO 10292** — *glazing* standards —
applied to opaque constructions. They vary with emissivity and **not** with
heat-flow direction. Against ISO 6946 that is ~8 % off for a wall (0.120 vs 0.13)
and ~29 % off for a floor (0.120 vs 0.17).

**Honeybee does not write films into the IDF, and neither is it "applying ASHRAE
films".** `OpaqueConstruction.to_idf()` emits only the material layer names. Film
coefficients are computed by **EnergyPlus itself at runtime**, dynamically per
timestep from surface tilt, wind speed, and temperature difference via its
convection algorithms — honeybee-energy does not even write a
`SurfaceConvectionAlgorithm` object, so E+ defaults apply. `r_factor`/`u_factor`
are reporting/comparison properties only; they never reach the simulation.

So there are **three** unrelated film conventions in play, and conflating them is
easy:

| Convention | Where | Direction-aware? |
| --- | --- | --- |
| ISO 10292 / EN 673 | honeybee `r_factor` (reporting only) | no — emissivity only |
| E+ dynamic convection | the actual simulation | yes, and also wind/ΔT |
| **ISO 6946 / ASHRAE** | PHPP, ISO 13788, and what we need | yes, via assembly type |

**Useful precedent:** `OpaqueConstruction.temperature_profile(angle=...)` already
computes layer-boundary temperatures with films and *is* direction-aware (angle
0 = downward flow, 90 = vertical, 180 = upward). It uses ISO 15099 detailed
coefficients rather than ISO 6946, so it is not directly reusable for ISO 13788 —
but it is a good model for the shape of our own profile function.

## 2. Why this is a prerequisite for the condensation screen

ISO 13788's entire temperature profile is
`θ_j = θe + (ΣR up to j / R_total) · (θi − θe)` with
`R_total = Rsi + ΣR_j + Rse`. Get Rsi/Rse wrong and every interface temperature
is wrong, which moves every `psat`, which moves where and whether condensation is
predicted.

Worse, two of the four ISO 13788 criteria are *entirely* about the surface:
surface condensation and mould growth are evaluated at a **second, higher
Rsi = 0.25 m²K/W** (the ISO furniture-and-corner allowance), and fRsi is a
temperature-factor ratio defined against it. Without a film model those three
checks cannot be computed at all.

**`assembly-condensation-risk` Phase 2 is gated on this feature plus
`assembly-membrane-layers`.** Both are prerequisites; neither is optional.

## 3. Standalone value

- Fixes/clarifies the U-value semantics users read off the header today (§1.2).
- Makes floors-on-grade, ventilated rainscreens, and party walls to unconditioned
  space expressible — currently all three are silently modelled as if they faced
  outdoor air.
- Removes the manual heat-flow-direction chore and the class of errors it invites.
- Makes a hidden assumption visible on the drawing (§5), which is the part with
  the most day-to-day value.

## 4. Model

### 4.1 Per-assembly

```
Assembly.exterior_condition: "outdoor_air" | "ventilated" | "ground"
                           | "unconditioned_space"        # default "outdoor_air"
```

**One new field.** Ed's decomposition is exactly right and the ISO 6946 tables
confirm it: **the interior side is fully determined by `Assembly.type`, and the
exterior side is the only user-selectable axis.**

| `Assembly.type` | heat flow | Rsi |
| --- | --- | --- |
| roof | upward | 0.10 |
| wall | horizontal | 0.13 |
| floor | downward | 0.17 |
| **other** | **horizontal** | **0.13** |

`other` → horizontal, decided 2026-07-26 (Ed). ISO 6946's "horizontal" band
covers heat-flow directions within ±30° of horizontal, which is a wide catchment,
and 0.13 is the *middle* of the three values — so it is the least-wrong default in
either direction when the direction is unknown. Still surfaced in the UI as a
visible assumption rather than a silent one.

| `exterior_condition` | Rse | Note |
| --- | --- | --- |
| outdoor air | 0.04 | the default and the overwhelming majority |
| ventilated | **= Rsi** | ISO 6946 §6: a well-ventilated layer and everything outboard of it are ignored, and the exterior surface is treated as an internal one |
| ground | 0 | screening excluded from the condensation feature (§4.3) |
| unconditioned space | **= Rsi** | film-identical to `ventilated` **today**; see below |

(Rse for "ventilated" being `= Rsi` is verified in the PHI workbook:
`H139 = IF($F139 = Data!$C$32, $H138, …)` where `C32 = "3 - Ventilated"` and
`H138` is the interior Rsi.)

**`unconditioned_space` is modelled now, its Ft math deferred** — decided
2026-07-26 (Ed). **This reverses the Q-B3 resolution recorded on the same day**,
which had dropped the value on the grounds that ISO 6946 gives it the same Rse as
`ventilated`, so it "added nothing".

That reasoning was wrong, and in a familiar way: identical output today does not
justify collapsing two different meanings. A wall behind a rainscreen and a wall
to an unheated garage produce the same film resistance and are not the same
thing. Conflating them discards the user's intent, and when the temperature
factor (Ft) lands we would have to go back and reclassify every assembly that was
labelled `ventilated` but is actually an unheated space — a migration we cannot
perform correctly, because the information was never captured. The enum value is
free; the lost information is not.

So: the value exists and resolves to `Rse = Rsi`. The Ft temperature treatment is
**deferred and owned by `assembly-condensation-risk`**, and the UI must not imply
the other side's temperature is modelled.

Plus the ISO 13788 surface-check resistance **Rsi = 0.25** held separately — it
is used only by the condensation feature's surface criteria, never by the
U-value.

### 4.2 Which standard — an independent project setting

ISO 6946 and ASHRAE Fundamentals give different surface resistances. **Decided
2026-07-26 (Ed): this is an independent, explicit project setting, defaulting to
ISO 6946.**

My earlier suggestion to derive it from `cert_programs` was wrong and is
withdrawn: projects can be both PHI and Phius, or neither, so certification class
is not a reliable proxy for a calculation convention. Two further arguments for
the ISO default: PHI reviewers work in ISO, and PHPP's own U-Values worksheet is
ISO 6946-based — so ISO keeps PHN and PHPP consistent by default.

```
assumptions:
  thermal_standard: "iso_6946" | "ashrae"     # default "iso_6946"
```

> **As built.** Phase 1 shipped `ThermalStandard = Literal["iso_6946"]` — a
> single-member literal — so no document could name a standard whose values
> did not exist. Phase 4 widened it to `"iso_6946" | "ashrae"` alongside the
> loader. ISO's values stay in code; ASHRAE's live only in the private
> object store (`../../../context/DATA_STORAGE.md` class ④), and asking for
> an unpublished standard returns a typed 409 rather than falling back to
> ISO numbers under an ASHRAE label.

**Consolidation:** this belongs in the same versioned document block as the
condensation settings rather than as a second sibling. Recommend one
`assumptions` block on `ProjectDocumentTables` holding `thermal_standard` and
`condensation_settings`, following the existing
`manufacturer_filters: X | None = None` precedent. Both are versioned calculation
assumptions and both need to travel with a saved version.

The ASHRAE values need extracting from
`~/Dropbox/bldgkraft/Codes & Standards/2017 ASHRAE Handbook/SI/` and, per the
repo's public-repo rule, follow the same private-DB routing as the µ values
(`assembly-condensation-risk/decisions.md` §D-7). Given "99 % ISO", the ASHRAE
set is Phase 4 and can lag well behind the rest.

### 4.3 What this does *not* do

Ground-coupled floors get `Rse = 0` and are marked **out of scope for the
condensation screen** (`assembly-condensation-risk/decisions.md` E-5). ISO 13788
is an air-facing-element method; monthly ground temperature exists in
`ClimateMonthlyTemps.ground_c`, but producing a Glaser answer for a slab would be
a wrong answer confidently presented. Expressing the condition is in scope;
screening it is not.

## 5. Rendering — make the invisible assumption visible

Today the section carries bare text labels: `exterior` above the layer stack,
`interior` below (`context/ui/pages/envelope-tab.md`). That is the whole
indication.

**Decided 2026-07-26 (Ed): promote the labels themselves into the control.** The
existing `exterior` / `interior` text becomes the affordance rather than gaining
a separate one — the thing the user already looks at is the thing they click.

- **Exterior label → a select.** Four options, matching §4.1 exactly:
  `Exterior · Outdoor air` / `Exterior · Ventilated` / `Exterior · Ground` /
  `Exterior · Unconditioned space`. (Ed's "Normal" renamed to "Outdoor air" to
  match ISO 6946's own term and to avoid implying the others are abnormal.)
  Rendered as an `AutocompleteSelect`-family control or a small `AppMenu`,
  editor-only; viewers and locked versions see static text.
- **`Unconditioned space` needs honest secondary text** — its film resistance is
  currently identical to `Ventilated`, and the temperature on the far side is not
  yet modelled. The option should say so (e.g. a muted "same surface resistance
  as ventilated; adjacent temperature not yet modelled") so selecting it is a
  record of intent, not a false claim of extra fidelity.
- **Interior label → static, derived, informative.** It reads
  `Interior · Rsi 0.13 (horizontal)` — not editable, because it is fully
  determined by `Assembly.type`, and showing the derived value is what makes the
  derivation checkable. Changing it means changing the assembly type, which
  already has a control.
- **Both labels show the resistance in play.** This is the actual win: the most
  consequential thermal assumption in the assembly goes from invisible to
  legible without adding any chrome.
- **Face bands.** A tinted band along each face — cool/neutral outside, warm/
  neutral inside — from the existing token palette, no new tokens. Ground and
  ventilated get distinct treatments (a hatch for ground contact, a vented/arrowed
  band for a ventilated cavity), because those are the cases most likely to be
  silently wrong today.
- Respect `prefers-reduced-motion` and both themes; no new tokens without a
  `context/DESIGN_SYSTEM.md` pass.

Guardrails: one band plus one label per face. The material colors stay dominant;
this must not become a legend-heavy diagram.

## 6. Interaction with existing behaviour

- **U-value — films are folded in. Decided 2026-07-26 (Ed).** Once films exist,
  the thermal calculation uses them, and the header number becomes a real
  U-factor. Consequences, all of which need handling in Phase 2:
  - **Every displayed U-value changes**, and always downward (adding Rsi + Rse
    raises R). The shift is small on a good assembly (R 4.0 → U 0.250 becomes
    U 0.240, ~4 %) and large on a poor one (R 1.0 → U 1.000 becomes U 0.855,
    ~15 %). Numbers users have already reported will move.
  - **Both branches move**: IP users see `r_effective` rise, SI users see
    `u_effective` fall. Neither is a bug report waiting to happen only if the
    tooltip lands with it.
  - Keep the construction-only R visible in the tooltip alongside the new value,
    so the old number is still findable and the difference is self-explaining.
  - **Rewrite the `#assembly-thermal-metric` tooltip** (decided 2026-07-26, Ed —
    §9 Q-B5). It currently reads *"Surface film resistances (air films) are NOT
    included in the value shown here."* That sentence is the change, inverted, so
    it is the natural anchor. The replacement must state: films **are** now
    included; which standard is in force (ISO 6946 or ASHRAE) and the Rsi/Rse
    actually used; the heat-flow direction derived from the assembly type; and
    the construction-only R for comparison. Also reconcile the Ch. 25 / Ch. 27
    citation with `thermal.py` (§1.2).
  - Revisit the tooltip title — "Effective Thermal Resistance" is only accurate
    on the IP branch, and less so once films are in.
  - **`thermal_input_hash` must include the standard and the boundary
    condition**, or cached results will survive a change that should invalidate
    them.
- **PHPP export must stay construction-only.** The U-Values worksheet adds films
  itself from its own assembly-type setting, so the export keeps sending bare
  material layers. Now that PHN has films internally, this is a live
  double-counting risk and needs an explicit test.
- **HBJSON export is unaffected.** Honeybee computes its own `r_factor` from
  materials (§1a); we send layers, as we do today.
- **HBJSON export.** `assembly_type` already rides in the `ph_nav` block;
  `exterior_condition` should join it. Honeybee's own boundary conditions live on
  faces, not constructions, so this stays PHN metadata.
- **Existing documents.** `exterior_condition` defaults to `outdoor_air`, which
  is what every existing assembly is implicitly assumed to be today — so the
  default is a faithful no-op, not a guess.

## 7. Phasing

| Phase | Content |
| --- | --- |
| **1** ✅ | `exterior_condition` + `assumptions.thermal_standard` fields, ISO 6946 resistance table, heat-flow direction from `type`. **No change to any displayed number.** Delivered 2026-07-26 — as-built notes in `./STATUS.md`. |
| **2** ✅ | Fold films into the thermal calculation (§6): both unit branches move, **`#assembly-thermal-metric` tooltip rewritten** (it currently asserts the opposite), construction-only R kept in the tooltip, `thermal_input_hash` extended, PHPP double-count regression test added, Ch. 25/27 citation reconciled. Delivered 2026-07-26 — as-built notes in `./STATUS.md`. |
| **3** ✅ | Rendering — exterior label becomes a select, interior label shows derived Rsi, face bands, ground/ventilated treatments. Delivered 2026-07-26 — as-built notes in `./STATUS.md`. |
| **4** 🟡 | ASHRAE resistance set (private-DB routed) + the standard selector in the UI. Low priority — Ed reports ~99 % ISO. **Routing decided 2026-07-26 (Ed): private object store, loader only** (D-7 option 1). The mechanism landed; the values and the selector are outstanding — see `./STATUS.md` → "Still open on Phase 4". |

Phase 1 alone unblocks `assembly-condensation-risk` Phase 2, and does so without
moving a single number a user can see. Phase 2 is the one that changes reported
results, so it stays a separate decision and a separate diff.

Phase 1 alone unblocks `assembly-condensation-risk` Phase 2.

## 8. Acceptance criteria

1. Every existing assembly resolves to `outdoor_air`, and **after Phase 1 no
   displayed number has changed**.
2. `(type, exterior_condition, standard)` resolves a deterministic
   `(Rsi, Rse, heat_flow_direction)` triple, unit-tested against the ISO 6946
   table for all combinations.
3. After Phase 2 the thermal metric reflects `Rsi + R_construction + Rse` on
   **both** unit branches (IP R-value and SI U-value), the construction-only R is
   still reachable in the tooltip, and `thermal_input_hash` changes when the
   standard or boundary condition changes.
3a. The `#assembly-thermal-metric` tooltip no longer claims films are excluded,
   and names the standard, the Rsi/Rse in force, and the heat-flow direction.
4. **The PHPP U-Values export still emits construction-only layers** — an
   explicit regression test, since the worksheet adds its own films.
5. The ISO 13788 `Rsi = 0.25` surface-check value is available to the
   condensation feature and never used in the U-value.
6. A ground-contact or ventilated assembly is visually distinguishable from an
   outdoor-air one at a glance, without reading text.
7. Changing `exterior_condition` updates the displayed resistances and U-value
   immediately.
8. No new design tokens; the rendering uses the existing palette.

## 9. Open questions

| # | Question |
| --- | --- |
**All resolved 2026-07-26 (Ed) except Q-B5.**

| # | Question | Resolution |
| --- | --- | --- |
| ~~Q-B1~~ | Does the header U-value include films? | ✅ **yes** — fold films into the thermal calculation. Consequences in §6. |
| ~~Q-B2~~ | What does `type: "other"` resolve to? | ✅ **horizontal heat flow, Rsi 0.13** — ISO 6946's horizontal band spans ±30° of horizontal and 0.13 is the middle value, so it is the least-wrong default. Flagged visibly. |
| ~~Q-B3~~ | `unconditioned_space` in the enum? | ✅ **yes — model the value, defer the Ft math.** *Reverses the earlier same-day "no".* Film-identical to `ventilated` today, but the meanings differ and the information cannot be recovered later. See §4.1. |
| ~~Q-B4~~ | Do the `air_*` cavity materials change? | ✅ **no** — cavities and films are genuinely different things; conflating them is what made this gap easy to miss. Leave unchanged. |
| ~~Q-B5~~ | How is the change communicated when Phase 2 deploys? | ✅ **rewrite the `#assembly-thermal-metric` tooltip** (`AssemblyHeader.tsx`), which today explicitly says films are excluded. No in-app banner. Details in §6. |
