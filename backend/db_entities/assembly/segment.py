# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base
from db_entities.assembly.material import Material

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.assembly.layer import Layer


class Segment(Base):
    __tablename__ = "assembly_layer_segments"

    id = Column(Integer, primary_key=True)
    layer_id = Column(Integer, ForeignKey("assembly_layers.id"))
    material_id = Column(String, ForeignKey("assembly_materials.id"))
    order = Column(Integer)  # Used to maintain order within the layer
    width_mm: Mapped[float] = MappedColumn(Float, nullable=False)

    # Relationships
    layer: Mapped["Layer"] = relationship("Layer", back_populates="segments")
    material: Mapped[Material] = relationship("Material", back_populates="segments")

    @classmethod
    def default(cls, material: Material) -> "Segment":
        return Segment(
            order=0,
            width_mm=812.8,  # 32 inches
            material=material,
        )
