import {
  ArrowLeftRight,
  Combine,
  PaintBucket,
  Pipette,
  RotateCcw,
  Scissors,
  type LucideIcon,
  X,
} from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import type { AperturePickPasteMode } from "../store/builder-store";
import type { ApertureViewDirection } from "./ApertureSvgCanvas";
import { ViewDirectionToggle } from "./ViewDirectionToggle";
import { ZoomCluster } from "./ZoomCluster";

export function ApertureCanvasToolbar({
  zoom,
  viewDirection,
  selectionCount,
  canEdit,
  canMerge,
  canSplit,
  canFlipLeftRight,
  pickPasteMode,
  undoDepth,
  onZoomIn,
  onZoomOut,
  onFit,
  onToggleViewDirection,
  onClearSelection,
  onMerge,
  onSplit,
  onFlipLeftRight,
  onEyedropper,
  onPaintBucket,
  onUndoPaste,
}: {
  zoom: number;
  viewDirection: ApertureViewDirection;
  selectionCount: number;
  canEdit: boolean;
  canMerge: boolean;
  canSplit: boolean;
  canFlipLeftRight: boolean;
  pickPasteMode: AperturePickPasteMode;
  undoDepth: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggleViewDirection: () => void;
  onClearSelection: () => void;
  onMerge: () => void;
  onSplit: () => void;
  onFlipLeftRight: () => void;
  onEyedropper: () => void;
  onPaintBucket: () => void;
  onUndoPaste: () => void;
}) {
  return (
    <div
      className="canvas-toolbar aperture-canvas-toolbar"
      role="toolbar"
      aria-label="Aperture canvas tools"
    >
      <ViewDirectionToggle viewDirection={viewDirection} onToggle={onToggleViewDirection} />
      <ApertureToolbarDivider />
      <ZoomCluster zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFit} />
      {canEdit ? (
        <>
          <ApertureToolbarDivider />
          <ApertureToolbarButton
            icon={X}
            label="Clear selection"
            tooltip="Clear selection"
            data-testid="aperture-canvas-clear-selection"
            onClick={onClearSelection}
            disabled={selectionCount === 0}
          />
          <ApertureToolbarDivider />
          <ApertureToolbarButton
            icon={Combine}
            label="Merge selected elements"
            tooltip={`Merge selected (${selectionCount})`}
            data-testid="aperture-canvas-merge"
            onClick={onMerge}
            disabled={!canMerge}
          />
          <ApertureToolbarButton
            icon={Scissors}
            label="Split selected element"
            tooltip="Split selected element"
            data-testid="aperture-canvas-split"
            onClick={onSplit}
            disabled={!canSplit}
          />
          <ApertureToolbarButton
            icon={ArrowLeftRight}
            label="Flip left/right"
            tooltip="Flip left/right"
            data-testid="aperture-canvas-flip-left-right"
            onClick={onFlipLeftRight}
            disabled={!canFlipLeftRight}
          />
          <ApertureToolbarDivider />
          <ApertureToolbarButton
            icon={Pipette}
            label="Eyedropper"
            tooltip="Copy element assignment"
            data-testid="aperture-canvas-eyedropper"
            onClick={onEyedropper}
            aria-pressed={pickPasteMode === "picking"}
          />
          <ApertureToolbarButton
            icon={PaintBucket}
            label="Paint bucket"
            tooltip="Paste captured assignment"
            data-testid="aperture-canvas-paint-bucket"
            onClick={onPaintBucket}
            aria-pressed={pickPasteMode === "pasting"}
            disabled={pickPasteMode !== "pasting"}
          />
          <ApertureToolbarButton
            icon={RotateCcw}
            label="Undo paste"
            tooltip="Undo paste"
            data-testid="aperture-canvas-undo-paste"
            onClick={onUndoPaste}
            disabled={undoDepth === 0}
          />
        </>
      ) : null}
    </div>
  );
}

function ApertureToolbarButton({
  icon: Icon,
  label,
  tooltip,
  disabled = false,
  onClick,
  ...buttonProps
}: {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  disabled?: boolean;
  onClick: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children" | "onClick">) {
  return (
    <button
      {...buttonProps}
      type="button"
      className="canvas-toolbar__button"
      aria-label={label}
      data-toolbar-tooltip={tooltip}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}

function ApertureToolbarDivider() {
  return <span className="canvas-toolbar__divider" aria-hidden="true" />;
}
