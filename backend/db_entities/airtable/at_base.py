from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship, validates

from database import Base


class AirTableBase(Base):
    __tablename__ = "airtable_bases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    airtable_ref = Column(String, index=True)

    # Relationship to the tables in the base
    tables = relationship("AirTableTable", back_populates="airtable_base")

    # Relationship to the project that uses this base
    project = relationship("Project", back_populates="airtable_base")

    @validates("name")
    def convert_to_uppercase(self, key, value):
        return value.upper()
