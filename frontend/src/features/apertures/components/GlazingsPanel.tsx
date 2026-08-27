import { ApertureSpecReportPanel } from "./ApertureSpecReportPanel";
import type { ApertureDriftEntry } from "../drift-types";
import type {
  ApertureAttachmentChangeArgs,
  ApertureProductCommand,
  ProjectGlazingRead,
} from "../types";

export function GlazingsPanel({
  glazings,
  projectId,
  isViewer,
  canEdit,
  busy,
  driftEntries,
  onCommand,
  onCommandBatch,
  onAttachmentChange,
  onRefreshEntry,
}: {
  glazings: ProjectGlazingRead[];
  projectId: string;
  isViewer: boolean;
  canEdit: boolean;
  busy: boolean;
  driftEntries: ApertureDriftEntry[];
  onCommand: (command: ApertureProductCommand) => void;
  onCommandBatch: (commands: ApertureProductCommand[]) => void;
  onAttachmentChange: (change: ApertureAttachmentChangeArgs) => Promise<void> | void;
  onRefreshEntry: (entry: ApertureDriftEntry) => void;
}) {
  return (
    <ApertureSpecReportPanel
      rows={glazings}
      kind="glazing"
      productLabel="glazings"
      productColumnLabel="Glazing"
      emptyMessage="Project glazings will appear here after aperture elements reference them."
      projectId={projectId}
      isViewer={isViewer}
      canEdit={canEdit}
      busy={busy}
      driftEntries={driftEntries}
      onCommand={onCommand}
      onCommandBatch={onCommandBatch}
      onAttachmentChange={onAttachmentChange}
      onRefreshEntry={onRefreshEntry}
    />
  );
}
