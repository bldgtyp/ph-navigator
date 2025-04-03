# -*- Python Version: 3.11 (Render.com) -*-

from pydantic_settings import BaseSettings
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

class Settings(BaseSettings):
    # to generate a new SECRET KEY: `openssl rand -hex 32``
    JSON_WEB_TOKEN_SECRET_KEY: str
    JSON_WEB_TOKEN_ALGORITHM: str
    JSON_WEB_TOKEN_EXPIRE_MINUTES: int = 30
    DATABASE_URL: str
    AIRTABLE_GET_TOKEN: str
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "localhost:3000",
        "https://ph-tools.github.io",
        "https://bldgtyp.github.io",
        "https://ph-dash-frontend.onrender.com",
        "https://ph-dash-0cye.onrender.com",
    ]

    class Config:
        env_file = ".env"

settings = Settings() # type: ignore
