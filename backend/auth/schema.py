from pydantic import BaseModel  # , EmailStr

# ---------------------------------------------------------------------------------------


class UserCreateSchema(BaseModel):
    username: str
    password: str


class UserSchema(BaseModel):
    id: int
    username: str
    email: str | None = None
    owned_project_ids: list[int] = []
    all_project_ids: list[int] = []

    class Config:
        from_attributes = True


UserSchema.model_rebuild() # Update the forward references in the model


# ---------------------------------------------------------------------------------------


class TokenSchema(BaseModel):
    access_token: str
    token_type: str


class TokenDataSchema(BaseModel):
    username: str | None = None

