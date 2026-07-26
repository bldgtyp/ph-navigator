// The small circular "+" affordance used on both axes of the assembly
// section — add-layer above/below in the dimension column, add-segment
// left/right on a segment overlay. Shared so the two callers cannot drift.
import type { MouseEvent } from "react";
import { Plus } from "lucide-react";

export function CanvasAddButton({
  id,
  label,
  tooltip,
  tooltipPlacement,
  className,
  onClick,
}: {
  id?: string;
  label: string;
  tooltip?: string;
  tooltipPlacement?: "start" | "end";
  className?: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const buttonClassName = className ? `canvas-add-button ${className}` : "canvas-add-button";
  return (
    <button
      id={id}
      type="button"
      className={buttonClassName}
      aria-label={label}
      data-toolbar-tooltip={tooltip || undefined}
      data-toolbar-tooltip-placement={tooltipPlacement}
      onClick={onClick}
    >
      <Plus size={15} aria-hidden="true" />
    </button>
  );
}
