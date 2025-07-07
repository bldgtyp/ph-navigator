# -*- Python Version: 3.11 -*-

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, MappedColumn

from database import Base

class ApertureElementFrame(Base):
    __tablename__ = "aperture_element_frame"

    id: Mapped[str] = MappedColumn(String, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String(255), nullable=False, default="Unnamed Frame")
    width_mm: Mapped[float] = MappedColumn(Float, nullable=False, default=100.0)
    u_value_w_m2k: Mapped[float] = MappedColumn(Float, nullable=False, default=1.0)

