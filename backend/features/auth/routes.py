# -*- Python Version: 3.11 -*-

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
from features.auth.services import authenticate_user, create_access_token, get_current_active_user

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

logger = logging.getLogger()


@router.post("/token", response_model=TokenSchema)
@limiter.limit("60/hour")
async def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
) -> TokenSchema:
    logger.info(f"auth/login_for_access_token({form_data.username=}, form_data.password=....)")

    try:
        # -- Authenticate User
        user = authenticate_user(db, form_data.username, form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # -- Create JWT Token
        access_token_expires = timedelta(minutes=settings.JSON_WEB_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
        return TokenSchema(access_token=access_token, token_type="bearer")
    except Exception as e:
        logger.error(f"Authentication failed for user {form_data.username}: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")


@router.get("/user/", response_model=UserSchema)
async def user(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> UserSchema:
    """Return the current user."""
    logger.info(f"auth/user({current_user.id=})")

    try:
        return UserSchema.from_orm(current_user)
    except Exception as e:
        logger.error(f"Failed to retrieve user {current_user.id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve user data")
