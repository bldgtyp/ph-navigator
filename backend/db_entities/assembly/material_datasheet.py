# -*- Python Version: 3.11 (Render.com) -*-

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base


class MaterialDatasheet(Base):
    __tablename__ = "material_datasheets"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True)
    segment_id: Mapped[int] = MappedColumn(
        Integer, ForeignKey("assembly_layer_segments.id"), nullable=False
    )
    full_size_url: Mapped[str] = MappedColumn(String, nullable=False)
    thumbnail_url: Mapped[str] = MappedColumn(String, nullable=False)

    segment = relationship("Segment", back_populates="material_datasheets")
