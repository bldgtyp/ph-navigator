"""Shared Pydantic normalization helpers."""

from __future__ import annotations


def strip_blank_string(value: object) -> object:
    """Normalize blank form strings to null before field validation."""
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value
