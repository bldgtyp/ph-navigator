# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
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
    name: Mapped[str] = MappedColumn(String(255), nullable=False, default="Unnamed Aperture-Element")
    row_number: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)
    column_number: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)
    row_span: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)
    col_span: Mapped[int] = MappedColumn(Integer, default=1, nullable=False)

    # Foreign Keys
    aperture_id: Mapped[int] = MappedColumn(Integer, ForeignKey("apertures.id"), nullable=False)
    glazing_id: Mapped[str | None] = MappedColumn(String, ForeignKey("aperture_element_glazing.id"), nullable=True)
    frame_top_id: Mapped[str | None] = MappedColumn(String, ForeignKey("aperture_element_frame.id"), nullable=True)
    frame_right_id: Mapped[str | None] = MappedColumn(String, ForeignKey("aperture_element_frame.id"), nullable=True)
    frame_bottom_id: Mapped[str | None] = MappedColumn(String, ForeignKey("aperture_element_frame.id"), nullable=True)
    frame_left_id: Mapped[str | None] = MappedColumn(String, ForeignKey("aperture_element_frame.id"), nullable=True)

    # Relationships
    aperture: Mapped["Aperture"] = relationship("Aperture", back_populates="elements")
    glazing: Mapped["ApertureElementGlazing | None"] = relationship(
        "ApertureElementGlazing",
        foreign_keys=[glazing_id],
    )
    frame_top: Mapped["ApertureElementFrame | None"] = relationship(
        "ApertureElementFrame",
        foreign_keys=[frame_top_id],
    )
    frame_right: Mapped["ApertureElementFrame | None"] = relationship(
        "ApertureElementFrame",
        foreign_keys=[frame_right_id],
    )
    frame_bottom: Mapped["ApertureElementFrame | None"] = relationship(
        "ApertureElementFrame",
        foreign_keys=[frame_bottom_id],
    )
    frame_left: Mapped["ApertureElementFrame | None"] = relationship(
        "ApertureElementFrame",
        foreign_keys=[frame_left_id],
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
    def frame_ids(self) -> list[str | None]:
        """Return a list with all of the frame IDs."""
        return [
            self.frame_top_id,
            self.frame_right_id,
            self.frame_bottom_id,
            self.frame_left_id,
        ]