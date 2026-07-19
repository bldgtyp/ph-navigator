---
DATE: 2026-07-19
TIME: 14:30 EDT
STATUS: Phase 00 complete — Phase 01 next
AUTHOR: Codex with Ed May
SCOPE: Make `needed` the canonical PH-Navigator specification-status value
  while preserving historical project versions, external Honeybee
  compatibility, and safe rollout across two production projects.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./decisions.md
  - ./research.md
  - ./phase-00-inventory.md
  - ./phases/
  - ../../../context/technical-requirements/save-versioning.md
  - ../../archive/dated/2026-06-27/beta-schema-evolution/schema-bump-checklist.md
---

# Specification-status value unification

Planning router for the built-in specification-status rename
`missing` → `needed`.

Read in this order:

1. `PRD.md` — product and compatibility contract.
2. `decisions.md` — accepted architecture and rollout decisions.
3. `research.md` — current-code inventory and risks.
4. `PLAN.md` — release/phase map.
5. `phases/phase-00-*.md` through `phase-07-*.md` — executable handoffs.
6. `STATUS.md` — current state, gates, and next action.

## Outcome

PH-Navigator's canonical built-in `SpecificationStatus` becomes:

```text
complete | needed | question | na
```

Every specification-status UI displays:

```text
Complete | Needed | Question | N/A
```

Documentation Datasheet/Photo evidence status intentionally remains the
smaller `Needed | Complete | N/A` contract.

This is semantic consistency, not one physical storage format:

- Materials, Glazings, and Frames store the literal
  `specification_status: "needed"` in current project documents.
- Equipment and Thermal Bridges keep their existing stable DataTable option id
  `custom_values.status = "opt_status_needed"`.
- Documentation and Status summary APIs normalize both storage families to
  `needed`.
- Honeybee reference metadata remains an explicit external adapter:
  internal `needed` exports as Honeybee `MISSING`, and imported `MISSING` /
  `missing` normalizes to internal `needed`.

## Production-data contract

The two production projects use the established forward-only project-document
upgrade lane. Schema v7 bodies are upgraded to v8 in memory; historical saved
version rows are not bulk-rewritten. Existing drafts may rewrite when read,
and later Save / Save As operations persist v8 through normal application
flows.

Before the v8 release, inventory and audit every saved version and draft for
both projects, close or intentionally resolve live drafts, establish a verified
database restore point, and pause Ed/John writes. After any v8 draft or version
is persisted, old v7 code cannot safely replace the candidate; recovery becomes
roll-forward unless the database is restored or explicitly repaired.

## Scope boundary

In scope:

- canonical backend/frontend value and defaults;
- v7 → v8 dict upgrader for `project_materials`, `project_glazings`, and
  `project_frames`;
- Documentation, Status, Materials, Glazings, and Frames UI/wire behavior;
- frontend report/status tone key `needed`;
- MCP, GH API, seed, fixture, and HBJSON boundary behavior;
- compatibility release, production-corpus audit, rollout, and cleanup.

Out of scope:

- rewriting immutable historical `project_versions` rows;
- changing Equipment/Thermal Bridges from stable option ids to literals;
- removing the Documentation response-only `unknown` sentinel;
- banning the ordinary English word `missing` from errors, evidence filters,
  climate states, geometry warnings, or missing-option UI;
- consolidating `StatusSelect` and DataTable status-pill CSS;
- deploying to production without Ed's explicit instruction.
