---
DATE: 2026-05-12
STATUS: CANONICAL ENGINEERING STANDARD
RELATED: context/ENVIRONMENT.md, context/TECH_STACK.md, context/LOGGING.md, backend/README.md, frontend/package.json
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
- Follow YAGNI principles, and one-liner solutions.

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
- Is the required boundary filename for feature DTOs. Do not add `schemas.py`
  aliases in feature packages; external schema mirrors may use a nested
  `schemas/` package when the imported domain naming is part of the contract.

`service.py`:

- Owns workflow and domain decisions: authorization-sensitive operations,
  transaction boundaries, conflict handling, audit logging, document-version
  rules, and orchestration across repositories.
- Raises structured API errors from `features.shared.errors`.
- Converts repository rows into Pydantic models at the service boundary.
- Translates domain/library exceptions into API-shaped errors at the boundary.
  This is the intended pattern for `mcp`, `climate`, and catalog import/export
  workflows, where lower-level helpers should stay HTTP-agnostic.

`repository.py`:

- Owns raw SQL only. SQL must be parameterized.
- Accepts a connection plus primitive IDs or typed request objects.
- Returns raw `dict[str, Any]` rows, row lists, simple scalars, or narrowly
  typed persistence results. Repository code does not instantiate API Pydantic
  response models; services validate returned rows before data crosses the
  service boundary.
- Does not import FastAPI request/response objects, set cookies, enforce
  workflow policy, or raise HTTP-shaped errors.

### Typing Standard

- Backend code is strictly typed. The active checker is `ty check`; tighten
  checker settings as `ty` exposes stable strictness controls.
- New public functions must have explicit argument and return types.
- Avoid `Any`; when unavoidable at a boundary, localize it and validate into a
  typed Pydantic model or narrow Python type quickly.
- Prefer precise domain aliases and enums where they reduce ambiguity
  (`AccessMode`, version kind, schema version, certification program).
- Avoid implicit `dict`/`list` contracts in service code. Use Pydantic models
  or typed helper return values once data leaves the repository layer.

### Module Size And Splitting

Soft limits:

- `300` lines: review whether the module still has one clear responsibility.
- `600` lines: split unless the file is mostly declarative schemas.
- `1000` lines: not acceptable for feature code without a written exception in
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

### Logging Standard

Use `structlog` with a module-level logger:
`log = structlog.get_logger(__name__)`. Event names are
`snake_case.dotted` (`project_document.saved`, `auth.session_created`)
so they aggregate cleanly in log search. Levels: INFO for significant
successes, WARNING for expected deviations, ERROR for 5xx and
unrecoverable failures. Never log document bodies, JSON-Patch payloads,
passwords, session-cookie values, MCP bearer tokens, or PII. Log
identifiers, not contents. `request_id` is bound automatically by
`request_context_middleware` — do not pass it manually. Full reference:
`context/LOGGING.md`.

## Mandatory Closeout Gate

Every code-changing session must end with the full repo gate before the work
is reported complete, committed, or opened as a PR:

```bash
make format
make ci
```

`make ci` is the local mirror of `.github/workflows/ci.yml`: backend locked
`uv` sync, Ruff format check, Ruff lint, Ty, Alembic migration, pytest;
frontend frozen `pnpm` install, Prettier check, ESLint, structural guards,
Vitest, and production build.

For simple frontend layout, CSS, typography, and component-positioning
iterations, `make frontend-dev-check` is the preferred fast feedback gate. It
runs frontend Prettier check, ESLint, structural guards, and the production
build without touching Postgres, Alembic, backend pytest, frozen install, or
the full Vitest suite. A narrower command is useful while iterating, but it
does not close a code change. If `make format` changes files, inspect the diff
and rerun `make ci`.

### Backend Controls

Useful focused backend checks while iterating:

```bash
cd backend
uv run ruff format --check .
uv run ruff check .
uv run ty check
uv run pytest
```

Repo-level aliases:

```bash
make check-backend
make ci
```

Current enforced controls live in `backend/pyproject.toml` and
`backend/scripts/check_backend_boundaries.py` (run as
`make check-backend`, part of `make ci-backend`/`make ci`):

- Ruff for import order and baseline linting.
- Static typechecking with `ty check`.
- Pytest with backend coverage reporting.
- **Feature-shape check:** every feature package has the required layer files
  (`routes.py`, `models.py`, `service.py`, `repository.py`) or an explicit
  documented exemption for declarative/schema-mirror packages; rejects
  feature-level `schemas.py` files.
- **Boundary check:** route modules do not import `database`; repository
  modules do not import FastAPI request/response types; raw SQL
  (`conn.execute`, cursors, `psycopg.sql`) appears only in `repository.py` or
  documented shared repository equivalents such as `catalogs/_shared.py` and
  `catalogs/_options_repository.py`. SAVEPOINT/ROLLBACK/RELEASE transaction
  control may remain in import/export services.

Near-term controls to add as the backend grows:

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
- Did the final closeout gate pass: `make format` followed by `make ci`?

## Frontend TypeScript

### Goals

- Make the React app predictable by feature area, not by file-growth history.
- Keep `App.tsx` and route files as composition surfaces, not feature
  containers.
- Keep server state in TanStack Query so loading, caching, invalidation,
  retries, and request deduplication are handled consistently.
- Keep component files small enough that UI, data hooks, types, and helpers can
  be reviewed independently.
- Preserve the backend/frontend boundary: backend owns calculations and data
  manipulation; frontend displays, collects user intent, manages UI state, and
  converts units for presentation/input.

### Required Frontend Shape

New frontend code should be organized by feature first:

```text
frontend/src/
  app/
    App.tsx              # providers and top-level app composition only
    router.tsx           # route tree and redirects
    providers.tsx        # QueryClientProvider, router wrappers, global providers
    query-client.ts      # TanStack Query defaults
  shared/
    api/
      client.ts          # fetch wrapper, request id, credentials, error envelope
      errors.ts
    ui/                  # reusable non-domain components
    lib/                 # generic helpers such as dates or formatting
  features/
    <feature>/
      api.ts             # endpoint functions for this feature
      hooks.ts           # TanStack Query hooks and mutations
      types.ts           # feature-local API/domain types
      routes/            # route-level page components
      components/        # presentational and workflow components
      stores/            # Zustand slices only when state crosses components
```

Small features still get this shape when they touch server state or route-level
UI. A feature may start with only `api.ts`, `hooks.ts`, `types.ts`, and one
route component, but it should not hide feature behavior in `App.tsx`.

Avoid generic catch-all folders such as `utils/` and `components/` at the app
root. Shared code belongs under `shared/` only when at least two features
actually use it.

Shared UI components should stay domain-neutral. App-shell components may
accept typed slots or children, but feature registries, route builders, and
menus such as Catalogs belong under the owning `features/<feature>/` package.

### App And Routing Boundaries

`App.tsx`:

- Wires app-wide providers and the top-level router.
- Does not fetch feature data, own forms, define feature tabs, or render full
  page bodies.
- Should stay small enough to understand the app shell at a glance.

`router.tsx` or route modules:

- Own URL patterns, redirects, route guards, and route-level lazy loading.
- May compose route pages from feature modules.
- Should not contain feature business logic, API payload shaping, or table
  column definitions.

Feature route components:

- Compose the page layout for a feature surface.
- Call feature hooks for server state.
- Pass typed data and event handlers into smaller components.
- Avoid defining nested components inline. Extract them to sibling files when
  they have their own state, markup branch, or test surface.

### Server State, UI State, And Effects

TanStack Query owns server state:

- session lookups;
- project lists and project details;
- document, draft, version, asset, and catalog loads;
- mutations such as sign-in, sign-out, project creation, draft patching,
  save, save-as, upload, and delete;
- cache invalidation after mutations.

Use feature hooks such as `useSessionQuery`, `useProjectsQuery`,
`useProjectQuery`, `useCreateProjectMutation`, and `useSignInMutation` rather
than hand-rolled `useEffect` / `useState` loading unions.

`useEffect` is for true side effects only:

- browser or third-party subscriptions;
- timers and debounced UI-only work;
- focus/scroll/measurement behavior;
- imperative viewer or DOM integration that cannot be expressed declaratively.

Do not use `useEffect` for ordinary content loading or API mutation lifecycle.
That belongs in TanStack Query. Debounced server validation should still be
wrapped by a query or mutation hook so cancellation, stale responses, and error
state are centralized.

Zustand owns cross-component client/UI state:

- active version and tab/workbench selection;
- dirty state and queued JSON-Patch operations;
- table view state that is user intent, not TanStack internal state;
- R3F viewer mode, selection, visibility, and color-by state.

Local `useState` is fine for narrow component-local state such as form fields,
open/closed modal state, transient input text, and hover/focus details.

### TypeScript And API Types

- TypeScript strict mode is required.
- Keep types close to the feature that owns them. Move to `shared/` only after
  real reuse exists.
- Do not let page components define API payload shapes inline.
- Prefer generated or mechanically verified API types once OpenAPI generation
  is adopted; until then, keep hand-written endpoint types in feature `types.ts`
  files and reconcile them with backend Pydantic models during API changes.
- Keep TanStack Query keys typed and colocated with feature hooks.
- Store physical quantities from the backend in SI. Unit conversion helpers
  live in focused frontend modules by quantity family.

### Component Size And Splitting

Soft limits:

- `200` lines: review whether a component file still has one responsibility.
- `300` lines: split route/page components into sections, forms, hooks, or
  helpers unless the file is mostly declarative table columns.
- `500` lines: not acceptable for feature UI without a written exception in the
  relevant plan/review doc.

Preferred split direction:

- Split route pages from presentational components.
- Split forms into a component plus a payload-building helper when submission
  logic grows.
- Split query/mutation hooks from route/page files.
- Split feature constants such as tab registries, route builders, and table
  column definitions into typed feature modules.
- Split expensive derived data into memoized helpers or hooks with primitive
  dependencies.

### DataTable Identity Convention

Every project DataTable follows one identity model (current clean baseline; full
contract in `context/technical-requirements/data-table.md` §
*Identifier Column* and `data-model.md` §6.6.10):

- The hidden `row.id` is the only enforced-unique identity. Never add a
  uniqueness constraint to a user-facing label, on the frontend or the
  backend.
- A new table's pinned identifier is its **descriptive name** field,
  labeled **"Display Name"**, flagged with `isIdentifier: true` on
  exactly one `DataTableColumnDef`. Do not pin by a hardcoded
  `record_id` field key.
- A short code, if any, is an ordinary, non-unique **"Tag"** column —
  not pinned, not constrained.
- Never label a column **"Name"** (ambiguous against Display Name) or
  **"Record-ID"** (collides with the hidden key). The lone exception is
  Rooms, where **Number** and **Name** are genuine input attributes that
  feed the `{Number} — {Name}` Display Name formula.
- Duplicate Display Names warn through the existing non-blocking chip;
  they never block a write.

### DataTable Rendering Convention

Every project DataTable field type renders through the shared
`shared/ui/data-table` cells and helpers:

- Use `SingleSelectCell` / `SingleSelectPopover` for single-select
  fields. Store and write option ids, not labels.
- Use `LinkedRecordCell`, `fields/linkedRecord/Picker`,
  `buildLinkedRecordOps`, `incomingLinkColumn`, and
  `incomingLinkFieldDef` for linked-record and inverse-link fields.
- Use `attachmentColumn` / `AttachmentCell` for attachment fields, and
  `identifierColumn` / `identifierColumnDef` for the one pinned
  identifier column.
- Do not reimplement per-table pills, selectors, attachment strips,
  identifier pinning, or linked-record display. Table adapters may
  supply target rows, labels, and feature-specific row-open behavior,
  but rendering stays in the shared DataTable layer.
- Synthetic read-only columns that are not persisted backend fields
  still need matching frontend `FieldDef` metadata when they rely on a
  shared renderer. Append them by missing `field_key`; never override
  persisted backend FieldDefs for real table columns.

### Frontend Controls

Useful focused frontend checks while iterating:

```bash
make frontend-dev-check
cd frontend && pnpm exec vitest run src/features/.../__tests__/name.test.tsx
```

Use the focused Vitest command when the change affects interaction, state,
TanStack Query behavior, parsers, data transforms, or adapters. Pure layout,
CSS, typography, and component-positioning changes usually only need
`make frontend-dev-check` during iteration.

Repo-level aliases:

```bash
make check-frontend
make ci
```

Current enforced controls live under `frontend/scripts/`, wired into
`check:all` (runs in `ci-frontend` and `make frontend-dev-check`):

- **Size check** (`check-file-sizes.mjs`, `pnpm check:sizes`) for
  route/component files using the limits above.
- **Boundary/shape check** (`check-feature-shape.mjs`, `pnpm check:shape`):
  `app/App.tsx` stays composition-only; feature packages follow the required
  layer shape.
- **Z-index check** (`check-z-index.mjs`, `pnpm check:z-index`): stacking
  order uses the shared z-index scale rather than ad hoc literals.
- **Hex-color check** (`check-hex.mjs`, `pnpm check:hex`): colors use the
  token system rather than raw hex literals.
- **CSS-vars check** (`check-css-vars.mjs`, `pnpm check:css-vars`): referenced
  CSS custom properties are actually defined in the token files.
- **DataTable convention check** (`check-data-table-contract.mjs`,
  `pnpm check:data-table`) — see the DataTable Rendering Convention section.

Near-term controls to add as the frontend grows:

- Query check: server data loading uses TanStack Query, not manual
  `useEffect` fetch blocks.
- Type check: API payload/response types live in feature `types.ts` or generated
  API type modules, not page components.

### Frontend Review Checklist

For every frontend feature or change:

- Is the code organized under the owning `features/<feature>/` package?
- Does `App.tsx` remain provider/router composition only?
- Does server data use TanStack Query hooks and mutations?
- Are `useEffect` blocks limited to true side effects?
- Is cross-component UI state in Zustand only when local state is insufficient?
- Are API types, route helpers, tab registries, and payload builders outside
  page component files?
- Are component files still small enough to review?
- Did the final closeout gate pass: `make format` followed by `make ci`?
