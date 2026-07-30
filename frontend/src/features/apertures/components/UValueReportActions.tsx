import { Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { AppMenu, AppMenuItem } from "../../../shared/ui/AppMenu";
import type { ApertureUValueReport } from "../hooks/useApertureUValueReport";
import {
  type ApertureUValueExportFormat,
  useApertureUValueReportExport,
} from "../hooks/useApertureUValueReportExport";
import { UValueReportExportDialog } from "./UValueReportExportDialog";

export function UValueReportActions({
  projectId,
  versionId,
  report,
  hasUnsavedDraft,
  canExport,
  onError,
}: {
  projectId: string;
  versionId: string | null;
  report: ApertureUValueReport;
  hasUnsavedDraft: boolean;
  canExport: boolean;
  onError: (message: string | null) => void;
}) {
  const [pendingFormat, setPendingFormat] = useState<ApertureUValueExportFormat | null>(null);
  const exporter = useApertureUValueReportExport({
    projectId,
    versionId,
    btNumber: report.provenance.bt_number,
    versionLabel: report.provenance.version_label,
    onError,
  });
  const unfinishedCount = report.apertures.reduce(
    (total, aperture) => total + aperture.unfinished_count,
    0,
  );
  const needsConfirmation = hasUnsavedDraft || unfinishedCount > 0;

  if (!canExport) return null;

  async function start(format: ApertureUValueExportFormat): Promise<void> {
    if (exporter.busy) return;
    if (needsConfirmation) {
      setPendingFormat(format);
      return;
    }
    await exporter.download(format);
  }

  async function confirm(): Promise<void> {
    if (!pendingFormat) return;
    const format = pendingFormat;
    setPendingFormat(null);
    await exporter.download(format);
  }

  return (
    <>
      <AppMenu label="U-value report actions">
        <AppMenuItem icon={Download} disabled={exporter.busy} onClick={() => void start("csv")}>
          {exporter.busyFormat === "csv" ? "Downloading CSV…" : "Download CSV (raw data)"}
        </AppMenuItem>
        <AppMenuItem
          icon={FileSpreadsheet}
          disabled={exporter.busy}
          onClick={() => void start("xlsx")}
        >
          {exporter.busyFormat === "xlsx" ? "Downloading XLSX…" : "Download XLSX (with formulas)"}
        </AppMenuItem>
      </AppMenu>
      {pendingFormat ? (
        <UValueReportExportDialog
          format={pendingFormat}
          hasUnsavedDraft={hasUnsavedDraft}
          unfinishedCount={unfinishedCount}
          busy={exporter.busy}
          onClose={() => setPendingFormat(null)}
          onConfirm={() => void confirm()}
        />
      ) : null}
    </>
  );
}
