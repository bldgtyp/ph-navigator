"""Forward-only dict-to-dict upgrades for project document bodies."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass

from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION, ProjectDocumentV1


class ProjectDocumentMigrationError(ValueError):
    """Base error for bodies that cannot enter the project-document upgrade lane."""


class SchemaVersionMissingError(ProjectDocumentMigrationError):
    """Raised when a raw body does not declare an integer ``schema_version``."""


class SchemaVersionInvalidError(ProjectDocumentMigrationError):
    """Raised when ``schema_version`` is present but not a supported integer."""


class SchemaVersionTooNewError(ProjectDocumentMigrationError):
    """Raised when a body was written by a newer app schema."""


@dataclass(frozen=True)
class UpgradeResult:
    """Validated current-shape document plus audit data for the steps applied."""

    original_schema_version: int
    target_schema_version: int
    applied_steps: tuple[str, ...]
    warnings: tuple[str, ...]
    upgraded_raw_body: dict[str, object]
    document: ProjectDocumentV1

    @property
    def requires_persisted_rewrite(self) -> bool:
        """Only older bodies should be rewritten; current v1 defaults stay untouched."""

        return self.original_schema_version != self.target_schema_version


def _upgrade_v0_to_v1(raw: dict[str, object]) -> dict[str, object]:
    """Testable pre-beta baseline: v0 has the v1 shape but lacks the v1 stamp."""

    upgraded = dict(raw)
    upgraded["schema_version"] = 1
    return upgraded


UPGRADE_STEPS: dict[int, Callable[[dict[str, object]], dict[str, object]]] = {
    0: _upgrade_v0_to_v1,
}


def upgrade_project_document(raw: object) -> UpgradeResult:
    """Upgrade a raw document mapping forward and validate it as the current model."""

    if not isinstance(raw, Mapping):
        raise SchemaVersionInvalidError("project document body must be a JSON object")

    raw_mapping: dict[str, object] = {}
    for key, value in raw.items():
        if not isinstance(key, str):
            raise SchemaVersionInvalidError("project document body keys must be strings")
        raw_mapping[key] = value

    original_version = _schema_version(raw_mapping)
    target_version = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    if original_version > target_version:
        raise SchemaVersionTooNewError(
            f"project document schema_version={original_version} is newer than this app "
            f"(CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION={target_version})"
        )

    upgraded: dict[str, object] = dict(raw_mapping)
    applied: list[str] = []
    version = original_version
    while version < target_version:
        step = UPGRADE_STEPS.get(version)
        if step is None:
            raise SchemaVersionInvalidError(
                f"missing project document upgrade step for schema version {version}; "
                "UPGRADE_STEPS must cover every version below current"
            )
        upgraded = step(upgraded)
        applied.append(getattr(step, "__name__", f"upgrade_v{version}_to_v{version + 1}"))
        version += 1

    document = ProjectDocumentV1.model_validate(upgraded)
    return UpgradeResult(
        original_schema_version=original_version,
        target_schema_version=target_version,
        applied_steps=tuple(applied),
        warnings=(),
        upgraded_raw_body=upgraded,
        document=document,
    )


def _schema_version(raw: Mapping[str, object]) -> int:
    value = raw.get("schema_version")
    if value is None:
        raise SchemaVersionMissingError("project document schema_version is required")
    if isinstance(value, bool) or not isinstance(value, int):
        raise SchemaVersionInvalidError("project document schema_version must be an integer")
    if value < 0:
        raise SchemaVersionInvalidError("project document schema_version must be >= 0")
    return value
