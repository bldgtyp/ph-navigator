---
DATE: 2026-06-24
TIME: 19:20 EDT
STATUS: Complete
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 3 — browser smoke, UI/UX page docs, closeout gate.
RELATED: ./phase-02-wire-and-retire-modal.md, ../../.instructions.md
---

# Phase 3 — Closeout

## Result

Complete as of 2026-06-24. The UI/context docs now list Apertures Builder,
Glazings, and Frames as route-addressable sub-tabs; the report-table planning
packet notes that the planned glazing/frame consumers have landed; browser
smoke passed on the Codex fixture; screenshots were captured under `assets/`;
and the feature is ready for archive.

## Browser smoke (sign in as Ed)

This is the first phase whose data is user-visible. Per the dev-seed rule the
seeded project belongs to `ed@example.com`, and PHN enforces a single active
session — **do not clobber Ed's session**. If his stack is up, use the isolated-
worktree smoke recipe in `planning/features/.instructions.md` (throwaway DB +
backend on a free port + frontend on `:5173` pointed at it). Otherwise sign in
as Ed on the standard stack.

Smoke checklist:

- `/apertures/glazings` and `/apertures/frames` render report tables visually
  identical to `/envelope/materials` (same density, fonts, spacing, chips).
- Each glazing/frame product appears once; "Used in N elements" is correct.
- Status filter chips filter + count correctly; sections (In-scope / N/A /
  Unused) group correctly.
- Drag-and-drop a datasheet onto a glazing → persists, chip count increments,
  thumbnail opens; detach works.
- Change spec-status → persists; locked-version + viewer reads are read-only.
- Capture before/after screenshots into `assets/`.

### Smoke Evidence

Used the repo-standard agent account (`codex@example.com`) on the local dev
stack to avoid invalidating Ed's single active session.

- Fixture project: `846a42ac-cb2c-472f-8239-eabd05fe6d57`.
- `/apertures/glazings`: rendered `Browser Smoke Triple Glazing`, U-value and
  g-value columns, status filters, expanded datasheet/use-site evidence.
- Status changed to `Question`, survived reload, then was restored to `Missing`.
- Datasheet upload rendered a PDF thumbnail; detach action was exercised.
- `/apertures/frames`: rendered `Browser Smoke Frame`, Psi-install and Width
  columns, expanded side-aware use-site evidence.
- Report routes did not hit builder-only aperture slice or U-value APIs.
- Bare `/apertures` redirected to `/apertures/builder`.

Screenshots:

- `assets/apertures-glazings-report.png`
- `assets/apertures-glazings-expanded.png`
- `assets/apertures-glazings-datasheet-upload.png`
- `assets/apertures-frames-expanded.png`

## Docs

- `context/UI_UX.md` §2: add the two new pages to the page index.
- `context/ui/pages/apertures-tab.md`: document the Glazings + Frames sub-tabs
  (they currently only mention the builder); note they mirror the
  Materials/Specifications report-table and reuse `shared/ui/report-table/`.
- Cross-link the report-tables feature's "future consumers" line as now realized.

## Closeout gate (repo CLAUDE.md)

1. `simplify` skill on the diff.
2. `docs-pass` skill on the diff.
3. `make format`.
4. `make ci`.
5. Re-inspect if format changed files; rerun `make ci`.
6. Nothing red.

## Exit criteria

- Browser smoke passes with screenshots; `context/` page docs updated; closeout
  gate green. Mark the feature `Complete`; archive both feature folders per
  `planning/.instructions.md`.

Met. Final gate evidence is recorded in `STATUS.md`; archive destination:
`planning/archive/dated/2026-06-24/apertures-glazings-frames-reports/`.
