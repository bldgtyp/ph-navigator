import { APERTURE_SIDES, type ApertureElement } from "./types";

export const EMPTY_PANEL_EXPLANATION =
  "Empty panel: occupies the layout but is not part of the window unit. The area is wall; it is excluded from U-value, spec report, and all exports.";

export const EMPTY_PANEL_CAPTION =
  "Empty — not part of the aperture. Excluded from U-value and exports.";

export function hasGlazedAssignments(element: ApertureElement): boolean {
  return clearedAssignmentLabels(element).length > 0;
}

export function clearedAssignmentLabels(element: ApertureElement): string[] {
  const labels: string[] = [];
  if (element.glazing !== null) labels.push("glazing");
  if (element.operation !== null) labels.push("operation");
  for (const side of APERTURE_SIDES) {
    if (element.frames[side] !== null) labels.push(`${side} frame`);
  }
  return labels;
}
