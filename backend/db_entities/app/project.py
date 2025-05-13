# -*- Python Version: 3.11 (Render.com) -*-

from typing import cast

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship, validates, MappedColumn

from database import Base
from db_entities.airtable.at_base import AirTableBase
from db_entities.app.relationships import project_users
from db_entities.app.user import User
from db_entities.assembly.assembly import Assembly


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = MappedColumn(Integer, primary_key=True, index=True)
    name: Mapped[str] = MappedColumn(String, index=True)
    bt_number: Mapped[str] = MappedColumn(String, index=True)
    phius_number: Mapped[str | None] = MappedColumn(String, index=True, nullable=True)
    phius_dropbox_url: Mapped[str | None] = MappedColumn(String, index=True, nullable=True)

    owner_id: Mapped[int] = MappedColumn(Integer, ForeignKey("users.id"))
    airtable_base_id: Mapped[str] = MappedColumn(String, ForeignKey("airtable_bases.id"), nullable=True)

    # -----------------------------------------------------------------------------------
    # Relationships
    assemblies: Mapped[list[Assembly]] = relationship(
        "Assembly",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Assembly.name",
    )
    airtable_base: Mapped[AirTableBase] = relationship(
        "AirTableBase",
        back_populates="project",
    )
    owner: Mapped[User] = relationship(
        "User",
        back_populates="owned_projects",
    )
    users: Mapped[list[User]] = relationship(
        "User",
        secondary=project_users,
        back_populates="all_projects",
    )

    @validates("name")
    def convert_to_uppercase(self, key, value: str) -> str:
        return value.upper()

    @property
    def user_ids(self) -> list[int]:
        """Return list of user IDs that have access to this project."""
        return [cast(int, user.id) for user in self.users]

    @property
    def airtable_base_url(self) -> str:
        """Return the AirTable base URL for this project."""
        return (
            f"https://airtable.com/{self.airtable_base.id}"
            if self.airtable_base
            else ""
        )
