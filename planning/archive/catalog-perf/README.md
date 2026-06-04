# Catalog Performance Pass — Planning

This folder holds the tracked planning packet for the performance
refactor triggered by the Materials Catalog code review on
2026-06-04.

The feature is named for the trigger — the Materials Catalog felt
sluggish — but the phases are deliberately cross-cutting: gzip
benefits every JSON endpoint, row virtualization benefits every
`DataTable` consumer, and the API-shape changes set the right
contract for future catalogs.

## Read order

1. `STATUS.md` — current state, next step, blockers, verification
2. `PRD.md` — requirements + intent + non-goals
3. `phases/phase-01-gzip-middleware.md`
4. `phases/phase-02-client-side-active-filter.md`
5. `phases/phase-03-datatable-virtualization.md`
6. `phases/phase-04-payload-trim.md`
7. `phases/phase-05-pagination.md`

## Related

- Trigger review:
  `planning/code-reviews/2026-06-04/materials-catalog-performance-review.md`
- Adjacent feature: the auth pipeline does 3 DB queries + a row lock
  per authenticated request. That work is tracked separately under
  `planning/features/auth-session-perf/` and is **not** in this
  feature's scope. See `planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md`
  for the full audit.
