// Backward-compat shim. The real implementations now live under
// `./lib/` — see `docs/plans/2026-05-25/plan-23-frontend-refactor-phased.md`
// §Phase 1. External callers can keep importing from this path while
// internal `data-table/` modules migrate to the concrete sub-package
// paths.
export * from "./lib/index";
