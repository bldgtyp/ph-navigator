# -*- Python Version: 3.11 -*-

from typing import Callable, Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import Session, sessionmaker

from database import Base, get_db
from db_entities.app import Project
from features.app.services import create_new_project_in_db, create_new_user_in_db
from features.assembly.services.assembly import append_layer_to_assembly, create_new_empty_assembly_on_project
from features.assembly.services.layer import create_new_layer
from features.assembly.services.material import create_new_material
from features.assembly.services.segment import create_new_segment
from main import app

DATABASE_URL = "sqlite:///:memory:"
testing_engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=testing_engine)


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


@pytest.fixture(scope="function")
def create_test_project(
    session: Session,
) -> Callable[[Session, str, str, str], Project]:
    """Factory fixture to create projects with different configurations.

    Example:
    ```
    def test_multiple_projects(session, create_project):
        # Create different projects as needed
        project1 = create_project(username="user1", project_name="Project 1")
        project2 = create_project(username="user2", project_name="Project 2")
    ```
    """

    def _create_project(db: Session, username="test_user", project_name="Test Project", bt_number="1234") -> Project:
        user = create_new_user_in_db(
            db=session,
            username="test_user",
            email="test@eamil.com",
            hashed_password="12345",
        )
        project = create_new_project_in_db(db=session, name="Test Project", bt_number="1234", owner_id=user.id)
        assembly = create_new_empty_assembly_on_project(db=session, name="Test Assembly", project_id=project.id)
        layer = create_new_layer(thickness_mm=50.0)
        assembly, layer = append_layer_to_assembly(db=session, assembly_id=assembly.id, layer=layer)
        material = create_new_material(
            db=session,
            id="test_material",
            name="Test Material",
            category="Test Category",
        )
        segment = create_new_segment(
            db=session,
            layer_id=layer.id,
            material_id=material.id,
            width_mm=100.0,
            order=1,
        )
        return project

    return _create_project
