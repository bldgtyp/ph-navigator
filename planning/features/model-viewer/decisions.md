---
DATE: 2026-06-12
TIME: -
STATUS: Settled — Inherited items were already accepted; D-02..D-12
  confirmed by Ed 2026-06-12 (D-13/D-14 accepted same day; D-15/D-16
  accepted same day, review round 3). No open decisions.
AUTHOR: Claude (for Ed)
SCOPE: Decision ledger for the Model Viewer feature.
RELATED:
  - planning/features/model-viewer/PRD.md (§4 deltas)
  - context/user-stories/40-model-viewer.md (Q-VIEW-1..9 resolutions)
---

# Model Viewer — Decisions

## Inherited (settled elsewhere; restated for one-stop reading)

- **D-01 · Stack: three + R3F + drei + postprocessing.** PRD §11.4 /
  §12; TECH_STACK pinned. Zustand for viewer state. — *Accepted.*
- **D-I2 · HBJSON storage:** `project_assets` (kind `hbjson`, already
  in `backend/features/assets/registry.py`) + `project_hbjson_files`
  metadata table; per-project lifecycle, not per-version; immutable
  post-upload; soft delete. — *Accepted (US-VIEW-1).*
- **D-I3 · No backend model cache;** R2 ETag / immutable caching.
  — *Accepted (US-VIEW-7 crit. 9).*
- **D-I4 · SI canonical on the wire** (m³/s airflow; no pre-Pydantic
  ×3600). — *Accepted (PRD §11.5, US-VIEW-7 crit. 1).*
- **D-I5 · AirBoundary faces skipped, logged, counted** in
  `load_summary`. — *Accepted (Q-VIEW-1).*
- **D-I6 · Supply blue / exhaust red ducts.** — *Accepted (Q-VIEW-2).*
- **D-I7 · Shades not selectable; comments tool dropped; sun-path
  scrubber, legend-as-filter, clipping planes, HBJSON↔doc cross-check
  all deferred post-MVP.** — *Accepted (Q-VIEW-3/6/7/8/9 + arch
  decision 4).*
- **D-I8 · Z-up camera, FOV 45.** Rhino/honeybee convention,
  non-negotiable. — *Accepted.*

## Accepted (proposed in this folder; confirmed by Ed 2026-06-12)

### D-02 · Backend extraction uses honeybee/ladybug libraries
Add `honeybee-ph` + `ladybug-core` to `backend/pyproject.toml`
(`uv add`). The V2 backend currently has no honeybee deps (HBJSON
*export* is hand-built dicts), but extraction needs
`Model.from_dict()`, punched/triangulated geometry, tolerance-aware
shade merging, and `Sunpath` — reimplementing those by hand was
considered and rejected (large, error-prone, and these are PH-Tools'
own well-tested libraries).
**Why:** port V1's `model_elements.py` nearly as-is (US-VIEW-7).
**How to verify:** fixture-based pytest on real HBJSONs; `make ci`.

### D-03 · "Lens + Color theme" replaces "VizState + ColorBy state"
Six lenses (Building / Spaces / Floor Areas / Site & Sun /
Ventilation / Hot Water); color themes are a property of the lens,
not an 8th mode. All six V1 color-by attributes survive 1:1 (mapping
table in PRD §4.1). Drops V1's "click active button to revert to
Geometry" gesture.
**Why:** "what am I looking at" and "how is it painted" are separate
user concepts; V1 fused them for implementation reasons. Clearer for
non-technical viewers, identical capability for engineers.
**Supersedes:** US-VIEW-3 crit. 1–2/6 and US-VIEW-5 composition
language (capabilities unchanged).

### D-04 · Selection is always-on; Measure is the only mode
No "Select tool". Hover + click work from first paint (5 px
drag-vs-click tolerance kept). ToolState machine collapses to a
Measure boolean.
**Why:** the single biggest de-CAD-ification. An armable select tool
is a pro-tool convention that costs every casual viewer their first
click.
**Supersedes:** US-VIEW-4 crit. 1–3 composition (semantics of
select/hover/measure unchanged).

### D-05 · Quadrant layout
File chip TL · lens bar + theme TC · legend BL · camera cluster +
measure BR · inspector slides from right. Full-bleed canvas, all
chrome floating. Details in UI_SPEC §1.
**Resolves:** UX-Q9 ("toolbar placement — open through prototype")
in favor of top-center lens bar + bottom-right tool cluster.

### D-06 · Loading UX = in-canvas progress chip (no sonner)
sonner is not in the V2 stack; nothing else needs a global toast
system. Same non-blocking intent as Q-VIEW-5, rendered as a canvas-
local progress chip + scene-info popover (UI_SPEC §8).
**Amends:** Q-VIEW-5's "Sonner toast" surface choice (the resolution
predates the actual frontend stack).

### D-07 · Sun path from project latitude/longitude, not EPW
A sun path needs location only. Add lat/long (+ optional true-north)
to Project Settings; run `Sunpath.from_location`. No location set →
Site & Sun lens shows building + shades + a quiet "set project
location" hint. No EPW upload in MVP.
**Why:** V2 has no EPW storage; building EPW upload/parse
infrastructure for a diagram that needs two floats is poor economics.
**Supersedes:** US-VIEW-7 crit. 6 (EPW port).
**Opens:** OQ-1 below.

### D-08 · Modern scene dressing
ContactShadows instead of a hard PCF shadow plane; faint infinite
fading grid; off-white gradient background; subtle edge lines; SMAA
only; fit-to-model on load; eased camera transitions; double-click
zoom-to-object; orientation gizmo.
**Why:** "physical model on a table" feel (UI_SPEC §0) for the
owner/architect audience without losing engineering legibility.

### D-09 · Declarative materials; `materialStore` contract retired
Mesh color = `f(lensDefault, themeColor, hovered, selected)` derived
on render. No `userData['materialStore']` /
`colorByOriginalMaterial` stash-and-restore.
**Why:** the V1 contract exists only because the scene was
imperative. R3F makes it dead weight; carrying it forward would be
porting a bug-surface. Observable behavior contract preserved
(PRD §4.3).
**Supersedes:** US-VIEW-4 crit. 6, US-VIEW-5 crit. 4 implementation
language.

### D-10 · Deep-linkable view state
`?file={id}&lens={lens}&theme={theme}` in the Model tab URL.
Share a link that opens directly on, e.g., the Ventilation lens.
**Why:** the share-the-URL access model (PRD §4) makes view deep
links a natural, near-free multiplier for owner/certifier
communication. Selection/camera are NOT in the URL (too noisy).
**Extends:** US-VIEW-1 crit. 6 (which had `?file=` only).

### D-11 · Legend rows show counts
Each legend bucket shows its object count, computed client-side.
**Why:** turns the legend into a QA summary; also pre-stages
NEW-VIEW-2 (legend-as-filter) since rows are built as buttons.

### D-12 · LBT-verbatim U/R terminology; show Factor AND Value
*(resolves OQ-4 · proposed from Ed-directed research; **accepted, Ed
2026-06-12** — both-rows approach confirmed)*

Adopt honeybee-energy's terminology **verbatim** and surface both
quantities in the inspector's Construction section, for opaque AND
window constructions:

| Row label | Source field | Air films |
|---|---|---|
| U-Factor (primary) | `u_factor` | **included** (EN673 / ISO10292 coefficients) |
| U-Value | `u_value` | excluded — material layers only |
| R-Factor *(opaque only)* | `r_factor` | included |
| R-Value *(opaque only)* | `r_value` | excluded |

Tooltips state the convention explicitly, e.g. U-Factor: *"Includes
interior + exterior air-film resistances (EN673/ISO10292). Honeybee
`u_factor`."* Backend schemas serialize all four fields.

**Research basis (2026-06-12):**
- `honeybee_energy/construction/_base.py` (shared by Opaque + Window):
  `u_value`/`r_value` docstrings — "(excluding air films)";
  `u_factor`/`r_factor` — "(including standard resistances for air
  films)… EN673 / ISO10292."
- LBT forum #11790, Chris Mackey: "honeybee_energy calls all numbers
  that have the air film resistance a 'factor' and all numbers that
  lack the air films a 'value'"; manufacturer glazing specs "are
  almost always U-factors and NOT U-values."
- Ed 2026-06-12: the verbiage is idiosyncratic but "keeping things
  consistent with them is important"; applies to opaque and window
  alike.

**Why both rows:** U-Factor is what V1 showed and what whole-assembly
manufacturer / PHPP-style values correspond to; U-Value matches the
envelope builder's layer-sum convention (Q-ENV-4) — showing both
removes the ambiguity instead of picking a side.
**Supersedes:** US-VIEW-6 crit. 7 as written (it would have relabeled
`u_factor` as "U-Value excluding films" — a mislabel). On acceptance,
sync US-VIEW-6 and add a clarifying line to `context/GLOSSARY.md`
("-Factor = with films, -Value = without; LBT convention").

### D-13 · Geometry-summary extraction: schema now, job in Phase 2, consumer later
*(resolves OQ-2 · Accepted, Ed 2026-06-12)*

`project_hbjson_files` geometry-summary columns (volume / envelope
area / iCFA) land in Phase 1 with `extraction_status='pending'`;
the extraction job lands in Phase 2 (honeybee deps arrive there).
The consuming feature (US-ENV-14 Airtightness) is **clearly marked
FUTURE — not part of this feature**; nothing in the Model tab reads
these summaries.

### D-14 · Selection color = BLDGTYP `--highlight` token family
*(resolves OQ-3 · Accepted, Ed 2026-06-12)*

All 3D-viewer selection styling uses the branding system's
theme-invariant highlight family, already loaded app-wide via
`index.html` → `https://bldgtyp.github.io/bt-branding/tokens/tokens.css`:
`--highlight` #E23489 (selected outline/emissive), with
`--highlight-light` / `--highlight-dark` / `--highlight-text` for
the hover treatment, inspector selected-header tint, and any
selection-adjacent chrome. No new token is invented.

Notes for implementers:
- Three.js materials cannot read CSS custom properties — resolve the
  token at viewer mount via `getComputedStyle(document.documentElement)
  .getPropertyValue('--highlight')`, with #E23489 as the literal
  fallback. Do not scatter hardcoded hexes.
- Hover = softer treatment from the same family (e.g. reduced-opacity
  `--highlight` or `--highlight-light`-mixed emissive), so hover and
  selected read as intensities of one idea.
- Historical note: V1's magenta was in the same family as the brand
  highlight — the V1 problem was unsystematic use, not the hue.
  UI_SPEC language amended accordingly.

### D-15 · `/model_data` is precomputed at upload, served as an immutable artifact
*(Accepted, Ed 2026-06-12 — review round 3)*

The D-13 upload job extends to a single extraction pass that writes
BOTH the geometry-summary columns AND the full `CombinedModelData`
JSON to R2 as a derived artifact (gzip, derived-key convention, e.g.
`derived/{asset_id}/model_data.json.gz` — not a `project_assets`
row). `GET /model_data` streams that artifact with
`Cache-Control: immutable` + ETag; it does NOT parse HBJSON per
request. Per-feature read routes (faces/spaces/…) read the same
artifact and return subsets.

Self-healing contract: if `extraction_status='pending'` (job not yet
run / artifact missing), `/model_data` performs the extraction
synchronously, persists the artifact, and serves it; if `'failed'`,
it returns the D-16 permanent error.

**Why:** D-I3's "R2 immutability is the cache" only ever covered the
raw HBJSON bytes — the viewer fetches the *derived* payload, and
re-running pure-Python triangulation per page load has no latency
ceiling on 10–20 MB multifamily files. Immutability — the original
argument for "no cache" — is exactly what makes a precomputed
artifact trivially correct: parse once at upload, never stale.
**Amends:** US-VIEW-7 crit. 9 (the "no in-process/memory cache"
intent stands; the artifact is derived storage, not cache state) and
clarifies D-I3's scope. The upload double-parse (summary job +
first `/model_data` call) collapses to one parse.

### D-16 · Broken-file lifecycle: status badge + typed error taxonomy
*(Accepted, Ed 2026-06-12 — review round 3)*

A file that uploads fine but fails honeybee parsing (junk JSON,
honeybee-schema version newer than the backend pin) is first-class:

- **File list badge:** popover rows with `extraction_status='failed'`
  show a quiet "Failed to parse" badge (tooltip = `extraction_error`).
  The list payload includes `extraction_status` from Phase 1 (badge
  is inert until the Phase 2 job exists — the job shipped
  2026-06-12).
- **Error taxonomy on `/model_data`:** **permanent** (invalid HBJSON,
  schema-version mismatch — error names the cause, including the
  file's declared schema version vs. the backend's; NO Retry button)
  vs. **transient** (R2/network — Retry shown). Wire shape: the
  standard `api_error` payload carries a
  `{"kind": "permanent" | "transient"}` detail.
- **Schema-version policy:** supported = whatever the pinned
  honeybee-core parses. No upload-time validation (the D-13/D-15 job
  catches failures minutes later; a synchronous 50 MB parse does not
  belong in the upload path).

**Amends:** UI_SPEC §8 error state (Retry becomes transient-only)
and Phase 1's file-row spec (badge + `extraction_status` in the
list payload).

### D-17 · Upload cap raised to 100 MB
*(Accepted, Ed 2026-06-12 — review round 3)*

The HBJSON upload cap is **100 MB** (was 50 MB, US-VIEW-1 crit. 3).
Trigger: the real multifamily fixture
(`Hillandale_Gateway_NAR_260402.hbjson`, Ed 2026-06-12) is 51.99 MB —
actual project exports sit right at the old cap. R2 storage is cheap
and D-15 means the parse cost is paid once at upload, not per view.
**Amends:** US-VIEW-1 crit. 3 (cap value only; extension and
dedup rules unchanged) and UI_SPEC §2 copy.

### Resolved open questions

- **OQ-1 · Project location** — *Resolved, Ed 2026-06-12.* A new
  project-level **Location** section will be developed as its own
  feature with robust EPW linkages; full PRD + plan at
  `planning/archive/project-location/`. All
  location-consuming viewer work (Site & Sun sun path, D-07) is
  **model-viewer-owned now that that section exists** — PLAN Phase 6 ships the
  lens with building + shades + a "Set project location" hint, and
  the sun path activates when model-viewer wires the location data.
  **Ownership split (project-location decisions.md D-PL-2,
  2026-06-12):** the project-location feature ships the location
  *data* (its Phase 1: lat/long/north/time-zone via REST + MCP); the
  **sun-path wiring stays owned by model-viewer** — reading that data
  into extraction and populating the `sun_path` key. Schedule that
  wiring once MV Phase 2 (extraction + ladybug) and Phase 6 (renderer
  stub) are merged. The seam
  (inputs, `Sunpath.from_location`, true-north sign verification) is
  specified in `planning/archive/project-location/PRD.md` §10.
- **OQ-2** — resolved as D-13 above.
- **OQ-3 · Selection accent token** — *Resolved, Ed 2026-06-12, as
  D-14 above:* stick with the app's BLDGTYP branding tokens; use the
  `--highlight` family for all viewer selection styling.
- **OQ-4** — resolved as D-12 above (both-rows approach accepted,
  Ed 2026-06-12).

## Open questions

None outstanding. All decisions accepted as of 2026-06-12;
implementation may start (phases/phase-01).
