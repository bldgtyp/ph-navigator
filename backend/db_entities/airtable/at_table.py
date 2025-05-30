# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship, validates

from database import Base

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.airtable.at_base import AirTableBase


class AirTableTable(Base):
    __tablename__ = "airtable_tables"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String, index=True)
    at_ref: Mapped[str] = MappedColumn(String, index=True)
    parent_base_id: Mapped[str] = MappedColumn(String, ForeignKey("airtable_bases.id"))

    # Relationships
    parent_base: Mapped["AirTableBase"] = relationship("AirTableBase", back_populates="tables")

    @validates("name")
    def clean_name(self, key, value: str) -> str:
        name = value.upper()
        name = name.replace(" ", "_")
        name = name.replace("-", "_")
        name = name.replace(":", "")
        return name
