# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import ARRAY, Float, ForeignKey, Integer, String
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
    row_heights_mm: Mapped[list[float]] = MappedColumn(ARRAY(Float), default=lambda: [1_000.0], nullable=False)
    column_widths_mm: Mapped[list[float]] = MappedColumn(ARRAY(Float), default=lambda: [1_000.0], nullable=False)

    # Foreign Keys
    project_id: Mapped[int] = MappedColumn(Integer, ForeignKey("projects.id"), nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="apertures")
    elements: Mapped[list[ApertureElement]] = relationship(
        "ApertureElement",
        back_populates="aperture",
        cascade="all, delete-orphan",
    )

    @classmethod
    def default(cls, project: "Project") -> "Aperture":
        """Create a default aperture with one row and one column."""
        new_aperture = Aperture(
            name="Unnamed Aperture",
            project=project,
            row_heights_mm=[1_000.0],
            column_widths_mm=[1_000.0],
        )
        ApertureElement(
            row_number=0,
            column_number=0,
            row_span=1,
            col_span=1,
            aperture=new_aperture,
        )
        return new_aperture
