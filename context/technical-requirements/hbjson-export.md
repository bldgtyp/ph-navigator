# HBJSON Window-Constructions Export — Contract

PH-Navigator V2 emits a Honeybee-Energy `WindowConstruction` JSON payload
for the Apertures table. The payload is consumed by Rhino / Grasshopper
component scripts through `honeybee_energy.construction.window.
WindowConstruction.from_dict`. The contract below is **stable** — any
change to identifier escaping, payload shape, or the hardcoded VT default
ships only as a **coordinated breaking-change release** that updates the
Rhino component side at the same time. PRD §17 + §21 decision 17 hold
the canonical decision; this doc is the reference Rhino / `honeybee_ph`
component authors cite when wiring `from_dict`.

## Endpoints

- REST: `GET /api/v1/projects/{project_id}/versions/{version_id}/apertures/hbjson?source=draft|version`
- MCP: `get_aperture_window_constructions(project_id, version_id, source?)`

Both return the same payload. `source=draft` resolves to the caller's
draft if present, falling back to the saved version body; `source=version`
always reads the saved body. Authentication is project-scoped view
access — Viewers can call REST; the browser export action is hidden for
Viewers in v1.

## Identifier escape rule

Each aperture-element identifier is built as:

    f"{escape(aperture_name)}_C{element.column_span[0]}_R{element.row_span[0]}"

The `escape` step is:

    re.sub(r"[^A-Za-z0-9_]", "_", raw)   # replace non-alphanumeric/underscore
    re.sub(r"_+", "_", cleaned)          # collapse runs
    cleaned.strip("_")                   # strip leading/trailing

Examples:

| Aperture name | `column_span[0]` | `row_span[0]` | Identifier         |
| ------------- | ---------------- | ------------- | ------------------ |
| `Door A`      | 0                | 0             | `Door_A_C0_R0`     |
| `CW01`        | 2                | 1             | `CW01_C2_R1`       |
| `Type B/2`    | 0                | 0             | `Type_B_2_C0_R0`   |

If escaping produces an empty string the request fails with HTTP 422
`aperture_hbjson_identifier_empty` and the offending raw name is
echoed in `details.raw`.

## Collision contract

If any two aperture-element identifiers escape to the same string and
come from **different** source aperture names, the request fails with
HTTP 422 `aperture_hbjson_identifier_collision` and `details.collisions`
names both source apertures:

```json
{
  "error_code": "aperture_hbjson_identifier_collision",
  "details": {
    "collisions": [{"escaped": "Door_A_C0_R0", "first": "Door A", "second": "Door-A"}]
  }
}
```

There is **no silent suffix-disambiguation**. The caller resolves the
collision by renaming one of the apertures.

## Per-construction payload shape

```json
{
  "Door_A_C0_R0": {
    "type": "WindowConstruction",
    "identifier": "Door_A_C0_R0",
    "materials": [
      {
        "type": "EnergyWindowMaterialSimpleGlazSys",
        "identifier": "Door_A_C0_R0_GlazSys",
        "u_factor": 0.9933,
        "shgc": 0.5,
        "vt": 0.6
      }
    ]
  }
}
```

Field mapping:

- `u_factor` — per-element composite ISO 10077-1 U-Value from the
  Apertures U-Value service (W/m²K, SI canonical), rounded to 4 dp.
- `shgc` — element's `glazing.g_value`, rounded to 4 dp. Falls back to
  `0.5` if `g_value` is null (V1 parity).
- `vt` — hardcoded `0.6`. Promotion to a real catalog field is a future
  scope decision tied to a `catalog_schema_version` bump.

The optional honeybee_energy `properties` / `display_name` / `user_data`
fields are intentionally omitted. honeybee_energy's `from_dict` treats
them as optional; including them with deterministic content would mean
shipping schema-version-coupled boilerplate, and including the honeybee
default would make the payload non-deterministic (the `properties.ref`
identifier is regenerated on every `to_dict` call). The minimal shape
is the long-lived contract.

## Cache behavior

The U-Value service backs every export through its content-hash + LRU
cache. The cache key excludes the element `name` and `operation` fields,
so renaming an element or toggling its operation type is a free cache
hit. Any change to dimensions, frame / glazing assignments, or the
override values invalidates the cache for that aperture.

## Test fixture

`backend/tests/fixtures/aperture_hbjson_export/v1_shape.json` pins the
payload for a reference 1000×1000 mm element with 80 mm frames
(U=1.0 W/m²K, Ψ_g=0.04 W/mK), glazing U=0.8 W/m²K, and null `g_value`.
`backend/tests/test_aperture_hbjson_export_service.py` asserts exact
equality. Any payload-shape change must update the fixture **and** the
PRD decision record.

## Future evolution

- VT field promotion to the glazing catalog — not yet scheduled.

The MCP semantic-write tools referenced in earlier drafts of this
roadmap (envelope and aperture commands) have shipped — see
`context/mcp.md` and `envelope-commands.md`. Manufacturer filters and
the refresh-from-catalog dialog have also shipped (see
`data-model.md` §7.4 and the `equipment.manufacturer_filters` table).

Future breaking changes coordinate with the Rhino / `honeybee_ph`
component side. The decision lives in PRD §17 / §21 decision 17.
