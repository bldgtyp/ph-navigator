# -*- Python Version: 3.11 (Render.com) -*-

from cryptography.fernet import Fernet
from pydantic import BaseSettings
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)


class Settings(BaseSettings):
    # to generate a new SECRET KEY: `openssl rand -hex 32``
    JSON_WEB_TOKEN_SECRET_KEY: str = "__key__"
    JSON_WEB_TOKEN_ALGORITHM: str = "HS256"
    JSON_WEB_TOKEN_EXPIRE_MINUTES: int = 60
    DATABASE_URL: str = "sqlite:///./test.db"
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "localhost:3000",
        "https://ph-tools.github.io",
        "https://bldgtyp.github.io",
        "https://ph-dash-frontend.onrender.com",
        "https://ph-dash-0cye.onrender.com",
    ]
    AIRTABLE_MATERIAL_BASE_ID: str = "appvuwBhK0he4PbVi"
    AIRTABLE_MATERIAL_TABLE_ID: str = "tbl6GnWtkPX0OALMu"
    AIRTABLE_MATERIAL_GET_TOKEN: str = "__token__"

    # Encryption key for AirTable PAT Tokens
    # To generate a fresh key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    FERNET_SECRET_KEY: str = "__fernet_key__"
    GCP_BUCKET_NAME: str = "__gcp_bucket_name__"

    class Config:
        env_file = ".env"


settings = Settings()  # type: ignore
fernet = Fernet(settings.FERNET_SECRET_KEY)
