# Envelope Thermal Preview — Contract

The Assembly Builder shows a construction-only thermal preview (R-value
and U-value) alongside each assembly. The preview is **not** a
certification output; it is the live PH-average of the ASHRAE
Fundamentals Ch. 25 Parallel-Path and Isothermal-Planes methods,
computed entirely on the backend so the same numbers feed the canvas
header, MCP queries, and downstream pipelines.

This doc describes the user-facing contract. The math sits in
`backend/features/envelope/thermal.py`.

## Endpoint

- REST: `GET /api/v1/projects/{project_id}/versions/{version_id}/envelope/assemblies/{assembly_id}/thermal?source=draft|version`

`source=draft` resolves to the caller's draft if present, falling back
to the saved version body; `source=version` always reads the saved
body. Authentication is project-scoped view access.

## Response shape

```json
{
  "project_id": "...",
  "version_id": "...",
  "source": "draft" | "version",
  "assembly_id": "...",
  "input_hash": "<sha256 hex>",
  "status": {
    "is_complete": <bool>,
    "flags": ["<flag>", ...]
  },
  "r_parallel_path_m2k_w": <float | null>,
  "r_isothermal_planes_m2k_w": <float | null>,
  "r_effective_m2k_w": <float | null>,
  "u_effective_w_m2k": <float | null>,
  "warnings": ["<message>", ...]
}
```

All R/U values are SI-canonical (m²·K/W and W/m²·K respectively). When
geometry or material data is missing, R/U fields are `null` and the
relevant flag(s) appear in `status.flags`.

## Methods and PH-average

For each assembly with complete material assignments:

- **Parallel-Path** (`_calculate_parallel_path_r_value`) — cross-product
  of segment paths across layers; aggregated by area-fraction-weighted
  U-value, inverted to R.
- **Isothermal-Planes** (`_calculate_isothermal_planes_r_value`) — each
  layer reduced to an equivalent R from valid segment width fractions,
  summed in series.

`r_effective_m2k_w` is the simple arithmetic mean of the two. This is
the standard PH-construction preview policy: a single number that
brackets the two ASHRAE bounds.

Citation: ASHRAE Fundamentals Ch. 25 §4 (Series and Parallel Heat
Flow). The PH-average is the construction-preview convention used in
WUFI-Passive and PHPP construction sheets.

## Flag vocabulary

Each flag describes a user-actionable problem.

| Flag | When it fires |
|------|---------------|
| `missing_material` | A segment has no `project_material_id`. |
| `missing_conductivity` | An assigned material has a null or non-positive `conductivity_w_mk`. |
| `invalid_geometry` | A layer's `thickness_mm <= 0`, a segment's `width_mm <= 0`, or `steel_stud_spacing_mm <= 0`. |
| `broken_material_reference` | A segment points at a `project_material_id` not present in `tables.project_materials`. Defensive — the document validator rejects this at save time, so it is unreachable via the route in normal flow; the flag exists for direct-call defense in depth. |

`status.is_complete` is `true` iff `flags` is empty.

If a non-blocking flag (e.g. `missing_material` on one segment while
others are complete) leaves the calculation tractable, the preview
still returns R/U values plus the flag(s). Blocking flags
(`missing_conductivity`, `invalid_geometry`,
`broken_material_reference`) suppress the numeric fields.

## `warnings`

User-facing prose for each flag, sorted deterministically. The
frontend renders these directly under the R/U readout when
`is_complete` is false. Source of truth:
`thermal.thermal_warning_messages`.

## `input_hash`

`input_hash` is a SHA-256 of (assembly subtree + referenced material
physics fields). It exists so the frontend can cache the preview by
identity:

- Identical inputs → identical hash.
- Conductivity, density, specific heat, emissivity changes →
  different hash.
- Layer thickness, segment width, orientation, layer order changes →
  different hash.
- Material **name**, color, source URL, comments, `specification_status`
  changes → **same hash** (display fields, not physics).
- Catalog-origin metadata changes → same hash (provenance, not
  physics).

The hash is opaque to consumers; rely on equality, not on internal
structure.

## See also

- `backend/features/envelope/thermal.py` — implementation.
- `backend/tests/envelope/test_envelope_thermal_and_export.py` —
  contract tests (`test_thermal_*`, `test_assembly_thermal_*`).
- `context/technical-requirements/envelope-hbjson-export.md` — the
  same flag vocabulary drives the export 422 payload.
