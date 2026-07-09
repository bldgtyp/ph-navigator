import { Paperclip } from "lucide-react";

/**
 * Compact display-only attachment chip for report-table column cells.
 * Renders a binary presence state — have attachments vs missing — and a
 * hover tooltip with the exact count. `noun` names what is attached so the
 * tooltip reads correctly across surfaces (datasheets, photos, …).
 * Editing (upload / view / replace / detach) happens inside the expanded
 * row using the full <AttachmentCell>.
 */
export function AttachmentChipCell({
  count,
  noun = "attachment",
}: {
  count: number;
  noun?: string;
}) {
  const hasFiles = count > 0;
  const label = hasFiles ? `${count} ${noun}${count === 1 ? "" : "s"}` : `No ${noun}s`;
  return (
    <span
      className="report-attachment-chip"
      data-has-files={hasFiles}
      title={label}
      aria-label={label}
    >
      <Paperclip className="report-attachment-chip__glyph" size={14} aria-hidden="true" />
    </span>
  );
}
