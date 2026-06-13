---
DATE: 2026-06-13
TIME: -
STATUS: Gated — needs D-CL-4 + D-CL-5 (Ed's CPHC-domain decisions) and a
  scheduled consumer. Do not start speculatively.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — EPW-derived climate metrics + the
  design-conditions contract consumed by fRSI / window comfort.
RELATED:
  - ../PRD.md §5.3
  - ../decisions.md (D-CL-4 design basis, D-CL-5 interior assumption,
    D-CL-6 EPW storage, D-CL-7 versioning)
  - phase-01-sun-path-service.md
---

# Climate Phase 3 — Design conditions + metrics (gated)

Parses the stored EPW into climate metrics and a small, explicit
**design-conditions contract** that downstream analyses read. Gated on
two domain decisions and on a consumer actually being scheduled.

## Gate

1. **D-CL-4** (design-condition basis) resolved by Ed.
2. **D-CL-5** (interior boundary assumption for fRSI) resolved by Ed.
3. At least one consumer (Thermal-Bridges fRSI or Window comfort) is
   scheduled — don't build a contract with no reader.

## Scope (when promoted)

1. **EPW parse → metrics.** Use `ladybug-core` (already a backend dep)
   to read the stored EPW (the immutable R2 asset — D-CL-6) into:
   monthly mean dry-bulb, heating/cooling design temps (per D-CL-4),
   degree-days. Derive-on-read where cheap; persist only the expensive
   results (PRD §4) — likely a small `project_climate` sibling table or
   a cached derived artifact keyed by the EPW asset id (immutable, so
   the D-15 "compute once" pattern applies cleanly).
2. **Design-conditions contract.** A small SI-canonical endpoint
   `GET /projects/{id}/climate/design-conditions` (+ MCP) returning an
   explicit, versioned shape — e.g. `{ heating_design_db_c,
   coldest_month_mean_db_c, interior_temp_c, interior_rh_pct, basis:
   "<D-CL-4 choice>" }`. The `basis` field names the convention so a
   reviewer can audit it.
3. **Tab views.** Climate tab gains a design-conditions table + climate
   charts (monthly temp, degree-days).

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

- D-CL-4/5 resolved + recorded; design-conditions endpoint + MCP live;
  metrics correct against a known EPW fixture; `make ci` green;
  consumer can read the contract.
