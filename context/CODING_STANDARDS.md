---
DATE: 2026-05-12
STATUS: CANONICAL ENGINEERING STANDARD
RELATED: context/ENVIRONMENT.md, context/TECH_STACK.md, backend/README.md
---

# PH-Navigator V2 Coding Standards

This file is the project-level engineering standard for new code. Keep
startup docs short and link here instead of duplicating these rules.

## Backend Python

### Goals

- Make every backend feature predictable to inspect, test, and extend.
- Keep business rules out of HTTP route handlers and raw SQL modules.
- Keep strict typing useful enough that agents and humans can trust local
  signatures without reading the whole call chain.
- Keep modules small enough that a feature can be reviewed in logical pieces.
- Document the reason for behavior, not the shape already expressed by types.

### Required Feature Shape

Every backend feature package must use the same default layers, regardless of
feature size:

```text
backend/features/<feature>/
  routes.py       # FastAPI route declarations and dependency wiring only
  models.py       # Pydantic schemas, enums, request/response DTOs
  service.py      # workflow rules, domain policy, transactions, orchestration
  repository.py   # raw parameterized SQL and row-returning persistence helpers
```

Small features still get the full layer set. Empty or thin modules are better
than feature-specific shortcuts because predictable boundaries matter more than
saving a few files.

Optional modules are allowed when they make a boundary clearer:

- `access.py` for authorization dependencies or permission checks.
- `validators.py` for reusable Pydantic/domain validation helpers.
- `mapping.py` for noisy row-to-model conversion or document-shape mapping.
- Focused service modules such as `sessions.py`, `documents.py`, or
  `audit.py` when a single `service.py` crosses the size limits below.

### Layer Responsibilities

`routes.py`:

- Defines `APIRouter`, route functions, FastAPI dependencies, status codes,
  and response models.
- Calls service functions and returns typed response models.
- Does not open database connections, run SQL, perform cross-row workflow
  policy, or build ad hoc response dictionaries.

`models.py`:

- Owns Pydantic v2 models, enums, `Literal` aliases, and request/response DTOs.
- Uses explicit field names matching the API contract.
- Keeps API-facing schemas separate from persistence row shapes when those
  shapes diverge.

`service.py`:

- Owns workflow and domain decisions: authorization-sensitive operations,
  transaction boundaries, conflict handling, audit logging, document-version
  rules, and orchestration across repositories.
- Raises structured API errors from `features.shared.errors`.
- Converts repository rows into Pydantic models at the service boundary.

`repository.py`:

- Owns raw SQL only. SQL must be parameterized.
- Accepts a connection plus primitive IDs or typed request objects.
- Returns rows, row lists, simple scalars, or narrowly typed persistence
  results.
- Does not import FastAPI request/response objects, set cookies, enforce
  workflow policy, or raise HTTP-shaped errors.

### Typing Standard

- Backend code is strict typed. `mypy strict = true` is the baseline, not an
  aspirational setting.
- New public functions must have explicit argument and return types.
- Avoid `Any`; when unavoidable at a boundary, localize it and validate into a
  typed Pydantic model or narrow Python type quickly.
- Prefer precise domain aliases and enums where they reduce ambiguity
  (`AccessMode`, version kind, schema version, certification program).
- Avoid implicit `dict`/`list` contracts in service code. Use Pydantic models
  or typed helper return values once data leaves the repository layer.

### Module Size And Splitting

Soft limits:

- `150` lines: review whether the module still has one clear responsibility.
- `200` lines: split unless the file is mostly declarative schemas.
- `300` lines: not acceptable for feature code without a written exception in
  the relevant plan/review doc.

Function limits:

- Route handlers should stay small: dependency unpacking plus one service call
  is the target.
- Service functions should usually fit on one screen. If a function needs
  multiple transaction phases, audit branches, or policy branches, split the
  named steps into helpers with their own tests.
- Repository functions should each express one SQL operation. Do not build a
  broad repository class or generic abstraction that hides the SQL being run.

Preferred split direction:

- Split by workflow first (`sessions`, `documents`, `versions`, `assets`).
- Split by policy boundary second (`access`, `audit`, `idempotency`).
- Do not split by arbitrary helper buckets such as `utils.py`.

### Documentation Standard

Docstrings are required for public functions, classes, and modules that encode
project behavior. The docstring should explain why the function exists or why a
rule is enforced. Type hints and names should already explain what the function
takes and returns.

Good docstrings explain:

- security policy, authorization assumptions, or session behavior;
- transaction boundaries and retry/conflict behavior;
- document-version invariants and schema-version rules;
- Passive House / PH-Navigator domain constraints;
- why a fallback or exception path is intentionally shaped a certain way.

Avoid docstrings that only restate the signature, such as "Create a project"
on a function named `create_project`.

Use short inline comments only where they prevent misreading a non-obvious
block. Do not narrate ordinary Python.

### Backend Controls

Required local checks before considering backend work complete:

```bash
cd backend
uv run ruff check .
uv run mypy .
uv run pytest
```

Repo-level equivalents may be used when available:

```bash
make lint
make typecheck
make test
```

Current enforced controls live in `backend/pyproject.toml`:

- Ruff for import order and baseline linting.
- Mypy strict mode.
- Pytest with backend coverage reporting.

Near-term controls to add as the backend grows:

- Feature-shape check: every feature package has the required layer files.
- Boundary check: route modules do not import `database`; repository modules
  do not import FastAPI request/response types.
- Size check: warn at the soft limits above and fail at the hard limit unless
  the exception is documented.
- Docstring check: require behavior-bearing public functions to document why.

### Review Checklist

For every backend feature or change:

- Does the package keep routes, models, services, and repositories separate?
- Are transaction and authorization decisions in services, not routes or SQL?
- Are API schemas Pydantic v2 models with precise field types?
- Does repository code use raw parameterized SQL only?
- Did rows get validated into typed models before leaving the service boundary?
- Are module/function sizes still reviewable?
- Do docstrings explain the important why behind policy, invariants, or
  non-obvious behavior?
- Did `ruff`, `mypy`, and `pytest` pass through `uv` or the Makefile?
