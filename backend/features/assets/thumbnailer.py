"""Server-side thumbnail generation for uploaded project assets."""

from __future__ import annotations

import io
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from uuid import UUID

import pypdfium2 as pdfium
import structlog
from PIL import Image, ImageOps

from config import settings
from database import transaction
from features.assets import repository
from features.assets.schemas import AssetRow
from features.assets.storage_r2 import R2Client, asset_thumbnail_object_key

log = structlog.get_logger(__name__)


class Thumbnailer:
    def __init__(self, r2: R2Client):
        self.r2 = r2

    def render_for_asset(self, project_id: UUID, asset_id: str) -> None:
        with transaction() as conn:
            asset = repository.get_asset_by_id(conn, project_id, asset_id)
        if asset is None:
            log.warning("assets.thumbnail.asset_missing", asset_id=asset_id)
            return

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(self._render_bytes, asset)
            try:
                patch = future.result(timeout=settings.asset_thumbnail_render_timeout_seconds)
            except FutureTimeout:
                patch = {"thumbnail_status": "failed", "thumbnail_failure_reason": "render_timeout"}
            except Exception as exc:  # pragma: no cover - exact library failures are fixture-dependent.
                log.warning("assets.thumbnail.render_failed", asset_id=asset_id, error=str(exc))
                patch = {"thumbnail_status": "failed", "thumbnail_failure_reason": "render_error"}

        with transaction() as conn:
            repository.set_asset_metadata(conn, project_id, asset_id, patch)

    def _render_bytes(self, asset: AssetRow) -> dict[str, object]:
        if asset.content_type == "application/pdf":
            source = self.r2.get_object(asset.object_key)
            document = pdfium.PdfDocument(source)
            page_count = len(document)
            page = document[0]
            bitmap = page.render(scale=1)
            pil_image = bitmap.to_pil()
            return self._upload_png(asset, pil_image, {"page_count": page_count})

        if asset.content_type in {"image/png", "image/jpeg", "image/webp"}:
            source = self.r2.get_object(asset.object_key)
            with Image.open(io.BytesIO(source)) as image:
                image = ImageOps.exif_transpose(image)
                dimensions = image.size
                return self._upload_png(asset, image.copy(), {"image_dimensions": dimensions})

        return {"thumbnail_status": "na", "thumbnail_failure_reason": None}

    def _upload_png(self, asset: AssetRow, image: Image.Image, extra: dict[str, object]) -> dict[str, object]:
        image.thumbnail((320, 400), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.convert("RGBA").save(output, format="PNG")
        thumb_key = asset_thumbnail_object_key(UUID(asset.project_id), asset.id)
        self.r2.put_object(thumb_key, output.getvalue(), "image/png")
        return {
            "thumbnail_object_key": thumb_key,
            "thumbnail_status": "ready",
            "thumbnail_failure_reason": None,
            **extra,
        }


def get_thumbnailer(r2: R2Client) -> Thumbnailer:
    return Thumbnailer(r2)
