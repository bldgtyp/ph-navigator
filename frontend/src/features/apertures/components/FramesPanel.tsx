import { ApertureSpecReportPanel } from "./ApertureSpecReportPanel";
import type { ProjectFrameRead } from "../types";

export function FramesPanel({
  frames,
  isViewer,
}: {
  frames: ProjectFrameRead[];
  isViewer: boolean;
}) {
  return (
    <ApertureSpecReportPanel
      rows={frames}
      productLabel="frames"
      productColumnLabel="Frame"
      emptyMessage="Project frames will appear here after aperture elements reference them."
      isViewer={isViewer}
    />
  );
}
