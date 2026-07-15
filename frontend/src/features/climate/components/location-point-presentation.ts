import type { GeocodeProjectLocationCandidate } from "../../projects/types";

export type PointPresentation = GeocodeProjectLocationCandidate["result_type"] | "saved" | "custom";

export function pointPresentationNote(
  presentation: PointPresentation,
  hasCoordinates: boolean,
): string {
  if (!hasCoordinates) {
    return "Choose an address or town, or set coordinates below, to place the project.";
  }
  switch (presentation) {
    case "locality":
      return "Town-level location — refine the pin or elevation if site-specific accuracy is needed.";
    case "custom":
      return "Custom project point — refined coordinates are saved and shown on the project map; do not place it at the exact site if town-level privacy is required.";
    case "address":
      return "Address result — click the map to refine the saved project point.";
    case "saved":
      return "Saved project point — click the map to refine the coordinates.";
  }
}
