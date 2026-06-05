// `<width> × <height>` caption rendered above the canvas in the
// currently-selected display format. Renders on locked / Viewer access
// too — purely a viewing aid.

import { totalApertureHeightMm, totalApertureWidthMm } from "../aperture-geometry";
import { formatValueForDisplay } from "../../../lib/units/length/displayUnitConverter";
import type { DisplayFormat } from "../../../lib/units/length/types";
import type { ApertureTypeEntry } from "../types";

const UNIT_LABEL: Record<DisplayFormat, string> = {
  mm: " mm",
  cm: " cm",
  m: " m",
  in: " in",
  ft: " ft",
  "ft-in": "",
  "in-frac": "",
};

export function TotalDimensionsCaption({
  aperture,
  format,
}: {
  aperture: ApertureTypeEntry;
  format: DisplayFormat;
}) {
  const widthMm = totalApertureWidthMm(aperture);
  const heightMm = totalApertureHeightMm(aperture);
  const unit = UNIT_LABEL[format];
  const width = formatValueForDisplay(widthMm, format);
  const height = formatValueForDisplay(heightMm, format);
  return (
    <div className="aperture-total-dim-caption" data-testid="aperture-total-dim-caption">
      <span>{`${width}${unit} × ${height}${unit}`}</span>
    </div>
  );
}
