import { useEffect, useRef, useState } from "react";
import { useUnitPreference } from "../../../lib/units";
import { fetchDownload } from "../../../shared/api/client";
import { downloadBlob } from "../../../shared/lib/downloadBlob";
import { errorMessage } from "../../../shared/lib/errors";

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
  const activeRequest = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [busyFormat, setBusyFormat] = useState<ApertureUValueExportFormat | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestController.current?.abort();
    };
  }, []);

  async function download(format: ApertureUValueExportFormat): Promise<boolean> {
    if (activeRequest.current) return false;
    if (!versionId) {
      onError("Select a saved version before downloading the U-value report.");
      return false;
    }

    activeRequest.current = true;
    const controller = new AbortController();
    requestController.current = controller;
    setBusyFormat(format);
    onError(null);
    try {
      const file = await dependencies.fetchFile(
        `/api/v1/projects/${projectId}/versions/${versionId}/apertures/u-values/report/export?format=${format}&units=${unitSystem}`,
        { signal: controller.signal },
      );
      const filename =
        file.filename ?? fallbackFilename(btNumber, versionLabel, unitSystem, format);
      if (controller.signal.aborted || !mounted.current) return false;
      dependencies.saveBlob(file.blob, filename);
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      onError(errorMessage(error, "Could not download the U-value report."));
      return false;
    } finally {
      activeRequest.current = false;
      if (requestController.current === controller) requestController.current = null;
      if (mounted.current) setBusyFormat(null);
    }
  }

  return {
    download,
    busy: busyFormat !== null,
    busyFormat,
    unitSystem,
  };
}

export function fallbackFilename(
  btNumber: string,
  versionLabel: string,
  units: "SI" | "IP",
  format: ApertureUValueExportFormat,
): string {
  return `${filenamePart(btNumber, "project")}-aperture-u-values-${units}-${filenamePart(
    versionLabel,
    "version",
  )}.${format}`;
}

function filenamePart(value: string, fallback: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, 80)
      .replace(/[-_]+$/g, "") || fallback
  );
}
