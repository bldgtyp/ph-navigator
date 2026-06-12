import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { errorMessage } from "../../../shared/lib/errors";
import {
  useDeleteHbjsonFileMutation,
  useRefetchHbjsonFiles,
  type HbjsonUploadFlow,
} from "../hooks";
import type { HbjsonFile } from "../types";
import { DeleteFileDialog } from "./DeleteFileDialog";
import { FileRow } from "./FileRow";
import { UploadDropZone } from "./UploadDropZone";
import { UploadNoticeLine } from "./UploadNoticeLine";

/** UI_SPEC §2: drop zone (editors) → file rows newest-first → refresh. */
export function FilePopover({
  projectId,
  files,
  activeFileId,
  isEditor,
  uploadFlow,
  onSelect,
  onDeleted,
}: {
  projectId: string;
  files: HbjsonFile[];
  activeFileId: string | null;
  isEditor: boolean;
  uploadFlow: HbjsonUploadFlow;
  onSelect: (fileId: string) => void;
  onDeleted: (fileId: string) => void;
}) {
  const refetchFiles = useRefetchHbjsonFiles(projectId);
  const deleteMutation = useDeleteHbjsonFileMutation(projectId);
  const [deletingFile, setDeletingFile] = useState<HbjsonFile | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDelete = (file: HbjsonFile) => {
    setDeleteError(null);
    deleteMutation.mutate(file.id, {
      onSuccess: () => {
        setDeletingFile(null);
        onDeleted(file.id);
      },
      onError: (error) => setDeleteError(errorMessage(error, "Could not delete file.")),
    });
  };

  return (
    <div className="model-file-popover" role="dialog" aria-label="HBJSON files">
      {isEditor ? (
        <>
          <UploadDropZone onFile={uploadFlow.handleFile} progress={uploadFlow.progress} />
          <UploadNoticeLine
            notice={uploadFlow.notice}
            onSwitch={(fileId) => {
              uploadFlow.clearNotice();
              onSelect(fileId);
            }}
          />
          <hr className="model-file-popover-divider" />
        </>
      ) : null}
      {files.length === 0 ? (
        <p className="model-file-popover-empty">No HBJSON files uploaded yet.</p>
      ) : (
        <div className="model-file-popover-rows">
          {files.map((file, index) => (
            <FileRow
              key={file.id}
              file={file}
              projectId={projectId}
              isActive={file.id === activeFileId}
              isLatest={index === 0}
              isEditor={isEditor}
              onSelect={onSelect}
              onRequestDelete={(target) => {
                setDeleteError(null);
                setDeletingFile(target);
              }}
            />
          ))}
        </div>
      )}
      <hr className="model-file-popover-divider" />
      <button
        type="button"
        className="model-file-popover-refresh"
        onClick={() => void refetchFiles()}
      >
        <RefreshCw size={13} aria-hidden="true" /> Refresh list
      </button>
      {deletingFile ? (
        <DeleteFileDialog
          file={deletingFile}
          error={deleteError}
          isDeleting={deleteMutation.isPending}
          onCancel={() => {
            setDeletingFile(null);
            setDeleteError(null);
          }}
          onConfirm={() => confirmDelete(deletingFile)}
        />
      ) : null}
    </div>
  );
}
