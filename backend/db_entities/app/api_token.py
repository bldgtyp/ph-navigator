# -*- Python Version: 3.11 (Render.com) -*-

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import Mapped, MappedColumn

from database import Base


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    client_name = Column(String, nullable=False)
    scope = Column(String, nullable=True)  # Optional: Define access scope
    is_active: Mapped[bool] = MappedColumn(Boolean, default=True)
    created_at: Mapped[datetime] = MappedColumn(
        DateTime, default=datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime] = MappedColumn(
        DateTime, nullable=True
    )  # Optional: Expiration date
