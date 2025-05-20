# -*- Python Version: 3.11 (Render.com) -*-

import logging
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from starlette import status

from config import limiter, settings
from database import get_db
from db_entities.app.user import User
from features.auth.schema import TokenSchema, UserSchema
from features.auth.services import (
    authenticate_user,
    create_access_token,
    get_current_active_user,
)

logger = logging.getLogger()

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


@router.post("/token", status_code=status.HTTP_200_OK)
@limiter.limit("60/hour")
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
    access_token_expires = timedelta(minutes=settings.JSON_WEB_TOKEN_EXPIRE_MINUTES)
    access_token = await create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return TokenSchema(access_token=access_token, token_type="bearer")


@router.get("/user/", response_model=UserSchema)
async def user(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> UserSchema:
    """Return the current user."""
    logger.info(f"user({current_user.id=})")
    return UserSchema.from_orm(current_user)
