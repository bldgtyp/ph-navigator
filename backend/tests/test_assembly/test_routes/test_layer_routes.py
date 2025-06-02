# -*- Python Version: 3.11 -*-

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from db_entities.app import Project


def test_create_new_default_layer_on_assembly_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")    
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1

    response = client.post(
        f"/assembly/create-new-layer/{project.assemblies[0].id}",
        json={"order": 1},
    )
    assert response.status_code == 201
    
    session.refresh(project)  # Refresh the Project to get the updated assemblies

    assert len(project.assemblies[0].layers) == 2

def test_get_valid_layer_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1

    layer_id = project.assemblies[0].layers[0].id
    response = client.get(f"/assembly/get-layer/{layer_id}")
    assert response.status_code == 200
    assert response.json()["id"] == layer_id


def test_get_invalid_layer_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1

    invalid_layer_id = 9999  # Assuming this ID does not exist
    assert invalid_layer_id not in [layer.id for layer in project.assemblies[0].layers]
    response = client.get(f"/assembly/get-layer/{invalid_layer_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Layer '9999' not found."


def test_update_layer_thickness_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1

    layer_id = project.assemblies[0].layers[0].id
    new_thickness = 75.0

    response = client.patch(
        f"/assembly/update-layer-thickness/{layer_id}",
        json={"thickness_mm": new_thickness},
    )
    assert response.status_code == 200
    assert response.json()["thickness_mm"] == new_thickness

    # Verify the change in the database
    session.refresh(project)
    updated_layer = next(layer for layer in project.assemblies[0].layers if layer.id == layer_id)
    assert updated_layer.thickness_mm == new_thickness


def test_delete_layer_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1

    # Add a second layer to ensure we can delete the first one
    response = client.post(
        f"/assembly/create-new-layer/{project.assemblies[0].id}",
        json={"order": 1},
    )
    assert response.status_code == 201

    session.refresh(project)  # Refresh the Project to get the updated assemblies

    assert len(project.assemblies[0].layers) == 2
    layer_id_to_delete = project.assemblies[0].layers[0].id
    response = client.delete(f"/assembly/delete-layer/{layer_id_to_delete}")
    assert response.status_code == 200
    assert response.json() is None
    # Verify the layer was deleted
    session.refresh(project)
    assert len(project.assemblies[0].layers) == 1

def test_delete_last_layer_raises_LastLayerAssemblyException_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1

    layer_id_to_delete = project.assemblies[0].layers[0].id
    response = client.delete(f"/assembly/delete-layer/{layer_id_to_delete}")
    
    assert response.status_code == 200
    assert response.json()["detail"] == f"Cannot delete Layer-{layer_id_to_delete}. It is the last layer in Assembly-{project.assemblies[0].id}."

