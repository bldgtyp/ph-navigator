# -*- Python Version: 3.11 -*-

from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.ext.orderinglist import ordering_list
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base
from db_entities.assembly.layer import Layer
from db_entities.assembly.material import Material

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.app.project import Project


class AssemblyOrientation(Enum):
    FIRST_LAYER_OUTSIDE = "first_layer_outside"  # Index 0 is outside
    LAST_LAYER_OUTSIDE = "last_layer_outside"  # Last index is outside


class Assembly(Base):
    __tablename__ = "assemblies"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True)
    name: Mapped[str] = MappedColumn(String)
    project_id: Mapped[int] = MappedColumn(Integer, ForeignKey("projects.id"), nullable=False)
    project: Mapped["Project"] = relationship("Project", back_populates="assemblies")
    layers: Mapped[list[Layer]] = relationship(
        "Layer",
        back_populates="assembly",
        order_by="Layer.order",
        collection_class=ordering_list("order"),
        cascade="all, delete-orphan",
    )
    orientation: Mapped[str] = MappedColumn(String, default=AssemblyOrientation.FIRST_LAYER_OUTSIDE.value)

    @classmethod
    def default(cls, project: "Project", material: "Material") -> "Assembly":
        return Assembly(name="Unnamed Assembly", project=project, layers=[Layer.default(material)])

    def remove_all_layers(self):
        """Remove all the existing layers from the assembly."""
        self.layers.clear()

    @property
    def is_steel_stud_assembly(self) -> bool:
        """Check if the assembly contains a steel stud layer."""
        return any([l.is_steel_stud_layer for l in self.layers])

    @property
    def outside_layer(self) -> Layer | None:
        """Get the layer that's considered the outside of the assembly."""
        if not self.layers:
            return None

        if self.orientation == AssemblyOrientation.FIRST_LAYER_OUTSIDE.value:
            return self.layers[0]
        else:
            return self.layers[-1]

    @property
    def inside_layer(self) -> Layer | None:
        """Get the layer that's considered the inside of the assembly."""
        if not self.layers:
            return None

        if self.orientation == AssemblyOrientation.FIRST_LAYER_OUTSIDE.value:
            return self.layers[-1]
        else:
            return self.layers[0]

    @property
    def layers_outside_to_inside(self) -> list[Layer]:
        """Get layers ordered from outside to inside."""
        if self.orientation == AssemblyOrientation.FIRST_LAYER_OUTSIDE.value:
            return self.layers  # Already in outside-to-inside order
        else:
            return list(reversed(self.layers))

    @property
    def layers_inside_to_outside(self) -> list[Layer]:
        """Get layers ordered from inside to outside."""
        if self.orientation == AssemblyOrientation.FIRST_LAYER_OUTSIDE.value:
            return list(reversed(self.layers))
        else:
            return self.layers  # Already in inside-to-outside order

    def flip_orientation(self):
        """Flip which side of the assembly is considered outside."""
        if self.orientation == AssemblyOrientation.FIRST_LAYER_OUTSIDE.value:
            self.orientation = AssemblyOrientation.LAST_LAYER_OUTSIDE.value
        else:
            self.orientation = AssemblyOrientation.FIRST_LAYER_OUTSIDE.value
