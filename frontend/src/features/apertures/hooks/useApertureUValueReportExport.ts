import { useUnitPreference } from "../../../lib/units";
import { fetchDownload } from "../../../shared/api/client";
import { useDownloadExport } from "../../../shared/hooks/useDownloadExport";
import { downloadBlob } from "../../../shared/lib/downloadBlob";
import { downloadFilenamePart } from "../../../shared/lib/downloadFilename";

export type ApertureUValueExportFormat = "csv" | "xlsx";

type ExportDependencies = {
  fetchFile: typeof fetchDownload;
  saveBlob: typeof downloadBlob;
};

const DEFAULT_DEPENDENCIES: ExportDependencies = {
  fetchFile: fetchDownload,
  saveBlob: downloadBlob,
};

export function useApertureUValueReportExport({
  projectId,
  versionId,
  btNumber,
  versionLabel,
  onError,
  dependencies = DEFAULT_DEPENDENCIES,
}: {
  projectId: string;
  versionId: string | null;
  btNumber: string;
  versionLabel: string;
  onError: (message: string | null) => void;
  dependencies?: ExportDependencies;
}) {
  const { unitSystem } = useUnitPreference();
  const controller = useDownloadExport<ApertureUValueExportFormat>({
    scopeKey: `${projectId}:${versionId ?? ""}`,
    request: (format, signal) => {
      if (!versionId) {
        throw new Error("Select a saved version before downloading the U-value report.");
      }
      return dependencies.fetchFile(
        `/api/v1/projects/${projectId}/versions/${versionId}/apertures/u-values/report/export?format=${format}&units=${unitSystem}`,
        { signal },
      );
    },
    fallbackFilename: (format) => fallbackFilename(btNumber, versionLabel, unitSystem, format),
    errorFallback: "Could not download the U-value report.",
    onError,
    saveBlob: dependencies.saveBlob,
  });

  return {
    download: controller.download,
    busy: controller.busy,
    busyFormat: controller.busyValue,
    unitSystem,
  };
}

export function fallbackFilename(
  btNumber: string,
  versionLabel: string,
  units: "SI" | "IP",
  format: ApertureUValueExportFormat,
): string {
  return `${downloadFilenamePart(btNumber, "project")}-aperture-u-values-${units}-${downloadFilenamePart(
    versionLabel,
    "version",
  )}.${format}`;
}
