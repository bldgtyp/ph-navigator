# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.aperture.aperture_element import ApertureElement


class ApertureElementFrame(Base):
    __tablename__ = "aperture_element_frame"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String(255), nullable=False, default="Unnamed Frame")
    width_mm: Mapped[float] = MappedColumn(Float, nullable=False, default=100.0)
    u_value_w_m2k: Mapped[float] = MappedColumn(Float, nullable=False, default=1.0)

