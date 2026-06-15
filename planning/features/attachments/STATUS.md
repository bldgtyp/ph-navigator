# Attachments Status

DATE: 2026-06-15
TIME: 18:05 EDT
STATUS: COMPLETE (v1). All acceptance items verified; Phase-5 polish
        (parallel upload, reorder, grouped undo) is deferred by decision,
        not outstanding.
AUTHOR: Codex
SCOPE: Current state for fixed attachment cells, the asset backbone,
bulk download jobs, MCP asset tools, and remaining acceptance work.

## 2026-06-15 closeout progress

Bucket-A automated coverage landed; contract gaps resolved per the
"defer polish, prove read-only" decision:

- bulk-download zip / `MANIFEST.csv` / ordering / filename de-dup /
  filter / failure-payload coverage:
  `backend/tests/test_assets_bulk_download.py`;
- MCP asset-tool scope enforcement (`asset:read` / `asset:write`) and
  `bulk_attach` / `bulk_detach` partial-failure coverage:
  `backend/tests/test_assets_mcp.py`;
- orphan-sweeper dry-run protection of saved-version and active-draft
  references: `backend/tests/test_assets_orphan_sweeper.py`;
- locked-version read-only proof (attach/detach rejected with
  `version_locked`): `backend/tests/test_assets_locked_version.py`.

**Bug fixed:** `tool_bulk_attach` / `tool_bulk_detach` passed the
positional `asset_id` into `Attach/DetachAssetRequest` (which forbids
extras), so every MCP bulk attach/detach failed validation. The
positional id is now stripped before payload validation
(`backend/features/mcp/tools.py`). This path had no prior tests.

Contract updated: `context/technical-requirements/attachments.md` §A0
now records parallel `op_group_id` upload, modal-rail reorder, and
grouped undo as deferred Phase-5 polish, and locked-version read-only +
bulk download + MCP tools + orphan sweeper as required/proven.

Bucket-B external verification — **done 2026-06-15**: the opt-in R2 smoke
passed against the real `ph-navigator-v2-dev` bucket, and the full Render
staging browser checklist passed (PDF + image upload, PDF iframe preview,
native image preview, replace, detach, reload persistence after Save
Version, bulk-download `MANIFEST.csv` inspection, and the MCP
`list_assets` / `resolve_asset_urls` / `start_bulk_download` token smoke).
Evidence logged in
`phases/testing-verification-strategy.md` §2026-06-15. With bucket A,
the contract decision, and bucket B all landed, v1 attachments is
accepted **Complete**.

## Current Status

Attachments are no longer just planned. Substantial implementation has
landed on `main`, but the full feature is not accepted as complete.

Implemented code currently includes:

- asset persistence and job schema:
  `backend/alembic/versions/20260526_0011_project_assets_and_jobs.py`;
- REST asset routes for upload intent, complete upload, URL/download,
  bulk URLs, bulk download, attach, detach, rename, and delete:
  `backend/features/assets/routes.py`;
- the asset service, R2 storage client, thumbnailer, and GC sweeper:
  `backend/features/assets/`;
- the locked attachment-field registry:
  `backend/features/assets/registry.py`;
- registered attachment row-table contracts:
  `backend/features/project_document/tables/attachments.py`;
- MCP tools for `list_assets`, `resolve_asset_urls`,
  `start_bulk_download`, `bulk_attach`, and `bulk_detach`:
  `backend/features/mcp/tools.py` and `backend/features/mcp/server.py`;
- the shared frontend `AttachmentCell`:
  `frontend/src/features/assets/components/AttachmentCell.tsx`;
- envelope material datasheets and assembly-segment site photos in the
  Specifications panel:
  `frontend/src/features/envelope/components/SpecificationsPanel.tsx`;
- equipment datasheet cells on the current Equipment tables, including
  Pumps, Fans, Hot Water Heaters, Hot Water Tanks, and Appliances;
- Thermal Bridge attachment workbench panels for datasheets and
  simulation files:
  `frontend/src/features/assets/routes/ThermalBridgesPage.tsx`.

The canonical technical contract is
`context/technical-requirements/attachments.md`. `PRD.md` is now a
decision archive and AirTable-precedent record, not the status source of
truth.

## Implemented Roster

The code-backed fixed-field roster currently includes:

- `project_materials.datasheet_asset_ids`;
- `assembly_segments.photo_asset_ids`;
- `equipment_ervs.datasheet_asset_ids`;
- `equipment_pumps.datasheet_asset_ids`;
- `equipment_fans.datasheet_asset_ids`;
- `equipment_hot_water_heaters.datasheet_asset_ids`;
- `equipment_hot_water_tanks.datasheet_asset_ids`;
- `equipment_electric_heaters.datasheet_asset_ids`;
- `equipment_appliances.datasheet_asset_ids`;
- `thermal_bridges.datasheet_asset_ids`;
- `thermal_bridges.simulation_file_asset_ids`.

This is broader than the original attachment PRD roster, which listed
only ERVs, Pumps, and Fans for equipment. The stable requirements doc has
been updated to match current code.

## Evidence To Date

Automated evidence exists for:

- attachment field registry and document-reference extraction, currently
  strongest around Pumps:
  `backend/tests/test_assets_registry.py`;
- upload intent, fake-storage complete-upload, URL generation,
  attach/detach, magic-byte rejection, and content-hash dedup:
  `backend/tests/test_assets_service.py`;
- envelope material datasheet and segment site-photo attach/detach:
  `backend/tests/envelope/test_envelope_attachments.py`;
- the opt-in real R2 provider smoke:
  `backend/tests/integration/test_r2_assets.py`;
- equipment-table attachment delete/write behavior for Pumps, Fans, Hot
  Water Tanks, and Appliances:
  `frontend/src/features/equipment/__tests__/`.

Manual evidence exists in `phases/testing-verification-strategy.md` for
a local MinIO browser workflow and a Render staging Pumps PDF upload /
preview / download path on 2026-05-26.

## Acceptance Items — all resolved 2026-06-15

Every gate below is now either verified or explicitly deferred in the
stable contract (`context/technical-requirements/attachments.md` §A0):

- bulk download zip/manifest behavior has automated coverage —
  **done** (`backend/tests/test_assets_bulk_download.py`);
- MCP asset tools have permission and partial-failure tests —
  **done** (`backend/tests/test_assets_mcp.py`; also fixed a latent
  `bulk_attach`/`bulk_detach` validation bug);
- MCP staging smoke verifies `list_assets`, `resolve_asset_urls`, and
  `start_bulk_download` with a real project-scoped token — **done**
  (ledger §2026-06-15);
- real R2 opt-in smoke run with current staging/dev R2 env vars and the
  result logged — **done** (ledger §2026-06-15);
- browser staging acceptance covers image upload/preview/thumbnail,
  replace, bulk download manifest inspection, and the visual fallback
  chip — **done** (ledger §2026-06-15);
- remaining UX-contract gaps either implemented or deliberately
  downgraded in the contract — **done** (§A0).

Deferred by decision (Phase-5 polish, **not** acceptance blockers; see
contract §A0):

- sequential per-file upload kept; the parallel `op_group_id` upload
  coordinator is deferred;
- modal-rail reorder and grouped undo are deferred.

Proven and required:

- locked-version / read-only behavior across attachment surfaces —
  **done** (`backend/tests/test_assets_locked_version.py`).

## Next Steps

Feature is Complete for v1. No further work required before release. The
only attachment follow-on is the deferred v1.1 candidate
(`planning/features_v1.1/user-defined-attachment-fields/`), which remains
gated on real ad-hoc-column demand.

## References

- Stable contract:
  `context/technical-requirements/attachments.md`
- API contract:
  `context/technical-requirements/api.md` §9.10
- MCP contract:
  `context/technical-requirements/llm-mcp-schema.md` §10.3
- Asset row schema:
  `context/technical-requirements/data-model.md` §6.5
- DataTable attachment field type:
  `context/technical-requirements/data-table.md`
- Verification ledger:
  `planning/features/attachments/phases/testing-verification-strategy.md`
- Decision archive:
  `planning/features/attachments/PRD.md`
