export const HEAT_PUMP_LEAF_TABS = [
  { key: "equipment-outdoor", label: "Equipment - Outdoor" },
  { key: "equipment-indoor", label: "Equipment - Indoor" },
  { key: "units-outdoor", label: "Units - Outdoor" },
  { key: "units-indoor", label: "Units - Indoor" },
] as const;

export type HeatPumpLeafKey = (typeof HEAT_PUMP_LEAF_TABS)[number]["key"];

export const DEFAULT_HEAT_PUMP_LEAF: HeatPumpLeafKey = "equipment-outdoor";

const HEAT_PUMP_LEAF_SESSION_KEY_PREFIX = "phn:equipment:heat-pumps:active-leaf";

export function heatPumpLeafPath(projectId: string, leaf: HeatPumpLeafKey): string {
  return `/projects/${projectId}/equipment/heat-pumps/${leaf}`;
}

export function rememberedHeatPumpLeafPath(projectId: string): string {
  return heatPumpLeafPath(
    projectId,
    readRememberedHeatPumpLeaf(projectId) ?? DEFAULT_HEAT_PUMP_LEAF,
  );
}

export function readRememberedHeatPumpLeaf(projectId: string): HeatPumpLeafKey | null {
  if (typeof window === "undefined") return null;
  try {
    return leafFromKey(window.sessionStorage.getItem(storageKey(projectId)));
  } catch {
    return null;
  }
}

export function rememberHeatPumpLeaf(projectId: string, leaf: HeatPumpLeafKey): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(projectId), leaf);
  } catch {
    // Session persistence is best-effort; navigation still works without it.
  }
}

export function leafFromPath(path: string): HeatPumpLeafKey | null {
  const parts = path.split("/");
  const leaf = parts[0] === "heat-pumps" ? parts[1] : parts[0];
  return leafFromKey(leaf);
}

function leafFromKey(key: string | null | undefined): HeatPumpLeafKey | null {
  if (key && HEAT_PUMP_LEAF_TABS.some((tab) => tab.key === key)) {
    return key as HeatPumpLeafKey;
  }
  return null;
}

function storageKey(projectId: string): string {
  return `${HEAT_PUMP_LEAF_SESSION_KEY_PREFIX}:${projectId}`;
}
