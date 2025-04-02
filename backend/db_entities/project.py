from typing import cast

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship, validates

from database import Base
from db_entities.airtable.at_base import AirTableBase
from db_entities.relationships import project_users
from db_entities.user import User


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    bt_number = Column(String, index=True)
    phius_number = Column(String, index=True, nullable=True)
    airtable_base_id = Column(Integer, ForeignKey("airtable_bases.id"))
    owner_id = Column(Integer, ForeignKey("users.id"))
    phius_dropbox_url = Column(String, index=True, nullable=True)

    # The AirTable base with the Project's data
    airtable_base: Mapped[AirTableBase] = relationship(
        "AirTableBase", back_populates="project"
    )

    # A Project will always have an 'owner' (User)
    owner: Mapped[User] = relationship("User", back_populates="owned_projects")

    # Users other than the 'owner' can also have access to the project
    users: Mapped[list[User]] = relationship(
        "User", secondary=project_users, back_populates="all_projects"
    )

    @validates("name")
    def convert_to_uppercase(self, key, value):
        return value.upper()

    @property
    def user_ids(self) -> list[int]:
        """Return list of user IDs that have access to this project."""
        return [cast(int, user.id) for user in self.users]

    @property
    def airtable_base_ref(self) -> str:
        """Return the AirTable base reference for this project."""
        return str(self.airtable_base.airtable_ref) if self.airtable_base else ""

    @property
    def airtable_base_url(self) -> str:
        """Return the AirTable base URL for this project."""
        return (
            f"https://airtable.com/{self.airtable_base_ref}"
            if self.airtable_base
            else ""
        )
