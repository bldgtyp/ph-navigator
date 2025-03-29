from __future__ import annotations  # Enables forward references

from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from schemas import Project  # Import Project only for type checking


class UserCreate(BaseModel):
    username: str
    password: str


class User(BaseModel):
    id: int
    username: str
    email: str | None = None
    owned_project_ids: list[int] = []
    all_project_ids: list[int] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------------------


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: str | None = None


# ---------------------------------------------------------------------------------------


class AirTableTableBase(BaseModel):
    name: str
    airtable_ref: str


class AirTableTableCreate(AirTableTableBase):
    pass


class AirTableTable(AirTableTableBase):
    id: int
    parent_base_id: int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------------------


class AirTableBaseBase(BaseModel):
    name: str
    airtable_ref: str


class AirTableBaseCreate(AirTableBaseBase):
    pass


class AirTableBase(AirTableBaseBase):
    id: int
    tables: list[AirTableTable] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------------------


class ProjectBase(BaseModel):
    name: str
    bt_number: str
    phius_number: str | None = None


class ProjectCreate(ProjectBase):
    airtable_base: AirTableBaseCreate


class Project(ProjectBase):
    id: int
    owner_id: int
    user_ids: list[int] = []
    airtable_base_ref: str
    airtable_base_url: str

    class Config:
        from_attributes = True


# Update forward references
User.model_rebuild()
Project.model_rebuild()
