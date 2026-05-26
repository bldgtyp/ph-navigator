---
DATE: 2026-05-26
TIME: 07:53 ET
STATUS: Parked strategy. Execute after the first real Equipment
        attachment table lands.
AUTHOR: Codex
SCOPE: Recommended local, mocked, Cloudflare R2, and Render staging
       verification strategy for the Attachments feature.
RELATED:
  - docs/plans/2026-05-26/feature-attachments-prd.md
  - docs/plans/2026-05-26/plan-23-attachments-phase-0-storage-backbone.md
  - docs/plans/2026-05-26/plan-24-attachments-phase-1-site-photo-cell.md
  - docs/plans/2026-05-26/plan-25-attachments-phase-2-datasheet-cells.md
  - docs/plans/2026-05-26/plan-26-attachments-phase-3-thermal-bridge-cells.md
  - docs/plans/2026-05-26/plan-27-attachments-phase-4-bulk-jobs-mcp.md
  - docs/plans/plan-20-pumps-table-reuse-test.md
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

## P3. Real Equipment Table Requirement

Rooms is not a good attachment test surface because it has no attachment
field.

The right product-shaped test is a real Equipment table with a
predefined locked attachment field. The current best candidate is the
Pumps table from `docs/plans/plan-20-pumps-table-reuse-test.md`.

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

Once Pumps exists, return to this plan and execute the local app
integration workflow against `equipment_pumps.datasheet_asset_ids`.

## P4. Cloudflare R2 Integration Smoke

Add one opt-in test or script that exercises Cloudflare R2 directly.

It should be disabled by default and require an explicit flag:

```bash
RUN_R2_INTEGRATION=1 cd backend && uv run pytest tests/integration/test_r2_assets.py
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

- backend asset service tests with fake storage;
- attachment field registry tests;
- draft attach/detach tests;
- bulk download zip/manifest tests;
- MCP asset tool permission tests;
- orphan sweeper dry-run tests.

Automate after Pumps lands:

- frontend attachment cell tests against a real Equipment table;
- Playwright local browser workflow for upload / preview / detach /
  reload;
- Render staging checklist, possibly as a manual release checklist
  first.

Keep manual / opt-in:

- real Cloudflare R2 integration;
- Render staging browser acceptance;
- MCP smoke against staging.

## P7. Recommended Next Step

When work resumes, do this order:

1. implement the first real Equipment table, preferably Pumps from
   `plan-20`;
2. add `datasheet_asset_ids` as a locked predefined field on that table;
3. add fake-storage backend coverage for the attachment service;
4. run local browser workflow against local object storage;
5. add the opt-in R2 smoke;
6. deploy to Render and run the staging acceptance checklist.

This keeps the normal test suite fast and deterministic while still
giving real evidence for the Cloudflare and deployment-specific parts of
the feature.
