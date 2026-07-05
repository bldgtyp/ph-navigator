# Client Handoff: GH Data API (`/api/v1/gh`)

```
DATE:    2026-07-05
TIME:    15:40
STATUS:  Active — backend 01–03 shipped; input for Phases 04–05 (GH client)
AUTHOR:  Claude (with Ed)
SCOPE:   Endpoint + schema reference for the honeybee_grasshopper_ph_plus
         components that consume the V2 read API (Phases 04–05).
RELATED: PRD.md (contract), decisions.md (O1–O7), phases/phase-04*, phase-05*
```

Everything below is the **live contract** as built on `feature/gh-data-api`.
Backend source of truth: `backend/features/gh_api/`. This is the read-only
surface — there is no push/write from GH (D6).

## Base URL & conventions

- **Prod:** `https://api.ph-nav.com/api/v1/gh/projects/{bt_number}`
- **Local dev:** `http://localhost:8000/api/v1/gh/projects/{bt_number}`
- `{bt_number}` is the user-facing key (e.g. `2524`), **not** a UUID.
- All routes **GET**, all **single-encoded JSON** (no V1 string-in-JSON double
  encoding — one `json.loads` per response).
- **Anonymous is allowed.** Optionally send `Authorization: Bearer phn_mcp_…`.
  If you send a token: invalid/expired/revoked → **401**; valid but scoped to a
  different project → **403**. No token → anonymous read (works today).
- **Rate limited** per client IP (default 30/min) → **429** over budget.
- IronPython 2.7 client constraints (see PRD §2): `System.Net.WebClient`, force
  **TLS 1.2** client-side, GET + simple headers only, one `json.loads`, no
  `offset` loop (the V1 `offset` vestige is gone).

## Common response envelope (every route)

```json
{
  "schema_version": 1,
  "project": { "bt_number": "2524", "project_id": "<uuid>", "name": "…" },
  "version_id": "<uuid>",
  "last_modified": "2026-07-05T16:00:00Z",
  "<payload key(s) per route>": …
}
```

- `schema_version` is the **GH wire-contract version** (currently `1`), NOT the
  document schema version. Validate it in the client and fail friendly if the
  server moves ahead of the plugin.
- `last_modified` = the version's save timestamp, UTC ISO-8601 with `Z`,
  **byte-stable per version**. **Key change-detection on `version_id` /
  `last_modified`, never on payload bytes** — rich payloads carry generated ids
  and are not byte-deterministic.

## Version pinning

- Every **data** route accepts `?version=<version_id>`; omit it → the project's
  **active** (latest) saved version. **Saved versions only — never drafts** (D3).
- Unknown/foreign version id, or a project with no saved versions → **404**.
- Discover version ids from the resolver route (below).

## Routes

### 1. `GET /` — resolver / metadata

Envelope + `versions: [ { version_id, saved_at, name, kind } ]`, **newest
first**. `kind` ∈ `working | submitted | closed | snapshot`. Use to list
saved versions for the `?version=` pin (certification-archive use case).

### 2. `GET /constructions/hbjson` — opaque constructions (RICH)

Payload key **`hb_constructions`**: `{ "<assembly name>": OpaqueConstruction.to_dict() }`.

- Client: `OpaqueConstruction.from_dict(payload["hb_constructions"][name])` per
  entry. Round-trips **PhColor**, division grid, `honeybee_energy_ref`
  datasheet/photo refs, and the `ph_nav` external id.
- Material identifier carries the V1 IP-thickness suffix: `"{name} [ X.X in]"`.
- Hybrid (multi-segment) + steel-stud layers come through as a `PhDivisionGrid`
  on the material's PH props (equivalent conductivity computed; density /
  specific-heat kept from the base material — documented V1 limitation).
- **Asset references** are stable `phn-asset:<asset_id>` locators (decision O1),
  **not** signed URLs. Resolve to bytes via a signed download only when needed.
- Duplicate assembly names → **409** `duplicate_assembly_names`
  (`details.duplicate_names`). Rename in the web app first.

### 3. `GET /aperture-types` — denormalized window-type grid

Payload key **`aperture_types`**: `{ "<type name>": { … } }`. This satisfies the
existing V1 client parser (`window_types_schema.py` in this GH repo). Per type:

```jsonc
{
  "name": "…", "display_name": "…",
  "row_heights_mm": [ … ], "column_widths_mm": [ … ],   // grid dims, mm
  "elements": [
    {
      "name": "…",
      "row_number": 0, "column_number": 0,   // top-left cell index (0-based)
      "row_span": 2, "col_span": 1,          // COUNTS (V1 shape)
      "glazing": { "name": "…", "glazing_type": { "id","name","u_value_w_m2k","g_value","specification_status","manufacturer","brand" } } | null,
      "frames": { "top": { "name","frame_type": { "id","name","width_mm","u_value_w_m2k","psi_g_w_mk","psi_install_w_mk","specification_status","manufacturer","operation" } } | null, "right": …, "bottom": …, "left": … },
      "operation": { "type": "swing"|"slide", "directions": ["left"|"right"|"up"|"down", …] } | null   // null = Fixed
    }
  ]
}
```

- **Row order is top-to-bottom** (row 0 = top). The GH client reverses for
  Rhino's bottom-to-top, as in V1.
- `row_span`/`col_span` are **counts** (V2 stores inclusive `(start,end)` tuples;
  the route maps `count = end - start + 1`, `row_number = start`).
- `psi_install_w_mk` **is** emitted (V1 never sent it; default 0.04 no longer
  needed). **`chi_value` is omitted** — default `0.0` client-side (O3).
- Units are SI with unit-suffix field names; mm→m stays client-side (V1).

### 4. `GET /aperture-constructions/hbjson` — window constructions

Payload key **`hb_constructions`**: `{ "<element id>": WindowConstruction.to_dict() }`
(element id = `"{aperture}_C{col}_R{row}"`). Client: `WindowConstruction.from_dict`.
Each carries an `EnergyWindowMaterialSimpleGlazSys` with `u_factor` (ISO 10077-1
element U), `shgc` (glazing `g_value`, default 0.5), `vt` (0.6 default). This is
the deliberately minimal stable subset — build `ph_frame`/`ph_glazing` in GH from
the `/aperture-types` data (route 3).

### 5. `GET /tables/{table_name}` — generic element tables

Payload keys **`records`** + **`field_defs`**. Replaces the AirTable download
path for every row-based element. Allowlisted `table_name` (external, stable):

```
rooms · space_types · thermal_bridges · pumps · fans · ventilators ·
hot_water_heaters · hot_water_tanks · electric_heaters · appliances ·
heat_pump_indoor_units · heat_pump_outdoor_units
```

- `records[i]` = one row: `id` + typed built-in columns + `custom_values` bag +
  `custom_links` bag, all passed through verbatim (O5).
- `field_defs` = the table's field definitions (built-in + custom), so the GH
  side interprets `custom_values` **without hardcoding** field names. Each has
  `field_key`, `display_name`, `field_type`, `config`, `origin`, …
- **Single-select fields emit `{ "id", "label" }`** (O6), in typed columns and in
  `custom_values`. Unset → `null`.
- **Cross-table references stay ids** (e.g. an indoor unit's `outdoor_unit_id`) —
  join client-side. **Asset references stay ids.**
- **Raw stored fields only** — computed/formula values (e.g. rooms airflow
  rollups) are **not** included yet (logged follow-up).
- Unknown `table_name` → **422** `unknown_table` (`details.valid_names` lists the
  12). Empty table → `records: []` (not 404).

## Errors

Uniform envelope: `{ "error_code", "message", "request_id", "details" }`.
`404` unknown bt_number / version · `422` unknown table (`details.valid_names`) ·
`401` bad bearer · `403` wrong-project bearer · `429` rate-limited ·
`409` duplicate assembly / aperture-type names (`details.duplicate_names`).

## Schema / type references (where the shapes come from)

**Honeybee objects the client rebuilds** (already used in this GH repo):
- `honeybee_energy.construction.opaque.OpaqueConstruction` — `from_dict`/`to_dict`
- `honeybee_energy.material.opaque.EnergyMaterial`
- `honeybee_energy_ph.properties.materials.opaque` — `PhColor`, `PhDivisionGrid`,
  `EnergyMaterialPhProperties`
- **`honeybee-ref==0.2.1`** (pin — 0.2.6 has a broken layout):
  `honeybee_energy_ref.document_ref.DocumentReference`,
  `…image_ref.ImageReference`, `…properties.hb_obj._HBObjectWithReferences`;
  external ids via `add_external_identifier("ph_nav", <pmat_id>)`
- `honeybee_energy.construction.window.WindowConstruction` +
  `EnergyWindowMaterialSimpleGlazSys`
- Existing V1 parser to mirror for route 3: `window_types_schema.py` (this repo)

**Backend payload builders (read to confirm exact shapes):**
- Envelope / access / version: `backend/features/gh_api/{routes,models,service}.py`
- Constructions: `backend/features/gh_api/constructions_export.py`
- Aperture types: `backend/features/gh_api/aperture_types_export.py`
- Tables: `backend/features/gh_api/tables_export.py` (`TABLE_PATHS`)

**Document model types (the source data, for field names/units):**
- `backend/features/project_document/envelope_models.py` — `Assembly`,
  `AssemblyLayer`, `AssemblySegment`, `ProjectMaterial`, `ApertureTypeEntry`,
  `ApertureElement`, `ApertureElementFrames`, `ApertureOperation`,
  `ProjectGlazing`, `ProjectFrame`
- `backend/features/project_document/rows.py` — row + `{field_defs, rows}`
  envelope models, `SingleSelectOption`
- `backend/features/project_document/custom_fields.py` — `TableFieldDef`,
  `CustomFieldType` (the `field_type` enum: `short_text`, `long_text`, `number`,
  `url`, `single_select`, `color`, `formula`, `linked_record`)

## Intended GH component work (PRD §6, for Phases 04–05)

1. Shared `PHNavV2Client` (IronPython/TLS-1.2 safe, optional `_token_`, envelope
   `schema_version` check, single parse, no offset loop).
2. `version` switch on the two existing components (Get Constructions, Get Window
   Types) — default V1 during transition; V2 path uses routes 2 & 3/4. **Outputs
   unchanged** (same HB object types).
3. New V2-only getter components for the 12 tabular types (route 5).
