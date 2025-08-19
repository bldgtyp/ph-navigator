# -*- Python Version: 3.11 -*-


from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, MappedColumn, relationship

from database import Base
from db_entities.aperture.frame_type import ApertureFrameType

class ApertureElementFrame(Base):
    __tablename__ = "aperture_element_frame"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String(255), nullable=False, default="Unnamed Frame")
    frame_type_id: Mapped[str] = MappedColumn(String, ForeignKey("aperture_frame_types.id"))
    
    # Relationships
    frame_type: Mapped[ApertureFrameType] = relationship(
        "ApertureFrameType", 
        back_populates="element_frames"
    )
