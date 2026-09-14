"""Bearer-only REST reads for desktop library consumers."""

from typing import Annotated

from fastapi import APIRouter, Depends

from features.desktop.models import DesktopFrameTypes, DesktopGlazingTypes, DesktopMaterials, DesktopSession
from features.desktop.service import get_frame_types, get_glazing_types, get_materials, require_desktop_token
from features.mcp.rate_limit import enforce_device_poll_budget

router = APIRouter(
    prefix="/api/v1/desktop",
    tags=["desktop"],
    dependencies=[Depends(enforce_device_poll_budget)],
)
DesktopToken = Annotated[DesktopSession, Depends(require_desktop_token)]


@router.get("/session", response_model=DesktopSession)
def get_session(auth: DesktopToken) -> DesktopSession:
    return auth


@router.get("/catalogs/materials", response_model=DesktopMaterials)
def get_catalog_materials(auth: DesktopToken) -> DesktopMaterials:
    del auth
    return get_materials()


@router.get("/catalogs/frame-types", response_model=DesktopFrameTypes)
def get_catalog_frame_types(auth: DesktopToken) -> DesktopFrameTypes:
    del auth
    return get_frame_types()


@router.get("/catalogs/glazing-types", response_model=DesktopGlazingTypes)
def get_catalog_glazing_types(auth: DesktopToken) -> DesktopGlazingTypes:
    del auth
    return get_glazing_types()
