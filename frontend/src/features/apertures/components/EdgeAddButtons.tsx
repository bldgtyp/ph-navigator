// Four hot-zones around the canvas; each reveals a circular `+` button
// on hover. Clicking dispatches addRow (top/bottom) or addColumn
// (left/right) with the matching `at_index` (0 for start, length for end).
//
// Read-only mode hides every hot-zone — no add affordance.

import { Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { totalApertureHeightMm, totalApertureWidthMm } from "../aperture-geometry";
import { pxFromMm } from "../canvas-constants";
import type { ApertureTypeEntry } from "../types";

export type EdgeAddButtonsProps = {
  aperture: ApertureTypeEntry;
  canEdit: boolean;
  zoom: number;
  onAddRow: (at_index: number) => void;
  onAddColumn: (at_index: number) => void;
};

const HOT_ZONE_SIZE_PX = 40;

export function EdgeAddButtons({
  aperture,
  canEdit,
  zoom,
  onAddRow,
  onAddColumn,
}: EdgeAddButtonsProps) {
  if (!canEdit) return null;
  const rows = aperture.row_heights_mm.length;
  const cols = aperture.column_widths_mm.length;
  const edgeGeometryStyle = {
    "--aperture-edge-width-px": `${pxFromMm(totalApertureWidthMm(aperture), zoom)}px`,
    "--aperture-edge-height-px": `${pxFromMm(totalApertureHeightMm(aperture), zoom)}px`,
  } as CSSProperties;
  return (
    <>
      <EdgeHotZone
        edge="top"
        label="Add row at top"
        onClick={() => onAddRow(0)}
        sizePx={HOT_ZONE_SIZE_PX}
        geometryStyle={edgeGeometryStyle}
      />
      <EdgeHotZone
        edge="bottom"
        label="Add row at bottom"
        onClick={() => onAddRow(rows)}
        sizePx={HOT_ZONE_SIZE_PX}
        geometryStyle={edgeGeometryStyle}
      />
      <EdgeHotZone
        edge="left"
        label="Add column at left"
        onClick={() => onAddColumn(0)}
        sizePx={HOT_ZONE_SIZE_PX}
        geometryStyle={edgeGeometryStyle}
      />
      <EdgeHotZone
        edge="right"
        label="Add column at right"
        onClick={() => onAddColumn(cols)}
        sizePx={HOT_ZONE_SIZE_PX}
        geometryStyle={edgeGeometryStyle}
      />
    </>
  );
}

function EdgeHotZone({
  edge,
  label,
  onClick,
  sizePx,
  geometryStyle,
}: {
  edge: "top" | "bottom" | "left" | "right";
  label: string;
  onClick: () => void;
  sizePx: number;
  geometryStyle: CSSProperties;
}) {
  return (
    <div
      className={`aperture-edge-hot-zone aperture-edge-hot-zone--${edge}`}
      data-testid={`aperture-edge-${edge}`}
      style={{
        ...geometryStyle,
        // Hot-zone thickness; positioning is from CSS so the strip
        // gutters can co-exist on the same parent stack.
        [edge === "top" || edge === "bottom" ? "height" : "width"]: `${sizePx}px`,
      }}
    >
      <button
        type="button"
        className="aperture-edge-add"
        onClick={onClick}
        title={label}
        aria-label={label}
        data-testid={`aperture-edge-add-${edge}`}
      >
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
