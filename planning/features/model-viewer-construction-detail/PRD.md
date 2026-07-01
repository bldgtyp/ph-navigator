---
DATE: 2026-07-01
TIME: -
STATUS: Draft — feasibility verified by spike; awaiting Ed's review.
AUTHOR: Claude (for Ed)
SCOPE: Product/behavior contract for a read-only "detailed construction"
  modal in the Model tab, opened from the Opaque Surface inspector,
  visualizing the selected face's HBJSON assembly (material layers +
  honeybee-ph segments/steel-studs) with per-layer thermal figures.
RELATED:
  - backend/features/model_viewer/schemas/honeybee_energy.py (the schema
    that currently drops layer detail — the core change site)
  - backend/features/model_viewer/extraction.py (_faces_from_model,
    construction build at :143, thermal fields at :156-157)
  - backend/features/model_viewer/routes.py (GET .../model_data — the
    viewer's single data call)
  - frontend/src/features/model_viewer/types.ts (OpaqueConstruction :80,
    FaceModelData :98)
  - frontend/src/features/model_viewer/lib/fieldConfigs.ts
    (constructionFields :263, construction() accessor :344)
  - frontend/src/features/model_viewer/components/InspectorPanel.tsx
    (button placement)
  - frontend/src/features/envelope/canvas-geometry.ts +
    components/AssemblySvgCanvas.tsx (drawing precedent — pattern reused,
    code not imported)
  - frontend/src/shared/ui/ModalDialog.tsx (modal shell to reuse)
---

# Model Viewer — Detailed Construction Viewer

## 0. Problem & design intent

Today the Opaque Surface inspector shows a construction's **summary**:
name, type, and the four thermal figures (U-Factor, U-Value, R-Factor,
R-Value). What it can't show is *what the assembly actually is* — the
ordered stack of material layers, their thicknesses, and (for
honeybee-ph constructions) the heterogeneous make-up of framed layers:
insulation-between-studs, steel-stud layers, mixed cavities.

When Ed clicks a wall in the 3D model, the useful next question is
"what's the build-up of this wall in the model?" — is it the 4" XPS +
2x6 cellulose/wood-stud assembly I expect, or something stale? Answering
that today means leaving the app and opening the HBJSON by hand.

**Design intent, one sentence:** clicking one button in the Opaque
Surface card opens a modal that *draws* the assembly — layers to scale,
colored by their PH color, with framed layers broken into their real
sub-material segments — so the model's construction can be read at a
glance without leaving the viewer or trusting a single summary number.

This is a **read-only visualization of the HBJSON model as it stands.**
It is not an editor, and it is **not** wired to the App's Envelope
feature (§1, D-8). The HBJSON is a self-contained model whose assemblies
may or may not align with the App's envelope data; surfacing or
reconciling that divergence is out of scope here.

## 1. Scope

**In scope:**
- A new "View Construction" button in the Opaque Surface inspector's
  *Construction* section (`faceMesh` selections only).
- A read-only modal rendering the selected face's opaque construction:
  - A **to-scale layer-stack drawing** (SVG), layers ordered
    exterior→interior, each sized by thickness and filled by its PH
    color, with exterior/interior end labels.
  - **Segment subdivision** for heterogeneous layers: honeybee-ph
    `divisions` (mixed-material cavities *and* steel-stud layers) drawn
    as sub-cells sized by their column widths and colored by each cell's
    material.
  - A **layer table**: #, layer name, thickness, conductivity (λ),
    per-layer R-value; framed layers expand to show their segment
    sub-materials (name, λ, width, steel-stud spacing where present).
  - A header echoing the construction's name, type, total thickness, and
    the four existing thermal figures.
- Backend: stop discarding the layer/segment/color data that honeybee-ph
  already produces, so it reaches the viewer.
- Handling **both** flat honeybee constructions (homogeneous layers) and
  detailed honeybee-ph constructions (with segments) through **one**
  render path (§4, D-5).

**Explicitly out of scope (v1):**
- **Window / aperture** constructions. The current schema ships them
  with *no* materials at all (`WindowConstructionSchema`,
  `honeybee_energy.py:45`), and glazing/gas/frame structure differs from
  opaque layering. The button appears only on opaque faces. (Deferred —
  §12, tracked for v1.1.)
- Any editing of layers/materials/segments.
- Any link, comparison, or drift indicator between the HBJSON assembly
  and the App's Envelope items (D-8).
- Changing how honeybee-ph models are authored in Rhino, or what
  geometry/constructions are exported.
- 2D psi-value / thermal-bridge cross-sections, hygrothermal layers,
  vapor control, or condensation analysis — this is a geometry+thermal
  read, not a building-science calc.

## 2. Feasibility — VERIFIED (not assumed)

The load-bearing question was: *is the layer + segment + color data
actually present and retrievable end-to-end?* It is. Verified 2026-07-01
against Ed's real export (`project_2540_assemblies.json`) and the live
backend code:

1. **The HBJSON carries everything.** Each `OpaqueConstruction` holds an
   ordered `materials[]`; each `EnergyMaterial` carries `thickness`,
   `conductivity`, an inline `properties.ph.ph_color` (RGBA swatch), and
   `properties.ph.divisions` = `{column_widths[], row_heights[],
   cells[], steel_stud_spacing_mm}`. Each `cell` nests its own
   sub-`material`. A **flat** honeybee layer has empty `divisions`; a
   **honeybee-ph framed** layer populates them. This is the entire
   dataset the modal needs.

2. **honeybee-ph round-trips it losslessly.** A spike parsed three
   sample constructions with
   `OpaqueConstruction.from_dict(d).to_dict()` (honeybee-ph is already a
   backend dep, `pyproject.toml`) and confirmed survival of:
   - *Heterogeneous Layers*: 6 layers; the two framed layers kept **5
     cells each** (cellulose ↔ wood-stud stripes) with colors.
   - *Steel Stud Layers*: the steel layer kept its **1 cell +
     `steel_stud_spacing_mm = 406.4`**.
   - *Homogeneous Layers*: 3 flat layers, `cells = 0`, colored.
   (`honeybee_ref` is not installed; the round-trip degrades gracefully
   — we only consume the `ph` extension, not `ref`.)

3. **The only thing dropping the data is our own schema.** Extraction
   does `OpaqueConstructionSchema(**construction.to_dict())`
   (`extraction.py:143`). But `EnergyMaterialSchema`
   (`honeybee_energy.py:14-25`) is a flat mirror — `type, thickness,
   conductivity, specific_heat, roughness, *_absorptance, density`. It
   has **no `identifier`/`display_name` and no `properties`**, so
   Pydantic silently drops `ph_color`, `divisions`, `cells`, and
   `steel_stud_spacing_mm` at validation. The extracted artifact
   (`derived/{asset_id}/model_data.json.gz`, served by
   `routes.py` `GET .../model_data`) therefore never contains them, and
   the frontend `OpaqueConstruction` type (`types.ts:80`) mirrors that
   thin shape.

**Difficulty verdict: MODERATE, LOW-RISK.** No new extraction logic, no
new library, no new geometry math to invent, no new endpoint strictly
required. The work is three additive slices: (1) widen the backend
material schema so it stops discarding what honeybee-ph already emits;
(2) add the matching frontend types; (3) build a read-only modal that
reuses a proven drawing pattern. The one behavior that looks hard —
"handle both flat and detailed constructions" — collapses to a single
rule (§4, D-5): *is `divisions.cells` populated?*

## 3. Current behavior (baseline, verified against code)

- The inspector's *Construction* section is built by
  `constructionFields()` (`lib/fieldConfigs.ts:263-311`) from
  `meta.properties.energy.construction` (accessor `construction()`,
  `:344-346`). It renders name/type/U/R rows only. There is no button
  and no layer data on the wire to power one.
- `FaceMeshMeta.properties` is `face.properties` verbatim
  (`loaders/building.ts:157-166`), i.e.
  `{ energy: { construction: OpaqueConstruction | null } }`. The
  construction object is the thin 6-field summary
  (`types.ts:80-87`) — materials are not typed and, per §2.3, are not
  even present in the payload.
- The viewer's only data call is `GET .../model_data`
  (`routes.py`), returning the precomputed immutable gzip artifact.
  There is no per-construction detail endpoint.
- Reusable frontend infrastructure already exists:
  - `shared/ui/ModalDialog.tsx` — a backdrop + `role="dialog"` shell
    with Escape-to-close and a title/close header.
  - Unit-aware formatters used by the inspector today:
    `formatLengthFromMm`, `formatConductivityFromWmK`,
    `formatRValueFromM2KPerW` (`lib/units`), plus the existing IP/SI
    toggle via `useUnitPreference`.
  - The **Envelope** feature's assembly drawing —
    `canvas-geometry.ts` (`buildAssemblyCanvasGeometry`, ~30 lines:
    layers → y/height by thickness, segments → x/width) and
    `components/AssemblySvgCanvas.tsx` (SVG rects, per-material fills,
    steel-stud handling). This is the **pattern** the modal reuses; its
    *code* is coupled to the editable App model (`ProjectMaterial`
    catalog lookups, paint/pick controllers) and is **not** imported
    (D-4, D-8).

## 4. New behavior — the modal

### 4.1 Entry point
- A **"View Construction"** button in the Opaque Surface *Construction*
  section (label confirmed by Ed 2026-07-01), rendered only for
  `faceMesh` metas that have a non-null construction with ≥1 layer.
  Disabled/absent when layer data is missing (e.g. a construction that
  failed opaque validation).
- On open, resolves the full layer detail from the top-level
  `constructions` map (D-2) by the selected face's
  `construction.identifier`. Opens `<ConstructionDetailModal>` built on
  `ModalDialog`. Escape and the header Close button dismiss it. Closing
  returns focus to the inspector; the 3D selection is unchanged.

### 4.2 Header
- Construction **name** (identifier) as the title.
- Type, **total thickness** (Σ layer thickness), and the four thermal
  figures (U-Factor / U-Value / R-Factor / R-Value), reusing the exact
  formatters and tooltips already in `constructionFields()`. Respect the
  IP/SI unit toggle.

### 4.3 Layer-stack drawing (SVG, read-only)
- Layers ordered **exterior → interior** (honeybee `materials[0]` is the
  outermost — confirm in Phase 0, §13-Q1), drawn as a to-scale stack
  with "Exterior" / "Interior" end labels.
- Each layer's extent along the stack axis ∝ its thickness. Each layer
  filled by its material's PH color.
- **Framed layers** (`divisions.cells` non-empty) are subdivided across
  the layer into sub-cells sized by normalized `column_widths` (and
  `row_heights` if >1 row), each cell filled by *its* material's color.
- **Steel-stud layers** (`divisions.steel_stud_spacing_mm != null`) get
  a visible stud marker/hatch and their spacing annotated.
- Reuses the Envelope geometry algorithm's shape (thickness→extent,
  width→subdivision) reimplemented against the honeybee construction
  (D-4); no dependency on Envelope code.

### 4.4 Layer table
- One row per layer: **#**, **name** (material `display_name` ?
  `display_name` : `identifier`), **thickness**, **conductivity (λ)**,
  **R-value** (= thickness / conductivity, unit-converted).
- Framed layers are expandable to sub-rows, one per segment cell:
  sub-material name, λ, cell width (mm/in), and steel-stud spacing when
  present.
- A totals row: total thickness; total R. Per-layer R computed from the
  layer's (possibly homogenized) λ reconciles with the construction's
  reported R-Value — call it out as a sanity check, not a second source
  of truth (D-7).

### 4.5 Empty / degenerate states
- Construction present but zero layers, or layer data absent (older
  artifact, or a face skipped at extraction): the button is hidden; if
  the modal is somehow reached, it shows a plain "No layer detail
  available for this construction" message rather than an empty drawing.
- Material with **null `ph_color`** (seen on the steel-stud homogenized
  outer material): render a neutral fallback fill; for framed layers,
  prefer the cell materials' colors (which are present) over the
  homogenized outer color (D-6).

## 5. Design decisions

- **D-1 — Opaque only, v1.** Button and modal apply to `faceMesh`
  selections. Apertures are deferred (§1, §12): the wire carries no
  window materials today and the structure differs. *Confirmed by Ed
  2026-07-01 — opaque assembly surfaces only, not windows.*

- **D-2 — Deliver detail as a deduplicated top-level `constructions`
  map.** *Decided by Ed 2026-07-01.* The `model_data` artifact gains a
  top-level `constructions: { identifier → DetailedOpaqueConstruction }`,
  written **once per unique construction**. Each face keeps only its thin
  construction *summary* (identifier, type, U/R — exactly what the
  inspector already shows and already carries the identifier); the modal
  resolves full layer detail by `construction.identifier` into the map.
  Rationale: a model has hundreds of faces but only dozens of unique
  constructions, so embedding full layer/segment detail per-face would
  repeat the same assembly ~20×. The map stores each assembly once — it
  is actually *smaller* than today's per-face material embedding, and it
  ships inside the one artifact the viewer already loads, so the modal
  stays instant with no extra round-trip. **Rejected alternatives:**
  widening the material schema in place (repeats heavy `divisions.cells`
  across every face using a framed construction); a lazy per-construction
  endpoint (over-engineering for dozens of constructions). Phase 1 still
  records the Hillandale artifact-size delta as a sanity check, but the
  map is the chosen shape, not a conditional one.

- **D-3 — Recursive material schema.** A segment cell nests a full
  `EnergyMaterial`. Model `divisions.cells[].material` with the *same*
  widened material schema (self-referential Pydantic model / recursive
  TS type). Depth in practice is one level; the schema allows the
  general case without special-casing.

- **D-4 — Dedicated read-only renderer; reuse the pattern, not the
  code.** Build a new `ConstructionDetailModal` + a small SVG
  layer-stack component. Reuse the Envelope drawing *approach*
  (`buildAssemblyCanvasGeometry` math; SVG rects; steel-stud hatch) and
  read `ph_color` **inline** (no `ProjectMaterial` catalog lookup —
  simpler than Envelope). Do not import Envelope's editable types or
  paint controllers.

- **D-5 — One render path for flat and detailed.** The flat-vs-detailed
  distinction is exactly `divisions.cells.length > 0`. A flat layer is
  the degenerate single-cell case. No branching feature logic, no
  separate "honeybee vs honeybee-ph" code path — the same component
  renders both. This is what makes the user's "handle both ideally"
  requirement cheap.

- **D-6 — Color source & fallback.** Fill homogeneous layers with the
  material's `ph_color`; fill framed layers by their cell materials'
  colors; any null color → a defined neutral fallback. Never block
  rendering on a missing color.

- **D-7 — Thermal figures are LBT-verbatim; per-layer R is derived,
  labeled as such.** The header's U/R come straight from honeybee (as
  today, D-12 in the archived model-viewer PRD). Per-layer R (thickness
  / λ) is computed frontend-side for display only and presented as a
  breakdown that should reconcile with the total — not as an
  authoritative independent calc (calc-in-backend rule still holds for
  anything that must be trusted; this is a display-only reconciliation).

- **D-8 — Fully isolated, view-only, by design.** *Confirmed and
  hardened by Ed 2026-07-01.* The modal reads the HBJSON model
  exclusively and is **strictly read-only** — the HBJSON is read-only in
  the app. Hard boundaries:
  - It shows no App envelope/catalog values and makes no claim about
    whether the HBJSON and the App agree.
  - **No import path** — nothing in this view loads HBJSON materials or
    constructions into the project material catalog.
  - **No migration path** — no affordance to push/copy any item from
    this view into the Envelope/assembly *builder* pages.
  - The model_viewer feature imports **no** Envelope code (types,
    controllers, catalog hooks). The Envelope drawing *pattern* is
    reimplemented locally (D-4), not shared.
  This keeps it a pure, sandboxed model viewer with no leakage into the
  editable data model in either direction.

- **D-9 — No migration/versioning for v1; ship the schema change
  directly.** *Revised 2026-07-01 after confirming the one-day-old
  production deploy has **no projects** — hence no HBJSON files and no
  cached `model_data` artifacts to migrate.* This feature changes the R2
  `model_data` **artifact** schema, not a Postgres table. Since nothing
  has ever been extracted on prod, the `constructions` map simply appears
  on every extraction from this change forward. So: **no Alembic
  migration, no `model_data_schema_version` column, no serve-path
  staleness logic.** Phase 1 becomes purely additive schema + extraction
  work.
  - **⚠️ Deploy step — DB reset/restart while prod is empty (don't
    forget).** In lieu of a migration, do a **DB reset/restart on the
    deploy** when Phase 1 ships, to guarantee a clean slate (any stray
    dev/test project cleared, every artifact extracted with the new
    schema). This is trivial and safe *only because* prod has no real
    projects — **the window closes the moment real project data lands**,
    after which artifact versioning (below) is required instead. Noted
    here so the reset isn't forgotten. See §10.1.
  - *Safety net* if the reset is somehow skipped and a stray artifact
    predates the change: the frontend already hides the button / shows the
    empty state when a construction has no layer detail (§4.5), so a stale
    artifact degrades to "no View Construction button" — never a crash —
    and is fixed by a re-upload or a routine dev re-seed.
  - This matches the established pattern: the MEP-length artifact change
    also shipped without versioning.
  - **Deferred, not discarded (§12):** artifact schema versioning (a
    `MODEL_DATA_SCHEMA_VERSION` constant + a version column + staleness
    re-extraction) becomes worthwhile before the *next* extraction-schema
    change that ships against **real project data**. It is a known
    follow-up, not built now (YAGNI while prod is empty).

## 6. Data contract (proposed)

Delivery is the deduplicated map (D-2). The combined artifact gains a
top-level, opaque-only map; faces keep their thin summary and key into
it:
```
CombinedModelData:
    constructions: { [identifier: str]: DetailedOpaqueConstruction }   # NEW, unique
    faces[].properties.energy.construction: FaceConstructionSummary     # thin (today's shape, no materials)

DetailedOpaqueConstruction:
    identifier: str
    type: str
    u_factor / u_value / r_factor / r_value: float          # same LBT figures as the summary
    materials: list[ConstructionMaterial]                    # ordered exterior→interior

ConstructionMaterial (a widened EnergyMaterial; names mirror honeybee-ph
`to_dict()`, per the sample):
    identifier: str
    display_name: str | None          # present on hybrid/homogenized layers
    thickness: float                  # meters
    conductivity: float               # W/mK
    properties.ph.ph_color: {a,r,g,b} | None
    properties.ph.divisions:
        column_widths: list[float]    # meters; [] when homogeneous
        row_heights: list[float]
        steel_stud_spacing_mm: float | None
        cells: list[{ row:int, column:int, material: ConstructionMaterial }]   # recursive (D-3)
```
Backend: build the detailed construction during extraction (materials
presence is still the AirBoundary opaque tripwire, `honeybee_energy.py:28`),
insert it into `constructions` keyed by identifier if not already present,
and leave the face carrying only its summary. Frontend: a new recursive
`ConstructionMaterial` type + the `constructions` map on
`CombinedModelData`; the modal reads
`constructions[face…construction.identifier]`. Thickness stays in meters
on the wire (converted at display); `column_widths` normalized to
fractions at render time.

## 7. Acceptance criteria

1. Selecting an opaque face in the Building lens shows a working "View
   Assembly" button in the Construction section; a window selection does
   not (D-1).
2. The modal opens for a **flat** honeybee construction and draws each
   layer to scale, colored, with a correct layer table (thickness, λ, R)
   and totals.
3. The modal opens for a **detailed honeybee-ph** construction and draws
   framed layers as segment sub-cells (verified against
   *Heterogeneous Layers* — 5-cell cellulose/wood layers) and steel-stud
   layers with spacing annotated (verified against *Steel Stud Layers*,
   406.4 mm).
4. Exterior/interior orientation is labeled and correct (§13-Q1).
5. Thickness, λ, and R-value render in the active IP/SI unit system and
   track the toggle.
6. Per-layer R breakdown reconciles with the header R-Value within
   rounding (D-7).
7. Escape and Close dismiss the modal; the 3D selection is preserved;
   focus returns to the inspector.
8. A construction with no layer detail hides the button / shows the
   empty-state message — no crash, no blank drawing.
9. No Envelope data appears in the modal and no Envelope code is imported
   by the model_viewer feature (D-8).
10. Backend + frontend gates green (`make ci`); Hillandale artifact-size
    delta recorded as a sanity check (§13-Q2).
11. New extractions include the `constructions` map; a construction with
    no layer detail (e.g. an artifact predating this change, or a skipped
    construction) hides the button / shows the empty state rather than
    erroring — graceful degradation (§4.5, D-9), no migration required.

## 8. Verification approach

- **Backend:** a schema round-trip test that feeds the three sample
  constructions (flat, hybrid, steel-stud) through
  `OpaqueConstructionSchema` and asserts `identifier`, `ph_color`,
  `divisions.cells`, and `steel_stud_spacing_mm` survive (the spike,
  promoted to a real test with a committed fixture — heavy/licensed
  HBJSON stays out of the public repo per repo rules; use the small
  synthetic sample constructions, not a full model).
- **Frontend:** unit tests for the honeybee-construction →
  layer-geometry adapter (flat = single full-width cell; hybrid = N
  cells summing to full width; steel-stud flag surfaced), and for
  per-layer R math. Playwright: select a known flat face and a known
  framed face, open the modal, assert layer/segment counts and the
  steel-stud annotation.
- **Browser walkthrough** on a real uploaded model with screenshots of a
  flat and a detailed assembly.

## 9. Effort estimate (rough)

- Backend schema (dedup map + recursive material) + round-trip test:
  **~S–M** (additive schema; the dedup insert + recursion are the only
  real thinking). No migration/versioning (D-9 — prod is empty).
- Frontend types + adapter: **~S**.
- Modal + SVG layer-stack + layer table + unit wiring: **~M** (the bulk
  of the work; drawing pattern is precedented, not novel).
- Wiring the inspector button + empty states + a11y/focus: **~S**.
- Tests + browser verification + closeout: **~S–M**.

Net: a small-to-moderate feature, front-loaded on the frontend modal,
with de-risked backend plumbing.

## 10. Rollout / sequencing

Backend data first (nothing to render without it), then frontend types +
adapter, then the modal, then the inspector button + verification. See
`PLAN.md`. The backend slice is independently shippable and harmless
(additive fields + a new nullable-defaulted column, no consumer yet).

### 10.1 Deployment (production is live but empty)

`main` deploys production (`context/DEVELOPMENT_WORKFLOW.md`). The deploy
is one day old with **no projects**, so there are no HBJSON files and no
cached `model_data` artifacts. Consequences for this feature:

- **No migration, no versioning** (D-9). The backend slice is purely
  additive; every extraction from this change forward carries the
  `constructions` map.
- **⚠️ Deploy step (don't forget): DB reset/restart while prod is empty.**
  In place of a migration, reset/restart the deploy's DB when Phase 1
  ships — a clean slate that clears any stray test project and guarantees
  all artifacts are extracted with the new schema. Safe *only because*
  prod has no real projects; **this option disappears once real project
  data exists** (at which point artifact versioning, §12, is the required
  path instead).
- Phase 1 can merge independently and harmlessly — nothing consumes the
  map until the frontend phases land, and there is no prior data to
  invalidate.
- **Stray dev/test artifacts** (if Ed uploads a test model before this
  ships) degrade gracefully: the button hides / empty state shows (§4.5).
  Re-upload or a routine dev re-seed regenerates the artifact with the
  map. No action required in this feature.
- **Before real project data exists**, revisit artifact versioning (§12,
  D-9) — that is the point at which a future extraction-schema change
  would otherwise strand cached artifacts.

## 11. Risks & mitigations

- **Artifact bloat.** Structurally avoided by the deduplicated map (D-2):
  each construction is stored once regardless of face count. Phase 1
  records the size delta as a sanity check.
- **Stale cached artifacts.** Only possible for a dev/test model on the
  otherwise-empty prod (D-9); such an artifact degrades to "no button"
  (§4.5) and is fixed by re-upload / re-seed. The durable answer —
  artifact versioning — is deferred to §12, to be built before the next
  extraction-schema change that ships against real project data. Watch
  for it *then*: the subtle bug in a version scheme is forgetting to
  stamp the current version on re-extraction (every request re-extracts).
- **Layer orientation ambiguity.** honeybee's exterior-first convention
  is well established but must be confirmed against a known model
  (§13-Q1) before trusting the Exterior/Interior labels.
- **honeybee-ph `to_dict()` variance across versions / model paths.**
  The spike used construction-level `from_dict/to_dict`; the real
  extraction path is `Model.from_dict(...).faces[..]
  .properties.energy.construction.to_dict()`. Phase 1 must confirm ph
  material props survive that *full model* path, not just the isolated
  construction (very likely — the ph extension is active because rooms
  already read `properties.ph` — but verify).
- **Null colors / degenerate divisions** (empty column_widths, single
  cell, mismatched row/col counts). Covered by D-6 + §4.5 empty states;
  the adapter must be defensive.

## 12. Deferred / future (v1.1+)

- Window/aperture construction detail (glazing panes, gas fills, frames)
  — needs its own schema work and a different drawing.
- Per-material provenance (the `ph_nav` `external_identifiers` seen in
  the sample) or any *optional, clearly-labeled* cross-reference to
  Envelope items — only if Ed later wants it; excluded now per D-8.
- Copy/export of the assembly (image or table).
- **Artifact schema versioning + re-extraction** (a
  `MODEL_DATA_SCHEMA_VERSION` constant + a
  `project_hbjson_files.model_data_schema_version` column + serve-path
  staleness re-extraction). Deferred now because prod is empty (D-9);
  needed before the next `model_data` extraction-schema change that ships
  against real project data, so cached artifacts self-heal instead of
  stranding. When built, it retires the "just re-upload/re-seed" stopgap.

## 13. Open questions

- **Q1 (orientation):** Confirm honeybee `materials[]` order is
  exterior→interior for the face types we render, and that it's stable
  across wall/roof/floor. Settle before labeling Exterior/Interior.
- **Q2 (delivery shape):** RESOLVED — deduplicated top-level
  `constructions` map (Ed, 2026-07-01). See D-2, §6. Phase 1 records the
  artifact-size delta as a sanity check only.
- **Q3 (button placement):** RESOLVED label — "View Construction" (Ed,
  2026-07-01). Remaining cosmetic-only: header-inline vs a full-width row
  under the U/R figures. Not blocking.
- **Q4 (row_heights):** All samples have a single row. Confirm whether
  any real model uses multi-row divisions and, if so, that the drawing
  handles 2D grids (the Envelope precedent does).
