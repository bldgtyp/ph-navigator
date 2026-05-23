export type InlineCellEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onCommit: () => void;
  onCommitAndMove: (shiftKey: boolean) => void;
};

// Borderless overlay used for text and number fields. Phase 1 will
// generalize the rendering channel for single-select popovers, but the
// text/number editor stays exactly this shape.
export function InlineCellEditor({
  value,
  onChange,
  onCancel,
  onCommit,
  onCommitAndMove,
}: InlineCellEditorProps) {
  return (
    <input
      className="data-table-cell-editor"
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCancel}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          onCancel();
        }
        if (event.key === "Tab") {
          event.preventDefault();
          onCommitAndMove(event.shiftKey);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit();
        }
      }}
    />
  );
}
