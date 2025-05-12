# -*- Python Version: 3.11 (Render.com) -*-

import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from rich import print
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from db_entities.app.api_token import APIKey
from db_entities.app.user import User
from features.auth.schema import TokenDataSchema, UserSchema

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# ---------------------------------------------------------------------------------------
# User-Auth (Website)


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


# ---------------------------------------------------------------------------------------
# API-Token Auth (3D Party API)


async def generate_api_key(
    client_name: str,
    scope: str | None = None,
    expires_at: datetime | None = None,
    db: Session = Depends(get_db),
) -> str:
    key = secrets.token_hex(32)  # Generate a 64-character hex key
    api_key = APIKey(
        key=key,
        client_name=client_name,
        scope=scope,
        expires_at=expires_at,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return key


async def validate_api_key(
    api_key: str = Header(...), db: Session = Depends(get_db)
) -> APIKey:
    api_key_record = db.query(APIKey).filter_by(key=api_key, is_active=True).first()

    if not api_key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
        )

    if api_key_record.expires_at and api_key_record.expires_at < datetime.now(
        timezone.utc
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="API key has expired"
        )

    return api_key_record
