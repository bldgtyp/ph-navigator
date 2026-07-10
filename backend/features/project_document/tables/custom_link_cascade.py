"""Helpers for clearing `custom_links` references after target row deletes."""

from __future__ import annotations

from typing import Protocol, TypeVar, cast


class RowWithCustomLinks(Protocol):
    custom_links: dict[str, list[str]]

    def model_copy(self, *, update: dict[str, object]) -> object: ...


TRow = TypeVar("TRow", bound=RowWithCustomLinks)


def clear_removed_custom_links(
    rows: list[TRow],
    *,
    field_key: str,
    removed_ids: set[str],
) -> list[TRow]:
    cleared: list[TRow] = []
    for row in rows:
        current_ids = row.custom_links.get(field_key, [])
        next_ids = [row_id for row_id in current_ids if row_id not in removed_ids]
        if next_ids == current_ids:
            cleared.append(row)
            continue
        next_links = dict(row.custom_links)
        if next_ids:
            next_links[field_key] = next_ids
        else:
            next_links.pop(field_key, None)
        cleared.append(cast(TRow, row.model_copy(update={"custom_links": next_links})))
    return cleared
