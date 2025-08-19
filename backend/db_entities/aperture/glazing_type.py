# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.aperture.aperture_glazing import ApertureElementGlazing


class ApertureGlazingType(Base):
    __tablename__ = "aperture_glazing_types"

    id: Mapped[str] = MappedColumn(String, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String(255), nullable=False, default="Unnamed Glazing Type")
    u_value_w_m2k: Mapped[float] = MappedColumn(Float, nullable=False, default=1.0)
    g_value: Mapped[float] = MappedColumn(Float, nullable=False, default=0.5)
    manufacturer: Mapped[str | None] = MappedColumn(String(255), nullable=True)
    brand: Mapped[str | None] = MappedColumn(String(255), nullable=True)
    source: Mapped[str | None] = MappedColumn(String(255), nullable=True)
    datasheet_url: Mapped[str | None] = MappedColumn(String, nullable=True)
    link: Mapped[str | None] = MappedColumn(String, nullable=True)
    comments: Mapped[str | None] = MappedColumn(String, nullable=True)

    # Relationships
    element_glazings: Mapped[list["ApertureElementGlazing"]] = relationship(
        "ApertureElementGlazing",
        back_populates="glazing_type"
    )
