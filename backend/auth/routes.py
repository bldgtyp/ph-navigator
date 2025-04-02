# -*- Python Version: 3.11 (Render.com) -*-

import logging
import os
from datetime import timedelta
from typing import Annotated

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from starlette import status

from auth.schema import TokenSchema, UserSchema
from auth.services import (
    authenticate_user,
    create_access_token,
    get_current_active_user,
)
from database import get_db
from db_entities.user import User
from rate_limiting import limiter

load_dotenv()
logger = logging.getLogger()

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

JSON_WEB_TOKEN_EXPIRE_MINUTES = int(os.getenv("JSON_WEB_TOKEN_EXPIRE_MINUTES", "30"))


@router.post("/token", status_code=status.HTTP_200_OK)
@limiter.limit("100/hour")
async def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
) -> TokenSchema:
    logger.info(f"login_for_access_token()")
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
    return TokenSchema(access_token=access_token, token_type="bearer")


@router.get("/user/", response_model=UserSchema)
async def user(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> UserSchema:
    """Return the current user."""
    logger.info(f"user(current_user.id={current_user.id})")
    return UserSchema.model_validate(current_user)
