"""Seed the example HBJSON model into the starter project's Model tab.

Unlike the pure-DB seeds, the Model tab leans on the asset backbone, so
this one needs the local object store (MinIO) running. It mirrors the
production link flow end to end: reserve a `project_assets` row, push the
bytes to the bucket, mark the asset uploaded, link a `project_hbjson_files`
row, then run the geometry-extraction job so `/model_data` serves a ready
artifact.

Run AFTER `seed_dev_db` (it needs the seeded user + project) and with the
object store up:

    make object-store-init
    cd backend && uv run python -m scripts.seed_hbjson_model

Idempotent: a fixed asset id keeps the object key stable (re-runs
overwrite rather than orphan), and an existing linked file with the same
content hash is left untouched.
"""

from __future__ import annotations

import hashlib
from urllib.parse import urlparse
from uuid import UUID

from config import settings
from database import connection, transaction
from features.assets import repository as assets_repository
from features.assets.storage_r2 import R2Client, asset_object_key
from features.auth import repository as auth_repository
from features.model_viewer import repository as model_repository
from features.model_viewer.model_data import run_extraction_job
from features.projects import repository as projects_repository
from scripts._seed_paths import HBJSON_SEED_PATH, default_user_kwargs

LOCAL_ENVIRONMENTS = {"development", "test", "local"}

# Fixed so re-runs overwrite the same object key instead of orphaning a new
# one in the bucket on every reseed.
_SEED_ASSET_ID = "asset_seed_hbjson_example"
_ORIGINAL_FILENAME = "ph_nav_v2_example.hbjson"
_DISPLAY_NAME = "PH-Nav V2 Example Model"
_CONTENT_TYPE = "application/json"


def main() -> None:
    _assert_local_dev_database()
    if not settings.r2_endpoint_url:
        raise SystemExit("R2_ENDPOINT_URL is required; start the object store with `make object-store-init`.")

    user_email = default_user_kwargs()["email"]
    with connection() as conn:
        user = auth_repository.get_user_by_email(conn, user_email)
        if user is None:
            raise SystemExit(f"Seed user {user_email!r} not found; run `make seed-dev-data` first.")
        projects = projects_repository.list_projects_for_owner(conn, user["id"])
    if not projects:
        raise SystemExit("No starter project found; run `make seed-dev-data` first.")

    project_id: UUID = projects[0]["id"]
    uploaded_by: UUID = user["id"]

    raw = HBJSON_SEED_PATH.read_bytes()
    content_hash = hashlib.sha256(raw).hexdigest()
    object_key = asset_object_key(project_id, _SEED_ASSET_ID, "hbjson")
    storage = R2Client(settings)

    # 1) Reserve the asset row (skip if a prior run already created it).
    with transaction() as conn:
        existing = assets_repository.get_asset_by_id(conn, project_id, _SEED_ASSET_ID, include_deleted=True)
        if existing is None:
            assets_repository.insert_pending_asset(
                conn,
                asset_id=_SEED_ASSET_ID,
                project_id=project_id,
                asset_kind="hbjson",
                object_key=object_key,
                original_filename=_ORIGINAL_FILENAME,
                display_name=_DISPLAY_NAME,
                content_type=_CONTENT_TYPE,
                size_bytes=len(raw),
                content_hash_sha256=content_hash,
                created_by=uploaded_by,
            )

    # 2) Push the bytes, then flip the asset to `uploaded` (network call
    #    sits between transactions, mirroring the real complete-upload path).
    etag = storage.put_object(object_key, raw, _CONTENT_TYPE)
    with transaction() as conn:
        assets_repository.mark_asset_uploaded(conn, project_id, _SEED_ASSET_ID, r2_etag=etag)

    # 3) Link the viewer file row (dedup by content hash keeps re-runs idempotent).
    with transaction() as conn:
        duplicate = model_repository.find_active_file_by_content_hash(conn, project_id, content_hash)
        if duplicate is not None:
            file_id = duplicate["id"]
        else:
            file_id = model_repository.insert_hbjson_file(
                conn,
                project_id=project_id,
                asset_id=_SEED_ASSET_ID,
                display_name=_DISPLAY_NAME,
                notes="Seeded example model for local testing.",
                uploaded_by=uploaded_by,
                content_hash_sha256=content_hash,
            )

    # 4) Extract geometry now so the viewer has a ready artifact (no-op if
    #    a prior run already succeeded for these bytes).
    run_extraction_job(storage, project_id, file_id)

    print(f"Seeded HBJSON model: file={file_id} project={project_id} ({len(raw)} bytes)")


def _assert_local_dev_database() -> None:
    if settings.environment not in LOCAL_ENVIRONMENTS:
        raise SystemExit(f"Refusing to seed ENVIRONMENT={settings.environment!r}; expected local/dev/test.")
    db_name = urlparse(settings.database_url).path.lstrip("/")
    if db_name != "ph_navigator_v2":
        raise SystemExit(f"Refusing to seed database {db_name!r}; expected local dev database 'ph_navigator_v2'.")


if __name__ == "__main__":
    main()
