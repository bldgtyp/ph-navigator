# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, relationship
from sqlalchemy.ext.orderinglist import ordering_list

from database import Base
from db_entities.assembly.layer import Layer
if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.app.project import Project


class Assembly(Base):
    __tablename__ = 'assemblies'

    id = Column(Integer, primary_key=True)
    name = Column(String)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="assemblies"
    )
    layers: Mapped[list[Layer]] = relationship(
        "Layer",
        back_populates="assembly",
        order_by="Layer.order",
        collection_class=ordering_list('order'),
        cascade="all, delete-orphan",
    )
