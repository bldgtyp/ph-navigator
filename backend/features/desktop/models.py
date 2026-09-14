"""Desktop response contracts shared with the SketchUp library consumer."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from features.catalogs.frame_types.models import CatalogFrameTypeListItem
from features.catalogs.glazing_types.models import CatalogGlazingTypeListItem
from features.catalogs.materials.models import CatalogMaterialListItem
from features.mcp.models import McpScope


class DesktopSession(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token_label: str
    scopes: list[McpScope]
    expires_at: datetime | None
    user_email: str


class DesktopMaterials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["materials"] = "materials"
    library_id: Literal["ph-navigator-web:materials"] = "ph-navigator-web:materials"
    server_time: datetime
    rows: list[CatalogMaterialListItem]


class DesktopFrameTypes(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["frames"] = "frames"
    library_id: Literal["ph-navigator-web:frame-types"] = "ph-navigator-web:frame-types"
    server_time: datetime
    rows: list[CatalogFrameTypeListItem]


class DesktopGlazingTypes(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["glazings"] = "glazings"
    library_id: Literal["ph-navigator-web:glazing-types"] = "ph-navigator-web:glazing-types"
    server_time: datetime
    rows: list[CatalogGlazingTypeListItem]
