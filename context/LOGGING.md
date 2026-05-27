---
DATE: 2026-05-25
STATUS: CANONICAL ARCHITECTURE DECISION
RELATED:
  - context/README.md
  - context/TECH_STACK.md
  - context/ENVIRONMENT.md
  - context/CODING_STANDARDS.md
  - context/PRD.md
---

# PH-Navigator V2 Logging Architecture

This file is the canonical description of how PH-Navigator V2 emits,
shapes, and ships logs across the backend (FastAPI on Render), the
frontend (Vite/React static site on Render), and the Postgres database.
It is the reference for both dev-time feature work and production
troubleshooting.

Implementation phasing for the rollout lives in
`planning/archive/dated/2026-05-25/plan-19-logging-phase-1-backend-structlog.md`
and successor plans.

## Goals

1. **Dev-time signal.** A backend developer should be able to read the
   terminal during `make backend` and see, at a glance: what the server
   is doing, which request is in flight, and where it failed. Frontend
   developers should be able to follow per-feature events in the
   browser console with namespaces they can scope.
2. **Production troubleshooting.** Once deployed on Render, a problem
   reported by a user must be diagnosable from logs alone. Every API
   error surfaced to the UI exposes a `request_id`; pasting that into
   Render's log search must return every log line emitted while
   handling that request.
3. **Zero vendor lock-in.** Logs are plain JSON to stdout. Render
   captures stdout automatically; an optional Log Stream drain to
   Better Stack / Logtail / Datadog can be added later without code
   changes.
4. **One log pipeline.** Application code, uvicorn, Alembic, and any
   library logger all flow through the same formatter. No second log
   sink, no per-feature logging configuration.

## Non-Goals

- **No file-based logs.** Render's web-service disk is ephemeral.
- **No custom log transport in app code.** No HTTP POST loggers, no
  Sentry transport inside the FastAPI process. Use platform drains.
- **No personally identifiable information (PII) in log payloads.**
  Log `user_id`, never `email` or `display_name`. Never log password
  hashes, session-cookie values, MCP bearer tokens, or Fernet
  ciphertext.
- **No request-body logging.** Document bodies and JSON-Patch payloads
  may be large and may contain client-confidential PH model data.

## Backend Stack

| Layer | Choice |
|---|---|
| Library | stdlib `logging` + `structlog` |
| Format | JSON in `staging`/`production`; key=value console in `development`/`test`/`local` |
| Sink | stdout only (Render captures, drains optional) |
| Request correlation | `request_id` bound via `structlog.contextvars` from `request_context_middleware` |
| HTTP access log | One structured log line per request emitted from middleware. Uvicorn's `access` logger is silenced to avoid double-logging. |
| SQL log | `sqlalchemy.engine` at WARNING by default; INFO when `log_sql=true` (Alembic only — app code does not use SQLAlchemy ORM) |
| Error log | WARNING for 4xx, ERROR for 5xx, emitted from `features.shared.errors` exception handlers |

`structlog` is the only new runtime dependency. It wraps stdlib
`logging` and works with pytest's `caplog`. We deliberately do **not**
use `loguru` — it replaces stdlib's root logger in ways that fight
uvicorn and Alembic.

### Processor chain (canonical order)

`configure_logging` installs this chain on every record, in this order:

1. `structlog.contextvars.merge_contextvars` — pull request-scoped
   context (`request_id`, `method`, `path`, `user_id`, …) onto the
   record.
2. `structlog.stdlib.add_logger_name` — emit `logger` (e.g.
   `backend.features.project_document.store`) so log search can filter
   by feature module.
3. `structlog.processors.add_log_level`
4. `structlog.processors.TimeStamper(fmt="iso", utc=True)`
5. `structlog.processors.StackInfoRenderer()`
6. `structlog.processors.format_exc_info`
7. **Redaction processor** (custom, ~15 lines): walks the event dict and
   replaces values for known-sensitive keys with `"***"`. Keys are
   matched case-insensitively against a small allowlist:
   `password`, `passwd`, `secret`, `token`, `authorization`, `cookie`,
   `api_key`, `bearer`, `fernet_key`, `client_secret`, `private_key`.
   Defense in depth — the convention ("never log secrets") is the
   primary control; the processor catches the inevitable mistake.
8. **Field-size cap processor** (custom, ~10 lines): truncates any
   string value longer than 4 KiB to `value[:4096] + "...<trunc>"`.
   Prevents one accidental `log.info("…", body=full_doc)` from
   blowing up a log line, which is the single biggest cost driver on
   Render Log Streams and the most common pager-fatigue cause
   downstream.
9. Renderer — `JSONRenderer()` for `json`, `ConsoleRenderer(colors=True)`
   for `console`.

Stdlib log records (uvicorn, Alembic, third-party libraries) flow
through `structlog.stdlib.ProcessorFormatter` with the same renderer and
a `foreign_pre_chain` containing items 2–8 above so they get the same
redaction and size-cap treatment as application code.

### Stdlib handler hygiene

`configure_logging` is idempotent and **must clear pre-existing root
handlers** before installing its own (`logging.getLogger().handlers.clear()`),
otherwise `uvicorn --reload` and pytest fixtures produce duplicate
output. Per-logger `propagate=False` is set on `uvicorn.error`,
`uvicorn.access`, and `sqlalchemy.engine` so records flow through the
root handler exactly once.

## Backend Configuration

Logging is configured exactly once, at process start, from
`backend/logging_config.py`. `backend/main.py` calls
`configure_logging(settings)` before constructing the FastAPI app so
that the very first uvicorn/MCP startup line is already structured.

The following keys are added to `backend/config.py:Settings` (Pydantic
v2 — same `BaseSettings` block as the rest of the project):

| Field | Type | Default | Notes |
|---|---|---|---|
| `log_level` | `Literal["DEBUG","INFO","WARNING","ERROR"]` | `"INFO"` | App-code default level. |
| `log_format` | `Literal["json","console"]` | `"console"` | Render overrides to `json` via env var. |
| `log_sql` | `bool` | `False` | Turns up `sqlalchemy.engine` to INFO when chasing repository bugs. |
| `log_sample_health` | `bool` | `False` | Drops `/health` and `/api/v1/openapi.json` access lines unless enabled. |
| `git_sha` | (existing) | `""` | Already present; bound into every log record as `git_sha`. Render exposes `RENDER_GIT_COMMIT`. |

`environment` (already on `Settings`) is bound into every log record so
local `development` and Render `staging`/`production` are
distinguishable if logs are ever drained to one destination.

No other module reads `os.environ` for logging. Per the project
convention in `context/ENVIRONMENT.md`, every config value lives on
`Settings`.

## Backend Request Lifecycle

`features/shared/middleware.py` is the single source of truth for
per-request context binding. The current middleware already:

- generates or accepts `X-Request-ID`;
- sets `request.state.request_id`;
- echoes `X-Request-ID` on the response.

It is extended to also:

1. `structlog.contextvars.bind_contextvars(request_id, method, path,
   client_ip)` at the top of the request. `path` is `request.url.path`
   only — query strings are deliberately excluded (see Security rules
   below). `client_ip` is the first entry of `X-Forwarded-For` when
   present (Render terminates TLS) else `request.client.host`.
2. Bind `user_id` once auth resolves the session (from a downstream
   dependency or by reading `request.state.user_id` if the auth layer
   sets it).
3. After `call_next`, emit one structured access log line:
   `log.info("http.request", status=..., duration_ms=...,
   request_id=..., method=..., path=...)`.
4. `structlog.contextvars.clear_contextvars()` in a `finally` block.

#### `X-Request-ID` trust boundary

The header is accepted from clients so a frontend can correlate a fetch
with a backend log, but it is not trusted blindly. The middleware
validates an inbound `X-Request-ID` against a permissive shape check
(printable ASCII, length ≤ 64); anything else is replaced with a fresh
UUID4. This blocks newline / control-character injection into JSON log
lines via the header, and bounds the search-index pollution a hostile
client can cause.

Every log call inside the request — service, repository, exception
handler, MCP server, anywhere — inherits `request_id`, `method`,
`path`, `user_id`, `environment`, and `git_sha` automatically. This is
the single most useful property of the design.

## Backend Error Logging

`features/shared/errors.py` currently builds `ErrorEnvelope` JSON
responses silently. The HTTP and validation handlers are extended to
also emit a log line at the right severity:

- `http_exception_handler` → `log.warning("api.http_error", ...)` for
  4xx, `log.error("api.http_error", ...)` for 5xx. Always includes
  `error_code`, `status`, `request_id`.
- `validation_exception_handler` → `log.warning("api.validation_error",
  errors=...)` with the same `request_id`.
- Uncaught exceptions outside the explicit handlers are caught by a
  thin top-level `Exception` handler that logs at ERROR with
  `exc_info=True`, then re-raises into FastAPI's default 500 path.

The log lines carry the same `request_id` that the response envelope
returns to the browser. That is the contract that makes the
"paste-the-request-id" workflow work.

## Backend Convention For Feature Code

Per `context/CODING_STANDARDS.md`, every feature owns
`routes.py`/`models.py`/`service.py`/`repository.py`. Loggers live at
module top:

```python
import structlog

log = structlog.get_logger(__name__)

def save_project_document(...):
    log.info(
        "project_document.saved",
        project_id=project_id,
        version=version,
        bytes=len(body),
    )
```

**Event names are `snake_case.dotted`.** They become first-class facets
in log search — `project_document.saved`, `project_document.stale_fingerprint`,
`auth.session_created`, `mcp.token_revoked`. Do not use freeform
sentences as messages — they do not aggregate.

**Levels:**

| Level | Use For |
|---|---|
| DEBUG | Step-through traces only useful while building a feature. Off in prod. |
| INFO | Successful significant events — version saved, session created, project opened. |
| WARNING | Expected-but-noteworthy paths — stale fingerprint, validation 4xx, token reuse. |
| ERROR | 5xx, unhandled exceptions, data corruption discoveries. |

**What to log:**

- Workflow boundaries in `service.py` (save, version, delete, mutation
  accept/reject, MCP write).
- Authorization decisions in `access.py` (denied, granted-after-elevation).
- Repository errors that are not the happy path.
- Idempotency-key reuse and conflict resolution outcomes.

**What not to log:**

- Per-row reads on hot paths (table-view loads). Use a single
  summary line with a count.
- Document bodies, JSON-Patch ops, raw SQL parameters that include
  user content.
- Anything covered by the access log line emitted from middleware.

## Frontend Stack

Browser logging is intentionally minimal. The frontend is a static
site and the user-facing error path already includes a `request_id` to
correlate against the backend logs.

`frontend/src/shared/lib/logger.ts` exposes a tiny namespaced wrapper
over `console.*`:

```ts
const enabled =
  import.meta.env.DEV ||
  (typeof localStorage !== "undefined" &&
    localStorage.getItem("phn:debug") === "1");

export const log = {
  debug: (...args: unknown[]) => enabled && console.debug("[phn]", ...args),
  info:  (...args: unknown[]) => enabled && console.info("[phn]", ...args),
  warn:  (...args: unknown[]) => console.warn("[phn]", ...args),
  error: (...args: unknown[]) => console.error("[phn]", ...args),
};
```

- DEBUG/INFO are tree-shaken/no-op in production builds; `phn:debug`
  in `localStorage` re-enables them in deployed staging for live
  debugging.
- WARN/ERROR always fire — they are the breadcrumb trail an end user
  can screenshot and send.

`frontend/src/shared/api/client.ts` (the `fetchJson` wrapper) logs a
`warn` on every `!response.ok` carrying `{ status, path, request_id,
error_code }`. Paired with the backend `http.request` access line on
the same `request_id`, the browser and server tell the same story.

A top-level React error boundary (added with the rollout) renders a
fallback that shows the user the active `request_id` (when known) so
they can paste it into a bug report. There is no in-browser log buffer
and no automatic upload.

**Sentry browser SDK** is a deliberate future-only choice. It is
appropriate once the user base grows beyond direct contact, but adding
it now would create work without yet creating value. The architecture
leaves the door open: a Sentry init in `app/providers.tsx` will
intercept the same `console.error` and uncaught-exception paths that
already exist.

## Database

PHN V2 uses raw `psycopg` v3 (see `context/TECH_STACK.md`). The driver
does not log queries by default. Per-query logging belongs in the
repository layer when explicitly desired; do not enable global
`psycopg` debug logging in production.

Alembic uses SQLAlchemy internally for migrations. The `sqlalchemy.engine`
logger is left at WARNING in normal operation. Setting `log_sql=true`
(local only) raises it to INFO for migration debugging.

## Render.com Specifics

| Concern | Setting |
|---|---|
| Backend `LOG_FORMAT` | `json` in `ph-navigator-v2-api-staging` env (and any future prod). |
| Backend `LOG_LEVEL` | `INFO` default. Bump to `DEBUG` only for short investigation windows; revert after. |
| `GIT_SHA` | Map from Render's `RENDER_GIT_COMMIT` (already set by Render on every deploy). Bound into every log line so "did my fix ship?" is answerable from logs. |
| `ENVIRONMENT` | `staging` or `production`; already required by `Settings`. |
| Log search | Use Render's per-service log viewer. Filter by `request_id=...`, then by `event=...`. |
| Retention | Render's default window (currently ~7 days on the service tier in use — verify in the dashboard before relying on it for incident review). Add a Log Stream drain (Better Stack, Logtail, Datadog) when the retention window stops being enough. |
| Aggregator field-name compat | The renderer emits `event` / `level` / `timestamp`. Datadog, Better Stack, and Logtail handle these natively. If a future drain targets GCP Cloud Logging (which expects `severity`), add a rename processor at drain time — do not change the canonical field names here. |
| Instance identity | If/when Render scales the service past one instance, bind `instance_id` (from `RENDER_INSTANCE_ID` or `socket.gethostname()`) once at startup so cross-instance log search is possible. |
| Frontend | Static site — no server-side logs. Browser `console` only. |

Render-internal Postgres logs are visible in the Render dashboard for
the database service; PHN does not need a duplicate copy.

## Local Development

| Concern | Setting |
|---|---|
| `LOG_FORMAT` | `console` (default). Colorized key=value, human-readable. |
| `LOG_LEVEL` | `INFO` default; raise to `DEBUG` per terminal as needed: `LOG_LEVEL=DEBUG make backend`. |
| `LOG_SQL` | `false` default; toggle on while debugging a repository. |
| Tests | `caplog` already works because structlog flows through stdlib `logging`. Tests should assert on event names, not on free-text message strings. |

## Security And Privacy Rules

Logging is a write-only side channel that ends up in third-party
infrastructure (Render, eventually a log drain). The following rules
are non-negotiable:

1. Never log secrets — passwords, session-cookie values, MCP bearer
   tokens, Fernet keys, raw R2 credentials, OAuth client secrets. The
   redaction processor (see "Processor chain") is the safety net; the
   call-site convention is the primary control.
2. Never log full request bodies. Log a stable identifier (`project_id`,
   `version_id`, `record_id`) and a shape descriptor (`bytes`,
   `op_count`).
3. Log `user_id` (UUID), not `email` or `display_name`.
4. Log derived identifiers for MCP tokens (`token_id`, never the
   bearer secret).
5. When in doubt, log the ID and an event name; reconstruct the rest
   from the database.
6. **Never log query strings or request headers.** Bind `path`
   (`request.url.path`), not `request.url` or `str(request.url)`.
   Query strings routinely carry filter values, tokens, and emails;
   headers carry `Authorization`, `Cookie`, and `X-API-Key`.
7. **Exception messages are not safe by default.** Driver-level
   exceptions can echo input values into their message text (e.g.
   `psycopg.errors.UniqueViolation: detail: Key (email)=(alice@x.com)
   already exists.`). The redaction + size-cap processors apply to
   exception payloads as well, but feature code should still prefer
   `log.error("feature.failed", error_code="...", entity_id=...)` over
   re-raising the driver exception into a log line. Reserve
   `log.exception(...)` for genuinely unexpected errors caught at the
   middleware top level.

## Review Checklist

Before merging code that adds or changes logging:

- Is the logger module-local (`log = structlog.get_logger(__name__)`)?
- Are event names `snake_case.dotted` and aggregatable?
- Are levels right (INFO success, WARNING expected-deviation, ERROR
  unrecoverable)?
- Does the log line carry `request_id`-bearing context (automatic if
  the call sits inside a request)?
- Does the payload exclude bodies, secrets, query strings, headers,
  and PII per the rules above? (The redaction processor is a net, not
  a license — call sites are still responsible.)
- Are any new structured kwargs named to match the redaction allowlist
  if they hold sensitive values? (i.e. prefer `token_id=` over a key
  the processor cannot recognize.)
- For new exception paths: does the error handler log the failure with
  the same `request_id` that the user sees, and use a structured event
  name rather than re-raising a driver exception into the log line?
- For new feature code: did `ruff`, `ty check`, and `pytest` pass?
