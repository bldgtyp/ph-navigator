# Status: grasshopper-data-api

```
DATE:    2026-07-05
TIME:    12:17
STATUS:  ✅ Backend COMPLETE & ARCHIVED (Phases 01–03 merged to main
         2026-07-05). Phases 04–05 are GH-client work DEFERRED to the
         separate honeybee_grasshopper_ph_plus repo (not started) — see
         CLIENT_HANDOFF.md.
AUTHOR:  Claude (with Ed)
SCOPE:   Phase ledger for the Grasshopper Data API feature.
RELATED: README.md, research.md, CLIENT_HANDOFF.md
```

## Current state

- **Research phase complete** (2026-07-05): V1 GH workflow and data flow
  synthesized; V2 existing surface mapped; gaps identified (bearer-token
  auth on the REST seam; bt_number / latest-version resolution; denormalized
  aperture-type payload). See `research.md` §4 for the critical-elements
  outline.
- **Discussion round 1 folded in** (2026-07-05, `research.md` §5): anon GET
  allowed (with optional-bearer hedge + rate limiting); bt_number is the
  GH-facing key (needs partial unique index); `?version=` pinning with
  latest-by-default; dedicated `/api/v1/gh/...` router; push out of scope.
  Scope expanded to ALL element types (15 items — full V2 table mapping in
  §5.2; no new data modeling needed). Generalized route design in §5.3.
- **All decisions settled** (2026-07-05): Ed confirmed anon access,
  bt_number key, dedicated router, and **rich** HBJSON (V1-parity color +
  refs — needed downstream for WUFI-Passive/PHPP output).
- **PRD.md and PLAN.md drafted** (2026-07-05): 5 routes under
  `/api/v1/gh/projects/{bt_number}`; 5 phases (1–3 backend here, 4–5 GH
  client in honeybee_grasshopper_ph_plus).
- **Phase handoff docs written** (2026-07-05): `phases/phase-01` …
  `phase-05` (requirements, references, validation, testing, gates) +
  `decisions.md` ledger (D1–D6 accepted; O1–O7 open implementation
  decisions). Pre-flight facts verified: V2 has NO rate limiter yet
  (phase-01 R6); `honeybee_energy_ph`/PhColor importable in the V2 venv;
  `honeybee-ref` NOT installed (phase-02 needs `uv add honeybee-ref`);
  table envelopes are Plan-31 `{field_defs, rows}` mixed storage;
  `list_versions_for_project` exists (`features/projects/repository.py:258`).

## Phase ledger

| Phase | Repo | Status |
| --- | --- | --- |
| 01 router foundation | ph-navigator-v2 | ✅ Complete (2026-07-05, `feature/gh-data-api`) |
| 02 composed exports | ph-navigator-v2 | ✅ Complete (2026-07-05, `feature/gh-data-api`) |
| 03 generic tables | ph-navigator-v2 | ✅ Complete (2026-07-05, `feature/gh-data-api`) |
| 04 GH client + switch | honeybee_grasshopper_ph_plus | Ready (backend 01–03 done; needs deploy) |
| 05 GH element getters | honeybee_grasshopper_ph_plus | Blocked on 03–04 |

**Backend (this repo) is COMPLETE** — all three backend phases (01–03) landed
on `feature/gh-data-api`. Phases 04–05 are GH-client work in a **different
repo** (`honeybee_grasshopper_ph_plus`) and are out of scope for this repo's
work; the packet stays active here as the cross-repo coordination doc (do NOT
archive until 04–05 land).

## Next step

- Deploy `feature/gh-data-api` to production (merge to `main`; Ed's call — the
  bt_number partial-index migration `20260705_0005` is the only schema change,
  run while prod tables are small). Then Phases 04–05 (GH client + version switch
  + element getters) proceed in `honeybee_grasshopper_ph_plus`.
- **GH-client agents start here:** `CLIENT_HANDOFF.md` — live endpoint + schema
  reference for the honeybee_grasshopper_ph_plus components.

## Phase 01 outcome (2026-07-05)

- Migration `20260705_0005` swaps the baseline full `uq_projects_bt_number`
  constraint for a partial unique index (`WHERE deleted_at IS NULL`).
- New feature `backend/features/gh_api/` (repository/models/service/routes +
  `rate_limit.py`); router registered in `main.py`. Resolver route
  `GET /api/v1/gh/projects/{bt_number}` live with the three-tier access
  dependency, version resolution, envelope, and per-IP rate limiter.
- Tests: `backend/tests/test_gh_api_foundation.py` (15 passing) — resolver
  envelope, version matrix, auth matrix (anon/session/bearer/wrong-project/
  malformed), partial-index behavior, 429. `ty` clean.
- Open implementation decisions resolved: O7 (rate limiter). See
  `decisions.md` → "Resolved during implementation".

## Phase 02 outcome (2026-07-05)

- Dependency: `honeybee-ref==0.2.1` added (`uv add`); pinned to 0.2.1 because
  0.2.6 ships a broken module layout. Provides `honeybee_energy_ref`.
- Three composed routes on the Phase-01 router:
  - `GET /constructions/hbjson` — RICH `OpaqueConstruction.to_dict()` built from
    **real honeybee objects** (`features/gh_api/constructions_export.py`), not the
    hand-rolled web-download dict. PhColor (hex→`PhColor.from_rgb`), division grid
    (hybrid + steel-stud via `PhDivisionGrid`), `honeybee_energy_ref` datasheet/
    photo refs + `ph_nav` external id. Round-trips through `OpaqueConstruction.
    from_dict`.
  - `GET /aperture-types` — denormalized grid JSON
    (`features/gh_api/aperture_types_export.py`); inclusive spans → V1
    `row_number`/`col_span` counts; frames/glazing inlined; top-to-bottom rows.
  - `GET /aperture-constructions/hbjson` — thin wrapper over the existing
    `export_aperture_window_constructions`.
- Serializers share domain rules: `Assembly.layers_outside_to_inside()` (hoisted
  from both exporters), `asset_locator()` in `features/assets/base.py`,
  `reject_duplicate_names` in `features/gh_api/export_helpers.py`.
- Tests: `tests/test_gh_api_exports.py` (9) — round-trip parity, hybrid/steel-stud
  conductivity, flipped orientation, span mapping, 409/422, route smokes. `ty`
  clean; envelope/document suites still green.
- Decisions resolved: O1–O4 (see `decisions.md`). PRD §7 parity checklist updated.

## Phase 03 outcome (2026-07-05)

- `GET /tables/{table_name}` (`features/gh_api/tables_export.py`) serves the 12
  row-based element tables from a saved document, keyed by stable GH-external
  names (`TABLE_PATHS`, with a module-load drift guard tying each to a real
  `TableContract`). Reuses `read_table_envelope` for the tree walk.
- Payload: `records` (rows via `model_dump(mode="json")` — `custom_values`/
  `custom_links` passed through) + `field_defs` passthrough. Single-select values
  denormalized to `{id, label}` (O6) from a flat option index. Unknown name →
  422 listing valid names; empty table → `records: []`. Raw stored fields only.
- Tests: `tests/test_gh_api_tables.py` (8) — built-in + custom single-select
  denormalization, null/unknown-option handling, custom_values passthrough, 422,
  empty table, all-12-tables serialize, CPython client-shape smoke. `ty` clean.
- Decisions resolved: O5, O6 (see `decisions.md`).

## Blockers

- None (decisions pending are normal design inputs, not blockers).

## Verification

- Research is documentation-only; no code changed. Verified against source
  in the V1 backend repo, the V1 GH client repo, and V2 backend schemas /
  routes (see file references throughout `research.md`).
