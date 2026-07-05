"""Small shared helpers for the GH name-keyed export serializers."""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable

from starlette import status

from features.shared.errors import api_error


def reject_duplicate_names(names: Iterable[str], *, error_code: str, message: str) -> None:
    """Raise 409 if any name repeats.

    GH exports key their payload by a human name (assembly / aperture-type), so a
    collision would silently drop an entry. Surface it as an actionable error
    naming the duplicates instead. (The write side already enforces uniqueness;
    this is a belt-and-suspenders guard for the name-keyed dict.)
    """
    duplicates = sorted(name for name, count in Counter(names).items() if count > 1)
    if duplicates:
        raise api_error(status.HTTP_409_CONFLICT, error_code, message, {"duplicate_names": duplicates})
