# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Integer, String, ARRAY
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base
from db_entities.aperture.aperture_element import ApertureElement

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.app.project import Project


class Aperture(Base):
    __tablename__ = "apertures"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String)
    row_heights_mm: Mapped[list[float]] = MappedColumn(ARRAY(Float), default=lambda: [100], nullable=False)
    column_widths_mm: Mapped[list[float]] = MappedColumn(ARRAY(Float), default=lambda: [100], nullable=False)

    # Foreign Keys
    project_id: Mapped[int] = MappedColumn(Integer, ForeignKey("projects.id"), nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="apertures")
    elements: Mapped[list[ApertureElement]] = relationship(
        "ApertureElement",
        back_populates="aperture",
        cascade="all, delete-orphan",
    )
