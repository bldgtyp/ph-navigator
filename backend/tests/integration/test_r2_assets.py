from __future__ import annotations

import os
from contextlib import suppress
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import httpx
import pytest

from config import Settings
from features.assets.storage_r2 import R2Client

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_R2_INTEGRATION") != "1",
    reason="set RUN_R2_INTEGRATION=1 with real R2_* env vars to run Cloudflare R2 smoke",
)


def test_real_r2_signed_upload_download_copy_delete_smoke() -> None:
    settings = Settings()
    missing = [
        name
        for name, value in {
            "R2_ENDPOINT_URL": settings.r2_endpoint_url,
            "R2_BUCKET": settings.r2_bucket,
            "R2_ACCESS_KEY_ID": settings.r2_access_key_id,
            "R2_SECRET_ACCESS_KEY": settings.r2_secret_access_key,
        }.items()
        if not value
    ]
    if missing:
        pytest.fail(f"Missing required real R2 env vars: {', '.join(missing)}")

    r2 = R2Client(settings)
    run_id = f"{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}-{uuid4().hex[:8]}"
    source_key = f"integration-tests/{run_id}/source.pdf"
    copied_key = f"integration-tests/{run_id}/copy.pdf"
    body = b"%PDF-1.7\n% ph-navigator-v2 R2 smoke\n1 0 obj\n<<>>\nendobj\n%%EOF\n"
    content_type = "application/pdf"

    try:
        put_url = r2.generate_signed_put_url(
            source_key,
            content_type=content_type,
            size_bytes=len(body),
            expires_in_seconds=120,
        )
        assert _signed_url_expires_in(put_url) == "120"

        put_response = httpx.put(put_url, content=body, headers={"Content-Type": content_type}, timeout=30)
        assert put_response.status_code in {200, 201}

        head = r2.head_object(source_key)
        assert head["ContentLength"] == len(body)
        assert head["ContentType"] == content_type

        get_url = r2.generate_signed_get_url(source_key, expires_in_seconds=120)
        assert _signed_url_expires_in(get_url) == "120"
        get_response = httpx.get(get_url, timeout=30)
        assert get_response.status_code == 200
        assert get_response.content == body

        r2.copy_object(source_key, copied_key)
        copied_head = r2.head_object(copied_key)
        assert copied_head["ContentLength"] == len(body)
        assert r2.get_object(copied_key) == body
    finally:
        with suppress(Exception):
            r2.delete_object(source_key)
        with suppress(Exception):
            r2.delete_object(copied_key)


def _signed_url_expires_in(url: str) -> str:
    query = parse_qs(urlparse(url).query)
    expires = query.get("X-Amz-Expires")
    assert expires is not None
    return expires[0]
