---
DATE: 2026-06-13
TIME: -
STATUS: Active — behavior contract.
AUTHOR: Claude (for Ed)
SCOPE: Product / behavior contract for the project-scoped Climate
  feature (location + weather basis + climate-derived design
  conditions) and its top-level tab.
RELATED:
  - README.md
  - decisions.md
  - PLAN.md
  - planning/archive/project-location/PRD.md
  - context/USER_STORIES.md (tab roster US-3.6)
  - context/PRD.md §6.1 (thin relational layer), §11.5 (SI canonical),
    §10.3 (MCP)
---

# Climate — PRD

## 1. Goal

One authoritative, project-scoped home for a project's **location and
weather basis**, that:

1. keeps a clear, visible **record** of the building location (and the
   EPW it was characterized against);
2. **visualizes** the climate (sun path now; temperature / degree-day /
   design-condition views later);
3. **serves** the location and climate-derived **design conditions** to
   other features — the Model Viewer sun path, Thermal-Bridges fRSI,
   Window thermal-comfort — through SI-canonical, MCP-readable
   endpoints.

Climate **extends** the implemented `project_location` feature
(D-CL-1); it reuses that table + setter as the input store and adds the
service, the tab, and the derived-metrics layer.

## 2. Audiences

- **CPHC (Ed/John):** set location + EPW once; read design conditions
  that downstream analyses use; trust one source.
- **Owners/architects (public viewers):** see where the building is and
  a legible climate picture; no editing.

## 3. Scope

**In scope (phased):**
- Sun-path service: one project-scoped, location-reactive endpoint
  (Phase 1).
- Climate top-level tab: location/EPW record + sun-path visualization
  (Phase 2).
- EPW-derived climate metrics + the **design-conditions contract** that
  fRSI/comfort consumers read (Phase 3).

**Out of scope (separate features / later):**
- The **consumers** themselves — Model Viewer sun-path render
  (`model-viewer-sun-path`), Thermal-Bridges fRSI, Window comfort. They
  read Climate's endpoints; they are not built here.
- Address↔lat/long geocoding, map preview (inherited
  `project-location` non-goals).
- Full WUFI/PHPP climate-dataset alignment (anticipated; not built).

## 4. Data model

Reuse `project_location` (PRD: lat/long/elevation/time-zone/true-north/
address + `epw_asset_id` + `epw_source_url` + parsed-header snapshot in
asset metadata) as the **input store**. No raw-input schema change in
Phases 1–2.

Phase 3 adds **derived** climate values (design conditions, monthly
normals, degree-days). Prefer **derive-on-read** from the EPW where
cheap; **persist** only what is expensive to recompute (mirrors the
D-15 "compute once, serve cheap" instinct). Whether that persistence is
new `project_location` columns or a sibling `project_climate` table is
a Phase-3 implementation detail (decisions.md).

## 5. Behavior contract

### 5.1 Sun-path service (Phase 1)
- `GET /api/v1/projects/{id}/sun-path` → `SunPathAndCompassDTOSchema |
  null`. Public-readable. `null` when no location / lat-long unset.
- Pure ladybug computation from location (lat/long/true-north/
  time-zone), unit radius, origin-centered, DST off, true-north sign
  verified (D-PL-4). No HBJSON, no model dependency.
- MCP-readable (`get_project_sun_path`).
- This is the single endpoint the Model Viewer Site & Sun lens AND the
  Climate tab consume.

### 5.2 Climate tab (Phase 2)
- A new top-level **Climate** tab in `PROJECT_TABS` (6th tab).
- Shows the **location record** (coords, elevation, time zone, true
  north, address) and the **EPW provenance** (filename, source URL,
  parsed header), editor-editable / viewer read-only — reusing or
  migrating `ProjectLocationSettingsSection` (D-CL-3 sub-question).
- Shows a **sun-path visualization** consuming §5.1 (a standalone
  diagram — 2D plan or a light 3D, implementer's call; it is the same
  data the Model Viewer renders over geometry).
- SI-canonical wire; elevation toggles m/ft in the UI; angles invariant
  (inherited units rule).

### 5.3 Climate metrics + design conditions (Phase 3)
- Parse the EPW (`ladybug-core`) → monthly normals, degree-days, and
  the **design conditions** per the basis Ed picks (D-CL-4) + interior
  assumption (D-CL-5).
- Serve a **design-conditions contract** (endpoint + MCP) that fRSI and
  comfort consumers read — a small, explicit, versioned shape (e.g.
  heating design dry-bulb, coldest-month mean, interior temp/RH
  assumption), SI-canonical.
- Tab adds climate charts + a design-conditions table.

## 6. Cross-feature contract (who reads Climate)

| Consumer | Reads | Phase it needs |
|---|---|---|
| Model Viewer Site & Sun render (`model-viewer-sun-path`) | `GET …/sun-path` | Climate Phase 1 |
| Climate tab sun-path visual | `GET …/sun-path` | Climate Phase 1 |
| Thermal-Bridges fRSI (future feature) | design-conditions contract | Climate Phase 3 |
| Window thermal-comfort (future feature) | design heating temp | Climate Phase 3 |

## 7. Acceptance gate (per phase)

- **Phase 1:** sun-path endpoint returns a correct, north-verified
  diagram for a project with location, `null` without; MCP parity;
  `make ci` green; the Model-Viewer sun-path render can consume it.
- **Phase 2:** Climate tab renders for editor + viewer, shows the
  location/EPW record and a sun-path visual; tab added to the roster;
  units behave; `make ci` green.
- **Phase 3:** EPW-derived metrics + the design-conditions contract
  endpoint exist and are MCP-readable; the basis/interior assumptions
  (D-CL-4/5) are resolved and documented; `make ci` green. Wiring the
  fRSI/comfort consumers is tracked in their own features.
