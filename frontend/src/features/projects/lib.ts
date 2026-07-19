import { errorMessage } from "../../shared/lib/errors";
import { spacesRoomsPath } from "../spaces/paths";

export const PROJECT_TABS = [
  "status",
  "climate",
  "apertures",
  "envelope",
  "spaces",
  "equipment",
  "thermal-bridges",
  "model",
  "documentation",
] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];

export const TAB_LABELS: Record<ProjectTab, string> = {
  status: "Status",
  climate: "Climate",
  apertures: "Apertures",
  envelope: "Envelope",
  spaces: "Spaces",
  equipment: "Equipment",
  "thermal-bridges": "Thermal Bridges",
  model: "Model",
  documentation: "Documentation",
};

export const TAB_COPY: Record<ProjectTab, string> = {
  status: "Track this project's lifecycle milestones.",
  climate: "Project location and weather/climate reference datasets.",
  apertures: "Aperture types, frames, glazing, dimensions, and U-Value.",
  envelope: "Envelope assemblies land after the aperture catalog slices.",
  spaces: "Space types, room schedules, iCFA factors, and occupancy assumptions.",
  equipment:
    "Equipment tables for ventilators, pumps, fans, hot-water heaters, and electric heaters.",
  "thermal-bridges": "Thermal bridge datasheets and simulation files.",
  model: "Upload HBJSON exports and view them as an interactive 3D model.",
  documentation: "Project-wide specification, datasheet, and site-photo evidence.",
};

export function projectTabPath(projectId: string, tab: ProjectTab): string {
  if (tab === "spaces") {
    return spacesRoomsPath(projectId);
  }
  return `/projects/${projectId}/${tab}`;
}

export function projectStatusPath(projectId: string): string {
  return projectTabPath(projectId, "status");
}

export function isProjectTab(value: string | undefined): value is ProjectTab {
  return PROJECT_TABS.includes(value as ProjectTab);
}

export function availabilityLabel(
  trimmedBtNumber: string,
  debouncedBtNumber: string,
  query: {
    isLoading: boolean;
    error: unknown;
    available: boolean | undefined;
    conflictName: string | undefined;
  },
): {
  status: "idle" | "checking" | "available" | "taken" | "error";
  message: string;
  isChecking: boolean;
  isTaken: boolean;
} {
  if (!trimmedBtNumber) {
    return { status: "idle", message: "", isChecking: false, isTaken: false };
  }
  if (trimmedBtNumber !== debouncedBtNumber || query.isLoading) {
    return {
      status: "checking",
      message: "Checking BT number...",
      isChecking: true,
      isTaken: false,
    };
  }
  if (query.error) {
    const message = errorMessage(query.error, "Could not check BT number.");
    return {
      status: "error",
      message,
      isChecking: false,
      isTaken: false,
    };
  }
  if (query.available === false) {
    return {
      status: "taken",
      message: `BT number already used by ${query.conflictName ?? "another project"}`,
      isChecking: false,
      isTaken: true,
    };
  }
  if (query.available === true) {
    return {
      status: "available",
      message: "BT number available",
      isChecking: false,
      isTaken: false,
    };
  }
  return { status: "idle", message: "", isChecking: false, isTaken: false };
}
