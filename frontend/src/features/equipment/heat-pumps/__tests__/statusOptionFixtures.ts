import type { FieldOption } from "../../../../shared/ui/data-table";

// The four built-in `status` options, mirroring the backend
// `status_option_list()` palette (Materials/report-status colors).
export const STATUS_OPTION_FIXTURES: FieldOption[] = [
  { id: "opt_status_complete", label: "Complete", color: "#16a34a", order: 0 },
  { id: "opt_status_needed", label: "Needed", color: "#d97706", order: 1 },
  { id: "opt_status_question", label: "Question", color: "#0ea5b7", order: 2 },
  { id: "opt_status_na", label: "N/A", color: "#9ca3af", order: 3 },
];
