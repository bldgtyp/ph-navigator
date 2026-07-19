---
DATE: 2026-05-12
STATUS: CANONICAL ROUTER — technical requirements split out of context/PRD.md.
RELATED: context/PRD.md, context/TECH_STACK.md, context/UI_UX.md,
         context/USER_STORIES.md
---

# PH-Navigator — Technical Requirements Router

This is the on-demand technical contract layer for PH-Navigator. It
exists so `context/PRD.md` can stay small enough for default startup
context while implementation details remain durable and discoverable.

## Loading Rule

Do not load this whole folder by default. Start from `context/PRD.md` and
load only the file that matches the active implementation surface.

## Files

- `technical-requirements/data-model.md` — relational metadata, project
  document JSON shape, catalog bookshelf model, query/index posture, and
  asset backbone.
- `technical-requirements/save-versioning.md` — Save / Save As, server-side
  draft buffer, ETags, concurrency, diff, and acceptance tests.
- `technical-requirements/api.md` — `/api/v1` route inventory,
  idempotency, drafts, assets, HBJSON, downloads, and schema endpoints.
- `technical-requirements/llm-mcp-schema.md` — LLM design rules, MCP tool
  surface, typed query object, context docs, and schema-version upgrade
  guarantees.
- `technical-requirements/frontend-viewer-units.md` — app surfaces,
  editor state, table display posture, R3F HBJSON viewer, and SI/IP unit
  conversion rules.
- `technical-requirements/data-table.md` — shared `<DataTable>`
  implementation contract: field registry, clipboard, write pipeline,
  view state, accessibility, and deferred table features.
- `technical-requirements/stack-auth-migration.md` — stack/deployment,
  raw-SQL persistence pattern, repo layout, auth/session baseline, and V1
  migration plan.
- `technical-requirements/attachments.md` — pre-set v1 attachment-field
  roster, `<AttachmentCell>` UX contract, upload coordinator, save /
  version invariants and edge-case test targets, thumbnail pipeline,
  errors, and security.

### Envelope / HBJSON export-import

- `technical-requirements/envelope-commands.md` — the semantic
  envelope-command catalog (Assembly Builder edits), request/response
  shape, and conflict-code reference.
- `technical-requirements/envelope-hbjson-export.md` — the saved-version
  opaque-construction HBJSON export payload shape.
- `technical-requirements/envelope-hbjson-import.md` — HBJSON
  construction import: parse, match, resolve, and commit.
- `technical-requirements/envelope-thermal-preview.md` — the Assembly
  Builder thermal R/U preview contract and input-hash cache semantics.
- `technical-requirements/envelope-catalog-drift.md` — the material
  catalog-drift states and refresh-from-catalog contract.
- `technical-requirements/hbjson-export.md` — the per-aperture-type
  HBJSON export service (U-Value / cache behavior), distinct from the
  envelope (assembly) export above.

## Maintenance Rule

When an implementation decision lands, update the focused technical file
first. Update `context/PRD.md` only if the decision changes product scope,
architecture direction, success criteria, or default context routing.
