# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.aperture.aperture_frame import ApertureElementFrame


class ApertureFrameType(Base):
    __tablename__ = "aperture_frame_types"

    id: Mapped[str] = MappedColumn(String, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String(255), nullable=False, default="Unnamed Frame Type")
    width_mm: Mapped[float] = MappedColumn(Float, nullable=False, default=100.0)
    u_value_w_m2k: Mapped[float] = MappedColumn(Float, nullable=False, default=1.0)    
    
    # Relationships
    element_frames: Mapped[list["ApertureElementFrame"]] = relationship(
        "ApertureElementFrame", 
        back_populates="frame_type"
    )
