# -*- Python Version: 3.11 -*-

from database import Base
from sqlalchemy import Column, ForeignKey, Integer, Table

# Association table for the many-to-many relationship between Projects and Users
project_users = Table(
    "project_users",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
)
