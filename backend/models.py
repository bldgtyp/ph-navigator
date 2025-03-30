from typing import cast
from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, relationship

from database import Base

# Association table for the many-to-many relationship between Projects and Users
project_users = Table(
    "project_users",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
)


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


class AirTableBase(Base):
    __tablename__ = "airtable_bases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    airtable_ref = Column(String, index=True)

    # Relationship to the tables in the base
    tables = relationship("AirTableTable", back_populates="airtable_base")

    # Relationship to the project that uses this base
    project = relationship("Project", back_populates="airtable_base")


class AirTableTable(Base):
    __tablename__ = "airtable_tables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    airtable_ref = Column(String, index=True)
    parent_base_id = Column(Integer, ForeignKey("airtable_bases.id"))

    # Relationship to the base
    airtable_base = relationship("AirTableBase", back_populates="tables")


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
    airtable_base: Mapped[AirTableBase] = relationship("AirTableBase", back_populates="project")

    # A Project will always have an 'owner' (User)
    owner: Mapped[User] = relationship("User", back_populates="owned_projects")

    # Users other than the 'owner' can also have access to the project
    users: Mapped[list[User]] = relationship("User", secondary=project_users, back_populates="all_projects")

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
        return f"https://airtable.com/{self.airtable_base_ref}" if self.airtable_base else ""