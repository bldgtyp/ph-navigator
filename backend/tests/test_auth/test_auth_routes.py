# -*- Python Version: 3.11 -*-

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from db_entities.app import Project
from features.auth.services import verify_password


def test_token(client: TestClient, session: Session, create_test_project):
    """Test token generation and user authentication."""

    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert project.owner.username == "test_user"
    assert verify_password("12345", project.owner.hashed_password) == True

    response = client.post("/auth/token", data={"username": "test_user", "password": "12345"})
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"


def test_login_failure_wrong_password(client: TestClient, session: Session):
    """Test login failure with wrong password."""

    # Attempt login with wrong password
    response = client.post("/auth/token", data={"username": "test_user", "password": "this_is_not_the_password"})

    # Assert failure
    assert response.status_code == 401
    assert "detail" in response.json()


def test_login_failure_nonexistent_user(client: TestClient):
    """Test login failure with non-existent user."""
    response = client.post("/auth/token", data={"username": "nonexistent_user", "password": "testpassword"})

    assert response.status_code == 401


def test_get_current_user(client: TestClient, session: Session, create_test_project):
    """Test getting the current authenticated user."""

    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    # Login to get token
    login_response = client.post("/auth/token", data={"username": "test_user", "password": "12345"})
    token = login_response.json()["access_token"]

    # Use token to get current user
    response = client.get("/auth/user/", headers={"Authorization": f"Bearer {token}"})

    # Assert successful user retrieval
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["username"] == "test_user"
    assert user_data["email"] == "test@email.com"
    assert "id" in user_data


def test_get_user_without_token(client: TestClient):
    """Test attempting to get user info without a token."""
    response = client.get("/auth/user/")
    assert response.status_code == 401
