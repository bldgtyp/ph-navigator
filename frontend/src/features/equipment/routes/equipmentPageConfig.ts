export const PUMPS_CONFLICT_MESSAGES = {
  activeRowConflict: "The Pumps draft changed in another tab. Reload the draft before editing.",
  deleteConflict: "Could not delete pump.",
  versionLocked: "This version is locked. Save As to copy it into a new version.",
};

export const VENTILATORS_CONFLICT_MESSAGES = {
  activeRowConflict:
    "The Ventilators draft changed in another tab. Reload the draft before editing.",
  deleteConflict: "Could not delete ventilator.",
  versionLocked: "This version is locked. Save As to copy it into a new version.",
};

export const FANS_CONFLICT_MESSAGES = {
  activeRowConflict: "The Fans draft changed in another tab. Reload the draft before editing.",
  deleteConflict: "Could not delete fan.",
  versionLocked: "This version is locked. Save As to copy it into a new version.",
};

export const HOT_WATER_TANKS_CONFLICT_MESSAGES = {
  activeRowConflict:
    "The Hot Water Tanks draft changed in another tab. Reload the draft before editing.",
  deleteConflict: "Could not delete hot water tank.",
  versionLocked: "This version is locked. Save As to copy it into a new version.",
};

export const ELECTRIC_HEATERS_CONFLICT_MESSAGES = {
  activeRowConflict:
    "The Electric Heaters draft changed in another tab. Reload the draft before editing.",
  deleteConflict: "Could not delete electric heater.",
  versionLocked: "This version is locked. Save As to copy it into a new version.",
};

export const APPLIANCES_CONFLICT_MESSAGES = {
  activeRowConflict:
    "The Appliances draft changed in another tab. Reload the draft before editing.",
  deleteConflict: "Could not delete appliance.",
  versionLocked: "This version is locked. Save As to copy it into a new version.",
};

export const EQUIPMENT_TABS = [
  { key: "ventilators", label: "Ventilators", emptyMessage: "No ventilators yet." },
  { key: "pumps", label: "Pumps", emptyMessage: "No pumps yet." },
  { key: "fans", label: "Fans", emptyMessage: "No fans yet." },
  {
    key: "hot-water-tanks",
    label: "Hot-water tanks",
    emptyMessage: "No hot water tanks yet.",
  },
  {
    key: "electric-heaters",
    label: "Electric heaters",
    emptyMessage: "No electric heaters yet.",
  },
  { key: "appliances", label: "Appliances", emptyMessage: "No appliances yet." },
] as const;

export type EquipmentTabKey = (typeof EQUIPMENT_TABS)[number]["key"];

export function equipmentTabLabel(tab: EquipmentTabKey): string {
  if (tab === "hot-water-tanks") return "Hot Water Tanks";
  if (tab === "electric-heaters") return "Electric Heaters";
  const entry = EQUIPMENT_TABS.find((candidate) => candidate.key === tab);
  return entry?.label ?? "Equipment";
}
