# -*- Python Version: 3.11 (Render.com) -*-

from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column
from sqlalchemy import Enum as SqlEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base
from db_entities.assembly.material import Material
from db_entities.assembly.material_datasheet import MaterialDatasheet
from db_entities.assembly.material_photo import MaterialPhoto

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.assembly.layer import Layer


class SpecificationStatus(str, Enum):
    COMPLETE = "complete"
    MISSING = "missing"
    QUESTION = "question"
    NA = "na"


class Segment(Base):
    __tablename__ = "assembly_layer_segments"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True)
    layer_id: Mapped[int] = MappedColumn(Integer, ForeignKey("assembly_layers.id"))
    material_id: Mapped[str] = MappedColumn(String, ForeignKey("assembly_materials.id"))
    order: Mapped[int] = MappedColumn(
        Integer
    )  # Used to maintain order within the layer
    width_mm: Mapped[float] = MappedColumn(Float, nullable=False)
    steel_stud_spacing_mm: Mapped[float | None] = MappedColumn(
        Float, nullable=True, default=None
    )
    is_continuous_insulation: Mapped[bool] = MappedColumn(
        Boolean, nullable=False, default=False
    )  # for Steel Stud wall assemblies
    specification_status: Mapped[SpecificationStatus] = MappedColumn(
        SqlEnum(SpecificationStatus, name="specification_status_enum"),
        nullable=False,
        default=SpecificationStatus.NA,
    )
    notes: Mapped[str | None] = MappedColumn(Text, nullable=True, default=None)

    # Relationships
    material_photos: Mapped["MaterialPhoto"] = relationship(
        "MaterialPhoto", back_populates="segment", cascade="all, delete-orphan"
    )
    material_datasheets: Mapped["MaterialDatasheet"] = relationship(
        "MaterialDatasheet", back_populates="segment", cascade="all, delete-orphan"
    )
    layer: Mapped["Layer"] = relationship("Layer", back_populates="segments")
    material: Mapped[Material] = relationship("Material", back_populates="segments")

    @classmethod
    def default(cls, material: Material) -> "Segment":
        return Segment(
            order=0,
            width_mm=812.8,  # 32 inches
            material=material,
            steel_stud_spacing_mm=None,
            is_continuous_insulation=False,
        )
