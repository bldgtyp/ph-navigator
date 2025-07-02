# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.aperture.aperture import Aperture


class ApertureElement(Base):
    __tablename__ = "aperture_elements"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    row_number: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)
    column_number: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)
    row_span: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)
    col_span: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)

    # Foreign Keys
    aperture_id: Mapped[int] = MappedColumn(Integer, ForeignKey("apertures.id"), nullable=False)

    # Relationships
    aperture: Mapped["Aperture"] = relationship("Aperture", back_populates="elements")
