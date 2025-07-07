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

## Create DB-Backups:

`cd /Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend && docker exec ph-navigator-postgres pg_dump -U ph_navigator_user -d ph_navigator > backup_$(date +%Y%m%d_%H%M%S).sql`

## Restore DB-Backups:

1.  **Stop application first**
1.  cd `backend`
1.  `docker exec ph-navigator-postgres psql -U ph_navigator_user -d ph_navigator -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
1.  `docker exec -i ph-navigator-postgres psql -U ph_navigator_user -d ph_navigator < alembic/db_backups/backup_20250707_145013.sql`
