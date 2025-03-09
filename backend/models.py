from sqlalchemy import Column, Integer, String, ForeignKey, Table
from sqlalchemy.orm import relationship

from database import Base

# Association table for the many-to-many relationship between Projects and Users
project_users = Table(
    'project_users',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String)

    owned_projects = relationship("Project", back_populates="owner")
    
    # Relationship to the projects this user is associated with (either as owner or with access)
    projects = relationship("Project", secondary=project_users, back_populates="users")


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

    # Relationship to the base
    airtable_base = relationship("AirTableBase", back_populates="project")
    
    # Relationship to the owner
    owner = relationship("User", back_populates="owned_projects")
    
    # Relationship to the users who have access to the project
    users = relationship("User", secondary=project_users, back_populates="projects")

