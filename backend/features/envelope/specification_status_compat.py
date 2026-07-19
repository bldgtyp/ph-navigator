"""Release-A compatibility for built-in specification-status mutations."""

from __future__ import annotations

from typing import Annotated

from pydantic import BeforeValidator

from features.project_document.document import SpecificationStatus


def normalize_specification_status_input(value: object) -> object:
    """Map the future client spelling to schema-v7's persisted spelling."""

    return "missing" if value == "needed" else value


CompatibleSpecificationStatus = Annotated[
    SpecificationStatus,
    BeforeValidator(normalize_specification_status_input),
]
