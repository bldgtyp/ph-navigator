---
DATE: 2026-07-18
TIME: 16:45
STATUS: Complete / archived and squash-merged to main
AUTHOR: Ed May (with Claude)
SCOPE: Contract for aligning Heat Pump tables on Display Name as the frozen identity field
RELATED: README.md, planning/archive/dated/2026-07-19/documentation-tab/PRD.md §D2
---

# Heat Pumps Display Name — PRD

## Goal

All four Heat Pump tables behave like every other equipment table: **Display
Name is the frozen (pinned/identity) field**, not Tag. Tag remains an
ordinary editable column.

## Acceptance criteria (draft)

1. In the four Heat Pump DataTables, the frozen first column is Display
   Name; Tag is a regular column.
2. Everywhere a heat-pump record's identity is rendered (status-summary
   rows, attachment surfaces, future evidence page, MCP table reads),
   Display Name is what appears — consistent with the other 11 tables.
3. Existing projects: rows that have a Tag but no Display Name still render
   a usable identity (survey question 3) — no blank identities anywhere.
4. No change to the underlying stored fields — this is an identity /
   display / column-pinning alignment, not a schema migration (verify in
   survey; if heat-pump rows lack a display-name field entirely, that
   becomes a small document-schema addition and criterion 3's backfill
   matters more).

## Survey needed before phasing (small — one session)

1. Where is "frozen field" defined per table (table contract? column
   config?), and what exactly do the heat-pump tables do differently
   (`backend/features/project_document/tables/heat_pumps.py`,
   `frontend/src/features/equipment/heat-pumps/*`)?
2. What does `status_summary.py`'s display-name fallback (name →
   record_id → tag) yield for current heat-pump rows?
3. Do existing production/seed documents carry heat-pump display names, or
   only tags? Decide backfill rule (e.g. copy Tag → Display Name once,
   on document-schema upgrade).
4. Does anything downstream (exports, MCP, Rooms links) key on Tag?
