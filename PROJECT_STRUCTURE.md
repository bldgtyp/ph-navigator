# Project Structure

This repository uses a non-standard directory layout. Please read carefully before making changes or running commands.

## Backend

- **All backend code is located in the `backend/` directory.**
- This includes all Python source files, database migrations, configuration, and Docker-related files for the backend.
- When running scripts, migrations, or interacting with the backend, always use the `backend/` directory as the root for backend operations.

## Frontend

- All frontend code is located in the `frontend/` directory.

## Backups

- Database backups are stored in `backend/alembic/db_backups/`.

## General Notes

- If you are using automated tools, scripts, or AI agents, always specify the correct subdirectory for backend or frontend operations.
- This structure is intentional and critical for correct project operation.

## Example Commands

- To run a backend script: `python backend/main.py`
- To run Alembic migrations: `cd backend && alembic upgrade head`
- To restore a database backup: `pg_restore -h <host> -U <user> -d <db> -F c backend/alembic/db_backups/<backup_file>.dump`

---

**Always check this file and the README for updates on project structure.**
