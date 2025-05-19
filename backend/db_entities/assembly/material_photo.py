# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.assembly.segment import Segment


class MaterialPhoto(Base):
    __tablename__ = "material_photos"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True)
    segment_id: Mapped[int] = MappedColumn(
        Integer, ForeignKey("assembly_layer_segments.id"), nullable=False
    )
    full_size_url: Mapped[str] = MappedColumn(String, nullable=False)
    thumbnail_url: Mapped[str] = MappedColumn(String, nullable=False)

    # Relationships
    segment: Mapped["Segment"] = relationship(
        "Segment", back_populates="material_photos"
    )
