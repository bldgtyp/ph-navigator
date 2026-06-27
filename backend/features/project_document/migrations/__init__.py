"""Project-document schema evolution entry points."""

from features.project_document.migrations.upgrade import (
    ProjectDocumentMigrationError,
    SchemaVersionInvalidError,
    SchemaVersionMissingError,
    SchemaVersionTooNewError,
    UpgradeResult,
    upgrade_project_document,
)

__all__ = [
    "ProjectDocumentMigrationError",
    "SchemaVersionInvalidError",
    "SchemaVersionMissingError",
    "SchemaVersionTooNewError",
    "UpgradeResult",
    "upgrade_project_document",
]
