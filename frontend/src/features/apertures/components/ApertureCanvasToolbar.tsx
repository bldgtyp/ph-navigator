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
  pickPasteMode,
  undoDepth,
  onZoomIn,
  onZoomOut,
  onFit,
  onToggleViewDirection,
  onClearSelection,
  onMerge,
  onSplit,
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
  pickPasteMode: AperturePickPasteMode;
  undoDepth: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggleViewDirection: () => void;
  onClearSelection: () => void;
  onMerge: () => void;
  onSplit: () => void;
  onEyedropper: () => void;
  onPaintBucket: () => void;
  onUndoPaste: () => void;
}) {
  return (
    <div className="aperture-canvas-toolbar" role="toolbar" aria-label="Aperture canvas tools">
      <ViewDirectionToggle viewDirection={viewDirection} onToggle={onToggleViewDirection} />
      <span className="aperture-canvas-toolbar__divider" aria-hidden="true" />
      <ZoomCluster zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFit} />
      {canEdit ? (
        <>
          <span className="aperture-canvas-toolbar__divider" aria-hidden="true" />
          <button
            type="button"
            className="aperture-canvas-toolbar__button"
            data-testid="aperture-canvas-clear-selection"
            onClick={onClearSelection}
            disabled={selectionCount === 0}
          >
            Clear selection
          </button>
          <span className="aperture-canvas-toolbar__divider" aria-hidden="true" />
          <button
            type="button"
            className="aperture-canvas-toolbar__button"
            data-testid="aperture-canvas-merge"
            onClick={onMerge}
            disabled={!canMerge}
            title={canMerge ? `Merge selected (${selectionCount} elements)` : undefined}
          >
            Merge
          </button>
          <button
            type="button"
            className="aperture-canvas-toolbar__button"
            data-testid="aperture-canvas-split"
            onClick={onSplit}
            disabled={!canSplit}
            title={canSplit ? "Split selected element into 1×1 cells" : undefined}
          >
            Split
          </button>
          <span className="aperture-canvas-toolbar__divider" aria-hidden="true" />
          <button
            type="button"
            className="aperture-canvas-toolbar__button"
            data-testid="aperture-canvas-eyedropper"
            onClick={onEyedropper}
            aria-pressed={pickPasteMode === "picking" || pickPasteMode === "picked"}
            title="Eyedropper — copy element assignment"
          >
            Eyedropper
          </button>
          <button
            type="button"
            className="aperture-canvas-toolbar__button"
            data-testid="aperture-canvas-paint-bucket"
            onClick={onPaintBucket}
            aria-pressed={pickPasteMode === "pasting"}
            disabled={pickPasteMode !== "picked" && pickPasteMode !== "pasting"}
            title="Paint bucket — paste captured assignment"
          >
            Paint bucket
          </button>
          <button
            type="button"
            className="aperture-canvas-toolbar__button"
            data-testid="aperture-canvas-undo-paste"
            onClick={onUndoPaste}
            disabled={undoDepth === 0}
            title={undoDepth > 0 ? `Undo last paste (${undoDepth} available)` : undefined}
          >
            Undo paste
          </button>
        </>
      ) : null}
    </div>
  );
}
