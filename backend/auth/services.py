# python3.11 (Render.com)

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from rich import print
from sqlalchemy.orm import Session

from auth.schema import TokenDataSchema, UserSchema
from database import get_db
from db_entities.user import User

load_dotenv()


# to generate a new SECRET KEY: `openssl rand -hex 32``
JSON_WEB_TOKEN_SECRET_KEY = str(os.getenv("JSON_WEB_TOKEN_SECRET_KEY"))  
JSON_WEB_TOKEN_ALGORITHM = str(os.getenv("JSON_WEB_TOKEN_ALGORITHM"))
JSON_WEB_TOKEN_EXPIRE_MINUTES = int(os.getenv("JSON_WEB_TOKEN_EXPIRE_MINUTES", "30"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except ValueError as e:
        return False


def get_password_hash(password: str) -> bytes:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())


async def get_user(db: Session, username: str) -> User:
    return db.query(User).filter(User.username == username).first()


async def authenticate_user(
    db: Session, username: str, password: str
) -> User | Literal[False]:
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
) -> User:
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
        token_data = TokenDataSchema(username=username)
    except InvalidTokenError:
        raise credentials_exception

    if token_data.username is None:
        raise credentials_exception

    user = await get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserSchema:
    return current_user


CurrentUser = Annotated[User, Depends(get_current_active_user)]


