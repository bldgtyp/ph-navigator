### Create Migration Version
```bash
`alembic revision --autogenerate -m "Initial migration"`
```

### To Update (local dev)
```bash
alembic upgrade head
```

### To Refresh the Render.com Database:
```bash
psql postgresql://ph_navigator_user:__@__.ohio-postgres.render.com/ph_navigator
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

### Render.com Startup Command (Settings):
```bash
`backend / alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`
```

### DB Connect locally:
```bash
localhost
port=5432
user=ph_navigator_user
default_database=ph_navigator
```

## Remember!
- `alembic/env.py` needs to import all the DB entities in order to autogenerate the migration files.