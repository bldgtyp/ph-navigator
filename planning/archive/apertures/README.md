---
DATE: 2026-06-05
TIME: 17:30 EDT
STATUS: Active feature planning router for the Apertures / Aperture Builder build-out.
AUTHOR: Codex
SCOPE: Read order, planning packet map, and current planning boundary for the full Apertures tab.
RELATED:
  - planning/features/apertures/PRD.md
  - planning/features/apertures/PLAN.md
  - planning/features/apertures/STATUS.md
  - planning/features/apertures/phases/
  - context/user-stories/10-windows.md
  - research/v1-window-builder-reference.md
---

# Apertures Planning

This folder holds the tracked planning packet for the full Apertures tab
and Aperture Builder build-out. `Windows` is the current shipped UI
label / route vocabulary; `Apertures` is the canonical domain language
for future planning and implementation.

Read order:

1. `STATUS.md` — current state, next step, blockers.
2. `PRD.md` — what the feature must do and why.
3. `PLAN.md` — 13-phase implementation sequence with
   dependencies, gates, and portfolio-level risks.
4. `phases/phase-NN-*.md` — detailed P0–P7 plan for the phase
   you are picking up.

Canonical source context:

- `context/user-stories/10-windows.md`
- `research/v1-window-builder-reference.md`
- `research/ph-nav-v1-screenshots/aperture-builder/Window Builder.png`
- `research/ph-nav-v1-screenshots/aperture-builder/Project Frame Types.png`
- `research/ph-nav-v1-screenshots/aperture-builder/Project Glazing Types.png`
- `context/technical-requirements/save-versioning.md`
- `context/technical-requirements/llm-mcp-schema.md`
- `planning/archive/assembly-builder/phases/` — phase shape
  precedent (canvas-substrate → overlay → toolbar →
  pick/paste); these phase files inform the structure of every
  Apertures phase.

Current boundary:

- TB-08/TB-09 already shipped a minimal Windows surface: window type
  creation, frame/glazing picker, bookshelf-copy provenance, U-value
  override tracer, and refresh-from-catalog review.
- This packet covers the full Aperture Builder target: V1-like canvas,
  dimensions, operations, per-element assignment cards, U-Value
  calculation, HBJSON export, copy/paste, and MCP/browser write
  posture.
- The PRD has been reviewed and refined; `PLAN.md` and all 13
  phase files exist. Phase 01 is the next implementation step
  — it unblocks every later phase.
