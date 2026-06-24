import { useMemo, useState } from "react";
import {
  ReportTable,
  StatusFilterChips,
  StatusPill,
  type ReportStatusKey,
  type ReportTableColumn,
  type StatusFilterOption,
  type StatusFilterValue,
} from "../../../shared/ui/report-table";
import { naturalSortByName } from "../../../shared/lib/sort";
import type { ProjectFrameRead, ProjectGlazingRead, SpecificationStatus } from "../types";

type ApertureSpecProduct = ProjectGlazingRead | ProjectFrameRead;

const STATUS_LABEL: Record<SpecificationStatus, string> = {
  missing: "Missing",
  question: "Question",
  complete: "Complete",
  na: "N/A",
};

export function ApertureSpecReportPanel<TProduct extends ApertureSpecProduct>({
  rows,
  productLabel,
  productColumnLabel,
  emptyMessage,
  isViewer,
}: {
  rows: TProduct[];
  productLabel: string;
  productColumnLabel: string;
  emptyMessage: string;
  isViewer: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue<ReportStatusKey>>("all");

  const visibleRows = useMemo(() => {
    const filtered = isViewer
      ? rows.filter((row) => row.specification_status !== "na" && row.use_sites.length > 0)
      : rows;
    return sortProducts(filtered);
  }, [isViewer, rows]);

  const statusCounts = useMemo(() => {
    const counts: Record<SpecificationStatus, number> = {
      missing: 0,
      question: 0,
      complete: 0,
      na: 0,
    };
    for (const row of visibleRows) counts[row.specification_status] += 1;
    return counts;
  }, [visibleRows]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return visibleRows;
    return visibleRows.filter((row) => row.specification_status === statusFilter);
  }, [statusFilter, visibleRows]);

  const { activeRows, backgroundRows, unusedRows } = useMemo(() => {
    const active: TProduct[] = [];
    const background: TProduct[] = [];
    const unused: TProduct[] = [];
    for (const row of filteredRows) {
      if (row.use_sites.length === 0) unused.push(row);
      else if (row.specification_status === "na") background.push(row);
      else active.push(row);
    }
    return { activeRows: active, backgroundRows: background, unusedRows: unused };
  }, [filteredRows]);

  if (visibleRows.length === 0) {
    return (
      <div className="envelope-empty" role="status">
        <h2>No project {productLabel.toLowerCase()}</h2>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const resolvedCount = statusCounts.complete + statusCounts.na;
  const totalCount = visibleRows.length;
  const filterOptions: StatusFilterOption<ReportStatusKey>[] = [
    { value: "all", label: "All", count: totalCount },
    { value: "missing", status: "missing", label: "Missing", count: statusCounts.missing },
    { value: "question", status: "question", label: "Question", count: statusCounts.question },
    { value: "complete", status: "complete", label: "Complete", count: statusCounts.complete },
    { value: "na", status: "na", label: "N/A", count: statusCounts.na },
  ];
  const columns: ReportTableColumn<TProduct>[] = [
    {
      key: "product",
      header: productColumnLabel,
      primary: true,
      width: "minmax(180px, 2fr)",
      render: (row) => <span title={row.name}>{row.name}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "minmax(120px, 1fr)",
      render: (row) => (
        <StatusPill status={row.specification_status}>
          {STATUS_LABEL[row.specification_status]}
        </StatusPill>
      ),
    },
  ];

  const showActiveSection = activeRows.length > 0 || filteredRows.length === 0;
  const showBackgroundSection =
    backgroundRows.length > 0 || (filteredRows.length === 0 && statusFilter === "na");
  const showUnusedSection = unusedRows.length > 0;

  const renderTable = (tableRows: TProduct[], message: string) => (
    <ReportTable
      rows={tableRows}
      columns={columns}
      getRowId={(row) => row.id}
      emptyMessage={message}
    />
  );

  return (
    <>
      <StatusFilterChips
        options={filterOptions}
        value={statusFilter}
        onChange={setStatusFilter}
        summary={`${resolvedCount}/${totalCount} resolved`}
      />
      <div className="materials-panel__sections">
        {showActiveSection ? (
          <section
            className="materials-panel__section"
            aria-labelledby={`${productLabel}-active-heading`}
          >
            <header className="materials-panel__section-header">
              <h2 id={`${productLabel}-active-heading`}>In scope</h2>
              <span>{activeRows.length}</span>
            </header>
            {renderTable(activeRows, `No in-scope ${productLabel} match the current filter.`)}
          </section>
        ) : null}
        {showBackgroundSection ? (
          <section
            className="materials-panel__section materials-panel__section--background"
            aria-labelledby={`${productLabel}-background-heading`}
          >
            <header className="materials-panel__section-header">
              <h2 id={`${productLabel}-background-heading`}>N/A</h2>
              <span>{backgroundRows.length}</span>
            </header>
            {renderTable(backgroundRows, `No N/A ${productLabel} match the current filter.`)}
          </section>
        ) : null}
        {showUnusedSection ? (
          <section
            className="materials-panel__section materials-panel__section--unused"
            aria-labelledby={`${productLabel}-unused-heading`}
          >
            <header className="materials-panel__section-header">
              <h2 id={`${productLabel}-unused-heading`}>Unused</h2>
              <span>{unusedRows.length}</span>
            </header>
            {renderTable(unusedRows, `No unused ${productLabel} match the current filter.`)}
          </section>
        ) : null}
      </div>
    </>
  );
}

function sortProducts<TProduct extends ApertureSpecProduct>(rows: TProduct[]): TProduct[] {
  return [0, 1, 2, 3].flatMap((priority) =>
    naturalSortByName(rows.filter((row) => productSortPriority(row) === priority)),
  );
}

function productSortPriority(row: ApertureSpecProduct): number {
  if (row.use_sites.length === 0) return 3;
  if (row.specification_status === "complete") return 1;
  if (row.specification_status === "na") return 2;
  return 0;
}
