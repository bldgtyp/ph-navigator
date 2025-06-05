# -*- Python Version: 3.11 -*-

import pytest
from sqlalchemy.orm import Session

from db_entities.app.project import Project
from features.app.services import (
    ProjectAlreadyExistsException,
    ProjectNotFoundException,
    create_new_project,
    create_new_user,
    get_project_by_bt_number,
    get_project_by_id,
    get_all_projects,
)


def test_get_project_by_bt_number_fails_on_empty_database(session: Session):
    with pytest.raises(ProjectNotFoundException):
        get_project_by_bt_number(session, "nonexistent_bt_number")


def test_get_valid_project_by_bt_number_route(session: Session, create_test_project):
    existing_project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    pr = get_project_by_bt_number(session, existing_project.bt_number)

    assert pr.id == existing_project.id


def test_get_valid_project_by_id_route(session: Session, create_test_project):
    existing_project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    pr = get_project_by_id(session, existing_project.id)

    assert pr.id == existing_project.id


def test_get_projects(session: Session, create_test_project):
    existing_project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    existing_user = existing_project.owner
    assert existing_project.owner_id == existing_user.id
    assert len(existing_user.owned_projects) == 1

    projects = get_all_projects(db=session, project_ids=[existing_project.id])

    assert len(projects) == 1
    assert projects[0].id == existing_project.id


def test_create_new_project(session: Session, create_test_project):
    existing_project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    existing_user = existing_project.owner
    assert existing_project.owner_id == existing_user.id
    assert len(existing_user.owned_projects) == 1

    create_new_project(
        db=session,
        name="A New Project",
        owner_id=existing_user.id,
        bt_number="BT12345",
        phius_number="1245",
    )

    assert len(existing_user.owned_projects) == 2


def test_create_new_project_with_duplicate_bt_number_raises_ProjectAlreadyExistsException(
    session: Session, create_test_project
):
    existing_project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    existing_user = existing_project.owner
    assert existing_project.owner_id == existing_user.id
    assert len(existing_user.owned_projects) == 1

    with pytest.raises(ProjectAlreadyExistsException):
        create_new_project(
            db=session,
            name="A New Project",
            owner_id=existing_user.id,
            bt_number=existing_project.bt_number,
            phius_number="1245",
        )

    assert len(existing_user.owned_projects) == 1  # Project not created


def test_create_new_user(session: Session, create_test_project):
    new_user = create_new_user(
        db=session,
        username="new_user",
        email="email",
        hashed_password="hashed_password",
    )

    assert new_user.username == "new_user"
    assert new_user.email == "email"
    assert new_user.hashed_password == "hashed_password"
    assert len(new_user.owned_projects) == 0  # New user should not have any projects yet
