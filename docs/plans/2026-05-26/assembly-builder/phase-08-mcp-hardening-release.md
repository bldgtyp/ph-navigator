---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: MCP tools, hardening, performance, accessibility, release gates,
       and docs closeout.
RELATED:
  - docs/features/assembly-builder-prd.md §§5.9, 13-15
  - docs/plans/2026-05-26/assembly-builder/README.md
  - context/technical-requirements/llm-mcp-schema.md
  - context/technical-requirements/api.md
  - context/CODING_STANDARDS.md
---

# Phase 8 - MCP, Hardening, And Release

## Goal

Finish the feature as an operational surface: MCP can inspect and edit
through the same command boundary, large realistic projects remain
usable, browser workflows are verified, and implementation lessons are
folded back into the PRD.

## In Scope

- MCP read tools:
  - list assemblies;
  - list project materials;
  - query unfinished envelope work;
  - report catalog drift;
  - report missing evidence.
- MCP write tools routed through semantic envelope commands.
- Draft lease / MCP-browser collision behavior.
- End-to-end browser suite for core workflows.
- Scale fixture with dozens of assemblies, low hundreds of segments,
  and dozens of project materials.
- Accessibility and keyboard checks for non-hover alternatives where
  needed.
- Performance pass for canvas rendering, Specifications cards, and
  thermal refetch behavior.
- Docs-pass updating PRD lessons and any context/API docs whose durable
  contract changed during implementation.
- Final V1 parity audit against
  `research/v1-assembly-builder-reference.md` §17, with intentional
  V2 changes recorded rather than rediscovered later.

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

- Add realistic scale fixture.
- Verify natural sort and duplicate material-name disambiguation.
- Confirm canvas does not horizontally compress segments.
- Confirm Specifications remains scan-friendly at dozens of materials.
- Confirm thermal refetches are debounced and not per-keystroke.
- Confirm viewer and locked-version behavior across all sub-surfaces.
- Confirm staging/split-origin API base behavior if E2E is run outside
  local dev.

## Verification Gates

Backend:

- full backend test suite;
- typecheck;
- lint;
- MCP tool tests for read and write happy/error paths;
- command endpoint conflict tests reused by browser and MCP paths.

Frontend:

- full frontend test suite;
- build;
- targeted E2E for:
  - create/edit/save assembly;
  - material picker/detach/specifications;
  - attachments;
  - thermal/export;
  - catalog drift refresh;
  - viewer/locked mode.

Repo:

```bash
make test
make typecheck
make lint
make smoke
```

Browser:

- local full smoke;
- staging smoke if this feature is deployed before closeout;
- screenshot or written evidence for the main workflow and one narrow
  viewport.

## Success Criteria

1. Browser and MCP write paths share the same semantic command boundary.
2. The feature is usable at expected BLDGTYP project scale.
3. Viewer and locked-version behavior is consistent across all envelope
   surfaces.
4. All phase-level deferred items are either closed or moved into a
   named post-v1.1 follow-up.
5. HBJSON import remains either intentionally deferred with a named
   follow-up or promoted into a new plan before release.
6. PRD implementation lessons are updated with any durable discoveries.

## Risks

- **MCP becomes a parallel write API.** Mitigation: MCP tools only call
  envelope commands.
- **Scale fixture reveals canvas/card performance late.** Mitigation:
  create scale data before broad UI polish.
- **Docs drift from implementation.** Mitigation: run docs-pass from
  actual code/config values before marking the feature complete.

## Lessons To Capture

At closeout, review every phase note and add PRD lesson rows for:

- command/API shape changes;
- calculation/export fixture discoveries;
- catalog refresh edge cases;
- attachment/versioning failure modes;
- browser/staging verification pitfalls.
- V1 parity gaps that were accepted, deferred, or intentionally changed.
