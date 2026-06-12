import "../model_viewer.css";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import type { ProjectDetail } from "../../projects/types";
import { FileChip } from "../components/FileChip";
import { ModelEmptyState } from "../components/ModelEmptyState";
import { useHbjsonFilesQuery, useHbjsonUploadFlow } from "../hooks";
import { useModelViewerStore } from "../store";

/**
 * The Model tab (Phase 1 of the model-viewer feature): HBJSON file
 * management only. The viewer area renders the empty/placeholder state;
 * the 3D canvas arrives in Phase 3.
 *
 * Active file: `?file={id}` is the source of truth (US-VIEW-1 crit. 6 —
 * in-session only, deep-linkable); a missing or invalid id falls back to
 * the newest file without error. The Zustand store mirrors the resolved
 * id for the later viewer phases.
 */
export function ModelTab({ project }: { project: ProjectDetail }) {
  const isEditor = project.access_mode === "editor";
  const filesQuery = useHbjsonFilesQuery(project.id);
  const [searchParams, setSearchParams] = useSearchParams();

  const files = filesQuery.data ?? [];
  const requestedFileId = searchParams.get("file");
  const activeFile = files.find((file) => file.id === requestedFileId) ?? files[0] ?? null;
  const activeFileId = activeFile?.id ?? null;

  const setActiveFileId = useModelViewerStore((state) => state.setActiveFileId);
  useEffect(() => {
    setActiveFileId(activeFileId);
  }, [activeFileId, setActiveFileId]);

  const selectFile = (fileId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("file", fileId);
      return next;
    });
  };

  const handleDeleted = (fileId: string) => {
    if (searchParams.get("file") !== fileId) return;
    // Deleting the active file falls back to next-newest (or empty).
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("file");
      return next;
    });
  };

  const uploadFlow = useHbjsonUploadFlow(project.id, selectFile);

  if (filesQuery.isLoading) {
    return (
      <section className="tab-panel model-tab" aria-label="Model">
        <p>Loading model files...</p>
      </section>
    );
  }

  if (filesQuery.isError) {
    return (
      <section className="tab-panel model-tab" aria-label="Model">
        <p role="alert">{errorMessage(filesQuery.error, "Could not load model files.")}</p>
      </section>
    );
  }

  return (
    <section className="tab-panel model-tab" aria-label="Model">
      <div className="model-viewer-surface">
        <FileChip
          projectId={project.id}
          files={files}
          activeFile={activeFile}
          isEditor={isEditor}
          uploadFlow={uploadFlow}
          onSelect={selectFile}
          onDeleted={handleDeleted}
        />
        {activeFile ? (
          <div className="model-viewer-placeholder">
            <p className="model-viewer-placeholder-title">3D viewer arrives in Phase 3</p>
            <p className="model-viewer-placeholder-file">
              Active file: <strong>{activeFile.display_name}</strong>
            </p>
          </div>
        ) : (
          <ModelEmptyState isEditor={isEditor} uploadFlow={uploadFlow} />
        )}
      </div>
    </section>
  );
}
