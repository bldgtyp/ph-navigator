---
DATE: 2026-05-25
TIME: 22:00
STATUS: DRAFT — Phase 0 implementation plan for the Attachments
        feature. Backend-only foundation. No frontend, no
        per-cell wiring — those land in Phases 1–3.
AUTHOR: Ed May (with Claude)
SCOPE: Build the storage backbone the attachment cell type depends
       on: R2 client, `project_assets` table + repository + service,
       upload/complete/download/delete/url routes, thumbnailer,
       content-hash dedup, MIME sniff, structured errors, tests.
RELATED:
  - context/technical-requirements/attachments.md (canonical contract)
  - context/technical-requirements/data-model.md §6.5 (asset row schema)
  - context/technical-requirements/api.md §9.10 (REST inventory)
  - context/technical-requirements/llm-mcp-schema.md §10.3 (MCP tools)
  - planning/features/attachments/PRD.md §13 (phasing)
  - ph-navigator/backend/features/gcp/ (V1 GCS precedent — for shape
    reference only; V1 used GCS, not R2)
---

# Plan 23 — Attachments Phase 0: Storage Backbone

## P0. Why this slice

The attachment feature is a five-phase rollout
(`../PRD.md` §13). Phase 0 is the **backend-only
foundation** every later phase depends on. By the end of this slice:

- R2 buckets exist (`-dev` and `-prod`) with correct CORS / lifecycle /
  public-access settings;
- `project_assets` table is migrated and exposed through a narrow
  repository + service layer;
- the §9.10 single-asset endpoints (`upload-intent`,
  `complete-upload`, `download`, `url`, `delete`, `attach`, `detach`,
  list) are live;
- the server-side thumbnailer renders PDFs and images on
  `complete-upload`;
- MIME sniffing rejects mismatched uploads;
- content-hash dedup is wired (returns existing asset + `duplicate_of`
  warning);
- a working asset can be `curl`'d through the full lifecycle, end to
  end, against a localstack-style R2 mock and against a real R2 dev
  bucket.

Phase 0 does **not** ship any frontend code, any cell wiring, any bulk
endpoints, or any MCP tools. Bulk endpoints live in Phase 4; cells in
Phases 1–3.

## P1. Acceptance — Phase 0 done when

1. `cd backend && make migrate && uv run pytest features/assets/` is
   green.
2. From a checkout with R2 dev creds in `backend/.env`, the following
   `curl` flow succeeds end-to-end:
   ```bash
   # 1. obtain editor session cookie via /api/v1/auth/login
   # 2. POST /api/v1/projects/{pid}/assets/upload-intent  (datasheet kind)
   # 3. PUT the PDF body to the returned signed URL
   # 4. POST /api/v1/projects/{pid}/assets/{aid}/complete-upload
   # 5. GET  /api/v1/projects/{pid}/assets/{aid}        → asset metadata,
   #                                                       thumbnail_status='ready'
   # 6. GET  /api/v1/projects/{pid}/assets/{aid}/url    → signed URLs
   # 7. curl the download_url   → original PDF bytes
   # 8. curl the thumbnail_url  → rendered first-page PNG
   # 9. POST /api/v1/projects/{pid}/assets/{aid}/detach (no-op v1 since
   #         no document references exist yet — covered by Phase 1)
   ```
3. Uploading a JPG produces a resized JPG-derived `thumb.png` on R2.
4. Uploading a corrupt PDF marks `upload_status='uploaded'` but
   `thumbnail_status='failed'`; the GET endpoint still returns the
   asset and the original-file download still works.
5. Uploading the same bytes twice in the same project returns the
   first `asset_id` with `duplicate_of` set, and does **not** create
   a second R2 object.
6. Uploading a file whose magic bytes don't match the claimed
   `content_type` marks `upload_status='failed'` and returns the
   structured error `asset_mime_not_allowed`.
7. Anonymous (no session cookie) `GET .../url` succeeds **only** when
   the asset is referenced by the active version of a public-readable
   project; otherwise 401/403. (Phase 0 stub: no document references
   exist yet, so anonymous access is gated solely on auth presence
   — full reference-check lands with Phase 1's first cell.)
8. `make typecheck` and `make lint` are green.

## P2. File layout

New feature folder, mirroring the existing `catalogs/` shape:

```
backend/
  features/
    assets/
      __init__.py
      routes.py             # FastAPI router; mounted under
                            # /api/v1/projects/{pid}/assets
      schemas.py            # Pydantic request/response models
      service.py            # orchestration (upload intent, complete,
                            # detach, mime sniff, dedup)
      repository.py         # raw parameterized SQL over project_assets
      storage_r2.py         # S3-compat client; signed URL gen;
                            # object GET for mime sniff; PUT/DELETE of
                            # sibling thumb.png
      thumbnailer.py        # pypdfium2 (PDFs) + Pillow (images);
                            # FastAPI BackgroundTask entrypoint
      errors.py             # structured error codes used by this feature

backend/alembic/versions/
  20260525_00NN_project_assets.py  # migration: project_assets table
                                   #            + indexes

backend/tests/
  features/assets/
    __init__.py
    test_repository.py
    test_service.py
    test_storage_r2.py      # uses moto / localstack
    test_thumbnailer.py
    test_routes.py          # async client + R2 mock
    fixtures/
      sample.pdf            # 1-page PDF for PDF tests
      sample.jpg
      corrupt.pdf
      not-actually-pdf.pdf  # PNG bytes with .pdf extension
```

The whole feature obeys `context/CODING_STANDARDS.md`:
`routes.py` / `service.py` / `repository.py` / `schemas.py` separated;
strict typing; no SQLAlchemy ORM in app code; raw parameterized SQL
through `repository.py`.

## P3. Dependencies to add

`backend/pyproject.toml` (via `cd backend && uv add …`):
- `pypdfium2>=4.30` — PDF→PNG rendering. Apache-2.0; ~5 MB wheel.
- `pillow>=11.0` — image resize / EXIF orientation honoring.
- `python-magic-bin` or `python-magic` — MIME magic-byte sniffing.
  Prefer `python-magic` on Linux (uses libmagic). Confirm the Render
  base image ships libmagic — if not, vendor with `python-magic-bin`.

`boto3>=1.35` is already in `pyproject.toml`. No SDK swap needed for
R2 — boto3's S3 client works against R2 by setting
`endpoint_url=R2_ENDPOINT_URL`.

Dev-only (under `[tool.uv].dev-dependencies` or `pyproject.toml`
`[project.optional-dependencies].dev`):
- `moto[s3]>=5.0` — in-memory S3 mock for unit tests. Alternative:
  `localstack` via Docker. Pick `moto` first; localstack only if
  integration coverage demands it.

## P4. Settings additions

`backend/config.py` `Settings` class adds:

```python
class Settings(BaseSettings):
    # ... existing fields ...

    # R2 / object storage
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = "ph-navigator-v2-dev"
    R2_ENDPOINT_URL: str = ""

    # Asset behavior
    ASSET_SIGNED_URL_TTL_PREVIEW_SECONDS: int = 15 * 60
    ASSET_SIGNED_URL_TTL_DOWNLOAD_SECONDS: int = 60 * 60
    ASSET_THUMBNAIL_RENDER_TIMEOUT_SECONDS: int = 10
    ASSET_MAX_FILE_SIZE_MB_HARD_CAP: int = 100
```

All five `R2_*` keys already exist in `backend/.env.example`; this
just makes them strongly typed.

## P5. Migration — `20260525_00NN_project_assets.py`

The `project_assets` schema is fully specified in
`data-model.md §6.5`. The migration creates the table exactly per
that spec, plus the two partial indexes:

```sql
CREATE TABLE project_assets (
    id                   TEXT PRIMARY KEY,
    project_id           UUID NOT NULL REFERENCES projects(id),
    asset_kind           TEXT NOT NULL,
    object_key           TEXT NOT NULL UNIQUE,
    original_filename    TEXT NOT NULL,
    display_name         TEXT NOT NULL,
    content_type         TEXT NOT NULL,
    size_bytes           BIGINT NOT NULL,
    content_hash_sha256  TEXT NOT NULL,
    r2_etag              TEXT,
    upload_status        TEXT NOT NULL DEFAULT 'pending',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by           UUID NOT NULL REFERENCES users(id),
    uploaded_at          TIMESTAMPTZ,
    deleted_at           TIMESTAMPTZ,
    deleted_by           UUID REFERENCES users(id),
    metadata             JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX ix_project_assets_project_kind
    ON project_assets (project_id, asset_kind)
    WHERE deleted_at IS NULL AND upload_status = 'uploaded';

CREATE INDEX ix_project_assets_content_hash
    ON project_assets (project_id, content_hash_sha256)
    WHERE deleted_at IS NULL;

-- CHECK on asset_kind to surface schema drift early.
ALTER TABLE project_assets ADD CONSTRAINT project_assets_kind_allowed
    CHECK (asset_kind IN ('datasheet', 'site_photo', 'hbjson',
                          'simulation_file', 'export_bundle', 'other'));

-- CHECK on upload_status.
ALTER TABLE project_assets ADD CONSTRAINT project_assets_status_allowed
    CHECK (upload_status IN ('pending', 'uploaded', 'failed'));
```

Downgrade drops the table and both indexes.

## P6. `storage_r2.py` — R2 client

Thin wrapper over `boto3.client('s3', endpoint_url=R2_ENDPOINT_URL,
…)`. Exposed surface:

```python
class R2Client:
    def __init__(self, settings: Settings): ...

    def generate_signed_put_url(
        self,
        object_key: str,
        content_type: str,
        size_bytes: int,
        expires_in_seconds: int = 600,  # 10 min
    ) -> str: ...

    def generate_signed_get_url(
        self,
        object_key: str,
        expires_in_seconds: int,
        response_content_disposition: str | None = None,
    ) -> str: ...

    def head_object(self, object_key: str) -> dict:
        """Returns {ContentLength, ETag, ContentType, ...}. Used by
        complete-upload to verify the file landed."""

    def get_object_prefix(
        self, object_key: str, byte_range: tuple[int, int]
    ) -> bytes:
        """GETs a byte range for MIME sniffing (first 4-8 KB)."""

    def put_object(
        self, object_key: str, body: bytes, content_type: str
    ) -> str:
        """Used by the thumbnailer to upload the rendered PNG.
        Returns ETag."""

    def delete_object(self, object_key: str) -> None: ...
```

Object-key helpers live alongside:
```python
def asset_object_key(project_id: UUID, asset_id: str, ext: str) -> str:
    return f"projects/{project_id}/assets/{asset_id}/file.{ext}"

def asset_thumbnail_object_key(project_id: UUID, asset_id: str) -> str:
    return f"projects/{project_id}/assets/{asset_id}/thumb.png"
```

Singleton instance is wired through a FastAPI dependency (`get_r2()`).

## P7. `repository.py` — raw SQL

Functions follow the existing repository pattern in
`backend/features/catalogs/materials/repository.py`. All operate on
`psycopg.Connection` injected via the existing `get_db()` dependency.

```python
def insert_pending_asset(
    conn, *, asset_id: str, project_id: UUID, asset_kind: str,
    object_key: str, original_filename: str, display_name: str,
    content_type: str, size_bytes: int, content_hash_sha256: str,
    created_by: UUID,
) -> AssetRow: ...

def find_asset_by_content_hash(
    conn, project_id: UUID, content_hash_sha256: str,
) -> AssetRow | None:
    """Used by upload-intent for dedup."""

def get_asset_by_id(conn, project_id: UUID, asset_id: str) -> AssetRow | None: ...

def mark_asset_uploaded(
    conn, asset_id: str, *, r2_etag: str,
) -> AssetRow: ...

def mark_asset_failed(
    conn, asset_id: str, *, reason: str,
) -> AssetRow: ...

def set_asset_metadata(
    conn, asset_id: str, metadata_patch: dict,
) -> AssetRow:
    """Merges patch into metadata JSONB (used by thumbnailer)."""

def soft_delete_asset(
    conn, asset_id: str, *, deleted_by: UUID,
) -> None: ...

def list_assets(
    conn, project_id: UUID, *, kind: str | None = None,
) -> list[AssetRow]: ...
```

`AssetRow` is a Pydantic model mirroring the column set, with
`metadata: AssetMetadata` (typed Pydantic model for the v1 keys plus
`extra='allow'` for future).

## P8. `service.py` — orchestration

The thin service layer that routes call into; it knits together the
repository, R2 client, MIME sniffer, and thumbnailer.

```python
class AssetService:
    def __init__(self, repo, r2: R2Client, thumbnailer: Thumbnailer,
                 settings: Settings): ...

    def create_upload_intent(
        self, *, project_id: UUID, asset_kind: str,
        original_filename: str, content_type: str,
        size_bytes: int, content_hash_sha256: str,
        display_name: str | None, created_by: UUID,
    ) -> UploadIntentResponse:
        """
        1. Validate asset_kind ∈ v1 set + size_bytes ≤ hard cap.
        2. Dedup: if (project_id, content_hash) exists and not
           deleted, return that asset_id + duplicate_of.
        3. Else generate asset_id; insert pending row; generate
           signed PUT URL.
        """

    def complete_upload(
        self, *, project_id: UUID, asset_id: str,
        background_tasks: BackgroundTasks,
    ) -> AssetRow:
        """
        1. HEAD R2 object → confirm presence + ContentLength matches
           recorded size_bytes; capture ETag.
        2. MIME-sniff: GET first 8 KB; verify magic bytes match
           content_type. Mismatch → mark_asset_failed +
           asset_mime_not_allowed.
        3. mark_asset_uploaded.
        4. Schedule thumbnailer.render_for_asset(asset_id) as a
           BackgroundTask.
        5. Return the updated row.
        """

    def get_asset_urls(
        self, *, project_id: UUID, asset_id: str,
        viewer_session,  # editor session or None
    ) -> AssetUrlsResponse:
        """
        1. Load row.
        2. If viewer_session is None (anonymous), verify the asset is
           referenced by the active version's body. (Phase 0 STUB:
           skip the reference check until Phase 1 lands the first
           core-field cell; for now reject anonymous reads.)
        3. Generate signed GET URLs for original + thumbnail.
        """

    def soft_delete(
        self, *, project_id: UUID, asset_id: str, deleted_by: UUID,
    ) -> None:
        """Mark deleted_at. Does NOT remove the R2 object — the GC
        sweep does that after 90 days. (GC service lands in Phase 4
        or earlier as a small standalone cron.)"""
```

`attach` / `detach` routes (which mutate project document drafts)
are **stubs in Phase 0** — they validate that the asset exists and is
`uploaded`, but the JSON-Patch into the draft body lands with Phase 1
once a real core-field cell exists to attach into.

## P9. `thumbnailer.py`

Single entry point:

```python
def render_for_asset(asset_id: str) -> None:
    """
    1. Load row.
    2. Branch on content_type:
       - application/pdf → pypdfium2.PdfDocument.load(... bytes from R2 ...)
         render page 0 → PNG → upload as thumb.png sibling.
       - image/png|jpeg|webp → Pillow.Image.open(...), respect EXIF
         orientation, thumbnail((320, 400), Image.LANCZOS), save as PNG,
         upload.
       - else → set metadata.thumbnail_status='na' and return.
    3. On success: metadata.thumbnail_object_key, thumbnail_status='ready',
       page_count (PDF only) or image_dimensions (images only).
    4. On exception or timeout: thumbnail_status='failed',
       thumbnail_failure_reason in {'render_timeout','render_error',
       'unsupported'}; do NOT mark the asset itself failed.
    """
```

Implementation notes:
- Stream the source bytes into memory via `r2.get_object_prefix(key, (0, size_bytes))` — within the 25 MB cap that's at most ~25 MB of RAM per worker, acceptable.
- Wrap the render in `concurrent.futures.ThreadPoolExecutor.submit(...).result(timeout=settings.ASSET_THUMBNAIL_RENDER_TIMEOUT_SECONDS)`.
- Catch + log structured warning with `request_id` (forwarded from the originating request via context var).

## P10. Routes — `routes.py`

Mounted under `/api/v1/projects/{pid}/assets/...`. Phase 0 ships only
the single-asset endpoints:

| Method | Path | Handler |
|---|---|---|
| `POST` | `/upload-intent` | `service.create_upload_intent` |
| `POST` | `/{aid}/complete-upload` | `service.complete_upload` |
| `GET`  | `/{aid}` | `service.get_asset` |
| `PATCH`| `/{aid}` | `service.patch_display_metadata` |
| `DELETE`| `/{aid}` | `service.soft_delete` |
| `GET`  | `/{aid}/download` | redirect to signed download URL |
| `GET`  | `/{aid}/url` | `service.get_asset_urls` |
| `POST` | `/{aid}/attach` | stub — see §P8 |
| `POST` | `/{aid}/detach` | stub — see §P8 |
| `GET`  | `?kind=<kind>` | `service.list_assets` |

Every route uses the existing `require_project_access(project_id,
mode='edit' | 'view')` FastAPI dependency from §4.1 of the PRD. Write
routes require `mode='edit'`; reads use `mode='view'`.

Idempotency: write routes accept `Idempotency-Key` per the existing
middleware (api.md §9.5). `upload-intent` uses
`(project_id, content_hash_sha256)` as the natural dedup key
*independently of* the header; both rules apply.

Bulk endpoints (`bulk-upload-intent`, `bulk-urls`, `bulk-download`,
`jobs`) are **out of scope for Phase 0** — they land in Phase 4.

## P11. Error codes

Implemented in `errors.py` and wired into the existing shared
error-envelope middleware. Phase 0 lands these codes (subset of
`attachments.md §A8`):

- `asset_unknown_kind` — asset_kind not in v1 set.
- `asset_size_exceeded` — size_bytes > hard cap.
- `asset_mime_not_allowed` — magic-byte mismatch with claimed
  content_type, or content_type not in any v1 allow-list.
- `asset_upload_incomplete` — attach attempted on `pending` /
  `failed` asset.
- `asset_not_found` — id resolves to deleted / non-existent row.
- `asset_thumbnail_pending` — read-side warning (returned in
  payload, not as 4xx).

`asset_cross_project_reference` and `asset_count_exceeded` land with
Phase 1 (when the first attach into a cell happens). `asset_bulk_*`
lands with Phase 4.

## P12. Tests

### P12.1 Unit

- `test_repository.py` — every repository function against a real
  Postgres test fixture (use the existing `db` fixture from the
  test harness).
- `test_storage_r2.py` — every `R2Client` method against `moto[s3]`.
- `test_thumbnailer.py` — render PDF → assert PNG dimensions;
  render JPG → assert resize; render unsupported MIME → assert
  `na`; render corrupt PDF → assert `failed` + asset still
  `uploaded`.

### P12.2 Service

- `test_service.py` —
  - `create_upload_intent` happy path;
  - `create_upload_intent` dedup (second call with same hash
    returns first asset_id + `duplicate_of`);
  - `create_upload_intent` size-cap rejection;
  - `complete_upload` happy path → asset becomes `uploaded`,
    thumbnail scheduled, BackgroundTask asserted on the
    `FastAPI` test client;
  - `complete_upload` MIME mismatch → asset becomes `failed`;
  - `get_asset_urls` editor → both URLs returned;
  - `get_asset_urls` anonymous → 401 stub (Phase 1 will replace
    with the reference check).

### P12.3 Route

- `test_routes.py` — end-to-end with `httpx.AsyncClient`:
  1. login as seed editor;
  2. upload-intent → PUT (against moto) → complete-upload;
  3. GET asset → assert thumbnail_status='ready' after BackgroundTask drains;
  4. GET .../url → assert URLs;
  5. download via the redirect route.

### P12.4 Coverage targets

- `features/assets/service.py`: 95 %+ line coverage.
- `features/assets/repository.py`: 100 % (raw SQL is the contract).
- `features/assets/storage_r2.py`: 90 %+ (some boto3 edge cases stay
  uncovered).
- `features/assets/thumbnailer.py`: 90 %+.

## P13. Ops

Phase 0 ships the ops prerequisites the storage backbone needs:

1. **Create R2 buckets** (`-dev`, `-prod`) in **ENAM**. Document
   credentials in 1Password under "PH-Navigator R2".
2. **Configure CORS** on each bucket:
   ```json
   [{
     "AllowedOrigins": ["http://localhost:5173",
                        "https://ph-navigator-v2.onrender.com"],
     "AllowedMethods": ["PUT", "GET", "HEAD"],
     "AllowedHeaders": ["*"],
     "ExposeHeaders": ["ETag"],
     "MaxAgeSeconds": 3600
   }]
   ```
3. **Lifecycle rule** on each bucket: objects under
   `projects/*/assets/_orphaned/` auto-delete 90 days after creation.
4. **Public access = off** (default on R2; verify explicitly).
5. Wire `R2_*` env vars in the Render service config for both `-dev`
   and `-prod` services.

GC sweeper (the periodic job that moves orphaned assets into the
`_orphaned/` prefix) is **NOT** in Phase 0 scope. It lands as a small
standalone cron in the Phase 4 slice, or earlier if Ed wants it
sooner.

## P14. Risks specific to this slice

- **R2 + moto compatibility.** `moto[s3]` is mature but not
  bit-identical to R2's signing behavior. Pre-merge, run a smoke test
  against the real `-dev` bucket end-to-end. If signing semantics
  diverge, fall back to localstack via Docker.
- **pypdfium2 wheel size.** ~5 MB; not a problem on the Render
  container, but worth verifying CI build times stay under budget.
- **MIME sniffer on Render.** `python-magic` needs libmagic; the
  Render base image may not ship it. If it doesn't, switch to
  `python-magic-bin` (vendored libmagic) before the merge.
- **BackgroundTask vs request lifecycle.** FastAPI's
  `BackgroundTasks` run *after* the response is sent on the same
  worker. A slow PDF render could keep a worker busy. Phase 0
  accepts this; Phase 4's job-queue work resolves it for bulk.

## P15. Out of scope (deferred to later phases)

- `<AttachmentCell>` component and any frontend code — **Phase 1**.
- Attaching `asset_id`s into project_document core-field arrays
  (`segment.photo_asset_ids[]`, etc.) — stub in Phase 0; real wiring
  in Phase 1.
- Bulk endpoints (`bulk-upload-intent`, `bulk-urls`, `bulk-download`,
  `jobs`) — **Phase 4**.
- MCP tools (`list_assets`, `resolve_asset_urls`, `start_bulk_download`,
  `get_job`, `bulk_attach`, `bulk_detach`) — **Phase 4**.
- Anonymous-viewer "referenced-by" check — full check lands with
  Phase 1's first cell. Phase 0 simply rejects anonymous reads.
- Periodic GC sweeper — Phase 4 (or earlier if a real workflow demands
  it).
- Replace… UX, preview modal, drop interaction — Phase 1+.

## P16. Done definition

This slice is mergeable when:

- §P1 acceptance criteria are met;
- `make test`, `make typecheck`, `make lint` are all green;
- the curl flow in §P1 runs against the real R2 dev bucket;
- a code review confirms the feature-folder layout matches
  `catalogs/` and obeys `CODING_STANDARDS.md`;
- `attachments.md` is referenced from new code via docstrings where
  behavior is non-obvious.
