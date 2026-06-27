---
DATE: 2026-06-27
TIME: 08:56 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Confirmed product decisions and handoff prerequisites for Apertures
  frame-picker filter implementation.
RELATED:
  - planning/features/aperture-frame-picker-filters/README.md
  - planning/features/aperture-frame-picker-filters/PRD.md
  - planning/features/aperture-frame-picker-filters/research.md
  - planning/features/aperture-frame-picker-filters/PLAN.md
---

# Phase 00 - Decisions and Readiness

## Goal

Lock the behavior contract before implementation starts. This phase has no
source edits. It is the implementer's intake checklist.

## Confirmed decisions

1. Filter preferences are display preferences.
   - Persist in localStorage.
   - Key by `project.id`.
   - Do not write into the project document.
   - Do not dirty the draft.
2. `Filter frames by side` defaults on.
3. `Filter frames by operation` defaults off.
4. `location=Any` frame rows appear in every side-filtered frame dropdown.
5. `Double-Hung` appears in both Swing and Slide operation-family filters.
6. Add `Awning` and `Hopper` to the frame catalog operation option seeds.
7. Re-seeding local dev data is acceptable if needed after the option seed
   change.

## Existing behavior to preserve

- A selected frame remains assigned when the user changes operation or toggles
  filters.
- A selected frame remains visible at the top of its picker even when it falls
  outside active filters.
- Manufacturer filters continue to compose with frame picker filtering.
- Operation mismatch remains advisory frontend UI only; no backend validity
  enforcement is introduced.
- Viewer/locked project behavior is unaffected because these controls are local
  display preferences.

## Source context to read

- `planning/features/aperture-frame-picker-filters/PRD.md`
- `planning/features/aperture-frame-picker-filters/research.md`
- `frontend/src/features/apertures/components/FramePicker.tsx`
- `frontend/src/features/apertures/hooks/useFrameCatalog.ts`
- `frontend/src/features/apertures/picker-filters.ts`
- `frontend/src/features/apertures/operation-frame-match.ts`
- `frontend/src/features/apertures/routes/AperturesTab.tsx`
- `frontend/src/shared/ui/AppMenu.tsx`
- `backend/features/catalogs/_option_seeds.py`

## Handoff acceptance

- Implementer can restate the side and operation defaults.
- Implementer can point to the localStorage persistence decision.
- Implementer can explain that this work changes dropdown visibility and
  warnings only, not frame assignment validity.

## Completion note

Completed on 2026-06-27. Decisions were used to implement Phase 01 without
adding project-document state or backend validity enforcement.
