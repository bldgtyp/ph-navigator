# PLAN: Grasshopper Data API — implementation sequence

```
DATE:    2026-07-05
TIME:    13:05
STATUS:  Active
AUTHOR:  Claude (with Ed)
SCOPE:   High-level phase sequence for PRD.md. Phases 1–3 live in this repo
         (backend); Phases 4–5 live in honeybee_grasshopper_ph_plus.
RELATED: PRD.md, research.md, STATUS.md, decisions.md, phases/
```

> **Handoff docs:** each phase below has a detailed implementation plan in
> `phases/phase-NN-*.md` (requirements, references, validation, testing,
> acceptance gates). Agents implement from those, not from this summary.

## Phase 1 — Backend foundation (this repo)

1. Alembic migration: partial unique index on `projects.bt_number`
   (`WHERE deleted_at IS NULL`). Normalize/trim on write if not already.
2. New feature `backend/features/gh_api/` (routes/models/service/repository
   layering per `context/CODING_STANDARDS.md`):
   - Router `/api/v1/gh/projects/{bt_number}` (GET-only), rate-limited.
   - Access dependency: session cookie → bearer `phn_mcp_...`
     (`authenticate_plaintext_token` + project-scope check, acts-as-issuer)
     → anonymous viewer. Scoped to this router only.
   - bt_number→project resolver + version resolution (latest via
     `active_version_id`; `?version=` pinning; saved versions only).
   - Common response envelope model (`schema_version`, `project`,
     `version_id`, `last_modified`).
   - Resolver/metadata route `GET /` with version list.
3. Tests: resolver, version resolution, auth matrix (anon / bearer / bad
   bearer / wrong-project bearer), 404/422 shapes.

**Gate:** `make ci` green; route smoke via curl.

## Phase 2 — Composed export routes (this repo)

1. `GET /constructions/hbjson` — extend/reuse `envelope/hbjson_export` to
   emit the **rich** V1-parity payload (PhColor, division grid, datasheet /
   photo refs, `ph_nav` external ids). This is the main new serializer work.
2. `GET /aperture-types` — denormalized aperture-grid JSON (join
   `project_glazings` / `project_frames` inline; map V2 span tuples → V1
   `row_number`+`row_span` shape; top-to-bottom row order; include
   `operation`, `psi_install_w_mk`, decide `chi_value`).
3. `GET /aperture-constructions/hbjson` — thin wrapper over the existing
   `aperture_hbjson_export` service.
4. Golden-payload parity tests vs V1 fixture outputs (constructions +
   aperture-types); PRD §7 checklist items each get a test or a documented
   exception.

**Gate:** parity checklist §7 all checked or explicitly waived; `make ci`.

## Phase 3 — Generic tables route (this repo)

1. `GET /tables/{table_name}` with the 12-name allowlist (external names →
   document paths, e.g. `ventilators` → `equipment.ervs`,
   `heat_pump_indoor_units` → `equipment.heat_pumps.indoor_units`).
2. Denormalization pass: single-select option ids → id+label; resolve
   cross-table references (e.g. indoor unit → outdoor_unit_id) as ids
   (documented), not deep nesting.
3. Tests per table on a seeded fixture; unknown-name 422 lists valid names.

**Gate:** `make ci`; CPython client-shape smoke (consume routes the way the
IronPython client will).

## Phase 4 — GH shared client + version switch (honeybee_grasshopper_ph_plus)

1. `PHNavV2Client` (IronPython-2.7-safe): WebClient, TLS 1.2, optional
   bearer, single parse, envelope `schema_version` check.
2. Add `version` switch to `constructions_get.py` / `window_types_get.py`
   (+ new `_version_id_`, `_token_` optional inputs); V2 parse path; outputs
   unchanged. Update the GH user-object components.
3. Ed manual gate: run both components in Rhino against local + production
   V2 projects; verify colors/refs arrive on constructions and window-type
   geometry bakes identically to V1.

## Phase 5 — New V2 element getter components (honeybee_grasshopper_ph_plus)

1. Per-element builder components for the 12 tabular types (records →
   honeybee-PH objects), batched by domain: (a) rooms/space types/thermal
   bridges; (b) ventilation + hydronics (ventilators, fans, pumps);
   (c) hot water (heaters, tanks); (d) heat pumps (indoor/outdoor) +
   electric heaters + appliances.
2. Retire the AirTable download path for PH-Nav-V2 projects once all
   builders land.

Likely multi-session; sequence/batching decided when Phase 4 is proven.

## Cross-cutting

- Closeout gate (simplify, docs-pass, `make format`, `make ci`) after each
  backend phase.
- Production deploy notes: new router is additive; the bt_number unique
  index is the only migration — run while prod tables are small.
- Keep the GH wire contract (`schema_version`) documented in this folder;
  bump only with a compatibility note for the plugin side.
