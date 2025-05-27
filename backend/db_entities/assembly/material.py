# -*- Python Version: 3.11 (Render.com) -*-

from typing import TYPE_CHECKING

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base, Session

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.assembly.segment import Segment


class Material(Base):
    __tablename__ = "assembly_materials"

    # Use AirTable String for the primary key
    id: Mapped[str] = MappedColumn(String, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String, nullable=False)
    category: Mapped[str] = MappedColumn(String, nullable=False)
    argb_color: Mapped[str | None] = MappedColumn(String)
    conductivity_w_mk: Mapped[float | None] = MappedColumn(Float)
    emissivity: Mapped[float | None] = MappedColumn(Float)
    density_kg_m3: Mapped[float | None] = MappedColumn(Float)
    specific_heat_j_kgk: Mapped[float | None] = MappedColumn(Float)

    segments: Mapped[list["Segment"]] = relationship("Segment", back_populates="material")

    @classmethod
    def get_by_name(cls, session: Session, name: str) -> "Material | None":
        return session.query(cls).filter_by(name=name).one_or_none()
