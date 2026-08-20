import { useUnitPreference } from "../../../lib/units/useUnitPreference";
import { useDownloadExport } from "../../../shared/hooks/useDownloadExport";
import { downloadFilenamePart } from "../../../shared/lib/downloadFilename";
import { downloadAssemblyPdf } from "../api";
import { confirmDraftExport } from "../routes/page-helpers";
import type { EnvelopeReadResponse } from "../types";

export function useAssemblyPdfExport({
  projectId,
  versionId,
  btNumber,
  versionLabel,
  savedAssemblyCount,
  onError,
}: {
  projectId: string;
  versionId: string | null;
  btNumber: string;
  versionLabel: string;
  savedAssemblyCount: number | null | undefined;
  onError: (message: string | null) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const controller = useDownloadExport<"pdf">({
    scopeKey: `${projectId}:${versionId ?? ""}`,
    request: (_format, signal) => {
      if (!versionId) {
        throw new Error("Select a saved Version before downloading the Assembly PDF.");
      }
      return downloadAssemblyPdf(projectId, versionId, unitSystem, signal);
    },
    fallbackFilename: () =>
      `${downloadFilenamePart(btNumber, "project")}-assemblies-${unitSystem}-${downloadFilenamePart(
        versionLabel,
        "version",
      )}.pdf`,
    errorFallback: "Could not download the Assembly PDF.",
    onError,
  });

  async function start(current: EnvelopeReadResponse | undefined): Promise<boolean> {
    if (controller.busy || !current || savedAssemblyCount === 0) return false;
    if (!confirmDraftExport(current, "Download assemblies PDF")) return false;
    return controller.download("pdf");
  }

  return { start, busy: controller.busy, unitSystem };
}
