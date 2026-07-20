import type { ReactNode } from "react";

import type { SpecificationStatus } from "../../../features/project_document/specification-status";

/** Report-table status dots render exactly the specification statuses. */
export type ReportStatusKey = SpecificationStatus;

export function StatusDot({ status }: { status: ReportStatusKey }) {
  return <span className="report-status-dot" data-status={status} aria-hidden="true" />;
}

export function StatusPill({ status, children }: { status: ReportStatusKey; children: ReactNode }) {
  return (
    <span className="report-status-pill">
      <StatusDot status={status} />
      {children}
    </span>
  );
}
