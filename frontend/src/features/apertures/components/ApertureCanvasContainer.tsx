import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  snapZoomToStep,
} from "../canvas-constants";
import {
  mirrorApertureForInterior,
  totalApertureHeightMm,
  totalApertureWidthMm,
} from "../aperture-geometry";
import { selectionForAperture, useApertureBuilderStore } from "../store/builder-store";
import type { ApertureTypeEntry } from "../types";
import { ApertureCanvasOverlay } from "./ApertureCanvasOverlay";
import { ApertureCanvasToolbar } from "./ApertureCanvasToolbar";
import { ApertureSvgCanvas, type ApertureViewDirection } from "./ApertureSvgCanvas";

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

// Phase 03 + 04 keep zoom + view direction as component-local state. The
// phase plan calls for a user-preferences store key, but no such store
// exists in V2 yet — promotion is deferred to the same cleanup phase that
// introduces the store. Selection lives in the apertures builder Zustand
// store so the toolbar and overlay subscribe to the same source.
export function ApertureCanvasContainer({
  aperture,
  canEdit = false,
  onSetElementName,
}: {
  aperture: ApertureTypeEntry;
  canEdit?: boolean;
  onSetElementName?: (elementId: string, newName: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [viewDirection, setViewDirection] = useState<ApertureViewDirection>("exterior");
  const [deleteTip, setDeleteTip] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const selection = useApertureBuilderStore((state) => selectionForAperture(state, aperture.id));
  const clearSelection = useApertureBuilderStore((state) => state.clearSelection);

  // Selection is purely a viewing aid: clear this aperture's selection when
  // it unmounts or the user switches to a different aperture.
  useEffect(() => {
    const id = aperture.id;
    return () => {
      clearSelection(id);
    };
  }, [aperture.id, clearSelection]);

  const fitZoom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const widthMm = totalApertureWidthMm(aperture);
    if (widthMm <= 0) {
      setZoom(snapZoomToStep(1));
      return;
    }
    const availablePx = container.clientWidth;
    if (availablePx <= 0) return;
    const targetZoom = availablePx / (widthMm * BASE_PX_PER_MM);
    setZoom(snapZoomToStep(targetZoom));
  }, [aperture]);

  useLayoutEffect(() => {
    fitZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperture.id]);

  const rendered = viewDirection === "interior" ? mirrorApertureForInterior(aperture) : aperture;
  const widthMm = totalApertureWidthMm(rendered);
  const heightMm = totalApertureHeightMm(rendered);
  const pxW = Math.max(MIN_CANVAS_WIDTH_PX, pxFromMm(widthMm, zoom));
  const pxH = pxFromMm(heightMm, zoom);

  const handleSetElementName = useCallback(
    (elementId: string, newName: string) => {
      onSetElementName?.(elementId, newName);
    },
    [onSetElementName],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (selection.length > 0) {
        event.preventDefault();
        clearSelection(aperture.id);
      }
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
      <ApertureCanvasToolbar
        zoom={zoom}
        viewDirection={viewDirection}
        selectionCount={selection.length}
        canEdit={canEdit}
        onZoomIn={() => setZoom((current) => nextZoomStep(current))}
        onZoomOut={() => setZoom((current) => previousZoomStep(current))}
        onFit={fitZoom}
        onToggleViewDirection={() =>
          setViewDirection((current) => (current === "exterior" ? "interior" : "exterior"))
        }
        onClearSelection={() => clearSelection(aperture.id)}
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
          />
        </div>
      </div>
    </div>
  );
}

// Test-only helper to reset the once-per-session tooltip dedupe. Production
// code never imports this.
export function __resetNoDeleteTooltipForTests(): void {
  noDeleteTooltipShown = false;
}
