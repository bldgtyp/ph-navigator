/**
 * Compact display-only attachment chip for report-table column cells.
 * Shows "📎 +" when empty (placeholder count) or "📎 N" when populated.
 * Editing (upload / view / replace / detach) happens inside the
 * expanded row using the full <AttachmentCell>.
 */
export function AttachmentChipCell({ count }: { count: number }) {
  const hasFiles = count > 0;
  return (
    <span
      className="report-attachment-chip"
      data-has-files={hasFiles}
      aria-label={hasFiles ? `${count} attachment${count === 1 ? "" : "s"}` : "No attachments"}
    >
      <span className="report-attachment-chip__glyph" aria-hidden="true">
        📎
      </span>
      <span>{hasFiles ? count : "+"}</span>
    </span>
  );
}
