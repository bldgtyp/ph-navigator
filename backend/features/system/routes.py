"""Health and version endpoints for bootstrapping PH-Navigator clients."""

from __future__ import annotations

from fastapi import APIRouter

from config import settings
from features.system.models import HealthResponse, VersionResponse
from features.system.service import readiness

router = APIRouter(prefix="/api/v1", tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="ph-navigator",
        phase="tb-00",
        api_version="v1",
    )


@router.get("/ready")
def ready() -> dict[str, object]:
    return readiness()


@router.get("/version", response_model=VersionResponse)
def version() -> VersionResponse:
    return VersionResponse(
        service="ph-navigator",
        app_version=settings.app_version,
        api_version="v1",
        environment=settings.environment,
        git_sha=settings.git_sha or None,
    )
