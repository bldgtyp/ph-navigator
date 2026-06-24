---
DATE: 2026-06-13
TIME: -
STATUS: Superseded — promoted to its own v1.1 feature at
  `planning/features_v1.1/climate-design-conditions/` (2026-06-14). This is
  the original handoff, kept for history. Deferred to later feature work
  (Ed 2026-06-13 — focus is the data store first). Needs a scheduled
  fRSI/comfort consumer + D-CL-5. Builds on Phase 2 datasets.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — per-source design conditions + EPW
  metrics; the source-parameterized contract consumed by fRSI / window
  comfort.
RELATED:
  - ../PRD.md §5.4
  - ../decisions.md (D-CL-4 store-all-sources, D-CL-5 interior assumption,
    D-CL-6 EPW storage, D-CL-7/8 pinning + datasets, D-CL-11 per-source)
  - phase-02-reference-datasets-and-format.md
---

# Climate Phase 4 — Design conditions + metrics (gated)

Exposes **per-source** design conditions (the PH datasets' design
columns from Phase 2; EPW-derived percentiles; ASHRAE fetched values)
as a small, **source-parameterized** contract downstream analyses read.
Gated on a scheduled consumer.

## Gate

1. **D-CL-5** (fRSI interior boundary assumption) resolved — note this
   likely belongs to the Thermal-Bridges fRSI consumer, not Climate.
2. At least one consumer (fRSI or Window comfort) is scheduled — don't
   build a contract with no reader.
3. Phase 2 (reference datasets + standardized record) merged — the PH
   datasets already carry design columns; this phase exposes them.

## Scope (when promoted)

1. **Per-source design conditions (D-CL-4 / D-CL-11).** Surface design
   values for each attached source:
   - **PH datasets (Phius/PHI):** already carry design columns (Heating
     load 1/2, Cooling load) in the standardized record from Phase 2 —
     just expose them.
   - **EPW:** parse with `ladybug-core` (already a dep) for design
     percentiles + monthly means + degree-days. Derive-on-read where
     cheap; persist only expensive results, keyed by the immutable EPW
     asset id (D-15 "compute once").
   - **ASHRAE:** the fetched/cached design values from the pointer.
2. **Source-parameterized contract.** `GET /projects/{id}/climate/design-conditions?source=<phius|phi|epw|ashrae|custom>`
   (+ MCP) returning a small, explicit, versioned SI shape — e.g.
   `{ heating_design_db_c, coldest_month_mean_db_c, …, basis:
   "phius-2022 / <station>" }`. The `basis` names the dataset + version
   so a reviewer can audit which source produced a value. A project
   default source (D-CL-11) picks the response when `source` is omitted.
3. **Interior assumption (D-CL-5)** for fRSI is a consumer input, not a
   Climate field — the contract exposes exterior conditions; the fRSI
   feature supplies the interior side. Coordinate when that feature is
   scoped.
4. **Tab views.** Climate tab gains a design-conditions table comparing
   sources + monthly charts.

## Explicitly NOT here

- **The consumers.** Thermal-Bridges fRSI and Window thermal-comfort
  are their own features that *read* this contract. Climate provides
  the conditions; it does not compute fRSI or comfort.
- **WUFI/PHPP climate-dataset alignment** — anticipated, not built.

## Reproducibility note (D-CL-6 / D-CL-7)

Because the EPW is a frozen R2 asset and the derived metrics key off the
EPW asset id, a re-based EPW (new upload) produces a new asset →
recomputed metrics, while the old asset's metrics remain reproducible.
Reproducibility-sensitive consumers pin the EPW asset id (the
`project_airtightness.hbjson_file_id` precedent), rather than the
location table being document-versioned.

## Exit criteria (when built)

- Per-source, source-parameterized design-conditions endpoint + MCP
  live, `basis` named; PH-dataset design values exposed; EPW metrics
  correct against a known fixture; D-CL-5 coordinated with the fRSI
  consumer; `make ci` green; a consumer can read the contract.
