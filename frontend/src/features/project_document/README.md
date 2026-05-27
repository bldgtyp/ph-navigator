# project_document feature

This feature owns the **JSON-document data model** for a project — draft
summaries, document fetches, diffs, save/discard mutations, and the
generic `createTableSliceFeature` factory used by table features
(`equipment`, `windows`, ...) to wire their slices into the document.

## No `routes/`

This feature has **no route-level page components** of its own. Document
state is surfaced through other features' routes (`ProjectShell`,
`RoomsPage`, etc.) which consume the hooks and table-slice factory
exposed here. The omission is intentional — see
`planning/archive/dated/2026-05-25/plan-23-frontend-refactor-phased.md` §Phase 6
(§6.3) for the canonical shape and this documented exception.
