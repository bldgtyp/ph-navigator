# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import Column, Float, ForeignKey, Integer
from sqlalchemy.ext.orderinglist import ordering_list
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base
from db_entities.assembly.material import Material
from db_entities.assembly.segment import Segment

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.assembly.assembly import Assembly


class Layer(Base):
    __tablename__ = "assembly_layers"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    order: Mapped[int] = MappedColumn(
        Integer
    )  # Used to maintain layer order within the assembly
    thickness_mm: Mapped[float] = MappedColumn(Float, nullable=False)

    # Foreign Keys
    assembly_id: Mapped[int] = MappedColumn(Integer, ForeignKey("assemblies.id"))

    # Relationships
    assembly: Mapped["Assembly"] = relationship("Assembly", back_populates="layers")
    segments: Mapped[list[Segment]] = relationship(
        "Segment",
        back_populates="layer",
        order_by="Segment.order",
        collection_class=ordering_list("order"),
    )

    @classmethod
    def default(cls, material: Material) -> "Layer":
        return Layer(order=0, thickness_mm=50.0, segments=[Segment.default(material)])

    @property
    def is_steel_stud_layer(self) -> bool:
        """Check if the layer has any Steel-Stud segments."""
        return any([s.steel_stud_spacing_mm is not None for s in self.segments])

    @property
    def is_continuous_insulation_layer(self) -> bool:
        """Check if the layer has any Continuous Insulation segments."""
        return any([s.is_continuous_insulation for s in self.segments])
