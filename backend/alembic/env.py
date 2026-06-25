"""Alembic environment for raw-SQL app persistence.

The first real migration lands during feature work. Until then this
env is a no-op so `alembic upgrade head` is a safe smoke step.

PHN-V2 app code uses raw psycopg SQL, not SQLAlchemy ORM models.
Alembic still uses SQLAlchemy internally to run migrations. There is no
declarative metadata target and no autogenerate from ORM models.
"""

from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import MetaData, engine_from_config, pool

from alembic import context
from config import settings

config = context.config


def _alembic_url() -> str:
    """Return a SQLAlchemy-compatible URL for Alembic's migration engine."""
    if settings.database_url.startswith("postgresql://"):
        return settings.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return settings.database_url


config.set_main_option("sqlalchemy.url", _alembic_url())

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

target_metadata = MetaData(naming_convention=NAMING_CONVENTION)


def run_migrations_offline() -> None:
    context.configure(
        url=_alembic_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
