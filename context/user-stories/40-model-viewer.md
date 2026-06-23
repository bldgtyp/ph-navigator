---
DATE: 2026-05-11
STATUS: Split from context/USER_STORIES.md; canonical story body.
SOURCE: context/USER_STORIES.md
---

# PH-Navigator V2 — User Stories: Model Viewer

## US-Viewer — Model tab (3D HBJSON viewer)

**Status:** Draft (parent + architectural decisions); sub-stories
US-VIEW-1..7 detail the implementation surfaces.
**Priority:** MVP — last of the 5 project workspace tabs
(US-3.6 in the tab roster: Status / Windows / Envelope /
Equipment / **Model**)
**PRD ref:** §11.4 (3D viewer — R3F + drei + postprocessing),
§11.4.2 (`project_hbjson_files` table), §11.4.6 (HBJSON ↔
builder data manually cross-referenced), §3 (non-goals — no
HBJSON write-back to builder tables)
**V1 ref:** `research/v1-3d-model-viewer-reference.md`
(authoritative V1 enumeration — 17 sections covering routes,
schemas, services, scene setup, viz states, tool states,
color-by modes, loaders, UI components, cross-cutting concerns)
**Convention reference:** `context/GLOSSARY.md` — Thermal
performance section ("-Factor = with films, -Value = without";
LBT-verbatim per D-12, accepted 2026-06-12 — see the V2
amendments block below)

### V2 composition amendments — accepted 2026-06-12

The redesigned V2 surface (`planning/archive/model-viewer/` —
PRD.md §4, UI_SPEC.md, decisions.md) was accepted by Ed
2026-06-12. **Capabilities below are unchanged**; these amendments
re-map this file's composition language. Where an amendment and the
original text conflict, the amendment wins.

- **D-03** "Lens + Color theme" replaces "VizState + ColorBy as an
  8th state" (supersedes US-VIEW-3 crit. 1–2/6 and US-VIEW-5
  composition language). Six lenses — Building / Spaces /
  Floor Areas / Site & Sun / Ventilation / Hot Water; all six
  color attributes survive 1:1; the "click active button reverts
  to Geometry" gesture is dropped.
- **D-04** Selection is always-on; Measure is the only mode
  (supersedes US-VIEW-4 crit. 1–3 composition; the 5 px
  drag-vs-click tolerance and select/hover semantics are kept).
- **D-05 / D-08** Quadrant layout + modern scene dressing —
  UI_SPEC.md supersedes the menubar/panel composition described in
  this file (bottom icon rails, MUI submenus).
- **D-06** Loading UX is an in-canvas progress chip + scene-info
  popover; every "Sonner toast" reference in this file reads as
  that chip (sonner is not in the V2 stack; amends Q-VIEW-5's
  surface choice, not its non-blocking intent).
- **D-07** The sun path derives from the completed
  `project-location` feature, not an EPW (supersedes US-VIEW-7
  crit. 6). Site & Sun ships with building + shades + a "Set
  project location" hint until model-viewer wires the location data
  into `sun_path`.
- **D-09** Declarative derived materials; the `materialStore`
  userData contract (US-VIEW-4 crit. 6, US-VIEW-5 crit. 4) is
  retired as implementation language — its observable behavior
  contract is preserved (PRD §4.3).
- **D-10** Deep links extend US-VIEW-1 crit. 6 with `&lens=` and
  `&theme=` URL params.
- **D-11** Legend rows show per-bucket counts and are built as
  inert buttons (pre-staging NEW-VIEW-2).
- **D-12** U-Factor / U-Value / R-Factor / R-Value shown with
  LBT-verbatim terminology — supersedes US-VIEW-6 crit. 7 as
  originally written (see the amended criterion in place).
- **D-15** `/model_data` is precomputed at upload and served as an
  immutable R2 artifact with `Cache-Control: immutable` + ETag —
  amends US-VIEW-7 crit. 9 (see the amended criterion in place; the
  "no in-memory cache" intent stands, but the backend does NOT
  re-parse HBJSON per request).
- **D-16** Broken-file lifecycle: `extraction_status='failed'`
  surfaces as a "Failed to parse" badge in the file list;
  `/model_data` errors are typed permanent (no Retry; names the
  cause incl. schema-version mismatch) vs. transient (Retry shown).
- **D-17** Upload cap raised to **100 MB** (amends US-VIEW-1
  crit. 3; real multifamily exports exceeded the original 50 MB).

Implementation handoffs: `planning/archive/model-viewer/phases/`.

### Story

> As a CPHC working on a project, I want to upload completed
> HBJSON exports from the Rhino / Honeybee toolchain at
> multiple points during a project's lifecycle (5–20 MB each),
> view each upload as 3D geometry in a dedicated Model tab,
> switch between visualization modes (geometry / interior
> spaces / floor segments / sun path / ventilation ducts /
> hot-water piping / color-by), pick objects to read their
> metadata in a side panel, and measure distances between
> vertices — so I can review the model's correctness against
> the design intent and use it as a reference surface for QA,
> client walkthroughs, and certifier submittals.

### Why this is its own (large) story

The 3D viewer is the **single largest surface** in PHN by code
and by behavior count — V1's reference doc runs 763 lines
covering 7 viz states × 3 tool states × 6 color-by modes × per-
object info-panel configs × 7 specialized loaders, all on top
of a Three.js scene-graph and DOM-event-driven state machine.
Walking it as one monolithic story would mean ~100 acceptance
criteria. Splitting into seven sub-stories keeps each one
reviewable and lets us walk them in dependency order
(file-management → scene → states → coloring → info → backend).

The viewer is **deliberately disconnected** from the builder
tables (PRD §11.4.6 + the post-2026-05-10 PRD §3 non-goals
update). HBJSON renders for visualization only; nothing flows
back into `tables.assemblies`, `tables.project_materials`,
`tables.rooms`, or any other table. This is the same
PHN-first-source-of-truth principle that drives US-EQ-2
(rooms) and US-ENV-12 (HBJSON export). The viewer is a
read-only window into "what came out of the Rhino model
downstream."

### UI/UX direction from V1 screenshot evaluation

The V1 viewer's behavior is precedent; its visual composition is not a
constraint. V2 should preserve color-by modes, legends, selection,
object metadata inspection, model switching, and measure/select tools,
but redesign the surface as a full-bleed or near full-bleed technical
viewer under the project header. Use a compact file selector, grouped
tool rail, collapsible legend/filter rail, and selected-object inspector
as described in `context/ui/pages/model-tab.md` (UI_UX §2.9). Styling should use the BLDGTYP
design tokens rather than V1's MUI/default-blue/magenta semantics.

### Key V1 → V2 shifts

| V1 | V2 |
|---|---|
| Vanilla Three.js + `useRef`-driven imperative scene mutations | **React Three Fiber + drei + @react-three/postprocessing** (PRD §11.4). Declarative `<Canvas>`-based scene, viz/tool state in Zustand, geometry as `<primitive>` / drei components |
| HBJSON in AirTable (per-project, dated revisions) | **HBJSON in Cloudflare R2 + `project_hbjson_files` table** (PRD §11.4.2). Per-project file lifecycle, independent of project document versions (Ed 2026-05-10) |
| AirTable-managed uploads (out-of-band) | **In-tab drag-drop upload** in the Model tab itself (Ed 2026-05-10, US-VIEW-1) |
| Backend converts m³/s → m³/h pre-Pydantic before sending | **Backend SI canonical** (PRD §11.5). Wire transports m³/s; frontend converts m³/s → CFM at display time |
| Process-local 1-hour TTL cache (`LimitedCache`) | **R2 ETag-based fetch** — no in-memory cache; HBJSON is immutable post-upload so ETag works as the cache key (PRD §11.4.2) |
| Module-global handler registries mutated from render bodies | **Zustand slices** for viz-state, tool-state, color-by-state, selected-object, hover-object. Standard R3F pattern: `useFrame` + `useThree` for scene access |
| `alert()` for load failures | **Sonner toasts** + retry button per the global error UX |
| Comments tool placeholder (button exists, no behavior) | **Dropped entirely** from V2 v1 (Ed 2026-05-10) |
| `dimensionLinesRef` added to scene in render body | **Declarative `<group>` containing dimension lines** as a child of `<Canvas>`. State (point pairs) lives in Zustand |
| AirBoundary faces silently skipped by extractor | **Skip preserved** (Q-VIEW-1 resolved 2026-05-10). Backend logs each skipped face; load-summary toast surfaces count |
| Supply / exhaust ducts rendered with same color | **Split colors in V2 v1** (Q-VIEW-2 resolved 2026-05-10). Supply blue, exhaust red |
| Shades not selectable | **Preserved — shades NOT selectable** (Q-VIEW-3 resolved 2026-05-10, redirect from lean). V1 parity |
| Pipe info panel only shows ID + Name | **Surface all loaded fields** (Q-VIEW-4 resolved 2026-05-10) — diameter, insulation thickness/conductivity/reflective/quality, water temp, daily period, length, material |
| Z-up camera (`up = (0, 0, 1)`) | **Preserved** — Rhino/Honeybee convention; non-negotiable |

### Architectural decisions (resolved 2026-05-10)

1. **HBJSON pinning model — independent picker.** The Model tab
   has its own HBJSON-file picker. The Airtightness sub-tab
   (US-ENV-14) pins its own HBJSON via
   `project_airtightness.hbjson_file_id` for derived-calc
   reproducibility. **The two are independent** — switching the
   Model tab's view does not affect the Airtightness pin. (Per
   Ed 2026-05-10.)

2. **HBJSON file lifecycle — per-project, NOT per-document-
   version.** HBJSON files are uploaded over the lifetime of a
   project (multiple revisions: round 1 model, round 2 after
   design changes, final cert model). They are NOT bound to
   `project_versions`. Switching the active project document
   version does not change which HBJSONs are available. (Per
   Ed 2026-05-10. Matches V1.)

3. **Upload UX — inside the Model tab itself.** Drag-drop zone
   in the Model tab's file picker dropdown; co-located with
   where the file will be consumed. NOT a project-header
   `⋯` action. (Per Ed 2026-05-10. Detail in US-VIEW-1.)

4. **Comments tool dropped from V2 v1.** V1's placeholder button
   is not carried forward. (Per Ed 2026-05-10.) If 3D-space
   annotation surfaces as a real need, it lands as a separate
   v1.1+ story.

5. **Viewer-only stance — no write-back to builder tables.**
   Already locked in PRD §3 non-goals (after the US-ENV-12
   scope reduction 2026-05-10). HBJSON renders for
   visualization only.

### Sub-stories (in implementation dependency order)

| ID | Scope | Priority |
|---|---|---|
| US-VIEW-1 | HBJSON file management — upload, list, pick, delete; `project_hbjson_files` schema; R2 storage integration | MVP |
| US-VIEW-2 | 3D scene setup — R3F `<Canvas>`, Z-up camera, lighting, ground plane, orbit controls, postprocessing | MVP |
| US-VIEW-3 | Viz state machine + menubar — 7 modes (Geometry / Interior Floors / Interior Spaces / Site+SunPath / Ventilation / Hot-Water Piping / ColorBy) | MVP |
| US-VIEW-4 | Tool state machine + menubar — Select, Measure (Comments dropped per architectural decision 4) | MVP |
| US-VIEW-5 | Color-by modes — 6 attributes (FaceType / Boundary / OpaqueConstruction / ApertureConstruction / VentilationAirflow / FloorWeightingFactor) + static/dynamic legend | MVP |
| US-VIEW-6 | Element info panel — per-type field configs + IP/SI unit conversion at display | MVP |
| US-VIEW-7 | Backend — `project_hbjson_files` routes + bulk `/model_data` extraction (port `services/model_elements.py` from V1, with SI canonical conversion fix) | MVP |

US-Viewer sub-stories will reference `research/v1-3d-model-viewer-reference.md` extensively — that file is the V1 source-of-truth for behavior to preserve. The reference's "§16 no-regression checklist" is the V2 acceptance gate.

### Resolved questions (2026-05-10)

All 9 Q-VIEW questions resolved 2026-05-10. Summary:

- **Q-VIEW-1: AirBoundary face handling.** Resolved:
  **omit AirBoundary surfaces in MVP** (V1-parity skip).
  Backend extractor logs each skipped face; the load-summary
  toast surfaces the count to the user ("3 air boundaries
  skipped — not rendered in V2 v1"). Rendering AirBoundaries
  as a distinct (dashed / translucent) surface type defers
  to v1.1+.

- **Q-VIEW-2: Supply vs exhaust duct color split.**
  Resolved: **split colors in V2 v1** — supply blue,
  exhaust red (final hex values picked during US-VIEW-3
  walk). V1 used the same `ductLine` material for both;
  this is a trivial UX win for V2.

- **Q-VIEW-3: Shade selectability.** Resolved (redirect
  from lean): **shades NOT selectable in V2 v1** (V1
  parity). Shades render in the SunPath viz state but are
  not added to `selectableObjects` and have no info-panel
  config. Making them selectable defers to v1.1+ if a real
  use case surfaces.

- **Q-VIEW-4: Pipe info panel — richer fields.** Resolved:
  **surface all loaded pipe userData fields in V2 v1** —
  diameter, insulation thickness, insulation conductivity,
  insulation reflective, insulation quality, water temp,
  daily period, length, material. V1 only displayed ID +
  Name despite loading the rest. Cheap, meaningful for
  cert-review walkthroughs.

- **Q-VIEW-5: Loading UX.** Resolved: **non-blocking Sonner
  toast with progress** ("Loading model: 12 MB · 40%
  downloaded / parsing geometry / building scene"). Replaces
  V1's blocking modal `Dialog` with `CircularProgress`. Lets
  the user click around the rest of the app while a large
  model loads.

- **Q-VIEW-6: Sun-path time-of-year scrubber.** Resolved:
  **defer to v1.1+.** Annual envelope (V1 behavior — all
  hourly analemmas + monthly arcs rendered simultaneously)
  is enough for design reviews; scrubber adds UI complexity
  without clear v1 payoff.

- **Q-VIEW-7: Legend-as-filter.** Resolved: **defer to
  v1.1+** — but flagged as **near-priority post-MVP** per
  Ed 2026-05-10 ("definitely will want later"). Captured
  as **NEW-VIEW-2** below; should be one of the first
  post-MVP additions.

- **Q-VIEW-8: Section / clipping planes.** Resolved:
  **defer to v1.1+.** Useful for "show me the wall section
  through this room" but needs UI for plane placement +
  non-trivial R3F integration. Not gating MVP.

- **Q-VIEW-9: HBJSON-vs-document cross-check.** Resolved:
  **defer to v1.1+ as NEW-VIEW-1 post-parity** (below).
  Family with NEW-ROOMS-1 (Compare HBJSON vs Rooms QA/QC).
  PRD §11.4.6 explicitly leaves this out of scope for V2 v1.

### Open questions
None outstanding.

### Related new features (post-parity)

**NEW-VIEW-1 — HBJSON ↔ project document cross-check (Q-VIEW-9).**
Status: stub · post-parity. Family with NEW-ROOMS-1
(US-Builder-Equipment). As a CPHC after uploading an HBJSON,
I want PHN to flag any divergence between what the HBJSON
describes (window types, room metadata, assembly names) and
what the builder tables say. Surfaces in the Model tab as
inline warnings on suspect objects + a top-bar "5 divergences
found" summary.

**NEW-VIEW-2 — Legend-as-filter (Q-VIEW-7).** Status: implemented
(v1.1 — single-select + shift-click multi-select, unmerged) ·
**near-priority post-MVP** per Ed 2026-05-10 ("definitely
will want later"). As a CPHC reviewing a complex model, I
want to click a swatch in the ColorByLegend to **hide all
non-matching elements** — e.g. click the "RoofCeiling"
swatch in the FaceType legend to see only roof faces; click
an "Insulation" entry in the OpaqueConstruction legend to
isolate every wall layer using that product. Shift-click
toggles multi-select (show roofs AND floors). Reset by
clicking the active swatch again, or via a "Clear filter"
button at the top of the legend.

This couples cleanly with V2's ColorBy system — the legend
already knows the mapping; this just inverts it for
visibility control. **Should be one of the first post-MVP
additions** based on Ed's signaled priority.

### Cross-references

- **`research/v1-3d-model-viewer-reference.md`**
  — authoritative V1 reference; consulted for every sub-story.
  The "§16 no-regression checklist" is the V2 acceptance
  gate.
- **PRD §11.4 (3D viewer)** — locks in R3F + drei + postprocessing.
- **PRD §11.4.2 (`project_hbjson_files`)** — table schema for
  HBJSON file metadata. Detailed in US-VIEW-1.
- **PRD §11.4.6 (HBJSON ↔ builder data)** — manually
  cross-referenced; no auto-sync either direction.
- **PRD §11.5 (units architecture)** — SI canonical on the
  wire; fixes V1's m³/s → m³/h backend conversion.
- **PRD §3 (non-goals)** — locks in no HBJSON write-back to
  builder tables.
- **US-ENV-14 (Airtightness)** — uses a separately-pinned
  HBJSON (`project_airtightness.hbjson_file_id`); does NOT
  follow the Model tab's picker.
- **US-ENV-12 (HBJSON construction export)** — the OTHER
  HBJSON surface in V2; produces HBJSON, doesn't consume it.
- **NEW-LLM-API-1** — per-feature endpoints (faces, spaces,
  ventilation, etc.) are MCP-callable for LLM-assisted
  workflows ("show me all rooms with v_sup < 30 m³/h"). The
  bulk `/model_data` endpoint is the viewer-side default;
  per-feature endpoints stay live for MCP.

---

## US-VIEW-1 — HBJSON file management

**Status:** Implemented 2026-06-12 (model-viewer Phase 1, as amended
by `planning/archive/model-viewer/phases/phase-01-*.md`) ·
**Priority:** MVP — gates all other
US-VIEW-* (nothing can render without a file)
**PRD ref:** §6.5 (`project_assets` backbone), §11.4.2
(`project_hbjson_files` subtype table), §3 (non-goals —
viewer-only)
**V1 ref:** `2026-05-10-v1-3D-model-viewer-reference.md` §2.1
(`/hb_model/{bt_number}/models` route), §13.3
(`ModelSelector.tsx`), §14.4 (process-local cache — replaced
in V2)
**Inherits:** US-Builder-Tables only loosely — this isn't a
table-view surface; it's a custom uploader + picker

### Story

> As an editor on a project, I want to upload HBJSON exports
> from my Rhino / Honeybee workflow into the Model tab via a
> simple drag-drop, see all of this project's uploaded
> HBJSONs in a dated list, pick which one to view, and
> delete obsolete uploads — without that file management
> touching the project document or its versions.

### Data model

HBJSON uses the generic asset backbone from PRD §6.5 plus a
viewer-specific subtype table. File bytes and R2 metadata live in
`project_assets`; viewer labels, notes, optional version provenance,
and cached geometry summaries live in `project_hbjson_files`.

```sql
CREATE TABLE project_hbjson_files (
  id                      UUID PRIMARY KEY,
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id                TEXT NOT NULL UNIQUE REFERENCES project_assets(id),
                                                    -- project_assets.asset_kind = 'hbjson'
  display_name            TEXT NOT NULL,            -- user-supplied or default to original filename
  notes                   TEXT,                     -- optional user-supplied note ("Round 2 model after slab change")
  uploaded_by_user_id     INTEGER NOT NULL REFERENCES users(id),
  uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Geometry summary cached at upload time (also used by US-ENV-14 Airtightness)
  extracted_volume_m3            FLOAT,
  extracted_envelope_area_m2     FLOAT,
  extracted_floor_area_m2        FLOAT,
  extraction_status              TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'success' | 'failed'
  extraction_error               TEXT,
  extracted_at                   TIMESTAMPTZ,

  deleted_at              TIMESTAMPTZ                -- soft delete; preserves history
);

CREATE INDEX project_hbjson_files_project_id_idx ON project_hbjson_files (project_id) WHERE deleted_at IS NULL;
```

`project_assets` supplies `object_key`, `r2_etag`, `size_bytes`,
`content_hash_sha256`, `content_type`, signed URL generation, soft
delete, and GC behavior for HBJSON exactly as it does for datasheets and
site photos.

**Why per-project, not per-version:** confirmed 2026-05-10
(US-Viewer architectural decision 2). HBJSONs are uploaded
over a project's lifecycle (round 1 / round 2 / final cert
model) and outlive any individual document version. Tying them
to versions would force users to "save a new version" just to
upload a file, which doesn't match the workflow.

### Acceptance criteria

1. **Surface inside the Model tab.** A file picker
   (compact dropdown trigger) sits at the top of the Model
   tab content area. Shows the current selection: e.g.
   `"📁 Round 2 model · 2026-04-12 · 14.2 MB ▾"`. Clicking
   opens a dropdown panel with the full file list.

2. **Dropdown panel contents** — top-to-bottom:
   - **Drag-drop upload zone** at the top of the panel:
     dashed-border rectangle with text *"Drop a `.hbjson`
     file here, or [browse]"*. Also accepts files via the
     `[browse]` link → native file picker.
   - **Vertical list of files**, sorted by `uploaded_at`
     descending (newest first). Each row:
     - File icon + `display_name` (editable inline on
       row-click of a pencil icon)
     - Sub-row: `{size_mb} MB · uploaded {relative_time} by
       {uploader_display_name}`
     - Optional `notes` field rendered as a third sub-row
       (italic, muted)
     - **Active** indicator (checkmark + bg-highlight) on
       the currently-viewed file
     - `⋯` row-action menu: Rename, Edit notes, Delete
   - **Refresh button** at the bottom (`RefreshCw` icon
     with text "Refresh list") — re-fetches the file list
     from the backend in case another editor uploaded since
     the dropdown was opened.

3. **Upload behavior:**
   - Single-file at a time in V2 v1 (multi-file drag-drop
     deferred — adds UX complexity for queueing).
   - File-type validation: must end in `.hbjson` or `.json`
     (case-insensitive). On rejection, toast: *"Only
     `.hbjson` files are supported. Please drop a Honeybee
     Model JSON."*
   - File-size cap: **100 MB** *(amended 2026-06-12, D-17 —
     originally 50 MB; a real multifamily export measured
     51.99 MB)*. Files larger than 100 MB rejected with
     toast: *"File is too large (max 100 MB). Please contact
     support if you need to upload a larger model."* —
     5–20 MB is the typical range (per Ed); large
     multifamily exports run ~50 MB.
   - Default `display_name` = the original filename minus
     extension. User can rename before/after upload.
   - **Content-hash dedup:** client/agent computes
     `content_hash_sha256` before requesting the upload intent.
     If an existing non-deleted file in this project has the same hash,
     the upload is rejected with toast: *"This file matches
     an existing upload ({existing.display_name}). Switch
     to it instead?"* with a `[Switch]` button. Avoids
     duplicate 20 MB files in R2.
   - Upload progress shows as a thin progress bar across
     the upload zone (no modal). On completion, the new
     file becomes the active selection and the viewer
     reloads.

4. **R2 storage path:**
   - Created through the generic asset upload-intent endpoint
     with `asset_kind = 'hbjson'`.
   - Object key follows the asset backbone convention:
     `projects/{project_id}/assets/{asset_id}/{safe_filename}`.
   - Content-type: `application/json`.
   - `r2_etag`, `size_bytes`, and `content_hash_sha256` are captured
     on the `project_assets` row during upload completion.

5. **Geometry summary extraction** (runs server-side after
   upload finishes):
   - Backend job parses the HBJSON and extracts
     `extracted_volume_m3` (sum of `room.volume`),
     `extracted_envelope_area_m2` (sum of exterior face
     areas), `extracted_floor_area_m2` (sum of iCFA per
     honeybee_ph spaces per Q-ENV-14.2 resolution).
   - `extraction_status` transitions `pending` → `success`
     or `failed`. On failure, store the error message in
     `extraction_error`; the file is still uploadable and
     viewable — the failure only affects derived calcs
     (US-ENV-14 Airtightness).
   - These cached summaries are why
     `project_hbjson_files` is the right schema location:
     **the table serves both the viewer AND US-ENV-14.**
     One upload, one extraction, used twice.

6. **Picking a file** (clicking a row in the dropdown):
   - Sets the active HBJSON file id in the Model tab's
     Zustand store
     (`modelViewerStore.activeHbjsonFileId`).
   - **Persists in-session only** (NOT persisted per-user
     across sessions). Switching projects / re-opening the
     app resets to "newest available file" (the natural
     default behavior).
   - Triggers a viewer reload: `<Canvas>` remounts (or
     scene clears) and `/model_data` fetches the new
     file's contents.
   - URL updates with the file id:
     `/projects/{id}/model?file={hbjson_file_id}` — so
     deep-links and browser-back work.

7. **Default file on first visit:** newest non-deleted file
   for this project. If no files exist yet, the Model tab
   shows an empty state: *"No HBJSON files uploaded yet.
   **[Drop a file here]** or [browse] to upload your first
   model."* Drop-zone is the empty state CTA.

8. **Rename** (inline pencil icon on the row, or via `⋯ →
   Rename`):
   - Edits `display_name`. Saves on blur or Enter.
   - Empty names rejected; trimmed of whitespace.
   - Same name allowed across multiple files in the same
     project (no uniqueness constraint — files are
     identified by id, not name).

9. **Delete** (via `⋯ → Delete`):
   - shadcn `Dialog` confirm — title **"Delete this HBJSON
     file?"**, body **"'{display_name}' will be removed
     from the file list. If this file is pinned by the
     Airtightness sub-tab, that pin will be cleared. R2
     storage retention follows the project's standard 90-
     day retention policy (PRD §10.5 mirror)."**, buttons
     **Cancel** / **Delete**.
   - On confirm: soft-delete (set `deleted_at`); cascade-
     clear `project_airtightness.hbjson_file_id` to null
     if it pointed here (with the soft-warning toast on
     US-ENV-14 the next time someone opens that tab).
   - If the deleted file was the active selection, the
     viewer switches to the next-newest file (or empty
     state if none remain).
   - R2 garbage collection runs as a background job;
     90-day retention before purge (matches PRD §10.5
     deleted-project policy for consistency).

10. **Edit notes** (via `⋯ → Edit notes` or pencil on the
    notes sub-row):
    - Multi-line text area (max 1000 chars).
    - Saves on blur.
    - Useful for marking "Round 2 model after slab change"
      / "Final cert submittal model" / etc.

11. **Permissions:**
    - **Editors:** full read + upload + rename + edit
      notes + delete.
    - **Viewers:** read only. Can pick which
      file to view; cannot upload / rename / delete. The
      dropdown's upload zone is hidden; `⋯` menus on
      rows are hidden.
    - Signed URLs are short-lived and are resolved through the
      standard public read route; raw R2 object keys are never exposed.

12. **Locked-version handling:** **N/A** — HBJSON files
    are NOT bound to project document versions
    (architectural decision 2). The project's active
    version being locked does not affect HBJSON upload /
    rename / delete. This is a deliberate decoupling.

13. **Loading UX (cross-references US-VIEW-2 / US-VIEW-7):**
    - During the `/model_data` fetch + parse, the viewer
      shows a non-blocking Sonner toast with progress
      (lean per Q-VIEW-5).
    - The file-picker dropdown remains usable so a user
      can switch files without waiting for the current
      one to fully render.

14. **MCP-friendliness** (per NEW-LLM-API-1):
    - `GET /projects/{id}/hbjson-files` — list endpoint;
      same shape the dropdown consumes.
    - `POST /projects/{id}/assets/upload-intent` with
      `asset_kind='hbjson'` — returns signed PUT URL.
    - `POST /projects/{id}/assets/{asset_id}/complete-upload` —
      marks the uploaded asset complete.
    - `POST /projects/{id}/hbjson-files` — links the uploaded asset
      into the HBJSON viewer metadata table; content-hash dedup applies
      at the asset layer.
    - `GET /projects/{id}/hbjson-files/{file_id}/download` —
      returns signed R2 URL.
    - `DELETE /projects/{id}/hbjson-files/{file_id}` —
      soft-delete.
    - These endpoints are MCP-tool-callable from day 1, so
      an agentic workflow can manage HBJSON uploads
      ("upload this file from my email attachment and
      switch the viewer to it").

### Resolved questions (2026-05-10)

- All four architectural questions (pinning model, file
  lifecycle, upload UX, drop Comments) resolved at the
  US-Viewer parent level. No US-VIEW-1-specific open
  questions at this point.

### Open questions
None outstanding.

### Cross-references

- **PRD §11.4.2** — formal `project_hbjson_files` schema
  lands here.
- **US-ENV-14 (Airtightness)** — also reads
  `project_hbjson_files` rows + the cached geometry
  summary. Pin (`project_airtightness.hbjson_file_id`)
  is independent of the Model tab's active selection
  (architectural decision 1).
- **US-VIEW-2..7** — all depend on the active HBJSON file
  selected here.
- **NEW-LLM-API-1** — MCP endpoints for HBJSON file CRUD.

---

## US-VIEW-2 — 3D scene setup (R3F canvas, camera, lighting, ground)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4 (R3F + drei + postprocessing stack)
**V1 ref:** §6 (`scene_setup/SceneSetup.tsx` — class-based world),
§7 (`Materials.tsx`), §14.1 (Z-up convention as non-negotiable)
**Inherits:** none — this is the foundation US-VIEW-3..6 build on

### Story
> As an editor opening the Model tab, I want a 3D canvas that
> renders with the correct Rhino-conventional axis orientation
> (Z up), a sensible default view, smooth orbit / pan / zoom
> controls, and good-enough lighting to actually see the
> geometry — so I can drop a model in and start reviewing.

### Acceptance criteria

1. **R3F `<Canvas>`** mounts inside the Model tab's content
   area below the file picker (US-VIEW-1). Fills the
   remaining height; resizes with the window. Black or
   theme-default background.

2. **Camera — Z-up convention** (V1 ref §14.1, non-negotiable
   for Rhino / honeybee_ph compatibility):
   - `<PerspectiveCamera>` with `up={[0, 0, 1]}` set
     explicitly on first mount.
   - Initial position: `[-25, 40, 30]` (V1 parity).
   - Looks at `[0, 0, 0]`.
   - FOV: 45°. Near 0.1, far 1000.

3. **Orbit controls** (`@react-three/drei` `<OrbitControls>`):
   - `rotateSpeed = 0.9`, `zoomSpeed = 3.0` (V1 parity).
   - Target locked to origin by default; auto-recenters on
     model load (lean — V1 didn't recenter, which is a
     papercut when models drift far from origin).
   - Damping enabled for smoother rotate / pan.

4. **Lighting** (mirrors V1 §6 Lighting):
   - `<ambientLight>` — `SURFACE_WHITE`, intensity per
     `defaultLightConfiguration.indirectLightIntensity`.
   - `<directionalLight>` at `[-10, -10, 25]` with
     `castShadow`, shadow-camera frustum `{top:25,
     bottom:-25, left:-25, right:25}`.
   - All color constants come from `styles/AppColors.ts`
     (project-global, NOT a model-viewer-local file).

5. **Shadow map** enabled: `PCFSoftShadowMap`.

6. **Ground plane + grid** (V1 §6):
   - 50×50 `<Plane>` at z=0 with a shadow-only material
     (drei `<shadowMaterial>` with opacity 0.3). Receives
     shadows from the directional light; does NOT cast.
   - Two grid helpers via drei `<Grid>` — 50 units, 50 + 5
     subdivisions, rotated to lie flat on the XY plane.
     Always visible (no toggle in V2 v1; v1.1+ candidate).

7. **Postprocessing** via `@react-three/postprocessing`:
   - SMAA antialiasing on by default (drei's `<Effects>`
     wrapping `<SMAA>` or the postprocessing equivalent).
   - **No SAO / SSAO in v1** — V1 ref §6 explicitly tried
     `SAOPass` and disabled it ("too slow, and too shitty"
     per the V1 inline comment). V2 sticks with the same
     "antialias only" baseline; richer effects defer to
     v1.1+ if needed.

8. **CSS2D label layer** (for Measure-mode distance labels,
   US-VIEW-4) — drei `<Html>` or a CSS2DRenderer instance
   scoped to the canvas wrapper (NOT to `document.body` as
   V1 did per V1 ref §14.8 — that pattern leaks labels
   across tab switches). Pointer-events: none on the
   overlay layer so labels don't intercept clicks.

9. **Scene reset on file switch.** When the user picks a
   different HBJSON in the US-VIEW-1 dropdown, the scene
   clears (all loader-produced groups unmount via React's
   normal unmount path; geometry GC's). New file's
   geometry mounts after `/model_data` fetch completes.
   This is automatic with R3F's declarative model — no
   manual `world.reset()` needed (V1 ref §14 cleanup
   notes are obsolete).

10. **Loading UX** (Q-VIEW-5 resolved): non-blocking Sonner
    toast with progress states — "Downloading model…" /
    "Parsing geometry…" / "Building scene…". Toast updates
    in place via Sonner's `toast.loading()` / `toast.success()`
    API. Replaces V1's blocking MUI `Dialog` with
    `CircularProgress` (V1 ref §5).

11. **Locked-version + Viewer rendering.** Scene renders
    identically. Tool / Viz menubars (US-VIEW-3, US-VIEW-4)
    still functional — viewing is always available.

### Resolved questions (2026-05-10)
- **Q-VIEW-5 (loading UX):** non-blocking toast — see
  criterion 10.
- **Q-VIEW-8 (section / clipping planes):** deferred to
  v1.1+. Not in v1 scope.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §6, §7, §14.1, §14.8** — scene setup,
  materials, Z-up convention, label-scoping bug.
- **US-VIEW-1** — provides the active HBJSON file id;
  scene reloads on file switch.
- **US-VIEW-3 / US-VIEW-4** — viz / tool state machines
  hook into the scene built here.

---

## US-VIEW-3 — Viz state machine + menubar (7 modes)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4
**V1 ref:** §8.1 (`appVizStateTypeEnum`), §9.1–9.7 (loaders
per mode), §13.1 (`VizStateMenubar.tsx`), §14.6 (module-global
handlers — V2 refactor target)

### Story
> As an editor exploring an HBJSON model, I want to switch
> between visualization modes — exterior building geometry,
> interior spaces, interior floor segments, site (sun path +
> shades), ventilation ducts, hot-water piping, and color-by
> — via a single menubar at the bottom of the canvas, with
> exactly one mode active at a time and smooth transitions
> between them.

### Acceptance criteria

1. **`VizStateMenubar`** — horizontal icon-button row,
   centered at the bottom of the canvas (floating overlay).
   Order matches V1 ref §13.1:
   - **Geometry** — Exterior Surfaces
   - **FloorSegments** — Interior Floors
   - **Spaces** — Interior Spaces
   - **SunPath** — Site (sun path + shades)
   - **Ducts** — Ventilation Ducting
   - **Pipes** — Hot Water Piping
   - **ColorBy ▾** — opens a sub-menu (criterion 6)

2. **Active-button visual feedback** — currently-active
   button gets a highlighted background. Clicking the
   already-active button **reverts to Geometry** (the
   implicit "off" state), matching V1.

3. **Exactly one viz state active at a time.** Switching
   modes unmounts the previous mode's geometry visibility
   + selectable-objects scope, then mounts the new mode's
   visibility + scope.

4. **Per-mode visibility rules** (mirror V1 §8.1):
   | Mode | Visible groups | Selectable scope |
   |---|---|---|
   | Geometry | Building meshes + outlines + vertices | Building meshes |
   | FloorSegments | Floor meshes + outlines + vertices + building outlines (context) | Floor meshes |
   | Spaces | Space meshes + outlines + building outlines (context) | Space meshes |
   | SunPath | Building meshes + outlines + vertices + sun-path diagram + shade meshes + shade wireframe | Building meshes (shades NOT selectable per Q-VIEW-3) |
   | Ducts | Ventilation geometry + building outlines (no meshes) | Duct segments |
   | Pipes | Pipe geometry + building outlines (no meshes) | Pipe segments |
   | ColorBy | Delegated to color-by attribute (see US-VIEW-5) | Per attribute |

5. **State implementation — Zustand, not module-globals.**
   `modelViewerStore.vizState: VizMode` (replaces V1's
   `appVizStateTypeEnum` reducer). Mount / dismount
   behaviors implemented as R3F `useEffect` cleanup in the
   group components themselves (e.g. `<BuildingGeometryGroup
   visible={vizState === 'Geometry' || vizState ===
   'SunPath' || ...}>`), NOT as imperative scene
   mutations. V1 ref §14.6 module-global handler registries
   are explicitly replaced.

6. **ColorBy sub-menu** — clicking the ColorBy menubar
   button opens a dropdown (shadcn `DropdownMenu` or
   similar) listing the 6 attributes per V1 ref §13.1:
   - **FaceType**
   - **Boundary**
   - --- divider ---
   - **Opaque Construction**
   - **Aperture Construction**
   - --- divider ---
   - **Ventilation Airflow**
   - **Floor Weighting Factor**
   Picking an attribute dispatches `vizState = 'ColorBy'`
   (if not already) AND `colorByAttribute = <picked>` (full
   color-by logic detailed in US-VIEW-5).

7. **Mount / dismount visual continuity.** Switching modes
   is essentially instant — no fade / transition animation
   in V2 v1 (V1 parity). v1.1+ could add a fade if it
   helps orientation.

8. **Sun-path scrubber NOT included** (Q-VIEW-6 deferred to
   v1.1+). SunPath mode renders V1's annual envelope (all
   hourly analemmas + monthly arcs simultaneously).

9. **Locked-version + Viewer rendering.** Menubar fully
   functional — viz-state changes are viewing operations,
   not edits.

### Resolved questions (2026-05-10)
- **Q-VIEW-3 (shade selectability):** shades NOT selectable
  even in SunPath mode (V1 parity, redirect from earlier
  lean). See criterion 4 row "SunPath."
- **Q-VIEW-6 (sun-path scrubber):** deferred to v1.1+. See
  criterion 8.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §8.1, §9, §13.1** — viz state semantics + per-mode
  loaders + menubar layout.
- **US-VIEW-5** — ColorBy attribute switching detail.
- **US-VIEW-7 (backend)** — provides the data for each
  mode's loaders.

---

## US-VIEW-4 — Tool state machine + menubar (Select, Measure)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4
**V1 ref:** §8.2 (`appToolStateTypeEnum`), §12 (Select +
Measure handlers), §13.2 (`ToolStateMenubar.tsx`)

### Story
> As an editor reviewing a model, I want two interaction
> tools: a Select tool that lets me click any object to see
> its metadata in the side panel, and a Measure tool that
> lets me click two vertices to get a distance label between
> them — accessible via a small persistent toolbar.

### Acceptance criteria

1. **`ToolStateMenubar`** — small toolbar at the bottom-
   left of the canvas (overlay). Two buttons in this
   order:
   - **Select** (V1 ref §13.2 "Surface" icon)
   - **Measure** (V1 ref §13.2 "Ruler" icon)
   - **Comments DROPPED per architectural decision 4** (no
     placeholder button rendered in V2 v1, per Ed
     2026-05-10).

2. **Active-button visual feedback** — same pattern as
   `VizStateMenubar`. Clicking the active button reverts
   to **None** (no tool).

3. **Tool semantics:**
   | Tool | OnClick | OnPointerMove | OnExit cleanup |
   |---|---|---|---|
   | None | — | — | — |
   | Select | Raycast → set `selectedObjectId`; apply highlight material via `userData['materialStore']` contract (V1 ref §12.2) | Raycast → set `hoverObjectId`; apply hover material | Restore both highlight + hover materials; clear selection state |
   | Measure | If a hovering vertex is held, drop a dimension line from last vertex to current; CSS2D distance label at midpoint | Snap pointer to nearest face vertex (V1 ref §12.3); render marker sphere at snap target | Clear dimension lines group; null `hoveringVertex` |

4. **State implementation — Zustand** (mirrors US-VIEW-3).
   `modelViewerStore.toolState: ToolMode`. Event
   subscription happens in a component-scoped
   `useEffect`, NOT a module-global handler registry
   (V1 ref §14.6 replaced).

5. **Select tool — drag-vs-click detection.** Click must
   be within 5px of the original `mousedown` position to
   register; otherwise it's an orbit-camera drag and
   doesn't trigger selection (V1 ref §12.1).

6. **`materialStore` userData contract** (V1 ref §12.2,
   §14.5 — load-bearing for ColorBy + Select interaction).
   Every selectable mesh carries `userData['materialStore']`
   = "the material to restore me to when I'm no longer
   highlighted." Select / hover write the highlight
   material to `mesh.material` but leave `materialStore`
   intact. ColorBy (US-VIEW-5) updates BOTH `mesh.material`
   AND `materialStore` simultaneously, so a deselect
   during ColorBy mode restores to the color-by material,
   not the original.

7. **Measure tool vertex snap** — picks the nearest vertex
   from `buildingGeometryVertices` (the per-face corner
   vertex points loaded in US-VIEW-7). Threshold: vertex
   within ~20px of pointer (camera-space). Marker is a
   small drei `<Sphere>` at the snap target.

8. **Measure tool dimension line** — built from two
   consecutive snap-target clicks:
   - drei `<Line>` from previous vertex to current vertex,
     using the `dimensionLine` material.
   - CSS2D label at the line midpoint showing the Euclidean
     distance, formatted in the active unit (m / ft).
     V1's distance string formatting (1 decimal, "1.23 m"
     or "4.0 ft") preserved.
   - Pill-shaped white background with shadow (DOM-styled
     via the project's design system, NOT V1's loose
     CSS file).

9. **Measure tool dimension-line lifecycle:**
   - Dimension lines accumulate across multiple click pairs
     while Measure tool is active. Each pair = one
     dimension line.
   - Switching to a different tool (or no tool) clears all
     dimension lines.
   - Switching the viz state ALSO clears dimension lines
     (the source vertices may no longer be visible).

10. **Locked-version + Viewer rendering.** Both tools
    fully functional — selecting / measuring are viewing
    operations.

### Resolved questions (2026-05-10)
- **Comments tool dropped from V2 v1** per architectural
  decision 4 (Ed 2026-05-10). Not even a placeholder
  button.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §8.2, §12, §13.2** — tool state semantics +
  handlers + menubar.
- **US-VIEW-2 criterion 8** — CSS2D label scoping (drei
  `<Html>` or canvas-scoped `CSS2DRenderer`).
- **US-VIEW-5** — `materialStore` contract is shared with
  ColorBy.
- **US-VIEW-6** — Select tool's `selectedObjectId` feeds
  the info panel.
- **US-VIEW-7** — `buildingGeometryVertices` provides snap
  targets for Measure.

---

## US-VIEW-5 — Color-by modes (6 attributes + legend)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4
**V1 ref:** §11 (`modeColorBy.tsx` + `colorByColors.ts`),
§13.5 (`ColorByLegend/`), §14.5 (`materialStore` contract)

### Story
> As an editor reviewing a model, I want six color-by
> attributes that re-color the visible geometry by a
> meaningful grouping (face type, boundary condition,
> construction id, ventilation airflow, floor weighting
> factor) with a matching legend, so I can visually scan
> for outliers, anomalies, and grouping mistakes in the
> model.

### Acceptance criteria

1. **Six color-by modes** (mirror V1 ref §11.1):
   | Mode | Acts on | Color source | Legend |
   |---|---|---|---|
   | FaceType | Building meshes | `faceTypeColors` static map (Wall, RoofCeiling, Floor, Aperture, default) | static |
   | Boundary | Building meshes | `boundaryColors` static map (Outdoors, Ground, Adiabatic, Surface, default) | static |
   | OpaqueConstruction | meshes with `userData.type === 'faceMesh'` | Per-construction-identifier deterministic hash (cyrb53 + golden-ratio HSL — V1 §11.2 algorithm preserved) | **dynamic** |
   | ApertureConstruction | meshes with `userData.type === 'apertureMeshFace'` | Same hash, keyed by aperture construction id | **dynamic** |
   | VentilationAirflow | `spaceGroup` groups | `ventilationAirflowColors` static map (SupplyOnly, ExtractOnly, SupplyAndExtract, NoVentilation, default), categorized by `(v_sup > 0, v_eta > 0)` | static |
   | FloorWeightingFactor | `spaceFloorSegmentMeshFace` meshes | `floorWeightingFactorColors` static map (5 buckets) | static |

2. **Floor weighting bucket boundaries — clean up V1 §11.1
   inconsistency.** V1's `getWeightingFactorCategory`
   has a gap at exactly `0.3` (strict-`>` conditions on
   both sides). V2 buckets — closed at the upper end,
   open at the lower (except for the `0.0` bucket which
   is exact):
   - `FullyTreated`: `factor >= 0.6` (incl 1.0)
   - `Semi`: `0.5 <= factor < 0.6`
   - `Partial`: `0.3 <= factor < 0.5`
   - `Minimal`: `0.0 < factor < 0.3`
   - `NonTreated`: `factor == 0.0`
   Real PH factors are typically 0.0, 0.5, 0.6, or 1.0 so
   the practical hit rate of the edge cases is near zero,
   but the cleanup makes the math defensible.

3. **Duct color split — supply blue, exhaust red**
   (Q-VIEW-2 resolved). This is **not technically a
   "color-by mode"** — it's the default rendering when
   the Ducts viz state is active (US-VIEW-3). Supply
   ducts always use the supply-blue `LineMaterial`;
   exhaust ducts always use the exhaust-red `LineMaterial`.
   V2 shows this as an always-visible mini-key in the
   legend card (implemented in Model Viewer Phase 5).

4. **`materialStore` contract** (V1 ref §14.5, shared
   with US-VIEW-4 Select):
   - On entering ColorBy mode, for each affected mesh:
     - Stash `mesh.material` into
       `userData['colorByOriginalMaterial']` **only if
       not already present** (idempotent across attribute
       switches).
     - Write the new color-by `MeshBasicMaterial` to BOTH
       `mesh.material` and `userData['materialStore']`.
   - On exiting ColorBy mode: restore `mesh.material` and
     `userData['materialStore']` from
     `userData['colorByOriginalMaterial']`.
   - **Switching attributes within ColorBy mode** —
     `applyColorByMode` always calls the restore functions
     first to get a clean slate, then re-applies. This is
     the V1 pattern; preserved in V2.

5. **Legend component** — right-sidebar panel, visible
   only when `vizState === 'ColorBy'`:
   - **Static modes:** legend items come from the matching
     static color map (e.g. `faceTypeColors`); the
     `default` entry is dropped from display.
   - **Dynamic modes (OpaqueConstruction / ApertureConstruction):**
     legend items come from a `Map<string, ColorDefinition>`
     built at color-application time and pushed into
     `modelViewerStore.dynamicLegendItems`.
   - Each item: colored swatch + label (the construction
     id, or the static-mode value name).
   - **Click-to-filter is NOT in V2 v1** (Q-VIEW-7
     deferred). See NEW-VIEW-2 for the planned post-MVP
     legend-as-filter behavior.

6. **Deterministic color hash for construction names**
   (V1 §11.2 algorithm — preserve verbatim):
   - `cyrb53(constructionId, seed)` → 53-bit hash.
   - HSL: hue = `(baseHue + goldenRatio * hash) % 1`,
     saturation 55–85%, lightness 40–65%.
   - Golden-ratio rotation gives consecutive / similar
     construction names well-distributed colors. V1's
     example: "N.3.1", "N.3.2", … all get visually
     distinct hues even though they sort adjacently.

7. **`MeshBasicMaterial`, not `MeshStandardMaterial`** —
   color-by re-coloring uses unlit basic materials so the
   color matches the legend swatch exactly (no lighting
   tint). V1 ref §11.2.

8. **Switching attribute within ColorBy mode re-applies
   immediately** — no need to exit + re-enter. Dynamic
   legend updates with the new attribute's color map.

9. **Locked-version + Viewer rendering.** Fully
   functional — color-by is a viewing operation.

### Resolved questions (2026-05-10)
- **Q-VIEW-2 (duct color split):** supply blue, exhaust
  red — criterion 3.
- **Q-VIEW-7 (legend-as-filter):** deferred to v1.1+;
  captured as NEW-VIEW-2 in US-Viewer parent.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §11, §13.5, §14.5** — color-by algorithms,
  legend, materialStore contract.
- **US-VIEW-3** — ColorBy sub-menu launches color-by mode.
- **US-VIEW-4** — `materialStore` contract is shared
  with Select tool.
- **US-VIEW-7** — backend serializes the attribute values
  (face_type, boundary_condition, construction.identifier,
  weighting_factor, v_sup/v_eta) into userData via
  loaders.
- **NEW-VIEW-2** (post-MVP) — legend-as-filter.

---

## US-VIEW-6 — Element info panel (per-type field configs)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.4, §11.5 (units architecture — IP/SI
conversion at display)
**V1 ref:** §13.4 (`ElementInfoPanel/` + `fieldConfigs.ts`)

### Story
> As an editor who's clicked an object in the viewer, I want
> a right-sidebar info panel that shows me everything we
> know about that object — name, IDs, geometry properties,
> construction (with U-/R-values), ventilation airflow,
> insulation specs — formatted in my preferred unit system
> (IP or SI) — so I can use the viewer as a model-inspection
> surface.

### Acceptance criteria

1. **Right-sidebar panel** — visible when
   `modelViewerStore.selectedObjectId !== null` (the
   user has clicked something in Select tool mode). Hidden
   otherwise. shadcn `Sheet` or similar primitive,
   width ~320px.

2. **Per-element-type field configs** — a
   `Record<string, ElementTypeConfig>` keyed by the
   selected mesh's `userData.type`. The config declares
   the title, fields, and optional sections.

3. **Field shape** — each field declares:
   ```typescript
   {
     key: string,           // dot-path into userData ("properties.energy.construction.u_factor")
     label: string,         // human label
     tooltip?: string,      // optional help text
     decimals?: number,     // default 2
     units?: {              // optional unit conversion descriptor
       si: string,          // backend canonical unit
       ip: string,          // displayed in IP mode
       siLabel: string,     // unit suffix in SI mode ("W/m²K")
       ipLabel: string,     // unit suffix in IP mode ("BTU/hr·ft²·°F")
     }
   }
   ```

4. **IP / SI conversion at display** (PRD §11.5 — backend
   is canonical SI, frontend converts at render). Field
   renderer reads `userPreferencesStore.units_preference`
   and applies the configured `units` conversion.

5. **Configured element types — V2 v1 roster:**

   | Type | Title | Fields | Section |
   |---|---|---|---|
   | `faceMesh` | "Opaque Surface" | Name, ID, Face Type, Boundary, Area | "Construction": Name, Type, U-Factor, U-Value, R-Factor, R-Value (per criterion 7 as amended by D-12) |
   | `apertureMeshFace` | "Window" | Name, ID, Face Type, Boundary, Area | "Construction": Name, Type, U-Factor, U-Value (no R rows per V1; criterion 7) |
   | `spaceGroup` | "Interior Space" | Name, ID, Number, Quantity, WUFI Type, Floor Area, Weighted Area, Net Volume, Avg Height, Avg Weighting Factor | "Ventilation": Supply Air, Extract Air, Transfer Air (wire m³/s → m³/h SI / CFM IP per PRD §11.5) |
   | `spaceFloorSegmentMeshFace` | "Interior Floor" | Space, Number, Weight, Floor Area, Weighted Area | "Ventilation": Supply, Extract, Transfer Air |
   | `pipeSegmentLine` | "Pipe" | ID, Name, **Diameter** (mm/in), **Insulation Thickness** (mm/in), **Insulation Conductivity** (W/m·K), **Insulation Reflective** (yes/no), **Insulation Quality** (text), **Water Temp** (°C/°F), **Daily Period** (hours), **Length** (m/ft), **Material** (text) | **Per Q-VIEW-4 resolved — V1 only showed ID + Name; V2 surfaces all loaded fields.** |
   | `ductSegmentLine` | "Duct" | ID, Name, **Duct Type** (Supply / Exhaust — per Q-VIEW-2), Diameter (mm/in), Insulation Thickness (mm/in) | — |

6. **No info-panel config for shades** (Q-VIEW-3 resolved
   — shades not selectable in V2 v1). Even if a shade
   somehow got selected through future refactoring,
   the absence of a config means the panel renders
   empty / hidden, which is the safe default.

7. **U/R rows follow honeybee-energy (LBT) terminology
   verbatim — amended 2026-06-12 per D-12.** (The original
   criterion would have relabeled honeybee's `u_factor` as a
   films-excluded "U-Value" — a mislabel; parity audit finding
   F-1.)
   - Opaque constructions show four rows: **U-Factor**
     (primary) and **R-Factor** — air films INCLUDED
     (EN673 / ISO10292 coefficients); **U-Value** and
     **R-Value** — material layers only, films EXCLUDED.
     Windows show U-Factor + U-Value (no R rows, V1 parity).
   - Tooltips state the film convention and the honeybee field
     name, e.g. U-Factor: *"Includes interior + exterior
     air-film resistances (EN673/ISO10292). Honeybee
     `u_factor`."*
   - Convention recorded in `context/GLOSSARY.md` Thermal
     performance: "-Factor = with films, -Value = without."
     The envelope builder's layer-sum quantity corresponds to
     the films-excluded "-Value" rows.

8. **Airflow units** — Q-VIEW that's implicit, addressed
   by PRD §11.5: the wire transports m³/s (SI canonical);
   the frontend converts to m³/h or CFM at display time.
   **V1's pre-Pydantic m³/s → m³/h backend conversion is
   dropped** (V1 ref §14.2 — the backend's "multiply by
   3600 before Pydantic" hack is a workaround for V1's
   backend convention, replaced in V2).

9. **Empty userData paths render `--`** (V1 parity).
   Missing fields don't throw or render `null`; they
   render an em-dash placeholder.

10. **Info-field tooltips** — each `InfoField` row can
    declare a `tooltip`; hovering the label shows a small
    popover with the tooltip text. V1 parity.

11. **Panel scroll** — if the field list overflows panel
    height, panel scrolls (not the page).

12. **Locked-version + Viewer rendering.** Panel fully
    functional — info-panel is a viewing operation.

### Resolved questions (2026-05-10)
- **Q-VIEW-3 (shade selectability):** shades not selectable
  → no info-panel config for shades. Criterion 6.
- **Q-VIEW-4 (pipe richer fields):** all loaded pipe
  fields displayed. Criterion 5 `pipeSegmentLine` row.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §13.4** — `ElementInfoPanel/` + `fieldConfigs.ts`
  layout.
- **`context/GLOSSARY.md`** — Thermal performance section;
  drives the U-Value / R-Value label + tooltip text.
- **PRD §11.5** — IP/SI conversion at display; m³/s SI on
  wire.
- **US-VIEW-4** — Select tool's `selectedObjectId` feeds
  this panel.
- **US-VIEW-7** — backend's loaders stash field values in
  userData (the source the panel reads).

---

## US-VIEW-7 — Backend: HBJSON parsing + bulk `/model_data` endpoint

**Status:** Implemented 2026-06-12 (model-viewer Phase 2, as amended
by `planning/archive/model-viewer/phases/phase-02-*.md` — no EPW
port per D-07, D-15 artifact serving, D-16 taxonomy) ·
**Priority:** MVP
**PRD ref:** §11.4.2 (`project_hbjson_files`), §11.5 (SI
canonical on wire), §10.3 (MCP surface)
**V1 ref:** §2 (full backend tour — routes, cache, services,
schemas), §14.2 (pre-Pydantic airflow conversion — V2 fix),
§14.3 (AirBoundary skip — Q-VIEW-1)

### Story
> As the frontend Model tab, I want a single
> `/model_data` endpoint that returns everything needed to
> render and inspect the model — faces, spaces, sun path,
> hot-water systems, ventilation systems, shading — in one
> bulk response, with all units in SI canonical so the
> frontend handles display conversion.

### Acceptance criteria

1. **Port V1's `backend/features/hb_model/services/model_elements.py`
   to V2** with the following changes:
   - **SI canonical on wire** (PRD §11.5). V1's pre-Pydantic
     `_v_sup * 3600` (m³/s → m³/h) conversion is **removed**.
     Wire transports m³/s. Frontend (US-VIEW-6 criterion 8)
     converts to m³/h or CFM at display.
   - **AirBoundary handling — preserve V1 skip + add explicit
     logging** (Q-VIEW-1 resolved). Faces whose
     `properties.energy.construction.to_dict()` fails opaque
     validation are skipped (V1 parity), but each skip
     emits a backend log line AND the count is returned in
     a new `load_summary.air_boundaries_skipped` field on
     `CombinedModelDataSchema`. The frontend surfaces this
     count in the load-summary Sonner toast (US-VIEW-2
     criterion 10).
   - **Drop V1's `LimitedCache` + 1-hour TTL** (V1 ref §14.4).
     V2 fetches directly from R2 using ETag-based
     validation — HBJSON is immutable post-upload (V1's
     re-upload-without-cache-invalidation issue can't
     happen because each upload creates a new
     `project_hbjson_files` row with a new R2 object).

2. **New endpoint structure** — routes under
   `/projects/{project_id}/hbjson-files/{file_id}/`:
   - `GET .../model_data` → `CombinedModelDataSchema`
     (bulk; the only one the frontend uses).
   - `GET .../faces`, `.../spaces`, `.../sun_path`,
     `.../hot_water_systems`, `.../ventilation_systems`,
     `.../shading_elements` → per-feature endpoints kept
     live for MCP-tool callability (NEW-LLM-API-1). The
     viewer uses only `/model_data`.

3. **`CombinedModelDataSchema`** — top-level response:
   ```jsonc
   {
     "faces": [FaceSchema, ...],
     "spaces": [SpaceSchema, ...],
     // sun path is NOT here (D-SP-1): it is location-reactive and served by
     // the separate GET /projects/{id}/sun-path endpoint.
     "hot_water_systems": [PhHotWaterSystemSchema, ...],
     "ventilation_systems": [PhVentilationSystemSchema, ...],
     "shading_elements": [ShadeGroupSchema, ...],
     "load_summary": {
       "air_boundaries_skipped": 0,         // per Q-VIEW-1
       "faces_extracted": 0,
       "spaces_extracted": 0,
       "shade_groups_extracted": 0,
       "extraction_warnings": ["..."]      // any non-fatal warnings
     }
   }
   ```
   `sun_path` stays optional — EPW load failure is
   non-fatal (V1 parity).

4. **Pydantic schemas** — port V1's
   `schemas/{honeybee, honeybee_energy, honeybee_ph,
   honeybee_phhvac, ladybug, ladybug_geometry}/`
   subtrees largely as-is. Pydantic v2 (`ConfigDict`,
   `field_validator`, `model_validator`,
   `.model_validate()`, `.model_dump()` — per project
   CLAUDE.md).

5. **Shade merging** — preserve V1's tolerance-aware vertex
   merging (`Point3D.is_equivalent`, tol=1e-7) at the
   backend so each shade group ships as a single merged
   `Mesh3D` (V1 ref §2.3.3 / §9.7). One draw call per
   group on the frontend.

6. **EPW for sun path** — V1's `services/epw.py` ports
   as-is. EPW file lookup moves from AirTable to whatever
   storage V2 uses for project EPW (likely R2; defer the
   exact mechanism to a separate v1.1+ if not already
   covered by the project-creation flow).

7. **Honeybee-PH supply/exhaust duct distinction surfaced**
   (Q-VIEW-2 prerequisite). The `PhHvacDuctElementSchema`
   already carries `duct_type` (Supply vs Exhaust) from
   the V1 schema. Backend ensures this field is populated
   correctly per the source honeybee-phhvac data so the
   frontend can color-split (US-VIEW-5 criterion 3).

8. **Loaders stash userData** — see V1 ref §9. Each
   per-feature loader on the frontend (US-VIEW-2..6
   helpers) reads the schema, builds Three.js geometry,
   and stamps full DTO fields onto `userData` so the
   info panel (US-VIEW-6) can read without re-fetching.
   This is presentation-side, not backend, but the
   backend's job is to ship the DTOs in the schemas the
   loaders expect — no field renames vs V1.

9. **Process-local cache removed** (V1 ref §14.4); derived
   payload precomputed *(amended 2026-06-12, D-15)*. The
   upload-time extraction job writes the full
   `CombinedModelData` to R2 as an immutable derived
   artifact; `GET /model_data` streams that artifact with
   `Cache-Control: immutable` + ETag and does NOT parse
   HBJSON per request (re-parse-per-request had no latency
   ceiling on ~50 MB multifamily files). The original
   intent stands: backend does NOT memoize the
   deserialized `honeybee.model.Model` in process memory,
   avoiding V1's cross-worker cache-coherence problems
   (V1 ref §14.4) — immutable storage replaces both the
   cache and the re-parse. Self-healing: artifact missing
   with `extraction_status='pending'` → extract
   synchronously and persist; `'failed'` → typed permanent
   error (D-16).

10. **MCP-callable endpoints** (NEW-LLM-API-1) — every
    endpoint listed in criterion 2 is also exposed as an
    MCP tool. Agent workflows like *"list all spaces with
    `v_sup < 30 m³/s`"* read the per-feature endpoint;
    the viewer reads the bulk endpoint. Same data,
    different surface.

11. **Error handling** — port V1's
    `MaterialNotFoundException` collection pattern (V1
    ref §2.3.3) for any future import paths that need it,
    but in V2 v1 it's not exercised (no HBJSON construction
    import per US-ENV-12). The pattern stays in the
    codebase for MCP-tool error reporting consistency.

12. **Permissions** — same as US-VIEW-1: Editors and
    Viewers can fetch model data. Upload, delete, and metadata
    mutation remain editor-only.

### Resolved questions (2026-05-10)
- **Q-VIEW-1 (AirBoundary handling):** skip + log + count
  in `load_summary`. Criterion 1.

### Open questions
None outstanding.

### Cross-references
- **V1 ref §2** (full backend tour) — authoritative source
  for the V2 port.
- **PRD §11.4.2** — `project_hbjson_files` table is the
  upstream of these endpoints.
- **PRD §11.5** — SI canonical drives criterion 1.
- **PRD §10.3** — MCP tool surface; per-feature endpoints
  remain live for MCP.
- **`context/GLOSSARY.md`** — U-Value / R-Value labels
  shipped by Pydantic schemas match the convention
  (criterion 4).
- **NEW-LLM-API-1** — drives the per-feature endpoint
  preservation in criterion 2.

---
