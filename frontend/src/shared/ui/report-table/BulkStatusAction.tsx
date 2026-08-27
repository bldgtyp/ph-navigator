import { ChevronDown } from "lucide-react";
import { AppMenu, AppMenuItem } from "../AppMenu";
import { StatusDot } from "./StatusPill";
import {
  SPECIFICATION_STATUSES,
  SPECIFICATION_STATUS_LABELS,
  type SpecificationStatus,
} from "../../../features/project_document/specification-status";

/**
 * The selection state of a report's rows, rendered in the filter-chip toolbar
 * row in place of the progress summary while anything is selected.
 *
 * It sits there rather than in a floating bar because the filter chips are what
 * the batch composes with — the real gesture is "filter to Needed, select all,
 * mark Complete", and both halves of it should read as one row. See
 * `planning/archive/spec-status-batch-editing/decisions.md` D-6.
 *
 * Only rendered with a non-empty selection: the always-visible row checkboxes
 * are the way in, so the progress rollup keeps the slot until one is ticked.
 */
export function BulkStatusAction({
  selectedCount,
  selectableCount,
  onSelectAll,
  onClear,
  onSetStatus,
  disabled = false,
}: {
  selectedCount: number;
  /** Rows the current filter shows, i.e. what "Select all" would take. */
  selectableCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onSetStatus: (status: SpecificationStatus) => void;
  disabled?: boolean;
}) {
  const allSelected = selectedCount === selectableCount;
  return (
    <div className="report-bulk-action">
      <span className="report-bulk-action__count">{selectedCount} selected</span>
      {allSelected ? null : (
        <button type="button" className="text-button" onClick={onSelectAll}>
          Select all {selectableCount}
        </button>
      )}
      <AppMenu
        label={`Set spec. status for ${selectedCount} selected`}
        triggerLabel="Set spec. status"
        triggerIcon={ChevronDown}
        className={disabled ? "report-bulk-action__menu is-disabled" : "report-bulk-action__menu"}
      >
        {SPECIFICATION_STATUSES.map((status) => (
          <AppMenuItem
            key={status}
            leading={<StatusDot status={status} />}
            aria-disabled={disabled || undefined}
            onClick={() => onSetStatus(status)}
          >
            {SPECIFICATION_STATUS_LABELS[status]}
          </AppMenuItem>
        ))}
      </AppMenu>
      <button type="button" className="text-button" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
