# -*- Python Version: 3.11 -*-

from typing import Annotated, Generator, Type

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, declarative_base, sessionmaker

from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=({"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base: Type[DeclarativeBase] = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


AnnotatedSession = Annotated[Session, Depends(get_db)]
