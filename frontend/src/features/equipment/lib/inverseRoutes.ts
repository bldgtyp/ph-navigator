import { spacesRoomsPath } from "../../spaces/paths";
import type { InverseLinkField } from "../types";

const EQUIPMENT_SOURCE_TAB_BY_TABLE: Record<string, string> = {
  ventilators: "ventilators",
  pumps: "pumps",
  fans: "fans",
  hot_water_heaters: "hot-water-heaters",
  hot_water_tanks: "hot-water-tanks",
  electric_heaters: "electric-heaters",
  appliances: "appliances",
};

export function routeForInverseSource(
  projectId: string,
  field: InverseLinkField,
  rowId: string,
): string | null {
  const [root, child] = field.source_table_path;
  const focus = encodeURIComponent(rowId);
  if (root === "rooms" && child === undefined) {
    return `${spacesRoomsPath(projectId)}?focus=${focus}`;
  }
  if (root === "equipment" && child) {
    const tab = EQUIPMENT_SOURCE_TAB_BY_TABLE[child];
    if (tab) {
      return `/projects/${projectId}/equipment?tab=${encodeURIComponent(tab)}&focus=${focus}`;
    }
  }
  return null;
}
