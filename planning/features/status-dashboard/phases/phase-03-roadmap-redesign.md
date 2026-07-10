---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Planned
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

