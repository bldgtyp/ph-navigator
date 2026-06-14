# PH-Navigator V2 Tech Stack Decisions

DATE: 2026-05-10
TIME: 10:20 EDT

## Purpose

Record current technical-stack and code-style decisions for PH-Navigator V2, based on:

- `context/PRD.md`
- `context/TECHNICAL_REQUIREMENTS.md`
- `context/USER_STORIES.md`
- `context/technical-requirements/data-table.md` (catalog-POC outcome,
  current implementation contract)
- `research/v1-window-builder-reference.md`
- `context/UI_UX.md`
- `research/poc-plans/grid-spike-results.md` (TanStack vs AG Grid decision)
- `research/poc-plans/poc-lessons-for-real-build.md`
- BLDGTYP design system:
  <https://github.com/bldgtyp/branding> and
  <https://bldgtyp.github.io/branding/>
- Honeybee Schema Pydantic V2 migration commit: <https://github.com/ladybug-tools/honeybee-schema/commit/f1b6fdfa5750177f969a5b952e01560f3f9b4dd4>
- Michael Kennedy's Raw+DC article (reviewed 2026-05-11): <https://mkennedy.codes/posts/raw-dc-the-orm-pattern-of-2026/>

This is a decision note, not the full implementation plan.

## Current Lean

Use a boring, explicit stack:

| Layer | Decision |
|---|---|
| Backend language | Python 3.11+ |
| Backend framework | FastAPI |
| API / validation model | Pydantic v2 |
| DB | Postgres 16 |
| DB access | Raw parameterized SQL through narrow repository modules; no ORM entity layer |
| Migrations | Alembic retained for schema migrations |
| App document model | Pydantic-validated JSONB document versions |
| Frontend | Vite + TypeScript + React |
| UI kit | shadcn/ui + Tailwind, mapped to BLDGTYP CSS tokens where practical |
| Design tokens | BLDGTYP `tokens.css` / `tokens.json` |
| Server state | TanStack Query |
| Tables | TanStack Table v8 + `@tanstack/react-virtual` + shadcn-table primitives — see Table-View section below |
| Client/UI state | Zustand |
| 3D viewer | three + React Three Fiber + drei + react-three/postprocessing |
| Charts | recharts (declarative line/bar; Climate monthly graphs). Lazy-loaded with its tab so it stays out of the initial bundle. Sun-path diagrams are hand-rolled SVG, not recharts |
| Object storage | Cloudflare R2 |
| Quality gates | Ty + Ruff for backend static checks; pytest, Vitest, Playwright for tests |
| MCP auth | Project-scoped bearer tokens stored hashed in `mcp_tokens` |
| Logging | stdlib `logging` + `structlog`, JSON in prod / console in dev, stdout sink for Render — see `context/LOGGING.md` |

## Backend Decision

FastAPI still makes sense. Python is the practical backend language because PH-Navigator has to stay near the Ladybug / Honeybee / PHX ecosystem, and FastAPI gives us OpenAPI, dependency injection, typed request/response contracts, and clean integration with Pydantic v2.

Pydantic v2 should be the backend schema standard. Honeybee Schema has now moved to Pydantic v2 compatibility, so using v2 in PHN avoids a split-brain validation layer. New backend code should use v2 syntax only:

- `ConfigDict`, not inner `Config`
- `model_validate()`, `model_validate_json()`, and `model_dump()`
- `field_validator` / `model_validator`
- `Annotated[...]` constraints where useful
- explicit `None` unions for nullable fields

The strongest backend architecture is:

1. Routes parse and serialize typed request/response models.
2. Services enforce workflow rules.
3. Repository modules perform database reads/writes.
4. Pydantic models validate project documents, table slices, catalog records, and API payloads.
5. Alembic owns schema changes.

MCP is part of the v1 backend surface, not a later integration. It is
read/write capable from day 1, but it wraps the same services as REST.
Human browser writes use session cookies; MCP writes use project-scoped
bearer tokens with explicit scopes and audit logging.

## Persistence Decision

Decision confirmed 2026-05-11: drop the ORM entity layer for V2. Use
raw parameterized SQL through narrow repository modules, `psycopg` v3
for database access, and Pydantic v2 models as the typed boundary.

The V2 model is already not a classic ORM fit:

- project bodies are immutable, versioned JSONB documents;
- catalog values are copied into project documents rather than live-joined;
- most per-project tables are Pydantic tables inside `project_versions.body`;
- API/MCP/LLM usefulness depends on explicit schemas and predictable JSON, not object graphs.

Michael Kennedy's Raw+DC argument maps well to PHN, with one adaptation:
PHN should use **Raw SQL + Pydantic** rather than Raw SQL + dataclasses.
Pydantic already owns API payloads, JSON-document validation, table
slices, repository returns, and MCP results. Adding dataclasses would
create a second typed model layer without adding much value.

A raw-SQL repository layer fits this better than SQLAlchemy ORM entities. It keeps the persistence boundary visible and prevents a second domain model from competing with the Pydantic document model.

Recommended shape:

```text
backend/
  features/
    project/
      routes.py
      models.py
      service.py
      repository.py
      document/
        v1.py
    catalog/
      routes.py
      models.py
      service.py
      repository.py
  db/
    connection.py
    migrations/   # Alembic
```

Repository functions should accept primitive IDs / typed request objects and return Pydantic models or simple scalars. SQL must be parameterized. No f-string SQL with user input.

Example style:

```python
def get_project_version(conn: Connection, version_id: UUID) -> ProjectVersion:
    row = conn.execute(
        """
        SELECT id, project_id, version_number, body, locked_at
        FROM project_versions
        WHERE id = %(version_id)s
        """,
        {"version_id": version_id},
    ).fetchone()

    if row is None:
        raise ProjectVersionNotFound(version_id)

    return ProjectVersion.model_validate(dict(row))
```

Tradeoffs:

| Option | Strengths | Costs |
|---|---|---|
| SQLAlchemy ORM | Familiar in V1; relationships and updates are convenient for row-heavy domains | Adds a second domain model; obscures JSONB/document boundaries; more magic for LLM-assisted maintenance |
| SQLAlchemy Core | Good SQL builder; no entity layer; works with Alembic | Still adds SQLAlchemy concepts when plain SQL may be clearer |
| Raw SQL + Pydantic | Explicit; low dependency surface; AI-friendly; maps cleanly to document-version architecture | Requires discipline around row mapping, transaction helpers, and test coverage |

Decision: use plain string SQL in repository modules. Do not add
SQLAlchemy ORM models, SQLAlchemy Core query composition, or repository
abstractions that hide the SQL being run.

Backend feature code must follow `context/CODING_STANDARDS.md`: every
feature keeps predictable `routes.py`, `models.py`, `service.py`, and
`repository.py` layers; strict typing is required; modules are split
before they become too large to review.

Driver: `psycopg` v3 with `psycopg_pool`. V2 starts synchronous unless
load testing or long-running I/O proves async is necessary.

Alembic remains for migrations. Alembic may use SQLAlchemy internally,
but application code does not use SQLAlchemy ORM/Core for persistence.
Migrations are manual revisions; no autogenerate from ORM metadata.

## Frontend Decision

React still makes sense. The app is an editor/dashboard with complex tables, command-style modals, per-tab state, and a 3D model viewer. React has the best ecosystem fit for that combination.

TanStack choices are coherent:

- **TanStack Query** for server state, cache invalidation, mutation lifecycle, and stale/refetch behavior.
- **TanStack Table** for table logic without forcing a visual system.
- **shadcn-table primitives** for the actual UI so the tables match the rest of the app.

This is better aligned with V2 than keeping MUI X DataGrid or AG Grid. The tables are important, but PHN is not a spreadsheet product. We need controlled, typed table views per domain table, not a giant user-configurable grid engine.

Zustand is the right default for client/UI state:

- active version / active tab / viewer mode;
- window-builder selection state;
- dirty-state and queued JSON-Patch ops;
- R3F viewer UI state.

Use TanStack Query for server-owned state. Use Zustand for local interaction state. Avoid nested React context providers except for narrow UI composition cases.

### BLDGTYP design-system integration

V2 should use BLDGTYP's published design tokens as the visual source
where practical:

- `https://bldgtyp.github.io/branding/tokens/tokens.css` for CSS
  custom properties;
- `https://bldgtyp.github.io/branding/tokens/tokens.json` when build
  tooling or TypeScript needs machine-readable token values;
- `https://bldgtyp.github.io/branding/tokens/components.css` only as
  selective reference or direct reuse for generic primitives that do not
  conflict with shadcn/ui composition.

Implementation lean:

1. Load the required fonts once: Outfit and JetBrains Mono.
2. Load/import `tokens.css` before app styles.
3. Set `data-theme="light"` / `data-theme="dark"` on `<html>` for
   theme-aware BLDGTYP variables.
4. Map Tailwind/shadcn theme variables to BLDGTYP variables in the app
   stylesheet (`--background: var(--bg-page)`, etc.) rather than
   hard-coding a separate app palette.
5. Use PH-Navigator-specific components for workbench surfaces
   (builders, tables, viewer, evidence panels). Do not import the
   branding site's marketing/content components wholesale.

This keeps the implementation idiomatic to shadcn/Tailwind while
avoiding a second, app-only visual system.

## Table-View Decision

Validated by the catalog POC (week 0 → gate 2026-05-07). Current
implementation detail lives in
`context/technical-requirements/data-table.md`. Summary here:

**Pick: TanStack Table v8 (MIT, headless) + `@tanstack/react-virtual`
+ shadcn-table primitives.**

Why not AG Grid Community: row grouping, range selection, and set
filter (multi-select faceted filtering) are all Enterprise-only.
Per-developer licensing is incompatible with our cadence. Bundle
size is ~1.0–1.3 MB vs ~50–80 KB for TanStack + react-virtual.

Why not MUI X DataGrid: V1 used it; the POC replaced it. Pricing tier
splits hide the same parity features (range selection, grouping)
behind Pro/Premium. Visual idiom does not match shadcn/Tailwind.

Tradeoffs accepted (TanStack is headless):

- We own the markup, styling, a11y. Acceptable because schema-driven
  rendering needed full control anyway.
- More LOC inside `<DataTable>` than an AG Grid wrapper would have
  needed. Budget reflects this in the data-table extraction order.

Library pins:

| Package | Version | Notes |
|---|---|---|
| `@tanstack/react-table` | ^8.21 | Headless table core |
| `@tanstack/react-virtual` | latest 3.x | Row virtualization |
| `@dnd-kit/sortable` | post-extraction | Drag-reorder in popovers (filter/sort/group rows). Not gate-critical. |
| `floating-ui/react` | post-extraction | Popover positioning under sticky chrome / frozen columns. Native `position: absolute` is sufficient through gate. |
| `pdf.js` | TBD (week 5) | Inline preview for `attachment` field type on Frames table. |

Not added by default:

- **No clipboard package.** Native `copy` / `paste` events + a tested
  TSV parser/serializer cover paste / multi-cell copy / external
  paste into Excel/Numbers/Sheets/AirTable. Add a package only if
  collaborative paste or richer MIME forces it.
- **No drag-and-drop package for range selection / fill handle.**
  Document-level pointer tracking + `elementFromPoint()` + RAF
  auto-scroll, in one selection-controller hook with `select` and
  `fill` modes. Validated under virtualization in the POC.

Component contract — see
`context/technical-requirements/data-table.md`. Three architectural
pillars to inherit from the POC:

1. **One write primitive (`CellWrite[]` → `WriteOp`)** for inline
   edit, paste, fill, undo, row insert/delete, field-def mutations.
   Persistence is a transport swap, not a model rewrite.
2. **One typed field-definition registry** driving render / edit /
   coerce / sort / filter / aggregate per column type.
3. **Plain user-intent `ViewState`** (filter/sort/group/aggregations
   as user-intent lists). TanStack's `columnFilters` / `grouping` /
   `sorting` shapes are derived via `useMemo`; persistence
   serializes user intent, not TanStack internals.

## 3D Viewer Decision

R3F is a good fit for V2 because the viewer is read-only HBJSON visualization, not a geometry authoring environment.

Keep:

- `three` as the geometry/rendering base;
- V1 loader logic where portable;
- V1 color-by and legend concepts;
- V1 viewer modes where useful.

Change:

- host the scene in `<Canvas>`;
- move scene lifecycle into React components;
- use Zustand slices for viewer state;
- use drei for controls, bounds, outlines, gizmos, and common scene helpers.

The PRD's deliberate separation between project-document data and uploaded HBJSON should stay. Rhino + Grasshopper + honeybee_ph remain the geometry-authoring toolchain; PHN V2 displays uploaded model states alongside the tabular design data.

## Code Style

Backend:

- Keep calculations and document validation in the backend.
- Prefer small feature modules with `routes.py`, `models.py`, `service.py`, and `repository.py`.
- Use Pydantic v2 models as the explicit boundary for API payloads, document bodies, table slices, and repository returns.
- Keep SQL close to the repository function that owns it unless reuse becomes real.
- Use transactions around save/version/draft operations.
- Store all physical quantities in SI. Frontend handles IP display and input conversion.
- Write regression tests around schema migration, JSONB document validation, diff, save/version behavior, and catalog refresh.

Frontend:

- TypeScript strict mode.
- Feature-first folder layout.
- Components display and collect user intent; backend owns calculations and manipulation.
- TanStack Query owns server state.
- Zustand owns local interaction state.
- Column definitions are code-defined per table, not user-authored runtime schema.
- Keep unit conversion in focused frontend helpers with typed quantity names.
  Use V1 unit-converter/context and Window Builder dimension parser files
  as research templates; verify conversion factors before reuse.
- Prefer shadcn/ui primitives and lucide icons.

## Decisions Folded Back Into PRD / Scaffold

1. Replaced `SQLAlchemy + Alembic` in the PRD stack table with `raw SQL + psycopg + Alembic + Postgres`.
2. Added a backend persistence subsection explaining repository modules and Pydantic row/document boundaries.
3. Added `psycopg` v3 + `psycopg_pool` as the scaffold database driver.
4. Confirm React version during scaffold. React 19 is fine if the shadcn/R3F/TanStack combination is clean at install time; otherwise pin React 18 for compatibility.
5. Decide whether to generate TypeScript API types from OpenAPI early. Lean yes, but keep the generated client thin.

## Open Questions

1. Should the V2 repo enforce generated OpenAPI client/types in CI from day 1?
2. Should document/table Pydantic models live under `features/project/document/` only, or in a shared `schemas/` package consumed by REST and MCP?
