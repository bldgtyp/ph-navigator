# PRD: Grasshopper Data API (`/api/v1/gh`)

```
DATE:    2026-07-05
TIME:    13:05
STATUS:  Active
AUTHOR:  Claude (with Ed)
SCOPE:   Behavior contract for the V2 downstream read API serving
         Rhino/Grasshopper (honeybee_grasshopper_ph_plus) clients, and the
         matching GH-component changes.
RELATED: README.md, research.md (§4 outline, §5 decisions), PLAN.md, STATUS.md
```

## 1. Intent

Rhino/Grasshopper users build PH-Nav-V2 project data in the web app, then
pull it into Rhino while building the 3D energy model:

> User builds PH-Nav-V2 elements → GH components GET data → user connects
> data to 3D model geometry.

V1 served two GH components (opaque constructions, window types) from
PH-Nav-V1 and everything else from AirTable. In V2, **all** element data
comes from the PH-Nav-V2 backend through one dedicated, GH-shaped read API.
The two existing GH components gain a V1/V2 version switch; new V2-only
components cover the remaining element types.

## 2. Users / client constraints

- IronPython 2.7 inside Rhino (`System.Net.WebClient`); TLS 1.2 forced
  client-side; GET + simple headers only; single `json.loads` per response.
- Users identify projects by **bt_number** (e.g. `2524`), not UUIDs.
- Payloads are small (dozens of records); latency budget ~1s per component
  run (V1 measured 0.9–1.3s).

## 3. Decisions (settled 2026-07-05, see research.md §5)

| # | Decision |
| --- | --- |
| D1 | **Anonymous GET allowed.** Accepted tradeoff: bt_number-keyed routes are enumerable-by-counting. Hedges: routes honor `Authorization: Bearer phn_mcp_...` when present (validated via existing MCP token machinery, acts-as-issuer); GH router is rate-limited. Global anonymous capability set is NOT widened — the GH router makes its own access decision. |
| D2 | **bt_number is the GH-facing key.** Partial unique index on `projects.bt_number` (`WHERE deleted_at IS NULL`) via Alembic. GH routes resolve bt_number→UUID internally; web-app UUID routing untouched. |
| D3 | **Version pinning.** Optional `?version=<version_id>` on every data route; omitted → `active_version_id` (latest save). Saved versions only — **never drafts**. Resolver route lists versions for pinning (certification-archive use case). |
| D4 | **Dedicated router** `/api/v1/gh/...`, thin routes reusing existing services. |
| D5 | **Rich HBJSON** for opaque constructions: V1 parity including `honeybee_energy_ph` properties (PhColor, division grid) and `honeybee_energy_ref` references (datasheet/photo refs, `ph_nav` external ids). Ed confirmed GH-side workflows need color + refs flowing to WUFI-Passive/PHPP. |
| D6 | **Push (GH→V2) out of scope.** Read-only API. |

## 4. Routes

All under `/api/v1/gh/projects/{bt_number}`. All GET. All JSON,
**single-encoded** (no V1-style string-in-JSON double encoding). All
data routes accept `?version=<version_id>` (default: latest saved).

### 4.1 Common response envelope

```json
{
  "schema_version": 1,
  "project": {"bt_number": "2524", "project_id": "<uuid>", "name": "..."},
  "version_id": "<uuid>",
  "last_modified": "2026-07-05T16:00:00Z",
  "...payload key(s) per route..."
}
```

- `schema_version` is the **GH wire-contract version** (independent of the
  document `schema_version`).
- `last_modified` = the version's save timestamp, byte-stable for a given
  version (preserves V1's Rhino change-detection contract). Payload bytes
  themselves are NOT guaranteed deterministic (rich honeybee refs may carry
  generated ids); clients must key change detection on
  `version_id`/`last_modified`, not payload hashing.
- Errors: 404 `{detail}` for unknown bt_number / version; 422 for bad
  table name; plain JSON, no HTML error pages.

### 4.2 Route list

| Route | Payload key | Serves |
| --- | --- | --- |
| `GET /` | `versions: [...]` | Resolver/metadata: project info + saved-version list (`version_id`, `saved_at`, label/notes if available) so users can pin. |
| `GET /tables/{table_name}` | `records: [...]` | Generic tabular route (allowlist below). Records are the document rows, denormalized where a row references another table or a single-select option (emit both option id and label). |
| `GET /constructions/hbjson` | `hb_constructions: {name: dict}` | Opaque constructions as **rich** `OpaqueConstruction.to_dict()` (D5), keyed by assembly name. Client: `OpaqueConstruction.from_dict` per entry. |
| `GET /aperture-types` | `aperture_types: {name: dict}` | Denormalized aperture-grid JSON (V1 `get-apertures-as-json` parity): type → grid dims (mm) → elements → per-side frame type + glazing type inlined, operation, spans. Feeds `WindowUnitType` geometry baking. |
| `GET /aperture-constructions/hbjson` | `hb_constructions: {name: dict}` | `WindowConstruction` dicts (existing `aperture_hbjson_export` service). |

### 4.3 `tables/{table_name}` allowlist

`rooms`, `space_types`, `thermal_bridges`, `pumps`, `fans`, `ventilators`
(→ `equipment.ervs`), `hot_water_heaters`, `hot_water_tanks`,
`electric_heaters`, `appliances`, `heat_pump_indoor_units`,
`heat_pump_outdoor_units`.

External names are GH-facing and stable; internal document paths may differ
(e.g. `ervs`). Unknown names → 422 listing valid names.

### 4.4 Payload conventions

- SI units with unit-suffix field names (`_mm`, `_w_m2k`, `_w_mk`, `_kg_m3`,
  `_j_kgk`), matching the document model. mm→m conversion stays client-side
  (V1 behavior).
- Aperture grid serialized **top-to-bottom** (V1 convention — the GH client
  already reverses for Rhino's bottom-to-top). Element position/span uses
  V1's `row_number`/`column_number` + `row_span`/`col_span` counts (the GH
  schema's shape); the route maps V2's internal inclusive span tuples.
- No pagination, no `offset` key ever (kill the V1 vestige).
- **Single-select fields** (generic `tables/` route) emit `{"id", "label"}`
  (decision O6); unset stays `null`. `custom_values` / `custom_links` and
  `field_defs` are passed through verbatim (O5) so the GH side needs no hardcoded
  field knowledge. Cross-table references (e.g. `outdoor_unit_id`) and asset
  references stay ids.

## 5. Access & operational posture

- Dependency order: session cookie (normal web auth) → `Authorization:
  Bearer phn_mcp_...` (validated by `authenticate_plaintext_token`,
  project-scope enforced, acts-as-issuer) → anonymous viewer. All three may
  read every GH route today (D1); the seam exists so a future per-project
  "private" flag can require the token with zero client changes.
- Rate limiting on all GH routes (align with existing app limiter posture;
  V1 precedent: 10/minute on the constructions route).
- Read-only: router registers GET handlers only.
- Logging per `context/LOGGING.md`; never log tokens.

## 6. Grasshopper component contract (honeybee_grasshopper_ph_plus repo)

1. **Shared client** `PHNavV2Client`: WebClient + TLS 1.2, optional
   `_token` input (sent as bearer when provided), base-url override, single
   JSON parse, no offset loop, envelope validation (`schema_version` check
   with friendly error if the contract moves ahead of the plugin).
2. **Version switch** on the two existing components (Get Constructions,
   Get Window Types): a `version` input (default V1 during transition)
   selects V1 vs V2 client class + URL template. **Outputs unchanged** —
   same HB object types — so downstream GH graphs keep working. New optional
   inputs: `_version_id_` (blank = latest), `_token_` (blank = anonymous).
3. **New V2-only getter components** for the 12 tabular elements, each a
   thin builder: records → honeybee-PH objects (mirrors the
   AirTable-component + per-element-builder pattern being retired).
4. V1 components remain untouched and functional for the long transition.

## 7. Parity requirements (verified in Phase 02, 2026-07-05)

- [x] Rich construction payload round-trips: `OpaqueConstruction.from_dict`
      restores PhColor, division grid, datasheet/photo refs, `ph_nav` external
      ids. Verified in-process (`tests/test_gh_api_exports.py`) — real honeybee
      objects, not a golden JSON diff (rich refs carry generated ids, so payload
      bytes aren't deterministic; semantic round-trip is the contract).
- [x] Hybrid (segmented) layer equivalent-conductivity via `PhDivisionGrid.
      get_equivalent_conductivity()`; density/specific-heat kept from the base
      material (documented V1 limitation, matched not "improved").
- [x] Steel-stud parity: V2 has no V1-style assembly-level AISI split; a segment's
      `steel_stud_spacing_mm` sets `PhDivisionGrid.steel_stud_spacing_mm` and the
      grid computes the equivalent — the shared mechanism for both hybrid and
      steel-stud (see `decisions.md`).
- [x] `psi_install_w_mk` emitted; `chi_value` omitted (O3 — V2 has no chi field,
      client defaults 0.0).
- [x] Aperture element span mapping (V2 inclusive tuples → V1 `row_number`/
      `col_span` counts) proven on a multi-span fixture.
- [x] Operation (`swing`/`slide` + directions) present; `null` = Fixed.
- [x] `last_modified` byte-stable per version (envelope `updated_at`, Phase 01).
- [x] t_vis 0.6 default: emitted by the existing `aperture_hbjson_export` service
      (`_DEFAULT_VT`), which the GH `/aperture-constructions/hbjson` route wraps.

## 8. Non-goals

- Push/write from GH (future, separate component + feature).
- Draft reads via GH.
- Per-project privacy flag / share model (future; seam prepared via D1).
- MCP server changes (MCP tools already cover agent access; unchanged).
- Whole-model HBJSON exchange, shading, climate data (later rounds).

## 9. Verification strategy

- Backend: pytest per route — envelope shape, version resolution (latest +
  pinned + unknown), table allowlist, denormalization, bearer/anon access,
  and **golden-payload comparisons** against V1 outputs for a seeded fixture
  project (constructions + aperture-types parity).
- Client-shape smoke: a CPython test that consumes the live local routes the
  way the IronPython client will (single parse, field access paths used by
  `window_types_schema.py`).
- End-to-end: Ed runs the switched GH components in Rhino against a local /
  production V2 project (manual gate before release).
