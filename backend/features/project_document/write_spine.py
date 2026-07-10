"""The shared write spine every project-document mutation surface runs through.

One place owns the draft write lifecycle: lock + ETag-gate the basis, run the
surface's mutation, short-circuit no-ops, validate the body size once, persist
the draft, and bump the draft ETag — all inside a single transaction with the
existing ``FOR UPDATE`` locks. Surfaces supply only what is genuinely theirs:
the mutation itself, an optional post-persist audit hook, and response shaping.

Before this spine, ``replace_table_slice``, the schema-mutation path, and the
aperture/envelope command services each re-implemented the same
load-draft → check-ETag → apply → validate → persist → bump-ETag plumbing.
"""

from __future__ import annotations

from collections.abc import Callable
from contextlib import nullcontext
from dataclasses import dataclass
from time import perf_counter
from typing import Any, Literal
from uuid import UUID

from psycopg import Connection
from starlette import status

from database import transaction
from features.assets.reference_validation import validate_document_asset_references
from features.project_document import repository
from features.project_document.document import ProjectDocumentV1
from features.project_document.models import ProjectDocumentSource
from features.project_document.store import raise_project_version_not_found, rewrite_draft_if_upgraded
from features.project_document.validation import (
    document_etag,
    enforce_document_body_size,
    next_draft_etag_from_etag,
    upgrade_document_with_errors,
    validate_document,
)
from features.project_document.write_metrics import (
    DocumentWriteMetrics,
    active_write_metrics,
)
from features.projects.access import ProjectAccess
from features.shared.errors import api_error

# A surface's mutation: given the locked transaction and the ETag-gated basis,
# return the next body plus optional ``details`` the surface threads through —
# audit payload to log on persist, or diagnostics to echo on a no-op.
DocumentMutation = Callable[
    [Connection[Any], ProjectDocumentV1],
    tuple[ProjectDocumentV1, dict[str, object] | None],
]

# Runs inside the same transaction immediately after a draft is persisted (never
# on a no-op). Receives the mutation's ``details`` so the surface can audit-log.
OnPersisted = Callable[[Connection[Any], dict[str, object] | None], None]


def load_draft_context(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
    user_id: UUID,
    if_match: str | None,
    if_match_version: str | None,
    *,
    draft_etag_mismatch_message: str,
    metrics: DocumentWriteMetrics | None = None,
) -> tuple[ProjectDocumentV1, str, str, dict[str, Any] | None]:
    """Load + ETag-gate the draft basis used by every mutating draft op.

    Locks the version row, rejects writes against a locked version, then
    decides whether the basis is the saved version body (no draft yet) or
    the current draft. The right ETag header is checked depending on which
    basis we're using.

    Returns ``(base_body, base_version_etag, version_etag, draft_or_none)``.
    `version_etag` is always the hash of the *saved* version body — useful
    for the no-op response branch that still needs to advertise it.
    """
    version = repository.get_project_version_for_update(conn, project_id, version_id)
    if version is None:
        raise_project_version_not_found()
    if version["locked"]:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "version_locked",
            "Locked versions cannot be edited.",
        )

    with metrics.measure("version_parse_ms") if metrics is not None else nullcontext():
        version_body = validate_document(version["body"])
    version_etag = document_etag(version_body)
    draft = repository.get_draft_for_update(conn, version_id, user_id)

    if draft is None:
        if if_match_version != version_etag:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "version_etag_mismatch",
                "The saved version changed before this draft was created.",
                {"expected": version_etag},
            )
        return version_body, version_etag, version_etag, None

    stored_draft_etag = str(draft["draft_etag"])
    if if_match != stored_draft_etag:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "draft_etag_mismatch",
            draft_etag_mismatch_message,
            {"expected": stored_draft_etag},
        )

    with metrics.measure("draft_parse_ms") if metrics is not None else nullcontext():
        draft_result, draft_errors = upgrade_document_with_errors(draft["body"])
    if draft_result is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_project_document",
            "Project document failed validation.",
            {"errors": draft_errors},
        )
    base_body, draft_etag, _last_patched_at = rewrite_draft_if_upgraded(conn, draft, draft_result)

    if stored_draft_etag != draft_etag:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "draft_etag_mismatch",
            draft_etag_mismatch_message,
            {"expected": draft_etag},
        )
    base_version_etag = str(draft["base_version_etag"])
    return base_body, base_version_etag, version_etag, {**draft, "draft_etag": draft_etag}


@dataclass(frozen=True)
class DocumentWriteResult:
    """Outcome of one spine write, in the shape every surface needs to respond.

    ``details`` is the mutation's pass-through payload (audit info on a write, or
    no-op diagnostics). Surfaces build their own response model from
    ``body``/``source``/the ETags; ``source`` already encodes whether a draft is
    in play, so there is no separate persisted-vs-no-op flag.
    """

    body: ProjectDocumentV1
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    details: dict[str, object] | None


def apply_document_write(
    access: ProjectAccess,
    version_id: UUID,
    user_id: UUID,
    *,
    if_match: str | None,
    if_match_version: str | None,
    mutate: DocumentMutation,
    draft_etag_mismatch_message: str,
    updated_via: Literal["browser", "mcp"] = "browser",
    validate_asset_references: bool = False,
    on_persisted: OnPersisted | None = None,
    metrics: DocumentWriteMetrics | None = None,
) -> DocumentWriteResult:
    """Run one document mutation through the shared draft write lifecycle.

    Auth is the caller's responsibility (it owns the surface-specific error
    surface); pass the already-resolved editor ``user_id``. The mutation that
    leaves the body unchanged returns a no-op result without touching the draft
    or the audit log.
    """
    transaction_measurement = metrics.measure("txn_ms") if metrics is not None else nullcontext()
    with transaction_measurement:
        with transaction() as conn:
            base_body, base_version_etag, version_etag, draft = load_draft_context(
                conn,
                access.project_id,
                version_id,
                user_id,
                if_match,
                if_match_version,
                draft_etag_mismatch_message=draft_etag_mismatch_message,
                metrics=metrics,
            )

            outgoing_before = metrics.outgoing_validate_ms if metrics is not None else 0.0
            mutate_started_at = perf_counter()
            with active_write_metrics(metrics):
                next_body, details = mutate(conn, base_body)
            if metrics is not None:
                mutate_ms = (perf_counter() - mutate_started_at) * 1000
                outgoing_ms = metrics.outgoing_validate_ms - outgoing_before
                metrics.apply_ms += max(0.0, mutate_ms - outgoing_ms)

            if next_body == base_body:
                return DocumentWriteResult(
                    body=base_body,
                    source="draft" if draft is not None else "version",
                    version_etag=version_etag,
                    draft_etag=draft["draft_etag"] if draft is not None else None,
                    details=details,
                )

            if validate_asset_references:
                with metrics.measure("asset_check_ms") if metrics is not None else nullcontext():
                    validate_document_asset_references(conn, project_id=access.project_id, body=next_body)
            with metrics.measure("serialize_ms") if metrics is not None else nullcontext():
                serialized_next = enforce_document_body_size(next_body)
            if metrics is not None:
                metrics.body_bytes = serialized_next.size_bytes
            with metrics.measure("sql_ms") if metrics is not None else nullcontext():
                draft_etag = repository.upsert_draft(
                    conn,
                    version_id,
                    user_id,
                    next_body,
                    base_version_etag,
                    next_draft_etag_from_etag(serialized_next.etag),
                    updated_via=updated_via,
                    serialized_body=serialized_next,
                )
            if on_persisted is not None:
                on_persisted(conn, details)

    return DocumentWriteResult(
        body=next_body,
        source="draft",
        version_etag=version_etag,
        draft_etag=draft_etag,
        details=details,
    )
