# TB-08e Code Review

Date: 2026-05-14
Reviewer: Codex
Scope: Current uncommitted files implementing TB-08.e, reviewed against `docs/plans/01_IMPLEMENTATION-ROADMAP.md` and `context/CODING_STANDARDS.md`.

## Findings

No blocking findings.

I did not find important architectural, security, or performance issues in the TB-08e implementation as scoped. The change is a narrow frontend-only extraction of the duplicate Rooms/Window Types table-slice client path into `createTableSliceFeature`, and the important behavior from the two concrete call sites is preserved:

- editor vs viewer fetch branch still maps to `/draft/tables/{table}` vs `/document/tables/{table}`;
- replace still writes only to the draft table endpoint;
- `If-Match` is used when a draft ETag exists and `If-Match-Version` is used when replacing from a saved-version source;
- mutation success still updates the editor slice cache, marks the local draft touched, and invalidates the project-document draft summary;
- Rooms keeps its BroadcastChannel flow outside the factory, which matches the TB-08.e lesson that Windows does not have the second concrete broadcast shape yet;
- structured API error/request-id handling remains centralized in `fetchJson`, so the factory does not bypass the existing error envelope path.

## Scope Check

TB-08.e asks for a conservative pre-TB-09 refactor, not final Windows completeness. Against that scope, the implementation is complete:

- `frontend/src/features/project_document/table-slice.ts` adds the shared factory without generalizing past the Rooms/Window Types needs.
- `frontend/src/features/equipment/api.ts` and `frontend/src/features/windows/api.ts` now instantiate the factory while preserving the existing exported fetch/replace function names.
- `frontend/src/features/equipment/hooks.ts` and `frontend/src/features/windows/hooks.ts` re-export the factory hooks/query keys while leaving feature-specific behavior in the feature modules.
- `frontend/src/features/project_document/table-slice.test.ts` covers the core factory contract: query key shape, saved/draft fetch branching, and ETag header selection.

Items deliberately not considered incomplete for TB-08.e:

- Windows BroadcastChannel sync and draft-stale/version-locked reconciliation.
- TB-09 refresh-from-catalog drift detection and apply UI.
- Additional browser/e2e proof beyond the TB-08.e roadmap note.
- Final app coverage for every project-document table type.

## PRD / Context Alignment

The extraction aligns with the frontend standards in `context/CODING_STANDARDS.md`: server state remains in TanStack Query hooks/mutations, feature modules keep their API/hook names, and shared code only moved after two real consumers existed.

The factory lives at `frontend/src/features/project_document/table-slice.ts` instead of the roadmap's suggested `project_document/lib/` or `shared/table-slice/`. I do not consider that a defect: the behavior is project-document-specific rather than domain-neutral shared UI/client code, and colocating it with the project-document feature boundary is defensible.

## Residual Risk / Test Notes

I ran the targeted factory test:

```bash
cd frontend && npm test -- --run src/features/project_document/table-slice.test.ts
```

Result: 3 tests passed.

I did not rerun the full frontend suite, build, or browser smoke during this review. The roadmap row says those were already run for the implementation, with the known pre-existing frontend build failure in `tests/e2e/_helpers.ts:37`.
