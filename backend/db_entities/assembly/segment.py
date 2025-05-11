# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship, Mapped, MappedColumn
from database import Base

from db_entities.assembly.material import Material
if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.assembly.layer import Layer


class Segment(Base):
    __tablename__ = 'assembly_layer_segments'

    id = Column(Integer, primary_key=True)
    layer_id = Column(Integer, ForeignKey('assembly_layers.id'))
    material_id = Column(Integer, ForeignKey('assembly_materials.id'))
    order = Column(Integer)  # Used to maintain order within the layer
    width_mm: Mapped[float] = MappedColumn(Float, nullable=False)

    # Relationships
    layer: Mapped["Layer"] = relationship(
        "Layer",
        back_populates="segments"
    )
    material: Mapped[Material] = relationship(
        "Material",
        back_populates="segments"
    )

    @classmethod
    def default(cls, material: Material) -> "Segment":
        return Segment(
            order=0,
            width_mm=50.0,
            material=material, 
        )