# -*- Python Version: 3.11 (Render.com) -*-

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from db_entities.app.user import User
from features.auth.schema import TokenDataSchema, UserSchema

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------------------
# User-Auth (Website)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except ValueError as e:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def get_user(db: Session, username: str) -> User:
    return db.query(User).filter(User.username == username).first()


async def authenticate_user(
    db: Session, username: str, password: str
) -> User | Literal[False]:
    user = await get_user(db, username)
    if not user:
        logger.error(f"User '{username}' not found.")   
        return False
    
    if not verify_password(password, str(user.hashed_password)):
        logger.error(f"User {user.username} | Password '{password}' is not correct.")
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
        to_encode,
        settings.JSON_WEB_TOKEN_SECRET_KEY,
        algorithm=settings.JSON_WEB_TOKEN_ALGORITHM,
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
            token,
            settings.JSON_WEB_TOKEN_SECRET_KEY,
            algorithms=[settings.JSON_WEB_TOKEN_ALGORITHM],
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
