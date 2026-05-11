---
DATE: 2026-05-11
TIME: -
STATUS: Draft review
AUTHOR: Codex
SCOPE: Critique of PH-Navigator V2 architecture PRD, tech-stack note, UX plan, table-view plan, user stories, and scaffold alignment before feature implementation.
RELATED:
  - docs/plans/architecture-prd.md
  - docs/plans/tech-stack.md
  - docs/plans/user-stories.md
  - docs/plans/ui-ux.md
  - docs/plans/table-view.md
---

# PH-Navigator V2 Architecture Planning Review

## Executive read

The high-level architecture is coherent: a project-document source of truth, explicit Save / Save As, relational catalog bookshelf, and R2-backed assets all fit the BLDGTYP workflow better than extending V1's relational project model.

The main risk before implementation is planning drift. Several major decisions were made late in the PRD process but are not consistently folded through the UX doc, tech-stack doc, README, scaffold, and user stories. Those inconsistencies are not cosmetic; they touch auth, public access, MCP security, persistence boundaries, and implementation sequencing.

Do not start feature implementation until the decision seams below are resolved or intentionally parked.

## Findings

### F1. Public-readable project UUIDs are the largest security/product decision, and the plan under-specifies its consequences.

PRD §4 makes every `/projects/{id}/...` route public-readable and treats the UUID as the share token. Non-logged-in viewers can browse all versions and download project JSON, table JSON, and HBJSON. Revocation requires soft-deleting the project.

This is simple and internally consistent, but it is not a small access-model choice. It means any forwarded URL, browser-history leak, analytics/referrer leak, screenshot, email thread, or copied certifier link grants indefinite read access until the project is deleted. Because project JSON includes certification-relevant data and object references, this should be treated as a deliberate business/security acceptance, not just a convenience inherited from V1.

Missing decisions:
- Whether public viewers may download the full project JSON, not just browse rendered pages.
- Whether public viewers may download HBJSON and signed asset URLs.
- Whether project UUIDs are sufficiently unguessable and never exposed in third-party referrers.
- Whether "soft-delete to revoke" is acceptable for active projects where the team still needs the data.
- Whether a later ACL retrofit can preserve public project URLs without breaking old links.

Recommendation: either confirm this as an explicit v1 risk acceptance with a short threat model, or restore revocable share tokens before implementation. If keeping public UUID access, add tests that all write routes require auth and that read routes never expose editor-only metadata or durable asset URLs.

### F2. Public-view routing is inconsistent across docs.

The PRD says there are no `/v/{token}` routes and public viewers use the same `/projects/{id}/...` shape. The UX doc still defines a `Public viewer (/v/{token})` page and describes a separate minimal header. The stack table also mentions "opaque tokens for viewer links."

This will produce the wrong routes, wrong auth middleware, and wrong UI shell if not reconciled.

Recommendation: make one source of truth. Either:
- same-route public mode: `/projects/{id}/{tab}` with auth-sensitive chrome, or
- separate revocable share-link mode: `/v/{token}` with a view-link table.

Do not keep both in planning prose.

### F3. Persistence stack is unresolved between SQLAlchemy ORM scaffold and raw-SQL decision.

The tech-stack note chooses raw parameterized SQL through repository modules and explicitly says no ORM entity layer. The architecture PRD stack table still says `SQLAlchemy + Alembic`, the README says `backend/` contains SQLAlchemy models, and the scaffold has `database.py` defining a SQLAlchemy `DeclarativeBase` and `SessionLocal`.

This matters because the first backend feature will establish the persistence style. If both paths remain, feature code will drift into mixed ORM/raw SQL patterns.

Recommendation: resolve this before the first migration. If raw SQL is the decision:
- keep SQLAlchemy only if Alembic needs it, or use Alembic with explicit SQL migrations and a `psycopg` pool;
- remove `DeclarativeBase` language from docs/scaffold or mark it migration-only;
- add repository conventions: transaction boundary, row mapping helper, JSONB validation point, error mapping, and test pattern.

### F4. MCP auth and LLM asset APIs are contradictory.

PRD §10.3 says the v1 MCP server ships and uses "Bearer token from PHN editor session." PRD §13 says MCP uses a long-lived API key, stored hashed in `mcp_tokens`, with the table TBD. User stories later mark LLM-friendly asset upload/download as post-parity but "core workflow," with open questions about bearer-token scope.

This is a security-sensitive ambiguity. Long-lived tokens, session cookies, project-scoped service tokens, and MCP stdio credentials have different threat models.

Recommendation: split the decision:
- v1 human editor auth: session cookie only.
- v1 MCP auth: either deferred entirely, or implemented with a minimal `mcp_tokens` table from day 1.
- asset upload/download API: design endpoint shape now, but decide whether write-capable service tokens are v1 or v1.1.

If MCP ships in v1, define token scope, expiration, rotation, audit events, and whether public-readable projects are visible to unauthenticated MCP callers. Do not leave the token table TBD while claiming MCP is a v1 success criterion.

### F5. Server-side drafts need a sharper conflict and data-loss model.

The Save model is strong, but draft semantics have several unresolved edge cases:
- one draft per `(version_id, user_id)` conflicts with "single active session per user" and "second tab read-only unless takeover";
- session expiry retries unsynced patch queues after re-auth, but it is unclear what happens if the version changed during the expired interval;
- table-view undo conflict semantics are still open;
- a `PUT /document` whole-body Save exists alongside draft-save, which may bypass draft conflict checks unless tightly constrained;
- the plan does not define JSON-Patch validation against stable IDs versus array indices.

Recommendation: before feature code, write a draft/save state-machine decision doc with exact transitions for: first open, second tab, takeover, session expiry, 409 on draft patch, 409 on Save, Save As from stale draft, locked-version Save, and unsynced queue retry. JSON-Patch should be constrained to stable-ID addressed operations where possible, or array-index patch fragility needs explicit mitigation.

### F6. Document JSONB is the right source of truth, but query/index/reporting needs are deferred too broadly.

The PRD defers cross-project queries and keeps project-scoped tables entirely inside JSONB. That is reasonable for MVP, but several v1 surfaces already need query-like behavior: dashboard last modified, status state, catalog drift report, diff summaries, asset usage/orphan detection, public downloads, and possibly certifier-facing QA reports.

Missing planning:
- Which JSONB fields need generated columns, GIN indexes, or sidecar search/index tables.
- How catalog drift is computed efficiently across all copied entries in a project.
- Whether large table slices should be fetched independently rather than reading the whole document on every tab.
- What "largest realistic project" means for rows, assemblies, photos, HBJSON count, and JSONB size.

Recommendation: add a performance budget and fixture-sizing plan before implementation. Create synthetic small / typical / large project documents and measure: fetch, Pydantic validation, draft patch, Save, diff, table-slice read, and JSON download.

### F7. Catalog schema migration commitment is stronger than the initial catalog scope can support unless it gets its own implementation lane.

The PRD makes catalog-schema migration a non-negotiable v1 commitment with shim chains, golden fixtures, production-corpus drills, and renamed-field diff behavior. That discipline is good, but it is a full subsystem. It may be overbuilt relative to three v1 catalogs unless implemented as a narrow foundation.

Recommendation: keep the commitment but define the smallest shippable skeleton:
- `catalog_schema_version` stored at pick time;
- one no-op v1 shim harness;
- golden fixtures for each v1 catalog;
- refresh diff metadata shape that can express renamed/added/removed fields later.

Defer production-corpus CI drills until there is a real schema bump, unless staging snapshots are already in place.

### F8. Asset model is scattered across material assets, HBJSON-specific routes, and future generic asset APIs.

Architecture references `material_assets`, HBJSON-specific tables/routes, project JSON asset IDs, signed R2 URLs, orphan GC, and future generic `/assets` endpoints. The story stub correctly identifies a need for consistent LLM-callable asset APIs, but it is post-parity while the MVP already depends on datasheets, site photos, thermal-bridge files, and HBJSON uploads.

Recommendation: define one asset backbone before implementing any specific asset feature:
- generic `project_assets` table with `asset_kind`, `file_key`, `content_hash`, size, MIME, uploaded_by, deleted_at;
- usage references in project documents by asset ID;
- HBJSON metadata as either an asset subtype table or typed metadata row;
- signed upload/download policy;
- orphan detection across all project versions and drafts;
- R2 lifecycle/GC job behavior.

This will avoid four nearly-identical upload/download paths.

### F9. UX plan is rich but does not yet establish the first vertical slice.

The user stories are comprehensive, but the current plan reads as a complete product inventory rather than an implementation roadmap. Many story clusters are deeply drafted while foundational flows still have open questions.

Recommended first vertical slice:
1. Auth + dashboard + create project.
2. `ProjectDocumentV1` with one minimal editable table, not all domains.
3. Open project, edit draft, Save, Save As, lock, reload old version.
4. Public read-only view for that same project route.
5. JSON schema endpoint + download.
6. One catalog pick into the document and no-op refresh-from-catalog.

Do not start with Windows or Envelope canvas. They are valuable but depend on the save/draft/catalog/document substrate.

### F10. Frontend a11y and keyboard burden is larger than the table POC suggests.

The table-view plan acknowledges a11y hardening after extraction. For PHN, tables are not decorative; they are the main editing surface. Clipboard, fill, virtualized rows, roving focus, frozen columns, popovers, range selection, and read-only mode are all keyboard/screen-reader risk points.

Recommendation: move table accessibility from "post-extraction hardening" to an explicit acceptance gate for the shared DataTable. At minimum, validate VoiceOver on macOS, keyboard-only edit/copy/paste, focus restoration after modal close, and read-only public mode.

### F11. Units architecture is directionally right, but frontend-only conversion needs a domain quantity registry.

SI-only backend is correct. The missing piece is a typed quantity registry that binds each field to:
- canonical SI unit;
- display unit(s);
- parser/formatter;
- precision;
- physical bounds;
- nullable/zero semantics;
- PH-specific labels such as U-value, R-value, psi-value, SHGC, ACH50, iCFA.

Recommendation: decide this before building DataTable number cells. Otherwise unit conversion will spread across cell renderers, forms, canvas labels, and downloads.

### F12. Operational planning is thin: backups, restore, observability, seed data, and CI gates are not yet concrete.

The docs mention Render, Postgres, R2, action logs, migrations, and tests, but do not yet define operational basics:
- database backup/restore drill;
- R2 backup or retention policy;
- environment separation: local, staging, production;
- seed users and seed catalogs;
- secret management;
- rate limits for login, public reads, uploads, and MCP/API tokens;
- structured logging and error reporting;
- migration rollback policy;
- deployment smoke tests;
- fixture corpus ownership.

Recommendation: add an ops-readiness plan before first deploy. This can be short, but it should be explicit.

## Security items to decide before implementation

- Public project UUID access: accepted risk or switch to revocable links.
- CSRF protection for session-cookie write routes. SameSite=Lax helps but is not a full write-route CSRF strategy.
- Password hashing choice and parameters. `passlib[bcrypt]` is scaffolded, but the policy is not written.
- Login rate limiting and failed-login audit behavior.
- CORS policy for Render frontend/backend split.
- Signed URL TTLs and whether public viewers get asset download URLs.
- Upload validation: MIME sniffing, extension checks, size caps, malware scanning stance, and content-disposition safety.
- Token model for MCP and future LLM uploads: scope, expiry, rotation, revocation, audit logging.
- Whether action logs can contain PII or secret-ish metadata and how long they are retained.

## Performance items to validate early

- Largest real HBJSON file size from V1 projects, not guessed 50 MB.
- Browser JSON parse and R3F geometry build time for large HBJSON.
- Pydantic validation time for typical and large `ProjectDocumentV1`.
- JSON-Patch apply time for paste/fill operations over hundreds of rows.
- Diff time for two large versions.
- Whole-document GET versus table-slice GET latency.
- R2 signed URL generation and direct-download behavior for public viewers.
- Frontend bundle size with shadcn, TanStack Table, R3F, drei, postprocessing, and viewer loaders.

## Plan composition issues

- The architecture PRD should be the source of truth, but late decisions are not folded back consistently.
- The open-question list includes resolved items and stale questions; split it into `Resolved`, `Must decide before implementation`, and `Can decide during feature work`.
- The user-stories doc is too large to be the active execution plan. Keep it as a story corpus, then create a short MVP sequence doc.
- `context/` is currently only a small routing shell, while the PRD commits to substantial LLM-targeted docs. Create those incrementally with the first slice, not after feature sprawl.
- Move superseded drafts and predecessor docs clearly out of the active reading path, or keep one routing table explaining their status.

## Recommended pre-implementation gates

1. Reconcile stale docs: public viewer routing, auth/token model, raw SQL vs SQLAlchemy, README/scaffold wording.
2. Write three decision docs:
   - `public-access-threat-model.md`
   - `draft-save-state-machine.md`
   - `asset-storage-and-api.md`
3. Create an MVP vertical-slice plan that stops before domain-heavy Windows/Envelope canvases.
4. Build fixture budgets: small / typical / large project JSON and HBJSON files.
5. Add CI gates for schema generation, Pydantic validation fixtures, backend tests, frontend tests, Playwright smoke, lint, and formatting.

## Bottom line

The architecture is promising and fits PHN's direction. The planning gap is not a missing framework; it is missing reconciliation around access, persistence, draft semantics, assets, and first-slice sequencing. Resolve those now, and implementation can stay surgical instead of re-litigating architecture in the middle of feature work.
