---
DATE: 2026-07-18
TIME: 16:45
STATUS: Complete / archived and squash-merged to main
AUTHOR: Ed May (with Claude)
SCOPE: Archived router for heat-pump-display-name
RELATED: planning/archive/dated/2026-07-19/documentation-tab/ (consumer), context/user-stories/30-tables-equipment.md
---

# Heat Pumps — make Display Name the frozen identity field

Small consistency fix, spun out of the site-photos design session
(2026-07-18): the four Heat Pump tables (outdoor equip, indoor equip,
outdoor units, indoor units) currently treat **`Tag`** as the frozen /
identity field, unlike every other table in the app, which freezes
**`Display Name`**. Align Heat Pumps with the rest of the app so
Display Name is the frozen identity field everywhere.

## Why now

The site-photos evidence page keys every record's identity on Display Name
across all families (decisions.md session 2). Heat pumps being Tag-first
would leak the inconsistency straight onto the new page — fix it first.

## Read order

`PRD.md` (contract + open survey questions) → `STATUS.md`.
