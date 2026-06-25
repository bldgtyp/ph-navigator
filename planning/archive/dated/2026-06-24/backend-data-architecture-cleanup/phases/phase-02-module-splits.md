---
DATE: 2026-06-24
TIME: 19:02 EDT
STATUS: Complete
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 2 — split the oversized modules (non-aperture set).
RELATED: ../PLAN.md, planning/code-reviews/2026-06-24/backend-data-architecture-review.md (§6.3)
DEPENDS_ON: none for this set. `document.py` split → Phase 3; `heat_pumps.py` split → sibling write-unification refactor.
---

# Phase 2 — Module Splits

## Goal

Bring the oversized modules under a comfortable review size (~600 lines target;
1000 hard ceiling per `CODING_STANDARDS.md`). Pure behavior-preserving
refactor — no logic changes, only file boundaries + imports. Improves
maintainability and makes the later phases' diffs legible.

## Scope (this phase: the WIP-safe, self-contained splits)

### 2.1 `assets/service.py` (875) → split by workflow
One `AssetService` spans upload-intent, complete-upload, metadata/list/delete,
signed-URL resolution, bulk-download jobs, and orphan-sweep/reference-GC. Split:
- `assets/service.py` — preserved public `AssetService` surface; now 514 lines
  and focused on upload/read/list/attach workflows.
- `assets/base.py` — storage/thumbnailer protocols, generated ids, shared asset
  lookup helpers.
- `assets/downloads.py` — bulk-download jobs and zip path helpers.
- `assets/orphan_sweeper.py` — orphan sweep + reference GC (this also houses the REPO-3
  reference-scan; Phase 6 may later push it into SQL).

### 2.2 `project_document/formula/evaluator.py` (870) → split the two engines
It holds two evaluators: the single-expression evaluator (`evaluate`,
`_eval_node`/`_eval_binary`/`_eval_call`) and the document-graph evaluator
(`evaluate_document_formulas`, `_eval_doc_*`). Split into:
- `formula/evaluator.py` — single-cell.
- `formula/document_evaluator.py` — document-graph.
- shared `_to_number`/`_to_text`/`_compare` primitives stay importable by both
  (in `evaluator.py` or a small `formula/_coerce.py`).

### 2.3 `mcp/tools.py` (801) → split by domain
Flat list of ~35 `tool_*` functions. Split to mirror REST feature boundaries —
`tools_projects.py`, `tools_documents.py`, `tools_assets.py`,
`tools_envelope.py` — following the existing precedent (`tools_custom_fields.py`,
`tools_model_viewer.py`). `mcp/server.py` (863) **stays whole** — it is ~40
declarative `@tool` registrations (the documented exemption); if `tools.py` is
split, group the registrations per-domain in `server.py` but do not split it.

## Deferred to their thematic phases (do NOT do here)
- `project_document/document.py` (900) → split happens in **Phase 3** (extract
  the cross-table validator to `document_validation.py`); the file is WIP-hot.
- `project_document/tables/heat_pumps.py` (843) → split falls out of the
  **sibling `table-write-architecture-unification` refactor** (it shrinks once
  the bespoke write path is removed).

## Step sequence
1. 2.2 (formula — self-contained, no WIP overlap).
2. 2.3 (mcp tools — note `apertures_mcp/tools.py` is WIP-hot but `mcp/tools.py`
   is not; don't touch the former).
3. 2.1 (assets — coordinate only if Phase 1's `assets` work is unmerged).

## Acceptance criteria
- Each split file < ~600 lines; no behavior change (tests unchanged and green).
- Public import paths preserved where external callers depend on them
  (re-export from the original module name if needed, like `document.py` does).
- `make ci` green; `ty` clean.

## Implementation notes

- Formula split:
  - `formula/evaluator.py` is now the single-cell AST evaluator.
  - `formula/document_evaluator.py` owns `evaluate_table_formulas`,
    `evaluate_document_formulas`, linked-row rollups, and document overlay cache
    state.
  - `formula/__init__.py` exports `evaluate_table_formulas` from the document
    evaluator while preserving the package public surface.
- MCP split:
  - `features.mcp.tools` is a 118-line compatibility export shim.
  - Domain implementations moved into `tools_projects.py`,
    `tools_documents.py`, `tools_assets.py`, `tools_envelope.py`, and
    `tools_shared.py`.
  - Existing precedents `tools_custom_fields.py` and `tools_model_viewer.py`
    remain unchanged.
  - The legacy `features.mcp.tools.get_asset_service` monkeypatch/import point
    is preserved for tests and callers.
- Assets split:
  - `AssetService` still imports from `features.assets.service` and composes
    `AssetBulkDownloadWorkflow` + `AssetOrphanSweepWorkflow`.
  - Shared EPW/location asset reference lookup moved to `assets/base.py`.

## Verification

Phase 2 closeout, 2026-06-24:

- `cd backend && uv run ruff check . --fix && uv run ruff format . && uv run ruff check . && uv run ty check`
- `cd backend && uv run pytest tests/test_project_document_formula_evaluator.py tests/test_mcp.py tests/test_assets_mcp.py tests/test_model_viewer_files.py tests/test_model_viewer_model_data.py tests/test_mcp_custom_fields.py tests/test_project_document_custom_fields_phase_2.py tests/test_assets_service.py tests/test_assets_orphan_sweeper.py` — 140 passed, 1 known asset 413 deprecation warning.
- `make format`
- `make ci` — backend 1097 passed, 2 skipped; frontend 1902 passed; frontend build passed. Existing warnings: React fast-refresh lint warnings, Vitest `act(...)` warnings, Recharts zero-size warnings, Vite large-chunk warning, pnpm ignored build scripts warning, and the known backend asset 413 deprecation warning.
- `graphify update .` — graph rebuilt: 13644 nodes, 36015 edges, 665 communities.

## Risks
- Re-export churn. Mitigation: keep the original module name as a thin
  re-export shim where callers are many (the codebase already uses this pattern
  in `document.py`).
