import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  BASE_PX_PER_MM,
  nextZoomStep,
  previousZoomStep,
  snapZoomToStep,
} from "../canvas-constants";
import { totalApertureWidthMm } from "../aperture-geometry";
import type { ApertureTypeEntry } from "../types";
import { ApertureSvgCanvas, type ApertureViewDirection } from "./ApertureSvgCanvas";
import { ApertureCanvasToolbar } from "./ApertureCanvasToolbar";

// Phase 03 keeps zoom + view direction as component-local state. The phase
// plan calls for a user-preferences store key, but no such store exists in
// the V2 frontend yet — promoting these to persistent prefs is deferred to
// the same cleanup phase that introduces the store.
export function ApertureCanvasContainer({ aperture }: { aperture: ApertureTypeEntry }) {
  const [zoom, setZoom] = useState(1);
  const [viewDirection, setViewDirection] = useState<ApertureViewDirection>("exterior");
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  // Refit when switching to a different aperture so the canvas starts framed.
  useLayoutEffect(() => {
    fitZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperture.id]);

  return (
    <div className="aperture-canvas-container">
      <ApertureCanvasToolbar
        zoom={zoom}
        viewDirection={viewDirection}
        onZoomIn={() => setZoom((current) => nextZoomStep(current))}
        onZoomOut={() => setZoom((current) => previousZoomStep(current))}
        onFit={fitZoom}
        onToggleViewDirection={() =>
          setViewDirection((current) => (current === "exterior" ? "interior" : "exterior"))
        }
      />
      <div className="aperture-canvas-scroll" ref={scrollRef} data-testid="aperture-canvas-scroll">
        <ApertureSvgCanvas aperture={aperture} zoom={zoom} viewDirection={viewDirection} />
      </div>
    </div>
  );
}
