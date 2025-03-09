"""Utility to add some fake users to the database for testing and development."""

import bcrypt
from sqlalchemy.orm import Session

import database
import models


def get_password_hash(password: str) -> bytes:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())


def add_dummy_users(db: Session) -> None:
    users = [
        {"username": "user1", "password": "password1"},
        {"username": "user2", "password": "password2"},
        {"username": "user3", "password": "password3"},
    ]
    for user in users:
        hashed_password = get_password_hash(user["password"])
        db_user = models.User(
            username=user["username"], hashed_password=hashed_password
        )
        db.add(db_user)
    db.commit()


if __name__ == "__main__":
    # Create the database tables
    models.Base.metadata.create_all(bind=database.engine)

    db = database.SessionLocal()
    add_dummy_users(db)
    db.close()
