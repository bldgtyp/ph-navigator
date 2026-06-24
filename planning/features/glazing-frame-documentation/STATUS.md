---
DATE: 2026-06-24
TIME: 17:30 EDT
STATUS: Planning — plan complete; ready to execute; all decisions accepted
AUTHOR: Claude (Opus 4.8)
SCOPE: glazing-frame-documentation
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./PLAN.md, ./phases/
---

# STATUS — Glazing + Frame Documentation

**State:** `Planning — plan complete`. File-level phase plans drafted against
real `file:line` anchors. No code written yet. All decisions accepted — D-2
(hand-entered dedup) confirmed by Ed (2026-06-24) as **Option A**
(Materials-faithful: each hand-entered ref is its own entity).

## Why this feature exists (one line)

Datasheet linking + spec-status are per-product, so glazings/frames must become
flat deduped documented entities (`ProjectGlazing`/`ProjectFrame`) like
`ProjectMaterial` before the report pages can be built. Ed broke this out as the
prerequisite "first feature" (AskUserQuestion, 2026-06-24).

## Done

- Mapped the Materials backend (selector `build_envelope_read_parts`,
  `project_materials_contract`, `ProjectMaterial`) as the clone template.
- Mapped the aperture data model (inline `GlazingRef`/`FrameRef`; one glazing +
  four frame slots per element) and every inline-ref construction site (pick
  handlers, factories, default_refs, _ref_helpers, refresh, ref-builders,
  pickers).
- Confirmed the document migration mechanism (`mode="before"` upgraders;
  precedent `document.py:278`) and the generic asset-attachment extension point
  (`assets/registry.py`).
- Resolved D-1..D-7 (D-2 confirmed Option A by Ed, 2026-06-24).

## Next step — RESUME HERE

**Phase 0 + Phase 1 (co-land):** add `ProjectGlazing`/`ProjectFrame` +
`project_glazings`/`project_frames` tables + element FK fields + cross-table
validation + `ensure_project_*` upsert helpers, **and** the v11→v12
`mode="before"` migration + seed/template updates + golden-corpus test, in one
PR. See `phases/phase-00-models-and-tables.md` and
`phases/phase-01-document-migration.md`.

**Pre-start coordination:** land `window-glass-catalog-enums` Phase 5 (frontend)
first or coordinate — it and this feature's Phase 4 both touch the aperture/
glazing builder UI (README §Sequencing).

## Blockers

- None. All decisions accepted (D-2 = Option A).

## Verification ledger

- Planning only. Each phase doc carries its own test list + exit criteria; the
  closeout gate (Phase 5) is the final `simplify` + `docs-pass` + `make ci`.
