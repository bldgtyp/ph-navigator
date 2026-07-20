# HBJSON Opaque-Construction Export — Contract

PH-Navigator V2 emits a Honeybee-Energy-compatible `OpaqueConstruction`
JSON payload for the Assembly Builder. The payload is consumed by
Rhino / Grasshopper component scripts and downstream PHX/PHPP/WUFI
pipelines. The contract below is **stable** — any change to identifier
escaping, payload shape, or the hybrid-layer `divisions.cells` schema
ships only as a coordinated breaking-change release that updates the
consumer side at the same time. This doc is the reference for any
consumer wiring `from_dict`-style readers against the payload.

The parallel apertures contract lives in `hbjson-export.md`.

## Endpoint

- REST: `GET /api/v1/projects/{project_id}/versions/{version_id}/envelope/export/hbjson`

The export **always reads the saved version body**, never the draft.
Callers viewing a dirty draft see a UI warning before the request fires
(see `EnvelopePage.tsx` `exportHbjson()` and US-ENV-12). This is a
deliberate PRD §15 policy: the export is a saved-version deliverable.

Authentication is project-scoped view access.

## Payload type

Top-level response shape:

```json
{
  "type": "PHNavigatorOpaqueConstructionLibrary",
  "schema_version": <int>,
  "ph_nav": {
    "export_type": "envelope_constructions",
    "project_material_ids_are_stable": true
  },
  "constructions": {
    "<assembly_identifier>": { "type": "OpaqueConstruction", ... }
  }
}
```

`project_material_ids_are_stable` signals to consumers that
`external_identifiers.ph_nav` and `ph_nav.project_material_id` round-trip
across exports — safe to use as a join key in downstream pipelines.

## Construction payload

Per assembly:

```json
{
  "type": "OpaqueConstruction",
  "identifier": "<cleaned-name or cleaned-name_<assembly_id>>",
  "display_name": "<assembly.name>",
  "properties": {
    "type": "OpaqueConstructionProperties",
    "ph": { "type": "OpaqueConstructionPhProperties" }
  },
  "ph_nav": {
    "assembly_id": "<asm_id>",
    "assembly_type": "wall | floor | roof | other",
    "orientation": "first_layer_outside | last_layer_outside"
  },
  "materials": [ ... layer materials, outside → inside ... ]
}
```

The construction-level `ph_nav` block carries the assembly fields the
Honeybee shape cannot express (`type`, `orientation`) plus the native
`assembly_id`. These are **additive round-trip fields** — Honeybee
consumers ignore the `ph_nav` key, while the inverse import
(`envelope-hbjson-import`) reads them to re-create the assembly
losslessly. Same for the per-layer/segment `ph_nav` fields below.

## Identifier rules

`_clean_identifier(value)`:

```
re.sub(r"[^A-Za-z0-9_]+", "_", value.strip())
re.sub(r"_+", "_", cleaned).strip("_")
# empty → "unnamed"
```

- Applied to every emitted identifier (assembly, material).
- Material identifier: `f"{cleaned(material.name)}_{material.id}_{thickness_mm/25.4:.1f}in"`.
  Imperial thickness in the identifier is the Honeybee convention; the
  payload still carries SI `thickness` in meters.
- Hybrid-layer identifier: `f"Hybrid_{layer.id}"` (cleaned).

### Assembly name disambiguation

If multiple assemblies share the same cleaned name, every colliding
identifier is suffixed with `_{assembly_id}`. Non-colliding identifiers
stay un-suffixed. Implementation: `_unique_assembly_identifiers`.

## Layer ordering

Per assembly:

- Layers are sorted by `order`.
- If `assembly.orientation == "first_layer_outside"`, the emitted
  `materials[]` order is the document order (outermost first).
- If `assembly.orientation == "last_layer_outside"`, the order is
  reversed before emission.

Consumers can rely on `materials[0]` being the **outside** layer.

Implementation: `assembly.layers_outside_to_inside()` (method on
`Assembly`, `backend/features/project_document/envelope_models.py`).

## Single-segment vs hybrid layers

Single-segment layers emit a flat `EnergyMaterial` payload.

Multi-segment (hybrid) layers emit a wrapper `EnergyMaterial` whose:

- `conductivity` is the width-weighted average of the segment
  conductivities (equivalent-layer conductivity for downstream tools
  that do not understand hybrids).
- `display_name` is the deduplicated segment-material names joined by
  `" + "`.
- `properties.ph.divisions` carries the schema below.

### `properties.ph.divisions` schema

```json
{
  "row_heights": [1.0],
  "column_widths": [<segment_width_m>, ...],
  "is_a_steel_stud_cavity": <bool>,
  "steel_stud_spacing_mm": <float | null>,
  "cells": [
    {
      "column_width": <segment_width_m>,
      "row_height": 1.0,
      "material": { ...EnergyMaterial for the segment material... },
      "ph_nav": {
        "segment_id": "<seg_id>",
        "is_continuous_insulation": <bool>,
        "steel_stud_spacing_mm": <float | null>
      }
    },
    ...
  ]
}
```

Segments are sorted by `order` before emission. `column_widths` is
authoritative for cell layout; `column_width` on each cell repeats the
value so a consumer reading only `cells[]` is self-sufficient. The
hybrid wrapper `EnergyMaterial` also carries `ph_nav.layer_id`; the
per-cell `ph_nav` carries the segment identity (round-trip fields).

## Material reference status

Every emitted `EnergyMaterial` carries
`properties.ref` (`EnergyMaterialRefProperties`):

```json
{
  "type": "EnergyMaterialRefProperties",
  "external_identifiers": { "ph_nav": "<project_material_id>" },
  "ref_status": "<specification_status>",
  "document_refs": [{ "asset_id": "<asset_id>" }, ...]
}
```

- `ref_status` mirrors the project material's `specification_status`,
  translated to the Honeybee token set by
  `envelope/honeybee_specification_status.py`: internal `needed` exports as
  `missing` here (and as `MISSING` in the rich Honeybee/GH export), because
  installed `honeybee_ref` accepts only `COMPLETE | MISSING | QUESTION | NA`.
- `document_refs` lists every `datasheet_asset_id` attached to the
  project material, in document order. Asset IDs are stable, in-project
  references; resolving them to URLs is the consumer's job.

The top-level `ph_nav` block on each emitted material also carries
`project_material_id` and a deep-cloned `catalog_origin` (or `null`).
Consumers needing catalog provenance read it from there.

For a **single-segment (homogeneous) layer** — where the layer is
rendered directly as one `EnergyMaterial` — that same material `ph_nav`
block additionally carries the layer/segment identity the import needs:
`layer_id`, `segment_id`, `is_continuous_insulation`, and
`steel_stud_spacing_mm`. (Hybrid layers
keep this identity on the wrapper and cell `ph_nav` blocks instead, since
their materials map to individual segments.)

## Error response

If any assembly has a `thermal_issues` flag — `missing_material`,
`missing_conductivity`, `invalid_geometry`, `broken_material_reference`
— the export returns HTTP 422:

```json
{
  "error_code": "envelope_export_incomplete",
  "detail": "Envelope assemblies need complete material assignments and conductivity before HBJSON export.",
  "details": {
    "errors": [
      {
        "code": "<flag>",
        "path": "tables.assemblies[<assembly_id>].layers[<layer_id>].segments[<segment_id>]",
        "assembly_id": "...",
        "assembly_name": "...",
        "layer_id": "...",
        "layer_order": <int>,
        "segment_id": "..." | null,
        "segment_order": <int> | null
      },
      ...
    ]
  }
}
```

`path` is a stable JSON-pointer-ish locator the frontend uses to focus
the offending segment.

## Explicitly deferred: steel-stud cavity semantics

The hybrid-layer `divisions` block emits `is_a_steel_stud_cavity` and
`steel_stud_spacing_mm` whenever any segment in the layer carries a
`steel_stud_spacing_mm`. **The semantics of those fields — including
whether `R_SE`/`R_SI` corrections live in this contract or in the
downstream PHX side — are intentionally undocumented at this layer
pending a separate review** (Q-AB-1, deferred 2026-06-07). Consumers
relying on steel-stud specifics should treat them as preview-only until
that review lands.

This omission is deliberate, not accidental.

## See also

- `backend/features/envelope/hbjson_export.py` — implementation.
- `backend/tests/envelope/test_envelope_thermal_and_export.py` —
  contract tests (`test_hbjson_export_*`).
- `planning/archive/user-stories/20-envelope.md` US-ENV-12 — user-facing
  contract.
- `context/technical-requirements/envelope-thermal-preview.md` —
  flag vocabulary that drives the 422 payload.
