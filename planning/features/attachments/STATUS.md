# Attachments Status

DATE: 2026-06-05
TIME: 20:46 EDT
STATUS: In review; partially implemented on `main`. Not complete.
AUTHOR: Codex
SCOPE: Current state for fixed attachment cells, the asset backbone,
bulk download jobs, MCP asset tools, and remaining acceptance work.

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
  Pumps, Fans, Hot Water Tanks, and Appliances;
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

## Open Acceptance Items

Do not mark this feature `Complete` until these are either verified or
explicitly deferred in the stable contract:

- bulk download zip/manifest behavior has automated coverage;
- MCP asset tools have permission and partial-failure tests;
- MCP staging smoke verifies `list_assets`, `resolve_asset_urls`, and
  `start_bulk_download` with a real project-scoped token;
- real R2 opt-in smoke has been run with current staging/dev R2 env vars
  and the result is logged;
- browser staging acceptance covers image upload/preview/thumbnail,
  replace, bulk download manifest inspection, and the current visual
  fallback chip;
- remaining UX-contract gaps are either implemented or deliberately
  downgraded in `context/technical-requirements/attachments.md`.

Known implementation gaps relative to the current contract include:

- frontend upload currently loops files sequentially through
  `uploadAsset`; it is not the PRD's parallel upload coordinator with an
  `op_group_id`;
- modal rail reorder and grouped undo semantics are not proven;
- full locked-version/read-only behavior is not yet proven across every
  attachment surface;
- Phase 5 polish remains deferred and should not block MVP acceptance.

## Next Steps

1. Add backend coverage for bulk download zip creation,
   `MANIFEST.csv`, filter behavior, and failure payloads.
2. Add MCP asset-tool tests for `asset:read`, `asset:write`, forbidden
   scopes, and partial failures.
3. Run the opt-in R2 smoke:
   `cd backend && RUN_R2_INTEGRATION=1 uv run pytest tests/integration/test_r2_assets.py`.
4. Run the staging browser checklist from
   `phases/testing-verification-strategy.md`: PDF, image, replace,
   detach, bulk download manifest, and MCP token smoke.
5. Resolve contract-vs-code gaps. Either implement parallel upload /
   reorder / grouped undo, or explicitly revise the stable contract to
   say those are deferred.
6. After the acceptance work lands, run the closeout gate from repo root:
   `make format && make ci`, then update this file and `planning/STATUS.md`
   to `Complete` only if all required evidence is present.

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
