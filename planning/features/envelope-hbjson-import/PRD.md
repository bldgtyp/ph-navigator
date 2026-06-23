---
DATE: 2026-06-23
TIME: 17:17 EDT
STATUS: Research / design outline — pre-phasing
AUTHOR: Ed (via Claude)
SCOPE: Design research for Envelope HBJSON Import. Synthesizes the export
  pipeline, the V2 document/command model, the catalog matching machinery, and
  the V1 precedent into a proposed design + open decisions.
---

# Envelope HBJSON Import — PRD / Design Research

## 0. Confirmed decisions (2026-06-23)
- **D1 — both sources in v1.** Accept PHN-native files **and** raw Honeybee-PH
  constructions (see §2A/§2B, §5, §7). Foreign support is *not* deferred.
- **D2 — export enhancement is Phase 0.** Additive `ph_nav` fields (§4).
- **D4 — unmatched materials are project-only** (`catalog_origin = null`); no
  auto-write to the global catalog.

## 1. Problem

Envelope → Assemblies has **Download constructions HBJSON** (`hbjson_export.py`,
GET `…/envelope/export/hbjson`). We want the inverse: **Upload constructions
HBJSON** in the same "…" Assembly-actions menu, so users can re-import a file or
copy assemblies between projects. The hard part is **materials**: each incoming
layer references a material that must be matched to one already in the project,
matched to the shared catalog, or created — and the user must be told clearly
which happened, before anything is committed.

## 2A. The PHN-native file is a round-trip format (not a Honeybee model)

Confirmed against the attached example
(`envelope-constructions-69151a59-…hbjson`, 8 constructions, 10 materials):

```
{
  "type": "PHNavigatorOpaqueConstructionLibrary",
  "schema_version": 11,                       // == ProjectDocumentV1.schema_version
  "ph_nav": { "export_type": "envelope_constructions",
              "project_material_ids_are_stable": true },
  "constructions": { "<identifier>": { OpaqueConstruction … } }
}
```

`export_hbjson_constructions(body)` builds this dict **by hand** — it does **not**
import honeybee. So the importer can `json.loads` and map straight into our
Pydantic models. No honeybee runtime dependency, no `dict_to_object`. (This is
the big simplification vs. V1, which round-tripped through live honeybee
objects.)

Each construction is `{type, identifier, display_name, properties, materials[]}`.
Each entry in `materials[]` is one **layer** rendered as an `EnergyMaterial`:

| HBJSON layer field | Source (`hbjson_export._energy_material_payload`) | → import target |
| --- | --- | --- |
| `thickness` (m) | `layer.thickness_mm / 1000` | `AssemblyLayer.thickness_mm` (×1000) |
| `conductivity` | `material.conductivity_w_mk` (or computed for hybrids) | `ProjectMaterial.conductivity_w_mk` |
| `density` / `specific_heat` | `material.density_kg_m3` / `specific_heat_j_kgk` | same |
| `thermal/solar/visible_absorptance` | all three = `material.emissivity` | `emissivity` (read any one) |
| `roughness` | hardcoded `"MediumRough"` | ignore |
| `properties.ph.ph_color` | `material.color` | `color` |
| `properties.ph.divisions` | hybrid layer → segments (see §3) | layer segments |
| `properties.ref.ref_status` | `material.specification_status` | `specification_status` |
| `properties.ref.document_refs[].asset_id` | `material.datasheet_asset_ids` | datasheet ids (round-trip only) |
| `ph_nav.project_material_id` | `material.id` (`pmat_*`) | match key #1 |
| `ph_nav.catalog_origin` | `material.catalog_origin` (full `CatalogOrigin`) | match key #2 / re-pick source |

## 2B. The raw Honeybee-PH path (foreign source)

Files straight from Grasshopper carry no `ph_nav`/`catalog_origin` wrapper. Shapes:
- a single `OpaqueConstruction` dict (top-level `"type"` present),
- a name-keyed **group** of objects (honeybee "dump objects" format), or
- a full `Model` whose `properties.energy.constructions` we sift for opaque ones.

Parse via the **honeybee-ph library** (already a backend dep:
`honeybee-ph>=1.33.19`, `ladybug-core`), mirroring V1:
`honeybee.dictutil.dict_to_object` → fall back to
`honeybee_energy.dictutil.dict_to_object`; keep only `OpaqueConstruction`; drop
`EnergyMaterialNoMass`/air layers with a warning. Read each layer's
`properties.ph.divisions` for the same homogeneous / heterogeneous-cell /
steel-stud decomposition as §3 — that grid format is exactly what our export
borrowed, so the cell→segment logic is shared. Materials become `ProjectMaterial`
from the HB `EnergyMaterial` fields (thickness lives on the material; conductivity
/ density / specific_heat direct; any absorptance → `emissivity`; roughness
ignored; `properties.ph.ph_color` → `color`). Matching uses the name/property
rungs of §5; `assembly.type` defaults to `"other"` (user sets it in the preview;
optional heuristic from `W_`/`R_`/`F_` identifier prefixes).

Both paths normalize into one **planned-import IR** (constructions + per-layer
segments + per-material match decisions); §5–§6 then apply identically.

## 3. Hybrid (heterogeneous / steel-stud) layers

A V2 layer with >1 side-by-side segment is exported as a single "Hybrid"
`EnergyMaterial` whose `properties.ph.divisions` carries the cells:

```
divisions: {
  row_heights: [1.0],
  column_widths: [w_m, …],          // segment widths in meters
  is_a_steel_stud_cavity: bool,     // from any segment.steel_stud_spacing_mm
  steel_stud_spacing_mm: float|null,
  cells: [ { column_width, row_height,
             material: { …EnergyMaterial… },
             ph_nav: { segment_id: "seg_*" } }, … ]
}
```

Import reverses this: one **segment per cell**, `width_mm = column_width*1000`,
`project_material_id` from the cell material. The parent "Hybrid" identifier
embeds the layer id (`Hybrid_lyr_8qebldpbc0sx`) and its `conductivity` is a
**computed area-weighted average** — discard it and rebuild from the cells.
A single-cell layer is a homogeneous layer → one segment.

> V1 raised `NotImplementedError` for `row_count > 1`. Our export only ever
> emits `row_heights: [1.0]`, so v1 import can assume a single row and reject
> multi-row as malformed.

## 4. What the export LOSES — required additive enhancements (answers Ed's Q2)

Because we own the format, the cleanest fix is to **enrich the export** (purely
additive — old files still import via the defaults below). The current file
drops these:

| Lost field | Today | Proposed export add | Import default if absent |
| --- | --- | --- | --- |
| `assembly.id` | only in identifier on name-collision | `construction.ph_nav.assembly_id` | mint new / match by name |
| `assembly.type` (wall/floor/roof/other) | **not exported** | `construction.ph_nav.assembly_type` | `"other"` (or ask) |
| `assembly.orientation` | **not exported** (layers normalized outside→inside) | `construction.ph_nav.orientation` | `first_layer_outside` (canonical) |
| `layer.id` | only for hybrids | layer `ph_nav.layer_id` | mint new |
| `segment.id` (homogeneous) | only for hybrids (`segment_id`) | layer `ph_nav.segment_id` | mint new |
| `segment.is_continuous_insulation` | **not exported** | per-segment `ph_nav.is_continuous_insulation` | `false` |

`segment.use_site_notes` / `photo_asset_ids` stay out (install-time data, not
design intent). `datasheet_asset_ids` round-trip only within the same project
(asset ids are project-scoped); on cross-project import they are dropped.

**Design stance:** ship the export enhancement as Phase 0 of this feature so
every file produced from now on round-trips losslessly; keep the importer
tolerant of files that lack the new fields (the "default if absent" column).

## 5. Material matching ladder (the core)

One unified ladder; run per incoming material, stop at first hit. The early
**id-based** rungs fire for PHN-native files (§2A); the later **name/property**
rungs carry the raw Honeybee-PH path (§2B) and V1's name fallback. Reuses
`pick_catalog_material`'s existing dedup-by-`rec*`.

1. **By project material id** — `ph_nav.project_material_id` (native) or a
   honeybee-energy-ref `external_identifiers.ph_nav` (foreign) that exists in
   `body.tables.project_materials` → **reuse**.
2. **By catalog record id (in-project)** — a project material already has the
   same `catalog_origin.catalog_record_id` → **reuse** that copy. (Exactly the
   `pick_catalog_material` check; >1 match = ambiguous → flag in preview.)
3. **By catalog record id (global catalog)** — `catalog_record_id` resolves to
   an active row in `catalog_materials` → **pick from catalog**
   (`project_material_from_catalog(row)`): a new `ProjectMaterial` with
   `catalog_origin`, fresh `pmat_*`, snapshotting the catalog's current values.
4. **By name (± property tolerance) in-project** — foreign material whose name
   matches an existing project material → **reuse**, flagged in preview.
5. **By name (± property tolerance) in global catalog** — → **pick from
   catalog** (as #3). Fuzzy by nature → always surfaced for user confirmation.
6. **Create hand-entered (project-only, D4)** — no usable link/match → new
   `ProjectMaterial` with `catalog_origin = null`, copying the file's thermal
   props + color. `specification_status` carries the file's value if valid, else
   `"missing"`. **No** write to the global catalog.

**Intra-file dedup:** native files share one `pmat_*` per distinct material;
foreign files share material objects by reference/identifier. Collapse by
(source id → `catalog_record_id` → normalized name+props) so each distinct source
yields **one** project material, not one per layer.

**Do not silently overwrite** an existing project material that has
`local_overrides` — reuse it and note the value divergence in the preview
(parallels the refresh-from-catalog drift model). Name/property matches (#4–#5)
are the "tough" part Ed flagged; the preview + per-item override is the
mitigation against false positives.

## 6. Proposed flow: preview → confirm (safety-first)

Ed asked for "clear UI informing the user." Two-step, so nothing is written
until the user sees the plan:

**Step 1 — Preview (dry run, no mutation).**
`POST …/envelope/import/hbjson/preview` (multipart file, `ProjectEditAccess`).
Parse + validate + run the matching ladder against the current draft body and
catalog. Return a structured **plan**:

- Per construction: `new` | `replace <assembly>` (id/name match) | `name-collision`,
  with a default action and editable choice.
- Per material: `reuse-in-project` | `pick-from-catalog` | `name-match` |
  `create-new` | `conflict` (ambiguous / drifted / catalog-deleted), with counts.
  Name/property matches (§5 #4–#5) are shown as suggestions the user can accept
  or override per item.
- For foreign constructions: an editable `assembly.type` per construction
  (default `"other"`, optional `W_/R_/F_` prefix heuristic).
- Warnings: schema_version mismatch, malformed cells, multi-row divisions,
  dropped datasheets (cross-project), non-opaque/no-mass layers skipped.

**Step 2 — Apply (atomic).** User confirms → `POST …/draft/envelope/commands`
with a new discriminated-union command (e.g. `import_envelope_constructions`,
`kind="import_envelope_constructions"`) carrying the file (or the normalized
plan + per-construction resolutions). It runs the same matching server-side and
performs **one** `ops.replace_project_materials` + `ops.replace_assemblies`,
re-validates `ProjectDocumentV1`, writes the draft, and logs the action — all on
the existing `apply_envelope_command` rail (ETag-guarded, audited). Returns the
standard `EnvelopeReadResponse`. The user then Saves a Version as usual.

This matches the existing **catalog JSON import preview** precedent
(`features/catalogs/materials/import_export/pipeline.py::build_preview`, partition
into matched/new, skip-on-match) and the report-status-chip UI Ed prefers.

### Construction name/id collision policy
Per construction in the preview, choose **Add new** / **Replace existing** /
**Skip**. Default heuristic: `assembly_id` (from the enriched export) matches an
existing assembly → default **Replace**; otherwise **Add new** (auto-suffix the
name if it collides, e.g. `… (imported)`). Never silently overwrite. (V1
overwrote-in-place unconditionally; we make it a visible, per-item choice.)

## 7. Backend seams (what exists vs. what's new)

**Reuse as-is:**
- `envelope_models.{Assembly,AssemblyLayer,AssemblySegment,ProjectMaterial,CatalogOrigin}` — no schema change.
- `identifiers.new_id(prefix)` for fresh `asm_/lyr_/seg_/pmat_` ids.
- `commands/materials.{project_material_from_catalog, pick_catalog_material}` dedup-by-`rec*` logic.
- `catalogs/materials/repository.get_material(conn, rec_id)` for catalog lookup.
- `ops.replace_assemblies` / `ops.replace_project_materials` as the bulk write seam.
- `service.apply_envelope_command` pipeline (ETag, draft upsert, `log_document_action`, `EnvelopeReadResponse`).
- `thermal.thermal_issues` for non-blocking validation surfaced in the preview.

**Reuse for the foreign path (§2B):**
- `honeybee-ph` / `honeybee_energy` `dictutil.dict_to_object` to deserialize raw
  constructions (already a backend dep; same approach as V1).

**New:**
- `hbjson_import.py` — **two front-ends → one planned-import IR**: (A) reverse
  `hbjson_export.py` for `PHNavigatorOpaqueConstructionLibrary`; (B) honeybee-ph
  parse + layer→segment decomposition for raw constructions. Then the shared
  matching ladder (§5) producing per-construction + per-material decisions.
- `commands/envelope_import.py` — `ImportEnvelopeConstructionsCommand` handler
  `(conn, body, command) -> ProjectDocumentV1`, wired into the command registry
  / `EnvelopeCommand` union.
- Two routes: `…/envelope/import/hbjson/preview` (dry run) and the command POST
  for apply (existing endpoint, new command kind).
- Export enhancement in `hbjson_export.py` (§4) + bump/extend the `ph_nav` blocks.

**Frontend:**
- New `AppMenuItem` "Upload constructions HBJSON" beside the existing Download
  item in `EnvelopePage.tsx`; hidden `<input type=file accept=".hbjson,.json">`.
- `api.uploadEnvelopeHbjsonPreview` + `useEnvelopeHbjsonImport*` hooks (mirror
  `downloadEnvelopeHbjson` / `useEnvelopeHbjsonExportMutation`).
- A preview/confirm modal (matched/new/conflict summary using report-status
  chips) → on confirm, fire the command and invalidate the envelope query.

## 8. Validation & atomicity
- Parse + match + validate the **whole** file before any write; one draft
  mutation, all-or-nothing (V1 committed per-construction and could half-apply).
- Import does **not** block on thermal incompleteness (unlike export, which 422s)
  — incomplete assemblies are legal in a draft; surface issues in the preview.
- Reject up front: wrong `type`, unreadable JSON, `schema_version` > current,
  multi-row divisions, segment material referencing a missing cell material.

## 9. V1 precedent — keep vs. drop
**Keep (as concepts):** id-first / catalog-second matching; collapse duplicate
construction names instead of duplicating; aggregate a materials report.
**Drop (obsolete in V2):** SQLAlchemy ORM + per-construction commits; live
honeybee object round-trip; AirTable-as-catalog assumptions; hard-400 abort with
no UI feedback; create-nothing-if-missing. V2 improves all of these via the
JSONB document + command pipeline + preview UX.

## 10. Out of scope / future
- Promote imported hand-entered materials into the global `catalog_materials`
  table (decisions.md D4) — separate explicit user action, later.
- Importing apertures/window constructions (this file is opaque-only).
- A full HB `Model` import bringing geometry/zones (we only sift its opaque
  constructions, not the building).
