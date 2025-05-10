# -*- Python Version: 3.11 (Render.com) -*-

from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship, Mapped, MappedColumn
from database import Base

from db_entities.assembly.material import Material
from db_entities.assembly.layer import Layer

class Segment(Base):
    __tablename__ = 'assembly_layer_segments'

    id = Column(Integer, primary_key=True)
    layer_id = Column(Integer, ForeignKey('assembly_layers.id'))
    material_id = Column(Integer, ForeignKey('assembly_materials.id'))
    order = Column(Integer)  # Used to maintain order within the layer
    width_mm: Mapped[float] = MappedColumn(Float, nullable=False)

    layer = relationship("Layer", back_populates="segments")
    material = relationship("Material", back_populates="segments")

    def set_material(self, material: Material):
        if not isinstance(material, Material):
            raise TypeError(f"Expected 'Material', got: {type(material)}")
        self.material = material

    def set_layer(self, layer: Layer):
        if not isinstance(layer, Layer):
            raise TypeError(f"Expected 'Layer', got: {type(layer)}")
        self.layer = layer