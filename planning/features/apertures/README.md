---
DATE: 2026-06-05
TIME: 13:40 EDT
STATUS: Active feature planning router for the Apertures / Aperture Builder build-out.
AUTHOR: Codex
SCOPE: Read order, planning packet map, and current planning boundary for the full Apertures tab.
RELATED:
  - planning/features/apertures/PRD.md
  - planning/features/apertures/STATUS.md
  - context/user-stories/10-windows.md
  - research/v1-window-builder-reference.md
---

# Apertures Planning

This folder holds the tracked planning packet for the full Apertures tab
and Aperture Builder build-out. `Windows` is the current shipped UI
label / route vocabulary; `Apertures` is the canonical domain language
for future planning and implementation.

Read order:

1. `STATUS.md`
2. `PRD.md`
3. Future phase files under `phases/`

Canonical source context:

- `context/user-stories/10-windows.md`
- `research/v1-window-builder-reference.md`
- `research/ph-nav-v1-screenshots/aperture-builder/Window Builder.png`
- `context/technical-requirements/save-versioning.md`
- `context/technical-requirements/llm-mcp-schema.md`

Current boundary:

- TB-08/TB-09 already shipped a minimal Windows surface: window type
  creation, frame/glazing picker, bookshelf-copy provenance, U-value
  override tracer, and refresh-from-catalog review.
- This packet covers the full Aperture Builder target: V1-like canvas,
  dimensions, operations, per-element assignment cards, U-Value
  calculation, HBJSON export, copy/paste, and MCP/browser write posture.
- Detailed implementation phasing has not started. Write phase plans
  only after the PRD has been reviewed.
