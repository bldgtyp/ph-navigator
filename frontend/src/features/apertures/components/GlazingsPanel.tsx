import { ApertureSpecReportPanel } from "./ApertureSpecReportPanel";
import type { ProjectGlazingRead } from "../types";

export function GlazingsPanel({
  glazings,
  isViewer,
}: {
  glazings: ProjectGlazingRead[];
  isViewer: boolean;
}) {
  return (
    <ApertureSpecReportPanel
      rows={glazings}
      productLabel="glazings"
      productColumnLabel="Glazing"
      emptyMessage="Project glazings will appear here after aperture elements reference them."
      isViewer={isViewer}
    />
  );
}
