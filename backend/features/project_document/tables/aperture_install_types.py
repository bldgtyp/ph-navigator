"""Aperture Install-Types table contract for the project document registry.

The window-install Psi-value library (aperture-psi-install D-2): a
TB-pattern DataTable whose rows are assigned to aperture-element edges via
each element's `installs` slots. The well-known Default row
(`apit_default`, D-4) is seeded program-aware and can be edited but never
deleted; referenced rows are delete-blocked with per-type usage counts
(D-8) because the referencing slots live inside aperture elements, not in
a registry table `DependentLink` can reach.
"""

from __future__ import annotations

from collections import Counter
from typing import cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from starlette import status

from features.project_document.aperture_commands.models import APERTURE_SIDES
from features.project_document.custom_fields import (
    RESERVED_FIELD_KEY_RECORD_ID,
    CustomFieldType,
    TableFieldDef,
)
from features.project_document.document import (
    APERTURE_INSTALL_TYPE_OPTION_KEYS,
    APERTURE_INSTALL_TYPE_SOURCE_OPTION_KEY,
    APERTURE_INSTALL_TYPE_STATUS_OPTION_KEY,
    ApertureInstallTypeRow,
    ApertureInstallTypesTableEnvelope,
    ProjectDocumentV1,
    SingleSelectOption,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._attachment_fields import (
    datasheet_field_def,
    pdf_report_field_def,
    photo_field_def,
)
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables._registry_helpers import (
    FormulaType,
    coerce_custom_option_list_extras,
    custom_option_lists_for_table,
    make_field_registry,
)
from features.project_document.tables._status_field import STATUS_OPTION_COMPLETE, status_field_def
from features.project_document.tables.contracts import TableContract
from features.project_document.tables.dependent_links import DEPENDENT_LINK_DELETE_BLOCKED, DependentRef
from features.project_document.validation import validate_outgoing_document
from features.shared.errors import api_error

APERTURE_INSTALL_TYPES_TABLE_NAME = "aperture_install_types"
_APERTURE_INSTALL_TYPES_TABLE_PATH: tuple[str, ...] = (APERTURE_INSTALL_TYPES_TABLE_NAME,)

#: Well-known id of the seeded, delete-blocked program-aware Default row (D-4).
APERTURE_INSTALL_DEFAULT_TYPE_ID = "apit_default"

#: Program-aware Default Psi-install values (W/m·K): Phius §1.4.4.6 default
#: 0.030 Btu/hr-ft-F ≈ 0.052 W/m·K; 0.04 is the PHI-side convention.
PHIUS_DEFAULT_PSI_INSTALL_W_MK = 0.052
PHI_DEFAULT_PSI_INSTALL_W_MK = 0.04

APERTURE_INSTALL_SOURCE_OPTION_PROGRAM_DEFAULT = "opt_apit_src_program_default"

APERTURE_INSTALL_SOURCE_OPTIONS: tuple[SingleSelectOption, ...] = (
    SingleSelectOption(
        id=APERTURE_INSTALL_SOURCE_OPTION_PROGRAM_DEFAULT, label="Program Default", color="#64748b", order=0
    ),
    SingleSelectOption(id="opt_apit_src_phius_mid_wall", label="Phius Mid-Wall", color="#0ea5e9", order=1),
    SingleSelectOption(
        id="opt_apit_src_phius_mid_wall_oi", label="Phius Mid-Wall Over-Insulated", color="#14b8a6", order=2
    ),
    SingleSelectOption(id="opt_apit_src_calculated", label="Calculated", color="#8b5cf6", order=3),
    SingleSelectOption(id="opt_apit_src_manufacturer", label="Manufacturer", color="#f97316", order=4),
)


def default_install_type_row(*, is_phius: bool) -> ApertureInstallTypeRow:
    """Build the seeded program-aware Default row (D-4).

    Shared by the project template (new projects) and the v9→v10 migration
    (existing projects) so the two seeds can never drift. The row is an
    ordinary editable library row apart from its well-known id; evidence
    axes are waived because a program default needs no Flixo report.
    """
    return ApertureInstallTypeRow(
        id=APERTURE_INSTALL_DEFAULT_TYPE_ID,
        datasheet_status="na",
        photo_status="na",
        datasheet_not_required=True,
        photo_not_required=True,
        custom_values={
            "name": "Default",
            "psi_w_mk": PHIUS_DEFAULT_PSI_INSTALL_W_MK if is_phius else PHI_DEFAULT_PSI_INSTALL_W_MK,
            "source": APERTURE_INSTALL_SOURCE_OPTION_PROGRAM_DEFAULT,
            "status": STATUS_OPTION_COMPLETE,
        },
    )


APERTURE_INSTALL_TYPES_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Install-type schedule tag.",
    ),
    built_in_field_def(field_key="name", display_name="Display Name", field_type=CustomFieldType.short_text),
    built_in_field_def(
        field_key="psi_w_mk",
        display_name="Psi-Install",
        field_type=CustomFieldType.number,
        config={
            "units": {
                "mode": "fixed",
                "unit_type": "conductivity",
                "si_unit": "w_m_k",
                "ip_unit": "btu_h_ft_f",
                "precision_si": 3,
                "precision_ip": 4,
            }
        },
        description="Window install linear thermal transmittance in W/(m-K).",
    ),
    built_in_field_def(field_key="source", display_name="Source", field_type=CustomFieldType.single_select),
    pdf_report_field_def(),
    datasheet_field_def(),
    photo_field_def(),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
    status_field_def(),
)

APERTURE_INSTALL_TYPES_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(
    f.field_key for f in APERTURE_INSTALL_TYPES_BUILT_IN_FIELD_DEFS
)
APERTURE_INSTALL_TYPES_TYPED_COLUMN_FORMULA_TYPES: dict[str, FormulaType] = {
    "id": "text",
    "pdf_report_asset_ids": "text",
    "datasheet_asset_ids": "text",
    "photo_asset_ids": "text",
    "notes": "text",
}

assert any(f.field_key == RESERVED_FIELD_KEY_RECORD_ID for f in APERTURE_INSTALL_TYPES_BUILT_IN_FIELD_DEFS), (
    "Aperture Install-Types built-in seed must contain a record_id FieldDef"
)


class ApertureInstallTypesSliceOptions(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    aperture_install_types_source: list[SingleSelectOption] = Field(alias=APERTURE_INSTALL_TYPE_SOURCE_OPTION_KEY)
    aperture_install_types_status: list[SingleSelectOption] = Field(alias=APERTURE_INSTALL_TYPE_STATUS_OPTION_KEY)

    @model_validator(mode="after")
    def _validate_namespaced_extras(self) -> ApertureInstallTypesSliceOptions:
        coerce_custom_option_list_extras(
            self,
            table_path=_APERTURE_INSTALL_TYPES_TABLE_PATH,
            table_label=APERTURE_INSTALL_TYPES_TABLE_NAME,
        )
        return self

    def by_option_key(self) -> dict[str, list[SingleSelectOption]]:
        return {
            APERTURE_INSTALL_TYPE_SOURCE_OPTION_KEY: self.aperture_install_types_source,
            APERTURE_INSTALL_TYPE_STATUS_OPTION_KEY: self.aperture_install_types_status,
        }

    def custom_option_lists(self) -> dict[str, list[SingleSelectOption]]:
        return dict(self.__pydantic_extra__ or {})


class ApertureInstallTypesSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    aperture_install_types: list[ApertureInstallTypeRow]
    single_select_options: ApertureInstallTypesSliceOptions
    field_defs: list[TableFieldDef] = Field(default_factory=list)


class ApertureInstallTypesSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    aperture_install_types: list[ApertureInstallTypeRow]
    field_defs: list[TableFieldDef]
    single_select_options: dict[str, list[SingleSelectOption]]
    rows_computed: dict[str, dict[str, object]] = Field(default_factory=dict)


def check_install_type_delete_blocked(body: ProjectDocumentV1, removed_row_ids: set[str]) -> None:
    """Raise the shared 409 delete-block when a removed row is still needed (D-8).

    Blocks when a removed id is the well-known Default (never deletable) or is
    referenced by any aperture element's `installs` slot. The slots live inside
    aperture elements — not a registry table — so this is a bespoke check
    instead of a `DependentLink`, but it raises the same
    `dependent_link_delete_blocked` conflict shape, extended with per-type
    `usage_counts` so the UI can report how many edges hold each type.
    """
    if not removed_row_ids:
        return
    referenced: list[DependentRef] = []
    usage_counts: Counter[str] = Counter()
    if APERTURE_INSTALL_DEFAULT_TYPE_ID in removed_row_ids:
        referenced.append(
            DependentRef(
                table=APERTURE_INSTALL_TYPES_TABLE_NAME,
                row_id=APERTURE_INSTALL_DEFAULT_TYPE_ID,
                tag="Default",
                field="default_install_type",
            )
        )
    for aperture in body.tables.apertures:
        for element in aperture.elements:
            for side in APERTURE_SIDES:
                install_type_id = getattr(element.installs, side)
                if install_type_id in removed_row_ids:
                    usage_counts[install_type_id] += 1
                    referenced.append(
                        DependentRef(
                            table="apertures",
                            row_id=element.id,
                            tag=f"{aperture.name} / {element.name}",
                            field=f"installs.{side}",
                        )
                    )
    if referenced:
        raise api_error(
            status.HTTP_409_CONFLICT,
            DEPENDENT_LINK_DELETE_BLOCKED,
            "This install type is still in use and cannot be deleted.",
            {"referenced_by": [ref.as_dict() for ref in referenced], "usage_counts": dict(usage_counts)},
        )


def apply_aperture_install_types_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    request = cast(ApertureInstallTypesSliceReplaceRequest, payload)
    request_options = request.single_select_options.by_option_key()
    custom_option_lists = request.single_select_options.custom_option_lists()
    if (
        body.tables.aperture_install_types.rows == request.aperture_install_types
        and body.tables.aperture_install_types.field_defs == request.field_defs
        and all(
            body.single_select_options.get(key, []) == request_options[key] for key in APERTURE_INSTALL_TYPE_OPTION_KEYS
        )
        and all(body.single_select_options.get(key, []) == value for key, value in custom_option_lists.items())
    ):
        return body

    removed = {row.id for row in body.tables.aperture_install_types.rows} - {
        row.id for row in request.aperture_install_types
    }
    check_install_type_delete_blocked(body, removed)

    options = dict(body.single_select_options)
    for key in APERTURE_INSTALL_TYPE_OPTION_KEYS:
        options[key] = request_options[key]
    for key, value in custom_option_lists.items():
        options[key] = value
    next_envelope = ApertureInstallTypesTableEnvelope(
        field_defs=request.field_defs,
        rows=request.aperture_install_types,
    )
    next_tables = body.tables.model_copy(update={"aperture_install_types": next_envelope})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_outgoing_document(next_body.model_dump(mode="json"))


def aperture_install_types_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> ApertureInstallTypesSliceResponse:
    from features.project_document.formula import evaluate_table_formulas

    return ApertureInstallTypesSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        aperture_install_types=body.tables.aperture_install_types.rows,
        field_defs=body.tables.aperture_install_types.field_defs,
        single_select_options={
            APERTURE_INSTALL_TYPE_SOURCE_OPTION_KEY: body.single_select_options[
                APERTURE_INSTALL_TYPE_SOURCE_OPTION_KEY
            ],
            APERTURE_INSTALL_TYPE_STATUS_OPTION_KEY: body.single_select_options[
                APERTURE_INSTALL_TYPE_STATUS_OPTION_KEY
            ],
            **custom_option_lists_for_table(body, _APERTURE_INSTALL_TYPES_TABLE_PATH),
        },
        rows_computed=evaluate_table_formulas(aperture_install_types_field_registry, body),
    )


def extract_aperture_install_types_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.aperture_install_types.field_defs],
        "rows": [row.model_dump(mode="json") for row in body.tables.aperture_install_types.rows],
    }


def extract_aperture_install_types_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "aperture_install_types": extract_aperture_install_types_envelope(body),
        "single_select_options": {
            key: [option.model_dump(mode="json") for option in body.single_select_options[key]]
            for key in APERTURE_INSTALL_TYPE_OPTION_KEYS
        },
    }


aperture_install_types_field_registry = make_field_registry(
    field_keys=APERTURE_INSTALL_TYPES_BUILT_IN_FIELD_KEYS,
    table_path=_APERTURE_INSTALL_TYPES_TABLE_PATH,
    row_model=ApertureInstallTypeRow,
    built_in_formula_types=APERTURE_INSTALL_TYPES_TYPED_COLUMN_FORMULA_TYPES,
)


aperture_install_types_contract = TableContract(
    name=APERTURE_INSTALL_TYPES_TABLE_NAME,
    schema_slug="aperture-install-type",
    schema_model=ApertureInstallTypeRow,
    replace_request_model=ApertureInstallTypesSliceReplaceRequest,
    build_response=aperture_install_types_response,
    apply_replace=apply_aperture_install_types_replace,
    extract_rows=extract_aperture_install_types_envelope,
    extract_diff_value=extract_aperture_install_types_diff_value,
    table_path=_APERTURE_INSTALL_TYPES_TABLE_PATH,
    field_registry=aperture_install_types_field_registry,
)
