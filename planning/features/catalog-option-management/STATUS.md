# STATUS — Catalog Option Management

DATE: 2026-07-17
TIME: 12:07
STATUS: Active
AUTHOR: Ed + Claude (Fable 5)
SCOPE: Current state, next step, blockers, verification state.
RELATED: README.md, PRD.md, decisions.md, research.md

## Current state

Packet drafted 2026-07-17 from a three-agent codebase sweep plus live-browser
verification (see research.md). No implementation started. Key facts locked
in: backend options CRUD + frontend controllers already exist; the only
frontend gap is passing `onEditCustomFieldBundle` on the two catalog pages;
authorization and the rename cascade are the real work.

Ed's direction (2026-07-17): renames cascade project-wide via a heavy rewrite
behind a working modal — infrequent (1-2×/year), so heavyweight is fine.

## Next step

Phase 1: re-confirm D-1 with Ed (member-wide `catalog.edit`), then wire the
field-config modal on `FrameTypesCatalogPage` / `GlazingTypesCatalogPage` and
add the capability to `MEMBER_CAPS` with tests. Phase 1 ships on its own.

## Blockers

None. Open decisions O-1..O-3 (decisions.md) are implementation-time, not
blockers for Phase 1.

## Verification

- Research verified against the running dev app 2026-07-17 (editable grid,
  inline option create works, no field-config entry point, Cmd-C/V works).
- No code changes yet; nothing to gate.
