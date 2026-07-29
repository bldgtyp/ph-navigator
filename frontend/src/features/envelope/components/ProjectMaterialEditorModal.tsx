import { ModalDialog } from "../../../shared/ui/ModalDialog";
import {
  ProjectMaterialEditor,
  type ProjectMaterialEditorInitialFocus,
} from "./ProjectMaterialEditor";
import type { EnvelopeCommand, ProjectMaterial } from "../types";

type UpdateProjectMaterialCommand = Extract<EnvelopeCommand, { kind: "update_project_material" }>;

export function ProjectMaterialEditorModal({
  material,
  busy,
  error,
  initialFocus,
  onClose,
  onCommand,
}: {
  material: ProjectMaterial;
  busy: boolean;
  error: string | null;
  initialFocus?: ProjectMaterialEditorInitialFocus;
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
        initialFocus={initialFocus}
        onCancel={onClose}
        onCommand={onCommand}
      />
    </ModalDialog>
  );
}
