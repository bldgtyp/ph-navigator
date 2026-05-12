---
DATE: 2026-05-11
TIME: 18:48 EDT
STATUS: Draft phasing plan. Created while splitting `context/USER_STORIES.md`
        into phase/domain files.
AUTHOR: Ed May (with Codex)
SCOPE: MVP implementation sequencing for PH-Navigator V2. Use this as
       the execution-level companion to `context/USER_STORIES.md`.
RELATED: context/USER_STORIES.md, context/user-stories/,
         context/PRD.md, context/UI_UX.md, context/DATA_TABLE.md
---

# PH-Navigator V2 — Vertical-Slice Phasing

## Intent

Build PHN-V2 in thin, manually verifiable slices. Each slice should
include backend, frontend, migrations, tests, seed data, and enough UI
to click through a real workflow. Avoid large hidden subsystems that
cannot be exercised until weeks later.

This plan intentionally starts with a boring but complete path:
sign in -> create project -> open project -> edit one table -> draft /
Save / Save As / lock -> public read -> JSON download.

## Story Files

`context/USER_STORIES.md` is now only the routing and phasing layer.
Canonical story bodies are split by phase/domain:

| File | Use for |
|---|---|
| `context/user-stories/00-foundation-shell.md` | Auth, dashboard, project shell, Status, concurrency, schema fallback |
| `context/user-stories/30-tables-equipment.md` | Shared table primitive and first document-edit slice |
| `context/user-stories/10-windows.md` | Catalog-backed Windows builder |
| `context/user-stories/20-envelope.md` | Envelope, assemblies, materials, specs, airtightness, site photos |
| `context/user-stories/40-model-viewer.md` | HBJSON upload, parse, and R3F Model tab |
| `context/user-stories/50-settings-ops-llm.md` | Settings, logging, MCP/asset API |
| `context/user-stories/90-open-questions.md` | Open/resolved question index cleanup |

## Phases

| Phase | Goal | Done when |
|---|---|---|
| 0. Scaffold + environment | Backend/frontend/DB boot; migrations run; security/ops baseline exists: health/version, request ids, structured errors/logging, auth/session guardrails, idempotency. | `make setup`, `make smoke`, sign-in route, dashboard shell visible. |
| 1. Project shell + Status | Signed-in editor can create/open a project and land on Status. Viewer read-only shell works from same URL. | Create project -> `/projects/{id}/status`; apply default Status template; open project as Viewer. |
| 2. First document-edit slice | `ProjectDocumentV1`, draft buffer, ETags, Save/Save As/Discard/Lock, JSON download, one editable table. Use Rooms to prove `<DataTable>` + document persistence. | Add/edit Rooms; reload draft; Save; Save As; lock; public read; project/table JSON validates. |
| 3. Catalog + Windows | Catalog CRUD/pick proves bookshelf copy model. Windows builder proves non-table custom UI against the same draft/save contract. | Add frame/glazing catalog rows in one tab; pick into Window Type in another; save/reload; refresh-from-catalog works for one entry. |
| 4. Envelope + assets | Assemblies, Project Materials, Specifications, asset backbone, effective R/U display, envelope export. | Build one wall assembly; pick material; attach datasheet/photo; Viewer sees read-only docs; export construction data. |
| 5. Model viewer | HBJSON upload/metadata, model-data endpoint, R3F canvas, core viewer controls. | Upload two HBJSONs; switch active file; render nonblank 3D scene; select/measure/color-by basics work. |
| 6. MCP + mechanical completion | Harden MCP read/write, asset ingestion, edit lease UX, ERV/Fan tables, placeholders for TB/Pumps. | MCP uploads and attaches a datasheet; browser shows MCP edit lease; ERV/Fan rows save/reload. |
| 7. Release hardening | Verify security/ops baseline under staging, bundle/perf budgets, e2e coverage, remaining open questions triaged. | Full MVP smoke on staging with seed project and one imported V1 project. |

## Phase 0 Checklist

- [ ] Backend app starts with `/api/v1/health` and `/api/v1/version`.
- [ ] Frontend app starts and can reach backend health.
- [ ] Postgres Docker path works from `make dev`.
- [ ] Alembic baseline migration exists.
- [ ] Seed user/project command exists.
- [ ] Structured error response shape exists.
- [ ] Request id flows through response headers and logs.
- [ ] Minimal auth/session tables and sign-in route exist.
- [ ] Auth stores Argon2id password hashes, or bcrypt cost >= 12 if
      Argon2id is explicitly deferred during scaffold.
- [ ] Session ids are UUIDv4; single-active-session is enforced by a
      partial unique index on active sessions.
- [ ] Mutating browser requests enforce the configured Origin/CORS
      allow-list; no wildcard credentialed CORS.
- [ ] Mutating REST writes accept `Idempotency-Key` with 24h replay
      semantics scoped to `(user_id, route, key)`.
- [ ] JSON logs include `request_id` and authenticated user/project/
      version context when available.

## Phase 1 Checklist

- [ ] Dashboard lists owned projects.
- [ ] New Project modal creates project, optional multi-value
      `cert_programs`, and initial `Working` version.
- [ ] Project opens at `/projects/{id}/status`.
- [ ] Status default template can be applied.
- [ ] Project shell renders header, tab bar, version dropdown placeholder,
      and Viewer read-only state.
- [ ] Project settings metadata edit path is stubbed or scoped clearly.

## Phase 2 Checklist

- [ ] `ProjectDocumentV1` Pydantic model + JSON Schema generated.
- [ ] Draft row lazily created on first edit.
- [ ] Draft patch uses ETags and guarded JSON-Patch.
- [ ] Save, Save As, Discard, Lock, and locked Save As all work.
- [ ] Save / Save As update `projects.last_saved_at`,
      `project_versions.updated_at`, and
      `project_versions.body_size_bytes` through the version-save
      service; draft patch does not update them.
- [ ] Rooms table uses shared `<DataTable>` path.
- [ ] `<DataTable>` write queue is optimistic + FIFO; Save / Save As
      flush pending writes before version save.
- [ ] Paste coercion preflights the full paste and blocks partial
      commits on structured coercion errors.
- [ ] Paste/row insert uses frontend-generated final ULID-style row ids;
      backend validates and preserves them. No `tmp-` id remapping.
- [ ] Computed fields render backend-owned overlay values with
      loading/stale/error states; frontend does not recompute domain
      values.
- [ ] Rooms `floor_level` / `building_zone` prove single-select
      lifecycle: create, rename, reorder, duplicate-label rejection,
      delete handling, merge, and missing-option validation.
- [ ] Project JSON and Rooms table JSON downloads validate.
- [ ] Draft restore prompt appears after reload.
- [ ] `US-Versions-Lifecycle` is covered: Submit / Close Save As,
      Discard, restore draft, Compare versions, and saved JSON
      downloads.
- [ ] Same-editor two-tab workflow follows `US-Concurrency`.

## Phase 3 Checklist

- [ ] Units helpers live under `frontend/src/lib/units/` with
      quantity-specific APIs, not a generic units package.
- [ ] V1 unit converter/context files are used as research templates:
      `../ph-navigator/frontend/src/formatters/Unit.Converter.ts`,
      `Unit.ConversionFactors.ts`, `useUnitConversion.tsx`,
      `UnitSystemContext.tsx`, and `UnitSystemToggle.tsx`.
- [ ] V1 Window Builder dimension parser/formatter files and tests are
      ported/adapted from
      `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/`.
- [ ] Thermal conversion factors are verified with fixtures before V2
      use.
- [ ] Windows dimensions parse/format round-trip in SI and IP display
      formats before Window Builder editing ships.
- [ ] Refresh-from-catalog uses field-level
      `catalog_origin.local_overrides`; user-edited fields default to
      Keep mine, all fields require explicit choice, and Review all is a
      report with per-entry actions only.

## Notes For Later Refinement

- Phase 2 is the forcing function for most cross-cutting correctness:
  draft state, ETags, schema, public read, JSON download, and DataTable.
- Phase 3 should not start until Phase 2 proves one document table
  end-to-end.
- Phase 4 should reuse the asset backbone that Phase 6/MCP will later
  expose to agents.
- Phase 7 should absorb the remaining docs-review items: security
  baseline, operational baseline, resolved-question archive, and
  open-question cleanup.
