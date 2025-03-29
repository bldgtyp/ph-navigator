# python3.11 (Render.com)

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated, Generator, Literal

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jwt.exceptions import InvalidTokenError
from pyairtable import Api
from pyairtable.api.types import RecordDict
from rich import print
from sqlalchemy import Column
from sqlalchemy.orm import Session

import database
import models
import schemas

load_dotenv()


# Sackett Room Data
# https://airtable.com/app64a1JuYVBs7Z1m/tblHB8tkzHso1tfYU/viw7REP61sRyUvbQV?blocks=hide
JSON_WEB_TOKEN_SECRET_KEY = str(
    os.getenv("JSON_WEB_TOKEN_SECRET_KEY")
)  # to generate: openssl rand -hex 32
JSON_WEB_TOKEN_ALGORITHM = str(os.getenv("JSON_WEB_TOKEN_ALGORITHM"))
JSON_WEB_TOKEN_EXPIRE_MINUTES = int(os.getenv("JSON_WEB_TOKEN_EXPIRE_MINUTES", "30"))
AIRTABLE_API_KEY = str(os.getenv("AIRTABLE_API_KEY"))
AIRTABLE_BASE_ID = str(os.getenv("AIRTABLE_BASE_ID"))
AIRTABLE_TABLE_NAME = "tblapLjAFgm7RIllz"


app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

origins = [
    "http://localhost:3000",
    "localhost:3000",
    "https://ph-tools.github.io",
    "https://bldgtyp.github.io",
    "https://ph-dash-frontend.onrender.com",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db() -> Generator[Session, None, None]:
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except ValueError as e:
        return False


def get_password_hash(password: str) -> bytes:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())


async def get_user(db: Session, username: str) -> models.User:
    return db.query(models.User).filter(models.User.username == username).first()


async def get_projects(db: Session, project_ids: list[int]) -> list[models.Project]:
    return db.query(models.Project).filter(models.Project.id.in_(project_ids)).all()


async def authenticate_user(
    db: Session, username: str, password: str
) -> models.User | Literal[False]:
    user = await get_user(db, username)
    if not user:
        return False
    if not verify_password(password, str(user.hashed_password)):
        print(f"User {user.username} | Password '{password}' is not correct.")
        return False
    return user


async def create_access_token(
    data: dict, expires_delta: timedelta | None = None
) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, JSON_WEB_TOKEN_SECRET_KEY, algorithm=JSON_WEB_TOKEN_ALGORITHM
    )
    return encoded_jwt


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, JSON_WEB_TOKEN_SECRET_KEY, algorithms=[JSON_WEB_TOKEN_ALGORITHM]
        )
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except InvalidTokenError:
        raise credentials_exception

    if token_data.username is None:
        raise credentials_exception

    user = await get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: Annotated[models.User, Depends(get_current_user)],
) -> schemas.User:
    return current_user


@app.post("/token")
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
) -> schemas.Token:
    # -- Authenticate User
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # -- Create JWT Token
    access_token_expires = timedelta(minutes=JSON_WEB_TOKEN_EXPIRE_MINUTES)
    access_token = await create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return schemas.Token(access_token=access_token, token_type="bearer")


@app.get("/user/", response_model=schemas.User)
async def user(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> schemas.User:
    """Return the current user."""
    return schemas.User.model_validate(current_user)


@app.get("/get_project_card_data", response_model=list[schemas.Project])
async def get_project_card_data(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
) -> list[schemas.Project]:
    projects = await get_projects(db, current_user.all_project_ids)
    return [schemas.Project.model_validate(p) for p in projects]


# @app.get("/users/me/items/")
# async def read_own_items(
#     current_user: Annotated[schemas.User, Depends(get_current_active_user)],
# ) -> list[dict]:
#     return [{"item_id": "Foo", "owner": current_user.username}]


# @app.get("/data")
# def get_data() -> list[RecordDict]:
#     api = Api(AIRTABLE_API_KEY)
#     table = api.table(base_id=AIRTABLE_BASE_ID, table_name=AIRTABLE_TABLE_NAME)
#     data = table.all()
#     return data
