import { useMemo, type CSSProperties, type MouseEvent } from "react";
import {
  elementRectMm,
  elementRegionsMm,
  mirrorApertureForInterior,
  totalApertureHeightMm,
  totalApertureWidthMm,
  type RectMm,
} from "../aperture-geometry";
import { MIN_CANVAS_WIDTH_PX, pxFromMm } from "../canvas-constants";
import {
  selectionForAperture,
  useApertureBuilderStore,
  type ApertureHoveredRegion,
} from "../store/builder-store";
import type { ApertureElement, ApertureTypeEntry } from "../types";
import { ApertureHitTarget, type ApertureRegionKind } from "./ApertureHitTarget";
import { ApertureNamePill } from "./ApertureNamePill";
import type { ApertureViewDirection } from "./ApertureSvgCanvas";

// The overlay is a DOM layer positioned directly above the SVG substrate. It
// owns hit targets, hover rings, the on-canvas name pill, and selection
// click handling. The SVG below has `pointer-events: none` so every click
// lands here. Mirrors `AssemblyCanvasOverlay` in spirit, but the SVG-vs-DOM
// split is sharper because aperture regions are simple rects.

const REGIONS: readonly ApertureRegionKind[] = ["top", "right", "bottom", "left", "glazing"];

export function ApertureCanvasOverlay({
  aperture,
  zoom,
  viewDirection,
  canEdit,
  onSetElementName,
  onRegionClick,
}: {
  aperture: ApertureTypeEntry;
  zoom: number;
  viewDirection: ApertureViewDirection;
  canEdit: boolean;
  onSetElementName: (elementId: string, newName: string) => void;
  onRegionClick?: (elementId: string, region: ApertureRegionKind) => void;
}) {
  const rendered = useMemo(
    () => (viewDirection === "interior" ? mirrorApertureForInterior(aperture) : aperture),
    [aperture, viewDirection],
  );

  const widthMm = totalApertureWidthMm(rendered);
  const heightMm = totalApertureHeightMm(rendered);
  const pxW = Math.max(MIN_CANVAS_WIDTH_PX, pxFromMm(widthMm, zoom));
  const pxH = pxFromMm(heightMm, zoom);

  const selected = useApertureBuilderStore((state) => selectionForAperture(state, aperture.id));
  const hoveredEl = useApertureBuilderStore((state) => state.hoveredElementId);
  const hoveredRegion = useApertureBuilderStore((state) => state.hoveredRegion);
  const selectSingle = useApertureBuilderStore((state) => state.selectSingle);
  const extendSelection = useApertureBuilderStore((state) => state.extendSelection);
  const toggleSelection = useApertureBuilderStore((state) => state.toggleSelection);
  const clearSelection = useApertureBuilderStore((state) => state.clearSelection);
  const setHoveredElement = useApertureBuilderStore((state) => state.setHoveredElement);
  const setHoveredRegion = useApertureBuilderStore((state) => state.setHoveredRegion);

  const onElementClick = (element: ApertureElement, event: MouseEvent<HTMLDivElement>) => {
    // Ignore clicks that bubble from the pill input or a region hit so we
    // don't double-fire on edit / pick gestures.
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-pill="true"]')) return;
    if (event.shiftKey) extendSelection(aperture.id, element.id);
    else if (event.metaKey || event.ctrlKey) toggleSelection(aperture.id, element.id);
    else selectSingle(aperture.id, element.id);
  };

  const onBackgroundClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    clearSelection(aperture.id);
  };

  const style: CSSProperties = { width: `${pxW}px`, height: `${pxH}px` };

  return (
    <div
      className="aperture-canvas-overlay"
      data-testid="aperture-canvas-overlay"
      data-view-direction={viewDirection}
      style={style}
      onClick={onBackgroundClick}
      onMouseLeave={() => {
        setHoveredElement(null);
        setHoveredRegion(null);
      }}
    >
      {rendered.elements.map((element) => {
        const rect = elementRectMm(rendered, element);
        const regions = elementRegionsMm(element, rect);
        const isSelected = selected.includes(element.id);
        return (
          <div
            key={element.id}
            className="aperture-hit aperture-hit--element"
            data-testid={`hit-element-${element.id}`}
            data-selected={isSelected ? "true" : undefined}
            data-hovered={hoveredEl === element.id ? "true" : undefined}
            aria-selected={isSelected}
            style={elementStyle(rect, zoom)}
            onClick={(event) => onElementClick(element, event)}
            onMouseEnter={() => setHoveredElement(element.id)}
            onMouseLeave={() => setHoveredElement(null)}
          >
            {REGIONS.map((region) => (
              <ApertureHitTarget
                key={region}
                elementId={element.id}
                region={region}
                rect={regions[region]}
                parentRect={rect}
                zoom={zoom}
                isHovered={isRegionHovered(hoveredRegion, element.id, region)}
                onMouseEnter={() => setHoveredRegion({ elementId: element.id, region })}
                onMouseLeave={() => setHoveredRegion(null)}
                onClick={onRegionClick ? () => onRegionClick(element.id, region) : undefined}
              />
            ))}
            <ApertureNamePill
              element={element}
              glazingRect={regions.glazing}
              parentRect={rect}
              zoom={zoom}
              canEdit={canEdit}
              onCommit={onSetElementName}
            />
          </div>
        );
      })}
    </div>
  );
}

function elementStyle(rect: RectMm, zoom: number): CSSProperties {
  return {
    left: `${pxFromMm(rect.x, zoom)}px`,
    top: `${pxFromMm(rect.y, zoom)}px`,
    width: `${pxFromMm(rect.width, zoom)}px`,
    height: `${pxFromMm(rect.height, zoom)}px`,
  };
}

function isRegionHovered(
  hovered: ApertureHoveredRegion | null,
  elementId: string,
  region: ApertureRegionKind,
): boolean {
  return hovered?.elementId === elementId && hovered.region === region;
}
