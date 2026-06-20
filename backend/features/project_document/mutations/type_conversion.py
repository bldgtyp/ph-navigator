"""`changeType` dispatcher with per-row coercion preflight.

Wraps the conversion-policy matrix (lossless / lossy / create_options /
substitute_labels) and coerces row values target-side: when a row's
value can't be coerced, the row is surfaced in the
`custom_field_coercion_preflight_required` payload until the client
re-submits with `acknowledge_destructive=True`.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import cast

from starlette import status

from features.project_document.custom_fields import (
    SHORT_TEXT_MAX_LENGTH,
    CustomFieldType,
    CustomValue,
    TableFieldDef,
    normalize_display_name,
)
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.formula import evaluate_table_formulas
from features.project_document.mutations.guards import (
    find_field,
    read_rows_from_envelope,
    replace_rows_in_envelope,
    strip_field_from_row,
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
    validate_option_list,
)
from features.project_document.tables.contracts import TableFieldRegistry
from features.shared.colors import normalize_hex_color
from features.shared.errors import api_error

__all__ = ["apply_change_type"]

# Cap on per-row before/after entries captured in the audit payload.
# Beyond this, the payload carries `row_changes_truncated: True` and the
# first AUDIT_ROW_CAP entries — enough for after-the-fact recovery in
# typical project sizes while keeping the action-log row bounded.
AUDIT_ROW_CAP = 100


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
        if isinstance(raw_value, str):
            text_value = raw_value
        elif isinstance(raw_value, bool):
            text_value = "true" if raw_value else "false"
        elif isinstance(raw_value, (int, float)):
            text_value = _format_number_for_text(raw_value)
        else:
            return False, None, "single_select_requires_text"
        normalized = normalize_display_name(text_value)
        if not normalized:
            return True, None, ""
        for option in target_option_list:
            if normalize_display_name(option.label) == normalized:
                return True, option.id, ""
        return False, None, "no_matching_option"
    if to_type is CustomFieldType.color:
        if not isinstance(raw_value, str):
            return False, None, "color_must_be_string"
        stripped = raw_value.strip()
        if not stripped:
            return True, None, ""
        try:
            return True, normalize_hex_color(stripped), ""
        except ValueError:
            return False, None, "invalid_color_hex"
    return False, None, f"unsupported_to_type:{to_type.value}"


def _read_source_value(
    row: object,
    field_id: str,
    from_type: CustomFieldType,
    capability: TableFieldRegistry,
    formula_overlay: dict[str, dict[str, object]],
) -> object | None:
    """Read the per-row source value for a type-change preflight.

    For non-formula sources, reads from `custom_values[field_id]`.
    For formula sources, reads the computed overlay re-evaluated against
    the live document. Error overlays (`{"error": "..."}`) snapshot as
    `None` — there's nothing meaningful to coerce — and they fall into
    the incompatible-row preflight count for ack tracking.
    """
    if from_type is CustomFieldType.formula:
        row_id = str(getattr(row, "id", ""))
        per_row = formula_overlay.get(row_id, {})
        value = per_row.get(field_id)
        if isinstance(value, dict) and "error" in value:
            return None
        return value
    custom_values = capability.read_row_custom_values(row)
    return custom_values.get(field_id)


def _coerce_formula_snapshot_to_text(value: object) -> str | None:
    """Stringify a formula's computed value for the snapshot path.

    A formula→text→formula round-trip stays stable because the
    serializer matches the canonical text form used for number→text
    coercion (`_format_number_for_text`).
    """
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return _format_number_for_text(value)


def _materialize_options_for_text_to_select(
    rows: list[object],
    field_id: str,
    capability: TableFieldRegistry,
    *,
    source_value_for: Callable[[object], object | None],
) -> tuple[list[SingleSelectOption], list[tuple[str, object, str]]]:
    """Enumerate distinct trimmed non-empty source values into options.

    Returns the new option list (capped at TEXT_TO_SINGLE_SELECT_OPTION_CAP)
    and the list of `(row_id, raw_value, reason)` diagnostics for rows
    whose value falls past the cap.

    `source_value_for(row)` returns the raw cell value, abstracting the
    custom_values vs formula-overlay split so this helper handles both
    `text → single_select` and `formula → single_select` uniformly.
    """
    seen: dict[str, SingleSelectOption] = {}
    overflow: list[tuple[str, object, str]] = []
    order_index = 0
    for row in rows:
        raw_value = source_value_for(row)
        # Render numbers/bools into their canonical text form before
        # materializing options so a `formula → single_select` build
        # produces the same option list as `long_text → single_select`
        # on the same logical values.
        if isinstance(raw_value, str):
            text_value = raw_value
        elif isinstance(raw_value, bool):
            text_value = "true" if raw_value else "false"
        elif isinstance(raw_value, (int, float)):
            text_value = _format_number_for_text(raw_value)
        else:
            continue
        stripped = text_value.strip()
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
    capability: TableFieldRegistry,
    *,
    client_options: list[SingleSelectOption] | None = None,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_field_defs(body)
    index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)

    if mutation.after.field_key != mutation.field_id:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_invalid_field_id",
            "changeType target id must equal the source field id.",
            {"field_id": mutation.after.field_key, "expected_field_id": mutation.field_id},
        )
    if _number_units_are_fixed(existing) and existing.config.get("units") != mutation.after.config.get("units"):
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_fixed_units_locked",
            "Fixed unit config cannot be edited.",
            {"field_id": mutation.field_id},
        )
    # Defense-in-depth: reject `field_type` changes on built-in fields
    # whose `"field_type"` lock is set in feature code. The frontend
    # already disables the picker; this guard catches MCP / hand-crafted
    # writes that bypass the UI. Lock lists are not persisted, so this
    # check consults the per-table registry rather than the FieldDef.
    if mutation.field_id in capability.field_type_locked_keys:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_field_type_locked",
            "This built-in field's type is locked by feature code.",
            {"field_id": mutation.field_id, "reason": "field_type_locked"},
        )
    if mutation.after.field_type == existing.field_type:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_invalid_field_id",
            "changeType requires a different target field_type.",
            {"field_id": mutation.field_id, "field_type": existing.field_type.value},
        )
    # Disallow silent metadata rewrites during a type change — only
    # field_type and config may differ. `created_at` and `created_by`
    # are preserved server-side (clients aren't required to round-trip
    # them exactly), but `display_name` and `description` must match
    # the stored field. `field_key` identity is already enforced by
    # the equality check above.
    for attr in ("display_name", "description"):
        if getattr(mutation.after, attr) != getattr(existing, attr):
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "custom_field_invalid_field_id",
                "changeType may not modify field metadata other than type/config.",
                {"field_id": mutation.field_id, "disallowed_attribute": attr},
            )

    from_type = existing.field_type
    to_type = mutation.after.field_type
    policy = CONVERSION_MATRIX.get((from_type, to_type))
    if policy is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_illegal_type_conversion",
            f"Cannot convert custom field from {from_type.value} to {to_type.value}.",
            {"field_id": mutation.field_id, "from_type": from_type.value, "to_type": to_type.value},
        )

    rows = read_rows_from_envelope(body, mutation.table_key)

    if policy == "linked_record_wipe":
        return _apply_linked_record_wipe(
            body,
            mutation,
            existing=existing,
            index=index,
            current_fields=current_fields,
            rows=rows,
            from_type=from_type,
            to_type=to_type,
            capability=capability,
        )

    # When converting FROM formula, re-evaluate the live document one
    # last time so the snapshot pass reads the actual current computed
    # value, not a stale overlay. Empty when from_type is not formula.
    formula_overlay: dict[str, dict[str, object]] = {}
    if from_type is CustomFieldType.formula:
        formula_overlay = evaluate_table_formulas(capability, body)

    def source_value(row: object) -> object | None:
        return _read_source_value(row, mutation.field_id, from_type, capability, formula_overlay)

    target_option_list: list[SingleSelectOption] | None = None
    generated_options: list[SingleSelectOption] | None = None
    overflow_diagnostics: list[tuple[str, object, str]] = []
    option_value_lookup_for_substitute: dict[str, str] | None = None
    if policy == "create_options":
        if client_options is not None:
            # Bundle path: the user previewed/edited the auto-derived
            # option list in the field-config modal. Trust the client's
            # list as authoritative; per-row coercion below maps source
            # values onto these options by normalized label, and rows
            # whose value has no matching option surface as preflight
            # incompatibles (the user acks the clear).
            validate_option_list(client_options)
            generated_options = list(client_options)
            target_option_list = generated_options
        else:
            generated_options, overflow_diagnostics = _materialize_options_for_text_to_select(
                rows, mutation.field_id, capability, source_value_for=source_value
            )
            target_option_list = generated_options
    elif policy in ("substitute_labels", "substitute_option_colors"):
        # Build {option_id: label} from the existing namespaced list so
        # the per-row pass can substitute labels or option colors.
        namespace_key = option_list_key(capability.table_path, mutation.field_id)
        existing_options = body.single_select_options.get(namespace_key, [])
        option_value_lookup_for_substitute = {
            opt.id: opt.color if policy == "substitute_option_colors" else opt.label for opt in existing_options
        }

    # Per-row preflight. Each row produces one `(row, before, after)`
    # decision and (when rejected) one `incompatible` entry. The apply
    # pass below derives both `new_rows` and the audit `row_changes`
    # from `decisions` — no separate `write_by_row` / `before_by_row`
    # bridge dicts. `after = None` always means "clear the cell"
    # (whether by lossy clear, ack-required discard, or empty-source
    # no-op); `before == after` no-ops skip the row-rebuild path below.
    incompatible: list[dict[str, object]] = []
    decisions: list[tuple[object, object | None, object | None]] = []

    def _reject(row_obj: object, raw: object | None, reason: str) -> None:
        incompatible.append({"row_id": str(getattr(row_obj, "id", "")), "raw_value": raw, "reason": reason})
        decisions.append((row_obj, raw, None))

    for row in rows:
        raw_value = source_value(row)

        # `discard_then_author` (primitive | formula → formula): every
        # non-empty cell is destructively discarded; the ack moves the
        # bundle forward and `apply_set_formula` writes the new config.
        if policy == "discard_then_author":
            if raw_value is None or raw_value == "":
                decisions.append((row, raw_value, None))
            else:
                _reject(row, raw_value, "discarded_for_formula_authoring")
            continue

        # `formula → primitive`: canonicalize the computed value to text
        # and run the standard coercion. Text targets snapshot
        # losslessly; number/url surface failed parses to the preflight.
        if from_type is CustomFieldType.formula:
            snapshot_text = _coerce_formula_snapshot_to_text(raw_value)
            ok, coerced, reason = _try_coerce_for_change_type(
                snapshot_text, to_type, target_option_list=target_option_list
            )
            if ok:
                decisions.append((row, raw_value, coerced))
            else:
                _reject(row, raw_value, reason)
            continue

        if (
            policy in ("substitute_labels", "substitute_option_colors")
            and option_value_lookup_for_substitute is not None
        ):
            if raw_value is None or raw_value == "":
                decisions.append((row, raw_value, None))
                continue
            substituted = option_value_lookup_for_substitute.get(str(raw_value))
            if substituted is None:
                _reject(row, raw_value, "no_matching_option")
                continue
            if policy == "substitute_labels" and to_type in (CustomFieldType.short_text, CustomFieldType.long_text):
                decisions.append((row, raw_value, substituted))
                continue
            ok, coerced, reason = _try_coerce_for_change_type(
                substituted,
                to_type,
                target_option_list=target_option_list,
            )
            if ok:
                decisions.append((row, raw_value, coerced))
            else:
                _reject(row, raw_value, reason)
            continue

        ok, coerced, reason = _try_coerce_for_change_type(raw_value, to_type, target_option_list=target_option_list)
        if ok:
            decisions.append((row, raw_value, coerced))
        else:
            _reject(row, raw_value, reason)
    # Overflow diagnostics from text→single_select cap are surfaced in
    # the preflight payload but do not produce a second decision — the
    # per-row coerce above already emitted a `no_matching_option` reject
    # for these rows when the materialized option list didn't include
    # their value.
    for row_id, raw_value, reason in overflow_diagnostics:
        incompatible.append({"row_id": row_id, "raw_value": raw_value, "reason": reason})

    if incompatible and not mutation.acknowledge_destructive:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
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
            status.HTTP_422_UNPROCESSABLE_CONTENT,
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
    next_body = capability.replace_field_defs(body, next_fields)

    # Handle option-list namespace changes.
    if policy == "create_options":
        next_body = capability.replace_field_option_list(next_body, mutation.field_id, generated_options or [])
    elif from_type is CustomFieldType.single_select:
        # Field is no longer single_select — strip its option-list entry.
        namespace_key = option_list_key(capability.table_path, mutation.field_id)
        next_body = remove_option_list(next_body, namespace_key)

    # Apply row writes and capture per-row audit pairs in one pass over
    # `decisions`. `before == after` no-ops preserve the source row
    # identity (no dict copy); rebuilds happen only when the cell
    # actually changes. The audit `row_changes` payload is capped at
    # AUDIT_ROW_CAP with a `row_changes_truncated` flag past the cap so
    # the action log row stays bounded — the payload gives after-the-
    # fact recovery for discard_then_author and lossy snapshots.
    new_rows: list[object] = []
    row_changes: list[dict[str, object]] = []
    for row, before, after in decisions:
        # Formula sources compare an overlay value to a stored value; an
        # equal string still needs to be written into custom_values.
        if from_type is not CustomFieldType.formula and before == after:
            new_rows.append(row)
            continue
        custom = dict(capability.read_row_custom_values(row))
        if after is None:
            custom.pop(mutation.field_id, None)
        else:
            custom[mutation.field_id] = cast(CustomValue, after)
        new_rows.append(capability.set_row_custom_values(row, custom))
        row_changes.append({"row_id": str(getattr(row, "id", "")), "before": before, "after": after})
    next_body = replace_rows_in_envelope(next_body, mutation.table_key, new_rows)

    # `cleared_row_count` mirrors `len(incompatible)` (the preflight
    # error payload size); `compatible_row_count` is everything else,
    # matching the prior `len(compatible_writes)` semantic.
    rejected_row_ids = {str(entry["row_id"]) for entry in incompatible}
    audit: dict[str, object] = {
        "kind": "changeType",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "from_type": from_type.value,
        "to_type": to_type.value,
        "compatible_row_count": len(decisions) - len(rejected_row_ids),
        "cleared_row_count": len(incompatible),
    }
    if generated_options is not None:
        audit["created_option_count"] = len(generated_options)
    if row_changes:
        audit["row_changes"] = row_changes[:AUDIT_ROW_CAP]
        if len(row_changes) > AUDIT_ROW_CAP:
            audit["row_changes_truncated"] = True
    return next_body, audit


def _apply_linked_record_wipe(
    body: ProjectDocumentV1,
    mutation: ChangeTypeMutation,
    *,
    existing: TableFieldDef,
    index: int,
    current_fields: list[TableFieldDef],
    rows: list[object],
    from_type: CustomFieldType,
    to_type: CustomFieldType,
    capability: TableFieldRegistry,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    """changeType to/from `linked_record`: wipe row data on both bag
    sides for `field_id` on every row in the same transaction
    (PRD Q12). Requires `acknowledge_destructive` when any row carries
    a non-empty value for the field.
    """
    field_id = mutation.field_id
    cleared_rows = 0
    for row in rows:
        if capability.read_row_custom_values(row).get(field_id) not in (None, ""):
            cleared_rows += 1
            continue
        if capability.read_row_links(row).get(field_id):
            cleared_rows += 1

    if cleared_rows > 0 and not mutation.acknowledge_destructive:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_coercion_preflight_required",
            "Conversion would clear values; resubmit with acknowledge_destructive.",
            {
                "field_id": field_id,
                "from_type": from_type.value,
                "to_type": to_type.value,
                "incompatible_row_count": cleared_rows,
                "total_row_count": len(rows),
            },
        )

    next_fields = list(current_fields)
    next_fields[index] = mutation.after.model_copy(
        update={"created_by": existing.created_by, "created_at": existing.created_at}
    )
    next_body = capability.replace_field_defs(body, next_fields)

    new_rows: list[object] = []
    for row in rows:
        next_row, _ = strip_field_from_row(row, field_id, capability)
        new_rows.append(next_row)
    next_body = replace_rows_in_envelope(next_body, mutation.table_key, new_rows)

    audit: dict[str, object] = {
        "kind": "changeType",
        "table_key": mutation.table_key,
        "field_id": field_id,
        "from_type": from_type.value,
        "to_type": to_type.value,
        "compatible_row_count": len(rows) - cleared_rows,
        "cleared_row_count": cleared_rows,
    }
    return next_body, audit


def _number_units_are_fixed(field: TableFieldDef) -> bool:
    units = field.config.get("units")
    return isinstance(units, dict) and cast(dict[str, object], units).get("mode") == "fixed"
