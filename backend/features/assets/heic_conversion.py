"""HEIC/HEIF conversion for site-photo uploads."""

from __future__ import annotations

import hashlib
import io
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass
from uuid import UUID

from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from config import settings
from features.assets.base import AssetStorage
from features.assets.heic_types import HEIC_CONTENT_TYPES, HEIC_FTYP_BRANDS
from features.assets.models import AssetRow
from features.assets.storage_r2 import asset_object_key

register_heif_opener()


class AssetConversionError(RuntimeError):
    """Raised when a validated HEIC upload cannot be converted to JPEG."""


@dataclass(frozen=True)
class ConvertedAssetObject:
    object_key: str
    content_type: str
    size_bytes: int
    content_hash_sha256: str


def is_heic_content_type(content_type: str) -> bool:
    return content_type in HEIC_CONTENT_TYPES


def prefix_looks_like_heic(prefix: bytes) -> bool:
    return len(prefix) >= 12 and prefix[4:8] == b"ftyp" and prefix[8:12] in HEIC_FTYP_BRANDS


def convert_heic_upload_to_jpeg(asset: AssetRow, r2: AssetStorage) -> tuple[ConvertedAssetObject, str]:
    source = r2.get_object(asset.object_key)
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_convert_to_jpeg, source)
    try:
        jpeg = future.result(timeout=settings.asset_heic_conversion_timeout_seconds)
    except FutureTimeout as exc:
        future.cancel()
        executor.shutdown(wait=False, cancel_futures=True)
        raise AssetConversionError("heic_conversion_timeout") from exc
    except Exception as exc:
        executor.shutdown(wait=True, cancel_futures=True)
        raise AssetConversionError("heic_conversion_failed") from exc
    else:
        executor.shutdown(wait=True, cancel_futures=True)
    object_key = asset_object_key(UUID(asset.project_id), asset.id, "jpg")
    r2_etag = r2.put_object(object_key, jpeg, "image/jpeg")
    return (
        ConvertedAssetObject(
            object_key=object_key,
            content_type="image/jpeg",
            size_bytes=len(jpeg),
            content_hash_sha256=hashlib.sha256(jpeg).hexdigest(),
        ),
        r2_etag,
    )


def _convert_to_jpeg(source: bytes) -> bytes:
    with Image.open(io.BytesIO(source)) as image:
        normalized = ImageOps.exif_transpose(image)
        if normalized.mode not in {"RGB", "L"}:
            normalized = normalized.convert("RGB")
        output = io.BytesIO()
        normalized.save(output, format="JPEG", quality=92, optimize=True)
        return output.getvalue()
