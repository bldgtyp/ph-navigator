---
DATE: 2026-05-26
TIME: 17:44 EDT
STATUS: WORKING FEATURE PRD - Assembly Builder core feature
AUDIENCE: Future coding agents implementing PH-Navigator V2
SCOPE: Assemblies + Specifications as one coupled feature, plus
       explicit interfaces to catalog, assets, thermal calculations,
       HBJSON construction export, save/versioning, and viewer mode.
RELATED:
  - context/PRD.md
  - context/UI_UX.md
  - context/user-stories/20-envelope.md
  - context/technical-requirements/data-model.md
  - context/technical-requirements/save-versioning.md
  - context/technical-requirements/frontend-viewer-units.md
  - context/technical-requirements/api.md
  - research/v1-assembly-builder-reference.md
---

# PH-Navigator V2 - Assembly Builder Feature PRD

## 1. Purpose

The Assembly Builder is the core V2 feature for authoring opaque
envelope constructions: walls, floors, roofs, and other layered
assemblies used in Passive House energy models and certification
documentation.

The feature has two inseparable sides:

1. **Assemblies** - a visual layer/segment builder for construction
   geometry, material assignment, thermal behavior, and orientation.
2. **Specifications** - a project-material QA workspace for product
   commitment status, datasheets, notes, and per-installation site
   photos.

These surfaces must be developed together because they share the same
data model. A segment references a project material. The project
material owns product values, datasheets, notes, and specification
status. The segment owns geometric/function flags and site photos.

This PRD is intentionally feature-focused. It should guide future coding
agents before they create implementation-phase plans. Detailed
acceptance criteria live in `context/user-stories/20-envelope.md`; this
document states the product contract, architecture constraints, and V1
to V2 intent.

## 2. Product Goal

Editors must be able to build and maintain the full opaque-envelope
construction set for a project version with enough fidelity to support:

- design analysis decisions;
- Passive House certification QA;
- downstream Honeybee / PHX / WUFI / PHPP workflows;
- public read-only review by clients, contractors, and certifiers;
- LLM-assisted bulk inspection, edits, and reporting.

The Assembly Builder should preserve the V1 mental model Ed and John
already use while removing V1's architectural traps: AirTable live
references, relational project entities, per-segment datasheet
duplication, alert/confirm workflows, chatty per-property PATCH calls,
and ambiguous catalog refresh behavior.

## 3. Users And Modes

### 3.1 Editors

Editors are authenticated BLDGTYP users. In V2 v1 this means Ed and
John. Editors can:

- add, rename, duplicate, and delete assemblies;
- add, delete, and edit layers and segments;
- pick or hand-enter materials;
- edit project-material values;
- attach datasheets and site photos;
- refresh project materials from catalog;
- download HBJSON construction exports;
- Save / Save As the active project draft.

### 3.2 Viewers

Viewers are unauthenticated users with the project URL. Viewers can:

- open the same project routes as editors;
- browse versions;
- view assemblies, project materials, datasheets, photos, and computed
  values;
- download allowed project artifacts.

Viewers cannot write. Edit affordances must be hidden or disabled in the
frontend, and every write must be rejected server-side without a valid
editor session.

### 3.3 Locked Versions

Locked versions are read-only for document data. For this feature:

- Assembly and Specifications edit controls are hidden or disabled.
- The user can browse assemblies, view material evidence, open photos,
  and view computed R-/U-values.
- Editing a locked version requires Save As into a new unlocked version.

## 4. Scope

### 4.1 In Scope

- Envelope sub-tab routing for Assemblies and Specifications.
- Assembly sidebar with add, rename, duplicate, delete, and select.
- Assembly header with active assembly picker, total thickness,
  effective R-/U-value, zoom controls, toolbar actions, and overflow.
- Proportional assembly canvas: ordered layers, side-by-side segments,
  inside/outside labels, and material legend.
- Layer operations: add above/below, edit thickness, delete with
  last-layer guard.
- Segment operations: add left/right, edit material/width/CI/stud
  properties, delete with last-segment guard.
- Bookshelf material picker: "In this project" plus "From catalog",
  catalog copy-in, project-material de-dup, hand-enter.
- Project-material editor, shared-use warning, and detach-to-new-
  material flow.
- Copy/paste material assignments inside the active assembly.
- Effective R-/U-value display and backend calculation.
- Catalog drift badges and per-material refresh-from-catalog.
- Specifications material cards with spec status, notes, datasheets,
  use-sites, and per-segment site photos.
- Asset attach/detach for datasheets and site photos through the generic
  asset backbone.
- HBJSON construction export only.

### 4.2 Adjacent, Referenced, But Not Fully Specced Here

- Airtightness sub-tab. See US-ENV-14.
- Site Photos sub-tab. See US-ENV-15.
- Full catalog manager. See catalog PRD/requirements.
- HBJSON Model viewer. See `context/technical-requirements/frontend-
  viewer-units.md` and US-Viewer.

### 4.3 Non-goals For V2 v1

- HBJSON construction import into builder tables.
- AirTable connectivity or "refresh from AirTable".
- Live catalog references that mutate projects automatically.
- Multi-row material division grids inside one layer.
- Cross-assembly copy/paste.
- Multi-select paste.
- Keyboard copy/paste shortcuts for the envelope canvas.
- Per-assembly HBJSON export.
- Bulk material-card operations.
- Required-photo-set checklist.
- Automatic unused-material cleanup in the background or as a hidden
  side effect of export/download.
- Cross-project material queries.
- Real-time collaboration or merge UI.
- Mobile/phone optimization.

## 5. Architectural Commitments

### 5.1 Source Of Truth

All feature data lives in the active project document draft and saved
version body. The canonical tables are:

- `body.tables.assemblies[]`
- `body.tables.project_materials[]`

Relational tables do not shadow these project tables. PostgreSQL stores
the validated JSONB document on `project_versions.body`. Draft edits go
through `project_version_drafts.body`.

### 5.2 Save Model

Assembly Builder edits are draft edits, not saved-version edits. The
frontend updates its in-memory document and syncs guarded JSON-Patch
operations to the server-side draft buffer. Persistence happens only
when the user clicks Save or Save As.

Feature implementation must follow the project-wide draft/version rules:

- first edit lazily creates a server draft;
- patches are ETag guarded;
- array mutations are guarded by stable-id `test` ops;
- locked versions reject draft patches;
- Save overwrites the active unlocked version;
- Save As creates a new version and switches active.

### 5.3 Backend Owns Calculations

The frontend is display and interaction only. Thermal calculations,
validation, HBJSON construction serialization, and unit-normalized data
manipulation belong in the backend.

The frontend may convert SI values for display/input but must store and
send SI values in the document:

- layer thickness: mm;
- segment width: mm;
- steel stud spacing: mm;
- conductivity: W/mK;
- density: kg/m3;
- specific heat: J/kgK;
- U-value: W/m2K.

### 5.4 Project Materials Are The Product Layer

Segments do not inline full material data. Segments reference a
project-material row by `project_material_id`.

The project-material row is the unit of product identity inside the
project. It owns:

- name;
- category;
- conductivity, density, specific heat, emissivity, color;
- specification status;
- datasheet asset ids;
- notes;
- catalog origin and local overrides.

The segment owns:

- width;
- steel stud spacing;
- continuous-insulation flag;
- project material reference;
- site photo asset ids.

This split is a core V2 correction. One product used in ten segments
needs one datasheet and one product commitment status, while each
installation slot may still need its own photo evidence.

### 5.5 Catalog Is A Bookshelf

The Materials catalog is a curated starting library. Picking a catalog
material copies values into `project_materials[]` and stamps
`catalog_origin`. The project owns its copy from then on.

Catalog changes do not silently update project documents. Refresh is an
explicit, per-project-material, diff-and-choose workflow.

### 5.6 Assets Are References

Datasheets and photos are stored through the generic `project_assets`
backbone. Project documents store asset ids, not object URLs.

Deleting from a feature UI first means detaching the asset id from the
active draft. The uploaded asset row and bytes remain available to older
saved versions and other references until backend GC determines they are
safe to purge.

## 6. Domain Model

### 6.1 Assembly

An assembly is one opaque construction type in the active project
version.

Required fields:

```jsonc
{
  "id": "asm_<ULID>",
  "name": "WALL-C3",
  "type": "wall",
  "orientation": "first_layer_outside",
  "layers": []
}
```

`type` is required for Site Photos grouping and downstream filtering.
Allowed values are:

- `wall`
- `floor`
- `roof`
- `other`

On create, the UI should auto-detect from the assembly name when
possible:

- names beginning `WALL` -> `wall`;
- names beginning `FLOOR` or `FC` -> `floor`;
- names beginning `ROOF` -> `roof`;
- otherwise `other`.

The user must be able to edit the type later from assembly-scoped
actions.

`orientation` controls which end of the layer list is exterior:

- `first_layer_outside`
- `last_layer_outside`

### 6.2 Layer

A layer is one horizontal strip in the assembly cross-section.

Required fields:

```jsonc
{
  "id": "lyr_<ULID>",
  "order": 0,
  "thickness_mm": 50.0,
  "segments": []
}
```

Rules:

- An assembly must always have at least one layer.
- Layer order is explicit and must stay contiguous after insert/delete.
- Thickness must be greater than 0.

### 6.3 Segment

A segment is one side-by-side material slot within a layer.

Required fields:

```jsonc
{
  "id": "seg_<ULID>",
  "order": 0,
  "width_mm": 812.8,
  "is_continuous_insulation": false,
  "steel_stud_spacing_mm": null,
  "project_material_id": null,
  "photo_asset_ids": []
}
```

Rules:

- A layer must always have at least one segment.
- Segment order is explicit and must stay contiguous after insert/delete.
- Width must be greater than 0.
- `project_material_id` may be `null` in a draft.
- Null-material segments render as unfinished and are allowed during
  design work.
- Save and Save As do not warn or block because of null material
  assignments. The canvas and Specifications dashboard are the
  completeness surfaces; persistence should not nag during normal
  modeling.

### 6.4 Project Material

A project material is a project-owned product record.

Required fields:

```jsonc
{
  "id": "pmat_<ULID>",
  "name": "XPS",
  "category": "Insulation",
  "conductivity_w_mk": 0.034,
  "density_kg_m3": 35.0,
  "specific_heat_j_kgk": 1500.0,
  "emissivity": 0.9,
  "argb_color": "(255,220,230,240)",
  "specification_status": "missing",
  "datasheet_asset_ids": [],
  "notes": null,
  "catalog_origin": null
}
```

Specification status uses the V1-compatible four-state enum:

- `complete`
- `missing`
- `question`
- `na`

This PRD intentionally resolves the conflict between older sketches that
used `pending` and the envelope/V1 language. Implementation should use
`missing`, not `pending`, unless all related docs are deliberately
revised.

User-facing labels are simplified in V2:

- `complete` -> "Complete"
- `missing` -> "Missing"
- `question` -> "Question"
- `na` -> "N/A"

### 6.5 Catalog Origin

Catalog-picked project materials carry:

```jsonc
{
  "catalog_table": "materials",
  "catalog_record_id": "rec123abc456789",
  "catalog_version_id": "matv_<token>",
  "catalog_schema_version": 1,
  "synced_at": "2026-05-26T21:44:00Z",
  "local_overrides": []
}
```

Hand-entered and detached custom project materials have
`catalog_origin: null`.

## 7. Core Workflows

### 7.1 Create Assembly

An editor clicks `+ Add new assembly`.

The system creates an assembly with:

- unique name, defaulting to `Unnamed Assembly`, suffixing on collision;
- `type` auto-detected from name or `other`;
- `orientation: first_layer_outside`;
- one layer, 50 mm thick;
- one segment, 812.8 mm wide;
- no assigned material.

The new assembly becomes active and its URL deep-link updates.

### 7.2 Rename Assembly

Assembly names must be unique within the project version after trim and
case-insensitive comparison. Display preserves the user's casing.

The rename dialog should also expose assembly type because users often
correct naming and classification together. Assembly type should also be
available in the assembly overflow menu for users who want to change the
classification without opening the rename flow.

The dialog should be small, focused, keyboard-friendly, and consistent
with V1: assembly name text field, assembly type select, Save, Cancel,
submit on Enter.

### 7.3 Duplicate Assembly

Duplicating an assembly deep-copies the assembly, layers, and segments
with new IDs.

It preserves `project_material_id` references because the duplicate uses
the same products. It does not duplicate segment photos because photos
document an installation slot, not an abstract product.

The duplicate becomes active. Default name is `<source> (Copy)`, with
collision suffixing.

### 7.4 Delete Assembly

Deleting an assembly removes it from the draft with a confirmation
dialog.

Project-material rows are not auto-deleted. If no remaining segments
reference a material, that material appears as unused in the
Specifications sub-tab until explicitly removed.

The Specifications sub-tab should provide an explicit **Remove unused
materials...** command. It is disabled when there are no unused
materials. When enabled, it opens a confirmation dialog listing the
number of unused materials to remove and warning that project-level
datasheet links and notes on those material rows will be removed from
the active draft.

Cleanup is never run in the background. There is no major harm in a few
unused project materials remaining during modeling, and explicit cleanup
protects against accidental loss of datasheet/notes history while the
user is reorganizing assemblies.

Downloads and exports should not mutate the draft or saved version.
Project JSON/table JSON downloads must reflect the version body exactly.
CSV-style downloads, if added, should also be pure reads. HBJSON
construction export naturally emits only materials referenced by
exported assemblies, so unused project materials are excluded without a
cleanup side effect.

### 7.5 Add/Edit/Delete Layer

Layer add controls appear as compact hover `+` buttons above and below
the thickness cell, matching V1's interaction model.

Editing thickness opens a modal with unit-aware input parsing.

Deleting a layer is only available when the assembly has more than one
layer. The UI should disable the destructive action with an explanatory
tooltip before the backend has to reject it.

### 7.6 Add/Edit/Delete Segment

Segment add controls appear as compact hover `+` buttons on the left and
right segment edges, matching V1.

Adding a segment:

1. uses the adjacent/source segment's `project_material_id` if present;
2. otherwise uses the assembly's session-only last-picked material;
3. otherwise starts as `null`.

Editing a segment opens the Segment Properties modal. In V2 this modal
owns geometry and assembly-function properties:

- material picker;
- shared-use indicator;
- material data preview;
- material value edit/detach entry points;
- segment width;
- continuous-insulation flag;
- steel-stud cavity flag;
- steel-stud spacing.

Specification status, datasheets, and notes do not live in this modal.
They live in Specifications because they are project-material QA
properties.

Deleting a segment is only available when the layer has more than one
segment. Deleting a segment preserves the referenced project material.

### 7.7 Pick Material

The material picker has two primary sections:

1. **In this project** - existing `project_materials[]`, with use counts.
2. **From catalog** - catalog materials grouped by category.

Picking an existing project material simply repoints the segment.

Picking a catalog material de-dupes by `catalog_record_id`:

- if an existing project material came from that catalog record, use it;
- otherwise create a new project material with copied catalog values.

Hand-entering creates a new project material with `catalog_origin: null`
and does not de-dupe by name.

After any successful pick, update the assembly-local session default so
later new segments can use the last-picked material.

### 7.8 Edit Shared Material Values

Editing values on a project material affects every segment referencing
that material. The UI must make this explicit with a shared-use warning
and a list or count of affected use-sites.

When the material has `catalog_origin`, edited fields should be tracked
in `catalog_origin.local_overrides` so refresh-from-catalog can default
those fields to "keep mine".

Implementation should use one shared `ProjectMaterialEditor` component
for every place where product values are editable. At minimum it is
surfaced from:

- the Segment Properties modal, as an expander or secondary panel near
  the material picker;
- the Specifications material card, via `... -> Edit material values`.

The shared editor owns product-value fields only:

- name;
- category;
- conductivity;
- density;
- specific heat;
- emissivity;
- ARGB/color;
- any future ProjectMaterial physical-property fields.

The shared editor does not own datasheets, site photos, specification
status, or notes. Those remain in Specifications because they are QA and
evidence workflows, not physical product-value edits.

The same warning text must appear wherever the editor is opened:

> Editing applies to all {N} segments using this material. To override
> values for one segment only, detach that segment to a new material.

Using a shared editor prevents two classes of future defects:

- divergent field sets, where the Segment modal supports one subset of
  material values and Specifications supports another;
- divergent side effects, where one edit path updates
  `catalog_origin.local_overrides`, drift state, R-/U-value cache
  invalidation, or shared-use warnings differently from the other.

The editor should therefore expose one semantic "update project
material" mutation path, regardless of the surface that opened it.

### 7.9 Detach To New Material

When a user needs one segment to diverge from a shared product:

1. create a fresh `project_materials[]` row;
2. default name to `<source> (Custom)`, with collision suffixing;
3. copy product values;
4. copy datasheets and specification status;
5. set `catalog_origin: null`;
6. repoint the current segment to the new row.

Detach means "fork from catalog/shared identity." The detached material
does not participate in refresh-from-catalog.

### 7.10 Copy/Paste Assignments

The canvas supports V1's eyedropper/paint-bucket pattern inside the
active assembly only.

Copy payload:

```ts
{
  project_material_id: string | null;
  steel_stud_spacing_mm: number | null;
  is_continuous_insulation: boolean;
}
```

Not copied:

- segment width;
- photo asset ids.

The paste operation should be one atomic draft mutation for the target
segment. Undo is a bounded in-memory stack of 20 paste entries per
active assembly and is cleared on assembly/version/document switch.

### 7.11 Review Specifications

The Specifications sub-tab lists one card per project material. It is
the main QA sweep surface for envelope materials.

Each card shows:

- material name;
- category and product values;
- catalog/source/drift badges;
- specification status;
- notes;
- datasheets;
- use-sites by assembly/layer/segment;
- per-use site-photo zones.

Cards sort pending QA work first:

1. `missing`, `question`, and `na`;
2. `complete`;
3. unused materials in a separate bottom section.

Viewers do not see `na` material cards or unused materials.

### 7.12 Attach Evidence

Datasheets attach to project materials. Site photos attach to segments.

Upload flow uses the generic asset backbone:

1. create upload intent / pending asset row;
2. upload bytes to R2;
3. complete upload;
4. attach asset id to the active draft via JSON-Patch.

Detaching evidence removes the asset id from the relevant document
array. It does not hard-delete the asset immediately.

### 7.13 Refresh From Catalog

Catalog drift is a project-material property. Drift may surface on
segment chips because segments reference the material, but the refresh
operation updates the project-material row.

The refresh dialog compares catalog values against the project-owned
copy and lets the user choose field by field:

- keep mine;
- take catalog;
- edit value.

Fields in `local_overrides` default to keep mine.

No bulk auto-refresh ships in v1.

### 7.14 Download HBJSON Constructions

The project header overflow exposes `Download constructions (HBJSON)`.

Export is read-only and per active version. It serializes the active
version's assemblies and project materials into a Honeybee-compatible
construction file.

V2 v1 has no construction import action.

## 8. UX Surface Requirements

### 8.1 Envelope Sub-tabs

The Envelope tab has four sub-tabs:

1. Assemblies
2. Specifications
3. Airtightness
4. Site Photos

Bare `/envelope` redirects to `/envelope/assemblies`.

Assembly deep-links use:

`/projects/{project_id}/envelope/assemblies/{assembly_id}`

Deleting the active assembly redirects to the next available assembly or
the empty state.

### 8.2 Assemblies Layout

The Assemblies sub-tab is split into:

- collapsible left sidebar, about 260 px when open;
- right workbench with header, toolbar, canvas, and legend.

The visual assembly is the primary work object. It should not feel like
a decorative preview embedded in a generic card.

### 8.3 Assembly Sidebar

Rows show assembly name only. Do not add thumbnails, R-values, or
counts in v1.

Rows sort with `naturalSortCompare`.

Hover row actions:

- rename;
- duplicate;
- delete.

Edit controls are hidden for Viewers and locked versions.

### 8.4 Assembly Header

The header includes:

- "Assembly Details" title;
- active assembly picker;
- total thickness;
- effective R-value in IP or U-value in SI;
- canvas zoom controls;
- flip orientation;
- flip layers;
- pick/paste/undo controls;
- assembly overflow menu.

HBJSON in/out actions do not live here. AirTable refresh does not exist.

### 8.5 Canvas

The canvas renders:

- top orientation label;
- stacked layers;
- bottom orientation label;
- material legend.

Layer height and segment width must share one `canvasZoom` scale so the
assembly's aspect ratio is never distorted. Horizontal overflow should
scroll instead of compressing segments.

Null-material segments render as unfinished:

- blank or neutral fill;
- dashed outline;
- still clickable and editable.

### 8.6 Layer And Segment Hover Controls

Preserve V1's compact hover-circle add buttons:

- layer above/below buttons on the thickness cell;
- segment left/right buttons on segment edges;
- magenta `#b2087c` visual treatment unless the design system replaces
  it with an equivalent token.

Hide hover add controls during pick/paste mode, for Viewers, and on
locked versions.

### 8.7 Modals And Dialogs

V2 uses shadcn Dialog and Sonner toasts, not `window.confirm` or
`alert`.

Core modal/dialog set:

- rename assembly;
- edit layer thickness;
- edit segment properties;
- delete assembly confirmation;
- delete layer confirmation;
- delete segment confirmation;
- material picker/hand-enter;
- material values editor/detach;
- refresh-from-catalog diff;
- image/PDF full view.

### 8.8 Specifications Layout

The Specifications sub-tab is a scrollable list of material cards.

Do not reproduce V1's per-segment primary list. Per-segment use-sites
belong inside each material card.

The page heading may remain "Project Materials" for continuity with V1.

## 9. Computed Values And Validation

### 9.1 Total Thickness

Total thickness is the sum of active assembly layer thicknesses.

Display:

- SI: mm;
- IP: inches.

This may be computed client-side from draft state because it is a simple
display aggregation.

### 9.2 Effective R-/U-value

Effective thermal performance is backend-computed and never stored as an
editable document field.

V2 policy:

- show construction-only R-value/U-value;
- do not include surface films;
- do not show U-factor/R-factor in v1.

Algorithm:

- Passive House average of Parallel-Path and Isothermal-Planes methods;
- steel-stud cavity layers use AISI S250-21 equivalent conductivity;
- use `R_SE = 0` and `R_SI = 0` in the steel-stud subroutine.

Display:

- IP: effective R-value, one decimal;
- SI: effective U-value, three decimals.

When any segment has no material, still display the value from assigned
segments when valid, but mark the assembly as unfinished.

### 9.3 Validation Posture

Drafts may contain incomplete design work. The user can save a working
draft, Save, and Save As without warnings for:

- null material assignments;
- `missing`, `question`, or `na` specification status;
- missing datasheets;
- missing site photos;
- unused project materials.

Rationale: incomplete submittals and photos are normal until late in the
certification process. The Specifications dashboard is the completeness
surface; Save / Save As should not annoy the modeler during routine
editing.

Hard validation should protect:

- malformed document shape;
- duplicate assembly names;
- invalid enum values;
- non-positive thickness/width/stud spacing;
- broken project-material references;
- broken asset references;
- empty assemblies/layers after operations;
- other schema-invalid values.

## 10. Permissions And Visibility

### 10.1 Editor On Unlocked Version

Full feature controls are available.

### 10.2 Editor On Locked Version

The feature is read-only. Controls that mutate the active document are
hidden or disabled. Save As remains available through project-level
chrome.

### 10.3 Viewer

The feature is read-only. Viewers can inspect meaningful project data
and open/download evidence where the public project surface exposes it.

Viewer-specific visibility:

- hide material cards where `specification_status === "na"`;
- hide unused materials;
- hide upload, delete, edit, and detach controls;
- keep thumbnails/lightbox/download available for visible evidence.

## 11. API And Backend Shape

Implementation should prefer semantic backend services over duplicating
complex document manipulation in the frontend.

Expected backend responsibilities:

- Pydantic models for assemblies, layers, segments, project materials,
  and computed thermal results.
- Draft mutation helpers that produce guarded JSON-Patch operations or
  accept semantic mutations and apply safe patches server-side.
- Material picker support: catalog list, project-material list, de-dup
  by catalog record id.
- Refresh-from-catalog diff generation.
- Thermal-resistance calculation service ported from V1 and adapted to
  V2 document shape.
- HBJSON construction export service.
- Asset attach/detach and signed URL resolution.

Frontend responsibilities:

- local interaction state;
- optimistic in-memory document updates;
- unit display/input conversion;
- modal/picker/canvas UI;
- patch queueing and ETag handling through shared project-document
  infrastructure.

## 12. V1 Parity And V2 Changes

### 12.1 Preserve From V1

- visual layer/segment canvas;
- default collapsed sidebar;
- natural-sorted assembly list;
- hover add-layer and add-segment controls;
- three core edit modals;
- total thickness and effective R-/U-value header labels;
- separate flip-orientation and flip-layers actions;
- copy/paste with pick/paste cursor modes and 20-step undo;
- material legend;
- drag/drop evidence upload;
- image/PDF full-view modal;
- viewer hiding of `na` documentation rows/cards.

### 12.2 Change From V1

- No AirTable.
- No live global Material references inside project segments.
- No automatic material purge.
- No default material hard-failure on fresh install.
- No per-segment datasheet duplication.
- No spec status or notes on segments.
- No HBJSON construction import.
- No surface films in steel-stud HBJSON export equivalent-conductivity.
- No alert/confirm browser primitives.
- No multi-PATCH segment save.
- No horizontally squished canvas.
- Catalog drift is explicit and reviewable.

## 13. Acceptance Criteria - Feature Level

The feature is acceptable when:

1. An editor can create a project assembly from an empty state, assign
   materials, edit layers/segments, and Save the draft.
2. An editor can maintain one product record for a material used in many
   segments, attach one datasheet, set one spec status, and see every
   use-site.
3. A site photo attaches to a specific segment and does not move when a
   material assignment changes.
4. A duplicated assembly shares project-material references but starts
   with no copied site photos.
5. A null-material segment is visually obvious and does not crash the
   builder.
6. The effective R-/U-value matches V1's live thermal-resistance
   algorithm after adapting for the V2 document model and the no-films
   policy.
7. Refresh-from-catalog never mutates project materials without explicit
   user choice.
8. Locked versions and Viewers render a coherent read-only feature with
   write controls hidden or disabled.
9. All writes go through the draft buffer and honor ETag/locked-version
   rules.
10. HBJSON construction export emits the active version's assemblies
   without importing anything back into PHN.
11. The UI remains usable at expected BLDGTYP project scale: dozens of
   assemblies, low hundreds of segments, and dozens of project
   materials.

## 14. Test Expectations

Future implementation plans should include tests for:

- ProjectDocument Pydantic validation for assemblies and materials.
- Assembly/layer/segment add, delete, duplicate, and order preservation.
- Stable-id guarded patches for nested array mutations.
- Material pick de-dup by catalog record id.
- Hand-enter and detach-to-new-material behavior.
- Project-material sharing and use-site counts.
- Last-layer and last-segment UI/backend guards.
- Thermal-resistance golden fixtures, including steel-stud cases.
- Null-material unfinished display and save warnings.
- Catalog drift detection and refresh choices.
- Datasheet and site-photo attach/detach semantics.
- Viewer and locked-version permission rendering.
- HBJSON export shape and no-surface-film steel-stud behavior.
- Playwright coverage for core canvas workflows.

## 15. Resolved Questions

Resolved during the 2026-05-26 PRD review:

1. **Assembly type edit surface.** Assembly type is editable in both the
   rename dialog and the assembly overflow menu. Users often correct
   naming and classification together, but classification also needs a
   direct action.
2. **Save / Save As validation gate.** Save and Save As do not block or
   warn for null material assignments, missing datasheets, missing site
   photos, unused materials, or open QA statuses. Only schema-invalid
   data blocks persistence.
3. **Material delete semantics.** Unused project materials are preserved
   by default. The Specifications sub-tab provides an explicit
   **Remove unused materials...** command that removes unreferenced
   `project_materials[]` rows from the active draft after confirmation.
   Cleanup does not run in the background and does not run as a hidden
   side effect of export/download.
4. **Material value editor location.** Implement one shared
   `ProjectMaterialEditor` component and surface it from both Segment
   Properties and Specifications with the same shared-use warning text.
5. **Canvas thumbnail reuse.** Site Photos thumbnails use shared
   geometry/color utilities but a separate lightweight thumbnail
   component, not the full interactive canvas renderer.
6. **Save warnings.** No Save or Save As warning for missing materials,
   missing specs, missing datasheets, missing photos, or unused
   materials. The dashboard/Specifications surfaces already show
   completeness status.
7. **Per-material status labels.** Simplify user-facing labels to
   "Complete", "Missing", "Question", and "N/A".

## 15.1 Open Questions

None for the current PRD pass.

## 16. Deferred V1.1 Candidates

- Cross-assembly copy/paste.
- Multi-select paste.
- Keyboard copy/paste on the canvas.
- Multi-row material division grids.
- Bulk operations in Specifications.
- Required photo checklist.
- Bulk download of all datasheets or all site photos.
- Per-assembly HBJSON export.
- HBJSON construction import as a separate, explicit feature.
- Catalog schema migration tooling.
- Advanced canvas zoom gestures.
- Per-project material catalog filters if catalog size grows beyond
  roughly 150-200 materials.
