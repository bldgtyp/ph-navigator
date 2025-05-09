# -*- Python Version: 3.11 (Render.com) -*-

from sqlalchemy import Column, String, Float
from sqlalchemy.orm import relationship

from database import Base, Session

class Material(Base):
    __tablename__ = "assembly_materials"

    # Use AirTable String for the primary key
    id = Column(String, primary_key=True, index=True)  
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    argb_color = Column(String)
    conductivity_w_mk = Column(Float)
    emissivity = Column(Float)

    segments = relationship("Segment", back_populates="material")

    @classmethod
    def get_by_name(cls, session: Session, name: str) -> "Material | None":
        return session.query(cls).filter_by(name=name).one_or_none()