---
DATE: 2026-06-20
TIME: 09:45 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Durable docs update, closeout gates, graph update, and archive-ready status.
RELATED:
  - planning/archive/data-table-formula-builder/README.md
  - planning/archive/data-table-formula-builder/PRD.md
  - planning/archive/data-table-formula-builder/PLAN.md
  - planning/archive/data-table-formula-builder/STATUS.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/data-model.md
  - context/UI_UX.md
  - CLAUDE.md
---

# Phase 06 - Documentation And Closeout

## Objective

Fold the accepted formula-builder behavior into durable project docs, run the
required repo closeout gates, update the code graph, and leave the feature
packet ready for review or archive.

## Entry Conditions

- Phase 01 through Phase 05 are implemented or explicitly deferred with
  rationale.
- No known red focused tests remain unless the user accepts a named blocker.
- `STATUS.md` has current phase evidence before starting closeout.

## Durable Docs To Update

Update only with implemented behavior, not aspirational plan text.

Likely docs:

- `context/technical-requirements/data-table.md`
  - formula editor UI contract;
  - shared rollout rule;
  - run policy for `@table-formula` if added.
- `context/technical-requirements/data-model.md`
  - formula grammar now includes `&`;
  - result/dependency behavior;
  - any coercion semantics for `&`.
- `context/UI_UX.md`
  - field config modal formula authoring affordances if useful.
- `planning/archive/data-table-formula-builder/STATUS.md`
  - final phase states;
  - exact verification commands and outcomes;
  - known follow-ups.
- `planning/archive/data-table-formula-builder/decisions.md`
  - create if implementation settles open decisions such as `&` precedence or
    autocomplete trigger behavior.

## Work Plan

1. Reconcile feature status.
   - Mark completed phases with actual evidence.
   - Mark deferred items explicitly; do not leave ambiguous "mostly done"
     language.
   - Record local stack/browser preconditions for any e2e evidence.

2. Fold accepted behavior into durable docs.
   - Keep `context/technical-requirements/data-table.md` focused on shared
     DataTable UI and regression coverage.
   - Keep `context/technical-requirements/data-model.md` focused on formula
     language, AST/evaluator semantics, persistence, and computed overlays.
   - Keep `context/UI_UX.md` focused on user-facing modal expectations.

3. Run simplify.
   - Use the repo's `simplify` skill as required by `CLAUDE.md`.
   - Apply only relevant cleanup; avoid unrelated refactors.

4. Run docs-pass.
   - Use the repo's `docs-pass` skill as required by `CLAUDE.md`.
   - Ensure reusable lessons are promoted to `context/` or planning
     instructions where appropriate.

5. Run format and tests.
   - `make format`.
   - If format changes files, inspect the diff.
   - Because this feature changes shared parser/evaluator/UI behavior, run
     `make ci` at final closeout.
   - Also keep focused command evidence in `STATUS.md`; `make ci` alone is not
     a substitute for named formula/table evidence.

6. Update graph.
   - Run `graphify update .` after code changes so the repo graph reflects the
     formula editor/parser updates.

7. Final status.
   - Leave `STATUS.md` with:
     - phase table;
     - verification evidence;
     - blockers/follow-ups;
     - next step: review, commit, PR, or archive depending on user direction.

## Acceptance Criteria

- Durable docs describe only implemented behavior. Complete:
  `context/technical-requirements/data-table.md`,
  `context/technical-requirements/data-model.md`, `context/UI_UX.md`, and
  `PLAN.md` were reconciled to shipped behavior.
- Feature `STATUS.md` has exact command evidence. Complete.
- `simplify` and `docs-pass` have run after code changes. Complete: local
  simplify review found no cleanup; docs-pass resulted in the durable docs
  listed above.
- `make format` and `make ci` pass, or a blocker is explicitly recorded.
  Complete in Phase 05 before Phase 06 docs; final post-doc closeout rerun is
  recorded in `STATUS.md`.
- Graphify update is run after code changes. Complete: `graphify update .`
  was run after Phase 05 code changes; Phase 06 changed docs only.
- The feature packet is internally consistent and verified and archived.
  Complete.

## Verification

Minimum closeout sequence:

```bash
make format
make ci
graphify update .
git diff --check
```

Focused evidence to preserve in `STATUS.md`:

```bash
cd backend && uv run pytest tests/test_project_document_formula_grammar.py tests/test_project_document_formula_evaluator.py tests/test_project_document_schema_mutations.py
cd frontend && pnpm exec vitest run src/shared/ui/data-table
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-formula
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke
```

Completed closeout verification:

```bash
make format
# passed, no file changes.

make ci
# passed: backend 912 passed, 2 skipped; frontend 184 files, 1760 tests, build passed.

graphify update .
# passed.

git diff --check
# passed.
```

## Risks And Watchpoints

- Do not archive the feature until implementation has landed and durable docs
  have been reconciled.
- Do not run `make ci` repeatedly during mid-phase work if the user has asked
  to defer full CI; this phase is final closeout, so full CI is appropriate.
- Do not let planning docs claim `&` support until both frontend and backend
  parser/evaluator changes are merged.

## Handoff Notes

This phase is about making the implementation durable. It is not the place for
new formula features or late UI redesign unless a closeout test exposes a real
bug.
