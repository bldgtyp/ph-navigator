import { useRef } from "react";
import type { CellCommitMove } from "../types";

export type InlineCellEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onCommit: () => void;
  onCommitAndMove: (move: CellCommitMove) => void;
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
  const skipNextBlurCommitRef = useRef(false);

  const skipBlurCommit = () => {
    skipNextBlurCommitRef.current = true;
  };

  return (
    <input
      className="data-table-cell-editor"
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => {
        if (skipNextBlurCommitRef.current) {
          skipNextBlurCommitRef.current = false;
          return;
        }
        onCommit();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          skipBlurCommit();
          onCancel();
        }
        if (event.key === "Tab") {
          event.preventDefault();
          skipBlurCommit();
          onCommitAndMove({ kind: "tab", shiftKey: event.shiftKey });
        }
        if (event.key === "Enter") {
          event.preventDefault();
          skipBlurCommit();
          onCommitAndMove(event.shiftKey ? { kind: "insert" } : { kind: "down" });
        }
      }}
    />
  );
}
