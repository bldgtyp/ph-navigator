"""Token, parsing, error, and schema-mutation helpers shared by the MCP tools.

Every helper is module-level so individual tool functions in `tools.py`
stay short. The helpers split into:

* token / scope resolution (`current_token`, `require_token_scope_or_error`,
  `project_access_or_error`)
* identifier and contract lookup (`parse_uuid`, `table_contract_or_error`,
  `current_document_view_or_error`)
* HTTP-to-MCP error translation (`raise_mcp_error`,
  `raise_http_exception_as_mcp_error`)
* schema-mutation dispatch shared by every write tool
  (`build_schema_mutation`, `apply_mcp_schema_mutation`,
  `apply_mcp_schema_mutation_with_audit`, `custom_field_response`)
"""

from __future__ import annotations

import json
import os
from datetime import date
from typing import NoReturn, TypeVar
from uuid import UUID

from fastapi import HTTPException
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError
from pydantic import BaseModel, ValidationError

from features.mcp.models import (
    McpRecoverability,
    McpScope,
    McpStructuredError,
    McpTokenRecord,
)
from features.mcp.service import (
    McpProjectDeletedError,
    authenticate_plaintext_token,
    get_active_token_by_id,
    project_access_for_token,
    require_token_scope,
)
from features.project_document.models import ProjectDocumentView
from features.project_document.schema_mutations import FieldSchemaMutation
from features.project_document.service import (
    apply_schema_mutation_to_draft,
    get_current_document_view,
)
from features.project_document.tables import TableContract, get_table_contract
from features.projects.access import ProjectAccess

__all__ = [
    "apply_mcp_schema_mutation",
    "apply_mcp_schema_mutation_with_audit",
    "build_schema_mutation",
    "current_document_view_or_error",
    "current_token",
    "custom_field_response",
    "parse_uuid",
    "project_access_or_error",
    "raise_http_exception_as_mcp_error",
    "raise_mcp_error",
    "require_token_scope_or_error",
    "table_contract_or_error",
]


def current_token(ctx: Context, allow_env_token: bool = False) -> McpTokenRecord:
    access_token = get_access_token()
    if access_token is not None:
        token_id = parse_uuid(access_token.client_id, "token_id", ctx)
        token = get_active_token_by_id(token_id)
        if token is None:
            raise_mcp_error("invalid_token", "MCP token is revoked, expired, or unknown.", "reauthenticate", ctx)
        return token

    plaintext = os.getenv("PHN_MCP_TOKEN") if allow_env_token else None
    if plaintext:
        token = authenticate_plaintext_token(plaintext)
        if token is not None:
            return token

    raise_mcp_error("not_authenticated", "MCP bearer token is required.", "reauthenticate", ctx)


def parse_uuid(value: str, field_name: str, ctx: Context) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise_mcp_error(
            "validation_error",
            f"{field_name} must be a UUID.",
            "fatal",
            ctx,
            {"field": field_name},
        )


def require_token_scope_or_error(token: McpTokenRecord, project_id: UUID, scope: McpScope, ctx: Context) -> None:
    try:
        require_token_scope(token, project_id, scope)
    except PermissionError as exc:
        code = str(exc)
        if code == "mcp_scope_insufficient":
            raise_mcp_error("mcp_scope_insufficient", f"MCP token requires scope '{scope}'.", "forbidden", ctx)
        raise_mcp_error("mcp_project_scope_mismatch", "MCP token cannot access this project.", "forbidden", ctx)


def project_access_or_error(token: McpTokenRecord, project_id: UUID, scope: McpScope, ctx: Context) -> ProjectAccess:
    try:
        return project_access_for_token(token, project_id, scope)
    except McpProjectDeletedError as exc:
        raise_mcp_error(
            "project_deleted",
            "Project was deleted.",
            "refresh",
            ctx,
            {
                "recoverability": "restore",
                "project_id": str(exc.project["id"]),
                "deleted_at": _isoformat(exc.project["deleted_at"]),
                "hard_delete_after": _isoformat(exc.project["hard_delete_after"]),
            },
        )
    except LookupError:
        raise_mcp_error("project_not_found", "Project not found.", "refresh", ctx)
    except PermissionError as exc:
        code = str(exc)
        if code == "mcp_scope_insufficient":
            raise_mcp_error("mcp_scope_insufficient", f"MCP token requires scope '{scope}'.", "forbidden", ctx)
        raise_mcp_error("mcp_project_scope_mismatch", "MCP token cannot access this project.", "forbidden", ctx)


def current_document_view_or_error(version_id: UUID, access: ProjectAccess, ctx: Context) -> ProjectDocumentView:
    try:
        return get_current_document_view(version_id, access)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Project document could not be loaded.",
            default_recoverability="fatal",
            recoverability_by_code={"project_version_not_found": "refresh"},
        )


def table_contract_or_error(table_name: str, ctx: Context) -> TableContract:
    try:
        return get_table_contract(table_name)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="document_table_not_found",
            default_message="Document table not found.",
            default_recoverability="refresh",
        )


def raise_http_exception_as_mcp_error(
    exc: HTTPException,
    ctx: Context,
    default_code: str,
    default_message: str,
    default_recoverability: McpRecoverability,
    recoverability_by_code: dict[str, McpRecoverability] | None = None,
) -> NoReturn:
    detail = exc.detail if isinstance(exc.detail, dict) else {}
    code = str(detail.get("error_code", default_code))
    message = str(detail.get("message", default_message))
    details = detail.get("details", {})
    recoverability = (recoverability_by_code or {}).get(code, default_recoverability)
    raise_mcp_error(
        code,
        message,
        recoverability,
        ctx,
        details if isinstance(details, dict) else {},
    )


def _isoformat(value: object) -> str | None:
    return value.isoformat() if isinstance(value, date) else None


# Per-error-code recoverability map for the schema-mutation tools.
# Codes not listed default to `"fatal"` so callers don't auto-retry on
# their own bugs.
_SCHEMA_MUTATION_RECOVERABILITY: dict[str, McpRecoverability] = {
    "custom_field_stale_schema_fingerprint": "refresh",
    "version_locked": "refresh",
    "draft_etag_mismatch": "refresh",
    "version_etag_mismatch": "refresh",
    "custom_field_illegal_type_conversion": "fatal",
    "custom_field_coercion_preflight_required": "fatal",
    "custom_field_option_id_unknown": "fatal",
    "custom_field_option_list_invalid": "fatal",
    "custom_field_formula_parse_error": "fatal",
    "custom_field_formula_cycle": "fatal",
    "custom_field_formula_missing_ref": "fatal",
    "custom_field_formula_resource_limit": "fatal",
    "custom_field_formula_unsupported_function": "fatal",
}


_MutationT = TypeVar("_MutationT", bound=BaseModel)


def build_schema_mutation(
    ctx: Context,
    mutation_cls: type[_MutationT],
    **fields: object,
) -> _MutationT:
    """Build a typed `FieldSchemaMutation` member or raise a structured MCP error.

    Centralizes the ``ValidationError → mcp_error("validation_error",
    "fatal")`` translation so every schema-mutation tool surfaces
    malformed args identically. `None` values are dropped from `fields`
    so a missing optional kwarg falls back to the Pydantic default —
    except `description`, where `None` is the explicit "clear" signal
    for `SetDescriptionMutation`.
    """
    cleaned = {key: value for key, value in fields.items() if value is not None or key == "description"}
    try:
        return mutation_cls.model_validate(cleaned)
    except ValidationError as exc:
        raise_mcp_error(
            "validation_error",
            "Custom-field mutation failed validation.",
            "fatal",
            ctx,
            {"errors": [str(error["msg"]) for error in exc.errors()]},
        )


def apply_mcp_schema_mutation(
    ctx: Context,
    project_id: str,
    version_id: str,
    table_key: str,
    mutation: FieldSchemaMutation,
    *,
    if_match: str | None,
    if_match_version: str | None,
    allow_env_token: bool,
) -> BaseModel:
    """Variant that discards the audit payload for tools that don't need it."""
    response, _ = apply_mcp_schema_mutation_with_audit(
        ctx,
        project_id,
        version_id,
        table_key,
        mutation,
        if_match=if_match,
        if_match_version=if_match_version,
        allow_env_token=allow_env_token,
    )
    return response


def apply_mcp_schema_mutation_with_audit(
    ctx: Context,
    project_id: str,
    version_id: str,
    table_key: str,
    mutation: FieldSchemaMutation,
    *,
    if_match: str | None,
    if_match_version: str | None,
    allow_env_token: bool,
) -> tuple[BaseModel, dict[str, object]]:
    """Resolve the token, gate on `project:write`, dispatch through
    ``apply_schema_mutation_to_draft`` with ``updated_via='mcp'``, and
    map any ``HTTPException`` to a structured MCP error envelope.

    ``updated_via='mcp'`` tags the draft row and audit log so the
    browser-side lease indicator can show that an MCP agent is editing.
    """
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    try:
        response, audit_payload = apply_schema_mutation_to_draft(
            parsed_version_id,
            table_key,
            mutation,
            access,
            if_match=if_match,
            if_match_version=if_match_version,
            request=None,
            updated_via="mcp",
        )
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Custom-field schema mutation failed.",
            default_recoverability="fatal",
            recoverability_by_code=_SCHEMA_MUTATION_RECOVERABILITY,
        )
    return response, audit_payload


def custom_field_response(
    response: BaseModel,
    field_id: str,
    ctx: Context,
) -> dict[str, object]:
    """Pull the named `CustomFieldDef` out of the table envelope.

    Raises ``custom_field_invalid_field_id`` if the field is missing —
    defensive guard, shouldn't fire since apply validated id existence.
    """
    field_defs = getattr(response, "field_defs", None)
    if field_defs is None:
        raise_mcp_error(
            "custom_field_unsupported_table",
            "Response envelope does not expose field_defs.",
            "fatal",
            ctx,
            {"field_id": field_id},
        )
    for field in field_defs:
        if field.origin == "custom" and field.field_key == field_id:
            return field.model_dump(mode="json")
    raise_mcp_error(
        "custom_field_invalid_field_id",
        "Mutated field id not present in the response envelope.",
        "fatal",
        ctx,
        {"field_id": field_id},
    )


def raise_mcp_error(
    code: str,
    message: str,
    recoverability: McpRecoverability,
    ctx: Context,
    details: dict[str, object] | None = None,
) -> NoReturn:
    request_id = getattr(ctx, "request_id", "")
    envelope = McpStructuredError(
        code=code,
        message=message,
        request_id=request_id,
        recoverability=recoverability,
        details=details or {},
    )
    raise ToolError(json.dumps(envelope.model_dump(mode="json"), separators=(",", ":")))
