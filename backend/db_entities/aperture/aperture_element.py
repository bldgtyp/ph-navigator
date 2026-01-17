# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, JSON
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base
from db_entities.aperture.aperture_frame import ApertureElementFrame
from db_entities.aperture.aperture_glazing import ApertureElementGlazing

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.aperture.aperture import Aperture


class ApertureElement(Base):
    __tablename__ = "aperture_elements"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String(255), nullable=False, default="Unnamed")
    row_number: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)
    column_number: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)
    row_span: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)
    col_span: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)
    operation: Mapped[dict | None] = MappedColumn(JSON, nullable=True, default=None)

    # Foreign Keys
    aperture_id: Mapped[int] = MappedColumn(Integer, ForeignKey("apertures.id"), nullable=False)
    glazing_id: Mapped[int] = MappedColumn(Integer, ForeignKey("aperture_element_glazing.id"), nullable=True)
    frame_top_id: Mapped[int] = MappedColumn(Integer, ForeignKey("aperture_element_frame.id"), nullable=True)
    frame_right_id: Mapped[int] = MappedColumn(Integer, ForeignKey("aperture_element_frame.id"), nullable=True)
    frame_bottom_id: Mapped[int] = MappedColumn(Integer, ForeignKey("aperture_element_frame.id"), nullable=True)
    frame_left_id: Mapped[int] = MappedColumn(Integer, ForeignKey("aperture_element_frame.id"), nullable=True)

    # Relationships
    aperture: Mapped["Aperture"] = relationship("Aperture", back_populates="elements")
    glazing: Mapped["ApertureElementGlazing"] = relationship(
        "ApertureElementGlazing",
        foreign_keys=[glazing_id],
        cascade="all, delete-orphan",
        single_parent=True,
    )
    frame_top: Mapped["ApertureElementFrame"] = relationship(
        "ApertureElementFrame",
        foreign_keys=[frame_top_id],
        cascade="all, delete-orphan",
        single_parent=True,
    )
    frame_right: Mapped["ApertureElementFrame"] = relationship(
        "ApertureElementFrame",
        foreign_keys=[frame_right_id],
        cascade="all, delete-orphan",
        single_parent=True,
    )
    frame_bottom: Mapped["ApertureElementFrame"] = relationship(
        "ApertureElementFrame",
        foreign_keys=[frame_bottom_id],
        cascade="all, delete-orphan",
        single_parent=True,
    )
    frame_left: Mapped["ApertureElementFrame"] = relationship(
        "ApertureElementFrame",
        foreign_keys=[frame_left_id],
        cascade="all, delete-orphan",
        single_parent=True,
    )

    @property
    def frames(self):
        """Bundle individual frame relationships for Pydantic serialization."""
        return {
            "top": self.frame_top,
            "right": self.frame_right,
            "bottom": self.frame_bottom,
            "left": self.frame_left,
        }

    @property
    def frame_ids(self) -> list[int]:
        """Return a list with all of the frame IDs."""
        return [
            self.frame_top_id,
            self.frame_right_id,
            self.frame_bottom_id,
            self.frame_left_id,
        ]
