from typing import TYPE_CHECKING, cast

if TYPE_CHECKING:
    from project import Project

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Mapped, relationship

from database import Base
from db_entities.relationships import project_users


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String)

    # A User can 'own' one or more Projects
    owned_projects: Mapped[list["Project"]] = relationship(
        "Project", back_populates="owner"
    )

    # A User can have access to one or more Projects
    all_projects: Mapped[list["Project"]] = relationship(
        "Project", secondary=project_users, back_populates="users"
    )

    @property
    def owned_project_ids(self) -> list[int]:
        """Return list of project IDs that the user Owns."""
        return [cast(int, project.id) for project in self.owned_projects]

    @property
    def all_project_ids(self) -> list[int]:
        """Return list of all the project IDs that the user has access to."""
        return [cast(int, project.id) for project in self.all_projects]
