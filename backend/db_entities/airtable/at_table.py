# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship, validates

from database import Base

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.airtable.at_base import AirTableBase


class AirTableTable(Base):
    __tablename__ = "airtable_tables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    airtable_ref = Column(String, index=True)
    parent_base_id = Column(Integer, ForeignKey("airtable_bases.id"))

    # Relationships
    airtable_base: Mapped["AirTableBase"] = relationship(
        "AirTableBase", back_populates="tables"
    )

    @validates("name")
    def convert_to_uppercase(self, key, value: str) -> str:
        return value.upper()
