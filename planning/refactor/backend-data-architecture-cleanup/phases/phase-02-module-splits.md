---
DATE: 2026-06-24
TIME: 18:05 EDT
STATUS: Ready
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
- `assets/uploads.py` — upload-intent + complete-upload.
- `assets/downloads.py` — signed-URL resolution + bulk-download jobs.
- `assets/sweep.py` — orphan sweep + reference GC (this also houses the REPO-3
  reference-scan; Phase 6 may later push it into SQL).
- keep a thin `service.py` (or `__init__`) composing them if call sites expect
  one surface.

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

## Risks
- Re-export churn. Mitigation: keep the original module name as a thin
  re-export shim where callers are many (the codebase already uses this pattern
  in `document.py`).
