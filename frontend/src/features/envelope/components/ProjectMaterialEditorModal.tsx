import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { ProjectMaterialEditor } from "./ProjectMaterialEditor";
import type { EnvelopeCommand, ProjectMaterial } from "../types";

type UpdateProjectMaterialCommand = Extract<EnvelopeCommand, { kind: "update_project_material" }>;

export function ProjectMaterialEditorModal({
  material,
  busy,
  error,
  onClose,
  onCommand,
}: {
  material: ProjectMaterial;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCommand: (command: UpdateProjectMaterialCommand) => void;
}) {
  return (
    <ModalDialog
      title={`Edit material — ${material.name}`}
      titleId="project-material-editor-title"
      onClose={onClose}
      // TODO(modal-consistency Phase 03): the child editor's footer has no
      // Cancel, so header Close is the only dismiss for now. Replace with a
      // DialogActions footer (Cancel + "Update material") and drop this prop.
      showHeaderClose
    >
      <ProjectMaterialEditor material={material} busy={busy} error={error} onCommand={onCommand} />
    </ModalDialog>
  );
}
