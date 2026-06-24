import { ApertureSpecReportPanel } from "./ApertureSpecReportPanel";
import type { ApertureDriftEntry } from "../drift-types";
import type {
  ApertureAttachmentChangeArgs,
  ApertureProductCommand,
  ProjectFrameRead,
} from "../types";

export function FramesPanel({
  frames,
  projectId,
  isViewer,
  canEdit,
  busy,
  driftEntries,
  onCommand,
  onAttachmentChange,
  onRefreshEntry,
}: {
  frames: ProjectFrameRead[];
  projectId: string;
  isViewer: boolean;
  canEdit: boolean;
  busy: boolean;
  driftEntries: ApertureDriftEntry[];
  onCommand: (command: ApertureProductCommand) => void;
  onAttachmentChange: (change: ApertureAttachmentChangeArgs) => Promise<void> | void;
  onRefreshEntry: (entry: ApertureDriftEntry) => void;
}) {
  return (
    <ApertureSpecReportPanel
      rows={frames}
      kind="frame"
      productLabel="frames"
      productColumnLabel="Frame"
      emptyMessage="Project frames will appear here after aperture elements reference them."
      projectId={projectId}
      isViewer={isViewer}
      canEdit={canEdit}
      busy={busy}
      driftEntries={driftEntries}
      onCommand={onCommand}
      onAttachmentChange={onAttachmentChange}
      onRefreshEntry={onRefreshEntry}
    />
  );
}
