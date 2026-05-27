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
  - context/technical-requirements/attachments.md
  - context/technical-requirements/frontend-viewer-units.md
  - docs/features/ip-si-unit-switching-prd.md
  - context/technical-requirements/llm-mcp-schema.md
  - context/technical-requirements/api.md
  - research/v1-assembly-builder-reference.md
  - docs/plans/2026-05-26/assembly-builder/progress-next-steps.md
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
status. The segment owns geometric/function flags, site photos, and
use-site notes.

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
- Semantic envelope read/write surface for browser and MCP callers.

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
- Runtime custom fields on assemblies, project materials, layers, or
  segments. Envelope v1 uses fixed PHN-declared fields.
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
frontend updates its in-memory document and syncs guarded semantic
envelope commands to the server-side draft buffer. The backend command
layer may apply safe JSON-Patch operations internally, but the canvas UI
should not author nested array patches directly. Persistence happens
only when the user clicks Save or Save As.

Feature implementation must follow the project-wide draft/version rules:

- first edit lazily creates a server draft;
- commands and lower-level patches are ETag guarded;
- array mutations are guarded by stable-id checks before any positional
  change is applied;
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
- site photo asset ids;
- use-site notes.

This split is a core V2 correction. One product used in ten segments
needs one datasheet and one product commitment status, while each
installation slot may still need its own photo evidence and
location-specific notes.

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

### 5.7 Semantic Mutation Boundary

The Assembly Builder should use a deep backend feature boundary instead
of scattering nested JSON manipulation across React components.

Default implementation shape:

- backend package: `backend/features/envelope/`;
- frontend package: `frontend/src/features/envelope/`;
- semantic commands for every domain mutation;
- project-document draft storage remains the persistence layer.

The public write surface should be a typed command endpoint under the
project-version draft namespace:

```text
POST /api/v1/projects/{project_id}/versions/{version_id}/draft/envelope/commands
```

The command endpoint uses the same editor auth, Origin checks,
Idempotency-Key, `If-Match`, and `If-Match-Version` rules as the
generic draft patch endpoint. Internally it may generate guarded
JSON-Patch operations, but callers should not assemble fragile
array-index patches for assembly/layer/segment workflows.

Core command names:

- `create_assembly`
- `rename_assembly`
- `update_assembly_type`
- `duplicate_assembly`
- `delete_assembly`
- `add_layer`
- `update_layer`
- `delete_layer`
- `add_segment`
- `update_segment`
- `update_segment_use_site_notes`
- `delete_segment`
- `pick_project_material`
- `pick_catalog_material`
- `hand_enter_material`
- `update_project_material`
- `detach_segment_material`
- `remove_unused_project_materials`
- `refresh_project_material_from_catalog`
- `flip_orientation`
- `flip_layers`
- `paste_segment_assignment`

Asset upload, preview, download, and detach still use the generic asset
backbone. The envelope command layer may call the generic attach/detach
services, but it must not invent a second asset pipeline.

### 5.8 Read Models And Registered Table Contracts

The visual builder is not a generic table, but the project-document
surface still needs registered contracts for downloads, diff, MCP, and
attachment-cell operations.

Implementation should keep three separate read shapes:

1. **Envelope document slice** - full `assemblies[]` +
   `project_materials[]` for the visual builder and semantic commands.
2. **Project-material table contract** - `project_materials` rows for
   datasheet attachment cells, downloads, diff, and MCP tabular reads.
3. **Assembly-segment table contract** - flattened segment rows for
   site-photo attachment cells, downloads, diff, and MCP tabular reads.

Do not make the visual canvas consume the flattened attachment table as
its source of truth. Flattening is a view adapter over the nested
assembly document, not the domain model.

### 5.9 LLM / MCP Contract

LLM-assisted inspection and edits are in scope, but only through the
same typed envelope commands and registered read models used by the
browser. MCP tools must not write raw JSON-Patch into nested assembly
arrays unless they call a backend helper that produces stable-id
guarded operations.

Minimum v1 MCP/read capabilities:

- list assemblies with layers, segments, and computed status;
- list project materials with use-sites, datasheets, spec status, and
  catalog drift state;
- query unfinished envelope work: null materials, missing conductivity,
  missing datasheets, missing site photos, unused materials, and drifted
  catalog rows;
- perform the same semantic mutations as the browser, behind ETag and
  draft-lease protection.

### 5.10 Unit Switching Boundary

Assembly Builder must follow the global IP/SI contract in
`docs/features/ip-si-unit-switching-prd.md`:

- project document fields, command payloads, table downloads, MCP
  reads/writes, backend validation, thermal calculations, and HBJSON
  export remain SI canonical;
- all display/input conversion happens in React through shared helpers
  exported from `frontend/src/lib/units/`;
- no Assembly Builder component should carry V1-local conversion logic
  or hard-code SI suffixes when the value is user-facing.

Canonical SI fields in this feature include:

- `thickness_mm`;
- `width_mm`;
- `steel_stud_spacing_mm`;
- `conductivity_w_mk`;
- `density_kg_m3`;
- `specific_heat_j_kgk`;
- backend thermal response values in `W/(m2-K)` and `m2-K/W`.

Unitless fields include emissivity, specification status, notes,
colors, ids, booleans, and all enum values.

## 6. Domain Model

### 6.0 Cross-Table Identity And Completeness Rules

Stable ids are the durable identity. Display names are labels, never
references.

Rules:

- Assembly names are unique within a project version after trim and
  case-insensitive comparison.
- Project-material names are **not** required to be unique. Two project
  materials may both be named "XPS" if the user intentionally keeps
  different product records. Pickers and exports must disambiguate with
  category, catalog badge, spec status, use count, and/or id.
- `project_material_id` references are valid only within the same
  project document body.
- Use-sites are derived from `assemblies[]` and are never stored on
  `project_materials[]`.
- Physical product-value keys are required on the row, but values may be
  `null` during early design. Present numeric values must be finite.
- `conductivity_w_mk` must be greater than 0 when present. Missing or
  invalid conductivity does not block Save / Save As, but it makes
  affected thermal calculations and HBJSON export invalid until fixed.
- `density_kg_m3`, `specific_heat_j_kgk`, and `emissivity` may be
  `null`; if present they must be non-negative, and emissivity must be
  between 0 and 1.
- `argb_color` is advisory display metadata. Invalid or missing color
  falls back to a neutral token in the UI; it should not block Save.

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
  "photo_asset_ids": [],
  "use_site_notes": null
}
```

Rules:

- A layer must always have at least one segment.
- Segment order is explicit and must stay contiguous after insert/delete.
- Width must be greater than 0.
- `project_material_id` may be `null` in a draft.
- Null-material segments render as unfinished and are allowed during
  design work.
- `use_site_notes` are segment-scoped installation / QA notes. They do
  not follow a project material when assignments change.
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

The keys above are required for a `project_materials[]` row. Physical
value fields may be `null` while the product is still being identified.
The UI should surface missing physical values in Specifications and in
the Segment Properties material preview, but Save / Save As should not
block.

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
  "catalog_record_id": "rec123abc4567890X",
  "catalog_version_id": "matv_<token>",
  "catalog_schema_version": 1,
  "synced_at": "2026-05-26T21:44:00Z",
  "local_overrides": []
}
```

Hand-entered and detached custom project materials have
`catalog_origin: null`.

For project materials, `catalog_origin.catalog_table` must be
`"materials"` and `catalog_origin.catalog_version_id` must use the
`matv_` version-family prefix. This mirrors the frame/glazing
provenance-family rule and prevents accidentally refreshing a material
from the wrong catalog family.

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
the same products. It does not duplicate segment photos or use-site
notes because they document an installation slot, not an abstract
product.

The duplicate becomes active. Default name is `<source> (Copy)`, with
collision suffixing.

### 7.4 Delete Assembly

Deleting an assembly removes it from the draft with a confirmation
dialog.

Project-material rows are not auto-deleted. If no remaining segments
reference a material, that material appears as unused in the
Specifications sub-tab until explicitly removed.

The delete confirmation must count the per-segment site-photo
references that will be detached with the removed assembly. It should
say that photos remain in project assets and older saved versions, but
they will no longer be referenced by the active draft.

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
The modal seeds its draft from `thickness_mm`, displays the active
unit-system label, and commits canonical mm through the semantic
command. If the user toggles IP/SI while the field is focused, do not
rewrite the draft string under the cursor; parse it on commit using the
editor's visible unit context.

Deleting a layer is only available when the assembly has more than one
layer. The UI should disable the destructive action with an explanatory
tooltip before the backend has to reject it.

Deleting a layer detaches all site-photo ids on segments inside that
layer from the active draft. The confirmation dialog must count those
photo references using the same wording pattern as assembly deletion.

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

Segment width and steel-stud spacing follow the same unit-input rules as
layer thickness: display in the active unit system, accept explicit
suffixes where supported by the shared length parser, and commit
canonical mm.

Specification status, datasheets, and notes do not live in this modal.
Project-material specification status, datasheets, and product notes
live in Specifications because they are product QA properties. Segment
use-site notes also live in Specifications, attached to each use-site
row beside its site photos.

Deleting a segment is only available when the layer has more than one
segment. Deleting a segment preserves the referenced project material.
If the segment has site photos, the confirmation dialog must count the
photo references that will be detached.

### 7.7 Pick Material

The material picker has two primary sections:

1. **In this project** - existing `project_materials[]`, with use counts.
2. **From catalog** - catalog materials grouped by category.

Picking an existing project material simply repoints the segment.

Picking a catalog material de-dupes by `catalog_record_id`:

- if exactly one existing project material came from the same
  `catalog_table` + `catalog_record_id`, use it;
- if no existing project material came from that catalog record, create
  a new project material with copied catalog values.

If multiple existing project materials point at the same catalog record,
do not silently merge them. Show those project materials in the
"In this project" section and require the user to pick one explicitly.

Hand-entering creates a new project material with `catalog_origin: null`
and does not de-dupe by name.

Hand-enter defaults:

- `name`: required user input;
- `category`: defaults to `"Other"` unless the user chooses a category;
- physical values: `null`;
- `specification_status`: `missing`;
- `datasheet_asset_ids`: `[]`;
- `notes`: `null`;
- `argb_color`: neutral fallback color if the user does not choose one.

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

Physical values use the shared unit helpers:

- conductivity / lambda displays as `W/(m-K)` in SI and as
  `Btu/(h-ft-F)`, `R/in`, or both in IP through explicit thermal
  helpers;
- density displays as `kg/m3` in SI and `lb/ft3` in IP;
- specific heat displays as `J/(kg-K)` in SI and `Btu/(lb-F)` in IP;
- emissivity remains unitless.

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
4. copy datasheets, specification status, and notes;
5. set `catalog_origin: null`;
6. repoint the current segment to the new row.

Detach means "fork from catalog/shared identity." The detached material
does not participate in refresh-from-catalog.

Detach does not copy site photos. Photos remain on the segment because
they document the installation slot, and the slot is not being
duplicated.

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
- use-site notes;
- photo asset ids.

V1 copied per-segment specification status and notes because those
fields lived on the segment. V2 does not copy those fields separately:
specification status and product notes follow the referenced
project-material row, while use-site notes stay on the target segment.

The paste operation should be one atomic draft mutation for the target
segment. Undo is a bounded in-memory stack of 20 paste entries per
active assembly and is cleared on assembly/version/document switch.

If the copied `project_material_id` no longer exists in the active
document when the user tries to paste, the paste is rejected with a
toast and no mutation is sent.

Pick/paste interaction should keep the useful V1 affordances:

- pick cursor and target outline;
- paste cursor and target hover highlight;
- 600 ms paste pulse after a successful paste;
- Escape exits pick/paste mode;
- clicking outside a segment exits pick/paste mode;
- changing assembly, version, or document clears copied state.

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
- per-use site-photo zones and use-site notes.

Cards sort pending QA work first:

1. `missing`, `question`, and `na`;
2. `complete`;
3. unused materials in a separate bottom section.

Viewers do not see `na` material cards or unused materials.

### 7.12 Attach Evidence

Datasheets attach to project materials. Site photos and use-site notes
attach to segments.

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

Physical value diffs display in the active unit system but compare and
write canonical SI values. Local override tracking must compare
canonical SI values, not rounded display strings.

Drift detection must follow the canonical catalog rule:

- drifted when `catalog_origin.catalog_version_id` differs from the
  catalog identity row's `current_version_id`;
- drifted when the current catalog-version field value differs from the
  project-owned copied value, even if the version id is unchanged;
- customized when a field key appears in `local_overrides`; customized
  fields default to keep mine, but customization alone does not make the
  row stale if no compared catalog value differs.

If the catalog source row is deactivated, surface
`source_deactivated`. The project material remains valid project data;
refresh is unavailable until the user chooses a different catalog
material or hand-edits the project material.

Saving the refresh dialog writes chosen values into
`project_materials[]`, sets `catalog_origin.catalog_version_id` to the
current catalog version, sets `synced_at = now()`, and preserves
`local_overrides` verbatim in v1. Recomputing or pruning
`local_overrides` is deferred until a later field-level override
management feature.

No bulk auto-refresh ships in v1.

### 7.14 Download HBJSON Constructions

The project header overflow exposes `Download constructions (HBJSON)`.

Export is read-only and per active version. It serializes the active
version's assemblies and project materials into a Honeybee-compatible
construction file.

Export reads the saved version body, not the unsaved browser draft. If
the editor has unsaved draft changes, the UI should warn that the
download reflects the last saved version and offer Save / Save As first.

Export writes project-material `specification_status` into the Honeybee
Energy material PH ref properties (`ref_status`) so downstream tools
can preserve design-commitment state. Because V2 v1 has no construction
import action, this is export-only for now; the V1.1 import feature
should read the same metadata back.

If any assembly cannot be exported because of null material assignments,
missing/invalid conductivity, broken project-material references, or
other malformed thermal data, the backend returns a structured 422 with
the affected assembly/layer/segment paths. Do not silently omit
incomplete assemblies from an HBJSON deliverable.

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

The material legend lists each unique project material used in the
active assembly, sorted by display name, with color swatch and
conductivity / missing-conductivity indicator.

Layer height and segment width must share one `canvasZoom` scale so the
assembly's aspect ratio is never distorted. Horizontal overflow should
scroll instead of compressing segments.

Canvas proportions are based on canonical mm values and `canvasZoom`.
Toggling IP/SI changes labels, tooltips, and editor units only; it must
not change the relative geometry, scroll position, zoom state, or dirty
draft state.

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
Use the shared length formatter; do not duplicate conversion factors in
the envelope feature.

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

Geometry defaults:

- V2 v1 supports one row of side-by-side segments per layer.
- `segment.width_mm` is interpreted as an area-fraction weight within
  that layer.
- Each layer normalizes its own segment widths. Layer width totals do
  not have to match across layers.
- Width totals of zero are schema-invalid because every segment width
  must be greater than 0.
- Multi-row `PhDivisionGrid` behavior is deferred; no v1 import/export
  path should try to infer multiple segment rows.

Display:

- IP: effective R-value, one decimal;
- SI: effective U-value, three decimals.

The backend thermal endpoint returns SI canonical values. The frontend
chooses the active display quantity and unit suffix through shared
thermal helpers.

When any segment has no material, still display the value from assigned
segments when valid, but mark the assembly as unfinished.

If every segment is null-material, or if an assigned material required
for the active assembly has missing/invalid conductivity, display no
number and mark the assembly as unfinished / material data needed. The
backend response should distinguish:

- `missing_material` - at least one segment has
  `project_material_id: null`;
- `missing_conductivity` - an assigned project material lacks a valid
  `conductivity_w_mk`;
- `invalid_geometry` - widths, thicknesses, or stud spacing cannot be
  used.

### 9.3 Validation Posture

Drafts may contain incomplete design work. The user can save a working
draft, Save, and Save As without warnings for:

- null material assignments;
- missing physical material values such as conductivity;
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
- broken non-null project-material references;
- broken, duplicate, cross-project, wrong-kind, or over-limit asset
  references;
- duplicate entity ids within their table/scope;
- project-material `catalog_origin` values that point at the wrong
  catalog family;
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

### 11.1 Backend Feature Package

Expected package:

```text
backend/features/envelope/
  routes.py
  models.py
  service.py
  repository.py
  mutations.py
  selectors.py
  thermal.py
  hbjson_export.py
  refresh.py
```

`repository.py` should stay thin because envelope data lives in the
project document JSONB, not in envelope-owned relational tables. The
service layer composes existing project-document, catalog, and asset
repositories rather than bypassing them.

Expected backend responsibilities:

- Pydantic models for assemblies, layers, segments, project materials,
  and computed thermal results.
- A semantic command dispatcher that applies typed envelope mutations to
  the current user's draft and returns the updated envelope slice plus
  draft/version ETags.
- Material picker support: catalog list, project-material list, de-dup
  by catalog record id.
- Refresh-from-catalog diff generation.
- Thermal-resistance calculation service ported from V1 and adapted to
  V2 document shape.
- HBJSON construction export service.
- Asset attach/detach and signed URL resolution.
- Registered table-contract adapters for project materials and flattened
  assembly segments.

### 11.2 Endpoint Defaults

Feature-specific reads:

```text
GET  /api/v1/projects/{pid}/versions/{vid}/envelope?source=draft|version
GET  /api/v1/projects/{pid}/versions/{vid}/envelope/assemblies/{assembly_id}/thermal?source=draft|version
GET  /api/v1/projects/{pid}/versions/{vid}/envelope/catalog-drift?source=draft|version
GET  /api/v1/projects/{pid}/versions/{vid}/envelope/export/hbjson
```

Feature-specific writes:

```text
POST /api/v1/projects/{pid}/versions/{vid}/draft/envelope/commands
```

The generic table routes remain available for registered table
contracts:

```text
GET /api/v1/projects/{pid}/versions/{vid}/document/tables/project_materials
GET /api/v1/projects/{pid}/versions/{vid}/document/tables/assembly_segments
PUT /api/v1/projects/{pid}/versions/{vid}/draft/tables/project_materials
PUT /api/v1/projects/{pid}/versions/{vid}/draft/tables/assembly_segments
```

The table routes are for DataTable/attachment/MCP table workflows. The
canvas builder should use the semantic envelope reads and commands.

### 11.3 Frontend Shape

Frontend responsibilities:

- local interaction state;
- optimistic in-memory document updates;
- unit display/input conversion;
- IP/SI toggle behavior for every user-facing physical quantity;
- modal/picker/canvas UI;
- command / draft-write queueing and ETag handling through shared
  project-document infrastructure.

Expected frontend package:

```text
frontend/src/features/envelope/
  api.ts
  hooks.ts
  types.ts
  routes/
  components/
  stores/
  lib/
```

State ownership defaults:

- TanStack Query owns envelope reads, catalog reads, thermal overlays,
  drift reports, command mutations, and asset URL resolution.
- Zustand owns cross-component UI state: selected assembly id,
  sidebar open state, canvas zoom, pick/paste mode, copied segment
  assignment, and per-assembly paste undo stack.
- Component-local state owns modal input drafts and hover/focus state.

Do not put envelope command payload shapes inline in route components.
Keep them in feature `types.ts` and reconcile them with backend
Pydantic models during implementation.

## 12. V1 Parity And V2 Changes

### 12.1 Preserve From V1

- visual layer/segment canvas;
- default collapsed sidebar;
- natural-sorted assembly list;
- hover add-layer and add-segment controls;
- three core edit modals;
- total thickness and effective R-/U-value header labels;
- IP/SI-aware layer, segment, material, and thermal displays;
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
- No spec status on segments.
- No product notes on segments; keep only segment-owned use-site notes.
- No HBJSON construction import.
- No surface films in steel-stud HBJSON export equivalent-conductivity.
- No alert/confirm browser primitives.
- No multi-PATCH segment save.
- No horizontally squished canvas.
- Catalog drift is explicit and reviewable.
- No local Assembly Builder unit-conversion helpers; use the shared
  IP/SI unit foundation.

### 12.3 V1 Parity Audit Decisions

The V1 reference checklist in
`research/v1-assembly-builder-reference.md` remains useful, but several
items are intentionally reshaped in V2:

| V1 capability | V2 v1 decision |
|---|---|
| Per-segment notes in the Material-List view | Preserve as segment-owned `use_site_notes`, shown on Specifications use-site rows. |
| Per-segment specification status | Move to project-material status because the product commitment is shared across use-sites. |
| Per-segment datasheets | Move to project-material datasheets to avoid duplicate product evidence. |
| Per-segment site photos | Preserve as segment-owned `photo_asset_ids`. |
| HBJSON construction import | Defer as an explicit V1.1 parity gap; export must still preserve `ph_nav` and `ref_status` metadata so import can return later. |
| Upload/download construction actions in assembly header | Keep download in project/header overflow; omit upload until import is promoted. |
| AirTable material refresh | Replace with catalog copy-in, drift badges, and explicit field-level refresh. |
| Browser `alert` / `confirm` | Replace with app dialogs and toasts. |
| Multi-PATCH segment saves | Replace with atomic semantic commands. |

## 13. Acceptance Criteria - Feature Level

The feature is acceptable when:

1. An editor can create a project assembly from an empty state, assign
   materials, edit layers/segments, and Save the draft.
2. An editor can maintain one product record for a material used in many
   segments, attach one datasheet, set one spec status, and see every
   use-site.
3. A site photo attaches to a specific segment and does not move when a
   material assignment changes.
4. A segment use-site note attaches to that segment and does not move
   when a material assignment changes.
5. A duplicated assembly shares project-material references but starts
   with no copied site photos or copied use-site notes.
6. A null-material segment is visually obvious and does not crash the
   builder.
7. The effective R-/U-value matches V1's live thermal-resistance
   algorithm after adapting for the V2 document model and the no-films
   policy.
8. Refresh-from-catalog never mutates project materials without explicit
   user choice.
9. Locked versions and Viewers render a coherent read-only feature with
   write controls hidden or disabled.
10. All writes go through the draft buffer and honor ETag/locked-version
   rules.
11. HBJSON construction export emits the active version's assemblies
    with `ph_nav` project-material ids and `ref_status`, without
    importing anything back into PHN.
12. The UI remains usable at expected BLDGTYP project scale: dozens of
   assemblies, low hundreds of segments, and dozens of project
   materials.
13. Same-editor browser tabs, MCP writes, and stale ETags fail safely:
    no nested assembly mutation can apply to the wrong layer/segment
    after a concurrent reorder/delete.
14. Destructive operations clearly report detached site-photo counts and
    never delete project asset bytes as a side effect.
15. Toggling IP/SI updates layer thickness labels, segment width /
    steel-stud spacing labels, material previews, material editor
    labels/values, total thickness, and thermal labels without dirtying
    the draft or changing canonical SI payloads.

## 14. Test Expectations

Future implementation plans should include tests for:

- ProjectDocument Pydantic validation for assemblies and materials.
- Assembly/layer/segment add, delete, duplicate, and order preservation.
- Stable-id guarded patches for nested array mutations.
- Semantic envelope command endpoint conflict handling.
- Material pick de-dup by catalog record id.
- Duplicate project-material names and export id disambiguation.
- Hand-enter and detach-to-new-material behavior.
- Project-material sharing and use-site counts.
- Last-layer and last-segment UI/backend guards.
- Delete assembly/layer/segment confirmation counts for site-photo
  detaches.
- Segment use-site notes ownership, mutation, viewer visibility, and
  copy/paste non-propagation.
- Thermal-resistance golden fixtures, including steel-stud cases.
- Null-material and missing-conductivity unfinished display and
  no-warning Save / Save As.
- Catalog drift detection and refresh choices.
- Source-deactivated catalog refresh behavior.
- Datasheet and site-photo attach/detach semantics.
- Attachment races from the canonical attachment edge-case list:
  upload-after-navigation, upload-after-discard, duplicate file in one
  cell, cross-project asset reference, and Save As while uploads are
  pending.
- Viewer and locked-version permission rendering.
- IP/SI conversion for layer height, segment width, steel-stud spacing,
  material conductivity / lambda, density, specific heat, total
  thickness, and thermal labels.
- Unit toggling while a layer/segment/material numeric editor is focused
  does not rewrite the active draft string and still commits canonical
  SI values.
- HBJSON export shape, no-surface-film steel-stud behavior, dirty-draft
  warning, `ph_nav` / `ref_status` metadata, and 422 failure report for
  incomplete assemblies.
- MCP read/query/write path coverage through the same semantic commands
  as the browser.
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
8. **Mutation boundary.** Use semantic envelope commands backed by the
   project-document draft buffer. Browser and MCP callers should not
   hand-author nested JSON-Patch for assembly workflows.
9. **Project-material names.** Names do not need to be unique. Stable
   `pmat_*` ids are identity; pickers and exports disambiguate duplicate
   display names.
10. **Dirty-draft HBJSON export.** Export reads the saved version body.
    Editors with unsaved draft changes get a warning and a Save /
    Save As path before download.
11. **Thermal incomplete states.** Null material assignments and missing
    conductivity do not block Save, but they produce explicit unfinished
    calculation/export states.
12. **Catalog drift predicate.** Drift includes both version-id mismatch
    and same-version field deltas. Source-deactivated catalog rows are
    reported without mutating the project material.
13. **Detach-to-new-material copy policy.** Detach copies product values,
    datasheets, specification status, and notes, but clears
    `catalog_origin` and leaves site photos on the segment.
14. **Segment-width normalization.** Segment widths are normalized within
    each layer for v1 thermal calculations and export; layer totals do
    not have to match.

## 15.1 Implementation Lessons Log

Use this section during phased implementation to feed real discoveries
back into the feature contract. Keep entries short and actionable; move
large analysis into the relevant phase plan or code-review artifact and
link it here.

Template:

| Date | Phase | Lesson / Issue | Contract Impact | Follow-up |
|---|---|---|---|---|
| 2026-05-26 | Phase 1 | Typed `assemblies[]` and `project_materials[]` can land without a schema-version bump because the fields were already reserved in schema v4. The project-document baseline tests are currently stale around the custom-fields to FieldDef rename, so Phase 1 needs a scoped envelope test gate until that baseline is reconciled. | Phase 1 plan closeout; no durable PRD contract change. | Reconcile `tests/test_project_document.py` and global `ty check` before using them as Assembly Builder gates. |
| 2026-05-27 | Phase 2 | Frontend read-model DTO unions must be checked against `backend/features/project_document/document.py`, not inferred from UI vocabulary. `fetchJson<T>` does not validate literals at runtime, so impossible frontend-only states can compile while valid backend states are excluded. | Phase 2 tightened `AssemblyType`, `AssemblyOrientation`, and `SpecificationStatus` to match the backend contract. | Add backend-derived schema/type generation or a DTO contract test before more Assembly Builder write phases accumulate. |
| 2026-05-27 | Phase 3 | Modal numeric editors need an in-modal IP/SI preference control because the page-level switcher is intentionally behind the modal backdrop. The active editor unit remains frozen until submit so typed values are not reinterpreted mid-edit. | Confirms the unit-switching contract in §5.12 for layer thickness, segment width, and stud spacing editors. | Reuse this modal-unit pattern for Phase 4 material physical-property editors where the active input must remain stable. |
| 2026-05-27 | Phase 4 | The Materials catalog query should be lazy-loaded from the material picker surface, not coupled to every Envelope page render. Otherwise read-only Assemblies and Specifications routes pick up an unrelated catalog dependency and tests/browser states become harder to reason about. | Confirms the picker is a command/edit affordance, while the envelope read model remains the source for project-material state. | Keep future catalog drift/refresh queries similarly scoped to surfaces that actually need catalog state. |
| 2026-05-27 | Phase 5 | V2 currently has no Honeybee package dependency, so the first HBJSON export pass hand-authors a Honeybee-compatible construction library shape while preserving V2 `ph_nav` metadata. This keeps export pure and testable but is not yet a strict Honeybee object-serialization guarantee. | §7.14 remains export-only and saved-version-only; export-shape parity needs an explicit hardening decision before release. | Browser-inspect downloaded HBJSON and decide whether to add a Honeybee serializer dependency or keep a documented V2-compatible construction-library schema. |
| 2026-05-27 | Phase 5 | Thermal preview status and HBJSON export rejection must be derived from the same issue records. Duplicating missing-material, missing-conductivity, broken-reference, or geometry checks lets preview and deliverable validation drift. | Treat backend thermal issue classification as the shared boundary for preview status, selectors, and export 422 paths. | Keep future thermal/cache/export additions behind the shared issue helpers before adding another status branch. |

Entry rules:

- Add a row when implementation exposes a non-obvious invariant,
  repeated failure mode, useful test fixture, rejected shortcut, or
  changed scope boundary.
- Do not add routine progress notes; phase plans own status.
- If a lesson changes the durable contract, update the relevant PRD
  section in the same pass and mention that section in
  `Contract Impact`.

## 15.2 Open Questions

No key product decisions require user input before implementation
planning. The defaults above are binding unless a later implementation
spike proves one of them technically wrong.

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
- Field-level override manager that recomputes/prunes
  `catalog_origin.local_overrides` after refresh.
- Partial HBJSON export that intentionally omits selected incomplete
  assemblies.
