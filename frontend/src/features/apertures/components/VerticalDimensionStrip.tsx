// Per-row dimension strip rendered to the left of the canvas. Mirrors
// `HorizontalDimensionStrip` on the row axis. Labels are stacked top-
// down and absolutely positioned by the row's y-offset.

import type { CSSProperties } from "react";
import { rowYOffsetMm, totalApertureHeightMm } from "../aperture-geometry";
import { pxFromMm } from "../canvas-constants";
import type { DisplayFormat, UnitSystem } from "../../../lib/units/length/types";
import type { ApertureTypeEntry } from "../types";
import { DimensionLabel } from "./DimensionLabel";

export type VerticalDimensionStripProps = {
  aperture: ApertureTypeEntry;
  zoom: number;
  system: UnitSystem;
  format: DisplayFormat;
  canEdit: boolean;
  onEditRow: (index: number, newMm: number) => void;
  onRequestDeleteRow: (index: number) => void;
};

const LAST_ROW_REASON = "An aperture type must have at least one row and one column.";

export function VerticalDimensionStrip({
  aperture,
  zoom,
  system,
  format,
  canEdit,
  onEditRow,
  onRequestDeleteRow,
}: VerticalDimensionStripProps) {
  const heightPx = pxFromMm(totalApertureHeightMm(aperture), zoom);
  const rows = aperture.row_heights_mm.length;
  const canDelete = rows > 1;

  return (
    <div
      className="aperture-dim-strip aperture-dim-strip--vertical"
      data-testid="aperture-dim-strip-vertical"
      style={{ height: `${heightPx}px` }}
    >
      {aperture.row_heights_mm.map((mm, index) => {
        const yMm = rowYOffsetMm(aperture, index);
        const topPx = pxFromMm(yMm, zoom);
        const heightForSegmentPx = pxFromMm(mm, zoom);
        const style: CSSProperties = {
          top: `${topPx}px`,
          height: `${heightForSegmentPx}px`,
        };
        return (
          <DimensionLabel
            key={index}
            axis="vertical"
            mm={mm}
            system={system}
            format={format}
            canEdit={canEdit}
            canDelete={canEdit && canDelete}
            deleteDisabledReason={canDelete ? null : LAST_ROW_REASON}
            onCommit={(newMm) => onEditRow(index, newMm)}
            onDelete={() => onRequestDeleteRow(index)}
            style={style}
            ariaLabel={`Row ${index + 1} height`}
            testIdPrefix={`row-h-${index}`}
          />
        );
      })}
      {Array.from({ length: rows + 1 }, (_, tickIndex) => {
        const yMm = rowYOffsetMm(aperture, tickIndex);
        const topPx = pxFromMm(yMm, zoom);
        return (
          <span
            key={`tick-${tickIndex}`}
            className="aperture-dim-tick aperture-dim-tick--vertical dimension-chrome-tick dimension-chrome-tick--vertical"
            style={{ top: `${topPx}px` }}
            data-testid={`row-tick-${tickIndex}`}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
