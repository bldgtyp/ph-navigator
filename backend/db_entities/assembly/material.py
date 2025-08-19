# -*- Python Version: 3.11 -*-

from typing import TYPE_CHECKING, Any

from honeybee.typing import clean_ep_string
from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, MappedColumn, relationship, validates

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

    @validates("name")
    def validate_name(self, key: Any, value: str) -> str:
        return clean_ep_string(value) if value else value

    @classmethod
    def get_by_name(cls, session: Session, name: str) -> "Material | None":
        return session.query(cls).filter_by(name=name).one_or_none()

    @property
    def default_argb_color(self) -> str:
        """Set a default ARGB color if not provided."""
        return "(255, 255, 255, 255)"

    @property
    def argb_list(self) -> list[int]:
        """Convert the ARGB color string from the database ie: "(255, 255, 255, 255)" to a list of integers."""

        if not self.argb_color:
            return [int(value) for value in self.default_argb_color.split(",")]
        
        argb_color = self.argb_color.strip()
        argb_color = argb_color.replace("(", "").replace(")", "")
        argb_colors = [int(value) for value in argb_color.split(",")]
        if len(argb_colors) != 4:
            return [int(value) for value in self.default_argb_color.split(",")]
        
        return argb_colors
    
    @property
    def color_a(self) -> int:
        """Get the alpha channel of the ARGB color."""
        return self.argb_list[0]

    @property
    def color_r(self) -> int:
        """Get the red channel of the ARGB color."""
        return self.argb_list[1]

    @property
    def color_g(self) -> int:
        """Get the green channel of the ARGB color."""
        return self.argb_list[2]

    @property
    def color_b(self) -> int:
        """Get the blue channel of the ARGB color."""
        return self.argb_list[3]

