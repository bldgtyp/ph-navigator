from typing import Generator

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker, Session

from database import get_db, Base
from main import app

DATABASE_URL = "sqlite:///:memory:"    
testing_engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=testing_engine)

# client = TestClient(app)


# def override_get_db():
#     db = TestingSessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()


# app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    """Create a test client using the test database."""
    # Override the get_db dependency
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    # Reset the override after tests complete
    app.dependency_overrides = {}


@pytest.fixture(scope="function")
def session() -> Generator[Session, None, None]:
    """Create a new database session for a test."""
    Base.metadata.create_all(bind=testing_engine)
    db_session = TestingSessionLocal()

    # TODO: Add some dummy data....

    yield db_session

    db_session.close()
    Base.metadata.drop_all(bind=testing_engine)