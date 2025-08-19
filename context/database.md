## App Databases Used:

The App uses a different database, depending on whether it is in production, local development, or running the PyTest test-suite.

### 1. Development Database:

- Postgres running in Docker container
- `backend/.env`: DB Logins, Passwords
  - POSTGRES_DB
  - POSTGRES_USER
  - POSTGRES_PASSWORD
  - POSTGRES_PORT
  - DATABASE_URL
- `backend/config.py`: App and DB config / setup
- Alembic for migrations

### 2. Testing Database:

- SQLite (in memory)
- `backend/config.py`: App and DB config / setup
  - DATABASE_URL
- Alembic for migrations

### 3. Production Database:

- Postgres running on Render.com container
- `backend/.env`: DB Login, Passwords
- `backend/config.py`: App and DB config / setup
- Alembic for migrations
