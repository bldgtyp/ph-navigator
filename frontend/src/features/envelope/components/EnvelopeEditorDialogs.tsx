// EnvelopeEditorDialogs is the command-to-modal switchboard for the Assembly
// Builder editor. It owns transient dialog routing only; server mutation state
// remains in EnvelopePage/hooks, and each dialog component owns its own form
// draft so unit conversion and validation stay local to the active modal.
import type { CatalogMaterial } from "../../catalogs/types";
import type {
  Assembly,
  AssemblyLayer,
  AssemblySegment,
  EnvelopeCommand,
  ProjectMaterial,
} from "../types";
import { AssemblyNameDialog } from "./dialogs/AssemblyNameDialog";
import { ConfirmDialog } from "./dialogs/ConfirmDialog";
import { LengthDialog } from "./dialogs/LengthDialog";
import { SegmentDialog } from "./dialogs/SegmentDialog";

type DialogState =
  | { kind: "create-assembly" }
  | { kind: "rename-assembly"; assembly: Assembly }
  | { kind: "type-assembly"; assembly: Assembly }
  | { kind: "duplicate-assembly"; assembly: Assembly }
  | { kind: "delete-assembly"; assembly: Assembly }
  | { kind: "layer"; assembly: Assembly; layer: AssemblyLayer }
  | { kind: "add-layer"; assembly: Assembly; layer: AssemblyLayer; position: "above" | "below" }
  | { kind: "delete-layer"; assembly: Assembly; layer: AssemblyLayer }
  | { kind: "segment"; assembly: Assembly; layer: AssemblyLayer; segment: AssemblySegment }
  | {
      kind: "add-segment";
      assembly: Assembly;
      layer: AssemblyLayer;
      segment: AssemblySegment;
      position: "left" | "right";
    }
  | { kind: "delete-segment"; assembly: Assembly; layer: AssemblyLayer; segment: AssemblySegment };

export type EnvelopeEditorDialogState = DialogState;

export function EnvelopeEditorDialogs({
  dialog,
  materials,
  catalogMaterials,
  catalogMaterialsLoading,
  busy,
  error,
  onOpenCatalogPicker,
  onClose,
  onReplaceDialog,
  onCommand,
}: {
  dialog: DialogState | null;
  materials: ProjectMaterial[];
  catalogMaterials: CatalogMaterial[];
  catalogMaterialsLoading: boolean;
  busy: boolean;
  error: string | null;
  onOpenCatalogPicker: () => void;
  onClose: () => void;
  onReplaceDialog: (dialog: DialogState) => void;
  onCommand: (command: EnvelopeCommand) => void;
}) {
  if (!dialog) return null;
  if (dialog.kind === "create-assembly") {
    return (
      <AssemblyNameDialog
        title="New assembly"
        initialName="New Assembly"
        initialType="wall"
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(name, type) => onCommand({ kind: "create_assembly", name, type })}
      />
    );
  }
  if (dialog.kind === "rename-assembly") {
    return (
      <AssemblyNameDialog
        title="Rename assembly"
        initialName={dialog.assembly.name}
        initialType={dialog.assembly.type}
        hideType
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(name) =>
          onCommand({ kind: "rename_assembly", assembly_id: dialog.assembly.id, name })
        }
      />
    );
  }
  if (dialog.kind === "type-assembly") {
    return (
      <AssemblyNameDialog
        title="Assembly type"
        initialName={dialog.assembly.name}
        initialType={dialog.assembly.type}
        hideName
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(_name, type) =>
          onCommand({ kind: "update_assembly_type", assembly_id: dialog.assembly.id, type })
        }
      />
    );
  }
  if (dialog.kind === "duplicate-assembly") {
    return (
      <AssemblyNameDialog
        title="Duplicate assembly"
        initialName={`${dialog.assembly.name} Copy`}
        initialType={dialog.assembly.type}
        hideType
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(name) =>
          onCommand({ kind: "duplicate_assembly", assembly_id: dialog.assembly.id, name })
        }
      />
    );
  }
  if (dialog.kind === "delete-assembly") {
    return (
      <ConfirmDialog
        title="Delete assembly"
        message={`Delete ${dialog.assembly.name}? Segment photo references stay in the draft history but are removed from this assembly.`}
        busy={busy}
        error={error}
        onClose={onClose}
        onConfirm={() => onCommand({ kind: "delete_assembly", assembly_id: dialog.assembly.id })}
      />
    );
  }
  if (dialog.kind === "layer") {
    return (
      <LengthDialog
        title="Layer thickness"
        label="Thickness"
        initialValueMm={dialog.layer.thickness_mm}
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(thickness_mm) =>
          onCommand({
            kind: "update_layer_thickness",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            thickness_mm,
          })
        }
        onDelete={() => {
          onReplaceDialog({ kind: "delete-layer", assembly: dialog.assembly, layer: dialog.layer });
        }}
      />
    );
  }
  if (dialog.kind === "add-layer") {
    return (
      <LengthDialog
        title="Add layer"
        label="Thickness"
        initialValueMm={100}
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(thickness_mm) =>
          onCommand({
            kind: "add_layer",
            assembly_id: dialog.assembly.id,
            target_layer_id: dialog.layer.id,
            position: dialog.position,
            thickness_mm,
          })
        }
      />
    );
  }
  if (dialog.kind === "delete-layer") {
    return (
      <ConfirmDialog
        title="Delete layer"
        message={`Delete layer ${dialog.layer.order + 1}?`}
        busy={busy}
        error={error}
        onClose={onClose}
        onConfirm={() =>
          onCommand({
            kind: "delete_layer",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
          })
        }
      />
    );
  }
  if (dialog.kind === "segment") {
    return (
      <SegmentDialog
        title="Segment properties"
        segment={dialog.segment}
        materials={materials}
        catalogMaterials={catalogMaterials}
        catalogMaterialsLoading={catalogMaterialsLoading}
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(values) =>
          onCommand({
            kind: "update_segment",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            segment_id: dialog.segment.id,
            ...values,
          })
        }
        onPickProjectMaterial={(project_material_id) =>
          onCommand({
            kind: "pick_project_material",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            segment_id: dialog.segment.id,
            project_material_id,
          })
        }
        onPickCatalogMaterial={(catalog_material_id) =>
          onCommand({
            kind: "pick_catalog_material",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            segment_id: dialog.segment.id,
            catalog_material_id,
          })
        }
        onOpenCatalogPicker={onOpenCatalogPicker}
        onDelete={() => {
          onReplaceDialog({
            kind: "delete-segment",
            assembly: dialog.assembly,
            layer: dialog.layer,
            segment: dialog.segment,
          });
        }}
      />
    );
  }
  if (dialog.kind === "add-segment") {
    return (
      <LengthDialog
        title="Add segment"
        label="Width"
        initialValueMm={dialog.segment.width_mm}
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(width_mm) =>
          onCommand({
            kind: "add_segment",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            target_segment_id: dialog.segment.id,
            position: dialog.position,
            width_mm,
          })
        }
      />
    );
  }
  return (
    <ConfirmDialog
      title="Delete segment"
      message={`Delete segment ${dialog.segment.order + 1}?`}
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={() =>
        onCommand({
          kind: "delete_segment",
          assembly_id: dialog.assembly.id,
          layer_id: dialog.layer.id,
          segment_id: dialog.segment.id,
        })
      }
    />
  );
}
