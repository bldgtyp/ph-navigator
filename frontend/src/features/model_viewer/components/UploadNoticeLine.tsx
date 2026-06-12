import type { UploadNotice } from "../hooks";

/**
 * Inline message surface under a drop zone (D-06: no global toast system).
 * The duplicate notice carries the "[Switch]" action from US-VIEW-1 crit. 3.
 */
export function UploadNoticeLine({
  notice,
  onSwitch,
}: {
  notice: UploadNotice | null;
  onSwitch: (fileId: string) => void;
}) {
  if (notice === null) return null;
  if (notice.kind === "duplicate") {
    return (
      <p className="model-upload-notice" role="status">
        {notice.message}{" "}
        <button type="button" className="text-link" onClick={() => onSwitch(notice.existingFileId)}>
          Switch
        </button>
      </p>
    );
  }
  return (
    <p className="model-upload-notice form-error" role="alert">
      {notice.message}
    </p>
  );
}
