// Table view persistence currently uses direct fetch calls rather than
// TanStack Query (the hook owns its own loading/save state). This
// namespace is reserved for future migration to TanStack Query and is
// kept for shape consistency with other features — see
// `docs/plans/2026-05-25/plan-23-frontend-refactor-phased.md` §Phase 6.
export const tableViewQueryKeys = {
  all: ["table-views"] as const,
  scope: (projectId: string, tableKey: string) =>
    [...tableViewQueryKeys.all, projectId, tableKey] as const,
};
