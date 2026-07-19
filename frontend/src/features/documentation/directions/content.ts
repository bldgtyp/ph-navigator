import type { DocumentationSection } from "../types";

export type DocumentationDirection = {
  key: string;
  title: string;
  overview: string;
  shots: string[];
  exampleImageUrl: string | null;
};

const DIRECTIONS: Record<string, DocumentationDirection> = {
  walls: {
    key: "walls",
    title: "Walls",
    overview: "Photograph each opaque wall assembly where the installed layers are visible.",
    shots: [
      "Overall elevation or room context showing the wall location.",
      "Close view of insulation, sheathing, membranes, and any continuous insulation layer.",
      "Label, stamp, or packaging for insulation and specialty membrane products.",
    ],
    exampleImageUrl: null,
  },
  floors: {
    key: "floors",
    title: "Floors",
    overview: "Capture slab, framed floor, and exposed edge conditions before they are concealed.",
    shots: [
      "Overall floor area with gridline, room, or assembly context.",
      "Edge, rim, or underside view showing insulation continuity.",
      "Product labels for insulation, vapor control layers, or specialty boards.",
    ],
    exampleImageUrl: null,
  },
  roofs: {
    key: "roofs",
    title: "Roofs",
    overview: "Document roof insulation and air-control continuity before close-in.",
    shots: [
      "Wide roof or attic context showing the assembly location.",
      "Close view of insulation depth, rafter/cavity condition, and membrane laps.",
      "Any transition to parapet, wall, skylight, or roof penetration.",
    ],
    exampleImageUrl: null,
  },
  other: {
    key: "other",
    title: "Other Assemblies",
    overview: "Use this for assembly evidence that does not fit wall, floor, or roof categories.",
    shots: [
      "Context photo showing where the assembly occurs.",
      "Close view of the material layers that support the model input.",
      "Any product label or installation note visible before close-in.",
    ],
    exampleImageUrl: null,
  },
  equipment: {
    key: "equipment",
    title: "Equipment",
    overview:
      "Photograph the installed unit, readable nameplate, and any accessory that affects the PH model.",
    shots: [
      "Overall unit photo with enough context to identify location.",
      "Readable manufacturer nameplate showing model number and rated data.",
      "Control, duct, piping, or electrical accessory if it changes the modeled input.",
    ],
    exampleImageUrl: null,
  },
  ventilators: {
    key: "ventilators",
    title: "Ventilators",
    overview:
      "Capture each ERV/HRV so the unit identity, airflow path, and controls are unambiguous.",
    shots: [
      "Overall unit photo showing its installed location and service clearance.",
      "Readable nameplate with manufacturer, model number, serial number, airflow, and electrical data.",
      "Duct connections, condensate, frost-preheat, bypass, and control accessories that affect modeled ventilation performance.",
    ],
    exampleImageUrl: null,
  },
  "heat-pumps-outdoor-equipment": {
    key: "heat-pumps-outdoor-equipment",
    title: "Heat Pumps - Outdoor Equipment",
    overview:
      "Document the rated outdoor-unit product data used by the heat-pump performance model.",
    shots: [
      "Readable outdoor-equipment nameplate with manufacturer, model number, capacity, and refrigerant.",
      "Context photo showing the equipment family or paired system referenced by the submittal.",
      "Any AHRI, controls, or low-ambient accessory labels that affect the selected performance curve.",
    ],
    exampleImageUrl: null,
  },
  "heat-pumps-indoor-equipment": {
    key: "heat-pumps-indoor-equipment",
    title: "Heat Pumps - Indoor Equipment",
    overview: "Document each indoor equipment type used by the heat-pump estimator.",
    shots: [
      "Readable indoor-unit nameplate or product label with model number.",
      "Wide photo showing unit type: wall cassette, ceiling cassette, concealed duct, or other configuration.",
      "Controls, auxiliary heat, or duct accessories that change modeled operation.",
    ],
    exampleImageUrl: null,
  },
  "heat-pumps-outdoor-units": {
    key: "heat-pumps-outdoor-units",
    title: "Heat Pumps - Outdoor Units",
    overview:
      "Photograph each installed condenser instance so schedule tags match the field condition.",
    shots: [
      "Overall condenser photo with schedule tag or apartment/zone context.",
      "Nameplate close-up showing model and serial number.",
      "Mounting, clearance, refrigerant piping, and branch-box context when visible.",
    ],
    exampleImageUrl: null,
  },
  "heat-pumps-indoor-units": {
    key: "heat-pumps-indoor-units",
    title: "Heat Pumps - Indoor Units",
    overview: "Photograph each installed indoor unit instance against its room or zone assignment.",
    shots: [
      "Overall indoor-unit photo showing room, ceiling, or wall context.",
      "Nameplate or label close-up when accessible.",
      "Thermostat, return path, duct connection, or served-room context if it affects the modeled zone.",
    ],
    exampleImageUrl: null,
  },
  pumps: {
    key: "pumps",
    title: "Pumps",
    overview:
      "Capture pump identity and motor data for every modeled circulation or distribution pump.",
    shots: [
      "Overall pump photo showing pipe context and intended use.",
      "Readable nameplate with manufacturer, model, voltage, phase, horsepower or wattage, and flow data if present.",
      "Controller, variable-speed setting, balancing valve, or isolation detail when it affects runtime or flow.",
    ],
    exampleImageUrl: null,
  },
  fans: {
    key: "fans",
    title: "Fans",
    overview:
      "Document standalone fans that contribute to ventilation, exhaust, or process energy.",
    shots: [
      "Overall fan photo showing location and served area.",
      "Readable nameplate with manufacturer, model, airflow, voltage, and wattage.",
      "Controls, speed setting, timer, or duct connection that affects modeled runtime.",
    ],
    exampleImageUrl: null,
  },
  "electric-heaters": {
    key: "electric-heaters",
    title: "Electric Heaters",
    overview: "Capture each electric resistance heater used in the project energy model.",
    shots: [
      "Overall heater photo showing room or system context.",
      "Readable label with manufacturer, model, voltage, and wattage.",
      "Thermostat, relay, or control accessory if it affects operation.",
    ],
    exampleImageUrl: null,
  },
  "hot-water-heaters": {
    key: "hot-water-heaters",
    title: "Hot Water Heaters",
    overview: "Document water-heating equipment identity and rated performance inputs.",
    shots: [
      "Overall water-heater photo showing system context and fuel or electrical connection.",
      "Readable nameplate with manufacturer, model, capacity, input, efficiency, and serial number.",
      "Recirculation, mixing, controls, or heat-pump water-heater ducting if present.",
    ],
    exampleImageUrl: null,
  },
  "hot-water-tanks": {
    key: "hot-water-tanks",
    title: "Hot Water Tanks",
    overview: "Capture storage-tank identity, volume, and loss data used by the hot-water model.",
    shots: [
      "Overall tank photo showing location and piping context.",
      "Readable label with manufacturer, model, storage volume, insulation, and standby-loss data if present.",
      "Aquastat, mixing valve, or connected loop context when it affects modeled losses.",
    ],
    exampleImageUrl: null,
  },
  appliances: {
    key: "appliances",
    title: "Appliances",
    overview: "Document project appliances where installed products influence the energy balance.",
    shots: [
      "Overall appliance photo showing location and appliance type.",
      "Readable model/serial label or EnergyGuide label.",
      "Control setting, venting, or accessory detail if it affects modeled energy use.",
    ],
    exampleImageUrl: null,
  },
  apertures: {
    key: "apertures",
    title: "Windows and Apertures",
    overview: "Document installed products and labels for glazing and frame records.",
    shots: [
      "Overall window or door opening showing the product in context.",
      "Readable NFRC, manufacturer, or shop label for glass and frame products.",
      "Frame spacer, mullion, or installation condition when it supports a psi-value input.",
    ],
    exampleImageUrl: null,
  },
  thermal_bridges: {
    key: "thermal_bridges",
    title: "Thermal Bridges",
    overview: "Capture the actual condition represented by each thermal bridge calculation.",
    shots: [
      "Wide context photo locating the bridge in the building.",
      "Close view showing the conductive path or mitigation detail.",
      "Reference dimension, product label, or drawing mark if available on site.",
    ],
    exampleImageUrl: null,
  },
};

const SECTION_KEYS: Record<string, string[]> = {
  envelope: ["walls", "floors", "roofs", "other"],
  apertures: ["apertures"],
  thermal_bridges: ["thermal_bridges"],
};

export function directionsForSection(section: DocumentationSection): DocumentationDirection[] {
  if (section.key === "equipment") {
    const groupKeys = section.groups.map((group) => group.key).filter((key) => key in DIRECTIONS);
    return (groupKeys.length ? groupKeys : ["equipment"])
      .map((key) => DIRECTIONS[key])
      .filter((entry): entry is DocumentationDirection => Boolean(entry));
  }
  const keys = SECTION_KEYS[section.key] ?? [section.key];
  return keys
    .map((key) => DIRECTIONS[key])
    .filter((entry): entry is DocumentationDirection => Boolean(entry));
}

export function primaryDirectionForSection(
  section: DocumentationSection,
): DocumentationDirection | null {
  return directionsForSection(section)[0] ?? null;
}
