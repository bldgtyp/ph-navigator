"""Stage-level timing for project-document table writes."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from time import perf_counter
from typing import Literal
from uuid import UUID

import structlog

log = structlog.get_logger(__name__)

TimingField = Literal[
    "version_parse_ms",
    "draft_parse_ms",
    "payload_parse_ms",
    "apply_ms",
    "outgoing_validate_ms",
    "asset_check_ms",
    "serialize_ms",
    "sql_ms",
    "response_build_ms",
    "txn_ms",
]


@dataclass
class DocumentWriteMetrics:
    """Accumulate non-sensitive timings and byte counts for one table PUT."""

    request_started_at: float
    version_parse_ms: float = 0.0
    draft_parse_ms: float = 0.0
    payload_parse_ms: float = 0.0
    apply_ms: float = 0.0
    outgoing_validate_ms: float = 0.0
    asset_check_ms: float = 0.0
    serialize_ms: float = 0.0
    sql_ms: float = 0.0
    response_build_ms: float = 0.0
    txn_ms: float = 0.0
    body_bytes: int = 0
    request_bytes: int = 0
    response_bytes: int = 0

    @classmethod
    def start(cls) -> DocumentWriteMetrics:
        return cls(request_started_at=perf_counter())

    @contextmanager
    def measure(self, field: TimingField) -> Iterator[None]:
        started_at = perf_counter()
        try:
            yield
        finally:
            elapsed = (perf_counter() - started_at) * 1000
            setattr(self, field, getattr(self, field) + elapsed)

    def emit(self, *, project_id: UUID, version_id: UUID, table_name: str) -> None:
        log.info(
            "project_document.write_timing",
            project_id=str(project_id),
            version_id=str(version_id),
            table_name=table_name,
            version_parse_ms=_rounded(self.version_parse_ms),
            draft_parse_ms=_rounded(self.draft_parse_ms),
            payload_parse_ms=_rounded(self.payload_parse_ms),
            apply_ms=_rounded(self.apply_ms),
            outgoing_validate_ms=_rounded(self.outgoing_validate_ms),
            asset_check_ms=_rounded(self.asset_check_ms),
            serialize_ms=_rounded(self.serialize_ms),
            sql_ms=_rounded(self.sql_ms),
            response_build_ms=_rounded(self.response_build_ms),
            txn_ms=_rounded(self.txn_ms),
            request_ms=_rounded((perf_counter() - self.request_started_at) * 1000),
            body_bytes=self.body_bytes,
            request_bytes=self.request_bytes,
            response_bytes=self.response_bytes,
        )


_active_metrics: ContextVar[DocumentWriteMetrics | None] = ContextVar(
    "project_document_write_metrics",
    default=None,
)


@contextmanager
def active_write_metrics(metrics: DocumentWriteMetrics | None) -> Iterator[None]:
    token = _active_metrics.set(metrics)
    try:
        yield
    finally:
        _active_metrics.reset(token)


@contextmanager
def measure_outgoing_validation() -> Iterator[None]:
    metrics = _active_metrics.get()
    if metrics is None:
        yield
        return
    with metrics.measure("outgoing_validate_ms"):
        yield


def _rounded(value: float) -> float:
    return round(value, 3)
