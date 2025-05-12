# -*- Python Version: 3.11 (Render.com) -*-


from typing import TYPE_CHECKING

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Mapped, relationship, validates

from database import Base
from db_entities.airtable.at_table import AirTableTable

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.app.project import Project


class AirTableBase(Base):
    __tablename__ = "airtable_bases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    airtable_ref = Column(String, index=True)

    # Relationship to the tables in the base
    tables: Mapped[list[AirTableTable]] = relationship(
        "AirTableTable", back_populates="airtable_base"
    )

    # Relationship to the project that uses this base
    project: Mapped["Project"] = relationship("Project", back_populates="airtable_base")

    @validates("name")
    def convert_to_uppercase(self, key, value: str) -> str:
        return value.upper()
