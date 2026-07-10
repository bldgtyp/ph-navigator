---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Compact Roadmap timeline and progressive editor controls.
RELATED: ../PRD.md; context/ui/pages/status-tab.md
---

# Phase 03 — Roadmap Redesign

## Goal

Replace the heavy status cards and permanent action bank with a calm timeline that preserves all existing behavior.

## Work

- Refactor Status page structure into two independent sections.
- Remove fixed minimum-height/card treatment and per-row 4px bars.
- Add compact state rail and current-milestone emphasis.
- Replace permanent move/edit/delete buttons with an editor-only accessible overflow menu.
- Reveal pointer affordances on hover/focus; keep touch/coarse-pointer access.
- Preserve drag, Alt+Arrow keyboard reorder, state cycling, Markdown, modals, and errors.
- Ensure viewer markup contains no mutation/reorder controls or disabled focusable editor artifacts.

## Exit gate

Existing roadmap behavior tests plus new viewer, keyboard, focus, touch, and visual browser checks pass.

## Completion evidence

- Replaced the heavy shared Status card with a quiet 2:1 desktop composition and a Record status-first stacked layout below 980px.
- Kept the Roadmap sticky within normal page flow on wide screens, without an internal scroll region or viewport lock.
- Replaced bordered milestone cards and permanent action banks with compact hairline rows, a subtle current-state marker, and an editor-only shared overflow menu.
- Preserved direct state cycling, drag reorder, Alt+Arrow keyboard reorder, Markdown notes, edit/delete modals, and independent roadmap loading/error states.
- Viewer rows render no mutation, reorder, overflow, or disabled date controls; coarse pointers expose the same editor controls that hover/focus reveals.
- Focused Status/App Vitest suites: `36 passed`; `make frontend-dev-check` passed with 14 pre-existing Fast Refresh warnings only.
- Live editor route showed the 2:1 composition, four compact template milestones, hidden resting controls, and correct Record status/Roadmap separation.
- Simplify removed a redundant state callback, a duplicate responsive declaration, and the shared action selectors orphaned by this phase.
- Docs-pass updated this phase and the packet status only; the durable Status page reference remains assigned to Phase 04.
