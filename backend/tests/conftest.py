# -*- Python Version: 3.11 -*-

# Set test environment variables BEFORE importing any modules that depend on config
import os

os.environ.setdefault(
    "FERNET_SECRET_KEY", "wONeDFh6szFQydAR54mE2NcXvx49PNclcovPyrTT2eM="
)

from typing import Callable, Generator

import pytest
from database import Base, get_db
from db_entities.app import Project
from fastapi.testclient import TestClient
from features.app.services import create_new_project, create_new_user
from features.assembly.services.assembly import (
    append_layer_to_assembly,
    create_new_empty_assembly_on_project,
)
from features.assembly.services.layer import create_new_layer
from features.assembly.services.material import create_new_material
from features.assembly.services.segment import create_new_segment
from features.auth.services import get_password_hash
from main import app
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = "sqlite:///:memory:"
testing_engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=testing_engine
)
TEST_PASSWORD = get_password_hash("12345")


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

    def _create_project(
        db: Session, username="test_user", project_name="Test Project", bt_number="1234"
    ) -> Project:
        user = create_new_user(
            db=session,
            username="test_user",
            email="test@email.com",
            hashed_password=TEST_PASSWORD,
        )
        project = create_new_project(
            db=session, name="Test Project", bt_number="1234", owner_id=user.id
        )
        assembly = create_new_empty_assembly_on_project(
            db=session, name="Test Assembly", bt_number=project.bt_number
        )
        layer = create_new_layer(thickness_mm=50.0)
        assembly, layer = append_layer_to_assembly(
            db=session, assembly_id=assembly.id, layer=layer
        )
        material = create_new_material(
            db=session,
            id="test_material",
            name="Test Material",
            category="Test Category",
            argb_color="255,255,255,255",
            conductivity_w_mk=1.0,
            emissivity=0.9,
            density_kg_m3=999,
            specific_heat_j_kgk=999,
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
