---
DATE: 2026-08-02
TIME: 12:00 EDT
STATUS: Active — planning complete, no implementation started
AUTHOR: Claude with Ed May
SCOPE: Execution state for the units-field-naming refactor.
RELATED:
  - ./README.md
  - ./PRD.md
---

# STATUS — Units metadata & field-naming truthfulness

**State:** Active. Planning folder created 2026-08-02 from the Linde 2524
session handoff (now at `archive/HANDOFF_2026-08-02.md`); code inventory in
`PRD.md` verified against the repo the same day. No app-side code changed yet.

## Already done (context, not this repo's work)

- Linde 2524 production data corrected and saved: AH-1 8.79 / 9.96 kW;
  P-1 flow 56.8 l/min.
- claude-plugins `source/phn-workflow.md` (→ generated `skills/phn/SKILL.md`)
  gained a "Write values in SI units" section with the trap list — agent-side
  mitigation until the app-side fix lands.
- claude-plugins MCP transport fix written 2026-08-02 (idle-socket reopen +
  safe single retry; "never replay an indeterminate POST" invariant preserved;
  three new tests). **Uncommitted** at handoff time.

## Next steps (suggested order from the handoff)

1. **Stopgap + metadata** (PRD C1 + C4, small): correct the two backend
   display names; emit units blocks from the backend field_def registry;
   frontend consumes them.
2. **External:** review/commit the claude-plugins bridge fix, bump plugin
   version, reinstall so the cached copy updates.
3. **Renames** (PRD C2 + C3, one v8→v9 schema bump): `cooling_btuh` →
   `cooling_cap_kw`, `heating_btuh_47f` → `heating_cap_kw_47f`; decide and
   record `heating_btuh_17f` and `pumps.flow_gpm` first (open decisions —
   see PRD C2; the `heating_btuh_17f` option is the only value-converting
   migration).

## Blockers

None hard. Step 3 should not start until the two open naming decisions in
PRD C2 are made (Ed's call). Step 2 is Ed-adjacent (plugin release) and
gates comfortable MCP-driven verification against production.

## Verification checkpoint

Nothing to verify yet. When implementation starts, the verification bar is
PRD §Verification.
