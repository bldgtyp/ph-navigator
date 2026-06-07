import { Plus } from "lucide-react";
import { useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import {
  elementInsertTargetAtPointMm,
  elementRectMm,
  elementRegionsMm,
  mirrorApertureForInterior,
  type ElementInsertTarget,
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
  pickPasteMode = "idle",
  pickedSourceElementId = null,
  pasteFlashElementId = null,
  onPickElement,
  onPasteElement,
  onInsertRow,
  onInsertColumn,
}: {
  aperture: ApertureTypeEntry;
  zoom: number;
  viewDirection: ApertureViewDirection;
  canEdit: boolean;
  onSetElementName: (elementId: string, newName: string) => void;
  onRegionClick?: (elementId: string, region: ApertureRegionKind) => void;
  /** Phase 08: pick/paste machine state surfaced for source-ring +
   *  pulse styling and to gate element click intent. */
  pickPasteMode?: "idle" | "picking" | "picked" | "pasting";
  pickedSourceElementId?: string | null;
  pasteFlashElementId?: string | null;
  /** Click intent when ``pickPasteMode === "picking"``. */
  onPickElement?: (element: ApertureElement) => void;
  /** Click intent when ``pickPasteMode === "pasting"``. */
  onPasteElement?: (element: ApertureElement) => void;
  onInsertRow?: (atIndex: number) => void;
  onInsertColumn?: (atIndex: number) => void;
}) {
  const [insertTarget, setInsertTarget] = useState<{
    elementId: string;
    target: ElementInsertTarget;
    elementRect: RectMm;
  } | null>(null);
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
    // Phase 08: when the pick/paste machine is active, the click drives
    // the machine and the selection model is bypassed.
    if (pickPasteMode === "picking") {
      event.stopPropagation();
      onPickElement?.(element);
      return;
    }
    if (pickPasteMode === "pasting") {
      event.stopPropagation();
      onPasteElement?.(element);
      return;
    }
    if (event.shiftKey) extendSelection(aperture.id, element.id);
    else if (event.metaKey || event.ctrlKey) toggleSelection(aperture.id, element.id);
    else selectSingle(aperture.id, element.id);
  };

  const onBackgroundClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    clearSelection(aperture.id);
  };

  const style: CSSProperties = { width: `${pxW}px`, height: `${pxH}px` };
  const allowInsert = canEdit && pickPasteMode === "idle";

  const handleElementMouseMove = (
    element: ApertureElement,
    rect: RectMm,
    event: MouseEvent<HTMLDivElement>,
  ) => {
    if (!allowInsert) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = pxFromMm(1, zoom);
    if (bounds.width <= 0 || bounds.height <= 0 || scale <= 0) return;
    const point = {
      x: rect.x + (event.clientX - bounds.left) / scale,
      y: rect.y + (event.clientY - bounds.top) / scale,
    };
    setInsertTarget({
      elementId: element.id,
      target: elementInsertTargetAtPointMm(rendered, element, point),
      elementRect: rect,
    });
  };

  const handleInsertClick = (target: ElementInsertTarget, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (target.axis === "row") {
      onInsertRow?.(target.atIndex);
      return;
    }
    const canonicalIndex =
      viewDirection === "interior"
        ? aperture.column_widths_mm.length - target.atIndex
        : target.atIndex;
    onInsertColumn?.(canonicalIndex);
  };

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
        setInsertTarget(null);
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
            data-pick-source={pickedSourceElementId === element.id ? "true" : undefined}
            data-paste-flash={pasteFlashElementId === element.id ? "true" : undefined}
            data-pick-paste-mode={pickPasteMode !== "idle" ? pickPasteMode : undefined}
            aria-selected={isSelected}
            style={elementStyle(rect, zoom)}
            onClick={(event) => onElementClick(element, event)}
            onMouseEnter={() => setHoveredElement(element.id)}
            onMouseMove={(event) => handleElementMouseMove(element, rect, event)}
            onMouseLeave={() => {
              setHoveredElement(null);
              setInsertTarget((current) => (current?.elementId === element.id ? null : current));
            }}
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
            {allowInsert && insertTarget?.elementId === element.id ? (
              <button
                type="button"
                className={`aperture-edge-add aperture-insert-button aperture-insert-button--${insertTarget.target.edge}`}
                style={insertButtonStyle(insertTarget.target, insertTarget.elementRect, zoom)}
                title={insertLabel(insertTarget.target)}
                aria-label={insertLabel(insertTarget.target)}
                data-testid={`aperture-insert-${element.id}-${insertTarget.target.edge}`}
                data-insert-axis={insertTarget.target.axis}
                data-insert-index={insertTarget.target.atIndex}
                data-insert-row={insertTarget.target.rowIndex}
                data-insert-column={insertTarget.target.columnIndex}
                onClick={(event) => handleInsertClick(insertTarget.target, event)}
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            ) : null}
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

function insertButtonStyle(
  target: ElementInsertTarget,
  elementRect: RectMm,
  zoom: number,
): CSSProperties {
  const { edge, cellRect } = target;
  const xMm =
    edge === "left"
      ? cellRect.x
      : edge === "right"
        ? cellRect.x + cellRect.width
        : cellRect.x + cellRect.width / 2;
  const yMm =
    edge === "top"
      ? cellRect.y
      : edge === "bottom"
        ? cellRect.y + cellRect.height
        : cellRect.y + cellRect.height / 2;
  return {
    left: `${pxFromMm(xMm - elementRect.x, zoom)}px`,
    top: `${pxFromMm(yMm - elementRect.y, zoom)}px`,
  };
}

function insertLabel(target: ElementInsertTarget): string {
  if (target.edge === "top") return "Insert row above";
  if (target.edge === "bottom") return "Insert row below";
  if (target.edge === "left") return "Insert column left";
  return "Insert column right";
}
