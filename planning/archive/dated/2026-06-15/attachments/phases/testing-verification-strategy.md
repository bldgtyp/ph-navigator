---
DATE: 2026-05-26
TIME: 07:53 ET
STATUS: Active verification strategy. Pumps now provides the first
        real Equipment attachment table.
AUTHOR: Codex
SCOPE: Recommended local, mocked, Cloudflare R2, and Render staging
       verification strategy for the Attachments feature.
RELATED:
  - planning/features/attachments/PRD.md
  - planning/features/attachments/phases/phase-00-storage-backbone.md
  - planning/features/attachments/phases/phase-01-site-photo-cell.md
  - planning/features/attachments/phases/phase-02-datasheet-cells.md
  - planning/features/attachments/phases/phase-03-thermal-bridge-cells.md
  - planning/features/attachments/phases/phase-04-bulk-jobs-mcp.md
  - planning/archive/dated/2026-05-26/complete/plan-20-pumps-table-reuse-test.md
---

# Plan 29 - Attachments Testing And Verification Strategy

## P0. Decision

Do **not** make Render + real Cloudflare R2 the first meaningful test
for Attachments.

The attachment feature crosses four boundaries:

- project-document draft writes;
- browser upload / preview / detach UX;
- object storage signed PUT/GET behavior;
- deployment credentials, CORS, bucket policy, and lifecycle behavior.

Testing all four only at staging would make failures slow to diagnose.
The better strategy is layered verification:

1. default automated tests use fake/local S3-compatible storage;
2. local browser smoke uses the real frontend/backend with local object
   storage;
3. real Cloudflare R2 is exercised only by an opt-in integration smoke;
4. Render staging is the final acceptance gate.

## P1. Why Not Cloudflare In Every Test

Real R2 tests should not run on every `pytest`, CI push, or local
developer loop.

Reasons:

- external network and credential dependency makes the suite flaky;
- repeated uploads create avoidable bucket churn and cost/noise;
- object cleanup failures accumulate state outside the repo;
- Cloudflare outages or policy changes would block unrelated backend
  tests;
- fast feedback should validate our code paths without depending on a
  remote provider.

Cloudflare still needs coverage, but it should be explicit and
intentional.

## P2. Recommended Test Layers

### P2.1 Layer 1 - Default Automated Tests

Run on every local and CI test pass.

Storage backend:

- `moto`, MinIO, or LocalStack;
- no real Cloudflare credentials;
- no public internet dependency.

Recommended assertions:

- upload intent creates a pending `project_assets` row;
- signed PUT URL can receive fixture bytes in the fake bucket;
- `complete-upload` validates size and MIME magic;
- duplicate content hash returns the existing `asset_id`;
- corrupt PDF marks thumbnail failure without losing original download;
- PDF/image thumbnailer writes the expected sibling object;
- signed URL responses include original download and thumbnail metadata;
- attach / detach mutates the correct draft attachment array;
- cross-project asset references are rejected;
- bulk URL resolution preserves requested asset order;
- bulk download creates a zip asset plus `MANIFEST.csv`;
- MCP read tools require `asset:read`;
- MCP write tools require `asset:write` and project write access;
- orphan sweeper dry-run protects assets referenced by saved versions or
  active drafts.

This layer proves most of the feature without touching Cloudflare.

### P2.2 Layer 2 - Local App Integration

Run before staging. This should exercise real browser behavior against
local services:

- Postgres in Docker;
- FastAPI backend;
- Vite frontend;
- local S3-compatible object storage, preferably MinIO or LocalStack.

Recommended workflow:

1. create or open a dev project;
2. open a real Equipment table with a predefined locked attachment
   field;
3. upload a tiny PDF datasheet;
4. upload a small JPG/PNG where image preview matters;
5. verify thumbnail strip, modal preview, download, replace, detach, and
   reload;
6. verify draft ETag conflict behavior if another draft modifies the
   same row;
7. run bulk download for the table/field and inspect zip + manifest.

This layer should catch frontend state bugs, cell renderer issues,
signed upload mechanics, and draft round-trip mistakes before deployment
enters the picture.

## P3. Real Equipment Table Surface

Rooms is not a good attachment test surface because it has no attachment
field.

The right product-shaped test is a real Equipment table with a
predefined locked attachment field. Pumps is now that table.

Current Pumps attachment surface:

- document path: `tables.equipment.pumps[*].datasheet_asset_ids[]`;
- table / registry key: `equipment_pumps.datasheet_asset_ids`;
- frontend table: Equipment -> Pumps -> `Datasheet` column;
- backend row field: `PumpRow.datasheet_asset_ids`.

Recommended Pumps attachment shape:

- `datasheet_asset_ids: string[]`;
- asset kind: `datasheet`;
- MIME allow-list: PDF plus images if we decide manufacturer cutsheets
  may arrive as scans;
- locked app-defined field, not user-extensible;
- visible in the Equipment tab as the first non-Rooms proof of
  DataTable reuse.

Rationale:

- Pumps is simpler than ERVs/Fans/Thermal Bridges;
- it has real datasheet semantics;
- it exercises a normal Equipment workflow;
- it proves attachments in a proper DataTable-backed feature rather
  than a temporary panel-only surface.

Use Pumps for the next verification passes, starting with backend
registry / reference tests for `equipment_pumps.datasheet_asset_ids`,
then the local app integration workflow against the Equipment Pumps
Datasheet column.

## P4. Cloudflare R2 Integration Smoke

Add one opt-in test or script that exercises Cloudflare R2 directly.

Status on 2026-06-05: **test implemented; run evidence still needed**.
Cloudflare R2 dashboard setup is complete for the staging/dev bucket:

- bucket `ph-navigator-v2-dev` exists;
- public access is disabled;
- CORS allows `http://localhost:5173`, `http://127.0.0.1:5173`, and
  `https://ph-navigator-v2-staging.onrender.com` for `PUT`, `GET`, and
  `HEAD`;
- lifecycle cleanup is enabled for objects under `projects/` after 90
  days;
- a scoped R2 token exists for `ph-navigator-v2-dev` with object
  read/write permissions.

Progress:

- copied the rolled token's `Account ID`, `Access Key ID`, and
  `Secret Access Key` into Render staging as `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`;
- confirmed the Cloudflare `Token value` is kept for token management
  and is not the boto3 `R2_ACCESS_KEY_ID`;
- added `backend/tests/integration/test_r2_assets.py` as the opt-in
  provider smoke.

Next gate: run the opt-in real R2 smoke with current Render/staging R2
env vars available and record the result in this file, then move to the
Render browser acceptance checklist.

It should be disabled by default and require an explicit flag:

```bash
cd backend && RUN_R2_INTEGRATION=1 uv run pytest tests/integration/test_r2_assets.py
```

Recommended behavior:

- require `R2_ENDPOINT_URL`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and
  `R2_SECRET_ACCESS_KEY`;
- use the dev bucket only;
- write to an isolated prefix such as
  `integration-tests/{timestamp-or-run-id}/...`;
- upload tiny fixtures only;
- delete objects in a `finally` block;
- rely on bucket lifecycle as backup cleanup, not primary cleanup.

Recommended assertions:

- signed PUT URL accepts PDF/image fixture bytes;
- `head_object` returns expected content length and metadata;
- signed GET URL returns the exact original bytes;
- copy + delete works for orphan-sweeper object moves;
- generated URLs expire within the configured TTL window.

This test validates provider integration without running the whole PHN
application or creating project-document state.

## P5. Render Staging Acceptance

Render staging should be the final acceptance gate, after Layers 1-3
pass.

Status on 2026-05-26: **core PDF path complete; broader checklist
partially complete**. Render was redeployed with the Cloudflare R2 env
vars and the live browser upload path was verified against staging using
the Pumps table.

Live staging evidence:

- frontend: `https://ph-navigator-v2-staging.onrender.com`;
- backend: `https://ph-navigator-v2.onrender.com`;
- backend health `GET /api/v1/health` returned `200`;
- login as the staging seed editor returned `200` with a secure
  `SameSite=none` session cookie;
- staging project created:
  `42e4e17e-1f4d-4819-998b-20a3a40516a1`
  (`R2-701939 - R2 Render Smoke 701939`);
- Pumps row inserted in the working draft;
- PDF datasheet uploaded from the browser:
  `phn-render-r2-smoke.pdf`;
- `POST /assets/upload-intent` returned `200`;
- signed browser `PUT` to
  `f9d264cceb6b9b13ad80ff784318975f.r2.cloudflarestorage.com/ph-navigator-v2-dev/.../file.pdf`
  returned `200`;
- `POST /assets/{asset_id}/complete-upload` returned `200`;
- `GET /assets/bulk-urls?...` returned `200`;
- reload in the same browser session kept the attachment thumbnail;
- preview modal opened with the expected filename;
- signed R2 `GET` for the original PDF returned `200`;
- console warnings/errors: none.

Screenshots saved outside the repo:

- `/tmp/phn-render-after-attach.png`;
- `/tmp/phn-render-preview.png`;
- `/tmp/phn-render-detach-debug.png`.

Repeatable upload/download fixture:

- `backend/tests/fixtures/attachments/phn-attachment-upload-verification-v1.pdf`;
- visible text:
  `PH-Navigator attachment upload verification fixture v1`;
- size: 646 bytes;
- SHA-256:
  `be829e43656e29afb319822b4b5758fe356daad0fc332677e41f29522fa47253`;
- verified with `file` as PDF 1.4, one page, and loaded with
  `pypdfium2.PdfDocument`.

Manual staging continuation on 2026-05-26:

- tested project:
  `https://ph-navigator-v2-staging.onrender.com/projects/c9c152fb-ab96-491b-b982-238450d5e584/equipment`;
- used Pumps row `P-01` with an empty Datasheet field;
- uploaded
  `backend/tests/fixtures/attachments/phn-attachment-upload-verification-v1.pdf`
  by drag/drop into the active Datasheet cell;
- UI flashed upload state, then rendered the `PDF` attachment chip;
- download worked;
- Cloudflare dashboard confirmed `projects/` plus project/object folders,
  with `file.pdf` at 646 B and `thumb.png`;
- project was saved;
- after logout/login, the attachment was still present in the Datasheet
  cell.

Defects found during manual staging:

- double-clicking the PDF chip opened the preview modal but also triggered
  a download;
- PDF preview modal opened, but the iframe area was blank.
- after the preview/download URL fix, PDF preview rendered correctly, but
  sticky/frozen table cells painted through the modal/iframe.
- after the portal fix, the modal stayed above the grid, and the
  remaining visible issue was the fallback attachment chip rendering as
  an ambiguous empty rounded square in the table cell.

Root cause/fix: the frontend used `download_url` for PDF/image preview
and "Open in new tab"; the backend signs `download_url` with
`Content-Disposition: attachment`, which causes browser download behavior
and prevents reliable iframe preview. Added a separate `preview_url` /
`preview_expires_at` without attachment disposition and changed the modal
preview/open paths to use `preview_url`. The explicit Download button
continues to use the API download route.

Modal layering fix: `<AttachmentModal>` originally rendered inside the
table cell subtree, so the DataTable's sticky/frozen cell stacking
contexts could paint above it. The modal now renders through a React
portal into `document.body`, keeping the attachment preview above the
grid.

Attachment-chip visual refinement: the no-thumbnail fallback previously
rendered as a large empty rounded square with tiny text, which read
poorly in a compact table row. It now renders as a small document-style
thumbnail with a folded corner and PDF/JSON/FILE label, closer to the
AirTable attachment-cell precedent.

Remaining staging acceptance items after the core PDF path:

- redeploy the attachment-chip visual refinement and re-check the Pump
  Datasheet cell against the AirTable-style attachment precedent;
- upload one image and confirm image preview/thumbnail behavior;
- replace an attachment and confirm ordering/selection behavior;
- run bulk download and inspect the zip manifest;
- use an MCP token to `list_assets`, `resolve_asset_urls`, and
  `start_bulk_download`.

Status on 2026-06-05: no newer staging run was found in the planning
docs. Treat the items above as still open until a fresh run is logged.

Staging setup:

- Render backend connected to dev Postgres;
- frontend deployed against staging backend;
- `R2_BUCKET=ph-navigator-v2-dev`;
- current migration applied;
- CORS and signed upload behavior verified in browser.

Recommended staging workflow:

1. create a staging project;
2. open the real Equipment attachment table;
3. upload one PDF datasheet;
4. upload one image;
5. reload the page and confirm attachment ids still render;
6. open preview modal and download original bytes;
7. detach and confirm the draft updates;
8. replace with a second file and confirm order/selection behavior;
9. run bulk download and inspect the zip manifest;
10. use an MCP token to `list_assets`, `resolve_asset_urls`, and
    `start_bulk_download`.

If Thermal Bridges are available by then, add one `.hbjson` simulation
file smoke. Do not block the core Pumps/datasheet path on Thermal Bridge
availability.

## P6. What To Automate Now Vs Later

Automate now:

- attachment field registry tests; **done for Pumps on 2026-05-26**
  via `backend/tests/test_assets_registry.py`;
- backend asset service tests with fake storage; **done for the Pumps
  datasheet happy path on 2026-05-26** via
  `backend/tests/test_assets_service.py`;
- draft attach/detach tests; **done for Pumps and envelope
  material/site-photo paths** via `backend/tests/test_assets_service.py`
  and `backend/tests/envelope/test_envelope_attachments.py`;
- bulk download zip/manifest tests; **still open on 2026-06-05**;
- MCP asset tool permission tests; **still open on 2026-06-05**;
- orphan sweeper dry-run tests.

Automate next, now that Pumps has landed:

- frontend attachment cell tests against real Equipment tables;
  **done for delete/write behavior on Pumps, Fans, Hot Water Heaters, Hot Water Tanks,
  and Appliances** via `frontend/src/features/equipment/__tests__/`;
- Playwright local browser workflow for upload / preview / detach /
  reload;
- Render staging checklist, possibly as a manual release checklist
  first.

Keep manual / opt-in:

- real Cloudflare R2 integration;
- Render staging browser acceptance;
- MCP smoke against staging.

## P7. Recommended Next Step

Current order:

1. **Done 2026-05-26:** add focused backend coverage for the Pumps
   attachment registry and document reference path.
2. **Done 2026-05-26:** add fake-storage backend coverage for the
   Pumps datasheet upload / attach / detach path.
3. **Done 2026-05-26:** add frontend attachment cell tests against
   the real Pumps table.
4. **Done 2026-05-26:** run local browser workflow against local object
   storage.
5. **Done by 2026-06-05:** add the opt-in R2 smoke file at
   `backend/tests/integration/test_r2_assets.py`.
6. **Next:** run the opt-in R2 smoke with current R2 env vars and log
   the result.
7. Add automated bulk download zip/manifest coverage.
8. Add MCP asset-tool permission and partial-failure tests.
9. Run the Render staging acceptance checklist, including image preview,
   replace, bulk download manifest inspection, and MCP token smoke.

This keeps the normal test suite fast and deterministic while still
giving real evidence for the Cloudflare and deployment-specific parts of
the feature.

## P8. Progress Log

### 2026-05-26 - Pumps registry / reference coverage

Added `backend/tests/test_assets_registry.py` as the first Layer 1
Pumps-specific attachment test. Coverage now asserts:

- `equipment_pumps.datasheet_asset_ids` is a registered datasheet
  field;
- PDF and image datasheets are accepted by the field allow-list;
- wrong asset kinds, unsupported MIME types, and oversized files are
  rejected;
- `list_asset_references()` discovers
  `tables.equipment.pumps[*].datasheet_asset_ids[]`;
- asset-id filtering and `asset_referenced_by_document()` work for
  Pump datasheets.

Verification run:

```bash
cd backend && uv run ruff check tests/test_assets_registry.py
cd backend && uv run pytest tests/test_assets_registry.py tests/test_project_document_pumps.py
```

Result: `7 passed`.

### 2026-05-26 - Fake-storage asset-service coverage

Added `backend/tests/test_assets_service.py` with an in-memory fake R2
client wired through the FastAPI `get_asset_service` dependency. The
tests exercise the real routes, auth/project access, database rows, and
draft mutation path while keeping object storage local to the test.

Coverage now asserts:

- upload intent creates a pending datasheet asset and fake signed PUT
  URL;
- fake object upload plus `complete-upload` marks the asset uploaded;
- signed asset URL generation returns fake GET URLs and thumbnail
  status;
- attach writes the uploaded asset into
  `tables.equipment.pumps[*].datasheet_asset_ids[]`;
- detach removes the same asset from the Pump draft cell;
- PDF magic mismatch marks the asset failed and returns
  `asset_mime_not_allowed`;
- duplicate content hash returns the existing asset without a new
  upload URL.

Verification run:

```bash
cd backend && \
  DATABASE_URL=postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test \
  uv run alembic upgrade head
cd backend && uv run ruff check tests/test_assets_service.py tests/test_assets_registry.py
cd backend && uv run pytest tests/test_assets_service.py tests/test_assets_registry.py tests/test_project_document_pumps.py
```

Result: `10 passed`, `1 warning` from Starlette's deprecated
`HTTP_422_UNPROCESSABLE_ENTITY` symbol.

### 2026-05-26 - Frontend Pumps attachment-cell coverage

Extended `frontend/src/features/equipment/__tests__/PumpsTable.reuse.test.tsx`
so the real `PumpsTable` renders a Pump row with
`datasheet_asset_ids: ["asset_pdf_1"]`, resolves fake asset URL
metadata through the normal asset URL query, and exercises the embedded
`AttachmentCell` delete path.

Coverage now asserts:

- the Pump `Datasheet` column renders the resolved PDF attachment;
- Delete on the attachment cell emits a DataTable `cell` write with
  `fieldKey: "datasheet_asset_ids"` and `value: []`;
- the assertion runs through the actual `PumpsTable` column renderer
  rather than a standalone attachment-cell fixture.

Verification run:

```bash
cd frontend && pnpm exec prettier --check src/features/equipment/__tests__/PumpsTable.reuse.test.tsx
cd frontend && pnpm test src/features/equipment/__tests__/PumpsTable.reuse.test.tsx
```

Result: `3 passed`.

### 2026-05-26 - Local object-store setup for browser verification

Added local S3-compatible object storage so the browser workflow can
exercise the same signed-upload shape as R2 without using Cloudflare for
the first meaningful end-to-end test.

Changes:

- added a `docker-compose.yml` `object-store` service using MinIO on
  `localhost:9000` with console on `localhost:9001`;
- added `backend/scripts/init_object_store.py` to create the local
  `ph-navigator-v2-dev` bucket;
- added `make object-store-up`, `make object-store-init`, and
  `make object-store-down`;
- updated `make dev` and `make backend` so local development defaults to
  the MinIO-compatible `R2_*` settings while still allowing explicit
  Cloudflare R2 environment overrides;
- updated `backend/.env.example` to show the local MinIO defaults.

Verification run:

```bash
cd backend && uv run ruff check scripts/init_object_store.py
make object-store-init
```

Result: local MinIO started and bucket initialization completed. MinIO's
current endpoint rejected explicit `PutBucketCors`, so the setup relies
on server-level `MINIO_API_CORS_ALLOW_ORIGIN=*` for browser PUT/GET
during local development.

### 2026-05-26 - Local browser Pumps attachment workflow

Ran the local browser workflow against a real frontend, real backend,
local Postgres, and local MinIO object storage.

Environment:

- frontend: `http://localhost:5174`;
- backend: `http://localhost:8002`;
- object storage: MinIO at `http://localhost:9000`;
- browser automation: Playwright fallback, because the Browser plugin
  was listed but the in-app browser runtime reported `iab` unavailable.

Workflow verified:

- signed in as the local seeded editor;
- created project `a4b3143d-1ded-48b9-b480-ed942b458e5b`;
- opened Equipment / Pumps and inserted a Pump row;
- attached `phn-pump-datasheet.pdf` via the attachment cell drag/drop
  path;
- observed upload intent, direct signed PUT to MinIO, complete-upload,
  asset URL resolution, and thumbnail GET;
- reloaded and confirmed the attachment still rendered;
- opened the attachment modal and confirmed PDF preview iframe plus the
  backend download link;
- detached the asset and confirmed reload returned the cell to
  `Drop files here`.

Verification command:

```bash
cd frontend && pnpm exec node --input-type=module < /tmp/phn-pump-attachment-e2e.mjs
```

Key evidence:

- `POST /assets/upload-intent` -> `200`;
- signed `PUT http://localhost:9000/.../file.pdf` -> `200`;
- `POST /assets/{asset_id}/complete-upload` -> `200`;
- `GET /assets/bulk-urls?ids=asset_20260526134640321455` -> `200`;
- signed thumbnail GET from MinIO -> `200`;
- modal title: `phn-pump-datasheet.pdf`;
- preview iframe count: `1`;
- download href:
  `http://localhost:8002/api/v1/projects/a4b3143d-1ded-48b9-b480-ed942b458e5b/assets/asset_20260526134640321455/download`;
- after detach and reload: `0` attachment thumbs and `1`
  `Drop files here` button;
- console warnings/errors: none.

Screenshots saved outside the repo:

- `/tmp/phn-pumps-after-attach.png`;
- `/tmp/phn-pumps-preview.png`;
- `/tmp/phn-pumps-after-detach.png`.

### 2026-06-15 — R2 smoke run + full staging acceptance (bucket B closed)

Both remaining external-verification gates were run and passed.

**Cloudflare R2 opt-in smoke — PASS.** Ran against the real
`ph-navigator-v2-dev` bucket with the staging `R2_*` credentials placed
in gitignored `backend/.env`:

```bash
cd backend && RUN_R2_INTEGRATION=1 uv run pytest tests/integration/test_r2_assets.py
# 1 passed
```

Verified signed PUT (200), `head_object` content-length + type, signed
GET returning exact bytes, `copy_object` + head/get of the copy, and the
120 s `X-Amz-Expires` TTL on both signed URLs. Objects written under an
`integration-tests/<run-id>/` prefix and deleted in `finally`.

**Render staging browser acceptance — PASS.** Driven via Playwright
against `https://ph-navigator-v2-staging.onrender.com`, signed in as the
seeded staging editor. Fresh project
`1707e684-a614-4d5e-bc64-68f260749657` (`SMOKE-0615`), Equipment → Pumps
→ Datasheet cell:

- PDF datasheet upload: `upload-intent` 200 → signed R2 `PUT` 200 →
  `complete-upload` 200 → `bulk-urls` 200; `PDF` chip rendered.
- PDF preview modal: pdfjs iframe rendered the fixture page; modal
  portaled above the grid; `Download` uses the API `/download` route,
  `Open in new tab` uses the no-disposition `preview_url`.
- Image upload via `Replace…` (small PNG): full chain 200; in-cell
  image thumbnail rendered; preview modal showed the native `<img>`.
- Detach: cell returned to `Drop files here`.
- Reload persistence: re-attached the PDF, `Save Version`, reloaded —
  the datasheet chip persisted.
- Bulk download: `POST /assets/bulk-download` ran synchronously to
  `completed`; the result zip contained
  `equipment_pumps/pmp_…__phn-attachment-upload-verification-v1.pdf`
  (646 B) plus a well-formed `MANIFEST.csv` (full column set, correct
  asset/row/field references). Content-hash dedup confirmed: the
  re-attached PDF reused the original `asset_id`.
- MCP token smoke: issued a project-scoped token
  (`project:read`, `asset:read`), connected the real MCP client to the
  deployed `/mcp/` endpoint, and confirmed `list_assets` (3 assets),
  `resolve_asset_urls` (3 items with signed `download_url`), and
  `start_bulk_download` (`completed`, result asset created). Token
  revoked afterward.

This closes the open acceptance items in `STATUS.md`. The image fixture
and MCP smoke script live in gitignored `working/staging-attachments/`.

## P9. Lessons Learned

- Keep the document path and registry key explicit. The project
  document stores Pump attachments at
  `tables.equipment.pumps[*].datasheet_asset_ids[]`, while the backend
  attachment registry addresses the same surface as
  `equipment_pumps.datasheet_asset_ids`.
- The first backend attachment test can stay below the storage layer.
  Registry lookup, allow-list matching, and document-reference
  extraction are deterministic enough to verify before adding fake S3
  service coverage.
- `PumpRow` already carries `datasheet_asset_ids`, so the remaining
  backend work is not document-shape creation; it is upload completion,
  draft mutation, and asset-service behavior around that existing
  field.
- Local asset-service tests require the `project_assets` migration in
  the dedicated `_test` database. Running `uv run alembic upgrade head`
  without `DATABASE_URL=...ph_navigator_v2_test` upgrades the default
  environment instead and leaves pytest failing on a missing
  `project_assets` relation.
- For the component-level Pumps attachment test, firing Delete on the
  `.attachment-cell` owner is more precise than sending keyboard input
  to the thumbnail button, because the table focus layer can intercept
  key events in the test harness.
- A browser-real local attachment test needs an actual browser-addressable
  S3-compatible endpoint. `moto[s3]` is sufficient for backend tests but
  does not install the standalone `moto_server` dependencies, and the
  repo previously had no MinIO/LocalStack service.
- MinIO can reject boto3's `PutBucketCors` call with `NotImplemented` in
  this local setup. Server-level `MINIO_API_CORS_ALLOW_ORIGIN` is the
  practical local CORS control for the direct signed PUT flow.
- Cloudflare's R2 credential UI can be misleading on first pass. The
  token management flow may initially emphasize `Token value` and
  `Account ID`, but rolling the R2 token exposes the full credential set:
  `Token value`, `Access Key ID`, `Secret Access Key`, and `Account ID`.
  PHN's boto3/SigV4 path uses `Access Key ID`, `Secret Access Key`, and
  `Account ID`; the `Token value` is retained for Cloudflare token
  management, not signed R2 object URLs.
