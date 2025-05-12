# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import Column, Float, String
from sqlalchemy.orm import Mapped, relationship

from database import Base, Session

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.assembly.segment import Segment


class Material(Base):
    __tablename__ = "assembly_materials"

    # Use AirTable String for the primary key
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    argb_color = Column(String)
    conductivity_w_mk = Column(Float)
    emissivity = Column(Float)
    density_kg_m3 = Column(Float)
    specific_heat_j_kgk = Column(Float)

    segments: Mapped[list["Segment"]] = relationship(
        "Segment", back_populates="material"
    )

    @classmethod
    def get_by_name(cls, session: Session, name: str) -> "Material | None":
        return session.query(cls).filter_by(name=name).one_or_none()
