---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: In review; MCP envelope surface implemented. UI/browser
        release evidence delegated to Phase 16.
AUTHOR: Codex
SCOPE: MCP tools and semantic command hardening. Historical UI/browser
       release gates are now owned by Phase 16.
RELATED:
  - planning/features/assembly-builder/PRD.md §§5.9, 13-15
  - planning/features/assembly-builder/README.md
  - context/technical-requirements/llm-mcp-schema.md
  - context/technical-requirements/api.md
  - context/CODING_STANDARDS.md
---

# Phase 8 - MCP, Hardening, And Release

## Goal

Finish the MCP side of Assembly Builder as an operational surface: MCP
can inspect and edit through the same command boundary as the browser,
without becoming a parallel write API.

After the UI/Layout parity bundle was added, Phase 8 is no longer the
execution plan for browser release evidence. It remains the MCP/backend
hardening provenance plan. Phase 16 owns the realistic scale fixture,
deferred Phase 4-7 browser smoke, locked/viewer browser checks, V1
parity audit, and final release docs closeout.

## In Scope

- MCP read tools:
  - list assemblies;
  - list project materials;
  - query unfinished envelope work;
  - report catalog drift;
  - report missing evidence.
- MCP write tools routed through semantic envelope commands.
- Draft lease / MCP-browser collision behavior.
- MCP-specific tests for read/write happy paths, stale ETags, and tool
  discovery.
- Historical browser, scale, accessibility, performance, IP/SI, V1
  parity, and release-doc gates are now owned by Phase 16.

## Out Of Scope

- Real-time collaboration.
- Cross-project material search.
- Bulk material-card operations.
- Required-photo checklist.
- Post-v1.1 deferred candidates unless explicitly promoted.

## MCP Work

MCP writes must call the same backend command endpoint as the browser.
They should not send arbitrary nested JSON-Patch. Every mutating tool
uses the existing draft ETag and edit-lease protections.

Minimum tool outcomes:

- inspect a project and summarize envelope completeness;
- add or update an assembly through semantic commands;
- assign or hand-enter a project material;
- attach evidence only through registered asset paths;
- produce a drift/evidence report without writing.

## Hardening Work

- Verify MCP command writes use the same `EnvelopeCommandRequest` DTO as
  the browser.
- Verify stale ETags and locked-version protections reject MCP writes
  with the same structured errors as browser writes.
- Confirm MCP reports read the same envelope/project-material/drift
  state as the browser-facing read models.

## Verification Gates

Backend:

- full backend test suite;
- typecheck;
- lint;
- MCP tool tests for read and write happy/error paths;
- command endpoint conflict tests reused by browser and MCP paths.

Repo:

```bash
make test
make typecheck
make lint
make smoke
```

## Success Criteria

1. Browser and MCP write paths share the same semantic command boundary.
2. MCP read/report tools expose Assembly Builder state without becoming
   a parallel write API.
3. All MCP-specific deferred items are either closed or moved into a
   named post-v1.1 follow-up.
4. UI/browser release gates are delegated to Phase 16.
5. PRD implementation lessons are updated with any MCP/API durable
   discoveries.

## Risks

- **MCP becomes a parallel write API.** Mitigation: MCP tools only call
  envelope commands.
- **Docs drift from implementation.** Mitigation: run docs-pass from
  actual code/config values before marking the feature complete.

## Lessons To Capture

At closeout, review every phase note and add PRD lesson rows for:

- command/API shape changes;
- catalog refresh edge cases;
- MCP/browser command-boundary pitfalls.

## Implementation Progress

2026-05-27 - MCP envelope first pass implemented on
`codex/assembly-builder-phase-07`:

- added MCP read tools:
  - `list_envelope_assemblies`;
  - `list_project_materials`;
  - `query_unfinished_envelope_work`;
  - `report_material_catalog_drift`;
  - `report_missing_envelope_evidence`;
- added MCP write tool `apply_envelope_command`, which validates the
  same `EnvelopeCommandRequest` DTO as the browser and calls the
  existing envelope command service;
- added `updated_via="mcp"` support to the envelope command service so
  MCP writes tag the persisted draft row while preserving existing
  ETag and locked-version protections;
- updated the MCP read smoke script to require the new envelope read
  tools;
- added backend tests proving:
  - envelope MCP read reports load expected assembly/material state;
  - unfinished work counts include missing materials, missing
    conductivity, datasheets, photos, unused materials, and drift;
  - MCP envelope writes update the draft through the semantic command
    boundary;
  - stale MCP writes return structured `draft_etag_mismatch` errors;
  - FastMCP tool discovery exposes the new Assembly Builder tools.

Verified:

```bash
cd backend && uv run ruff check features/envelope/service.py features/mcp/tools.py features/mcp/server.py tests/test_mcp.py scripts/smoke_mcp_read.py
cd backend && uv run ty check features/envelope/service.py features/mcp/tools.py features/mcp/server.py tests/test_mcp.py scripts/smoke_mcp_read.py
cd backend && uv run pytest tests/test_mcp.py
```

Remaining:

- complete any MCP-specific follow-up discovered by future MCP tests;
- close UI/browser release evidence through
  `planning/features/assembly-builder/phases/phase-16-ui-parity-browser-hardening.md`.
