---
DATE: 2026-05-12
TIME: -
STATUS: CANONICAL PRD — current source of truth for PH-Navigator V2
        product direction and high-level architecture. Implementation
        contracts live in context/TECHNICAL_REQUIREMENTS.md and
        context/technical-requirements/ to keep startup context small.
AUTHOR: Ed May (with Claude)
SCOPE: Foundational product and architecture direction for PH-Navigator
       V2 — a JSON-document / file-format-style rewrite of the project
       layer, with the catalog remaining a relational starting library.
       Rebuild, not refactor.
RELATED: context/TECHNICAL_REQUIREMENTS.md,
         context/technical-requirements/data-model.md,
         context/technical-requirements/save-versioning.md,
         context/technical-requirements/api.md,
         context/technical-requirements/llm-mcp-schema.md,
         context/technical-requirements/frontend-viewer-units.md,
         context/technical-requirements/data-table.md,
         context/technical-requirements/stack-auth-migration.md,
         context/TECH_STACK.md, context/UI_UX.md, context/USER_STORIES.md,
         context/GLOSSARY.md,
         planning/archive/dated/2026-05-14/REMOVED.md (archived predecessor / removed-doc routing),
         research/poc-plans/2026-05-06-native-catalog-manager.md
         (catalog manager PRD — substantially reshaped by the bookshelf
         decision; superseded by this doc, kept as research record),
         research/poc-plans/poc-evaluation.md (catalog POC findings
         that informed the V2 direction)
---

# PH-Navigator V2 — Architecture PRD

## 1. Goal

Rebuild PH-Navigator's project layer around a **JSON-document data
model** with **versioned, immutable-by-discipline saves**. Move off
AirTable entirely; PHN owns all project data. Keep catalogs as a curated
**starting library** with explicit refresh semantics. Design every
surface (data model, API, docs, MCP) for both human and LLM use from
day one.

PH-Nav-V1 (the relational viewer-with-edits) continues to run unchanged
during V2 development. V2 is a parallel build, not a migration.

## 2. Why V2 (not V1.5)

V1's relational schema for project entities (assemblies, layers,
segments, apertures, frame/glazing types) is a legacy of its viewer
origins. The PHN-becomes-builder pivot demands:

- **Stable, immutable revisions** for certification submits and project
  close. The relational model has no native concept of this.
- **Catalog stability** for in-progress project models — vendor
  reformulations or library typo-fixes must not silently mutate
  project values.
- **A native file format** for future exchange with honeybee_ph, PHX,
  ph-dash, and Grasshopper. The relational model exports awkwardly;
  documents export trivially.
- **An LLM-amenable surface** so Ed can drive PHN from Claude (Code or
  Desktop) for bulk edits, queries, and reports. Documents + JSON
  Schema + MCP is the right substrate.

Adding versioning, document export, and an MCP layer on top of V1's
schema is achievable but accumulates duality (working tables vs. snapshot
payloads). V2 collapses the duality by making the document the source of
truth.

## 3. Non-goals (V2 v1)

- **Real-time multi-user editing** (CRDTs, presence cursors). Two-user
  team, sequential editing only. Optimistic concurrency with an "open
  elsewhere" advisory banner is sufficient.
- **Branching / merging** of project versions. Linear history.
- **Mobile / phone** optimization.
- **Public write API.** Editors are Ed and John; viewers are anyone with
  a link. No third-party write integrations in v1.
- **AirTable connectivity** at all. V2 has no AirTable surface. PH-Nav-V1
  remains for any continuing AirTable-backed workflow.
- **Cross-project queries** (e.g. "every project using Walltite ECO").
  Defer until needed; JSON documents make this a search-index problem
  later, not a JOIN problem.
- **Granular per-cell undo across sessions.** Frontend transient stack
  only. Versions are the cross-session recovery mechanism.
- **Live multi-tab editing** of the same version by the same user. A
  single tab is the editor; other tabs go read-only.
- **HBJSON authoring / editing** in PHN. The viewer is read-only. The
  3D modeling toolchain (Rhino + GH + honeybee_ph) stays external to
  PHN in V2. HBJSON upload is in scope (for the 3D viewer to render);
  HBJSON creation is not.
- **HBJSON-driven import into the builder tables.** Uploaded HBJSON
  files are **viewer-only** — they render in the Model tab (US-Viewer)
  but never write into `tables.assemblies`, `tables.project_materials`,
  `tables.rooms`, or any other builder table. PHN is the authoritative
  source for envelope / rooms / equipment data; the Rhino / Honeybee
  toolchain consumes PHN data downstream and produces HBJSON as
  output, not the other way around. Same logic for rooms (US-EQ-2)
  and assemblies (US-ENV-12). HBJSON construction *export* is in
  scope (US-ENV-12); HBJSON construction *import* is not.
- **Auto-derivation of HBJSON from builder data, or auto-derivation
  of builder data from HBJSON.** The two stay manually
  cross-referenced in V2 v1 (§11.4.6).
- **Equipment / appliance catalogs.** V2 v1 ships only the three
  envelope catalogs (Materials, Window-Frame Elements,
  Window-Glazing). The 9 deferred equipment catalogs (ERVs, Pumps,
  Fans, Appliances, Hot-Water Heaters, Hot-Water Tanks, Heat-Pumps,
  Direct-Elec Heaters, Boilers) are not in v1; full roster captured
  in §7.0 / US-2 for forward planning.

## 4. Users & access

**Access model (updated 2026-05-10):** project URLs are
**public-readable**. The same `/projects/{id}/...` routes resolve
for everyone — logged in or not. The project's UUID is effectively
the share token: share the URL with anyone (contractor, certifier,
client) and they can read the project. **No per-share tokens, no
`/v/{token}` routes, no revocation UI.** The frontend reads auth
state and gates edit affordances (toolbars, drag-drop zones, `⋯`
action menus, etc. hide when not logged in); the backend gates
writes behind the editor session token.

This matches V1's existing pattern (frontend/backend separation of
read vs write) and is much simpler than a per-share-token model.

**Decision confirmed 2026-05-11:** V2 v1 intentionally uses the
normal project URL as the public read route. There are no special
view-only URLs, no share-token rows, and no approval workflow for
viewing. Logged-in editor state only changes which controls and write
endpoints are available. This is an accepted product/security tradeoff:
project URLs should be treated as durable read-capability links, and
implementation must make write protection server-side, not merely a
frontend affordance.

- **Editors:** Ed May, John Mitchell. Authenticated users with edit
  rights on all projects. No per-project ACL in V2 v1 (two-person
  firm).
- **Project ownership** is a *dashboard-organization* concept, not an
  ACL. Each project has exactly one `owner_id` (Ed or John); the
  owner sees the project on their personal dashboard. Either editor
  can edit any project they can reach. Ownership is transferable
  (data model supports; transfer UI post-MVP).
- **Viewers:** anyone with a project URL. Read-only,
  no auth required. Can browse the project workspace (Status,
  Windows, Envelope, Equipment, Model tabs), browse versions,
  download project JSON, download table JSON, view uploaded
  HBJSON. **Cannot edit anything.** Edit affordances render hidden
  / disabled in the frontend; the backend rejects any write request
  without a valid editor session.
- **No anonymous editing.** Auth required for any write — REST,
  MCP, or otherwise.
- **No project-level permissions** beyond "editor / non-editor." A
  Viewer can reach every version of a project they
  have the URL for. Sensitive projects should not be created at all
  (or should be deleted) — there's no per-URL visibility gate.
- **Revocation model:** to "revoke access" to a project, the
  project must be soft-deleted (US-1.4). There's no per-share-link
  revocation because there are no per-share-links. This is a
  trust-based model appropriate for a two-person firm.

### 4.1 Forward-compatible access-check seam (architectural commitment)

Strict per-user ACL is **deferred** for V2 v1. To keep the future
retrofit cheap, V2 commits to the following from day 1:

- **Every project-scoped API route uses a single FastAPI dependency
  `require_project_access(project_id, mode='view'|'edit')`.** Today
  the dependency body has trivial behavior: `mode='view'` always
  passes (project URLs are public-readable per §4); `mode='edit'`
  requires a valid editor session token. It does not consult any
  per-project membership table.
- **The same dependency is used by REST routes and MCP tools.**
  Auth model stays uniform; there is one place where access policy
  lives.
- **Dashboard query is intentionally simple:**
  `WHERE owner_id = current_user.id AND deleted_at IS NULL`.
  Ownership is the dashboard filter, period.
- **Anti-patterns banned:** no inline
  `if user.id == project.owner_id` checks in routes; no project
  reads in handlers without going through the access seam.

If/when strict ACL ships:
- A `project_members` table is added (purely additive; no schema
  change to existing rows).
- The dependency body grows to consult `project_members` after the
  authentication check.
- The dashboard query grows a "shared with me" section.
- **Route signatures and call sites do not change.** The retrofit
  is one function and one query — not a sweep across every route.

This is a 10-line discipline that protects the architecture without
adding MVP cost. See US-1.5 for the user-facing framing.

## 5. Architecture overview

```
┌─────────────────────┐        ┌──────────────────────────────────┐
│  React frontend     │        │  FastAPI backend                  │
│  (TypeScript)       │ ──────▶│                                   │
│                     │        │  ┌────────────────────────────┐  │
│  - Editor UI        │        │  │ REST API                    │  │
│  - Catalog manager  │        │  │ + OpenAPI spec              │  │
│  - Version panel    │        │  │ + JSON Schemas              │  │
│  - Diff view        │        │  └────────────────────────────┘  │
│  - View-only mode   │        │                                   │
└─────────────────────┘        │  ┌────────────────────────────┐  │
                               │  │ MCP server (v1, read/write │  │
┌─────────────────────┐        │  │ project-scoped tokens)     │  │
│  LLM clients        │ ──────▶│  └────────────────────────────┘  │
│  (Claude Code/      │        └─────────────┬─────────────────────┘
│   Desktop, etc.)    │                      │
└─────────────────────┘                      │
                                ┌────────────┴──────────────────┐
                                │  Postgres (Render managed)     │
                                │  - thin relational metadata    │
                                │  - project_versions.body JSONB │
                                │  - catalog tables              │
                                └────────────────────────────────┘
                                              │
                                ┌─────────────┴──────────────────┐
                                │  Cloudflare R2 / object store  │
                                │  - photos, datasheets          │
                                │  - export downloads (cached)   │
                                └────────────────────────────────┘
```

Two storage classes:
- **Postgres** — all structured data. Project metadata is relational;
  project bodies are JSONB columns on `project_versions`. Catalog is
  fully relational.
- **Object storage (R2)** — photos, datasheets, future export artifacts.
  Referenced by URL from the project document.

Three API surfaces, all backed by the same FastAPI service:
- **REST API** for the frontend.
- **OpenAPI + JSON Schema** documents published at well-known endpoints.
- **MCP server** for LLM clients, wrapping the REST surface.

## 6. Data model

The project document is the source of truth for project-side Passive
House data. Postgres stores project metadata relationally and stores each
saved version body as validated JSONB on `project_versions.body`.
Catalogs remain relational because they are shared global libraries, not
project state.

Core commitments:

- `ProjectDocumentV1` is a Pydantic-validated JSON document with stable
  ULID-style IDs for document rows and nested entities.
- Project data is organized as tables: assemblies, project materials,
  window types, rooms, thermal bridges, equipment, manufacturer filters,
  and single-select option lists.
- Catalog picks are copied into the project document. `catalog_origin`
  records where a copied value came from, but projects never resolve
  catalog values live.
- Project material rows de-duplicate products inside a project so one
  datasheet/spec status can serve many assembly segments.
- Uploaded datasheets, photos, HBJSON files, and future simulation/export
  artifacts use one generic `project_assets` backbone. Project documents
  store asset IDs, not durable object URLs.
- MVP intentionally defers generated columns, GIN indexes, sidecar search
  tables, relational shadows of document tables, and cross-project
  reporting.

Implementation contract: `context/technical-requirements/data-model.md`.

### 6.1 Relational layer (thin)

PRD-level rule: relational tables hold users, sessions, project
metadata, project versions, status items, dashboard preferences, action
logs, MCP tokens, catalog tables, and asset metadata. They do not shadow
normal project-document tables. Detailed table sketches live in
`context/technical-requirements/data-model.md` §6.1.

### 6.2 Project document — JSONB shape

PRD-level rule: `ProjectDocumentV1` is the canonical model for saved
project data. Detailed JSON shape, stable-ID rules, single-select option
lifecycle, and history notes live in
`context/technical-requirements/data-model.md` §6.2.

### 6.3 Project-scoped non-catalog tables

PRD-level rule: rooms, fans, pumps, ERVs, thermal bridges, and similar
project-specific tables live inside the project document unless they are
explicitly platform metadata. Details live in
`context/technical-requirements/data-model.md` §6.3.

### 6.4 Query / index / reporting posture for MVP

PRD-level rule: MVP defers document-side query/index/reporting
infrastructure until measured project size or workflow pressure justifies
it. Details live in `context/technical-requirements/data-model.md` §6.4.

### 6.5 Asset backbone

PRD-level rule: all uploaded files use the generic `project_assets`
backbone. Domain surfaces attach metadata; they do not invent separate
object-key systems. Details live in
`context/technical-requirements/data-model.md` §6.5.

## 7. Catalog (bookshelf model)

The catalog is a curated starting library. V2 v1 ships three global
catalogs: Materials, Window-Frame Elements, and Window-Glazing. Future
equipment catalogs are planned but out of v1 scope.

When a user picks a catalog entry into a project, values are copied into
the project document. The project owns its copy from then on. Catalog
edits do not silently mutate in-progress project work. Refresh from
catalog is an explicit per-entry diff-and-choose workflow.

MVP keeps `catalog_schema_version: 1` as a future hook but does not ship
formal catalog-schema migration tooling.

Implementation contract: `context/technical-requirements/data-model.md`.

### 7.0 Catalog roster

V2 v1 ships Materials, Window-Frame Elements, and Window-Glazing. The
future catalog roster lives in
`context/technical-requirements/data-model.md` §7.0 and
`context/USER_STORIES.md` US-2.

### 7.1 Mental model

Catalog = starting library, not a live reference source. Details live in
`context/technical-requirements/data-model.md` §7.1.

### 7.2 Catalog has versions, projects don't reference them live

Catalog versions organize the library; picked values are copied into the
project. Details live in `context/technical-requirements/data-model.md`
§7.2.

### 7.3 Catalog UX

Catalog list/detail/edit/new-version/soft-delete behavior lives in
`context/technical-requirements/data-model.md` §7.3.

### 7.4 Refresh from catalog

Refresh is explicit, per-entry, and diff-driven. Details live in
`context/technical-requirements/data-model.md` §7.4.

### 7.5 Catalog-schema migration — post-MVP goal

Formal catalog-schema migration tooling is deferred from MVP. The future
hook and non-scope list live in `context/technical-requirements/data-model.md`
§7.5.

## 8. Save / version model

PHN uses a file-app style Save / Save As model.

- A project has named versions.
- The user opens one version at a time.
- Edits flow into an in-memory document and a server-side draft buffer.
- Draft sync is crash recovery, not persistence.
- **Save** overwrites the active unlocked version with the draft.
- **Save As** creates a new version from the draft and switches active.
- Locked versions reject Save and require Save As.
- Diff compares version-to-version or version-to-current-draft.
- ETags protect draft writes, Save, Save As, table replacement, browser
  tabs, and MCP/browser collisions.

Implementation contract: `context/technical-requirements/save-versioning.md`.

### 8.1 Mental model — explicit Save / Save As (file-app style)

The user edits a draft and explicitly saves it to a version. Details live
in `context/technical-requirements/save-versioning.md` §8.1.

### 8.2 Operations

Edit, Save, Save As, discard, switch active version, lock/unlock,
submit/close, delete, and rename semantics live in
`context/technical-requirements/save-versioning.md` §8.2.

### 8.2.1 Denormalized save metadata

The version-save service owns `projects.last_saved_at`,
`project_versions.body_size_bytes`, and related denormalized metadata.
Details live in `context/technical-requirements/save-versioning.md`
§8.2.1.

### 8.3 Server-side draft buffer (crash-recovery, not persistence)

Draft table shape, lazy draft creation, guarded JSON-Patch rules, and
stale-draft GC live in `context/technical-requirements/save-versioning.md`
§8.3.

### 8.4 Diff

Diff surfaces are version-vs-version and version-vs-current-draft.
Details live in `context/technical-requirements/save-versioning.md` §8.4.

### 8.5 Concurrency

ETag, same-editor tabs, MCP/browser collision, token revocation, locked
version, version-switch, and table-replacement rules live in
`context/technical-requirements/save-versioning.md` §8.5.

### 8.6 Draft / save acceptance tests

Backend acceptance-test requirements live in
`context/technical-requirements/save-versioning.md` §8.6.

## 9. API surface

FastAPI serves a versioned REST API under `/api/v1/...`; there are no
unversioned routes. OpenAPI is published per API version, while project
document schema versions are independent (`schema_version: 1`, etc.).

Primary endpoint groups:

- projects and project metadata;
- versions;
- document reads and table-slice reads;
- draft patch / replace / save / save-as / discard;
- diff;
- project and table downloads;
- catalog records and catalog versions;
- generic assets;
- HBJSON viewer metadata;
- JSON Schemas and OpenAPI.

Writes go through draft endpoints in the normal editor/API surface. The
saved version body changes only through draft Save / Save As or internal
admin/import services.

Implementation contract: `context/technical-requirements/api.md`.

### 9.1 API versioning policy (day 1)

All routes are versioned under `/api/v1/...`; details live in
`context/technical-requirements/api.md` §9.1.

### 9.2 Projects

Project route inventory lives in `context/technical-requirements/api.md`
§9.2.

### 9.3 Versions

Version route inventory lives in `context/technical-requirements/api.md`
§9.3.

### 9.4 Document body (the editing surface)

Saved document routes are read-only in the normal editor/API surface.
Details live in `context/technical-requirements/api.md` §9.4.

### 9.5 Drafts (autosave / crash recovery)

Draft route inventory, idempotency, and ETag rules live in
`context/technical-requirements/api.md` §9.5.

### 9.6 Diff

Diff route inventory lives in `context/technical-requirements/api.md`
§9.6.

### 9.7 Downloads

Project/table JSON download routes live in
`context/technical-requirements/api.md` §9.7.

### 9.8 Catalog

Catalog route inventory lives in `context/technical-requirements/api.md`
§9.8.

### 9.9 Public links

There are no public-link management routes. Normal project URLs are
public-readable. Details live in `context/technical-requirements/api.md`
§9.9.

### 9.10 Assets

Generic asset route inventory lives in `context/technical-requirements/api.md`
§9.10.

### 9.11 HBJSON files

HBJSON metadata route inventory lives in `context/technical-requirements/api.md`
§9.11.

### 9.12 Schemas

Schema and OpenAPI route inventory lives in
`context/technical-requirements/api.md` §9.12.

## 10. LLM-friendliness — designed in from day 1

V2 is designed so Claude clients can safely inspect, edit, diff, and
report on PHN data without reverse-engineering the app.

The substrate is:

- whole-document fetches;
- stable entity IDs;
- generated JSON Schema;
- guarded JSON-Patch writes;
- OpenAPI;
- structured errors;
- idempotency keys;
- hand-written context docs;
- a v1 MCP server.

MCP ships read/write capable in v1, but it is not anonymous. MCP clients
use project-scoped bearer tokens issued by logged-in editors, stored
hashed, revocable, scoped, and audit-logged. Catalog browsing is allowed
through MCP in v1; catalog writes are deferred.

Implementation contract: `context/technical-requirements/llm-mcp-schema.md`.

### 10.1 Why this matters

LLM-driven PHN workflows are first-class because Ed already uses Claude
for bulk edits, QA, and reporting. Details live in
`context/technical-requirements/llm-mcp-schema.md` §10.1.

### 10.2 What makes V2 LLM-friendly

The LLM-friendly design checklist lives in
`context/technical-requirements/llm-mcp-schema.md` §10.2.

### 10.3 MCP server

MCP auth, tool inventory, typed query object, structured errors, and
catalog-write deferral live in
`context/technical-requirements/llm-mcp-schema.md` §10.3.

### 10.4 Documentation `context/` (LLM-targeted)

Context routing rules live here and in `context/README.md`. The old
technical-doc inventory lives in
`context/technical-requirements/llm-mcp-schema.md` §10.4 for history.

### 10.5 Schema versioning — open-old-projects safety

Document schema-version guarantees, upgrade shims, safe-mode fallback,
golden fixtures, and corpus drills live in
`context/technical-requirements/llm-mcp-schema.md` §10.5.

## 11. Frontend

The frontend is TypeScript / React and is restricted to display and UI
workflow. Calculations and data manipulation live in the backend.

Top-level surfaces:

- editor dashboard (`/dashboard`);
- project workspace (`/projects/{id}/{tab}`) with Status, Windows,
  Envelope, Equipment, and Model tabs;
- project header with version dropdown, save state, Save / Save As,
  overflow menu, and IP/SI toggle;
- catalog manager (`/catalog/{slug}`);
- diff modal;
- the same project URLs in read-only Viewer mode for unauthenticated
  visitors.

The 3D Model tab is an HBJSON viewer, not an editor. HBJSON files are
uploaded project artifacts and remain deliberately disconnected from the
builder tables in V2 v1.

All physical quantities are stored, transmitted, and computed in SI.
IP/SI conversion is exclusively frontend display/input behavior.

Implementation contract: `context/technical-requirements/frontend-viewer-units.md`.

### 11.1 Top-level surfaces

Detailed app-surface inventory lives in
`context/technical-requirements/frontend-viewer-units.md` §11.1.

### 11.2 Editor state model — three layers

Document body, server-side draft, and in-memory document rules live in
`context/technical-requirements/frontend-viewer-units.md` §11.2.

### 11.3 Per-table display

Table display posture lives in
`context/technical-requirements/frontend-viewer-units.md` §11.3 and
`context/technical-requirements/data-table.md`.

### 11.4 3D viewer — React Three Fiber

HBJSON viewer workflow, storage, R3F rationale, V1 port notes, and
builder/viewer disconnect live in
`context/technical-requirements/frontend-viewer-units.md` §11.4.

#### 11.4.2 HBJSON file storage and data model

HBJSON files use `project_assets` plus `project_hbjson_files` metadata.
Details live in `context/technical-requirements/frontend-viewer-units.md`
§11.4.2.

#### 11.4.4 Why R3F (grounded in V1 review)

The R3F rationale and V1 comparison live in
`context/technical-requirements/frontend-viewer-units.md` §11.4.4.

#### 11.4.6 The deliberate disconnect from builder data

The viewer reads uploaded HBJSON files, not project document tables.
Details live in `context/technical-requirements/frontend-viewer-units.md`
§11.4.6.

### 11.5 Units architecture — backend is SI, frontend converts

SI storage/wire rules, frontend conversion rules, V1 references, and
anti-patterns live in
`context/technical-requirements/frontend-viewer-units.md` §11.5.

#### 11.5.3 Implementation notes

Frontend unit-helper strategy and V1 reference files live in
`context/technical-requirements/frontend-viewer-units.md` §11.5.3.

## 12. Stack & deployment

Current stack decisions:

- backend: Python 3.11, FastAPI, Pydantic v2;
- persistence: Postgres 16, Alembic, raw parameterized SQL through
  narrow repository modules, no SQLAlchemy ORM/Core in app code;
- object storage: Cloudflare R2;
- frontend: Vite, TypeScript, React 19, shadcn/ui, Tailwind, TanStack
  Query, TanStack Table, Zustand;
- 3D viewer: `three`, React Three Fiber, drei, postprocessing;
- hosting: Render.com backend service, managed Postgres, frontend static
  site;
- testing: pytest, Vitest, Playwright.

Implementation contract: `context/TECH_STACK.md` and
`context/technical-requirements/stack-auth-migration.md`.

### 12.1 Persistence pattern — raw SQL + Pydantic

Raw-SQL repository rules live in `context/TECH_STACK.md` and
`context/technical-requirements/stack-auth-migration.md` §12.1.

### 12.2 Folder / repo layout

Folder layout and repo-split notes live in
`context/technical-requirements/stack-auth-migration.md` §12.2.

## 13. Auth

V2 v1 has two access modes:

- browser editor sessions: email/password login, HTTP-only cookies,
  server-side sessions, 60-minute sliding expiration, single active
  session per user;
- MCP bearer tokens: project-scoped, issued by editors, stored hashed,
  scoped for project/assets read/write, revocable, and audit-logged.

Project URLs are public-readable. Viewers need no session and cannot
write. Every write path requires either a valid editor session or a valid
MCP token with the right scope.

Phase 0 security/ops baseline includes health/version routes, request
IDs, structured JSON logs, shared structured errors, idempotency-key
middleware, and auth/session migrations.

Implementation contract: `context/technical-requirements/stack-auth-migration.md`.

### 13.1 Phase 0 security / ops baseline

Security and ops scaffold requirements live in
`context/technical-requirements/stack-auth-migration.md` §13.1.

## 14. Migration from V1

V2 has no AirTable connection and no automatic production migration from
V1. PH-Nav-V1 stays running for active AirTable-backed projects. V2
imports are manual, per project, using one-shot scripts that read the V1
relational tree and write a V2 `ProjectDocumentV1` plus an initial saved
version.

V2 develops in parallel and does not share route compatibility with V1.
V1 is sunset only after live projects are intentionally migrated.

Implementation contract: `context/technical-requirements/stack-auth-migration.md`.

### 14.1 Import script — sketch

The V1 import-script sketch, including the steel-stud HBJSON delta note,
lives in `context/technical-requirements/stack-auth-migration.md` §14.1.

## 15. Risks

- **Single-document race conditions.** Mitigated by ETag concurrency
  (§8.5) and single-user expectation. Worth a stress test before v1.
- **Document size growth.** Ed's largest projects need profiling. If a
  project exceeds ~5 MB JSONB, draft-sync latency becomes noticeable.
  Mitigation: per-table draft replacement (§9.5), table-slice reads,
  and per-table draft scoping if needed in v1.1.
- **Schema migration discipline.** A bad `v1 → v2` shim corrupts every
  document on read. Mitigation: shims are pure functions, fully unit
  tested with golden files; CI fails if a shim's roundtrip is not
  idempotent on a corpus of real document fixtures.
- **LLM write safety.** MCP is intentionally read/write capable in v1,
  so token scope, audit logging, idempotency, and structured errors are
  part of the MVP, not hardening polish. Hold the tool surface to §10.3;
  add tools only when a concrete user task demands them.
- **Catalog drift confusion.** The bookshelf model is a deliberate UX
  choice, but it differs from architects' AirTable mental model
  ("change the catalog, every project sees it"). Refresh-from-catalog
  must be discoverable and the diff UI must be clear. Worth a UX pass
  with John before v1 ships.
- **Scope creep in v1 itself.** V2 has a large surface. Defer
  aggressively: catalog scope flags (project_scoped vs global),
  full diff UI polish, snapshot kind, MCP catalog writes — all
  v1.1 candidates if they look hairy.
- **No log surface in v1.** `user_action_log` lands in v1 (required
  for support troubleshooting per US-C1) but ships with no UI; Ed
  queries it by SQL. Risk: trivia like "did John make this change?"
  becomes a SQL task. Accept; v1.1 may add a per-project activity
  tab.

## 16. Success criteria (v1)

- Ed can create a new V2 project, add assemblies / window-types / rooms,
  pick materials / frames / glazings from the catalog, and save.
- Save (overwrite active version) and Save As (create new version)
  both work; old versions load identically to their save state and
  cannot be modified once locked.
- Browser-close warning fires when draft is dirty; reopening the
  project surfaces an unsaved-draft restore prompt.
- MVP recovery guarantee: project JSON download returns the raw saved
  body for the selected version even when the current app cannot
  validate that body as `ProjectDocumentV1`; typed editing may fail
  closed for invalid or unsupported document shapes. Full forward
  upgrade shims and "older documents load successfully" behavior are
  post-MVP schema-evolution hardening.
- All API routes are served under `/api/v1/`; OpenAPI is published at
  `/api/v1/openapi.json`.
- Diff between two versions returns correct structured deltas.
- Project JSON download returns the raw saved body for the selected
  version, including recovery downloads when the current app cannot
  validate that body as `ProjectDocumentV1`.
- Per-table JSON download returns a schema-validated keyed table slice
  (`{ "<table_name>": [...] }`).
- Non-logged-in visitor accessing a project URL sees the project,
  can switch versions, can download project / table / HBJSON JSON,
  and is blocked from all writes (frontend hides edit affordances;
  backend rejects write requests with 401).
- Claude Desktop can connect to the MCP server, list a project, fetch
  its document, run a JSON-Patch update against a token-scoped project,
  save the draft, and have the change appear in the editor on next
  reload.
- A user can upload an HBJSON file to a project, see it in the file
  list, and view it in the 3D viewer. Uploading a second HBJSON
  preserves the first; both are independently viewable.
- One V1 project successfully imported via the migration script and
  edited in V2.

## 17. Open questions

To resolve before implementation begins. None block this PRD's
acceptance, but each shapes a downstream decision:

1. ~~**Catalog scope flags** — does V2 v1 support the `global_with_
   project_overrides` or `project_scoped` catalog scopes from the
   2026-05-06 catalog PRD?~~ **Resolved 2026-05-10:** all catalogs
   are global + bookshelf, no per-project overrides at the catalog
   layer. Project-level overrides happen in the project document via
   the user editing copied values. Full roster of v1 + future
   catalogs in §7.0.
2. ~~**Asset deletion semantics** — when a photo is removed from a
   document, do we hard-delete the R2 object, or only the document
   pointer?~~ **Resolved 2026-05-11:** detach from the active draft
   first. The asset row remains available to older saved versions and
   other references. Hard purge is a 90-day GC path only after reference
   checks across saved versions and active drafts (§6.5).
3. ~~**MCP transport** — stdio only, HTTP/SSE only, or both?~~
   **Resolved 2026-05-12:** Streamable HTTP is mounted at `/mcp`, and
   stdio is available for local Claude Desktop / Code via
   `PHN_MCP_TOKEN`. Legacy SSE is deferred unless a concrete client
   requires it.
4. ~~**Public link granularity** — per-project link (sees all versions)
   vs. per-version link.~~ **Resolved 2026-05-11:** no separate
   public links exist. Normal `/projects/{id}/...` routes are public-readable.
   A public visitor who has the project URL can view the project.
5. **Diff UI scope in v1** — full visual side-by-side, or structured
   text "summary of changes" only? Lean: structured-text v1, visual
   side-by-side as v1.1.
6. **Editor session etag conflict UX** — on 409, force reload vs. show
   merge dialog. Lean: force reload (single-user expectation; merge
   dialog is real engineering).
7. ~~**Refresh-from-catalog UX** — per-entry only, or also a "refresh
   all" bulk action?~~ **Resolved 2026-05-11:** per-entry refresh only
   in v1. Review all opens the drift/customization report with
   per-entry actions; it does not auto-apply multiple entries.
8. **Project-versions name uniqueness** — enforce unique within a
    project (per the schema sketch) or allow duplicates? Lean:
    enforce; saves users from "which Round 1 Submit was the real
    one."
9. **Pre-save snapshot for one-click undo** — when Save overwrites a
    version, do we keep a transient "pre-Save" copy server-side for a
    short window (e.g. 1 hour) so the user can undo a regretted Save?
    Lean: defer to v1.1; lock + Save As is the pattern for
    high-stakes versions in v1.
10. **Draft GC age threshold** — drafts untouched for >30 days are
    deleted (§8.3). Confirm 30 days is reasonable; alert thresholds
    (e.g. "your draft is 14 days old — Save or discard?") tunable.
11. **Repo split: one repo or two?** §12.2 leans separate Git repos.
    Confirm before V2 scaffolding starts.
12. **HBJSON file size cap** — proposed 50 MB. Confirm against largest
    real Ed/John HBJSON exports. Multifamily projects could exceed
    this. Mitigations if needed: chunked / resumable upload (tus.io
    or signed-URL multipart), or simply raise the cap.
13. **HBJSON storage cost.** ~10 MB × ~10 files/project × ~50 projects
    = ~5 GB lifetime. Trivial on R2; track via `project_assets.size_bytes` for
    visibility.
14. **HBJSON ↔ project_version linkage** — the schema offers an
    optional `project_version_id` on `project_hbjson_files`. Should
    the upload UI strongly prompt for this (so cert submits get
    paired model + builder data), or leave it loose? Lean: prompt
    on upload but allow blank.
15. **HBJSON parsing in the browser** — at 5–20 MB JSON parse +
    geometry build, the viewer load may take seconds. Acceptable for
    v1 with a clear loading state; optimize (worker thread, server
    pre-extracted geometry) only if user feedback warrants.
16. ~~**Ownership semantics** (US-1 Q1).~~ **Resolved 2026-05-10:**
    ownership = dashboard-filter only. Strict ACL deferred. See §4.1
    for the forward-compatible access-check seam.
17. ~~**Forgot-password flow** (US-0 Q1).~~ **Resolved 2026-05-10:**
    admin reset only.
18. ~~**Session duration / concurrency** (US-0 Q2/Q3).~~
    **Resolved 2026-05-10:** 60-minute sliding expiration; single
    active session per user (most-recent-wins). See §13.
19. ~~**"Last modified" definition** (US-1 Q4).~~ **Resolved
    2026-05-10:** denormalized `projects.last_saved_at`, updated on
    every Save / Save As.
20. **V2 URL** — `ph-dash-frontend.onrender.com` is the existing
    PH-Dash URL, not PHN. Pick one for V2: staging on Render
    (`ph-navigator-v2.onrender.com`) → custom domain
    (`nav.bldgtyp.com` or similar) when ready. Lean: stage on
    Render, custom domain post-MVP.
21. **User-action-log retention** (US-C1) — keep forever vs. roll
    off. Lean: keep forever (volume trivial).
22. ~~**Project landing page layout** (US-3 Q1).~~ **Resolved
    2026-05-10:** tab bar — Status / Windows / Envelope / Equipment /
    Model. Status is the default landing tab. Versions are a header
    dropdown (US-3.1), not a tab. Settings live behind the header
    `⋯` overflow menu. New schema additions:
    `project_status_items`, `users.units_preference`. See §11.1.

## 18. Out-of-scope reminders (for visibility)

- Real-time collaboration, presence cursors, comment threads.
- Branching / merging versions.
- Cross-project queries / reports.
- Mobile UX.
- Public write API (third-party integrations).
- AirTable connectivity of any kind.
- LLM-driven catalog writes (read-only catalog through MCP for v1).
- Per-cell, cross-session undo.
- Automatic V1 → V2 migration in production. Manual per-project only.

## 19. Next steps

1. **Maintain the PRD / technical-requirements split.** Keep `PRD.md`
   concise for default startup context; update focused files under
   `context/technical-requirements/` when implementation contracts
   change.
2. **Split §17 open questions** into resolved, must-decide before
   implementation, and can-decide during feature work.
3. **Create a short MVP vertical-slice plan** before implementation
   phasing. It should sequence auth/dashboard/project create,
   `ProjectDocumentV1`, one editable table, draft/Save/Save As/lock,
   public read-only mode, JSON schema/download, and one catalog pick.
4. **Define `ProjectDocumentV1` Pydantic model** — the contract
   everything else hangs from. Ship with golden-file tests.
5. **Add generated schema docs and API/MCP docs as code lands.** Do not
   create empty context stubs that future agents have to load.
