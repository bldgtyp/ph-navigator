"""Pydantic models for the frame-types catalog import file envelope."""

from __future__ import annotations

from datetime import datetime
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict

CURRENT_SCHEMA_VERSION: Final[int] = 1

FILE_KIND: Final[str] = "ph-navigator.catalog.frame-types"


class CatalogFileRow(BaseModel):
    """One row inside a frame-types import file.

    Field set mirrors the seventeen canonical catalog fields plus optional
    `id`. Unknown keys are accepted (`extra="allow"`) so the coerce step
    can surface them as `unknown_field:<key>` warnings.
    """

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    name: str | None = None
    manufacturer: str | None = None
    brand: str | None = None
    use: str | None = None
    operation: str | None = None
    location: str | None = None
    mull_type: str | None = None
    prefix: str | None = None
    suffix: str | None = None
    material: str | None = None
    width_mm: float | str | None = None
    u_value_w_m2k: float | str | None = None
    psi_g_w_mk: float | str | None = None
    psi_install_w_mk: float | str | None = None
    color: str | None = None
    source: str | None = None
    comments: str | None = None


class CatalogFile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    kind: Literal["ph-navigator.catalog.frame-types"]
    schema_version: int
    exported_at: datetime | None = None
    exported_by: str | None = None
    app_version: str | None = None
    rows: list[CatalogFileRow]
