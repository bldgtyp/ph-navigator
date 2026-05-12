---
DATE: 2026-05-12
STATUS: CANONICAL ROUTER — technical requirements split out of context/PRD.md.
RELATED: context/PRD.md, context/TECH_STACK.md, context/UI_UX.md,
         context/DATA_TABLE.md, context/USER_STORIES.md
---

# PH-Navigator V2 — Technical Requirements Router

This is the on-demand technical contract layer for PH-Navigator V2. It
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
- `technical-requirements/stack-auth-migration.md` — stack/deployment,
  raw-SQL persistence pattern, repo layout, auth/session baseline, and V1
  migration plan.

## Maintenance Rule

When an implementation decision lands, update the focused technical file
first. Update `context/PRD.md` only if the decision changes product scope,
architecture direction, success criteria, or default context routing.
