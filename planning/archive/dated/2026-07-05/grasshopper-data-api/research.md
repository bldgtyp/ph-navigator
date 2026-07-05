# Research: PH-Nav V1 → Rhino/Grasshopper Workflow & Data Flow

```
DATE:    2026-07-05
TIME:    12:17
STATUS:  Active (research phase)
AUTHOR:  Claude (with Ed)
SCOPE:   Synthesize the V1 GH "get" workflow; map V2's existing surface;
         outline the critical elements V2 must provide for Rhino/GH users.
RELATED: README.md, STATUS.md,
         planning/code-reviews/2026-06-27/access-capability-model-decisions.md
```

## 1. Intended use case

> User builds PH-Nav elements (assemblies, window types) in the web app →
> GH components "get" the data over HTTP → user connects the resulting
> honeybee objects to 3D model geometry in Rhino.

The GH components are **read-only pull clients**. They run inside Rhino's
IronPython 2.7 using `System.Net.WebClient` — no `requests`, no modern JSON
tooling, GETs with simple headers only. The existing V1 components will be
retained during the transition; the plan is a **version switch** on the
components so users flip from V1 to V2 with minimal friction.

## 2. V1 as-is: the two core GH components

Source repos:

- Backend: `ph-navigator` (V1, "ph-dash") — deployed at
  `https://ph-dash-0cye.onrender.com`
- GH client: `honeybee_grasshopper_ph_plus` →
  `honeybee_ph_plus_rhino/gh_compo_io/ph_navigator/`
  (only three files: `constructions_get.py`, `window_types_get.py`,
  `window_types_schema.py` — this is the whole V1 GH surface)

### 2.1 Get Constructions (`GHCompo_PHNavGetConstructions`)

| Step | Detail |
| --- | --- |
| Request | `GET {url_base}/assembly/get-assemblies-as-hbjson/{bt_number}` |
| Headers | `Authorization: Bearer None` (vestigial), `Content-type: application/json`, query `offset=0` |
| Response | `{"hb_constructions": "<JSON-encoded STRING>"}` — **double-encoded**; client parses the string a second time |
| Payload shape | `{assembly_name: OpaqueConstruction.to_dict(), ...}` keyed by assembly name |
| Client processing | `OpaqueConstruction.from_dict(d)` per entry → `list[OpaqueConstruction]` output |

Component inputs: `_project_number` (bt_number), `_url_base` (optional
override — this is the existing hook a version switch can exploit),
`_get_constructions` (run toggle).

**V1 server-side serialization** (`features/assembly/services/to_hbe_construction.py`
+ `to_hbe_material_typical.py` / `to_hbe_material_steel_stud.py`):

- Each layer → `EnergyMaterial(thickness_m, conductivity_w_mk, density_kg_m3,
  specific_heat_j_kgk)` — all SI; thickness converted mm→m server-side.
- Material identifier embeds IP thickness for legibility:
  `"{name} [{thickness_m * 39.3701:.1f} in]"`.
- **Mixed (segmented) layers** → single "hybrid" `EnergyMaterial` via
  `PhDivisionGrid.get_equivalent_conductivity()`; equivalent density /
  specific-heat are TODO (base material's values are kept).
- **Steel-stud assemblies** take a separate path: equivalent stud-cavity
  conductivity (`calculate_steel_stud_eq_conductivity`).
- PH extension data rides along: `PhColor` from material ARGB, and
  `honeybee_energy_ref` `DocumentReference`/`ImageReference` for datasheets &
  site photos, plus `add_external_identifier("ph_nav", material.id)`.
  → The HBJSON is not "plain" honeybee-energy; it carries `honeybee_energy_ph`
  and `honeybee_energy_ref` extension properties that `from_dict` restores on
  the Rhino side.

### 2.2 Get Window Types (`GHCompo_PHNavGetWindowTypes`)

| Step | Detail |
| --- | --- |
| Request | `GET {url_base}/aperture/get-apertures-as-json/{bt_number}` |
| Headers | same vestigial bearer/offset pattern |
| Response | `{"apertures": "<JSON-encoded STRING>"}` — double-encoded again |
| Payload shape | `{aperture_name: ApertureSchema.model_dump(), ...}` keyed by name |
| Client processing | parse → `ApertureTypeData` (client-side schema classes) → build a family of honeybee-PH objects |

This component does far more client-side work than the constructions one. From
the raw aperture-type JSON it constructs, in order:

1. **`PhWindowGlazing`** per glazing type (`u_value_w_m2k`, `g_value`).
2. **`PhWindowFrameElement`** per frame type (`width_m`, `u_value_w_m2k`,
   `psi_g_w_mk`, `psi_install_w_mk`, `chi_value_w_k`).
3. **`PhWindowFrame`** per *element* — four sides (left/right/top/bottom) each
   assigned a frame element. ID convention: `"{aperture_name}_C{col}_R{row}"`.
4. **`WindowUnitType`** per aperture type — the **geometry generator**: row
   heights / column widths (mm→m client-side) + per-element position/span so
   the user can bake actual window geometry in Rhino. Element sizes are summed
   across spanned rows/columns.
5. **`WindowConstruction`** per element, wrapping an
   `EnergyWindowMaterialSimpleGlazSys` whose U-factor is computed client-side
   via **ISO 10077-1** (`iso_10077_1.calculate_window_uw(frame, glazing)`),
   SHGC = g-value, **t_vis hardcoded 0.6**; then
   `construction.properties.ph.ph_frame / .ph_glazing` set.

Outputs: (a) window-unit-types collection (geometry), (b) EP-construction
collection (energy), (c) raw JSON string (debug).

**Coordinate-system contract:** the API serves the element grid
**top-to-bottom**; Rhino builds **bottom-to-top**. The client schema reverses
row order and row numbers (`reverse_elements_row_order`,
`get_row_height_m`). Any V2 payload keeps this in mind — either preserve V1's
top-to-bottom convention (client already handles it) or document a change
explicitly.

### 2.3 V1 payload field inventory (the de-facto wire contract)

From `ApertureSchema` (V1 backend) / `window_types_schema.py` (GH client):

- **Aperture type**: `name`, `row_heights_mm: list[float]`,
  `column_widths_mm: list[float]`, `elements: list[...]`, `last_modified`
  (UTC ISO-8601 `...Z` — V1 docstring says the Rhino plugin compares it
  **byte-for-byte** for change detection).
- **Element**: `name`, `row_number`, `column_number`, `row_span`, `col_span`,
  `glazing`, `frames`, `operation` (`{type: "swing"|"slide",
  directions: ["left"|"right"|"up"|"down"]}` | null).
- **Glazing type**: `id` (string — AirTable record ID), `name`,
  `u_value_w_m2k`, `g_value`, plus provenance (`manufacturer`, `brand`,
  `source`, `datasheet_url`, `link`, `comments`).
- **Frame type**: `id` (string), `name`, `width_mm`, `u_value_w_m2k`,
  `psi_g_w_mk`, plus descriptors (`use`, `operation`, `location`,
  `mull_type`, provenance fields).
- ⚠️ The GH client *reads* `psi_install_w_mk` (default 0.04) and `chi_value`
  (default 0.0) but the V1 backend `FrameTypeSchema` does not clearly emit
  them — the client's `dict.get(..., default)` masks this. Parity item for V2
  (V2's `ProjectFrame` **does** carry `psi_install_w_mk`; chi is TBD).

### 2.4 Wire-contract quirks to fix (not preserve) in V2

1. **Double-encoded JSON** — response values are JSON strings needing a second
   `json.loads`. Pure accident of `json.dumps` + `JSONResponse`.
2. **Vestigial `offset` pagination** — client loops on an `offset` response key
   the server never returns (AirTable-era). One-request loop in practice.
3. **`Authorization: Bearer None`** — both V1 GET routes are **unauthenticated**
   (`Depends(get_db)` only; no auth middleware). Anyone with a bt_number can
   pull project data. CORS is irrelevant for non-browser clients.
4. Rate limiting inconsistent: assemblies `10/minute`; the aperture route's
   limiter decorator is commented out.
5. Project addressed by `bt_number` — indexed, treated as unique, but not
   DB-unique-constrained.

### 2.5 Other V1 routes in the same "GH-shaped" family (context)

- `GET /aperture/get-window-constructions-as-hbjson/{bt_number}` — server-side
  version of what the GH component builds client-side (WindowConstruction +
  SimpleGlazSys, ISO 10077-1 U, t_vis 0.6). The GH component does **not** use
  it today — it builds client-side because it also needs the frame/glazing/
  geometry family, which HBJSON constructions alone don't carry.
- `POST /assembly/add-assemblies-from-hbjson-constructions/{bt_number}` — the
  reverse **push** direction (HBJSON upload → DB assemblies).
- `features/hb_model/*` — viewer-oriented reads of a stored HBJSON model
  (faces, spaces, sun path, HVAC, shading). Rhino-adjacent, out of scope for
  the core "get types" workflow.

## 3. V2 as-is: what already exists

### 3.1 Data model (JSONB document, `ProjectDocumentV1`)

All the V1 concepts already exist as document tables
(`backend/features/project_document/envelope_models.py`), SI-only,
suffix-encoded units, prefixed string IDs:

| Concept | V2 home | Notes |
| --- | --- | --- |
| Assemblies | `body.tables.assemblies` (`asm_`/`lyr_`/`seg_`) | layers → segments; `orientation`; steel-stud + continuous-insulation flags |
| Materials | `body.tables.project_materials` (`pmat_`) | conductivity/density/specific-heat + provenance + datasheet asset IDs |
| Aperture types | `body.tables.apertures` (`apt_`/`aptel_`) | grid `row_heights_mm`/`column_widths_mm`; elements use **inclusive span tuples** (`row_span: (start, end)`) vs V1's number+span; coverage invariant (no holes/overlaps) |
| Glazing types | `body.tables.project_glazings` (`pglz_`) | u_value_w_m2k, g_value, provenance |
| Frame types | `body.tables.project_frames` (`pfrm_`) | width_mm, u_value_w_m2k, psi_g_w_mk, **psi_install_w_mk**, descriptors |

### 3.2 Serializers already built (reuse, don't reinvent)

- `features/envelope/hbjson_export.py` — assemblies →
  `OpaqueConstruction.to_dict()` (layers outside→inside, hybrid/segment
  handling). Route: `GET .../envelope/export/hbjson`.
- `features/aperture_hbjson_export/service.py` — elements →
  `WindowConstruction` dicts, deliberately hand-built minimal/stable subset
  (avoids honeybee's nondeterministic `properties.ref` ids); ISO 10077-1 U,
  g_value SHGC, t_vis 0.6. Route:
  `GET .../versions/{version_id}/apertures/hbjson?source=draft|version` — its
  docstring already names the Rhino/honeybee_ph consumer.
- `features/envelope/hbjson_import.py` — the push direction, already exists.
- honeybee **is** installed in the V2 backend (`honeybee-ph>=1.33.19`).

### 3.3 The two real gaps

**Gap A — Auth transport.** V2 REST authenticates by **session cookie only**;
`Authorization: Bearer` is parsed nowhere on the REST seam. The `phn_mcp_...`
project-scoped tokens (SHA-256-hashed, scoped `project:read` etc., acts-as-
issuer) only authenticate the `/mcp` FastMCP app — which is streamable-HTTP
JSON-RPC with session headers, effectively unusable from IronPython 2.7
`WebClient`. Meanwhile the HBJSON export routes require
`APERTURES_EXPORT_HBJSON` / `ENVELOPE_EXPORT_HBJSON` capabilities that
anonymous viewers don't hold. **Net: today, no GH-reachable authenticated path
exists to the exact data GH needs.** The 2026-06-27 access-model review
already reserves the `token` principal for exactly this
("downstream API (Rhino/GH/Honeybee-PH) … same seam; never widens beyond
issuer's grants").

**Gap B — Addressing ergonomics.** V2 routes are
`/api/v1/projects/{UUID}/versions/{UUID}/...`. GH users think in
**bt_numbers** and "latest". There is no lookup-by-bt_number read route and no
"latest version" convenience (the pointer exists: `active_version_id`).
Pasting two UUIDs into a GH text input is a non-starter for the transition
story.

**Non-gap:** the raw aperture-type JSON (grid + frames + glazing family) is
already fully served by the generic document/table reads
(`GET .../document/tables/apertures` etc.) — but split across three tables
(`apertures`, `project_glazings`, `project_frames`) that the GH client would
have to join, vs V1's denormalized nested payload. A GH-facing route should
serve the **joined/denormalized** shape so the IronPython client stays dumb.

## 4. Outline: critical elements for the V2 Grasshopper API

### A. Endpoints (project-scoped, GET-only, single-encoded JSON)

1. **Constructions as HBJSON** — parity with V1
   `get-assemblies-as-hbjson`. Reuse `envelope/hbjson_export`. Decide: keep
   the PH/ref extension payload (V1 behavior: colors, datasheet refs,
   external IDs) or ship the minimal stable subset first.
2. **Aperture types as JSON** — parity with V1 `get-apertures-as-json`:
   denormalized nested shape (type → elements → per-side frame type +
   glazing type resolved inline), grid dims in mm, operation data,
   `last_modified`. This feeds `WindowUnitType` geometry baking — the
   HBJSON window route alone is not sufficient.
3. **Window constructions as HBJSON** (optional, already exists) — expose
   through the same GH-facing seam for consistency.
4. **Project resolution** — `bt_number → {project_id, active_version_id,
   name, last_saved_at}` so a GH user enters only the bt_number (+ token).
5. Future (explicitly out of scope for round 1): materials catalog pull,
   whole-model push/pull, shading, rooms/ventilation.

### B. Auth (the main new mechanism)

- Wire `authenticate_plaintext_token` + `project_access_for_token` into the
  REST `ProjectAccess` resolver (`features/projects/access.py`): if no
  session cookie and `Authorization: Bearer phn_mcp_...` present → token
  principal, project-scoped, acts-as-issuer (holds the export caps).
- Token UX: issue/copy in the web UI per project (route exists:
  `POST .../mcp-tokens`); GH component takes the token as an input.
- **Decision needed:** require tokens for GH reads, or allow anonymous like
  V1? V1 was fully open; V2's anonymous viewer already reads documents but
  not exports. Recommendation: token-required from day one (cheap for users,
  closes V1's open-door), revisit if friction appears.

### C. Versioning & change detection

- Default to **latest saved version** (`active_version_id`); allow explicit
  `version_id` pinning as a query param.
- Response envelope carries `schema_version`, `project`, `version_id`,
  `last_modified` — preserve V1's byte-stable `last_modified` semantics for
  the Rhino change-detection contract.
- No `offset` pagination; no double encoding. Honor `Accept-Encoding` (V1
  already had GZip; payloads are small anyway).

### D. GH component changes (honeybee_grasshopper_ph_plus side)

- Add a **`version` switch** input (V1/V2) to the two existing components; V2
  path uses a new client class (new URL shape, real bearer token,
  single-parse JSON, no offset loop) but produces the **identical outputs**
  (same HB object types) so downstream GH graphs don't change.
- The existing `_url_base` input already supports pointing at
  `api.ph-nav.com`; the switch mostly selects URL template + parse path.
- Client stays IronPython-2.7-safe: `System.Net.WebClient`, TLS 1.2 forcing,
  header-based bearer, GET-only.
- Row-order reversal / mm→m conversions stay client-side (unchanged) unless
  we deliberately re-spec the payload — if so, document it in the response
  envelope.

### E. Parity checklist (verify during design/implementation)

- [ ] `psi_install_w_mk` and `chi_value` on frames: emitted by V2? (client
      currently defaults 0.04 / 0.0 silently)
- [ ] Element span semantics: V1 `row_number + row_span` vs V2 inclusive
      `(start, end)` tuples — the GH payload must pick one and map cleanly
- [ ] Hybrid (segmented) layer equivalent-conductivity parity with V1
      (`PhDivisionGrid`), incl. the known density/specific-heat TODO
- [ ] Steel-stud assembly path parity
- [ ] PH color / datasheet `DocumentReference` / `external_identifier`
      passthrough on materials (V1 emits; V2 export is deliberately minimal)
- [ ] t_vis 0.6 default (both sides hardcode it today — fine, but note it)
- [ ] Operation (swing/slide + directions) present in the aperture payload
- [ ] `last_modified` byte-stability across V2 saves

### F. Open questions for Ed

1. Token-required vs anonymous GH reads (rec: token-required).
2. bt_number as the GH-facing key (rec: yes, via a resolver route) — bt_number
   uniqueness should then get a real DB constraint in V2.
3. Serve rich HBJSON (PH props + refs, V1-style) or minimal-stable subset
   first (V2 aperture-export style) for opaque constructions?
4. New dedicated router (e.g. `/api/v1/gh/...` or `/api/v1/exchange/...`) vs
   overloading existing document routes with bearer support? (rec: dedicated
   thin router reusing existing services — keeps the GH wire contract
   versionable independently of the web app's routes.)
5. Does round 1 include the **push** direction (GH → V2 assemblies via
   HBJSON upload), which V1 had and V2's `hbjson_import` supports?

## 5. Discussion round 1 (2026-07-05) — decisions & expanded scope

Ed's responses to §4.F, plus scope expansion.

### 5.1 Decisions

1. **Anonymous GET: ALLOWED** — consistent with the site-wide anonymous
   viewer posture. Known tradeoff accepted: bt_number-keyed routes make
   projects enumerable-by-counting (vs unguessable UUID links). Hedges built
   in from day one: (a) the GH route dependency honors
   `Authorization: Bearer phn_mcp_...` when present, so a future per-project
   "private" flag can require tokens with no GH component rework; (b) rate
   limiting on the GH router. Do NOT widen the global anonymous capability
   set — the GH router makes its own access decision.
2. **bt_number is the GH-facing key** — GH routes take bt_number in the path
   and resolve to UUID internally; the web app keeps UUID routing untouched.
   Requires an Alembic migration adding a unique index on
   `projects.bt_number` (partial: `WHERE deleted_at IS NULL`). Prod DB is
   ~empty, so do this early.
3. **Version pinning** — every GH route takes optional `?version=<version_id>`;
   omitted → `active_version_id` (latest save). A metadata/resolver route
   lists versions so users can pin (certification-archive use case). GH reads
   saved versions only — never drafts. GH components get an optional
   `_version_` input (blank = latest).
4. **Dedicated router confirmed**: `/api/v1/gh/...` (consumer-named for
   `honeybee_grasshopper_ph`). Thin routes reusing existing services.
5. **Push is out of scope** (confirmed V1's HBJSON-upload POST was a web-UI
   feature, never a GH component). A future "push from GH" is a separate
   component/feature.
6. **Rich HBJSON confirmed** (Ed, 2026-07-05): the GH-Get must receive *all*
   the data — color and refs are used in GH when building constructions and
   outputting to WUFI-Passive / PHPP. Opaque-construction route = V1 parity
   (PhColor, division grid, `honeybee_energy_ref` datasheet/photo refs,
   `ph_nav` external ids). Consequence: payload bytes are not guaranteed
   deterministic; change detection keys on `version_id`/`last_modified`.

### 5.2 Expanded scope: ALL element types (replacing AirTable)

V1 GH mixed sources: constructions + apertures from PH-Nav-V1, everything
else (pumps, fans, heat pumps, hot water, spaces, …) from **AirTable** via
the generic component
`honeybee_ph_plus_rhino/gh_compo_io/airtable/download_data.py`
(`GHCompo_AirTableDownloadTableData`: token + base_id + table_id →
`TableRecord[]` with dict-like `.fields`; real offset pagination — the
pattern V1's PH-Nav components cargo-culted). In V2, **all** data comes from
the PH-Nav-V2 backend.

Full get-list and V2 document-table mapping (**every item already exists in
the V2 document model** — routes only, no new data modeling):

| GH element | V2 document location |
| --- | --- |
| Opaque Constructions | `tables.assemblies` (⋈ `project_materials`) → HBJSON |
| Aperture Constructions | `tables.apertures` (⋈ glazings/frames) → HBJSON |
| Aperture Types (sizes/config) | `tables.apertures` (⋈ glazings/frames), denormalized JSON |
| Rooms | `tables.rooms` |
| Space Types | `tables.space_types` |
| Thermal Bridges | `tables.thermal_bridges` |
| Ventilators | `tables.equipment.ervs` |
| Pumps | `tables.equipment.pumps` |
| Fans | `tables.equipment.fans` |
| Hot Water Heaters | `tables.equipment.hot_water_heaters` |
| Hot Water Tanks | `tables.equipment.hot_water_tanks` |
| Electric Heaters | `tables.equipment.electric_heaters` |
| Appliances | `tables.equipment.appliances` |
| Heat Pump Indoor Units | `tables.equipment.heat_pumps.indoor_units` |
| Heat Pump Outdoor Units | `tables.equipment.heat_pumps.outdoor_units` |

### 5.3 Generalized route design (mirrors the AirTable pattern)

All under `/api/v1/gh/projects/{bt_number}`, all GET, all `?version=`
optional, uniform single-encoded envelope
`{schema_version, project, version_id, last_modified, ...payload}`:

1. `GET /` — resolver/metadata: project info + version list.
2. `GET /tables/{table_name}` — the generic tabular route serving all 12
   row-based elements above (allowlisted table names; denormalize
   single-select option labels as needed).
3. `GET /constructions/hbjson` — composed opaque-construction export.
4. `GET /aperture-types` — composed denormalized aperture-grid JSON
   (V1 `get-apertures-as-json` parity).
5. `GET /aperture-constructions/hbjson` — composed window-construction
   export (existing service).

GH client side mirrors the same split: one shared `PHNavV2Client`
(WebClient, TLS 1.2, optional bearer, single JSON parse, no offset loop) +
thin per-element builder components. The two existing components get a
V1/V2 **version switch** (selects client class + URL template; outputs
unchanged); the new element getters are V2-only components.
