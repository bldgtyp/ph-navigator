import { errorMessage } from "../../shared/lib/errors";

export const PROJECT_TABS = ["status", "windows", "envelope", "equipment", "model"] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];

export const TAB_LABELS: Record<ProjectTab, string> = {
  status: "Status",
  windows: "Windows",
  envelope: "Envelope",
  equipment: "Equipment",
  model: "Model",
};

export const TAB_COPY: Record<ProjectTab, string> = {
  status: "Track this project's lifecycle milestones.",
  windows: "Window type editing lands after the catalog tracer.",
  envelope: "Envelope assemblies land after the window catalog slices.",
  equipment: "Rooms and equipment tables start with the Rooms draft slice.",
  model: "HBJSON upload and the R3F viewer land after the asset backbone.",
};

export function projectTabPath(projectId: string, tab: ProjectTab): string {
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
