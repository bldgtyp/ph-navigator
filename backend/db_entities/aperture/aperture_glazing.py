# -*- Python Version: 3.11 -*-

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base
from db_entities.aperture.glazing_type import ApertureGlazingType


class ApertureElementGlazing(Base):
    __tablename__ = "aperture_element_glazing"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String(255), nullable=False, default="Unnamed Glazing")
    glazing_type_id: Mapped[str] = MappedColumn(String, ForeignKey("aperture_glazing_types.id"))

    # TODO:
    # photos ....
    # datasheets ...
    # specification status...

    # Relationships
    glazing_type: Mapped[ApertureGlazingType] = relationship("ApertureGlazingType", back_populates="element_glazings")
