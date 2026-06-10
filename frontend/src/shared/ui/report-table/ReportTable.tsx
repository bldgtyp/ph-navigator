import type { CSSProperties, ReactNode } from "react";
import { Fragment } from "react";

export type ReportTableColumn<T> = {
  key: string;
  header: ReactNode;
  unit?: ReactNode;
  numeric?: boolean;
  primary?: boolean;
  width?: string;
  render: (row: T) => ReactNode;
};

export function ReportTable<T>({
  rows,
  columns,
  getRowId,
  expandedRowId,
  onToggleExpand,
  renderExpansion,
  renderRowAction,
  emptyMessage,
}: {
  rows: T[];
  columns: ReportTableColumn<T>[];
  getRowId: (row: T) => string;
  expandedRowId?: string | null;
  onToggleExpand?: (id: string) => void;
  renderExpansion?: (row: T) => ReactNode;
  renderRowAction?: (row: T) => ReactNode;
  emptyMessage?: ReactNode;
}) {
  const expandable = Boolean(onToggleExpand && renderExpansion);
  const templateColumns = [
    expandable ? "28px" : null,
    ...columns.map((col) => col.width ?? "minmax(0, 1fr)"),
  ]
    .filter(Boolean)
    .join(" ");

  const gridStyle: CSSProperties = { "--report-table-columns": templateColumns } as CSSProperties;

  if (rows.length === 0) {
    return (
      <div className="report-table" role="status">
        <div className="report-table__head" style={gridStyle}>
          {expandable ? <span /> : null}
          {columns.map((col) => (
            <span key={col.key} className="report-table__head-cell">
              {col.header}
            </span>
          ))}
        </div>
        <div className="report-table__row" style={gridStyle}>
          <span className="report-table__cell">{emptyMessage ?? "No rows"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="report-table" role="table" style={gridStyle}>
      <div className="report-table__head" role="row" style={gridStyle}>
        {expandable ? <span aria-hidden="true" /> : null}
        {columns.map((col) => {
          const headClassName = [
            "report-table__head-cell",
            col.numeric ? "report-table__head-cell--numeric" : null,
            col.primary ? "report-table__head-cell--primary" : null,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <span key={col.key} role="columnheader" className={headClassName}>
              <span>{col.header}</span>
              {col.unit ? <span className="report-table__head-unit">{col.unit}</span> : null}
            </span>
          );
        })}
      </div>
      <div className="report-table__body" role="rowgroup">
        {rows.map((row) => {
          const id = getRowId(row);
          const isExpanded = expandedRowId === id;
          const rowClass = [
            "report-table__row",
            expandable ? "report-table__row--expandable" : null,
            isExpanded ? "report-table__row--expanded" : null,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <Fragment key={id}>
              <div
                role="row"
                className={rowClass}
                style={gridStyle}
                onClick={expandable ? () => onToggleExpand?.(id) : undefined}
              >
                {expandable ? (
                  <button
                    type="button"
                    className="report-table__chevron"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse row" : "Expand row"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleExpand?.(id);
                    }}
                  >
                    ▸
                  </button>
                ) : null}
                {columns.map((col) => {
                  const className = [
                    "report-table__cell",
                    col.numeric ? "report-table__cell--numeric" : null,
                    col.primary ? "report-table__cell--primary" : null,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <span
                      key={col.key}
                      role="cell"
                      className={className}
                      onClick={(event) => {
                        // Let interactive cells (selects, buttons) keep their own click handling
                        // without toggling the row expansion.
                        if (
                          event.target instanceof HTMLElement &&
                          event.target.closest("button, select, a, input, label, [role='button']")
                        ) {
                          event.stopPropagation();
                        }
                      }}
                    >
                      {col.primary && renderRowAction ? (
                        <span className="report-table__row-action" aria-hidden="false">
                          {renderRowAction(row)}
                        </span>
                      ) : null}
                      {col.render(row)}
                    </span>
                  );
                })}
              </div>
              {expandable && isExpanded ? (
                <div className="report-table__expansion" role="row">
                  {renderExpansion?.(row)}
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
