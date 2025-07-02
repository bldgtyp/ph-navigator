# -*- Python Version: 3.11 -*-

"""Utility https://collective.reimaginebuildings.com/events/honeybee-ph-office-hour-course-wrap-upto add some fake users to the database for testing and development."""

import os

import bcrypt
import dotenv
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from db_entities.airtable.at_base import AirTableBase
from db_entities.airtable.at_table import AirTableTable
from db_entities.aperture.aperture import Aperture
from db_entities.aperture.aperture_element import ApertureElement
from db_entities.app.project import Project
from db_entities.app.user import User
from db_entities.assembly.assembly import Assembly
from db_entities.assembly.layer import Layer
from db_entities.assembly.material import Material
from db_entities.assembly.segment import Segment, SpecificationStatus

dotenv.load_dotenv()

# PROJECTS:
PROJECT_DATA = [
    {
        "id": "app64a1JuYVBs7Z1m",
        "name": "409 Sackett St",
        "bt_number": "2305",
        "phius_number": "2445",
        "phius_dropbox_url": "https://www.dropbox.com/scl/fo/wqjaevwa95qaoij71bw89/h?rlkey=nwbwyt67ou62c6ir36zsjkodz&dl=0",
        "at_key": os.environ["TESTING_ST_KEY_1"],
        "tables": {
            "SUMMARY": "tblapLjAFgm7RIllz",
            "CONFIG": "tblRMar5uK7mDZ8yM",
            "FANS": "tbldbadmmNca7E1Nr",
            "PUMPS": "tbliRO0hZim8oQ2qw",
            "ERV UNITS": "tblkIaP1TspndVI5f",
            "DHW TANKS": "tbl3EYwyh6HhmlbqP",
            "LIGHTING FIXTURES": "tblkLN5vn6fcXnTRT",
            "APPLIANCES": "tblqfzzcqc3o2IcD4",
            "WINDOW: GLAZING TYPES": "tbl3JAeRMqiloWQ65",
            "WINDOW: FRAME TYPES": "tblejOjMq62zdRT3D",
            "WINDOW: UNITS": "tblGOpIen7MnCuQRe",
            "MATERIAL LAYERS": "tblkWxg3xXMjzjO32",
            "HBJSON": "tbllXDdHXDwMxeb30",
        },
    },
    {
        "id": "app2huKgwyKrnMRbp",
        "name": "Arverne St",
        "bt_number": "2242",
        "phius_number": "2441",
        "phius_dropbox_url": "https://www.dropbox.com/scl/fo/5b2w4n9wc1psda63xso4m/h?rlkey=e5c4bvo1visbecr0uea9lt0r3&dl=0",
        "at_key": os.environ["TESTING_ST_KEY_2"],
        "tables": {
            "SUMMARY": "tblb8D5jcw1KyB522",
            "CONFIG": "tblOPg6rOq7Uy2zJT",
            "FANS": "tblCwWhH3YuNV34ec",
            "PUMPS": "tbl3F59OhLXcgaWm0",
            "ERV UNITS": "tblQtcVgB6iYbyhis",
            "DHW TANKS": "tblPPiCNkZE1s5NgW",
            "LIGHTING FIXTURES": "tblRH6A9tLyKGsUD0",
            "APPLIANCES": "tblgk5pneolD192Dv",
            "WINDOW: GLAZING TYPES": "tblbreMnmdsKDCYTN",
            "WINDOW: FRAME TYPES": "tblJm0uhhChDY0jKQ",
            "WINDOW: UNITS": "tbln2qVrxqSNlAJOK",
            "MATERIAL LAYERS": "tblaqehqmP6xfOPUP",
            "HBJSON": "tblyXNYA0z8OiZQ2a",
        },
    },
    {
        "id": "appMJvv2qkl5eZ1S0",
        "name": "Alpine St",
        "bt_number": "2141",
        "phius_number": "2628",
        "phius_dropbox_url": "https://www.dropbox.com/scl/fo/wqjaevwa95qaoij71bw89/h?rlkey=nwbwyt67ou62c6ir36zsjkodz&dl=0",
        "at_key": os.environ["TESTING_ST_KEY_3"],
        "tables": {
            "SUMMARY": "tblTWt78WrqpxvseQ",
            "CONFIG": "tblqXGps9noqY0LqZ",
            "FANS": "tblmYX2tXK5rMgeVN",
            "PUMPS": "tblhCV9mCZpmsfzqb",
            "ERV UNITS": "tblAVdG2vSTC2LrZ3",
            "DHW TANKS": "tbl3tJSHXY6zbqFyn",
            "LIGHTING FIXTURES": "tbloPDsPtkyCa17Vs",
            "APPLIANCES": "tbl0M6a98aWhSmck6",
            "WINDOW: GLAZING TYPES": "tblBrale1asxtzuNo",
            "WINDOW: FRAME TYPES": "tblgfvZKVLArxhyTC",
            "WINDOW: UNITS": "tbl47pEy8yTM3rwdC",
            "MATERIAL LAYERS": "tblUSf2cgBHb61ZBq",
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
        # -- Build a new AirTable-Base
        db_airtable_base = AirTableBase(id=project["id"])
        db_airtable_base.airtable_access_token = project["at_key"]

        # -------------------------------------------------------------------------------
        # -- Build the AirTable-Tables|
        at_tables: list[AirTableTable] = []
        for at_table_table_name, at_table_ref in project["tables"].items():
            db_airtable_table = AirTableTable(
                at_ref=at_table_ref,
                name=at_table_table_name,
                parent_base=db_airtable_base,
            )
            db.add(db_airtable_table)
            at_tables.append(db_airtable_table)
        db.commit()

        # -------------------------------------------------------------------------------
        # -- Now build the Project
        db_project = Project(
            name=project["name"],
            bt_number=project["bt_number"],
            phius_number=project["phius_number"],
            phius_dropbox_url=project["phius_dropbox_url"],
            owner=user,
            airtable_base=db_airtable_base,
        )

        # Add additional users to the project
        db_project.users.append(users[0])
        db_project.users.append(users[1])
        db_project.users.append(users[2])

        db.add(db_project)
    db.commit()


# ASSEMBLIES / MATERIALS
MATERIALS = [
    {
        "id": "mat1",
        "name": "Test Material 1",
        "argb_color": "(255, 255, 255, 255)",
        "category": "Category-A",
        "conductivity_w_mk": 1.0,
        "emissivity": 0.9,
        "density_kg_m3": 999.0,
        "specific_heat_j_kgk": 999.0,
    },
    {
        "id": "mat2",
        "name": "Test Material 2",
        "argb_color": "(255, 255, 255, 255)",
        "category": "Category-B",
        "conductivity_w_mk": 2.0,
        "emissivity": 0.9,
        "density_kg_m3": 999.0,
        "specific_heat_j_kgk": 999.0,
    },
    {
        "id": "mat3",
        "name": "Test Material 3",
        "argb_color": "(255, 255, 255, 255)",
        "category": "Category-B",
        "conductivity_w_mk": 3.0,
        "emissivity": 0.9,
        "density_kg_m3": 999.0,
        "specific_heat_j_kgk": 999.0,
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
            density_kg_m3=material["density_kg_m3"],
            specific_heat_j_kgk=material["specific_heat_j_kgk"],
        )
        db.add(db_material)
    db.commit()


def add_dummy_assembly(db: Session) -> None:
    project_1 = db.query(Project).filter(Project.id == 1).first()

    layer_1 = Layer(thickness_mm=50.0)
    layer_2 = Layer(thickness_mm=100.0)

    assembly = Assembly(name="__test_assembly__", project=project_1)
    assembly.layers.append(layer_1)
    assembly.layers.append(layer_2)

    mat_1 = Material.get_by_name(db, "Test Material 1")
    segment_1 = Segment(width_mm=200, material=mat_1)
    segment_1.specification_status = SpecificationStatus.COMPLETE
    segment_1.steel_stud_spacing_mm = 200
    segment_1.notes = "A test note"
    layer_1.segments.append(segment_1)

    mat_2 = Material.get_by_name(db, "Test Material 2")
    segment_2 = Segment(width_mm=100, material=mat_2)
    segment_2.specification_status = SpecificationStatus.MISSING
    segment_2.notes = "Another test note"
    layer_1.segments.append(segment_2)

    mat_3 = Material.get_by_name(db, "Test Material 3")
    segment_3 = Segment(width_mm=300, material=mat_3)
    segment_3.specification_status = SpecificationStatus.NA
    layer_2.segments.append(segment_3)

    db.add(assembly)
    db.commit()


def add_dummy_apertures(db: Session) -> None:
    project_1 = db.query(Project).filter(Project.id == 1).first()

    aperture_1 = Aperture(
        name="Aperture 1",
        row_heights_mm=[100],
        column_widths_mm=[100],
        project=project_1
    )
    db.add(aperture_1)

    aperture_element_1 = ApertureElement(
        aperture=aperture_1,
        row_number=0, column_number=0, row_span=1, col_span=1)
    db.add(aperture_element_1)

    aperture_2 = Aperture(
        name="Aperture 2",
        row_heights_mm=[100],
        column_widths_mm=[100, 200],
        project=project_1
    )
    db.add(aperture_2)
    aperture_element_2 = ApertureElement(
        aperture=aperture_2,
        row_number=0, column_number=0, row_span=1, col_span=1)
    db.add(aperture_element_2)

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
        add_dummy_apertures(db)
    finally:
        db.close()
