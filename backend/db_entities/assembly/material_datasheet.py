# -*- Python Version: 3.11 (Render.com) -*-

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class MaterialDatasheet(Base):
    __tablename__ = "material_datasheets"

    id = Column(Integer, primary_key=True)
    segment_id = Column(
        Integer, ForeignKey("assembly_layer_segments.id"), nullable=False
    )
    full_size_url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=False)

    segment = relationship("Segment", back_populates="material_datasheets")
