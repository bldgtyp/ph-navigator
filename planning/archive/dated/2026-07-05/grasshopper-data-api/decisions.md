# Decisions: grasshopper-data-api

```
DATE:    2026-07-05
TIME:    13:30
STATUS:  Active
AUTHOR:  Claude (with Ed)
SCOPE:   Accepted / open decisions ledger. Settled items D1–D6 are
         normative in PRD.md §3; this file tracks them plus
         implementation-time decisions the phase docs defer here.
RELATED: PRD.md, research.md §5, phases/*
```

## Accepted (2026-07-05, Ed)

- **D1 Anonymous GET allowed** — bearer honored when present; rate-limited;
  global anon capability set untouched. (PRD §3)
- **D2 bt_number is the GH-facing key** — partial unique index; internal
  UUID resolution. (PRD §3)
- **D3 Version pinning** — `?version=`, default latest save, never drafts.
- **D4 Dedicated router** `/api/v1/gh/...`.
- **D5 Rich HBJSON** for opaque constructions (PhColor + division grid +
  refs + `ph_nav` external ids) — colors/refs are used in GH and flow to
  WUFI-Passive/PHPP. Change detection keys on `version_id`/`last_modified`,
  not payload bytes.
- **D6 Push out of scope** (V1's HBJSON upload was web-UI only).

## Open

- (none — all implementation decisions O1–O7 resolved below)

## Resolved during implementation

- **O7 (Phase 01) RESOLVED** → minimal in-process **fixed-window** per-IP
  limiter (`features/gh_api/rate_limit.py`), not slowapi (avoids a new
  dependency for a single-instance deploy). Two `Settings` fields:
  `gh_api_rate_limit_enabled` (default `True`; conftest sets it `false` so the
  shared `testclient` IP doesn't 429 the suite) and
  `gh_api_rate_limit_per_minute` (default `30`). A module-level singleton with a
  `reset_rate_limiter()` test hook; the boundary test re-enables via monkeypatch.
- **Phase 01 note — bt_number partial index**: the baseline shipped a *full*
  `uq_projects_bt_number UNIQUE` constraint. Migration `20260705_0005` drops it
  for a partial unique index `WHERE deleted_at IS NULL`, so bt_numbers free up
  after soft-delete. The app-level guard (`get_project_by_bt_number`, no
  soft-delete filter) is intentionally *stricter* than the index — it still
  blocks reuse while a soft-deleted project exists, protecting restore. bt_number
  trim-on-write was already handled by the `CreateProjectRequest` /
  `UpdateProjectRequest` Pydantic validators, so no service change was needed.
- **Phase 01 note — access tiers**: three-tier resolution lives in
  `gh_api/service.py` (session → bearer → anon) composing the shared primitives
  (`optional_current_user`, `project_access_for_token`, `ViewerPrincipal`); the
  bearer tier is NOT hoisted to `features/access/` yet (no second consumer).
  `last_modified` = the version's `updated_at`.
- **O1 (Phase 02) RESOLVED** → asset references emit a stable
  `phn-asset:<asset_id>` locator, never a signed URL. The scheme is owned by the
  assets domain (`asset_locator()` in `features/assets/base.py`) so every wire
  boundary agrees; the GH/PHX side resolves it to a signed download only when it
  needs the bytes.
- **O2 (Phase 02) RESOLVED** → name-keyed payloads (`hb_constructions`,
  `aperture_types`) raise 409 listing duplicate names rather than silently
  dropping collisions. Shared `reject_duplicate_names`
  (`features/gh_api/export_helpers.py`). This is a belt-and-suspenders guard; the
  write side already enforces uniqueness case-insensitively. (Deferred: hoisting a
  normalized-name invariant onto `ProjectDocumentV1` — a cross-cutting change out
  of this feature's scope.)
- **O3 (Phase 02) RESOLVED** → `chi_value` omitted; V2 `ProjectFrame` has no chi
  field and the GH client defaults it to 0.0. `psi_install_w_mk` IS emitted.
- **O4 (Phase 02) RESOLVED** → keep V1's material identifier convention
  `"{clean_name} [ {X.X} in]"` (IP-thickness suffix) for downstream GH matching
  parity.
- **Phase 02 note — two serializers**: the rich GH construction export
  (`constructions_export.py`, real honeybee objects) and the web-download export
  (`envelope/hbjson_export.py`, hand-rolled dict with an internal `ph_nav`
  round-trip block) are deliberately separate contracts. Shared domain rules
  (`Assembly.layers_outside_to_inside()`) are hoisted so they can't drift; the two
  equivalent-conductivity implementations were left as-is (unifying would change
  the web export's output — a separate cleanup).
- **O5 (Phase 03) RESOLVED** → `custom_values` bag + `custom_links` passed
  through verbatim, alongside a `field_defs` passthrough, so the GH side
  interprets custom fields without hardcoding (no flattening — lossless and
  robust to Plan-31's evolving field set).
- **O6 (Phase 03) RESOLVED** → single-select values emit as a `{"id", "label"}`
  object (uniform, not a sibling `_label`). Resolved from a flat
  `{option_id: label}` index over `document.single_select_options` (built-in AND
  custom catalogs). Unset stays `null`.
- **Phase 03 note — table allowlist**: `features/gh_api/tables_export.py`
  `TABLE_PATHS` maps the 12 stable GH-external names → internal document paths
  (kept explicit for external-contract insulation, e.g. `ventilators`→`ervs`,
  `heat_pump_indoor_units`→`heat_pumps.indoor_units`). A module-load drift guard
  ties every path to a real `TableContract.table_path` (mirrors registry.py's
  status-field guard) so an internal rename fails at import, not silently at
  request time. Unknown name → 422 listing valid names; empty table → `records:
  []`. Serialized from the validated document model (rows are `extra="forbid"`).
  Raw stored fields only — no computed/formula values (logged follow-up).
