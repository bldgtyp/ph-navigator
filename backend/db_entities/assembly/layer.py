# -*- Python Version: 3.11 (Render.com) -*-

from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.orderinglist import ordering_list
from database import Base

class Layer(Base):
    __tablename__ = 'assembly_layers'

    id = Column(Integer, primary_key=True)
    assembly_id = Column(Integer, ForeignKey('assemblies.id'))
    order = Column(Integer)  # Used to maintain order within the assembly
    thickness_mm = Column(Float)

    assembly = relationship("Assembly", back_populates="layers")

    segments = relationship(
        "Segment",
        back_populates="layer",
        order_by="Segment.order",
        collection_class=ordering_list('order')
    )