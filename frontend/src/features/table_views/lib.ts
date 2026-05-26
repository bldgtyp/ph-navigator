// Feature-local pure helpers and constants for the table-views feature.
//
// View-state sanitization itself lives in `shared/ui/data-table`
// (`sanitizeViewStateForSchema`) because the same logic is used by both
// the renderer and this feature's persistence hook. This module exposes
// the feature-local constants that govern persistence cadence and error
// messaging so they can be tuned in one place.

export const SAVE_DEBOUNCE_MS = 500;

export const SAVE_FALLBACK_MESSAGE = "View persistence unavailable.";

// Re-export the shared sanitizer so consumers of `table_views` have a
// single canonical import surface for view-state helpers.
export { sanitizeViewStateForSchema } from "../../shared/ui/data-table";
