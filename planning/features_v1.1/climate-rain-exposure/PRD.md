---
DATE: 2026-06-21
TIME: -
STATUS: Deferred — candidate PRD for evaluation. Not scheduled.
AUTHOR: Claude (for Ed)
SCOPE: Auto-derived rain-exposure classification (annual rainfall + mean wind
  → exposure tier → cladding-strategy hint), surfaced on the Climate tab.
RELATED:
  - README.md
  - STATUS.md
  - ../climate-design-conditions/PRD.md
  - ../../archive/climate/PRD.md (§4.3 ClimateRecord; §5.4 design conditions)
  - backend/features/climate/record.py
---

# Rain Exposure Class — PRD

## 1. Summary

Compute a **rain-exposure classification** for a project from its attached
climate source and show it on the Climate tab. The classification is a small,
sourced, advisory value object — an exposure tier plus the numbers behind it
plus a cladding-strategy hint — that helps the team decide, at design phase,
whether a wall calls for a **drained/back-ventilated rainscreen** and what
minimum cavity to spec.

All calculation lives in the backend (project rule: frontend displays only).

## 2. The metric

Wind-driven-rain load on a wall is governed by two scalars: how much it rains
and how hard the wind blows while it does. The simplest defensible, well-cited
classification (and the one matching Ed's source notes) is **annual-rainfall
banding** with a wind-aware refinement:

### 2a. v1 default — annual-rainfall bands (BEMMI / PNNL BASC)

| Annual rainfall | Exposure tier | Cladding-strategy hint |
|---|---|---|
| `< 20 in/yr` (`< 508 mm`) | Sheltered / low | Drainage plane adequate; rainscreen optional |
| `20–40 in/yr` (`508–1016 mm`) | Moderate–high | Rainscreen with **≥ 3/16 in (≈ 5 mm)** airspace for **absorptive / reservoir** claddings (stucco, brick, fiber-cement, wood) |
| `≥ 40 in/yr` (`≥ 1016 mm`) | Severe | Rainscreen recommended **regardless of cladding material** |

Thresholds are BEMMI's, surfaced through the PNNL Building America Solution
Center (§References). They are US-centric and scalar (rain only) — simple,
auditable, and directly actionable. NYC-metro / Hudson-Valley / NJ projects
(BLDGTYP's typical geography) sit around 40–50 in/yr, i.e. squarely in the
"severe / rainscreen-regardless" band — so this metric will almost always
read "use a rainscreen" for our work, which is itself a useful confirmation.

### 2b. Optional refinement — Driving Rain Index (wind-aware)

Compute `DRI = (annual rainfall, m) × (mean annual wind speed, m/s)` as an
**annual driving-rain proxy** and report it alongside the band. This is the
Straube / Lacasse "annual driving rain" lineage and explains *why* two sites
with equal rainfall differ in exposure (a windy coastal LI site vs. a
sheltered inland one). For a rigorous, directional treatment, **ISO 15927-3**
(airfield + wall annual indices, l/m²·yr, by orientation) is the standard
upgrade path — deferred; see §6 decision RX-2.

> The exposure tier drives the **headline**; DRI/ISO is an enhancement, not a
> blocker. Ship 2a first.

## 3. Inputs & data sources (the central risk)

| Input | Source today | Status |
|---|---|---|
| **Mean annual wind speed** | `ClimateRecord.average_wind_speed_ms` (already populated for attached sources) | ✅ Available |
| **Annual rainfall** | — | ⚠️ **Not currently captured** in `ClimateRecord` |

**Annual rainfall is the gap and the main thing to resolve.** Candidate
sources, in rough order of preference:

1. **EPW liquid precipitation** (field "Liquid Precipitation Depth", mm) parsed
   via `ladybug-core` (already a dep, already the planned EPW-metrics parser).
   **Caveat — this column is frequently missing or zeroed** in TMY/EPW files
   (sentinel `999`, or a flat `0`); many sources simply do not populate it. So
   EPW rainfall must be **validated, not trusted**: if the annual sum is `0`,
   implausibly low, or sentinel-flagged, fall back rather than report a false
   "sheltered."
2. **ASHRAE climatic design data** — the attached ASHRAE source may carry
   precipitation figures; use when present.
3. **External climate normals** (NOAA NCEI 1991–2020 normals / PRISM) keyed by
   station or lat/long — the most reliable annual-rainfall source, but a new
   outbound dependency. Evaluate as a fallback provider.
4. **User override** — a manual annual-rainfall entry on the Climate tab
   (reuses the deferred custom-record entry form from `climate-tab-followups`)
   as the always-available escape hatch.

The output must **name which source produced the rainfall figure** (see
`basis`, §4) so a reviewer can audit it and so a "sheltered" result is never
silently the product of a blank EPW column.

## 4. Output contract

A small, explicit, versioned SI value object — same shape discipline as the
`climate-design-conditions` per-source contract, so they can share the
endpoint family:

```
GET /projects/{id}/climate/rain-exposure?source=<phius|phi|epw|ashrae|custom>
```

```jsonc
{
  "annual_rainfall_mm": 1180,
  "mean_wind_speed_ms": 4.2,
  "driving_rain_index": 4.96,        // m·m/s, optional (§2b)
  "exposure_class": "severe",        // sheltered | moderate | severe
  "cladding_strategy": "Rainscreen recommended regardless of cladding material.",
  "min_airspace_mm": null,           // populated for the moderate band (≈5mm)
  "classification_basis": "BEMMI / PNNL BASC annual-rainfall bands",
  "rainfall_basis": "epw:liquid-precipitation",   // names the rainfall source
  "wind_basis": "phius-2022 / <station>",
  "confidence": "ok"                 // ok | low (e.g. EPW precip looked sentinel)
}
```

- `*_basis` mirrors the design-conditions `basis` convention: every number is
  attributable to a named dataset/standard.
- `confidence: "low"` is the contract's honest signal when rainfall had to be
  inferred from a thin/zeroed EPW column — surfaced as a caveat in the UI, not
  swallowed.
- Expose the same value over **MCP** alongside the design-conditions tool.
- Provide it as an `Annotated` Pydantic v2 model (project Pydantic-v2 rule).

## 5. UI — Climate tab

- A compact **Rain Exposure** card on the Climate tab: the tier as a labeled
  chip (reuse the canonical `report-status-chip` styling — see the
  filter-chip memory), the annual-rainfall + mean-wind figures, and the
  cladding-strategy line with an info affordance linking the citation.
- When `confidence: "low"`, show an inline caveat ("rainfall not reported by
  the EPW; classification approximate — attach a normals source or enter a
  value").
- Read-only; no new editable state beyond the optional manual-rainfall
  override (§3.4).

## 6. Open decisions

- **RX-1 — Rainfall source priority.** Which fallback chain (§3) ships first?
  Recommendation: EPW-with-validation → user override for v1; add NOAA/PRISM
  normals as a follow-up if EPW proves too sparse across real projects.
- **RX-2 — Classification standard.** Ship the scalar BEMMI/BASC bands (§2a)
  first; treat DRI (§2b) as an additive readout and ISO 15927-3 directional
  indices as a later upgrade. Confirm we are content leading with the
  US-centric annual-rainfall bands for a NYC-metro practice.
- **RX-3 — Directional vs. scalar.** Scalar (whole-building) for v1. A
  per-orientation driving-rain rose (worst-exposed wall) is a real PH-relevant
  enhancement but needs wind-direction frequency data and a UI — defer.
- **RX-4 — Scope of the cladding recommendation.** Keep it an advisory
  *exposure-driven hint with citations*, not a code/assembly determination.
  It informs; it does not certify.

## 7. Reproducibility

EPW-derived rainfall keys off the **immutable EPW asset id** (D-15 "compute
once"; the `project_airtightness.hbjson_file_id` precedent). A re-uploaded EPW
is a new asset → recompute; the prior asset's exposure value stays
reproducible. Reproducibility-sensitive consumers pin the EPW asset id.

## 8. Explicitly NOT here

- **Hygrothermal / WUFI rain-load modeling.** This is a coarse exposure
  *classifier*, not a wall-wetting simulation. ASHRAE 160 driving-rain
  deposition and WUFI rain loads are downstream and out of scope.
- **Assembly/code determination.** No selection of a specific WRB, flashing,
  or cavity product; no code-compliance claim.
- **A second EPW parser.** Reuse the `climate-design-conditions` EPW-metrics
  layer; do not duplicate it.

## 9. Exit criteria (when built)

- Rain-exposure endpoint + MCP live; SI value object with `*_basis` named and a
  `confidence` flag; mean wind read from `ClimateRecord`; annual rainfall from
  the chosen source with EPW-sentinel validation; classification correct
  against a known fixture (a NYC-metro EPW → "severe"); Climate-tab card
  renders the tier + cited strategy; `make ci` green.

## 10. References

Building-science basis (from the 2026-06-21 research):

- Straube, J. *BSD-018: The Building Enclosure.* Building Science Digest 018,
  Building Science Corporation, 2006.
  https://buildingscience.com/documents/digests/bsd-018-the-building-enclosure_revised
- Straube, J. *BSD-013: Rain Control in Buildings.* BSC, rev. 2011. (The 3-D
  approach: Deflection / Drainage / Drying.)
  https://buildingscience.com/documents/digests/bsd-013-rain-control-in-buildings
- Straube, J. *BSD-030: Rain Control Theory.* BSC.
  https://buildingscience.com/documents/digests/bsd030-rain-control-theory
- Straube, J. *RR-0907: Ventilated Wall Claddings — Review, Field Performance,
  and Hygrothermal Modeling.* BSC, 2009. (Empirical basis for cavity behavior;
  the paper PNNL cites.)
- Straube, J. *BSD-148: Simplified Prediction of Driving Rain on Buildings —
  ASHRAE 160P and WUFI 4.0.* BSC.
  https://buildingscience.com/documents/digests/bsd-148-wufi-simplified-driving-rain-prediction
- PNNL / U.S. DOE Building America. *Moisture-, Impact-, Fire-, and
  Pest-Resistant Exterior Siding.* Building America Solution Center.
  (BEMMI: rainscreen ≥ 3/16 in airspace for absorptive cladding when
  > 20 in/yr; rainscreen regardless of cladding when ≥ 40 in/yr.)
  https://basc.pnnl.gov/resource-guides/moisture-impact-fire-and-pest-resistant-exterior-siding
- PNNL / U.S. DOE Building America. *Drainage Plane Behind Exterior Wall
  Cladding.* BASC.
  https://basc.pnnl.gov/resource-guides/drainage-plane-behind-exterior-wall-cladding
- ISO 15927-3 *Hygrothermal performance of buildings — Calculation and
  presentation of climatic data — Part 3: Calculation of a driving rain index
  for vertical surfaces.* (Rigorous, directional upgrade path — RX-2.)
- ASHRAE Standard 160 *Criteria for Moisture-Control Design Analysis in
  Buildings.* (Driving-rain deposition — downstream, out of scope.)
