import { Paperclip } from "lucide-react";

/**
 * Compact display-only attachment chip for report-table column cells.
 * Renders a binary presence state — have attachments vs missing.
 * Editing (upload / view / replace / detach) happens inside the
 * expanded row using the full <AttachmentCell>.
 */
export function AttachmentChipCell({ count }: { count: number }) {
  const hasFiles = count > 0;
  return (
    <span
      className="report-attachment-chip"
      data-has-files={hasFiles}
      aria-label={hasFiles ? "Attached" : "Missing"}
    >
      <Paperclip className="report-attachment-chip__glyph" size={14} aria-hidden="true" />
    </span>
  );
}
