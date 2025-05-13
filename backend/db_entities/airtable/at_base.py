# -*- Python Version: 3.11 (Render.com) -*-


from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, relationship, validates, MappedColumn

from database import Base
from db_entities.airtable.at_table import AirTableTable

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.app.project import Project


class AirTableBase(Base):
    __tablename__ = "airtable_bases"

    id: Mapped[str] = MappedColumn(String, primary_key=True, index=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="airtable_base")
    tables: Mapped[list[AirTableTable]] = relationship(
        "AirTableTable", back_populates="parent_base"
    )

    @validates("name")
    def convert_to_uppercase(self, key, value: str) -> str:
        return value.upper()
