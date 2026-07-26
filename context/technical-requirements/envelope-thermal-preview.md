# Envelope Thermal Preview — Contract

The Assembly Builder shows a thermal preview (R-value and U-value)
alongside each assembly. The preview is **not** a certification output;
the construction resistance is the live PH-average of the ASHRAE
Fundamentals Ch. 25 Parallel-Path and Isothermal-Planes methods, plus the
surface films of the project's thermal standard (ISO 6946 by default),
computed entirely on the backend so the same numbers feed the canvas
header, MCP queries, and downstream pipelines.

The response carries **both** conventions — with films and without — because
they have different consumers; see "Two conventions, both reported" below.
Getting that distinction wrong double-counts the films in the PHPP export.

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
  "r_construction_m2k_w": <float | null>,
  "u_construction_w_m2k": <float | null>,
  "r_effective_m2k_w": <float | null>,
  "u_effective_w_m2k": <float | null>,
  "rsi_m2k_w": <float>,
  "rse_m2k_w": <float>,
  "heat_flow_direction": "upward" | "horizontal" | "downward",
  "thermal_standard": "iso_6946" | "ashrae",
  "warnings": ["<message>", ...]
}
```

The four film fields are **never null** — they depend only on the
assembly's `type` and `exterior_condition`, so they are reported even when
missing materials leave every R/U field null.

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
| `no_thermal_layers` | Every layer in the assembly is a membrane layer, so nothing contributes an R-value. Reported instead of letting the zero total fall through to `invalid_geometry`. |

`status.is_complete` is `true` iff `flags` is empty.

If a non-blocking flag (e.g. `missing_material` on one segment while
others are complete) leaves the calculation tractable, the preview
still returns R/U values plus the flag(s). Blocking flags
(`missing_conductivity`, `invalid_geometry`,
`broken_material_reference`, `no_thermal_layers`) suppress the numeric
fields.

## Membrane layers are excluded, not merely small

A layer whose every assigned segment carries a material in the
`membrane` category (WRBs, vapour-control layers, self-adhered
flashings, paints) takes no part in this calculation at all:
`thermal.is_membrane_layer` drops it from `_valid_segments` and exempts
it from the `missing_conductivity` check.

This is exclusion, not a near-zero contribution. Adding a WRB to an
existing assembly leaves its R and U **bit-identical** and cannot raise
a new flag. The justification is numerical negligibility plus
conservatism — 6-mil polyethylene is ~0.0005 m²K/W, four orders of
magnitude below a typical assembly — and it matches PHPP, which does
not enter membranes on the U-Values worksheet. Membranes still carry a
real `thickness_mm` and still count toward Total Thickness.

"Every assigned segment", not "any": a layer mixing a membrane with a
real material computes normally rather than silently dropping the
material's R. The category match is case- and whitespace-insensitive
because `ProjectMaterial.category` is a free string at the document
layer (a hand-entered material can carry any spelling).

## Surface films and boundary conditions

`backend/features/envelope/boundary_conditions.py` resolves a
deterministic `(Rsi, Rse, heat_flow_direction)` triple from three inputs:
`Assembly.type`, `Assembly.exterior_condition`, and the project's
`tables.assumptions.thermal_standard`.

The two boundary axes are not symmetric. The **interior** side is fully
determined by `type` — a roof loses heat upward, a floor downward, a wall
horizontally — so it is derived, never stored and never separately
editable. The **exterior** side is the one user-selectable axis.

### Where the values come from

`tables.assumptions.thermal_standard` selects the set:

| Standard | Values live | Why |
|----------|-------------|-----|
| `iso_6946` (default) | **in code** (`boundary_conditions.ISO_6946_TABLE`) | the default, already published in this feature's PRD, and it means a deployment with no private object store still computes U-values |
| `ashrae` | **private object store only** (`standards/ashrae/surface_films.json`) | ASHRAE Fundamentals is licensed and this repo is public — the repo carries the loader (`features/envelope/surface_film_store.py`, `scripts/seed_surface_films.py`), never the numbers. Same route as the licensed climate bundles (`DATA_STORAGE.md` class ④) |

Asking for a standard with no published table raises rather than falling
back to ISO values — reporting one convention under another's name would
be a wrong answer confidently presented. The thermal route surfaces that
as a typed **409 `surface_film_table_unavailable`**, which an operator
fixes by seeding the table.

The table is resolved at the **service edge**, not inside `thermal.py`, and
passed in as a `SurfaceFilmTable`. That keeps the calculation pure and
avoids an import cycle through the storage layer.

ISO 6946 values (PHPP's U-Values worksheet is ISO 6946-based and PHI
reviewers work in ISO, so this is the sensible default):

| `type` | heat flow | Rsi |
|--------|-----------|-----|
| `roof` | upward | 0.10 |
| `wall` | horizontal | 0.13 |
| `floor` | downward | 0.17 |
| `other` | horizontal | 0.13 |

| `exterior_condition` | Rse |
|----------------------|-----|
| `outdoor_air` | 0.04 |
| `ventilated` | = Rsi (ISO 6946 §6 treats a well-ventilated exterior face as internal) |
| `ground` | 0 |
| `unconditioned_space` | = Rsi |

`ventilated` and `unconditioned_space` are film-identical today and are
still separate values: they mean different things, and the distinction
cannot be recovered by a later migration once assemblies are labelled.

These films are **not** the `air_*` catalog materials — those are air
*cavities* inside the construction with an equivalent conductivity.

`ISO_13788_SURFACE_CHECK_RSI = 0.25` is held in the same module for the
condensation screen's surface-condensation / mould / fRsi criteria. It is
never used in a U-value.

### Two conventions, both reported

`r_effective_m2k_w` / `u_effective_w_m2k` **include the films**:
`R_effective = Rsi + R_construction + Rse`. The films add in series with
the PH average, not inside each parallel path, so
`r_parallel_path_m2k_w` and `r_isothermal_planes_m2k_w` stay
construction-only and comparable.

`r_construction_m2k_w` / `u_construction_w_m2k` are the bare material
stack — the PH average of the two methods, with no films.

| Consumer | Uses | Why |
|----------|------|-----|
| Assembly Builder header + tooltip | effective | it is the real U-factor |
| **PHPP U-Values export** | **construction-only** | the worksheet declares `Rsi: 0.00` / `Rse: 0.00` and adds its own films from its own assembly-type setting — sending the effective value double-counts them |
| HBJSON export | neither | it emits material layers; honeybee/EnergyPlus compute their own |

That split is enforced by **types, not discipline**. `thermal.py` exposes
two entry points:

- `calculate_construction_thermal()` → `ConstructionThermalResult`, which
  has no film or effective field on it at all. Film-free consumers call
  this, so reaching for the wrong number is not something a caller can do.
- `calculate_assembly_thermal()` → `ThermalResult`, which wraps the above
  and adds the films. This is what the route returns.

A new consumer that must not double-count films should take
`ConstructionThermalResult`.

> **This changed on 2026-07-26** (`assembly-boundary-conditions` Phase 2).
> Before it, the header reported the construction-only value and its
> tooltip said so. Every displayed number moved: IP R up, SI U down, by
> ~4 % on a good assembly and ~15 % on a poor one. The
> `#assembly-thermal-metric` tooltip was rewritten in the same change and
> is the user-facing announcement.

## `warnings`

User-facing prose for each flag, sorted deterministically. The
frontend renders these directly under the R/U readout when
`is_complete` is false. Source of truth:
`thermal.thermal_warning_messages`.

## `input_hash`

`input_hash` is a SHA-256 of (assembly subtree + referenced material
physics fields + the thermal standard). It exists so the frontend can
cache the preview by identity:

- Identical inputs → identical hash.
- Conductivity, density, specific heat, emissivity changes →
  different hash.
- Material **category** changes → different hash. Category is a physics
  input here, not a display field: it is what makes a layer a membrane
  and therefore excluded from the R sum.
- Layer thickness, segment width, orientation, layer order changes →
  different hash.
- `exterior_condition` and `type` changes → different hash (both are
  inputs to the surface films).
- `tables.assumptions.thermal_standard` changes → different hash. It is
  not part of the assembly subtree, so it is hashed explicitly; without
  that, switching the standard would serve stale cached previews.
- Material **name**, color, source URL, comments, `specification_status`
  changes → **same hash** (display fields, not physics).
- Catalog-origin metadata changes → same hash (provenance, not
  physics).

The hash is opaque to consumers; rely on equality, not on internal
structure.

## See also

- `backend/features/envelope/thermal.py` — implementation.
- `backend/features/envelope/boundary_conditions.py` — surface films and
  heat-flow direction.
- `backend/tests/envelope/test_envelope_boundary_conditions.py` — the
  ISO 6946 table, pair-by-pair.
- `backend/tests/envelope/test_envelope_thermal_and_export.py` —
  contract tests (`test_thermal_*`, `test_assembly_thermal_*`).
- `context/technical-requirements/envelope-hbjson-export.md` — the
  same flag vocabulary drives the export 422 payload.
