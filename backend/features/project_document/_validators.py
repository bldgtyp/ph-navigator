"""Internal validators used by ``ProjectDocumentV1.validate_document_references``.

Split out of ``document.py`` so the cross-table invariant code does not
also have to host every helper it calls. Helpers are public-named here
(no leading underscore) so they read clearly from the document module;
they are not part of the package's external surface and should not be
imported from outside ``project_document/``.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING, Protocol

from features.project_document.custom_fields import (
    RESERVED_FIELD_KEY_RECORD_ID,
    CustomFieldType,
    CustomValue,
    TableFieldDef,
    coerce_custom_value,
    normalize_display_name,
)

if TYPE_CHECKING:
    from features.project_document.document import ProjectDocumentV1
    from features.project_document.envelope_models import Assembly, ProjectMaterial
    from features.project_document.rows import SingleSelectOption


class RowWithIdentity(Protocol):
    """Structural type for any FieldDef-capable project-document row: the
    hidden ``id`` plus the shared custom-field bags. Lets ``validate_generic_table``
    accept any concrete row model without importing each one (and without a
    runtime dependency on ``rows.py``)."""

    id: str
    custom_values: dict[str, CustomValue]
    custom_links: dict[str, list[str]]


# Set of valid ``target_table_path`` tuples for every FieldDef-capable
# table. Used by linked-record validation to resolve a field's declared
# ``target_table_path`` config without dragging in ``tables.registry``
# (which would cycle). Lists the same generic tables as
# ``generic_table_row_ids`` below; keep the two in step when adding a table.
LINKED_RECORD_TARGET_PATHS: frozenset[tuple[str, ...]] = frozenset(
    {
        ("rooms",),
        ("space_types",),
        ("thermal_bridges",),
        ("equipment", "pumps"),
        ("equipment", "fans"),
        ("equipment", "hot_water_heaters"),
        ("equipment", "hot_water_tanks"),
        ("equipment", "electric_heaters"),
        ("equipment", "appliances"),
        ("equipment", "ervs"),
        ("equipment", "heat_pumps", "outdoor_equip"),
        ("equipment", "heat_pumps", "indoor_equip"),
        ("equipment", "heat_pumps", "outdoor_units"),
        ("equipment", "heat_pumps", "indoor_units"),
    }
)


def require_record_id_seeded(
    table_label: str,
    field_defs_by_key: dict[str, TableFieldDef],
) -> None:
    """Enforce PRD §P4.3 identifier invariant: every FieldDef-capable
    table carries a `record_id` entry. Uniqueness is already enforced
    upstream by `index_table_field_defs`, so a membership check is
    sufficient.
    """
    if RESERVED_FIELD_KEY_RECORD_ID not in field_defs_by_key:
        raise ValueError(f"{table_label}.field_defs must contain a record_id entry")


def validate_unique_ids(label: str, ids: list[str]) -> None:
    seen: set[str] = set()
    for item_id in ids:
        if item_id in seen:
            raise ValueError(f"Duplicate {label} id: {item_id}")
        seen.add(item_id)


def generic_table_row_ids(
    document: ProjectDocumentV1,
) -> list[tuple[tuple[str, ...], str, list[str]]]:
    """``(target_table_path, human label, ordered row ids)`` for every generic,
    link-targetable project DataTable.

    Single source of truth for the set of generic tables: both the universal
    row.id uniqueness guard (``validate_table_row_ids``) and the linked-record
    target snapshot (``collect_target_row_ids``) are derived from this list, so
    a new generic table is wired into both by adding one entry.

    The envelope tables (assemblies, project materials, apertures) are NOT
    generic DataTables — they carry their own id checks next to their
    cross-table invariants and are validated elsewhere.
    """
    tables = document.tables
    equipment = tables.equipment
    return [
        (("rooms",), "room", [row.id for row in tables.rooms.rows]),
        (("space_types",), "space type", [row.id for row in tables.space_types.rows]),
        (("thermal_bridges",), "thermal bridge", [row.id for row in tables.thermal_bridges.rows]),
        (("equipment", "pumps"), "pump", [row.id for row in equipment.pumps.rows]),
        (("equipment", "fans"), "fan", [row.id for row in equipment.fans.rows]),
        (("equipment", "hot_water_heaters"), "hot water heater", [row.id for row in equipment.hot_water_heaters.rows]),
        (("equipment", "hot_water_tanks"), "hot water tank", [row.id for row in equipment.hot_water_tanks.rows]),
        (("equipment", "electric_heaters"), "electric heater", [row.id for row in equipment.electric_heaters.rows]),
        (("equipment", "appliances"), "appliance", [row.id for row in equipment.appliances.rows]),
        (("equipment", "ervs"), "ventilator", [row.id for row in equipment.ervs.rows]),
        (
            ("equipment", "heat_pumps", "outdoor_equip"),
            "heat-pump outdoor equipment",
            [row.id for row in equipment.heat_pumps.outdoor_equip.rows],
        ),
        (
            ("equipment", "heat_pumps", "indoor_equip"),
            "heat-pump indoor equipment",
            [row.id for row in equipment.heat_pumps.indoor_equip.rows],
        ),
        (
            ("equipment", "heat_pumps", "outdoor_units"),
            "heat-pump outdoor unit",
            [row.id for row in equipment.heat_pumps.outdoor_units.rows],
        ),
        (
            ("equipment", "heat_pumps", "indoor_units"),
            "heat-pump indoor unit",
            [row.id for row in equipment.heat_pumps.indoor_units.rows],
        ),
    ]


def validate_table_row_ids(document: ProjectDocumentV1) -> None:
    """Enforce the record-identity invariant on every generic project
    DataTable: the hidden ``row.id`` is the only enforced-unique identity.

    User-facing handles (the pinned Display Name, the Tag field) are never
    unique-constrained — duplicates surface as a non-blocking warning chip,
    not a hard error.
    """
    for _table_path, label, row_ids in generic_table_row_ids(document):
        validate_unique_ids(label, row_ids)


def validate_contiguous_orders(label: str, ordered_ids: list[tuple[str, int]]) -> None:
    expected = list(range(len(ordered_ids)))
    actual = sorted(order for _item_id, order in ordered_ids)
    if actual != expected:
        raise ValueError(f"{label} orders must be contiguous from 0")


def validate_envelope_references(
    project_materials: list[ProjectMaterial],
    assemblies: list[Assembly],
) -> None:
    project_material_ids = {material.id for material in project_materials}
    if len(project_material_ids) != len(project_materials):
        raise ValueError("Duplicate project material id")

    assembly_ids: set[str] = set()
    assembly_names: set[str] = set()
    for assembly in assemblies:
        if assembly.id in assembly_ids:
            raise ValueError(f"Duplicate assembly id: {assembly.id}")
        assembly_ids.add(assembly.id)

        normalized_name = normalize_display_name(assembly.name)
        if normalized_name in assembly_names:
            raise ValueError(f"Duplicate assembly name: {assembly.name}")
        assembly_names.add(normalized_name)

        for layer in assembly.layers:
            for segment in layer.segments:
                if segment.project_material_id is not None and segment.project_material_id not in project_material_ids:
                    raise ValueError(
                        f"Unknown project_material_id {segment.project_material_id!r} on segment {segment.id}"
                    )


def index_table_field_defs(
    table_label: str,
    field_defs: list[TableFieldDef],
) -> dict[str, TableFieldDef]:
    """Build a `field_key → FieldDef` map while enforcing uniqueness of
    both `field_key` (identity) and `display_name` (case-insensitive,
    trimmed)."""
    by_key: dict[str, TableFieldDef] = {}
    name_seen: dict[str, str] = {}
    for field_def in field_defs:
        if field_def.field_key in by_key:
            raise ValueError(f"Duplicate field_key in {table_label}.field_defs: {field_def.field_key}")
        by_key[field_def.field_key] = field_def
        normalized_name = normalize_display_name(field_def.display_name)
        if normalized_name in name_seen:
            existing = name_seen[normalized_name]
            raise ValueError(
                f"Duplicate field name in {table_label}: {field_def.display_name!r} collides with {existing!r}"
            )
        name_seen[normalized_name] = field_def.display_name
    return by_key


def validate_rows_custom_values(
    *,
    table_label: str,
    row_label: str,
    rows: list[tuple[str, dict[str, CustomValue]]],
    field_defs_by_key: dict[str, TableFieldDef],
    single_select_options: dict[str, list[SingleSelectOption]],
) -> None:
    """Coerce every `(row_id, custom_values)` pair against its
    FieldDef's declared type. Single-select option lists are resolved
    once per field_key, not per row."""
    option_list_by_field_key: dict[str, list[SingleSelectOption]] = {}
    for field_key, field_def in field_defs_by_key.items():
        if field_def.field_type is CustomFieldType.single_select:
            option_list_by_field_key[field_key] = single_select_options.get(f"{table_label}.{field_key}", [])

    for row_id, custom_values in rows:
        for field_key, value in custom_values.items():
            field_def = field_defs_by_key.get(field_key)
            if field_def is None:
                raise ValueError(f"Unknown field_key on {row_label} {row_id}: {field_key}")
            try:
                coerce_custom_value(
                    value,
                    field_def.field_type,
                    option_list=option_list_by_field_key.get(field_key),
                )
            except ValueError as exc:
                raise ValueError(
                    f"Invalid value for {field_def.display_name!r} on {row_label} {row_id}: {exc}"
                ) from exc


def collect_target_row_ids(document: ProjectDocumentV1) -> dict[tuple[str, ...], set[str]]:
    """Build `target_table_path → set of row ids` for every linked-
    record-targetable table in the document. Phase 1 ships every
    FieldDef-capable contract with `link_targetable=True`."""
    return {table_path: set(row_ids) for table_path, _label, row_ids in generic_table_row_ids(document)}


def normalize_target_table_path(raw: object) -> tuple[str, ...] | None:
    if not isinstance(raw, (list, tuple)):
        return None
    segments: list[str] = []
    for seg in raw:
        if not isinstance(seg, str) or not seg:
            return None
        segments.append(seg)
    return tuple(segments)


def validate_linked_record_field_defs(
    *,
    table_label: str,
    table_path: tuple[str, ...],
    field_defs_by_key: dict[str, TableFieldDef],
) -> None:
    """Validate every `linked_record` FieldDef's config — resolution of
    `target_table_path`, non-self, non-unknown."""
    for field_def in field_defs_by_key.values():
        if field_def.field_type is not CustomFieldType.linked_record:
            continue
        raw = field_def.config.get("target_table_path")
        target_path = normalize_target_table_path(raw)
        if target_path is None or target_path not in LINKED_RECORD_TARGET_PATHS:
            raise ValueError(
                f"linked_record field {field_def.field_key!r} on {table_label}: unknown target_table_path {raw!r}"
            )
        if target_path == table_path:
            raise ValueError(
                f"linked_record field {field_def.field_key!r} on {table_label}: self-links are not permitted"
            )


def validate_rows_custom_links(
    *,
    table_label: str,
    row_label: str,
    rows: list[tuple[str, dict[str, CustomValue], dict[str, list[str]]]],
    field_defs_by_key: dict[str, TableFieldDef],
    target_row_ids: dict[tuple[str, ...], set[str]],
) -> None:
    """Validate the `custom_links` bag on every row.

    - rejects bag co-existence with `custom_values` (PRD Q16)
    - rejects unknown `field_key`
    - rejects `field_key` whose FieldDef is not `linked_record`
    - rejects `len(ids) > max_links`
    - dedupes within-cell silently (PRD Q25)
    - silently strips orphan ids against the snapshot for custom fields
    - rejects orphan ids for feature-author-declared built-in links
    """
    _ = table_label
    for row_id, custom_values, custom_links in rows:
        for field_key, ids in list(custom_links.items()):
            if field_key in custom_values:
                raise ValueError(
                    f"field_key {field_key!r} on {row_label} {row_id} appears in both custom_values and custom_links"
                )
            field_def = field_defs_by_key.get(field_key)
            if field_def is None:
                raise ValueError(f"Unknown field_key on {row_label} {row_id}: {field_key}")
            if field_def.field_type is not CustomFieldType.linked_record:
                raise ValueError(f"field_key {field_key!r} on {row_label} {row_id} is not a linked_record field")
            if not isinstance(ids, list):
                raise ValueError(
                    f"linked_record value for {field_def.display_name!r} on {row_label} {row_id} must be a list"
                )

            max_links_raw = field_def.config.get("max_links", 1)
            max_links = max_links_raw if isinstance(max_links_raw, int) else None
            seen: set[str] = set()
            deduped: list[str] = []
            for entry in ids:
                if not isinstance(entry, str):
                    raise ValueError(
                        f"linked_record ids for {field_def.display_name!r} on {row_label} {row_id} must be strings"
                    )
                if entry not in seen:
                    seen.add(entry)
                    deduped.append(entry)
            if max_links is not None and len(deduped) > max_links:
                raise ValueError(
                    f"linked_record value for {field_def.display_name!r} on {row_label} {row_id} "
                    f"exceeds max_links={max_links}"
                )

            target_path = normalize_target_table_path(field_def.config.get("target_table_path"))
            available = target_row_ids.get(target_path, set()) if target_path else set()
            cleaned: list[str] = []
            missing: list[str] = []
            for entry in deduped:
                if entry in available:
                    cleaned.append(entry)
                elif field_def.origin != "custom":
                    missing.append(entry)
            if missing:
                raise ValueError(
                    f"linked_record value for {field_def.display_name!r} on {row_label} {row_id} "
                    f"references missing target ids: {missing}"
                )
            custom_links[field_key] = cleaned


def validate_default_option_ids(
    *,
    table_label: str,
    field_defs_by_key: dict[str, TableFieldDef],
    single_select_options: dict[str, list[SingleSelectOption]],
) -> None:
    """`config.default_option_id`, when set, must reference an option in
    the field's namespaced list. Only valid on single_select fields."""
    for field_def in field_defs_by_key.values():
        default_raw = field_def.config.get("default_option_id")
        if default_raw is None:
            continue
        if field_def.field_type is not CustomFieldType.single_select:
            raise ValueError(
                f"default_option_id is only valid for single_select fields "
                f"(field {field_def.field_key!r}, type {field_def.field_type.value!r})"
            )
        if not isinstance(default_raw, str):
            raise ValueError(f"default_option_id for {field_def.field_key!r} must be a string option id")
        namespace_key = f"{table_label}.{field_def.field_key}"
        default_option_ids = {option.id for option in single_select_options.get(namespace_key, [])}
        if default_raw not in default_option_ids:
            raise ValueError(
                f"default_option_id {default_raw!r} for {field_def.field_key!r} "
                "does not reference an option in the field's option list"
            )


def validate_non_negative_custom_numbers(
    *,
    row_label: str,
    rows: list[tuple[str, dict[str, CustomValue]]],
    field_keys: frozenset[str],
) -> None:
    """Enforce non-negative numeric built-ins stored in custom_values."""
    for row_id, custom_values in rows:
        for field_key in field_keys:
            value = custom_values.get(field_key)
            if isinstance(value, (int, float)) and value < 0:
                raise ValueError(f"{row_label} {field_key} must be zero or greater: {row_id}")


def validate_typed_option_refs(
    *,
    rows: Sequence[tuple[str, str | None]],
    valid_option_ids: set[str],
    missing_message: str,
) -> None:
    """Each ``(row_id, option_id)`` whose ``option_id`` is set must point at a
    known single-select option. A ``None`` cell is allowed (the column is
    optional). ``missing_message`` is a ``str.format`` template with ``{row_id}``
    and ``{value}`` placeholders, so each caller keeps its exact error wording.
    """
    for row_id, value in rows:
        if value is not None and value not in valid_option_ids:
            raise ValueError(missing_message.format(row_id=row_id, value=value))


def validate_generic_table(
    *,
    table_label: str,
    row_label: str,
    table_path: tuple[str, ...],
    field_defs: list[TableFieldDef],
    rows: Sequence[RowWithIdentity],
    single_select_options: dict[str, list[SingleSelectOption]],
    target_row_ids: dict[tuple[str, ...], set[str]],
    non_negative_field_keys: frozenset[str] = frozenset(),
    validate_defaults: bool = False,
) -> dict[str, TableFieldDef]:
    """Run the shared per-table validation sequence every FieldDef-capable
    DataTable needs, in one place:

    1. index ``field_defs`` (enforces unique field_key + display_name);
    2. require the ``record_id`` identity field is seeded;
    3. validate every ``linked_record`` field-def's config;
    4. coerce each row's ``custom_values`` against its field type;
    5. (optional) enforce non-negative numeric built-ins;
    6. resolve and clean each row's ``custom_links``;
    7. (optional) validate ``default_option_id`` references.

    Table-specific checks (typed single-select columns, numeric ranges,
    cross-table foreign keys) stay at the call site; run them around this
    call. Returns the indexed field_defs for any such follow-up.
    """
    field_defs_by_key = index_table_field_defs(table_label, field_defs)
    require_record_id_seeded(table_label, field_defs_by_key)
    validate_linked_record_field_defs(
        table_label=table_label,
        table_path=table_path,
        field_defs_by_key=field_defs_by_key,
    )
    validate_rows_custom_values(
        table_label=table_label,
        row_label=row_label,
        rows=[(row.id, row.custom_values) for row in rows],
        field_defs_by_key=field_defs_by_key,
        single_select_options=single_select_options,
    )
    if non_negative_field_keys:
        validate_non_negative_custom_numbers(
            row_label=row_label,
            rows=[(row.id, row.custom_values) for row in rows],
            field_keys=non_negative_field_keys,
        )
    validate_rows_custom_links(
        table_label=table_label,
        row_label=row_label,
        rows=[(row.id, row.custom_values, row.custom_links) for row in rows],
        field_defs_by_key=field_defs_by_key,
        target_row_ids=target_row_ids,
    )
    if validate_defaults:
        validate_default_option_ids(
            table_label=table_label,
            field_defs_by_key=field_defs_by_key,
            single_select_options=single_select_options,
        )
    return field_defs_by_key
