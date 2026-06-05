import "../apertures.css";
import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import type { ProjectDetail } from "../../projects/types";
import { ApertureCanvasContainer } from "../components/ApertureCanvasContainer";
import { ApertureEmptyState } from "../components/ApertureEmptyState";
import { ApertureSidebar } from "../components/ApertureSidebar";
import { AperturesHeader } from "../components/AperturesHeader";
import { DeleteApertureDialog } from "../components/DeleteApertureDialog";
import { RenameApertureDialog } from "../components/RenameApertureDialog";
import { useApplyApertureCommandMutation, useAperturesSliceQuery } from "../hooks";
import { useApertureUValues } from "../hooks/useApertureUValues";
import { naturalSortApertures } from "../lib";
import type { ApertureCommand, ApertureTypeEntry, AperturesSlice } from "../types";

type DialogState =
  | { kind: "none" }
  | { kind: "rename"; aperture: ApertureTypeEntry }
  | { kind: "delete"; aperture: ApertureTypeEntry };

export function AperturesTab({ project }: { project: ProjectDetail }) {
  const isViewer = project.access_mode === "viewer";
  const isLocked = project.active_version?.locked ?? false;
  const canEdit = !isViewer && !isLocked && Boolean(project.active_version_id);

  const sliceQuery = useAperturesSliceQuery(
    project.id,
    project.active_version_id,
    isViewer ? "viewer" : "editor",
  );
  const mutation = useApplyApertureCommandMutation(project.id, project.active_version_id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [actionError, setActionError] = useState<string | null>(null);

  const slice = sliceQuery.data;
  const apertures = slice?.apertures ?? [];
  const sorted = useMemo(() => naturalSortApertures(apertures), [apertures]);

  useEffect(() => {
    if (selectedId && sorted.some((a) => a.id === selectedId)) return;
    setSelectedId(sorted[0]?.id ?? null);
  }, [sorted, selectedId]);

  const activeAperture = sorted.find((a) => a.id === selectedId) ?? null;
  const uValueSource: "draft" | "version" = slice?.source === "draft" ? "draft" : "version";
  const uValueQuery = useApertureUValues(project.id, project.active_version_id, uValueSource);
  const activeUValue =
    uValueQuery.data?.apertures.find((r) => r.aperture_type_id === activeAperture?.id) ?? null;
  const elementUValueById = new Map(
    activeUValue?.elements.map((e) => [e.element_id, e.u_value_w_m2k]) ?? [],
  );

  const dispatch = async (
    command: ApertureCommand,
    onSuccess?: (next: AperturesSlice) => void,
  ): Promise<AperturesSlice | null> => {
    if (!slice) return null;
    setActionError(null);
    try {
      const next = await mutation.mutateAsync({ current: slice, command });
      onSuccess?.(next);
      return next;
    } catch (error) {
      setActionError(errorMessage(error, "Could not apply aperture command."));
      return null;
    }
  };

  const handleAdd = async () => {
    const next = await dispatch({ kind: "createApertureType" });
    if (!next) return;
    const newEntry = next.apertures.find(
      (entry) => !apertures.some((prior) => prior.id === entry.id),
    );
    if (newEntry) setSelectedId(newEntry.id);
  };

  const handleRename = async (newName: string) => {
    if (dialog.kind !== "rename") return;
    const target = dialog.aperture;
    await dispatch({
      kind: "renameApertureType",
      aperture_type_id: target.id,
      new_name: newName,
    });
    setDialog({ kind: "none" });
  };

  const handleDuplicate = async (aperture: ApertureTypeEntry) => {
    const next = await dispatch({
      kind: "duplicateApertureType",
      aperture_type_id: aperture.id,
    });
    if (!next) return;
    const duplicateEntry = next.apertures.find(
      (entry) => !apertures.some((prior) => prior.id === entry.id),
    );
    if (duplicateEntry) setSelectedId(duplicateEntry.id);
  };

  const handleDelete = async () => {
    if (dialog.kind !== "delete") return;
    const target = dialog.aperture;
    const next = await dispatch({
      kind: "deleteApertureType",
      aperture_type_id: target.id,
    });
    setDialog({ kind: "none" });
    if (!next) return;
    const remainder = naturalSortApertures(next.apertures);
    setSelectedId(remainder[0]?.id ?? null);
  };

  if (sliceQuery.isLoading) {
    return <section className="tab-panel">Loading apertures...</section>;
  }
  if (sliceQuery.isError || !slice) {
    return (
      <section className="tab-panel">
        <p role="alert">{errorMessage(sliceQuery.error, "Could not load apertures.")}</p>
      </section>
    );
  }

  return (
    <section className="tab-panel apertures-page" aria-labelledby="apertures-title">
      <span id="apertures-title" className="visually-hidden">
        Apertures
      </span>
      <AperturesHeader
        activeAperture={activeAperture}
        uValue={activeUValue}
        loading={uValueQuery.isLoading}
      />
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <div className="apertures-page__body">
        <ApertureSidebar
          apertures={sorted}
          activeApertureId={activeAperture?.id ?? null}
          canEdit={canEdit}
          onSelect={setSelectedId}
          onAdd={() => void handleAdd()}
          onRename={(aperture) => setDialog({ kind: "rename", aperture })}
          onDuplicate={(aperture) => void handleDuplicate(aperture)}
          onDelete={(aperture) => setDialog({ kind: "delete", aperture })}
        />
        <main className="apertures-page__main">
          {activeAperture ? (
            <ApertureCanvasContainer
              aperture={activeAperture}
              canEdit={canEdit}
              onSetElementName={(elementId, newName) =>
                void dispatch({
                  kind: "setElementName",
                  aperture_type_id: activeAperture.id,
                  element_id: elementId,
                  new_name: newName,
                })
              }
              onEditDimension={(axis, index, newMm) =>
                void dispatch({
                  kind: "editDimension",
                  aperture_type_id: activeAperture.id,
                  axis,
                  index,
                  new_value_mm: newMm,
                })
              }
              onAddRow={(at_index) =>
                void dispatch({
                  kind: "addRow",
                  aperture_type_id: activeAperture.id,
                  at_index,
                  height_mm: 1000,
                })
              }
              onAddColumn={(at_index) =>
                void dispatch({
                  kind: "addColumn",
                  aperture_type_id: activeAperture.id,
                  at_index,
                  width_mm: 1000,
                })
              }
              onDeleteRow={(index) =>
                void dispatch({
                  kind: "deleteRow",
                  aperture_type_id: activeAperture.id,
                  index,
                })
              }
              onDeleteColumn={(index) =>
                void dispatch({
                  kind: "deleteColumn",
                  aperture_type_id: activeAperture.id,
                  index,
                })
              }
              onPickFrame={(element_id, side, frame) =>
                void dispatch({
                  kind: "pickFrame",
                  aperture_type_id: activeAperture.id,
                  element_id,
                  side,
                  frame,
                })
              }
              onPickGlazing={(element_id, glazing) =>
                void dispatch({
                  kind: "pickGlazing",
                  aperture_type_id: activeAperture.id,
                  element_id,
                  glazing,
                })
              }
              onEditFrameField={(element_id, side, field_key, new_value) =>
                void dispatch({
                  kind: "editFieldOverride",
                  aperture_type_id: activeAperture.id,
                  element_id,
                  target: `frame.${side}`,
                  field_key,
                  new_value,
                })
              }
              onEditGlazingField={(element_id, field_key, new_value) =>
                void dispatch({
                  kind: "editFieldOverride",
                  aperture_type_id: activeAperture.id,
                  element_id,
                  target: "glazing",
                  field_key,
                  new_value,
                })
              }
              onSetElementOperation={(element_id, operation) =>
                void dispatch({
                  kind: "setElementOperation",
                  aperture_type_id: activeAperture.id,
                  element_id,
                  operation,
                })
              }
              onMergeElements={(element_ids) =>
                void dispatch({
                  kind: "mergeElements",
                  aperture_type_id: activeAperture.id,
                  element_ids,
                })
              }
              onSplitElement={(element_id) =>
                void dispatch({
                  kind: "splitElement",
                  aperture_type_id: activeAperture.id,
                  element_id,
                })
              }
              onPasteAssignment={(source_element_id, target_element_ids) =>
                dispatch({
                  kind: "pasteAssignment",
                  aperture_type_id: activeAperture.id,
                  source_element_id,
                  target_element_ids,
                }).then(() => undefined)
              }
              uValueByElementId={elementUValueById}
            />
          ) : (
            <ApertureEmptyState canEdit={canEdit} onAdd={() => void handleAdd()} />
          )}
        </main>
      </div>
      {dialog.kind === "rename" ? (
        <RenameApertureDialog
          aperture={dialog.aperture}
          allApertures={sorted}
          busy={mutation.isPending}
          error={actionError}
          onClose={() => setDialog({ kind: "none" })}
          onSubmit={(newName) => void handleRename(newName)}
        />
      ) : null}
      {dialog.kind === "delete" ? (
        <DeleteApertureDialog
          aperture={dialog.aperture}
          busy={mutation.isPending}
          error={actionError}
          onClose={() => setDialog({ kind: "none" })}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </section>
  );
}
