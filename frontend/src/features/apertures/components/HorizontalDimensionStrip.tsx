// Per-column dimension strip rendered below the canvas. One label per
// column segment, centered at the segment midpoint; tickmarks at every
// grid line (including the right edge); a hover-revealed delete button
// on each label.

import type { CSSProperties } from "react";
import { columnXOffsetMm, totalApertureWidthMm } from "../aperture-geometry";
import { pxFromMm } from "../canvas-constants";
import type { DisplayFormat, UnitSystem } from "../../../lib/units/length/types";
import type { ApertureTypeEntry } from "../types";
import { DimensionLabel } from "./DimensionLabel";

export type HorizontalDimensionStripProps = {
  aperture: ApertureTypeEntry;
  zoom: number;
  system: UnitSystem;
  format: DisplayFormat;
  canEdit: boolean;
  onEditColumn: (index: number, newMm: number) => void;
  onRequestDeleteColumn: (index: number) => void;
};

const LAST_COLUMN_REASON = "An aperture type must have at least one row and one column.";

export function HorizontalDimensionStrip({
  aperture,
  zoom,
  system,
  format,
  canEdit,
  onEditColumn,
  onRequestDeleteColumn,
}: HorizontalDimensionStripProps) {
  const widthPx = pxFromMm(totalApertureWidthMm(aperture), zoom);
  const cols = aperture.column_widths_mm.length;
  const canDelete = cols > 1;

  return (
    <div
      className="aperture-dim-strip aperture-dim-strip--horizontal"
      data-testid="aperture-dim-strip-horizontal"
      style={{ width: `${widthPx}px` }}
    >
      {aperture.column_widths_mm.map((mm, index) => {
        const xMm = columnXOffsetMm(aperture, index);
        const leftPx = pxFromMm(xMm, zoom);
        const widthForSegmentPx = pxFromMm(mm, zoom);
        const style: CSSProperties = {
          left: `${leftPx}px`,
          width: `${widthForSegmentPx}px`,
        };
        return (
          <DimensionLabel
            key={index}
            axis="horizontal"
            mm={mm}
            system={system}
            format={format}
            canEdit={canEdit}
            canDelete={canEdit && canDelete}
            deleteDisabledReason={canDelete ? null : LAST_COLUMN_REASON}
            onCommit={(newMm) => onEditColumn(index, newMm)}
            onDelete={() => onRequestDeleteColumn(index)}
            style={style}
            ariaLabel={`Column ${index + 1} width`}
            testIdPrefix={`col-w-${index}`}
          />
        );
      })}
      {/* Tickmarks at every grid line, including the right edge. */}
      {Array.from({ length: cols + 1 }, (_, tickIndex) => {
        const xMm = columnXOffsetMm(aperture, tickIndex);
        const leftPx = pxFromMm(xMm, zoom);
        return (
          <span
            key={`tick-${tickIndex}`}
            className="aperture-dim-tick aperture-dim-tick--horizontal dimension-chrome-tick dimension-chrome-tick--horizontal"
            style={{ left: `${leftPx}px` }}
            data-testid={`col-tick-${tickIndex}`}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
