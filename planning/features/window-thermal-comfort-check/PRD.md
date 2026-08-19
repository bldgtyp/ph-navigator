---
DATE: 2026-08-18
TIME: 10:52 EDT
STATUS: Draft — not started
AUTHOR: Ed May / Claude
SCOPE: Automatic Phius window thermal-comfort compliance check on the Apertures page
RELATED:
  - context/DESIGN_SYSTEM.md
  - context/ui/pages/apertures.md
  - backend/features/aperture_u_value/
  - backend/features/envelope/condensation.py (UI + status-model precedent)
  - backend/features/climate/design_conditions.py
  - phius-rules ruleset phius-2024-r1: N-3, 1.3.3.3, 1.4.2.6
---

# PRD — Window Thermal Comfort Check

## 1. Problem

Phius applies a hard pass/fail limit on whole-window U-value for every
non-exempt lite, set by the lite's head height above finished floor and the
project's ASHRAE 99% heating design temperature. Today PH-Navigator computes
the U-values but cannot evaluate the criterion, because **the aperture model
carries no vertical datum** — there is no way to know how high off the floor
any lite sits.

The consequence is not theoretical. On 2441 Arverne East (Building D) a
ground-floor storefront package was approved, the glass was then substituted,
and nobody could answer "does this still comply?" without hand-rebuilding the
geometry in a spreadsheet and reading head heights off the shop drawings. The
answer turned out to be no — and, more importantly, the *previously approved*
package also fails at the tallest lites under the interpretation Phius
actually enforces. That is exactly the class of miss this app exists to catch.

The check is also cheap to automate: the criterion is a closed-form
expression, and PHN already holds every input except one.

## 2. What Phius actually requires

Governing rules are in the `phius-rules` corpus (`phius-2024-r1`: `N-3`,
`1.3.3.3`, `1.4.2.6`; `phius-2021-r1`: `N-4`, `3.4`). Summary of the binding
mechanics — see the corpus for citations and provenance:

**Criterion.** With `HHS` = head height above finished floor [ft] and `Td` =
ASHRAE 99% heating design dry-bulb [°F]:

```
ΔT_max = max(6.0, min(13.3, 14.7 − 0.742 × HHS))     [°F]
U_max  = ΔT_max / (0.74 × (68 − Td))                  [Btu/hr·ft²·°F]
```

`0.74 hr·ft²·°F/Btu` is the interior surface film resistance and `68 °F` the
fixed interior design temperature. Both are constants of the criterion, not
project inputs.

**Unit of evaluation — per lite.** Each element is checked on its own. Blended
U-factors are not permitted and vertical stacks may not be combined. The
highest-head lite governs an assembly, and it is usually the smallest one with
the worst frame-to-glass ratio.

**HHS datum — finished floor.** "Head-height-from-sill" in the published
guidebook means finished floor to the head of *that lite*, not the lite's own
height. A transom's HHS is the full floor-to-transom-head distance.

**Accepted U data — two routes.** Either the NFRC whole-window U at the
standard NFRC model size, or a project-specific whole-window U at the as-built
lite size. The standard-size value is permitted even when the real lite is far
smaller, and for transoms it is routinely the difference between pass and
fail. **A checker that only implements the project-specific route will report
false failures.**

**Exemptions.** Non-regularly-occupied (transient) areas and ADA doors. The
test is transient vs non-transient occupancy — gyms, lounges and seated
lobbies are *not* exempt.

**Alternative compliance.** Active heat within 3 ft in plan of the window
satisfies comfort (and only comfort — never condensation). Supplementary
sources carry a source-energy penalty; primary sources do not.

## 3. Scope

### In scope

- One new required-for-the-check aperture parameter: **sill height above
  finished floor**.
- Backend derivation of per-lite head height and per-lite `U_max`.
- Backend comfort evaluation per element, both data routes.
- An `Apertures` page status chip + detail modal, mirroring the Envelope /
  Assemblies condensation UI.
- Exemption and perimeter-heating flags so a lite can be marked compliant by
  an accepted alternative path rather than silently failing forever.

### Out of scope

- The condensation-risk criterion (`fRsi` / CRF / CR / TI). Separate feature;
  shares the applet but not the inputs, and perimeter heating does not satisfy
  it.
- Reproducing the official Phius applet as a submittal artifact. **The applet
  remains the submittal document.** This check is a pre-flight screen, exactly
  as `phius-rules/calculators/*/impl.py` are.
- Embedding a climate-station database. PHN already resolves design conditions
  (§5.2).
- Automatic source-energy accounting for supplementary perimeter heat.

## 4. The new parameter

Add to `ApertureTypeEntry` (`backend/features/project_document/envelope_models.py`):

```python
sill_height_mm: float | None = None
```

Semantics: height of the **bottom edge of the whole aperture** above finished
floor. One value per aperture type, not per element.

Head height of any element is then fully derived. Row 0 is the top row
(confirmed by `apertures/edge_classification.py`, where `row_start - 1` is the
"top" neighbour), so:

```
head_height_mm(element) =
    sill_height_mm
  + sum(row_heights_mm)
  − sum(row_heights_mm[0 : element.row_span[0]])
```

That is: the aperture's base, plus the full grid height, less every row
strictly above the element. Void elements participate in the grid, so the
coverage invariant guarantees this is well-defined for every element.

**Why one datum and not a per-element height.** A per-element value would be
redundant with `row_heights_mm`, would drift out of sync on any
add-row / merge / split command, and would put the burden of a derivable
number on the user. One datum per type is the minimum honest input.

### Required-ness

Ed's intent is that this is a **required** parameter. Implement that as
*required for the check*, not as a non-null column:

- Schema stays `float | None` so existing saved documents remain loadable. A
  hard non-null field would break every stored version and force a backfill
  with invented numbers.
- The comfort check returns a `blocked` state with a `missing_sill_height`
  flag when it is absent, and the chip reads "Comfort: needs sill height (n)".
- Aperture types missing it surface in the existing unfinished-work
  surfaces (`query_unfinished_envelope_work` / status items) so it is visibly
  incomplete rather than quietly skipped.

This mirrors exactly how condensation already handles a missing climate source
(`missing_climate_source` → `blocked`), and it is the pattern that has worked.

**Open decision for Ed:** should an existing aperture type with no sill height
count as *blocked* (visible, nagging, never green) or as *not screened*
(neutral, opt-in)? Recommendation: **blocked**, because a silently-unscreened
window is the failure mode this feature exists to prevent.

## 5. Inputs already in PHN

### 5.1 Geometry and U-values

`features/aperture_u_value/` already produces per-element whole-window U
(`element_u`) from glazing U, per-edge frame U and widths, and psi-spacer,
excluding psi-install. That is the project-specific route, ready to use.

### 5.2 Design temperature

`features/climate/design_conditions.py` already carries
`ClimateDesignConditions.heating_990_db_c` — the ASHRAE 99% heating dry-bulb,
in °C, fetched via `ashrae_meteo.py` or parsed from an EPW `.stat`. This is
precisely `Td`. No new climate work is needed.

Convert to °F at the criterion boundary; keep SI canonical in storage per
`context/DATA_STORAGE.md`.

Blocked state when the project has no climate source or the field is null.

### 5.3 What is missing besides sill height

**NFRC standard-size whole-window U.** PHN's window constructions carry
component data (glazing U, frame U, psi) but no field for a published
whole-window U at the NFRC standard model size. Without it, only the stricter
route is testable. Add:

```python
nfrc_whole_window_u_w_m2k: float | None = None   # at standard NFRC model size
nfrc_standard_size_note: str | None = None       # e.g. "2.00 m x 2.00 m"
```

on the window-construction record, and let the check report both routes,
passing a lite if **either** clears. Flag when only the stricter route is
available so the user knows a cheaper answer may exist.

## 6. Evaluation model

Per element, produce:

| Field | Meaning |
| --- | --- |
| `head_height_mm` | derived, §4 |
| `delta_t_max_f` | clamped linear |
| `u_max_w_m2k` | the limit |
| `u_project_specific_w_m2k` | from `aperture_u_value` |
| `u_nfrc_standard_w_m2k` | if the construction carries one |
| `governing_route` | which route was used to pass |
| `margin` | `u_used / u_max` — surfaces "barely passes" |
| `state` | `pass` / `fail` / `exempt` / `alternative` / `blocked` |

Aperture-level roll-up takes the **worst** element state and names the
**governing element** (highest head height among non-exempt lites). Never
report an area-weighted or averaged U — that is the exact thing Phius refuses.

### Element-level flags

- `comfort_exempt: bool` + `comfort_exempt_reason` (`non_regularly_occupied`,
  `ada_door`) — set by the user, never inferred.
- `perimeter_heat_within_3ft: bool` + a free-text note for the evidence.
  Renders as `alternative`, visually distinct from `pass`; the modal states
  that it satisfies comfort only and never condensation.

Both flags require a reason string before they take effect, so an exemption is
always accompanied by the justification a certifier will ask for.

### Double-height

`ΔT_max` floors at 6.0 °F, which the clamped expression already produces for
`HHS ≥ 11.73 ft`. No separate double-height input is needed — the ≥16 ft case
in the guidebook prose is subsumed by the floor.

## 7. UI

Mirror Envelope / Assemblies. Per `context/DESIGN_SYSTEM.md`, reuse the
existing chip and modal components — **no new visual language, no new colors**.

**Chip** on each aperture type, next to the existing U-value presentation.
Follow `frontend/src/features/envelope/condensation-chip.ts` exactly:
`{ label, tone, muted }`, tones from the existing `success | warning | danger
| neutral` set.

```
Comfort: OK                        success
Comfort: 3 lites fail              danger
Comfort: passes on alternative     warning
Comfort: needs sill height         neutral
Comfort: needs a climate source    neutral
Comfort: not screened              neutral, muted
```

**Modal**, mirroring `CondensationRiskModal`'s panel structure:

1. **Verdict** — pass/fail, the governing element, and the one-line reason.
2. **Where** — the aperture grid with each lite tinted by state; the
   governing lite marked. This is the panel that makes "the transom is the
   problem, not the big glass" obvious at a glance.
3. **Numbers** — per-lite table: head height, ΔT_max, U_max, both U routes,
   margin, state.
4. **Assumptions** — `Td` and its station/source, the 0.74 / 68 °F constants,
   the ruleset the criterion came from, and a plain statement that the
   official Phius applet remains the submittal artifact.

## 8. Verification

- Unit tests on the criterion against the `phius-rules`
  `calculators/window-comfort/impl.py` port (19 passing tests there), which is
  itself validated against the official applet. Same constants, same clamp,
  same rounding behaviour.
- Head-height derivation tests over ragged grids: multi-row spans, voids,
  merged elements, single-row types.
- A regression fixture built from the Arverne D storefront geometry, asserting
  that the transoms fail and the lower vision panels are marginal. **Use
  synthetic U-values** — this repo is public and window product data is
  licensed (`context/DATA_STORAGE.md`).
- Blocked-state tests: no sill height, no climate source, null
  `heating_990_db_c`.

## 9. Risks

- **False failures if the NFRC route is not implemented.** The single biggest
  correctness risk. A checker that only knows the project-specific U will tell
  users their compliant windows fail. Ship both routes together or ship
  neither.
- **Sill height is a real data-entry burden.** Every existing aperture type
  needs one. Mitigate by allowing it to be set per aperture type from the
  table view, and consider a bulk-set for types sharing a floor.
- **Ruleset drift.** The criterion constants are pinned to a Phius ruleset. If
  Phius revises them, PHN must not silently keep using the old numbers —
  record which ruleset the check implements and surface it in the Assumptions
  panel.
- **Over-trust.** The modal must say the applet is the submittal artifact.
  This is a screen, not a certificate.

## 10. Open questions

1. Blocked vs not-screened for a missing sill height (§4). Recommendation:
   blocked.
2. Does the sill height belong on the aperture *type*, or does the same type
   get reused at different floor heights on one project? If reuse across
   heights is real, the datum has to move to the aperture *instance*, and this
   design changes materially. **This is the one question that could reshape
   the feature — worth answering before any code.**
3. Should PHN implement the 2021 criterion too, or assume 2024 for all
   projects? The formula is identical in both rulesets, so this is only about
   which citation is displayed.
4. Ed's original note trails off mid-sentence ("This will be a required
   parameter so we can do this check properly. We…"). Whatever followed is not
   captured here.
