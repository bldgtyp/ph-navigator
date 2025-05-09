# -*- Python Version: 3.11 (Render.com) -*-

"""Utility to add some fake users to the database for testing and development."""

import bcrypt
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine, get_db
from db_entities.airtable.at_base import AirTableBase
from db_entities.airtable.at_table import AirTableTable
from db_entities.app.project import Project
from db_entities.app.user import User
from db_entities.assembly.material import Material
from db_entities.assembly.assembly import Assembly
from db_entities.assembly.layer import Layer
from db_entities.assembly.segment import Segment


# Mock Data
PROJECT_DATA = [
    {
        "name": "409 Sackett St",
        "airtable_ref": "app64a1JuYVBs7Z1m",
        "bt_number": 2305,
        "phius_number": 2445,
        "phius_dropbox_url": "https://www.dropbox.com/scl/fo/wqjaevwa95qaoij71bw89/h?rlkey=nwbwyt67ou62c6ir36zsjkodz&dl=0",
        "tables": {
            "SUMMARY": "tblapLjAFgm7RIllz",
            "CONFIG": "tblRMar5uK7mDZ8yM",
            "FANS": "tbldbadmmNca7E1Nr",
            "PUMPS": "tbliRO0hZim8oQ2qw",
            "ERV_UNITS": "tblkIaP1TspndVI5f",
            "DHW_TANKS": "tbl3EYwyh6HhmlbqP",
            "LIGHTING": "tblkLN5vn6fcXnTRT",
            "APPLIANCES": "tblqfzzcqc3o2IcD4",
            "GLAZING_TYPES": "tbl3JAeRMqiloWQ65",
            "FRAME_TYPES": "tblejOjMq62zdRT3D",
            "WINDOW_UNIT_TYPES": "tblGOpIen7MnCuQRe",
            "MATERIAL_LAYERS": "tblkWxg3xXMjzjO32",
            "HBJSON": "tbllXDdHXDwMxeb30",
        },
    },
    {
        "name": "Arverne St",
        "airtable_ref": "app2huKgwyKrnMRbp",
        "bt_number": 2242,
        "phius_number": 2441,
        "phius_dropbox_url": "https://www.dropbox.com/scl/fo/5b2w4n9wc1psda63xso4m/h?rlkey=e5c4bvo1visbecr0uea9lt0r3&dl=0",
        "tables": {
            "SUMMARY": "tblb8D5jcw1KyB522",
            "CONFIG": "tblOPg6rOq7Uy2zJT",
            "FANS": "tblCwWhH3YuNV34ec",
            "PUMPS": "tbl3F59OhLXcgaWm0",
            "ERV_UNITS": "tblQtcVgB6iYbyhis",
            "DHW_TANKS": "tblPPiCNkZE1s5NgW",
            "LIGHTING": "tblRH6A9tLyKGsUD0",
            "APPLIANCES": "tblgk5pneolD192Dv",
            "GLAZING_TYPES": "tblbreMnmdsKDCYTN",
            "FRAME_TYPES": "tblJm0uhhChDY0jKQ",
            "WINDOW_UNIT_TYPES": "tbln2qVrxqSNlAJOK",
            "MATERIAL_LAYERS": "tblaqehqmP6xfOPUP",
            "HBJSON": "tblyXNYA0z8OiZQ2a",
        },
    },
    {
        "name": "Alpine St",
        "airtable_ref": "appMJvv2qkl5eZ1S0",
        "bt_number": 2141,
        "phius_number": 2628,
        "phius_dropbox_url": "https://www.dropbox.com/scl/fo/wqjaevwa95qaoij71bw89/h?rlkey=nwbwyt67ou62c6ir36zsjkodz&dl=0",
        "tables": {
            "SUMMARY": "tblTWt78WrqpxvseQ",
            "CONFIG": "tblqXGps9noqY0LqZ",
            "FANS": "tblmYX2tXK5rMgeVN",
            "PUMPS": "tblhCV9mCZpmsfzqb",
            "ERV_UNITS": "tblAVdG2vSTC2LrZ3",
            "DHW_TANKS": "tbl3tJSHXY6zbqFyn",
            "LIGHTING": "tbloPDsPtkyCa17Vs",
            "APPLIANCES": "tbl0M6a98aWhSmck6",
            "GLAZING_TYPES": "tblBrale1asxtzuNo",
            "FRAME_TYPES": "tblgfvZKVLArxhyTC",
            "WINDOW_UNIT_TYPES": "tbl47pEy8yTM3rwdC",
            "MATERIAL_LAYERS": "tblUSf2cgBHb61ZBq",
            "HBJSON": "",
        },
    },
]


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def add_dummy_users(db: Session) -> list[User]:
    users = [
        {"username": "user1", "password": "password1", "email": "user1@email.com"},
        {"username": "user2", "password": "password2", "email": "user2@email.com"},
        {"username": "user3", "password": "password3", "email": "user3@email.com"},
    ]
    db_users = []
    for user in users:
        hashed_password = get_password_hash(user["password"])
        db_user = User(
            username=user["username"],
            email=user["email"],
            hashed_password=hashed_password,
        )
        db.add(db_user)
        db_users.append(db_user)
    db.commit()
    return db_users


def add_dummy_projects(db: Session, users: list[User]) -> None:
    for user, project in zip(users, PROJECT_DATA):
        # -------------------------------------------------------------------------------
        # -- Build the AirTableTables
        at_tables: list[AirTableTable] = []
        for at_table_table_name, at_table_ref in project["tables"].items():
            db_airtable_table = AirTableTable(
                name=at_table_table_name,
                airtable_ref=at_table_ref,
                airtable_base=None,
            )
            db.add(db_airtable_table)
            at_tables.append(db_airtable_table)
        db.commit()  # Commit to get the ID of the newly created AirTableTable

        # -------------------------------------------------------------------------------
        # -- Build a new AirTableBase, add the new Tables
        db_airtable_base = AirTableBase(
            name=project["name"], airtable_ref=project["airtable_ref"]
        )
        for at_table in at_tables:
            db_airtable_base.tables.append(at_table)
        db.add(db_airtable_base)
        db.commit()  # Commit to get the ID of the newly created AirTableBase

        # -------------------------------------------------------------------------------
        # -- Now build the Project
        db_project = Project(
            name=project["name"],
            bt_number=project["bt_number"],
            phius_number=project["phius_number"],
            owner=user,
            airtable_base=db_airtable_base,
            phius_dropbox_url=project["phius_dropbox_url"],
        )

        # Add additional users to the project
        db_project.users.append(users[0])
        db_project.users.append(users[1])
        db_project.users.append(users[2])

        db.add(db_project)
    db.commit()


# Mock Data
MATERIALS = [
    {
        "id" : "1",
        "name" :  "Material 1",
        "argb_color" :  "(255, 255, 255, 255)",
        "category" :  "None",
        "conductivity_w_mk" :  0.0,
        "emissivity" :  0.0,
    }, 
    {
        "id" : "2",
        "name" :  "Material 2",
        "argb_color" :  "(255, 255, 255, 255)",
        "category" :  "None",
        "conductivity_w_mk" :  0.0,
        "emissivity" :  0.0,
    },
    {
        "id" : "3",
        "name" :  "Material 3",
        "argb_color" :  "(255, 255, 255, 255)",
        "category" :  "None",
        "conductivity_w_mk" :  0.0,
        "emissivity" :  0.0,
    },
]


def add_dummy_materials(db: Session) -> None:
    for material in MATERIALS:
        db_material = Material(
            id=material["id"],
            name=material["name"],
            category=material["category"],
            argb_color=material["argb_color"],
            conductivity_w_mk=material["conductivity_w_mk"],
            emissivity=material["emissivity"],
        )
        db.add(db_material)
    db.commit()


def add_dummy_assembly(db: Session) -> None:
    layer_1 = Layer(thickness_mm=50.0)
    layer_2 = Layer(thickness_mm=100.0)

    assembly = Assembly(name="__assembly__")
    assembly.layers.append(layer_1)
    assembly.layers.append(layer_2)
    
    mat_1 = Material.get_by_name(db, "Material 1")
    segment_1 = Segment(width_mm=200, material=mat_1)
    layer_1.segments.append(segment_1)

    mat_2 = Material.get_by_name(db, "Material 2")
    segment_2 = Segment(width_mm=100, material=mat_2)
    layer_1.segments.append(segment_2)
    
    mat_3 = Material.get_by_name(db, "Material 3")
    segment_3 = Segment(width_mm=300, material=mat_3)
    layer_2.segments.append(segment_3)

    db.add(assembly)
    db.commit()


if __name__ == "__main__":
    # -- Drop all existing tables so we start fresh
    Base.metadata.drop_all(bind=engine)

    # -- Create the database tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        users = add_dummy_users(db)
        add_dummy_projects(db, users)
        add_dummy_materials(db)
        add_dummy_assembly(db)
    finally:
        db.close()
