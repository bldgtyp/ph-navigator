import "../model_viewer.css";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import type { ProjectDetail } from "../../projects/types";
import { FileChip } from "../components/FileChip";
import { ModelEmptyState } from "../components/ModelEmptyState";
import { ModelViewerStage } from "../components/ModelViewerStage";
import { useHbjsonFilesQuery, useHbjsonUploadFlow } from "../hooks";
import { parseModelViewerLens } from "../lib/lenses";
import { useModelViewerStore } from "../store";

/** `?file=` and `&lens=` are the shareable viewer state. */
export function ModelTab({ project }: { project: ProjectDetail }) {
  const isEditor = project.access_mode === "editor";
  const filesQuery = useHbjsonFilesQuery(project.id);
  const [searchParams, setSearchParams] = useSearchParams();

  const files = filesQuery.data ?? [];
  const requestedFileId = searchParams.get("file");
  const requestedLens = parseModelViewerLens(searchParams.get("lens"));
  const activeFile = files.find((file) => file.id === requestedFileId) ?? files[0] ?? null;
  const activeFileId = activeFile?.id ?? null;

  const setActiveFileId = useModelViewerStore((state) => state.setActiveFileId);
  const lens = useModelViewerStore((state) => state.lens);
  const setLens = useModelViewerStore((state) => state.setLens);
  useEffect(() => {
    setActiveFileId(activeFileId);
  }, [activeFileId, setActiveFileId]);

  useEffect(() => {
    setLens(requestedLens);
  }, [requestedLens, setLens]);

  useEffect(() => {
    setSearchParams(
      (current) => {
        if (current.get("lens") === lens) return current;
        const next = new URLSearchParams(current);
        next.set("lens", lens);
        return next;
      },
      { replace: true },
    );
  }, [lens, setSearchParams]);

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
          <ModelViewerStage projectId={project.id} activeFile={activeFile} />
        ) : (
          <ModelEmptyState isEditor={isEditor} uploadFlow={uploadFlow} />
        )}
      </div>
    </section>
  );
}
