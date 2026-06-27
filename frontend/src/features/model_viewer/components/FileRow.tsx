import { useState } from "react";
import { Check, Download, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { errorMessage } from "../../../shared/lib/errors";
import { formatRelativeProjectDate } from "../../../shared/lib/dates";
import { AppMenu, AppMenuItem, AppMenuLink } from "../../../shared/ui/AppMenu";
import { hbjsonFileDownloadPath } from "../api";
import { useUpdateHbjsonFileMutation } from "../hooks";
import { formatFileSizeMb } from "../lib";
import type { HbjsonFile } from "../types";

export function FileRow({
  file,
  projectId,
  isActive,
  isLatest,
  isEditor,
  onSelect,
  onRequestDelete,
}: {
  file: HbjsonFile;
  projectId: string;
  isActive: boolean;
  isLatest: boolean;
  isEditor: boolean;
  onSelect: (fileId: string) => void;
  onRequestDelete: (file: HbjsonFile) => void;
}) {
  const updateMutation = useUpdateHbjsonFileMutation(projectId);
  const [editing, setEditing] = useState<"name" | "notes" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const saveName = (value: string) => {
    const trimmed = value.trim();
    setEditing(null);
    // Empty names are rejected (US-VIEW-1 crit. 8): just revert.
    if (!trimmed || trimmed === file.display_name) return;
    setActionError(null);
    updateMutation.mutate(
      { fileId: file.id, payload: { display_name: trimmed } },
      { onError: (error) => setActionError(errorMessage(error, "Could not rename file.")) },
    );
  };

  const saveNotes = (value: string) => {
    const trimmed = value.trim();
    setEditing(null);
    if (trimmed === (file.notes ?? "")) return;
    setActionError(null);
    updateMutation.mutate(
      { fileId: file.id, payload: { notes: trimmed || null } },
      { onError: (error) => setActionError(errorMessage(error, "Could not save notes.")) },
    );
  };

  const nameLine = (
    <span className="model-file-row-name">
      {file.display_name}
      {isLatest ? <span className="model-file-row-latest">(Latest)</span> : null}
      {file.extraction_status === "failed" ? (
        <span className="model-file-row-failed" title={file.extraction_error ?? undefined}>
          Failed to parse
        </span>
      ) : null}
    </span>
  );

  const metaLine = (
    <span className="model-file-row-meta">
      {formatFileSizeMb(file.size_bytes)} · {formatRelativeProjectDate(file.uploaded_at)} ·{" "}
      {file.uploaded_by_display_name}
    </span>
  );

  return (
    <div className={`model-file-row${isActive ? " active" : ""}`}>
      {editing !== null ? (
        <div className="model-file-row-main">
          <span className="model-file-row-check" aria-hidden="true">
            {isActive ? <Check size={14} /> : null}
          </span>
          <span className="model-file-row-body">
            {editing === "name" ? (
              <input
                type="text"
                defaultValue={file.display_name}
                autoFocus
                aria-label="File name"
                onBlur={(event) => saveName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") setEditing(null);
                }}
              />
            ) : (
              nameLine
            )}
            {metaLine}
            {editing === "notes" ? (
              <textarea
                className="model-file-row-notes-editor"
                defaultValue={file.notes ?? ""}
                maxLength={1000}
                autoFocus
                aria-label="File notes"
                onBlur={(event) => saveNotes(event.target.value)}
              />
            ) : null}
          </span>
        </div>
      ) : (
        <button
          type="button"
          className="model-file-row-main"
          onClick={() => onSelect(file.id)}
          aria-current={isActive ? "true" : undefined}
        >
          <span className="model-file-row-check" aria-hidden="true">
            {isActive ? <Check size={14} /> : null}
          </span>
          <span className="model-file-row-body">
            {nameLine}
            {metaLine}
            {file.notes ? <span className="model-file-row-notes">"{file.notes}"</span> : null}
            {actionError ? (
              <span className="form-error" role="alert">
                {actionError}
              </span>
            ) : null}
          </span>
        </button>
      )}
      {/* Every action — rename/notes/delete (mutations) AND the raw .hbjson
          download (a bulk export → editor-only, CP-7) — is editor-only, so
          viewers get no actions menu at all. */}
      {isEditor ? (
        <AppMenu label={`Actions for ${file.display_name}`}>
          <AppMenuItem icon={Pencil} onClick={() => setEditing("name")}>
            Rename
          </AppMenuItem>
          <AppMenuItem icon={NotebookPen} onClick={() => setEditing("notes")}>
            Edit notes
          </AppMenuItem>
          <AppMenuLink icon={Download} href={hbjsonFileDownloadPath(projectId, file.id)}>
            Download
          </AppMenuLink>
          <AppMenuItem icon={Trash2} danger onClick={() => onRequestDelete(file)}>
            Delete
          </AppMenuItem>
        </AppMenu>
      ) : null}
    </div>
  );
}
