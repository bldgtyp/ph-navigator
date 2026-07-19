---
DATE: 2026-07-19
TIME: 09:46 EDT
STATUS: Draft contract
AUTHOR: Claude (Opus 4.8) for Ed May
---

# PRD — Spec-status value unification

## Goal

One specification-status vocabulary across all four disciplines
(Apertures/Glazings, Apertures/Frames, Envelope/Materials, Equipment, Thermal
Bridges): **`complete` · `needed` · `question` · `na`**, displayed as
**Complete · Needed · Question · N/A**. No layer stores or reasons about
`"missing"` for spec status.

## Current state (2026-07-19)

- Canonical enum: `SpecificationStatus = Literal["complete", "missing", "question", "na"]`
  - backend `backend/features/project_document/envelope_models.py:27`
  - frontend `frontend/src/features/envelope/types.ts:7`
- Default value `"missing"` on the row models that carry it:
  - `envelope_models.py:252` (ProjectMaterial), `:303`, `:365` (glazing/frame)
  - `backend/features/envelope/commands/materials.py:125,316`
  - `backend/features/project_document/apertures/_ref_helpers.py:148,158`
- Translation shims that already rename `missing → needed` for their feeds:
  - `backend/features/project_document/documentation_summary.py:220`
    (`_STATUS_BY_SPECIFICATION_STATUS`)
  - `backend/features/project_document/status_summary.py:234`
- Validation set: `backend/features/envelope/hbjson_import.py:37`
  (`{"complete","missing","question","na"}`)
- Frontend report-table key: `ReportStatusKey = "missing" | "question" | "complete" | "na"`
  (`frontend/src/shared/ui/report-table/StatusPill.tsx:3`) and the
  `.report-status-dot[data-status="missing"]` CSS.
- Documentation vocabulary already uses `needed` and adds an `unknown` sentinel:
  `DocumentationSpecStatus = Literal["needed","question","complete","na","unknown"]`.
- Equipment / Thermal Bridges use the **custom-status** path
  (`documentation_summary.py:111` `status_source`), keyed by catalog
  single-select option ids where "needed" is already `STATUS_OPTION_NEEDED`
  (`frontend/src/shared/ui/data-table/status.ts:7`). These are already
  "needed"; the divergence is the *built-in* enum used by Materials + Apertures.

## The hard part: stored JSONB

`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 7`
(`backend/features/project_document/document.py:213`). Every saved version's
`body` JSONB contains `"specification_status": "missing"` on material, glazing,
and frame rows. Production data is real
(`context/PRODUCTION_DEPLOYMENT.md`) — renaming the enum without upgrading
stored bodies makes old versions fail validation on read.

Decision required (see `PLAN.md`): **bump schema_version 7 → 8** with a forward
upgrade that rewrites `missing → needed`, versus a **read-time normalization**
alias. Prefer the schema-version upgrade so stored data is self-consistent and
the enum stays strict.

## Acceptance criteria

1. `SpecificationStatus` (backend + frontend) = `complete | needed | question | na`;
   the string `"missing"` no longer appears as a spec-status **value** anywhere
   (color-token key `--report-status-missing` may remain, or be renamed — see
   decisions).
2. A saved version created before the change reads back with
   `specification_status: "needed"` where it previously held `"missing"`
   (verified against a real fixture / migrated body).
3. The `missing → needed` translation shims are gone (or reduced to an identity
   the schema now guarantees), and `documentation_summary` / `status_summary`
   pass through the value unchanged.
4. Apertures/Glazings, Apertures/Frames, Envelope/Materials, Equipment, and
   Thermal Bridges all present the identical option set and the same value on
   the wire.
5. `make ci` green; a regression test asserts old-body → migrated-body
   `missing → needed`; existing spec-status tests updated.

## Non-goals

- Changing status **colors** or the shared `StatusSelect` UI (shipped).
- Merging `DocumentationSpecStatus`' `unknown` sentinel away (separate cleanup;
  note it, don't chase it here unless trivial once values align).
