# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base

if TYPE_CHECKING:
    from db_entities.app.project import Project


class ProjectManufacturerFilter(Base):
    """Stores per-project manufacturer filter preferences."""

    __tablename__ = "project_manufacturer_filters"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = MappedColumn(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    manufacturer: Mapped[str] = MappedColumn(String(255), nullable=False)
    filter_type: Mapped[str] = MappedColumn(String(50), nullable=False)  # 'frame' or 'glazing'
    is_enabled: Mapped[bool] = MappedColumn(Boolean, nullable=False, default=True)

    project: Mapped["Project"] = relationship("Project", back_populates="manufacturer_filters")
