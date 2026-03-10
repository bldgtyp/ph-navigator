# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from database import Base
from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.aperture.aperture_frame import ApertureElementFrame


class ApertureFrameType(Base):
    __tablename__ = "aperture_frame_types"

    id: Mapped[str] = MappedColumn(String, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(
        String(255), nullable=False, default="Unnamed Frame Type"
    )
    width_mm: Mapped[float] = MappedColumn(Float, nullable=False, default=100.0)
    u_value_w_m2k: Mapped[float] = MappedColumn(Float, nullable=False, default=1.0)
    psi_g_w_mk: Mapped[float] = MappedColumn(Float, nullable=False, default=0.04)
    manufacturer: Mapped[str | None] = MappedColumn(String(255), nullable=True)
    brand: Mapped[str | None] = MappedColumn(String(255), nullable=True)
    use: Mapped[str | None] = MappedColumn(String(255), nullable=True)
    operation: Mapped[str | None] = MappedColumn(String(255), nullable=True)
    location: Mapped[str | None] = MappedColumn(String(255), nullable=True)
    mull_type: Mapped[str | None] = MappedColumn(String(255), nullable=True)
    source: Mapped[str | None] = MappedColumn(String, nullable=True)
    datasheet_url: Mapped[str | None] = MappedColumn(String, nullable=True)
    link: Mapped[str | None] = MappedColumn(String, nullable=True)
    comments: Mapped[str | None] = MappedColumn(String, nullable=True)

    # Relationships
    element_frames: Mapped[list["ApertureElementFrame"]] = relationship(
        "ApertureElementFrame", back_populates="frame_type"
    )
