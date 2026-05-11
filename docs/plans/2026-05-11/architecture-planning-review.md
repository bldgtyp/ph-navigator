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

### F1. Public-readable project UUIDs are the largest security/product decision. Route/auth model resolved 2026-05-11; guardrails still needed.

PRD §4 makes every `/projects/{id}/...` route public-readable and treats the UUID as the share token. Non-logged-in viewers can browse all versions and download project JSON, table JSON, and HBJSON. Revocation requires soft-deleting the project.

This is simple and internally consistent, but it is not a small access-model choice. It means any forwarded URL, browser-history leak, analytics/referrer leak, screenshot, email thread, or copied certifier link grants indefinite read access until the project is deleted. Because project JSON includes certification-relevant data and object references, this should be treated as a deliberate business/security acceptance, not just a convenience inherited from V1.

Decision recorded 2026-05-11:
- V2 v1 uses normal `/projects/{id}/...` URLs for public read access.
- There are no share tokens, no `/v/{token}` routes, and no approval workflow for viewing.
- Edit ability is only possible for logged-in users, with backend write protection required on every mutating endpoint.

Remaining decisions / guardrails:
- Whether public viewers may download the full project JSON, not just browse rendered pages.
- Whether public viewers may download HBJSON and signed asset URLs.
- Whether project UUIDs are sufficiently unguessable and never exposed in third-party referrers.
- Whether a later ACL retrofit can preserve public project URLs without breaking old links.

Recommendation: add a short public-access guardrail section before implementation. Tests must prove all write routes require auth and public read routes never expose editor-only metadata or long-lived asset URLs.

### F2. Public-view routing is inconsistent across docs. Resolved 2026-05-11.

The PRD says there are no `/v/{token}` routes and public viewers use the same `/projects/{id}/...` shape. The UX doc still defines a `Public viewer (/v/{token})` page and describes a separate minimal header. The stack table also mentions "opaque tokens for viewer links."

Decision: same-route public mode. Anonymous visitors use `/projects/{id}/{tab}` with auth-sensitive chrome and read-only controls. The UX doc and PRD stack table were updated to remove `/v/{token}`, viewer-link tokens, and view-link management language.

### F3. Persistence stack is unresolved between SQLAlchemy ORM scaffold and raw-SQL decision. Resolved 2026-05-11.

Original finding: the tech-stack note chose raw parameterized SQL through repository modules and explicitly said no ORM entity layer, while the architecture PRD stack table still said `SQLAlchemy + Alembic`, the README said `backend/` contained SQLAlchemy models, and the scaffold had `database.py` defining a SQLAlchemy `DeclarativeBase` and `SessionLocal`.

This matters because the first backend feature will establish the persistence style. If both paths remain, feature code will drift into mixed ORM/raw SQL patterns.

Decision: lock V2 to raw parameterized SQL through `psycopg` v3 repository modules, with Pydantic models as the typed boundary. No SQLAlchemy ORM/Core in app code. Alembic may use SQLAlchemy internally for migrations only, with manual migration revisions rather than ORM autogenerate.

Docs and scaffold updated 2026-05-11:
- PRD stack table and persistence subsection now say raw SQL + Pydantic.
- README / AGENTS / CLAUDE / backend README no longer describe SQLAlchemy models.
- `backend/database.py` now exposes a psycopg connection pool and transaction helper.
- Alembic has no declarative metadata target.

Remaining implementation detail for the first repository slice: define row-mapping helper conventions, JSONB validation points, error mapping, and transaction test patterns.

### F4. MCP auth and LLM asset APIs are contradictory. Resolved 2026-05-11.

Original finding: PRD §10.3 said the v1 MCP server ships and uses "Bearer token from PHN editor session." PRD §13 said MCP uses a long-lived API key, stored hashed in `mcp_tokens`, with the table TBD. User stories later marked LLM-friendly asset upload/download as post-parity but "core workflow," with open questions about bearer-token scope.

This is a security-sensitive ambiguity. Long-lived tokens, session cookies, project-scoped service tokens, and MCP stdio credentials have different threat models.

Decision: MCP is read/write capable in V2 v1. Human editor auth remains session-cookie based. MCP auth uses project-scoped bearer tokens in `mcp_tokens`, issued by logged-in editors from Project Settings, shown once, stored hashed, revocable, scoped, and audit-logged. Public browser read access does not imply anonymous MCP access.

Docs updated 2026-05-11:
- PRD §6.1 now includes the `mcp_tokens` table.
- PRD §10.3 defines read/write MCP tools and project-scoped token auth.
- PRD §13 distinguishes session-cookie browser auth from MCP bearer-token auth.
- User stories now move MCP token management and LLM-friendly asset/project writes into V2 v1 scope.

Remaining implementation detail: exact token plaintext format, token-hash algorithm, default expiry recommendation, and rate limiting belong in the first auth/security implementation plan.

### F5. Server-side drafts need a sharper conflict and data-loss model. Resolved 2026-05-11.

Original finding: the Save model was strong, but draft semantics had several unresolved edge cases:
- one draft per `(version_id, user_id)` conflicts with "single active session per user" and "second tab read-only unless takeover";
- session expiry retries unsynced patch queues after re-auth, but it is unclear what happens if the version changed during the expired interval;
- table-view undo conflict semantics are still open;
- a `PUT /document` whole-body Save exists alongside draft-save, which may bypass draft conflict checks unless tightly constrained;
- the plan does not define JSON-Patch validation against stable IDs versus array indices.

Decision: V2 v1 uses one canonical server-side draft per `(version_id, user_id)`. Browser and MCP writes from the same editor share that draft. All user/agent document writes go through the draft; saved version bodies mutate only through explicit Save or Save As. V1 does not attempt merge UI. Conflicts preserve the draft and offer reload / Save As / discard / diff as appropriate.

Docs updated 2026-05-11:
- Added `docs/plans/2026-05-11/draft-save-state-machine.md`.
- PRD §8.3 now includes `base_version_etag`, `draft_etag`, and `updated_via`.
- PRD §8.5 now defines draft ETag, version ETag, locked-version, second-tab, and Save As behavior.
- PRD §9.4/§9.5 now removes normal whole-body/table saved-document PUTs; writes go through draft endpoints.
- Table-view doc now resolves production undo conflict policy as local-only undo cleared on conflicts/refetch/version switch.

Remaining implementation detail: exact ETag hash format and modal copy can land with the first draft/save implementation.

### F6. Document JSONB is the right source of truth, but query/index/reporting needs are deferred too broadly. Resolved 2026-05-11.

The PRD defers cross-project queries and keeps project-scoped tables entirely inside JSONB. That is reasonable for MVP, but several v1 surfaces already need query-like behavior: dashboard last modified, status state, catalog drift report, diff summaries, asset usage/orphan detection, public downloads, and possibly certifier-facing QA reports.

Decision: keep query/index/reporting infrastructure deferred for MVP. V2 v1 does not add generated columns, GIN indexes, sidecar search/index tables, relational shadows of project-document tables, or precomputed catalog-drift indexes.

Docs updated 2026-05-11:
- PRD §6.4 now states the MVP posture explicitly.
- Project table screens read from the saved document or active draft, then slice/filter/sort in application code for the current project/version.
- Dashboard metadata, status, action logs, HBJSON files, assets, users, tokens, and catalogs remain relational because they are platform metadata or global data, not project-document table shadows.
- Diff summaries, catalog drift checks, asset usage/orphan detection, and downloads are computed on demand for the current project/version.
- Fixture budgets and indexing choices are post-MVP unless real project size or latency makes them necessary.

### F7. Catalog schema migration commitment is stronger than the initial catalog scope can support unless it gets its own implementation lane. Resolved 2026-05-11.

Original finding: the PRD made catalog-schema migration a non-negotiable v1 commitment with shim chains, golden fixtures, production-corpus drills, and renamed-field diff behavior. That discipline is good, but it is a full subsystem and overbuilt for the MVP's three catalogs.

Decision: defer catalog-schema migration tooling for MVP and keep it as a post-MVP architectural goal.

Docs updated 2026-05-11:
- PRD §7.5 now says MVP does not ship catalog-row shim chains, catalog-schema golden fixtures, production-corpus refresh drills, renamed-field diff metadata, or added/removed/re-typed-field migration UI.
- MVP still stores `catalog_schema_version: 1` in catalog row APIs and copied `catalog_origin` payloads as a cheap future hook.
- Refresh-from-catalog in MVP compares current MVP field names only.
- Catalog schema changes before post-MVP migration tooling exists are treated as code/data migration events requiring manual planning.

### F8. Asset model is scattered across material assets, HBJSON-specific routes, and future generic asset APIs. Resolved 2026-05-11.

Architecture references `material_assets`, HBJSON-specific tables/routes, project JSON asset IDs, signed R2 URLs, orphan GC, and future generic `/assets` endpoints. The story stub correctly identifies a need for consistent LLM-callable asset APIs, but it is post-parity while the MVP already depends on datasheets, site photos, thermal-bridge files, and HBJSON uploads.

Decision: define one generic `project_assets` backbone before implementing specific file features.

Docs updated 2026-05-11:
- PRD §6.5 now defines `project_assets` as the canonical R2-backed upload table for datasheets, site photos, HBJSON, and future simulation/export files.
- Project documents reference uploaded files only by `asset_id`.
- HBJSON now uses `project_assets(asset_kind='hbjson')` for bytes and a `project_hbjson_files` subtype table for viewer labels, notes, optional `project_version_id`, and cached extraction metadata.
- PRD §9.10 defines generic signed upload/download, attach, detach, and GC behavior.
- PRD §9.11 keeps HBJSON routes as domain wrappers over the asset backbone, not a separate upload system.
- Delete from a material/photo UI means detach from the active draft first; hard purge is a 90-day GC path only after reference checks across saved versions and active drafts.

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

1. Reconcile stale docs: public viewer routing, raw SQL persistence, and MCP auth/token model were resolved 2026-05-11.
2. Write remaining decision docs:
   - `public-access-threat-model.md`
   - ~~`draft-save-state-machine.md`~~ completed 2026-05-11
   - `asset-storage-and-api.md`
3. Create an MVP vertical-slice plan that stops before domain-heavy Windows/Envelope canvases.
4. Defer fixture budgets/indexing work until post-MVP or until real-project latency makes it necessary.
5. Add CI gates for schema generation, Pydantic validation fixtures, backend tests, frontend tests, Playwright smoke, lint, and formatting.

## Bottom line

The architecture is promising and fits PHN's direction. The planning gap is not a missing framework; it is missing reconciliation around access, persistence, draft semantics, assets, and first-slice sequencing. Resolve those now, and implementation can stay surgical instead of re-litigating architecture in the middle of feature work.
