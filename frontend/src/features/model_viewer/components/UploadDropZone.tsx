import { useRef, useState } from "react";
import { ArrowDownToLine } from "lucide-react";

/**
 * Single-file drag-drop zone (US-VIEW-1 crit. 3 — multi-file is deferred).
 * Upload progress renders as a thin bar across the zone, no modal.
 */
export function UploadDropZone({
  onFile,
  progress,
}: {
  onFile: (file: File) => void;
  progress: number | null;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const acceptFirstFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`model-drop-zone${isDragOver ? " drag-over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        acceptFirstFile(event.dataTransfer.files);
      }}
    >
      <ArrowDownToLine size={18} aria-hidden="true" />
      <p>
        Drop a <code>.hbjson</code> file here, or{" "}
        <button type="button" className="text-link" onClick={() => inputRef.current?.click()}>
          browse
        </button>
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".hbjson,.json,application/json"
        hidden
        aria-label="Upload HBJSON file"
        onChange={(event) => {
          acceptFirstFile(event.target.files);
          event.target.value = "";
        }}
      />
      {progress !== null ? (
        <div
          className="model-upload-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      ) : null}
    </div>
  );
}
