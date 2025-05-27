# -*- Python Version: 3.11 (Render.com) -*-


from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, MappedColumn, relationship, validates

from config import fernet
from database import Base
from db_entities.airtable.at_table import AirTableTable

if TYPE_CHECKING:
    # Backwards relationships only
    from db_entities.app.project import Project


class AirTableBase(Base):
    __tablename__ = "airtable_bases"

    id: Mapped[str] = MappedColumn(String, primary_key=True, index=True)
    _airtable_access_token_encrypted: Mapped[str | None] = MappedColumn("airtable_token", String, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="airtable_base")
    tables: Mapped[list[AirTableTable]] = relationship("AirTableTable", back_populates="parent_base")

    @validates("name")
    def convert_to_uppercase(self, key, value: str) -> str:
        return value.upper()

    @property
    def airtable_access_token(self) -> str | None:
        """Get the decrypted value of the airtable access token."""
        if self._airtable_access_token_encrypted:
            return fernet.decrypt(self._airtable_access_token_encrypted.encode()).decode()
        return None

    @airtable_access_token.setter
    def airtable_access_token(self, value: str) -> None:
        """Set the encrypted value of the airtable access token."""
        if value:
            self._airtable_access_token_encrypted = fernet.encrypt(value.encode()).decode()
        else:
            self._airtable_access_token_encrypted = None
