# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship, Mapped
from database import Base

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.assembly.segment import Segment


class MaterialPhoto(Base):
    __tablename__ = "material_photos"

    id = Column(Integer, primary_key=True)
    segment_id = Column(
        Integer, ForeignKey("assembly_layer_segments.id"), nullable=False
    )
    full_size_url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=False)

    # Relationships
    segment: Mapped["Segment"] = relationship(
        "Segment", back_populates="material_photos"
    )
