---
DATE: 2026-08-03
STATUS: Complete
AUTHOR: Codex with Ed May
SCOPE: Make Documentation attention filters shareable URL state while
  preserving existing section/group hash navigation.
RELATED:
  - ../PLAN.md
  - ../PRD.md
  - ../decisions.md
---

# Phase 03 — Documentation URL filters

## Outcome

Documentation derives active filters from `?needs=spec,datasheet,photo` and
writes chip toggles back in canonical axis order with replace navigation.
Unknown values are ignored; duplicates collapse naturally; removing the final
filter deletes the parameter. Navigation explicitly carries the current hash
and route state so filter changes do not break anchor expansion/scroll.

## Verification evidence

- Documentation RTL covers param-to-chip hydration, chip-to-param replace
  navigation, unknown values, empty-param removal, and combined query/hash
  behavior (8 tests passed).
- Production frontend build passed.
- Browser smoke opened
  `/documentation?needs=datasheet#equipment` directly on the isolated fixture:
  Equipment expanded and scrolled into view; only `Needs datasheet` was active.
- Three-lens simplify review found one reusable query-param setter improvement,
  which was applied; the quality and efficiency lenses were clean.
- Docs pass updated the durable Documentation route contract.
- Full CI passed: backend 1,830 passed / 7 skipped; frontend 2,395 passed;
  production build and static gates green.

## Invariants

- Filter state is URL-derived; there is no duplicate React state.
- Filter writes do not add browser-history entries.
- Existing Documentation section/group hashes remain stable.
