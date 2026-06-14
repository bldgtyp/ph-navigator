import { useCallback, useRef, useState } from "react";
import { Box, ChevronDown } from "lucide-react";
import { formatProjectDate } from "../../../shared/lib/dates";
import { useOutsidePointerDown } from "../../../shared/ui/useOutsidePointerDown";
import type { HbjsonUploadFlow } from "../hooks";
import { useModelViewerPopoverEscape } from "../lib/events";
import type { HbjsonFile } from "../types";
import { FilePopover } from "./FilePopover";

/**
 * UI_SPEC §2: floating top-left chip — which model you're looking at.
 * Always visible (it is also the upload entry point); clicking opens
 * the file popover.
 */
export function FileChip({
  projectId,
  files,
  activeFile,
  isEditor,
  uploadFlow,
  onSelect,
  onDeleted,
}: {
  projectId: string;
  files: HbjsonFile[];
  activeFile: HbjsonFile | null;
  isEditor: boolean;
  uploadFlow: HbjsonUploadFlow;
  onSelect: (fileId: string) => void;
  onDeleted: (fileId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useOutsidePointerDown(rootRef, open, close);
  useModelViewerPopoverEscape(close);

  return (
    <div ref={rootRef} className="model-file-chip-root">
      <button
        type="button"
        className="chip chip--md chip--outline model-file-chip"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Choose HBJSON model file"
        onClick={() => setOpen((current) => !current)}
      >
        <Box size={14} aria-hidden="true" />
        <span className="model-file-chip-label">
          {activeFile
            ? `${activeFile.display_name} · ${formatProjectDate(activeFile.uploaded_at)}`
            : "No model uploaded"}
        </span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open ? (
        <FilePopover
          projectId={projectId}
          files={files}
          activeFileId={activeFile?.id ?? null}
          isEditor={isEditor}
          uploadFlow={uploadFlow}
          onSelect={(fileId) => {
            close();
            onSelect(fileId);
          }}
          onDeleted={onDeleted}
        />
      ) : null}
    </div>
  );
}
