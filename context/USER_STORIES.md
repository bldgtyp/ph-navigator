---
DATE: 2026-05-11
STATUS: Routing document. Canonical story bodies live in context/user-stories/.
AUTHOR: Ed May (with Claude)
SCOPE: User-story map, vertical-slice phasing, and pointers to split story files.
RELATED: context/PRD.md, context/UI_UX.md,
         context/technical-requirements/data-table.md
---

# PH-Navigator V2 — User Stories

This file is the routing layer for PH-Navigator V2 user stories. The
full story bodies were split out of this file on 2026-05-11 because the
single-file version had grown past 8,000 lines and was no longer useful
as startup context.

Canonical story bodies now live in `context/user-stories/`:

| File | Contents | Primary implementation phase |
|---|---|---|
| `00-foundation-shell.md` | Conventions; sign-in; dashboard; project create/delete; catalog access; workspace shell; concurrency; schema fallback; Status tab | Phases 0-1 |
| `10-windows.md` | Windows tab parent and US-WIN-1..12 | Phase 3 |
| `20-envelope.md` | Envelope tab parent and US-ENV-1..15 | Phase 4 |
| `30-tables-equipment.md` | Shared DataTable story; Equipment parent; Rooms, ERVs, Fans, and placeholder mechanical tables | Phase 2 and Phase 6 |
| `40-model-viewer.md` | Model tab parent and US-VIEW-1..7 | Phase 5 |
| `50-settings-ops-llm.md` | Project Settings; action logging; header consistency; post-parity features; LLM/MCP asset API | Phases 0, 2, and 6 |
| `90-open-questions.md` | Current and resolved open-question index | Ongoing cleanup |

## Vertical-Slice Phasing

The implementation plan should move in thin, manually verifiable slices.
Each phase should include backend, frontend, tests, environment wiring,
and enough UI to manually exercise the workflow on day one of that
phase. Avoid building large isolated subsystems that cannot be clicked
through end-to-end.

Active execution tracker:
`docs/plans/2026-05-12/implementation-roadmap.md`.

| Phase | Goal | Stories / docs to load | Manual verification target |
|---|---|---|---|
| 0. Scaffold + environment | Repo boots consistently: backend, frontend, DB, migrations, health/version, structured errors/logging, seed user/project. | `00-foundation-shell.md`, `50-settings-ops-llm.md`, `context/ENVIRONMENT.md`, `context/TECH_STACK.md` | `make setup`, `make smoke`, sign in as seed user, see empty dashboard. |
| 1. Project shell + Status | Create/open a project, land on Status, edit project metadata/status rows, exercise public read-only shell. | `00-foundation-shell.md`, `context/UI_UX.md` | Create project -> `/projects/{id}/status`; apply default Status template; open same URL as Viewer. |
| 2. First document-edit slice | Implement `ProjectDocumentV1`, draft buffer, ETags, Save/Save As/Discard/Lock, JSON downloads, and one editable table (Rooms) using the shared DataTable path. | `30-tables-equipment.md`, `00-foundation-shell.md`, `context/technical-requirements/data-table.md`, `context/PRD.md` §8-10 | Add/edit Rooms, reload with draft restore, Save, Save As, lock, public read, project/table JSON download. |
| 3. Catalog + Windows slice | Prove bookshelf catalog pick + project-document copy with Window Types, frame/glazing pick, basic grid/canvas, and refresh-from-catalog. | `10-windows.md`, `00-foundation-shell.md`, `context/technical-requirements/data-table.md` | Add catalog frame/glazing in one tab; pick into a Window Type in another; save and reload. |
| 4. Envelope + assets slice | Implement Assemblies, Project Materials, Specifications, datasheet/photo asset attach, effective R/U display, and envelope export. | `20-envelope.md`, `50-settings-ops-llm.md` | Build one wall assembly, pick material, attach datasheet/photo, verify Viewer read-only cards, download construction JSON/HBJSON export. |
| 5. Model viewer slice | Upload HBJSON, parse/model-data endpoint, render R3F Model tab, file picker, color/viz/tool basics. | `40-model-viewer.md`, `50-settings-ops-llm.md` | Upload two HBJSONs, switch active file, see nonblank interactive 3D scene, use basic select/measure/color-by. |
| 6. MCP + mechanical completion | Harden MCP read/write, asset ingestion, ERV/Fans tables, placeholders for pumps/TB, concurrency edge cases, audit trail. | `30-tables-equipment.md`, `50-settings-ops-llm.md`, `00-foundation-shell.md` | Claude/MCP uploads a datasheet and attaches it; browser shows MCP edit lease; ERV/Fan rows save and reload. |
| 7. Release hardening | Resolve remaining open questions, security/ops baseline, bundle/performance budgets, e2e coverage, staging deployment. | `90-open-questions.md`, `docs/plans/2026-05-10/docs-review.md`, all story files as needed | Full MVP smoke on staging with seed and imported V1 project. |

## Loading Rules

- Start with this file plus `context/README.md` for orientation.
- Load only the story file for the active phase, plus any referenced
  shared docs (`PRD`, `UI_UX`,
  `technical-requirements/data-table.md`, `TECH_STACK`).
- Use `90-open-questions.md` when resolving questions; do not let
  resolved historical Q rows drive implementation against newer story
  text.
- When a phase lands, update this routing table and any active
  `docs/plans/<date>/...` implementation plan.
