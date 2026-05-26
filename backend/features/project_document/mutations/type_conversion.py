"""`changeType` dispatcher with per-row coercion preflight.

Wraps the conversion-policy matrix (lossless / lossy / create_options /
substitute_labels) and coerces row values target-side: when a row's
value can't be coerced, the row is surfaced in the
`custom_field_coercion_preflight_required` payload until the client
re-submits with `acknowledge_destructive=True`.
"""

from __future__ import annotations

from typing import cast

from starlette import status

from features.project_document.custom_fields import (
    SHORT_TEXT_MAX_LENGTH,
    CustomFieldType,
    CustomValue,
    normalize_display_name,
)
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.mutations.guards import (
    find_field,
    read_rows_from_envelope,
    replace_rows_in_envelope,
)
from features.project_document.mutations.models import (
    CONVERSION_MATRIX,
    TEXT_TO_SINGLE_SELECT_OPTION_CAP,
    ChangeTypeMutation,
)
from features.project_document.mutations.options_ops import validate_default_option_id
from features.project_document.options import (
    OPTION_COLOR_PALETTE,
    mint_option_id,
    option_list_key,
    remove_option_list,
)
from features.project_document.tables.contracts import CustomFieldCapability
from features.shared.errors import api_error

__all__ = ["apply_change_type"]


def _format_number_for_text(value: object) -> str:
    """Locale-independent text rendering for number -> text coercion."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        # Match JS / JSON canonical form: integers without `.0`.
        if value.is_integer():
            return str(int(value))
        return repr(value)
    return str(value)


def _try_coerce_for_change_type(
    raw_value: object,
    to_type: CustomFieldType,
    *,
    target_option_list: list[SingleSelectOption] | None,
) -> tuple[bool, object | None, str]:
    """Try to coerce raw_value to to_type. Returns (ok, coerced, reason).

    `coerced` is the new stored value (None when the source was empty);
    `reason` carries a short string when ok=False (used in the preflight
    diagnostics).
    """
    if raw_value is None or raw_value == "":
        return True, None, ""
    if to_type is CustomFieldType.short_text:
        if isinstance(raw_value, str):
            if len(raw_value) > SHORT_TEXT_MAX_LENGTH:
                return False, None, "exceeds_short_text_max_length"
            return True, raw_value, ""
        if isinstance(raw_value, (int, float)) and not isinstance(raw_value, bool):
            return True, _format_number_for_text(raw_value), ""
        return False, None, "not_coercible_to_short_text"
    if to_type is CustomFieldType.long_text:
        if isinstance(raw_value, str):
            return True, raw_value, ""
        if isinstance(raw_value, (int, float)) and not isinstance(raw_value, bool):
            return True, _format_number_for_text(raw_value), ""
        return False, None, "not_coercible_to_long_text"
    if to_type is CustomFieldType.number:
        if isinstance(raw_value, bool):
            return False, None, "boolean_not_numeric"
        if isinstance(raw_value, (int, float)):
            return True, raw_value, ""
        if isinstance(raw_value, str):
            stripped = raw_value.strip()
            if not stripped:
                return True, None, ""
            try:
                value = float(stripped)
            except ValueError:
                return False, None, "not_a_number"
            if value.is_integer():
                return True, int(value), ""
            return True, value, ""
        return False, None, "not_coercible_to_number"
    if to_type is CustomFieldType.url:
        if not isinstance(raw_value, str):
            return False, None, "url_must_be_string"
        stripped = raw_value.strip()
        if not stripped:
            return True, None, ""
        # Minimal URL guard: require a recognized scheme prefix. The
        # frontend `coerceCustomValue` mirrors this exactly.
        lowered = stripped.lower()
        if not (lowered.startswith("http://") or lowered.startswith("https://")):
            return False, None, "missing_url_scheme"
        return True, stripped, ""
    if to_type is CustomFieldType.single_select:
        # When the target option list is provided, look up by label
        # (case-insensitive trimmed) — the create_options policy in
        # `apply_change_type` materializes the list before calling here.
        if target_option_list is None:
            return False, None, "missing_target_option_list"
        if not isinstance(raw_value, str):
            return False, None, "single_select_requires_text"
        normalized = normalize_display_name(raw_value)
        if not normalized:
            return True, None, ""
        for option in target_option_list:
            if normalize_display_name(option.label) == normalized:
                return True, option.id, ""
        return False, None, "no_matching_option"
    return False, None, f"unsupported_to_type:{to_type.value}"


def _materialize_options_for_text_to_select(
    rows: list[object],
    field_id: str,
    capability: CustomFieldCapability,
) -> tuple[list[SingleSelectOption], list[tuple[str, object, str]]]:
    """Enumerate distinct trimmed non-empty source values into options.

    Returns the new option list (capped at TEXT_TO_SINGLE_SELECT_OPTION_CAP)
    and the list of `(row_id, raw_value, reason)` diagnostics for rows
    whose value falls past the cap.
    """
    seen: dict[str, SingleSelectOption] = {}
    overflow: list[tuple[str, object, str]] = []
    order_index = 0
    for row in rows:
        custom = capability.read_row_custom(row)
        raw_value = custom.get(field_id)
        if not isinstance(raw_value, str):
            continue
        stripped = raw_value.strip()
        if not stripped:
            continue
        normalized = normalize_display_name(stripped)
        if normalized in seen:
            continue
        if len(seen) >= TEXT_TO_SINGLE_SELECT_OPTION_CAP:
            row_id = str(getattr(row, "id", ""))
            overflow.append((row_id, raw_value, "single_select_option_cap_exceeded"))
            continue
        option_id = mint_option_id()
        color = OPTION_COLOR_PALETTE[order_index % len(OPTION_COLOR_PALETTE)]
        seen[normalized] = SingleSelectOption(
            id=option_id,
            label=stripped,
            color=color,
            order=float(order_index + 1),
        )
        order_index += 1
    return list(seen.values()), overflow


def apply_change_type(
    body: ProjectDocumentV1,
    mutation: ChangeTypeMutation,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_custom_fields(body)
    index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)

    if mutation.after.id != mutation.field_id:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "changeType target id must equal the source field id.",
            {"field_id": mutation.after.id, "expected_field_id": mutation.field_id},
        )
    if mutation.after.field_type == existing.field_type:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "changeType requires a different target field_type.",
            {"field_id": mutation.field_id, "field_type": existing.field_type.value},
        )
    # Disallow silent metadata rewrites during a type change — only
    # field_type and config may differ. `created_at` and `created_by`
    # are preserved server-side (clients aren't required to round-trip
    # them exactly), but `display_name`, `field_key`, and `description`
    # must match the stored field.
    for attr in ("display_name", "field_key", "description"):
        if getattr(mutation.after, attr) != getattr(existing, attr):
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "custom_field_invalid_field_id",
                "changeType may not modify field metadata other than type/config.",
                {"field_id": mutation.field_id, "disallowed_attribute": attr},
            )

    from_type = existing.field_type
    to_type = mutation.after.field_type
    policy = CONVERSION_MATRIX.get((from_type, to_type))
    if policy is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_illegal_type_conversion",
            f"Cannot convert custom field from {from_type.value} to {to_type.value}.",
            {"field_id": mutation.field_id, "from_type": from_type.value, "to_type": to_type.value},
        )

    rows = read_rows_from_envelope(body, mutation.table_key)

    target_option_list: list[SingleSelectOption] | None = None
    generated_options: list[SingleSelectOption] | None = None
    overflow_diagnostics: list[tuple[str, object, str]] = []
    label_lookup_for_substitute: dict[str, str] | None = None
    if policy == "create_options":
        generated_options, overflow_diagnostics = _materialize_options_for_text_to_select(
            rows, mutation.field_id, capability
        )
        target_option_list = generated_options
    elif policy == "substitute_labels":
        # Build {option_id: label} from the existing namespaced list so
        # the per-row pass can substitute labels.
        namespace_key = option_list_key(capability.table_path, mutation.field_id)
        existing_options = body.single_select_options.get(namespace_key, [])
        label_lookup_for_substitute = {opt.id: opt.label for opt in existing_options}

    # Per-row preflight.
    incompatible: list[dict[str, object]] = []
    compatible_writes: list[tuple[str, object | None]] = []
    for row in rows:
        row_id = str(getattr(row, "id", ""))
        custom = capability.read_row_custom(row)
        raw_value = custom.get(mutation.field_id)
        if policy == "substitute_labels" and label_lookup_for_substitute is not None:
            if raw_value is None or raw_value == "":
                compatible_writes.append((row_id, None))
                continue
            label = label_lookup_for_substitute.get(str(raw_value))
            if label is None:
                incompatible.append(
                    {"row_id": row_id, "raw_value": raw_value, "reason": "no_matching_option"}
                )
                continue
            if to_type in (CustomFieldType.short_text, CustomFieldType.long_text):
                compatible_writes.append((row_id, label))
                continue
            # single_select → number (or other future targets): re-coerce
            # the label through the standard coercion path. Unparseable
            # labels surface to preflight so the user acks the clear.
            ok, coerced, reason = _try_coerce_for_change_type(
                label, to_type, target_option_list=target_option_list
            )
            if ok:
                compatible_writes.append((row_id, coerced))
            else:
                incompatible.append({"row_id": row_id, "raw_value": raw_value, "reason": reason})
            continue
        ok, coerced, reason = _try_coerce_for_change_type(
            raw_value, to_type, target_option_list=target_option_list
        )
        if ok:
            compatible_writes.append((row_id, coerced))
        else:
            incompatible.append({"row_id": row_id, "raw_value": raw_value, "reason": reason})
    # Overflow diagnostics from text→single_select cap are also incompatible.
    for row_id, raw_value, reason in overflow_diagnostics:
        incompatible.append({"row_id": row_id, "raw_value": raw_value, "reason": reason})

    if incompatible and not mutation.acknowledge_destructive:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_coercion_preflight_required",
            "Conversion would clear values; resubmit with acknowledge_destructive.",
            {
                "field_id": mutation.field_id,
                "from_type": from_type.value,
                "to_type": to_type.value,
                "incompatible_row_count": len(incompatible),
                "total_row_count": len(rows),
                "incompatible_rows": incompatible[:25],
            },
        )

    # Default-option-id validation against the destination state. When
    # the target is single_select, the new option list is either the
    # materialized list (create_options) or the existing namespaced
    # list (already-single_select branch doesn't reach here because
    # changeType requires from != to). When leaving single_select,
    # `after.config.default_option_id` must be unset — defense in
    # depth against a stale draft (the modal strips this per
    # US-CF-16 criterion 9).
    if to_type is CustomFieldType.single_select:
        target_ids = {opt.id for opt in (target_option_list or [])}
        validate_default_option_id(mutation.after, target_ids)
    elif "default_option_id" in mutation.after.config:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_option_list_invalid",
            "default_option_id is only valid for single_select fields.",
            {
                "field_id": mutation.field_id,
                "reason": "default_option_id_outside_single_select",
                "to_type": to_type.value,
            },
        )

    # Apply: replace field def, rewrite rows, update option lists.
    # Preserve created_at / created_by from the existing field so a
    # client doesn't need to round-trip them exactly.
    next_fields = list(current_fields)
    next_fields[index] = mutation.after.model_copy(
        update={"created_by": existing.created_by, "created_at": existing.created_at}
    )
    next_body = capability.replace_custom_fields(body, next_fields)

    # Handle option-list namespace changes.
    if policy == "create_options":
        next_body = capability.replace_field_option_list(
            next_body, mutation.field_id, generated_options or []
        )
    elif from_type is CustomFieldType.single_select:
        # Field is no longer single_select — strip its option-list entry.
        namespace_key = option_list_key(capability.table_path, mutation.field_id)
        next_body = remove_option_list(next_body, namespace_key)

    # Apply row writes. `capability.replace_custom_fields` does not
    # touch the row list, so we can reuse the `rows` we already iterated
    # for preflight and skip a second envelope read.
    write_by_row: dict[str, CustomValue] = {
        row_id: cast(CustomValue, value) for row_id, value in compatible_writes
    }
    incompatible_by_row: set[str] = {str(entry["row_id"]) for entry in incompatible}

    new_rows: list[object] = []
    for row in rows:
        row_id = str(getattr(row, "id", ""))
        if row_id in write_by_row:
            custom = dict(capability.read_row_custom(row))
            value = write_by_row[row_id]
            if value is None:
                custom.pop(mutation.field_id, None)
            else:
                custom[mutation.field_id] = value
            new_rows.append(capability.set_row_custom(row, custom))
        elif row_id in incompatible_by_row:
            custom = dict(capability.read_row_custom(row))
            custom.pop(mutation.field_id, None)
            new_rows.append(capability.set_row_custom(row, custom))
        else:
            new_rows.append(row)
    next_body = replace_rows_in_envelope(next_body, mutation.table_key, new_rows)

    audit: dict[str, object] = {
        "kind": "changeType",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "from_type": from_type.value,
        "to_type": to_type.value,
        "compatible_row_count": len(compatible_writes),
        "cleared_row_count": len(incompatible),
    }
    if generated_options is not None:
        audit["created_option_count"] = len(generated_options)
    return next_body, audit
