"""The dependent-link cascade is a generic, config-driven contract capability.

These drive `apply_dependent_link_cascade` / `preview_dependent_link_cascade`
directly with ad-hoc `DependentLink`s to prove block-vs-clear behavior comes
purely from the declarative config — nothing here is heat-pump-special, so any
registered table could opt in the same way. (Heat-pump rows are used only as a
convenient body with linked_record fields already in the schema.)
"""

from __future__ import annotations

from typing import cast

import pytest
from fastapi import HTTPException

from features.project_document.document import ProjectDocumentV1
from features.project_document.tables.dependent_links import (
    DependentLink,
    apply_dependent_link_cascade,
    preview_dependent_link_cascade,
)
from tests.features.heat_pumps.test_heat_pumps import (
    HPIE_1,
    HPOE_1,
    _heat_pump_document,
    indoor_equip,
    outdoor_equip,
    outdoor_unit,
)
from tests.project_document_helpers import empty_required_tables

_OUTDOOR_EQUIP_PATH = ("equipment", "heat_pumps", "outdoor_equip")
_INDOOR_EQUIP_PATH = ("equipment", "heat_pumps", "indoor_equip")
_OUTDOOR_UNITS_PATH = ("equipment", "heat_pumps", "outdoor_units")

_PAIRED_LINK = DependentLink(
    dependent_table_path=_OUTDOOR_EQUIP_PATH,
    dependent_table_label="outdoor-equip",
    field_key="paired_indoor_equip_id",
    required=False,
)
_OUTDOOR_UNIT_LINK = DependentLink(
    dependent_table_path=_OUTDOOR_UNITS_PATH,
    dependent_table_label="outdoor-units",
    field_key="outdoor_equip_id",
    required=True,
)


def _document(
    *,
    outdoor_equip_rows: list[dict[str, object]] | None = None,
    indoor_equip_rows: list[dict[str, object]] | None = None,
    outdoor_unit_rows: list[dict[str, object]] | None = None,
) -> ProjectDocumentV1:
    tables = empty_required_tables()
    heat_pumps = tables["equipment"]["heat_pumps"]
    heat_pumps["outdoor_equip"]["rows"] = outdoor_equip_rows or []
    heat_pumps["indoor_equip"]["rows"] = indoor_equip_rows or []
    heat_pumps["outdoor_units"]["rows"] = outdoor_unit_rows or []
    return _heat_pump_document(tables)


def _without_rows(body: ProjectDocumentV1, leaf: str) -> ProjectDocumentV1:
    """Return a copy with one heat-pump leaf emptied (no re-validation)."""
    heat_pumps = body.tables.equipment.heat_pumps
    next_leaf = getattr(heat_pumps, leaf).model_copy(update={"rows": []})
    next_heat_pumps = heat_pumps.model_copy(update={leaf: next_leaf})
    next_equipment = body.tables.equipment.model_copy(update={"heat_pumps": next_heat_pumps})
    return body.model_copy(update={"tables": body.tables.model_copy(update={"equipment": next_equipment})})


def test_optional_dependent_link_is_cleared_on_delete() -> None:
    base = _document(
        indoor_equip_rows=[indoor_equip()],
        outdoor_equip_rows=[outdoor_equip(paired_indoor_equip_id=HPIE_1)],
    )
    after = _without_rows(base, "indoor_equip")

    result = apply_dependent_link_cascade(base, after, table_path=_INDOOR_EQUIP_PATH, dependent_links=(_PAIRED_LINK,))

    assert result.tables.equipment.heat_pumps.outdoor_equip.rows[0].paired_indoor_equip_id is None


def test_required_dependent_link_blocks_delete() -> None:
    base = _document(outdoor_equip_rows=[outdoor_equip()], outdoor_unit_rows=[outdoor_unit()])
    after = _without_rows(base, "outdoor_equip")

    with pytest.raises(HTTPException) as exc_info:
        apply_dependent_link_cascade(base, after, table_path=_OUTDOOR_EQUIP_PATH, dependent_links=(_OUTDOOR_UNIT_LINK,))

    assert exc_info.value.status_code == 409
    detail = cast(dict[str, object], exc_info.value.detail)
    assert detail["error_code"] == "dependent_link_delete_blocked"
    referenced_by = cast(list[dict[str, str]], cast(dict[str, object], detail["details"])["referenced_by"])
    assert referenced_by[0]["tag"] == "HP-1"
    assert referenced_by[0]["field"] == "outdoor_equip_id"


def test_preview_is_pure_and_matches_apply() -> None:
    base = _document(
        indoor_equip_rows=[indoor_equip()],
        outdoor_equip_rows=[outdoor_equip(paired_indoor_equip_id=HPIE_1)],
    )

    affected = preview_dependent_link_cascade(
        base, table_path=_INDOOR_EQUIP_PATH, removed={HPIE_1}, dependent_links=(_PAIRED_LINK,)
    )

    assert [ref.field for ref in affected] == ["paired_indoor_equip_id"]
    # Pure: the base body is untouched by the preview.
    assert base.tables.equipment.heat_pumps.outdoor_equip.rows[0].paired_indoor_equip_id == HPIE_1


def test_no_dependent_links_is_a_noop_even_with_removals() -> None:
    base = _document(outdoor_equip_rows=[outdoor_equip(id=HPOE_1)])
    after = _without_rows(base, "outdoor_equip")

    result = apply_dependent_link_cascade(base, after, table_path=_OUTDOOR_EQUIP_PATH, dependent_links=())

    assert result == after
