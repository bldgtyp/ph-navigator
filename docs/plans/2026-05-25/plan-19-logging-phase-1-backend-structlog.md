---
DATE: 2026-05-25
TIME: planning (single-PR implementation phasing)
STATUS: Draft. Phase 1 of the logging rollout described in
        context/LOGGING.md. Subsequent phases (frontend logger +
        error boundary; optional Sentry; optional Log Stream drain)
        are scoped only at the end of this doc as forward pointers,
        not implemented here.
PARENT-DOC: context/LOGGING.md
RELATED:
  - context/TECH_STACK.md (logging row added 2026-05-25)
  - context/CODING_STANDARDS.md (logging-standard section added 2026-05-25)
  - context/ENVIRONMENT.md (LOG_* env keys, Render staging block)
  - backend/main.py
  - backend/config.py
  - backend/features/shared/middleware.py
  - backend/features/shared/errors.py
  - backend/features/project_document/store.py (existing
    `logging.getLogger(__name__)` — convert to structlog)
---

# Plan 19 — Logging Phase 1: backend `structlog` + request-scoped context

## 1. Goal

Land the backend half of `context/LOGGING.md` in a single reviewable
PR. After this lands:

- Every backend log line is JSON in staging/production and a
  human-readable console line locally.
- Every line emitted during a request carries `request_id`, `method`,
  `path`, `user_id` (when known), `environment`, and `git_sha`.
- The HTTP access log is one structured line per request, emitted
  from middleware. Uvicorn's default access log is silenced.
- 4xx and 5xx error envelopes are logged with the same `request_id`
  the client sees.

Out of scope: frontend logger, error boundary, Sentry, and Render Log
Stream drains. Tracked at §10.

## 2. Verification (write tests first where possible)

The PR is done when all of the following pass:

1. `cd backend && uv run ruff check .`
2. `cd backend && uv run ty check`
3. `cd backend && uv run pytest`
4. `make smoke` from repo root.
5. New unit tests under `backend/tests/test_logging.py` cover:
   - `configure_logging` produces JSON output when
     `log_format="json"`.
   - `configure_logging` produces console output when
     `log_format="console"`.
   - `configure_logging` is idempotent: calling it twice does not
     duplicate output, and pre-existing root handlers are cleared.
   - JSON output carries `logger=<module>` (proves `add_logger_name`
     is wired).
   - Redaction processor replaces sensitive-keyed values with `***`
     (`token`, `Authorization`, `password`, mixed case).
   - Size-cap processor truncates a 100 KiB string field to ≤ ~4 KiB
     and appends `...<trunc>`.
   - A log call inside a simulated request carries `request_id`,
     `method`, `path`, `client_ip` after middleware binds them.
   - Two concurrent simulated requests do not leak `user_id` between
     each other (contextvars isolation regression test).
   - `clear_contextvars` runs even when `call_next` raises.
   - `_accept_request_id` returns a fresh UUID for `None`, `""`, a
     65-char string, and a string containing `"\n"`; returns the
     input verbatim for a valid header.
   - `caplog` can assert on event names (e.g.
     `assert any(r.event == "project_document.saved" for r in caplog.records)`).
6. New integration test under `backend/tests/test_error_logging.py`:
   forcing a 422 and a 500 through the app yields log lines with
   `error_code` and the same `request_id` that the response envelope
   returns.
7. Manual check: `uv run uvicorn main:app --reload` locally produces
   colorized console lines on each request, including one
   `http.request` line per call.
8. Manual check: `LOG_FORMAT=json uv run uvicorn main:app` produces
   JSON lines parseable by `jq`.

## 3. File-by-file changes

### 3.1 `backend/pyproject.toml`

Add one runtime dependency. Use `uv add structlog` so `pyproject.toml`
and `uv.lock` move together.

```
structlog>=24.4
```

No `dependency-groups.dev` changes.

### 3.2 `backend/config.py` — new `Settings` fields

Add to `class Settings`:

```python
log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
log_format: Literal["json", "console"] = "console"
log_sql: bool = False
log_sample_health: bool = False
```

No other config plumbing changes — `environment` and `git_sha` are
already present and already read via env. Pydantic v2 BaseSettings
gives us `LOG_LEVEL` / `LOG_FORMAT` / `LOG_SQL` /
`LOG_SAMPLE_HEALTH` env reads for free.

### 3.3 `backend/logging_config.py` — new module

Single public function:

```python
def configure_logging(settings: Settings) -> None:
    """Configure root logger + structlog exactly once at startup.

    Idempotent — safe to call from app factory and tests.
    """
```

Responsibilities:

1. **Reset stdlib handlers before installing our own** —
   `logging.getLogger().handlers.clear()` and set a module-level
   sentinel (e.g. `_configured: bool`) that makes a second call
   into a no-op idempotently. Required for `uvicorn --reload` and for
   test fixtures that build the app more than once. Without this, log
   lines duplicate.
2. Decide renderer:
   - `"json"` → `structlog.processors.JSONRenderer()`
   - `"console"` → `structlog.dev.ConsoleRenderer(colors=True)`
3. Build the structlog processor chain (canonical order, mirrored in
   `context/LOGGING.md` §"Processor chain"):
   - `structlog.contextvars.merge_contextvars`
   - `structlog.stdlib.add_logger_name`  ← new: emits `logger` field
   - `structlog.processors.add_log_level`
   - `structlog.processors.TimeStamper(fmt="iso", utc=True)`
   - `structlog.processors.StackInfoRenderer()`
   - `structlog.processors.format_exc_info`
   - `_redact_sensitive` (custom, see below)
   - `_truncate_large_strings` (custom, see below)
   - selected renderer.
4. `structlog.configure(...)` with that chain,
   `wrapper_class=structlog.make_filtering_bound_logger(LEVEL)`,
   `cache_logger_on_first_use=True`.
5. Route stdlib `logging` through a single root `StreamHandler` whose
   formatter is `structlog.stdlib.ProcessorFormatter` so uvicorn,
   Alembic, and any third-party library log lines render in the same
   format as application code. `processor=` is the selected renderer;
   `foreign_pre_chain` mirrors items 3.2–3.8 above (everything except
   `merge_contextvars` and the renderer) so foreign records also get
   `logger`, redaction, and size-cap treatment.
6. Set per-logger levels and disable propagation so records flow
   through the root handler exactly once:
   - root → `settings.log_level`
   - `uvicorn.error` → INFO, `propagate=False`
   - `uvicorn.access` → WARNING, `propagate=False` (effectively
     silenced; replaced by the middleware's `http.request` line — use
     `propagate=False` rather than CRITICAL-as-silence so future
     uvicorn WARNINGs about access-log shape still surface)
   - `sqlalchemy.engine` → INFO if `settings.log_sql` else WARNING,
     `propagate=False`
   - `httpx` → WARNING
   - `botocore`, `boto3`, `urllib3` → WARNING
7. Bind global context once: `environment`, `git_sha`, `app_version`,
   and (when present) `instance_id` from `RENDER_INSTANCE_ID` or
   `socket.gethostname()` into a
   `structlog.contextvars.bind_contextvars(...)` call so that even
   non-request lines carry deploy identity.

### Custom processors

Two small processors live in the same module (kept private; tested in
isolation):

```python
_SENSITIVE_KEYS = frozenset({
    "password", "passwd", "secret", "token", "authorization",
    "cookie", "api_key", "bearer", "fernet_key", "client_secret",
    "private_key",
})
_MAX_STR = 4096

def _redact_sensitive(_logger, _method, event_dict):
    for key in list(event_dict):
        if key.lower() in _SENSITIVE_KEYS and event_dict[key] is not None:
            event_dict[key] = "***"
    return event_dict

def _truncate_large_strings(_logger, _method, event_dict):
    for key, value in event_dict.items():
        if isinstance(value, str) and len(value) > _MAX_STR:
            event_dict[key] = value[:_MAX_STR] + "...<trunc>"
    return event_dict
```

Rationale: defense in depth on top of the call-site convention. The
size cap is the day-1 cost-control mechanism — one accidental
`log.info("…", body=full_doc)` would otherwise blow up a single line
into MB and dominate Render log volume. Both processors run on
foreign (stdlib / library) records too via `foreign_pre_chain`.

Module size budget per `context/CODING_STANDARDS.md`: well under 200
lines. Keep helpers (`_build_processors`, `_apply_stdlib_levels`,
`_redact_sensitive`, `_truncate_large_strings`) private.

### 3.4 `backend/main.py`

Two changes:

1. Import and call `configure_logging(settings)` immediately after
   `from config import settings` and before `app = FastAPI(...)`.
2. No other changes — the middleware change carries the per-request
   work.

### 3.5 `backend/features/shared/middleware.py`

Extend `request_context_middleware`:

```python
import structlog
from time import perf_counter

log = structlog.get_logger(__name__)

_REQUEST_ID_MAX = 64

def _accept_request_id(raw: str | None) -> str:
    """Trust-bounded acceptance of an inbound X-Request-ID header.

    Defends against newline / control-character injection into JSON
    log lines via a client-controlled header, and bounds search-index
    pollution. Falls back to a fresh UUID4 on any deviation.
    """
    if not raw:
        return str(uuid4())
    if len(raw) > _REQUEST_ID_MAX or not raw.isprintable():
        return str(uuid4())
    return raw


def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",", 1)[0].strip() or None
    return request.client.host if request.client else None


async def request_context_middleware(request: Request, call_next: CallNext) -> Response:
    request_id = _accept_request_id(request.headers.get("X-Request-ID"))
    request.state.request_id = request_id

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,  # path only — never request.url or query
        client_ip=_client_ip(request),
    )

    start = perf_counter()
    status_code: int | None = None
    try:
        # existing origin-allowlist block stays as-is, but uses
        # `log.warning("api.origin_not_allowed", origin=origin)` before
        # returning the 403 response.
        ...
        response = await call_next(request)
        status_code = response.status_code
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception:
        status_code = 500
        log.exception("api.unhandled_exception")
        raise
    finally:
        duration_ms = round((perf_counter() - start) * 1000, 2)
        if _should_log_access(request.url.path):
            log.info(
                "http.request",
                status=status_code,
                duration_ms=duration_ms,
                request_bytes=_int_or_none(request.headers.get("content-length")),
                response_bytes=_int_or_none(
                    response.headers.get("content-length") if status_code and status_code < 500 else None
                ),
            )
        structlog.contextvars.clear_contextvars()
```

`_should_log_access(path)` returns `False` for `/health` and
`/api/v1/openapi.json` unless `settings.log_sample_health` is true.

`_int_or_none` parses a `Content-Length` header to `int`, returning
`None` on a missing, empty, or non-numeric value (chunked / streaming
responses set no `Content-Length`, in which case `response_bytes` is
`None` and the field is omitted from the log line by the JSON
renderer). Response bytes are only captured on non-5xx responses
because the error path returns from the `except` block before
`response` is bound.

Tests cover `_accept_request_id` (UUID fallback for empty, oversize,
and non-printable inputs; verbatim pass-through for a valid header),
`_client_ip` (X-Forwarded-For first hop wins; falls back to
`request.client.host`; returns `None` cleanly when neither is
available), and `_int_or_none` (digit string → int; `None`/`""`/
non-numeric → `None`).

Binding `user_id` here is awkward because auth resolves later in the
dependency chain. Use a small helper in `features/auth` that calls
`structlog.contextvars.bind_contextvars(user_id=...)` from the
session-loading dependency. The middleware does not need to know
about auth; it just needs to `clear_contextvars()` at the end.

### 3.6 `backend/features/shared/errors.py`

Add a module logger and log inside the two handlers:

```python
log = structlog.get_logger(__name__)

async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, HTTPException):
        raise exc

    # ...existing detail-unwrapping logic...

    level = log.warning if exc.status_code < 500 else log.error
    level(
        "api.http_error",
        status=exc.status_code,
        error_code=error_code,
        message=message,
    )
    return error_response(...)


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        raise exc

    log.warning(
        "api.validation_error",
        errors=jsonable_encoder(exc.errors()),
    )
    return error_response(...)
```

`request_id` is automatic — it is already bound on contextvars by the
middleware.

### 3.7 `backend/features/project_document/store.py`

Convert the one existing logger:

```python
- import logging
- logger = logging.getLogger(__name__)
+ import structlog
+ log = structlog.get_logger(__name__)
```

Convert the one existing `logger.warning(...)` call to a structured
event:

```python
log.warning("project_document.<descriptive_event>", ...kwargs)
```

(Read the current call site to pick the event name. The existing
warning is the only ad-hoc log line in the codebase per the audit
done while writing `context/LOGGING.md`.)

### 3.8 Tests

New files:

- `backend/tests/test_logging.py` — covers items 5.a–5.e from §2.
- `backend/tests/test_error_logging.py` — covers item 6 from §2,
  using `TestClient` with deliberately broken routes.

No existing test changes expected. `caplog` continues to work because
stdlib `logging` records are still emitted.

## 4. Render configuration (out of band — not a code change)

After the PR merges and deploys, in the Render dashboard for
`ph-navigator-v2-api-staging`:

1. Add env `LOG_FORMAT=json`.
2. Add env `LOG_LEVEL=INFO`.
3. Map `GIT_SHA` from `RENDER_GIT_COMMIT` (Render env-vars panel
   supports referencing built-in vars; otherwise set it in the start
   command as `GIT_SHA=$RENDER_GIT_COMMIT`).

Document the result in `context/ENVIRONMENT.md` Render staging block
(already updated in the same docs PR).

## 5. Backward compatibility

- The `X-Request-ID` request/response header contract is unchanged.
- The `ErrorEnvelope` JSON shape is unchanged.
- Local dev terminals look different (key=value vs current
  uvicorn-default access lines). This is the intended improvement.
- Test suites that asserted on uvicorn `access.log` text will need to
  switch to asserting on the new `http.request` event. A search of
  `backend/tests/` found no such assertions.

## 6. Risk + mitigations

| Risk | Mitigation |
|---|---|
| `structlog` swallows uvicorn's startup banner | `ProcessorFormatter` foreign-pre-chain preserves stdlib records; smoke-test by running uvicorn locally before merging. |
| Duplicate log lines under `uvicorn --reload` or repeated app construction in tests | `configure_logging` clears pre-existing root handlers and is gated by a `_configured` sentinel; unit test asserts a second call is a no-op. |
| Pre-existing per-logger handlers double-emit through the root | `propagate=False` on `uvicorn.error`, `uvicorn.access`, `sqlalchemy.engine`; one handler attached at root only. |
| `clear_contextvars` misses on early-return middleware paths | The middleware's `finally` block clears unconditionally. Tests cover both the success path and the exception path. |
| `user_id` binding leaks across requests | `clear_contextvars()` runs in `finally`, and contextvars are task-local anyway. Tested by issuing two parallel requests with different sessions and asserting no `user_id` leak in their log lines. |
| Client injects newline / control chars via `X-Request-ID` | `_accept_request_id` rejects non-printable or oversize headers and falls back to a fresh UUID. Tested explicitly. |
| Secret leaks into a log call via a kwarg name we didn't anticipate | Redaction processor covers the common allowlist; convention + review checklist in `context/LOGGING.md` are the primary control. Keep the allowlist co-located with the processor so reviewers can extend it. |
| One bad call dumps a multi-MB string into the log stream | Size-cap processor truncates string values >4 KiB. Unit-tested. |
| Driver exception text echoes user input into a log line (e.g. `UniqueViolation: Key (email)=…`) | Feature code logs `error_code` + entity IDs rather than re-raising driver exceptions into logs; `log.exception` reserved for unexpected errors. Size-cap + redaction processors apply to `exc_info` payloads as a backstop. |
| Duration measurement wrong on streaming responses | `perf_counter` is captured before `call_next`; `duration_ms` reflects header-write time. Acceptable for v1; revisit if/when we add long-running streams. |
| Render `RENDER_GIT_COMMIT` not exposed as expected | Fall back to leaving `git_sha=""` (the existing default); add a one-line README note in `backend/README.md` if the Render mapping needs a workaround. |

## 7. Module-size and standards compliance

- `backend/logging_config.py` < 200 lines.
- `backend/features/shared/middleware.py` grows by ~25 lines; stays
  well inside soft limits.
- `backend/features/shared/errors.py` grows by ~10 lines.
- No new external surface; no new routes; no schema changes.
- Strict typing preserved: all new functions have explicit signatures.

## 8. Rollout sequence

1. Add `structlog` via `uv add structlog`.
2. Write `backend/logging_config.py` + unit tests.
3. Add `Settings` fields.
4. Wire `configure_logging(settings)` in `backend/main.py`.
5. Extend middleware (per-request context + `http.request` line).
6. Add error-handler log lines.
7. Convert the one existing `project_document/store.py` logger.
8. Run `ruff`, `ty check`, `pytest`, `make smoke`.
9. Manually smoke `LOG_FORMAT=console` and `LOG_FORMAT=json` runs.
10. Open PR; in the description include a 5-line sample of both
    output formats so reviewers can see the result without running
    the app.

## 9. Follow-on phases (not implemented in this PR)

- **Phase 2 — frontend logger + error boundary.** Add
  `frontend/src/shared/lib/logger.ts` and integrate it into
  `shared/api/client.ts` (log on `!response.ok`). Add a top-level
  React error boundary that surfaces `request_id` to the user. See
  `context/LOGGING.md` §"Frontend Stack".
- **Phase 3 — auth-resolved `user_id` binding.** Wire
  `structlog.contextvars.bind_contextvars(user_id=...)` into the
  session-loading dependency once TB-01 auth lands or is updated.
- **Phase 4 (optional) — Render Log Stream drain.** Configure a drain
  to Better Stack / Logtail / Datadog once retention demands it. Pure
  Render-side config; no app code.
- **Phase 5 (optional) — Sentry browser SDK.** Add only when the user
  base grows beyond direct contact. The architecture already leaves
  the integration point in `app/providers.tsx`.

## 10. Open questions — resolved 2026-05-25

1. **`http.request` includes payload sizes — decided: include both.**
   The line now carries `request_bytes` and `response_bytes`, both
   sourced from the `Content-Length` header and both nullable
   (streaming / chunked / 5xx paths emit no value). Cheap to add, and
   the asymmetry of "response only" wasn't worth the cognitive cost.
2. **Access-log path filter location — decided: keep on `Settings`.**
   `Settings.log_sample_health` stays. Promote to a
   `LOGGING_DROP_PATHS` allowlist only if a second sampling decision
   ever arrives.
3. **Top-level FastAPI `Exception` handler — decided: do not add.**
   The middleware's `except Exception: log.exception(...)` already
   captures the line with the same `request_id` the client sees.
   Adding a second handler would double-log.
4. **Configurable redaction allowlist — decided: keep in code.**
   The allowlist lives next to the processor so reviewers see every
   change in the diff. If a new sensitive-kwarg name surfaces, prefer
   renaming the call site to a key the processor already covers
   rather than broadening the list.
