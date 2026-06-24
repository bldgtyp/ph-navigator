import type { SingleSelectOption } from "../types";

// The four built-in `status` options, mirroring the backend seed and the
// Materials/report-status palette. Shared across every in-scope table
// fixture so tests exercise the namespaced `<table>.status` option list.
export const STATUS_FIXTURE_OPTIONS: SingleSelectOption[] = [
  { id: "opt_status_complete", label: "Complete", color: "#16a34a", order: 0 },
  { id: "opt_status_needed", label: "Needed", color: "#d97706", order: 1 },
  { id: "opt_status_question", label: "Question", color: "#0ea5b7", order: 2 },
  { id: "opt_status_na", label: "N/A", color: "#9ca3af", order: 3 },
];
