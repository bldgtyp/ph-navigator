#!/usr/bin/env bash
# Create the catalog POC database in the local Docker Postgres container.
# Idempotent — safe to run repeatedly.
#
# Usage: backend/scripts/create_poc_db.sh
#
# Assumes backend/docker-compose.yml is up: `docker compose up -d db`.
set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-ph-navigator-postgres}"
DB_NAME="${CATALOG_POC_DB_NAME:-ph_navigator_catalog_poc}"
DB_USER="${POSTGRES_USER:-postgres}"
# Maintenance DB to connect to while creating the POC DB. Default to the main
# PHN dev DB; override if your container uses something else.
ADMIN_DB="${POSTGRES_DB:-postgres}"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "Postgres container '${CONTAINER}' is not running." >&2
    echo "Start it with: docker compose -f backend/docker-compose.yml up -d db" >&2
    exit 1
fi

# CREATE DATABASE is not transactional and has no IF NOT EXISTS — emulate it.
EXISTS=$(docker exec -i "${CONTAINER}" psql -U "${DB_USER}" -d "${ADMIN_DB}" -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")

if [ "${EXISTS}" = "1" ]; then
    echo "Database '${DB_NAME}' already exists — nothing to do."
else
    docker exec -i "${CONTAINER}" psql -U "${DB_USER}" -d "${ADMIN_DB}" \
        -c "CREATE DATABASE ${DB_NAME};"
    echo "Created database '${DB_NAME}'."
fi
