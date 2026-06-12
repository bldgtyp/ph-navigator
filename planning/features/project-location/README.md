---
DATE: 2026-06-12
TIME: -
STATUS: Deferred — requirements stub for handoff; no implementation
  scheduled. Created from model-viewer OQ-1 (Ed 2026-06-12).
AUTHOR: Claude (for Ed)
SCOPE: Required-features list for a new project-level "Location"
  input section. Written so a future agent can flesh this into a full
  PRD + plan without re-deriving context.
RELATED:
  - planning/features/model-viewer/decisions.md (OQ-1 origin; D-07
    sun path consumes this feature's data)
  - context/PRD.md §4 (access model), §11.5 (SI canonical)
  - context/user-stories/50-settings-ops-llm.md (Project Settings
    surface this likely lives near)
  - backend/features/assets/registry.py (asset-kind registry — EPW
    will need a kind)
---

# Project Location — Required Features (handoff stub)

## Why this exists

The Model tab's **Site & Sun lens** needs project latitude /
longitude / true-north to draw a sun path (model-viewer D-07 —
V2 has no EPW storage and a sun path needs only location). Ed's
direction (2026-06-12): build a proper project-level Location
section rather than a one-off field, **with robust linkages to EPW
elements**, and defer all location-consuming features until it
exists.

## Required features (v1 of this section)

1. **Core location data (project-level, not version-bound):**
   latitude (°), longitude (°), elevation (m, optional), time zone
   (IANA or UTC-offset; derivable from lat/long), **true-north
   rotation** (degrees; Rhino/honeybee convention — document the
   sign/reference axis explicitly), site address (free text),
   city/state for display.
2. **EPW linkage (robust, not an afterthought):**
   - Upload an EPW file as a project asset (new `asset_kind='epw'`
     in the asset registry, or document why an existing kind fits).
   - On upload, **parse the EPW header** and offer to auto-fill
     lat/long/elevation/time-zone (one-click accept, editable
     after).
   - Store a source note/URL (e.g. climate.onebuilding.org link)
     alongside the file.
   - Location fields remain editable independently of the EPW —
     the EPW is a data source, not the owner of the fields.
   - Future consumers anticipated: climate summary display, degree
     days, Phius/PHI climate-dataset alignment, WUFI/PHPP
     cross-checks. Don't paint these in; just don't block them
     (keep the parsed EPW retrievable, not just its header).
3. **Storage decision (first thing the implementing agent must
   resolve):** `projects` table columns vs. project-document
   fields. Lean: relational columns on `projects` (location is
   durable project metadata like `phius_number`, not versioned
   design data) + `project_assets` row for the EPW.
4. **UI surface:** a "Location" section — likely in Project
   Settings (header `⋯` menu) or as a Status-tab card; the
   implementing agent proposes. Editors edit; public viewers read.
   Map preview / address→lat-long geocoding = optional nice-to-have,
   not required.
5. **Units & API:** SI canonical on the wire (PRD §11.5); routes
   under `/api/v1/projects/{id}/...`; MCP-readable from day 1
   (location is exactly the kind of fact LLM workflows ask for).
6. **Validation:** lat ∈ [-90, 90], long ∈ [-180, 180], north
   ∈ [0, 360); EPW header mismatch vs. entered location ≥ ~1° →
   non-blocking warning, not an error.

## Known consumers (wire these when built)

- **model-viewer Site & Sun lens** (`Sunpath.from_location` +
  true-north; PLAN.md Phase 6 is blocked on this feature). Until
  then the lens shows building + shades + a "Set project location"
  hint.
- US-ENV-14 Airtightness and any climate-aware calc: future,
  do not build now.
