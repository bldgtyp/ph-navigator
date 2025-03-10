from pydantic import BaseModel



class UserCreate(BaseModel):
    username: str
    password: str


class User(BaseModel):
    id: int
    username: str
    email: str | None = None
    # projects: list["Project"] = [] # Causes a circular reference error
    class Config:
        from_attributes = True

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
    airtable_base: AirTableBase
    owner: User
    users: list[User] = []

    class Config:
        from_attributes = True

# Update forward references
User.model_rebuild()
Project.model_rebuild()