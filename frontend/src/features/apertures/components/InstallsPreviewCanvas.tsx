import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { totalApertureHeightMm, totalApertureWidthMm } from "../aperture-geometry";
import { BASE_PX_PER_MM, pxFromMm } from "../canvas-constants";
import { fitInstallPreview } from "../install-preview-fit";
import { installOverlayBands, installOverlaySources } from "../install-overlay";
import type { ApertureInstallTypeSummary, ApertureSide, ApertureTypeEntry } from "../types";
import { ApertureSvgCanvas } from "./ApertureSvgCanvas";

const MIN_BAND_PX = 8;

type PreviewSize = { width: number; height: number };

export function InstallsPreviewCanvas({
  aperture,
  installTypes,
  armed,
  disabled,
  defaultTypeName,
  formatPsi,
  onEdgeClick,
}: {
  aperture: ApertureTypeEntry;
  installTypes: readonly ApertureInstallTypeSummary[];
  armed: boolean;
  disabled: boolean;
  defaultTypeName: string;
  formatPsi: (value: number | null) => string;
  onEdgeClick: (elementId: string, side: ApertureSide, rawSlot: string | null) => void;
}) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [previewSize, setPreviewSize] = useState<PreviewSize | null>(null);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const measure = () => {
      const next = { width: preview.clientWidth, height: preview.clientHeight };
      if (!(next.width > 0) || !(next.height > 0)) return;
      setPreviewSize((current) =>
        current?.width === next.width && current.height === next.height ? current : next,
      );
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  const viewport = useMemo(
    () =>
      previewSize
        ? fitInstallPreview({
            availableWidthPx: previewSize.width,
            availableHeightPx: previewSize.height,
            apertureWidthMm: totalApertureWidthMm(aperture),
            apertureHeightMm: totalApertureHeightMm(aperture),
          })
        : null,
    [aperture, previewSize],
  );
  const overlaySources = useMemo(
    () => installOverlaySources(aperture, installTypes),
    [aperture, installTypes],
  );
  const overlay = useMemo(
    () =>
      viewport
        ? installOverlayBands(overlaySources, MIN_BAND_PX / (BASE_PX_PER_MM * viewport.zoom))
        : [],
    [overlaySources, viewport],
  );

  return (
    <div
      ref={previewRef}
      className="installs-modal__preview"
      data-testid="installs-preview"
      data-ready={viewport ? "true" : "false"}
    >
      {viewport ? (
        <div
          className="installs-modal__canvas"
          data-testid="installs-preview-canvas"
          data-armed={armed ? "true" : undefined}
          style={{
            left: `${viewport.originX}px`,
            top: `${viewport.originY}px`,
            width: `${viewport.widthPx}px`,
            height: `${viewport.heightPx}px`,
          }}
        >
          <ApertureSvgCanvas
            aperture={aperture}
            zoom={viewport.zoom}
            viewDirection="exterior"
            sizingMode="exact"
          />
          <div
            className="installs-modal__overlay"
            data-testid="installs-preview-overlay"
            data-render-zoom={viewport.zoom}
          >
            {overlay.map((cell) => {
              const typeName =
                cell.kind === "mull"
                  ? "Mulled edge — Ψ-install 0 (derived)"
                  : `${cell.resolved.installTypeName ?? defaultTypeName} (${formatPsi(cell.resolved.psiWmk)})`;
              return (
                <button
                  key={`${cell.elementId}:${cell.side}`}
                  type="button"
                  className="installs-modal__edge"
                  data-testid={`install-edge-${cell.elementId}-${cell.side}`}
                  data-kind={cell.kind}
                  disabled={cell.kind === "mull" || disabled}
                  title={typeName}
                  aria-label={`${cell.side} edge — ${typeName}`}
                  style={
                    {
                      left: `${pxFromMm(cell.rect.x, viewport.zoom)}px`,
                      top: `${pxFromMm(cell.rect.y, viewport.zoom)}px`,
                      width: `${pxFromMm(cell.rect.width, viewport.zoom)}px`,
                      height: `${pxFromMm(cell.rect.height, viewport.zoom)}px`,
                      ...(cell.color ? { "--installs-tint": cell.color } : {}),
                    } as CSSProperties
                  }
                  onClick={() => onEdgeClick(cell.elementId, cell.side, cell.rawSlot)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
