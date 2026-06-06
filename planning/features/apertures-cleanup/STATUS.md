---
DATE: 2026-06-05
TIME: 21:45 EDT
STATUS: Active — backlog only; no work in flight.
AUTHOR: Claude
SCOPE: Track which cleanup items from PRD.md have shipped and which
       are still queued.
RELATED:
  - planning/features/apertures-cleanup/PRD.md
  - planning/archive/apertures/STATUS.md (final state of the 13-phase build)
---

# Apertures cleanup — status

Nothing in flight. The backlog lives in `PRD.md`. Pick the next
cleanup phase by grouping items that share a PR boundary (e.g.
A.1–A.6 ship together because the rename touches the schema, the
migration shim, and the frontend folder atomically).

## Suggested first phase

**Phase C-01 — `Window*` → `Aperture*` removal** (PRD §A.1–A.6).
One coordinated PR covering the rename, the document migration
shim, the Alembic JSON munge + default-row seed, the frontend
`windows` folder deletion, and the redirect. Unblocks the
`aperture_default_refs_missing` 503 noted in the archived
STATUS.

## Blockers

- A.4's Alembic migration is the gating step for A.1–A.3 (the
  persisted JSON has to migrate before the field rename's
  validation can run cleanly). Keep them in one PR.
