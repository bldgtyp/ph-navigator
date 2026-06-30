---
DATE: 2026-06-30
TIME: 14:27 EDT
STATUS: Actioned — implementation tracked in `planning/features/mcp-write-loop/`; Phases 1–4 close the write loop and doc drift.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: The PH-Navigator runtime MCP server — `backend/features/mcp/`,
       `backend/features/apertures_mcp/`, the per-feature `mcp.py` tool modules
       (climate, project_location, project_climate_source,
       aperture_hbjson_export), token administration (REST + DB + frontend
       Project Settings UI), transport/auth wiring, and the canonical
       `llm-mcp-schema.md` contract. Out of scope: the Playwright/Codex MCP
       *clients* configured in `.mcp.json` (those are dev tooling, not this app's
       server).
RELATED: context/technical-requirements/llm-mcp-schema.md,
         context/PRODUCTION_DEPLOYMENT.md,
         context/technical-requirements/stack-auth-migration.md,
         context/PRD.md §10, context/user-stories/50-settings-ops-llm.md
METHOD: Read the full server wiring (`server.py`, `tools.py`), every tool
        module, helpers/service/models/repository/routes, the frontend token
        feature, both ops scripts, and the deploy config. Ran the 4 MCP test
        files (24 passed). Cross-checked the registered tool surface against the
        `llm-mcp-schema.md` "initial tool surface" list.
---

# MCP Review — PH-Navigator runtime MCP server

## TL;DR — where we left off

The MCP server is **live, mounted, deployed, and substantially more built-out
than the canonical spec doc describes.** It is not a stalled stub. ~3,600 LOC
of server code, 54 registered tools, all four scopes enforced, structured-error
envelope, 24 passing tests, and a wired token-issuance UI in Project Settings.

The implementation **diverged from `llm-mcp-schema.md` in both directions** —
it grew a large climate / model-viewer / aperture / project-lifecycle surface
the doc never listed, while several spec'd primitives (`query_table`,
`diff_versions`, catalog browse, generic document writes) were never built. The
doc is now the least trustworthy artifact in the system.

The **one structural gap that matters most**: an MCP agent can *edit the draft*
(envelope, apertures, custom-field schema, attachments) but **cannot commit it**
— there is no `save_draft` / `discard_draft` / `create_version` MCP tool, even
though the underlying service functions already exist. Every MCP write workflow
currently dead-ends at the draft and needs a human in the browser to Save. That
breaks the exact loop Ed described in the PRD ("update every Material … then
persist").

---

## 1. What exists today

| Aspect | State |
|---|---|
| Location | `backend/features/mcp/` (hub) + `features/apertures_mcp/` + per-feature `features/*/mcp.py` |
| Transport | Streamable HTTP, mounted at `app.mount("/mcp", phn_mcp.streamable_http_app())` (`main.py:104`); stdio via `scripts/mcp_stdio.py` (`PHN_MCP_TOKEN` env) |
| Auth | `PhNavigatorTokenVerifier`; transport requires `project:read`; per-tool finer scopes; tokens hashed (sha256), prefix-indexed, expiry + revocation + last-used touch |
| Tokens | DB table via Alembic `20260512_0006_mcp_tokens`; issued/listed/revoked over REST (`/api/v1/projects/{id}/mcp-tokens`), surfaced in the Project Settings modal |
| Output | Pydantic-validated envelopes, SI-canonical |
| Errors | `McpStructuredError` {code, message, request_id, recoverability, details}, per-code recoverability maps |
| Deploy | Production at `https://api.ph-nav.com/mcp` per `PRODUCTION_DEPLOYMENT.md` |
| Tests | `test_mcp.py`, `test_mcp_custom_fields.py`, `test_apertures_mcp.py`, `test_assets_mcp.py` — **24 passed** locally |
| Frontend `features/mcp/` | API + TanStack hooks + types only; no standalone UI by design (README documents the placeholder dirs) |

### 1.1 Registered tool surface (54 tools)

**Reads — project / lifecycle / status (8):** `list_projects`, `get_project`,
`get_project_location`, `get_project_sun_path`, `list_project_climate_sources`,
`list_versions`, `list_status_items`, `get_document`, `get_table`.

**Reads — climate reference (3):** `list_climate_datasets`,
`search_climate_locations`, `get_climate_location` (app-wide; token-gated but
not project-gated).

**Reads — envelope (5):** `list_envelope_assemblies`, `list_project_materials`,
`query_unfinished_envelope_work`, `report_material_catalog_drift`,
`report_missing_envelope_evidence`.

**Reads — apertures (5):** `list_aperture_types`, `get_aperture_type`,
`calculate_aperture_u_values`, `report_aperture_catalog_drift`,
`get_aperture_window_constructions`.

**Reads — model-viewer / HBJSON (8):** `list_hbjson_files`,
`get_hbjson_file_download_url`, `get_hbjson_model_data`, `list_hbjson_faces`,
`list_hbjson_spaces`, `list_hbjson_ventilation_systems`,
`list_hbjson_hot_water_systems`, `list_hbjson_shading_elements`.

**Reads — assets (3):** `list_assets`, `get_asset_url`, `resolve_asset_urls`.

**Writes — functional (semantic / relational) (17):**
- Envelope: `apply_envelope_command`
- Apertures: `apply_aperture_command`
- Custom-field schema (8): `add_/rename_/delete_/duplicate_custom_field`,
  `change_custom_field_type`, `edit_custom_field_options`,
  `set_custom_field_description`, `set_custom_field_formula`
- Attachments: `bulk_attach`, `bulk_detach`
- Model-tab files: `create_/rename_/delete_hbjson_file`
- Asset jobs: `start_bulk_download` (+ `get_job` to poll)
- Project lifecycle: `delete_project`, `restore_project`, `hard_delete_project`

**Writes — stubbed:** `replace_table` accepts the TB-17 signature and **always
rejects** with `mcp_write_deferred`.

---

## 2. Completeness — spec'd-but-not-built

Checked the `llm-mcp-schema.md` §10.3 "initial tool surface" against the code:

| Spec'd tool | Status | Note |
|---|---|---|
| `query_table` (typed filtered query) | **Absent** | Only `get_table` (whole-table) exists. The doc's whole §"`query_table` uses a constrained Pydantic query model" is unimplemented; agents must pull whole tables and filter client-side. |
| `diff_versions` | **Absent** | Ed's PRD names "diff cert submit between rounds 1 and 2" as a primary use case. |
| `list_catalog` / `get_catalog_record` | **Absent** | No MCP catalog browse (materials/apertures). |
| `update_document` (JSON-Patch) | **Absent** | Generic write; superseded in practice by semantic commands. |
| `replace_table` | **Stub** | Rejects until TB-17. |
| `save_draft` / `discard_draft` | **Absent (high impact)** | Service fns exist (`project_document/service.py`, `drafts.py`) but are **not** exposed as tools. |
| `create_version` | **Absent** | No save-as-new via MCP. |
| `update_project` (relational metadata) | **Absent** | REST has project PATCH; MCP has only the delete/restore/hard-delete lifecycle. |
| `download_project_json` / `download_table_json` | **Absent** | `get_document` returns the body inline; no signed-URL download path. |

**The write loop is half-built.** The semantic write tools all mutate *the token
owner's draft* (tagged `updated_via="mcp"`), which is correct — but nothing in
the MCP surface flushes that draft to a version or discards it. An MCP-only
client therefore cannot complete a "edit → save" task. This is the top
completeness gap and it is *cheap* to close (the service layer is done).

---

## 3. Accuracy — what's solid, what drifted

### 3.1 Solid / correct
- **Layered auth is right.** Transport-level `required_scopes=["project:read"]`
  + per-tool `project_access_or_error(..., scope)`. All four scopes
  (`project:read/write`, `asset:read/write`) are genuinely enforced — asset
  tools gate on `asset:read`/`asset:write`, not on `project:*`. The model
  forces `project:read` to be present, matching the spec's "no write-only
  tokens" rule.
- **Token acts as its issuer, re-resolved per call** (`project_access_for_token`
  re-reads the user + project each call), so a since-revoked issuing user fails
  closed. Soft-deleted projects raise a dedicated `McpProjectDeletedError` →
  `project_deleted` recoverable error carrying the restore window.
- **Structured-error envelope is consistent** and recoverability is mapped
  per-code (`_ENVELOPE_RECOVERABILITY`, `_SCHEMA_MUTATION_RECOVERABILITY`),
  defaulting unknown codes to `fatal` so clients don't auto-retry their own bugs.
- **SI-canonical, Pydantic-validated** outputs throughout.

### 3.2 Drift / risks
1. **`llm-mcp-schema.md` is stale in both directions (biggest accuracy
   problem).** It omits ~20 shipped tools (all climate, location + sun-path,
   `list_status_items`, project lifecycle, the entire HBJSON/model-viewer suite,
   `edit_custom_field_options`, `get_aperture_window_constructions`) and lists
   ~9 tools that don't exist (§2). The §10.3 "ships in v1 and is read/write
   capable from day 1 … Tool surface (initial)" framing reads as current spec
   but is really original intent. There is **no `context/mcp.md`** — the doc
   itself flagged it as "planned … added only when the corresponding code
   exists." That code now exists; the doc doesn't.
2. **TB-17 error-envelope hack.** Domain failures are raised as
   FastMCP `ToolError` with the structured envelope **JSON-encoded into the
   error message string** (`helpers.raise_mcp_error`). Clients must JSON-decode
   the message to get `code`/`recoverability`. Documented as interim; revisit
   when the SDK exposes first-class structured error content.
3. **Phase-5 token-scope intersection not built.** A token grants its issuer's
   full capabilities, narrowed only by `project_id` + the coarse scope set. No
   finer per-token capability cap. Known limitation (noted in
   `service.py:162`), not a bug.
4. **Deploy-config URL drift — verify.** `render.yaml` sets
   `MCP_ISSUER_URL` / `MCP_RESOURCE_SERVER_URL` to the
   `ph-navigator-v2.onrender.com` hostname, while `PRODUCTION_DEPLOYMENT.md`
   (and the live custom domain) use `api.ph-nav.com`. OAuth resource metadata
   and DNS-rebinding `allowed_hosts` derive from these. This may be intentional
   (allowlist also folds in `RENDER_EXTERNAL_URL`) or stale relative to the
   Render dashboard. **Verify the live dashboard values** rather than assume.
5. **Smoke coverage is read-only.** `smoke_mcp_read.py` lists tools + calls
   `list_projects`; it asserts a *subset* of 11 tool names (so it won't catch a
   dropped climate/model-viewer/aperture tool). No write smoke. Unit tests do
   cover the semantic write tools.

---

## 4. Next steps (prioritized)

> **Implementation packet:** P0 + the docs/discoverability work below are tracked
> in `planning/features/mcp-write-loop/` (4 phases). The decision in §5 is the
> basis for that packet.


**P0 — close the write loop (small, high value).** Expose `save_draft` and
`discard_draft` as MCP tools (wrap the existing
`project_document/service.py` functions, mirror the `apply_envelope_command`
auth/error pattern, gate on `project:write`). Add `create_version` if save-as-new
is wanted. Without these, no MCP write task can persist without a human.

**P1 — make the docs honest.** Author `context/mcp.md` as the canonical, accurate
tool inventory + scope matrix + error-envelope contract (ideally generated from
the registered surface so it can't drift). Demote `llm-mcp-schema.md` §10.3 to
"original intent / historical," and reconcile the two per
`planning/.instructions.md` rule #4.

**P1 — verify production.** Confirm the Render dashboard `MCP_*` values match
`PRODUCTION_DEPLOYMENT.md` (§3.2.4), then run `smoke_mcp_read.py` against
`https://api.ph-nav.com/mcp` with a real project token. Tighten the smoke to
assert the full expected tool set (or a generated count) so silent regressions
surface.

**P2 — read ergonomics for agents.** Build `query_table` (the spec'd typed,
LLM-friendly filtered query) and `diff_versions` (Ed's named cert-round-diff use
case). These are the highest-leverage *read* primitives still missing.

**P2 — catalog browse.** Read-only `list_catalog` / `get_catalog_record` so
agents can resolve catalog material/aperture records without the browser.

**P3 — parity + cleanup.** `update_project` (relational PATCH via MCP for REST
parity, wraps the existing `PATCH ""` → `patch_version`). The generic-write
decision is resolved in §5 below: **finish `replace_table`, kill
`update_document`.**

**P3 — write smoke.** Add a write smoke (issue draft command → read back →
discard) once `save_draft`/`discard_draft` land.

---

## 5. Generic-write backlog — investigated (decision resolved)

The open question from the first pass was whether the generic-write backlog
(`replace_table`, `update_document`, `query_table`) is still wanted or has been
superseded by semantic commands. Investigated the actual write architecture
(`features/project_document/routes.py`, `tables/registry.py`, the envelope/
aperture command routes) and the answer is decisive.

### 6.1 What shipped is a hybrid — and the browser uses both forms

The PRD's original day-1 vision was **JSON-Patch writes** (`update_document`).
That was abandoned. **No JSON-Patch write path exists anywhere** — not for MCP,
not for the browser (`grep` for `json_patch`/`apply_patch`/`patch_draft` is
empty). What actually ships is two write forms, both exercised by the browser:

| Write surface | Mechanism | REST route | Tables served |
|---|---|---|---|
| Semantic commands | domain command → validated service | `POST /draft/envelope/commands`, `POST /apertures/command` | `assembly_segments`, `project_materials`, `apertures` (**3**) |
| Custom-field DDL | typed `FieldSchemaMutation` | `POST /draft/tables/{t}/custom-fields:mutate` | all field-config tables |
| **Generic whole-table replace** | replace a table's rows wholesale, `draft_etag`-guarded, with a `:preview-replace` dependent-link dry-run | **`PUT /draft/tables/{table_name}`** → `replace_table_slice` | **all 14 other tables** |

The 17 registered table contracts (`tables/registry.py:_TABLES`): the 3
semantic ones above, plus the 14 generic-replace tables — `rooms`,
`space_types`, `thermal_bridges`, `pumps`, `fans`, `ventilators`, `appliances`,
`electric_heaters`, `hot_water_heaters`, `hot_water_tanks`, and the four
`heat_pumps_*` tables.

### 6.2 The consequence for MCP

`get_table` serves all 17 (read), but the only MCP write tools are the 3
semantic surfaces + custom-field DDL + attachments. **`replace_table` is the
sole write path for the 14 flat tables, and it is stubbed to reject.** So an MCP
agent today **cannot edit a single Room, heat pump, ERV, hot-water heater, or
thermal bridge** — exactly the bulk-edit work PRD §10.1 names as the reason MCP
exists ("list every Room with occupancy > 4", "update every equipment spec").

### 6.3 Decision

- **KEEP & finish `replace_table`.** It is not superseded — it is the browser's
  own generic write and the only write path for 14/17 tables. Wire the stub to
  the existing `replace_table_slice` service; etag concurrency (§8.5) and the
  cascade-safe `:preview-replace` dry-run already exist. Thin wrapper, not new
  infrastructure. This is the real write-parity unlock (pairs with the P0
  `save_draft`/`discard_draft` work — replace edits the draft, save commits it).
- **KILL `update_document` (JSON-Patch).** Dead architecture; whole-table
  replace won. Remove it from `llm-mcp-schema.md`.
- **`query_table` is orthogonal** — a *read* ergonomics item (server-side filter
  vs. whole-table pulls via `get_table`), unrelated to the write decision. Keep
  on the backlog at medium priority; `diff_versions` (REST `GET /diff` already
  exists) is the higher-value read add.

### 6.4 Doc-consistency bug found en route

`save-versioning.md` is internally contradictory: §8.2/§8.3 still describe
"JSON-Patch ops sync to the draft buffer" and an `unguarded_array_patch`
rejection, while §8.5 correctly describes whole-table replace — and the code
only implements the latter. The JSON-Patch language in §8.2/§8.3 is stale and
should be corrected when `llm-mcp-schema.md` is reconciled (P1).

---

## 6. Bottom line

This is a real, deployed, well-architected surface — not abandoned scaffolding.
The auth model, error envelope, and semantic-command write design are sound and
ahead of the spec. The work to "finish" it is mostly (a) exposing the
already-built draft save/discard so write workflows can complete, (b) replacing
the stale spec with an accurate `context/mcp.md`, and (c) verifying the prod
deploy config. The ambitious generic-write/query backlog (`query_table`,
`update_document`, `diff_versions`, catalog browse) is genuinely unbuilt and
should be re-scoped against what the semantic tools already cover before more is
poured in.
