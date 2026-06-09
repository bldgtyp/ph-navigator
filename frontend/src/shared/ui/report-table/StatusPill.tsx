import type { ReactNode } from "react";

export type ReportStatusKey = "missing" | "question" | "complete" | "na";

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
