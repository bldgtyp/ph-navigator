"""Utility to add some fake users to the database for testing and development."""

import bcrypt
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from db_entities.airtable.at_base import AirTableBase
from db_entities.airtable.at_table import AirTableTable
from db_entities.project import Project
from db_entities.user import User

# Mock Data
project_data = [
    {
        "name": "409 Sackett St",
        "airtable_ref": "app64a1JuYVBs7Z1m",
        "bt_number": 2305,
        "phius_number": 2445,
        "phius_dropbox_url": "https://www.dropbox.com/scl/fo/wqjaevwa95qaoij71bw89/h?rlkey=nwbwyt67ou62c6ir36zsjkodz&dl=0",
        "tables": [
            {
                "name": "Summary",
                "airtable_ref": "tblapLjAFgm7RIllz",
            },
            {
                "name": "Config",
                "airtable_ref": "tblRMar5uK7mDZ8yM",
            },
            {
                "name": "Fans",
                "airtable_ref": "tbldbadmmNca7E1Nr",
            },
        ],
    },
    {
        "name": "Arverne St",
        "airtable_ref": "app2huKgwyKrnMRbp",
        "bt_number": 2242,
        "phius_number": 2441,
        "phius_dropbox_url": "https://www.dropbox.com/scl/fo/5b2w4n9wc1psda63xso4m/h?rlkey=e5c4bvo1visbecr0uea9lt0r3&dl=0",
        "tables": [
            {
                "name": "Summary",
                "airtable_ref": "tblb8D5jcw1KyB522",
            },
            {
                "name": "Config",
                "airtable_ref": "tblOPg6rOq7Uy2zJT",
            },
            {
                "name": "Fans",
                "airtable_ref": "tblCwWhH3YuNV34ec",
            },
        ],
    },
    {
        "name": "Alpine St",
        "airtable_ref": "appMJvv2qkl5eZ1S0",
        "bt_number": 2141,
        "phius_number": 2628,
        "phius_dropbox_url": "https://www.dropbox.com/scl/fo/wqjaevwa95qaoij71bw89/h?rlkey=nwbwyt67ou62c6ir36zsjkodz&dl=0",
        "tables": [
            {
                "name": "Summary",
                "airtable_ref": "tblTWt78WrqpxvseQ",
            },
            {
                "name": "Config",
                "airtable_ref": "tblqXGps9noqY0LqZ",
            },
            {
                "name": "Fans",
                "airtable_ref": "tblmYX2tXK5rMgeVN",
            },
        ],
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
    for user, project in zip(users, project_data):
        # -------------------------------------------------------------------------------
        # -- Build the AirTableTables
        at_tables: list[AirTableTable] = []
        for at_table_data in project["tables"]:
            db_airtable_table = AirTableTable(
                name=at_table_data["name"],
                airtable_ref=at_table_data["airtable_ref"],
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


if __name__ == "__main__":
    # -- Drop all existing tables so we start fresh
    Base.metadata.drop_all(bind=engine)

    # -- Create the database tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    users = add_dummy_users(db)
    add_dummy_projects(db, users)
    db.close()
