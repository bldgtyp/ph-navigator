---
DATE: 2026-07-18
TIME: 17:37
STATUS: Complete / archived and squash-merged to main
AUTHOR: Ed May (with Claude)
SCOPE: Survey + implement Display Name as the frozen identity field on the four Heat Pump tables
RELATED: ../PRD.md, planning/archive/dated/2026-07-19/documentation-tab/PLAN.md (Phase 0 dependency)
---

# Phase 01 — Survey and align

Single-phase feature. Two stages in one session: survey, then the fix.

## Stage 1 — survey (answers go in STATUS.md before coding)

Answer the PRD's four questions with file/line evidence:

1. How each table declares its frozen/pinned identity column — compare
   `backend/features/project_document/tables/heat_pumps.py` +
   `frontend/src/features/equipment/heat-pumps/*` against one conforming
   table (e.g. `pumps`). Identify exactly what differs (field defs?
   column order? a `frozen`/pinned flag? the `display_name` field's
   presence?).
2. What `status_summary.py`'s fallback (name → record_id → tag) currently
   renders for seeded heat-pump rows.
3. Whether existing saved documents carry heat-pump display-name values.
   Decide backfill: if rows lack display names, copy Tag → Display Name
   once via the document schema-migration mechanism (defaulted, so old
   versions validate); if a display-name field doesn't exist at all,
   add it with that backfill default.
4. Anything keying on Tag downstream (exports, MCP reads, Rooms
   ventilator-style links, tests).

## Stage 2 — implement

- Make Display Name the frozen first column on all four HP tables
  (backend field-def order/flags + frontend column config, whichever the
  survey shows is authoritative); Tag becomes an ordinary editable column.
- Apply the chosen backfill so no row renders a blank identity.
- Update `status_summary.py` display-name derivation only if the survey
  shows HP rows resolving to tag/record_id after the change.

## Verification

- Agent browser: all four HP tables show Display Name frozen at left with
  values for every seeded row; rename round-trips; Status tab HP leaves
  show Display Names; a table with a Tag-only legacy row (fixture) shows
  the backfilled name.
- `make ci` green; closeout gate per repo CLAUDE.md.
- STATUS.md updated with survey answers + evidence, then `Merged to main`
  when landed.
