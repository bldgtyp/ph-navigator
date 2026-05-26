"""Pumps table contract for the project document registry."""

from __future__ import annotations

from typing import cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.document import (
    PUMP_DEVICE_TYPE_OPTION_KEY,
    PUMP_OPTION_KEYS,
    ProjectDocumentV1,
    PumpRow,
    SingleSelectOption,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

PUMPS_TABLE_NAME = "pumps"


class PumpsSliceOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    pumps_device_type: list[SingleSelectOption] = Field(alias=PUMP_DEVICE_TYPE_OPTION_KEY)

    def by_option_key(self) -> dict[str, list[SingleSelectOption]]:
        return {PUMP_DEVICE_TYPE_OPTION_KEY: self.pumps_device_type}


class PumpsSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pumps: list[PumpRow]
    single_select_options: PumpsSliceOptions


class PumpsSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    pumps: list[PumpRow]
    single_select_options: dict[str, list[SingleSelectOption]]


def apply_pumps_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    pumps_payload = cast(PumpsSliceReplaceRequest, payload)
    pump_options = pumps_payload.single_select_options.by_option_key()
    if body.tables.equipment.pumps == pumps_payload.pumps and all(
        body.single_select_options.get(key, []) == pump_options[key] for key in PUMP_OPTION_KEYS
    ):
        return body

    options = dict(body.single_select_options)
    for key in PUMP_OPTION_KEYS:
        options[key] = pump_options[key]
    next_equipment = body.tables.equipment.model_copy(update={"pumps": pumps_payload.pumps})
    next_tables = body.tables.model_copy(update={"equipment": next_equipment})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def pumps_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> PumpsSliceResponse:
    return PumpsSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        pumps=body.tables.equipment.pumps,
        single_select_options={PUMP_DEVICE_TYPE_OPTION_KEY: body.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]},
    )


def extract_pump_rows(body: ProjectDocumentV1) -> list[dict[str, object]]:
    return [pump.model_dump(mode="json") for pump in body.tables.equipment.pumps]


def extract_pumps_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "pumps": extract_pump_rows(body),
        "single_select_options": {
            PUMP_DEVICE_TYPE_OPTION_KEY: [
                option.model_dump(mode="json") for option in body.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]
            ],
        },
    }


pumps_contract = TableContract(
    name=PUMPS_TABLE_NAME,
    schema_slug="pump",
    schema_model=PumpRow,
    replace_request_model=PumpsSliceReplaceRequest,
    build_response=pumps_response,
    apply_replace=apply_pumps_replace,
    extract_rows=extract_pump_rows,
    extract_diff_value=extract_pumps_diff_value,
    table_path=("equipment", "pumps"),
    custom_fields=None,
)
