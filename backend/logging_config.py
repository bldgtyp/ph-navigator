"""Process-wide logging configuration."""

from __future__ import annotations

import logging
import socket
import sys
from collections.abc import MutableMapping
from typing import Any, cast

import structlog
from structlog.stdlib import ProcessorFormatter

from config import Settings

_SENSITIVE_KEYS = frozenset(
    {
        "password",
        "passwd",
        "secret",
        "token",
        "authorization",
        "cookie",
        "api_key",
        "bearer",
        "fernet_key",
        "client_secret",
        "private_key",
    }
)
_MAX_STR = 4096
_configured = False
_global_context: dict[str, str] = {}


def configure_logging(settings: Settings) -> None:
    """Configure root logger and structlog once at process startup."""
    global _configured
    if _configured:
        return

    level = _log_level(settings.log_level)
    renderer = _renderer(settings.log_format)
    _set_global_context(settings)

    shared_processors = _shared_processors()
    structlog_processors = [
        structlog.contextvars.merge_contextvars,
        _add_global_context,
        *shared_processors,
        _wrap_for_formatter_with_record_attrs,
    ]
    foreign_pre_chain = [
        structlog.contextvars.merge_contextvars,
        _add_global_context,
        *shared_processors,
    ]

    formatter = ProcessorFormatter(
        processors=[
            ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
        foreign_pre_chain=foreign_pre_chain,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.setLevel(level)

    root = logging.getLogger()
    pytest_handlers = _pytest_handlers(root.handlers)
    root.handlers.clear()
    root.setLevel(level)
    root.addHandler(handler)
    for pytest_handler in pytest_handlers:
        root.addHandler(pytest_handler)

    structlog.configure(
        processors=cast(Any, structlog_processors),
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )
    _apply_stdlib_levels(settings)
    _configured = True


def _shared_processors() -> list[Any]:
    return [
        structlog.stdlib.add_logger_name,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        _redact_sensitive,
        _truncate_large_strings,
    ]


def _renderer(log_format: str) -> Any:
    if log_format == "json":
        return structlog.processors.JSONRenderer()
    return structlog.dev.ConsoleRenderer(colors=True)


def _log_level(log_level: str) -> int:
    return cast(int, getattr(logging, log_level))


def _set_global_context(settings: Settings) -> None:
    _global_context.clear()
    _global_context.update(
        {
            "environment": settings.environment,
            "git_sha": settings.git_sha,
            "app_version": settings.app_version,
            "instance_id": settings.render_instance_id or socket.gethostname(),
        }
    )


def _add_global_context(
    _logger: logging.Logger,
    _method: str,
    event_dict: MutableMapping[str, Any],
) -> MutableMapping[str, Any]:
    for key, value in _global_context.items():
        event_dict.setdefault(key, value)
    return event_dict


def _redact_sensitive(
    _logger: logging.Logger,
    _method: str,
    event_dict: MutableMapping[str, Any],
) -> MutableMapping[str, Any]:
    for key in list(event_dict):
        if key.lower() in _SENSITIVE_KEYS and event_dict[key] is not None:
            event_dict[key] = "***"
    return event_dict


def _truncate_large_strings(
    _logger: logging.Logger,
    _method: str,
    event_dict: MutableMapping[str, Any],
) -> MutableMapping[str, Any]:
    for key, value in event_dict.items():
        if isinstance(value, str) and len(value) > _MAX_STR:
            event_dict[key] = value[:_MAX_STR] + "...<trunc>"
    return event_dict


def _wrap_for_formatter_with_record_attrs(
    logger: logging.Logger,
    name: str,
    event_dict: dict[str, Any],
) -> tuple[tuple[dict[str, Any]], dict[str, dict[str, Any]]]:
    extra = {
        "_logger": logger,
        "_name": name,
        "event": event_dict.get("event"),
    }
    return (event_dict,), {"extra": extra}


def _apply_stdlib_levels(settings: Settings) -> None:
    root_level = _log_level(settings.log_level)
    logging.getLogger().setLevel(root_level)

    configured_levels = {
        "uvicorn.error": logging.INFO,
        "uvicorn.access": logging.WARNING,
        "sqlalchemy.engine": logging.INFO if settings.log_sql else logging.WARNING,
        "httpx": logging.WARNING,
        "botocore": logging.WARNING,
        "boto3": logging.WARNING,
        "urllib3": logging.WARNING,
    }
    for name, level in configured_levels.items():
        logger = logging.getLogger(name)
        logger.handlers.clear()
        logger.setLevel(level)
        logger.propagate = True


def _pytest_handlers(handlers: list[logging.Handler]) -> list[logging.Handler]:
    return [handler for handler in handlers if handler.__class__.__module__.startswith("_pytest.")]


def _reset_logging_for_tests() -> None:
    global _configured
    _configured = False
    _global_context.clear()
    structlog.reset_defaults()
    root = logging.getLogger()
    pytest_handlers = _pytest_handlers(root.handlers)
    root.handlers.clear()
    for pytest_handler in pytest_handlers:
        root.addHandler(pytest_handler)
