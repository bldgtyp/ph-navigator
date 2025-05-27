# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.ext.orderinglist import ordering_list
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base
from db_entities.assembly.layer import Layer
from db_entities.assembly.material import Material

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.app.project import Project


class Assembly(Base):
    __tablename__ = "assemblies"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True)
    name: Mapped[str] = MappedColumn(String)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    project: Mapped["Project"] = relationship("Project", back_populates="assemblies")
    layers: Mapped[list[Layer]] = relationship(
        "Layer",
        back_populates="assembly",
        order_by="Layer.order",
        collection_class=ordering_list("order"),
        cascade="all, delete-orphan",
    )

    @classmethod
    def default(cls, project: "Project", material: "Material") -> "Assembly":
        return Assembly(
            name="Unnamed Assembly", project=project, layers=[Layer.default(material)]
        )

    def remove_all_layers(self):
        """Remove all the existing layers from the assembly."""
        self.layers.clear()

    @property
    def is_steel_stud_assembly(self) -> bool:
        """Check if the assembly contains a steel stud layer."""
        return any([l.is_steel_stud_layer for l in self.layers])
