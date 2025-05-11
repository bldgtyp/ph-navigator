# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship, Mapped, MappedColumn
from sqlalchemy.ext.orderinglist import ordering_list

from database import Base
from db_entities.assembly.segment import Segment
from db_entities.assembly.material import Material
if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.assembly.assembly import Assembly


class Layer(Base):
    __tablename__ = 'assembly_layers'

    id = Column(Integer, primary_key=True)
    assembly_id = Column(Integer, ForeignKey('assemblies.id'))
    order = Column(Integer)  # Used to maintain order within the assembly
    thickness_mm: Mapped[float]  = MappedColumn(Float, nullable=False)

    # Relationships
    assembly: Mapped["Assembly"] = relationship(
        "Assembly",
        back_populates="layers"
    )
    segments: Mapped[list[Segment]] = relationship(
        "Segment",
        back_populates="layer",
        order_by="Segment.order",
        collection_class=ordering_list('order')
    )

    @classmethod
    def default(cls, material: Material) -> "Layer":
        return Layer(
            order=0,
            thickness_mm=50.0,
            segments=[Segment.default(material)]
        )