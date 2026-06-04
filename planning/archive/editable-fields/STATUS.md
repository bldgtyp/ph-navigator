---
DATE: 2026-06-04
TIME: 14:30 ET
STATUS: Complete — Phases 1–3 shipped on `main` (PR #3,
        `a6230b5`). Rooms + Pumps run on the unified `field_defs`
        model end-to-end. Phase 4 (per-table seeding for Fans, ERVs,
        Thermal Bridges, Window-Types, Materials, Window-Frame
        Elements, Window-Glazing) is Deferred — those table modules
        don't exist in the backend yet, and the rollout will happen
        when each table lands. Phase 5 (polish) is Deferred per the
        PRD; items ship independently if/when bandwidth allows.
AUTHOR: Claude (Opus 4.7)
SCOPE: Final status ledger for the editable-fields feature.
RELATED:
  - README.md
  - PRD.md
  - phases/phase-03-frontend-bundle.md
  - phases/phase-04-remaining-table-seeds.md (Deferred)
  - phases/phase-05-polish.md (Deferred)
---

# Editable Fields — Status

## Current state

**Complete for the tables that exist today.** PR #3
(`codex/editable-fields-p2-6-frontend-fixtures`, merged at `a6230b5`)
landed the unified field-config model on `main`. Rooms and Pumps run
end-to-end on `field_defs` + `custom_values` with `record_id` and
custom `field_key` references, fingerprint v2, and Playwright
round-trip coverage for both built-in and custom-field edits.

## Phase outcomes

- **Phase 1 (foundation) — Done.** `TableFieldDef`,
  `slice.field_defs`, fingerprint v2. Commit `8b439bf`.
- **Phase 2 (Rooms + Pumps backend) — Done.** Backend seeds, MCP
  helper fixes, project-document v4 envelope.
- **Phase 3 (frontend bundle) — Done.** Rooms + Pumps frontend
  rewritten against `field_defs`, equipment + project-document +
  data-table tests rebuilt around the shared
  `frontend/src/features/equipment/testing/testFixtures.ts` and
  `backend/tests/project_document_helpers.py`. All gates green at
  merge.
- **Phase 4 (remaining tables) — Deferred.** Fans, ERVs, Thermal
  Bridges, Window-Types (existing module has no `field_defs` yet),
  Materials, Window-Frame Elements, and Window-Glazing will be
  migrated to the unified model as those table modules are written.
  No table currently in `backend/features/project_document/tables/`
  is blocked.
- **Phase 5 (polish) — Deferred.** Optional per the PRD. Items
  (lossy-conversion toast, locked-attribute visual, lock-list in
  modal tooltip, "Duplicate record" right-click) ship independently.

## Verification at completion

Per the pre-merge PR #3 gate (see prior STATUS revision):

- `make test`: backend 415 passed / 1 skipped; frontend 948 passed.
- `make lint`, `make typecheck`, `make smoke`: clean.
- Playwright editable-fields round-trip spec: passed on chromium.

## Follow-ups not tracked here

When the next table module (Fans, ERVs, …) lands, follow Phase 4 as
its rollout recipe. No new planning surface needed for that — the
phase file stays in this archive as the recipe.
