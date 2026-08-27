import { useMemo, useState } from "react";
import type { SpecificationStatus } from "../../../features/project_document/specification-status";

/** What `<ReportTable selection={…}>` needs to render and drive its select column. */
export type ReportTableSelection = {
  rowIds: ReadonlySet<string>;
  onToggle: (rowId: string) => void;
};

/**
 * Row selection for a spec report, plus the batch command its bulk action emits.
 *
 * Lives here rather than in `ReportTable` because a report page renders several
 * tables (in-scope / N/A / unused) over one selection, and "select all" means
 * *everything the current filter shows*, which no single table knows. Each
 * surface supplies its own row-id list and command factory; everything else —
 * pruning to the visible set, toggling, clearing after a batch — is the same.
 */
export function useReportSelection<TCommand>({
  selectableIds,
  makeStatusCommand,
  onCommandBatch,
}: {
  /** Row ids the active filter shows, in order. */
  selectableIds: readonly string[];
  makeStatusCommand: (rowId: string, status: SpecificationStatus) => TCommand;
  onCommandBatch: (commands: TCommand[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());

  // Selection never outlives the filter that produced it: a row the user can no
  // longer see must not be swept up by an action aimed at what is on screen.
  const rowIds = useMemo(
    () => new Set(selectableIds.filter((id) => selectedIds.has(id))),
    [selectableIds, selectedIds],
  );

  const selection: ReportTableSelection = useMemo(
    () => ({
      rowIds,
      onToggle: (rowId: string) =>
        setSelectedIds((current) => {
          const next = new Set(current);
          if (!next.delete(rowId)) next.add(rowId);
          return next;
        }),
    }),
    [rowIds],
  );

  return {
    selection,
    bulkAction: {
      selectedCount: rowIds.size,
      selectableCount: selectableIds.length,
      onSelectAll: () => setSelectedIds(new Set(selectableIds)),
      onClear: () => setSelectedIds(new Set()),
      onSetStatus: (status: SpecificationStatus) => {
        onCommandBatch([...rowIds].map((rowId) => makeStatusCommand(rowId, status)));
        setSelectedIds(new Set());
      },
    },
  };
}
