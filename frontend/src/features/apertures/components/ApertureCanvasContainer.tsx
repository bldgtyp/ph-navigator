import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  BASE_PX_PER_MM,
  MIN_CANVAS_WIDTH_PX,
  nextZoomStep,
  pxFromMm,
  previousZoomStep,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../canvas-constants";
import {
  mirrorApertureForInterior,
  totalApertureHeightMm,
  totalApertureWidthMm,
} from "../aperture-geometry";
import { deleteColumnImpact, deleteRowImpact } from "../delete-dimension-impact";
import type { ApertureDimFormatState } from "../hooks/useApertureDimFormat";
import {
  selectionForAperture,
  useApertureBuilderStore,
  type PickedAssignment,
} from "../store/builder-store";
import { validateMergeSelection } from "../merge-validation";
import { isSplittable } from "../split-geometry";
import { usePickPasteHandlers } from "../hooks/usePickPasteHandlers";
import type { ApertureTypeEntry } from "../types";
import { ApertureCanvasOverlay } from "./ApertureCanvasOverlay";
import { ApertureCanvasToolbar } from "./ApertureCanvasToolbar";
import { ApertureElementCardStack } from "./ApertureElementCardStack";
import { ApertureSvgCanvas, type ApertureViewDirection } from "./ApertureSvgCanvas";
import type { ApertureSide, FrameRef, GlazingRef } from "../types";
import { DeleteDimensionDialog } from "./DeleteDimensionDialog";
import { HorizontalDimensionStrip } from "./HorizontalDimensionStrip";
import { TotalDimensionsCaption } from "./TotalDimensionsCaption";
import { VerticalDimensionStrip } from "./VerticalDimensionStrip";

// Educational tooltip text shown when the user presses Delete / Backspace
// with elements selected. PRD §9.2.3: no direct-delete; route via Merge or
// row / column deletion in the dimension strips.
const NO_DIRECT_DELETE_MESSAGE =
  "To remove an element, merge it into a neighbor (Toolbar → Merge) or delete its row / column (hover the dimension label, click −).";

// Once-per-session flag for the tooltip dedupe so repeated Delete presses
// across navigations stay quiet. Module scope mirrors the "stable toast id"
// pattern the phase doc calls for with Sonner — Sonner is not in the dep
// tree in V2, so we ship a local inline notice instead.
let noDeleteTooltipShown = false;

type DimensionConfirm = { axis: "row" | "column"; index: number; customizedCount: number } | null;

// Stable empty array used by the dismissed-warning selector so Zustand's
// snapshot loop guard doesn't churn on fresh ``[]`` references.
const EMPTY_DISMISSED: readonly string[] = Object.freeze([]);

// Phase 03 + 04 keep view direction as component-local state. Zoom and
// selection live in the apertures builder Zustand store so they survive
// route-level unmounts while staying ephemeral to the browser session.
//
// Phase 05 adds the dimension strips + format selector + edge-add /
// row-column delete affordances. Dimension commands fan out through the
// optional `onDimensionCommand` callback so the route layer keeps owning
// the actual dispatch + error handling.
export function ApertureCanvasContainer({
  aperture,
  dimFormat,
  canEdit = false,
  onSetElementName,
  onEditDimension,
  onAddRow,
  onAddColumn,
  onDeleteRow,
  onDeleteColumn,
  onPickFrame,
  onPickGlazing,
  onSetElementOperation,
  onMergeElements,
  onSplitElement,
  onFlipLeftRight,
  onPasteAssignment,
  uValueByElementId,
  commandBusy = false,
}: {
  aperture: ApertureTypeEntry;
  dimFormat: ApertureDimFormatState;
  canEdit?: boolean;
  onSetElementName?: (elementId: string, newName: string) => void;
  onEditDimension?: (axis: "row" | "column", index: number, newMm: number) => void;
  onAddRow?: (at_index: number) => void;
  onAddColumn?: (at_index: number) => void;
  onDeleteRow?: (index: number) => void;
  onDeleteColumn?: (index: number) => void;
  onPickFrame?: (elementId: string, side: ApertureSide, frame: FrameRef) => void;
  onPickGlazing?: (elementId: string, glazing: GlazingRef) => void;
  onSetElementOperation?: (
    elementId: string,
    operation: import("../types").ApertureOperation | null,
  ) => void;
  onMergeElements?: (elementIds: string[]) => void;
  onSplitElement?: (elementId: string) => void;
  onFlipLeftRight?: () => void;
  onPasteAssignment?: (
    sourceElementId: string,
    targetElementIds: string[],
    payload: PickedAssignment,
  ) => Promise<void> | void;
  uValueByElementId?: Map<string, number>;
  commandBusy?: boolean;
}) {
  const [viewDirection, setViewDirection] = useState<ApertureViewDirection>("exterior");
  const [deleteTip, setDeleteTip] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DimensionConfirm>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const zoom = useApertureBuilderStore((state) => state.canvasZoom);
  const hasSessionZoom = useApertureBuilderStore((state) => state.hasCanvasZoom);
  const setZoom = useApertureBuilderStore((state) => state.setCanvasZoom);
  const didInitialFitRef = useRef(hasSessionZoom);
  const selection = useApertureBuilderStore((state) => selectionForAperture(state, aperture.id));
  const clearSelection = useApertureBuilderStore((state) => state.clearSelection);
  const dismissedOpWarnings = useApertureBuilderStore(
    (state) => state.dismissedOperationWarnings[aperture.id] ?? EMPTY_DISMISSED,
  );
  const dismissOperationWarning = useApertureBuilderStore((state) => state.dismissOperationWarning);
  const clearDismissedOperationWarnings = useApertureBuilderStore(
    (state) => state.clearDismissedOperationWarnings,
  );
  const clearPickPaste = useApertureBuilderStore((state) => state.clearPickPaste);
  const clearUndoStack = useApertureBuilderStore((state) => state.clearUndoStack);
  const {
    pickPasteMode,
    pickedAssignment,
    flashTargetId: pasteFlashTargetId,
    undoDepth,
    pasteOnto,
    undoLastPaste,
    capturePickFromElement,
    handleEyedropper,
    handlePaintBucket,
    sendEsc,
  } = usePickPasteHandlers({ apertureId: aperture.id, onPasteAssignment });

  const unitSystem = dimFormat.system === "ip" ? "ip" : "si";

  // Selection is purely a viewing aid: clear this aperture's selection when
  // it unmounts or the user switches to a different aperture.
  useEffect(() => {
    const id = aperture.id;
    return () => {
      clearSelection(id);
      clearDismissedOperationWarnings(id);
      clearUndoStack(id);
      clearPickPaste();
    };
  }, [
    aperture.id,
    clearSelection,
    clearDismissedOperationWarnings,
    clearUndoStack,
    clearPickPaste,
  ]);

  // Frame the whole unit: pick the largest zoom at which both the aperture's
  // width and height fit inside the scroll viewport (minus its edge padding),
  // clamped to the zoom range. Used for the initial auto-fit and the toolbar
  // Fit button, so a tall unit is never clipped the way a width-only fit was.
  const fitZoom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const widthMm = totalApertureWidthMm(aperture);
    const heightMm = totalApertureHeightMm(aperture);
    if (widthMm <= 0 || heightMm <= 0) {
      setZoom(1);
      return;
    }
    const style = getComputedStyle(container);
    // `|| 0` guards a non-numeric computed padding (empty string under jsdom):
    // fall back to zero padding rather than poisoning the fit with NaN.
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availW = container.clientWidth - padX;
    const availH = container.clientHeight - padY;
    // `!(x > 0)` (not `x <= 0`) so a NaN — e.g. an unmeasured container or a
    // non-numeric computed padding under jsdom — is treated as "can't fit yet"
    // and leaves the current zoom untouched rather than propagating NaN.
    if (!(availW > 0) || !(availH > 0)) return;
    const fitW = availW / (widthMm * BASE_PX_PER_MM);
    const fitH = availH / (heightMm * BASE_PX_PER_MM);
    const target = Math.min(fitW, fitH);
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, target)));
  }, [aperture, setZoom]);

  useLayoutEffect(() => {
    if (didInitialFitRef.current) return;
    didInitialFitRef.current = true;
    fitZoom();
  }, [fitZoom]);

  const rendered = useMemo(
    () => (viewDirection === "interior" ? mirrorApertureForInterior(aperture) : aperture),
    [aperture, viewDirection],
  );
  const widthMm = totalApertureWidthMm(rendered);
  const heightMm = totalApertureHeightMm(rendered);
  const pxW = Math.max(MIN_CANVAS_WIDTH_PX, pxFromMm(widthMm, zoom));
  const pxH = pxFromMm(heightMm, zoom);
  const columnIndexForVisual = useCallback(
    (visualIndex: number) =>
      viewDirection === "interior"
        ? aperture.column_widths_mm.length - 1 - visualIndex
        : visualIndex,
    [aperture.column_widths_mm.length, viewDirection],
  );

  const handleSetElementName = useCallback(
    (elementId: string, newName: string) => {
      onSetElementName?.(elementId, newName);
    },
    [onSetElementName],
  );

  const handleEditRow = useCallback(
    (index: number, newMm: number) => onEditDimension?.("row", index, newMm),
    [onEditDimension],
  );
  const handleEditColumn = useCallback(
    (index: number, newMm: number) => onEditDimension?.("column", index, newMm),
    [onEditDimension],
  );

  const handleRequestDeleteRow = useCallback(
    (index: number) => {
      const impact = deleteRowImpact(aperture, index);
      if (impact.customizedCount === 0) {
        onDeleteRow?.(index);
        return;
      }
      setPendingDelete({ axis: "row", index, customizedCount: impact.customizedCount });
    },
    [aperture, onDeleteRow],
  );

  const handleRequestDeleteColumn = useCallback(
    (index: number) => {
      const impact = deleteColumnImpact(aperture, index);
      if (impact.customizedCount === 0) {
        onDeleteColumn?.(index);
        return;
      }
      setPendingDelete({ axis: "column", index, customizedCount: impact.customizedCount });
    },
    [aperture, onDeleteColumn],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    if (pendingDelete.axis === "row") onDeleteRow?.(pendingDelete.index);
    else onDeleteColumn?.(pendingDelete.index);
    setPendingDelete(null);
  }, [onDeleteColumn, onDeleteRow, pendingDelete]);

  const mergeValidation = validateMergeSelection(aperture, selection);
  const canMerge = canEdit && mergeValidation.ok;
  const selectedElement =
    selection.length === 1 ? (aperture.elements.find((e) => e.id === selection[0]) ?? null) : null;
  const canSplit = canEdit && selectedElement !== null && isSplittable(selectedElement);
  const canFlipLeftRight = canEdit && !commandBusy && pickPasteMode === "idle";

  const handleMerge = useCallback(() => {
    if (!canMerge || !mergeValidation.ok) return;
    onMergeElements?.(mergeValidation.sources.map((e) => e.id));
  }, [canMerge, mergeValidation, onMergeElements]);

  const handleSplit = useCallback(() => {
    if (!canSplit || !selectedElement) return;
    onSplitElement?.(selectedElement.id);
  }, [canSplit, selectedElement, onSplitElement]);

  const handleFlipLeftRight = useCallback(() => {
    if (!canFlipLeftRight) return;
    onFlipLeftRight?.();
  }, [canFlipLeftRight, onFlipLeftRight]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (pickPasteMode !== "idle") {
        event.preventDefault();
        sendEsc();
        return;
      }
      if (selection.length > 0) {
        event.preventDefault();
        clearSelection(aperture.id);
      }
      return;
    }
    if (
      canEdit &&
      (event.key === "z" || event.key === "Z") &&
      (event.metaKey || event.ctrlKey) &&
      undoDepth > 0
    ) {
      event.preventDefault();
      void undoLastPaste();
      return;
    }
    if (canEdit && (event.key === "Delete" || event.key === "Backspace") && selection.length > 0) {
      event.preventDefault();
      if (!noDeleteTooltipShown) {
        noDeleteTooltipShown = true;
        setDeleteTip(NO_DIRECT_DELETE_MESSAGE);
      }
    }
  };

  return (
    <div
      className="aperture-canvas-container"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      data-testid="aperture-canvas-container"
    >
      <TotalDimensionsCaption aperture={aperture} format={dimFormat.format} />
      <ApertureCanvasToolbar
        zoom={zoom}
        viewDirection={viewDirection}
        selectionCount={selection.length}
        canEdit={canEdit}
        canMerge={canMerge}
        canSplit={canSplit}
        canFlipLeftRight={canFlipLeftRight}
        pickPasteMode={pickPasteMode}
        undoDepth={undoDepth}
        onZoomIn={() => setZoom((current) => nextZoomStep(current))}
        onZoomOut={() => setZoom((current) => previousZoomStep(current))}
        onFit={fitZoom}
        onToggleViewDirection={() =>
          setViewDirection((current) => (current === "exterior" ? "interior" : "exterior"))
        }
        onClearSelection={() => clearSelection(aperture.id)}
        onMerge={handleMerge}
        onSplit={handleSplit}
        onFlipLeftRight={handleFlipLeftRight}
        onEyedropper={handleEyedropper}
        onPaintBucket={handlePaintBucket}
        onUndoPaste={() => void undoLastPaste()}
      />
      {deleteTip ? (
        <div
          className="aperture-canvas-notice"
          role="status"
          data-testid="aperture-no-direct-delete"
        >
          <span>{deleteTip}</span>
          <button
            type="button"
            className="aperture-canvas-notice__dismiss"
            onClick={() => setDeleteTip(null)}
            aria-label="Dismiss notice"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="aperture-canvas-scroll" ref={scrollRef} data-testid="aperture-canvas-scroll">
        <div className="aperture-canvas-grid">
          <div className="aperture-canvas-grid__gutter" />
          <div className="aperture-canvas-grid__top-edge" />
          <div className="aperture-canvas-grid__left-edge">
            <VerticalDimensionStrip
              aperture={aperture}
              zoom={zoom}
              system={unitSystem}
              format={dimFormat.format}
              canEdit={canEdit}
              onEditRow={handleEditRow}
              onRequestDeleteRow={handleRequestDeleteRow}
            />
          </div>
          <div className="aperture-canvas-grid__stage">
            <div
              className="aperture-canvas-stage"
              style={{ width: `${pxW}px`, height: `${pxH}px` }}
              data-testid="aperture-canvas-stage"
            >
              <ApertureSvgCanvas aperture={aperture} zoom={zoom} viewDirection={viewDirection} />
              <ApertureCanvasOverlay
                aperture={aperture}
                zoom={zoom}
                viewDirection={viewDirection}
                canEdit={canEdit}
                onSetElementName={handleSetElementName}
                pickPasteMode={pickPasteMode}
                pickedSourceElementId={pickedAssignment?.source_element_id ?? null}
                pasteFlashElementId={pasteFlashTargetId}
                onPickElement={(el) => capturePickFromElement(el)}
                onPasteElement={(el) => void pasteOnto(el)}
                onInsertRow={(at) => onAddRow?.(at)}
                onInsertColumn={(at) => onAddColumn?.(at)}
              />
            </div>
          </div>
          <div className="aperture-canvas-grid__bottom-edge">
            <HorizontalDimensionStrip
              aperture={rendered}
              zoom={zoom}
              system={unitSystem}
              format={dimFormat.format}
              canEdit={canEdit}
              onEditColumn={handleEditColumn}
              onRequestDeleteColumn={handleRequestDeleteColumn}
              columnIndexForVisual={columnIndexForVisual}
            />
          </div>
        </div>
      </div>
      {(onPickFrame || onPickGlazing || onSetElementName) && (
        <ApertureElementCardStack
          aperture={aperture}
          viewDirection={viewDirection}
          canEdit={canEdit}
          selectedElementIds={selection}
          onSetElementName={(elementId, newName) => handleSetElementName(elementId, newName)}
          onPickFrame={(elementId, side, frame) => onPickFrame?.(elementId, side, frame)}
          onPickGlazing={(elementId, glazing) => onPickGlazing?.(elementId, glazing)}
          onSetElementOperation={(elementId, operation) =>
            onSetElementOperation?.(elementId, operation)
          }
          dismissedOperationWarnings={dismissedOpWarnings}
          onDismissOperationWarning={(elementId) => dismissOperationWarning(aperture.id, elementId)}
          uValueByElementId={uValueByElementId}
        />
      )}
      <DeleteDimensionDialog
        open={pendingDelete !== null}
        axis={pendingDelete?.axis ?? "row"}
        index={pendingDelete?.index ?? 0}
        customizedCount={pendingDelete?.customizedCount ?? 0}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

// Test-only helper to reset the once-per-session tooltip dedupe. Production
// code never imports this.
export function __resetNoDeleteTooltipForTests(): void {
  noDeleteTooltipShown = false;
}
