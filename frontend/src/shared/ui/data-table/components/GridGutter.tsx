// Row-number / row-select gutter cell. Lives outside the TanStack
// column model (PoC L2.2) so column-level features (sort, group,
// filter, copy) don't interact with it. Phase 2 will add a checkbox
// inside this cell for multi-row select.
export type GridGutterProps = {
  rowNumber: number;
  onSelectRow: () => void;
};

export function GridGutter({ rowNumber, onSelectRow }: GridGutterProps) {
  return (
    <th className="data-table-gutter" scope="row">
      <button
        type="button"
        aria-label={`Select row ${rowNumber}`}
        tabIndex={-1}
        onClick={onSelectRow}
      >
        {rowNumber}
      </button>
    </th>
  );
}
