from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship, validates

from database import Base


class AirTableTable(Base):
    __tablename__ = "airtable_tables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    airtable_ref = Column(String, index=True)
    parent_base_id = Column(Integer, ForeignKey("airtable_bases.id"))

    # Relationship to the base
    airtable_base = relationship("AirTableBase", back_populates="tables")

    @validates("name")
    def convert_to_uppercase(self, key, value):
        return value.upper()
