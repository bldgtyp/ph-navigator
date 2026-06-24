---
DATE: 2026-06-24
TIME: 17:45 EDT
STATUS: Planning — plan complete; BLOCKED on glazing-frame-documentation
AUTHOR: Claude (Opus 4.8)
SCOPE: apertures-glazings-frames-reports
RELATED: ./README.md, ./PRD.md, ./PLAN.md, ./phases/,
  ../glazing-frame-documentation/
---

# STATUS — Apertures → Glazings / Frames report pages

**State:** `Planning — plan complete; BLOCKED`. The pages are thin clones of
`MaterialsPanel`, but they present `ProjectGlazing`/`ProjectFrame` entities that
do not exist yet. They are hard-blocked on the prerequisite feature
`glazing-frame-documentation`.

## Blocker

`glazing-frame-documentation` must land first (or its Phases 0–2 must be on the
working branch). Required from it:

- `ProjectGlazing` / `ProjectFrame` document entities + flat tables.
- The apertures slice exposing `project_glazings` / `project_frames`.
- `update_/remove_project_glazing/frame` commands + the datasheet asset-registry
  extension (prerequisite Phase 3).

## Done

- Confirmed the Materials page is built on the report-table primitive
  (`MaterialsPanel.tsx` + `shared/ui/report-table/`) and that the report-tables
  PRD designated glazing + frame as its intended next consumers — so these pages
  are the planned reuse, not a new pattern.
- Confirmed the Apertures sub-tab bar already declares
  "Apertures · Glazings · Frames" (`AperturesTab.tsx:38-42`, state-based) — the
  nav scaffold is half-built; this feature makes it route-based and fills the two
  pages.
- Mapped the existing interim report (`refsAggregation.ts` + `ProjectRefsView.tsx`)
  to retire.
- Mapped the backend read template (`build_envelope_read_parts`) + the envelope
  read route to clone.

## Next step — RESUME HERE (after the blocker clears)

**Phase 0:** add `build_apertures_read_parts` + `ProjectGlazingRead` /
`ProjectFrameRead` + use-site DTOs + the read endpoint + the glazing/frame drift
report. See `phases/phase-00-backend-read-api.md`.

## Verification ledger

- Planning only. Phase 3 carries the browser smoke (sign in as **Ed**; isolated
  smoke recipe in `planning/features/.instructions.md`).
