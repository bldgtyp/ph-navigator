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
    >
      <ProjectMaterialEditor
        material={material}
        busy={busy}
        error={error}
        onCancel={onClose}
        onCommand={onCommand}
      />
    </ModalDialog>
  );
}
