import {
  formatAirflowFromM3S,
  formatAreaFromM2,
  formatConductivityFromWmK,
  formatLengthFromMm,
  formatRValueFromM2KPerW,
  formatTemperatureFromC,
  formatUValueFromWm2K,
  formatVolumeFromM3,
  type UnitSystem,
} from "../../../lib/units";
import { stripTrailingZeros } from "../../../lib/units/format";
import type { ModelObjectMeta, ModelObjectType } from "../types";

export type InspectorField = {
  id: string;
  label: string;
  tooltip?: string;
  getValue: (meta: ModelObjectMeta) => unknown;
  format?: (value: unknown, unitSystem: UnitSystem) => string;
};

export type InspectorSection = {
  title?: string;
  fields: InspectorField[];
};

export type InspectorConfig = {
  title: string;
  sections: InspectorSection[];
};

export const inspectorConfigs: Record<ModelObjectType, InspectorConfig> = {
  faceMesh: {
    title: "Opaque Surface",
    sections: [
      { fields: commonElementFields() },
      {
        title: "Construction",
        fields: constructionFields({ includeRValues: true }),
      },
    ],
  },
  apertureMeshFace: {
    title: "Window",
    sections: [
      { fields: commonElementFields() },
      {
        title: "Construction",
        fields: constructionFields({ includeRValues: false }),
      },
    ],
  },
  spaceGroup: {
    title: "Interior Space",
    sections: [
      {
        fields: [
          { id: "display_name", label: "Name", getValue: (meta) => meta.display_name },
          { id: "identifier", label: "ID", getValue: (meta) => meta.identifier },
          { id: "number", label: "Number", getValue: metaField("number") },
          { id: "quantity", label: "Quantity", getValue: metaField("quantity") },
          { id: "wufi_type", label: "WUFI Type", getValue: metaField("wufi_type") },
          {
            id: "floor_area",
            label: "Floor Area",
            getValue: metaField("floor_area"),
            format: formatArea,
          },
          {
            id: "weighted_floor_area",
            label: "Weighted Area",
            getValue: metaField("weighted_floor_area"),
            format: formatArea,
          },
          {
            id: "net_volume",
            label: "Net Volume",
            getValue: metaField("net_volume"),
            format: formatVolume,
          },
          {
            id: "avg_clear_height",
            label: "Avg Height",
            getValue: metaField("avg_clear_height"),
            format: formatMetersAsLength,
          },
          {
            id: "average_floor_weighting_factor",
            label: "Avg Weighting Factor",
            getValue: metaField("average_floor_weighting_factor"),
            format: formatRatio,
          },
        ],
      },
      { title: "Ventilation", fields: airflowFields() },
    ],
  },
  spaceFloorSegmentMeshFace: {
    title: "Interior Floor",
    sections: [
      {
        fields: [
          { id: "display_name", label: "Space", getValue: (meta) => meta.display_name },
          { id: "number", label: "Number", getValue: metaField("number") },
          {
            id: "weighting_factor",
            label: "Weight",
            getValue: metaField("weighting_factor"),
            format: formatRatio,
          },
          {
            id: "floor_area",
            label: "Floor Area",
            getValue: metaField("floor_area"),
            format: formatArea,
          },
          {
            id: "weighted_floor_area",
            label: "Weighted Area",
            getValue: metaField("weighted_floor_area"),
            format: formatArea,
          },
        ],
      },
      { title: "Ventilation", fields: airflowFields({ terse: true }) },
    ],
  },
  pipeSegmentLine: {
    title: "Pipe",
    sections: [
      {
        fields: [
          { id: "identifier", label: "ID", getValue: (meta) => meta.identifier },
          { id: "display_name", label: "Name", getValue: (meta) => meta.display_name },
          {
            id: "diameter_mm",
            label: "Diameter",
            getValue: metaField("diameter_mm"),
            format: formatMillimeters,
          },
          {
            id: "insulation_thickness_mm",
            label: "Insulation Thickness",
            getValue: metaField("insulation_thickness_mm"),
            format: formatMillimeters,
          },
          {
            id: "insulation_conductivity",
            label: "Insulation Conductivity",
            getValue: metaField("insulation_conductivity"),
            format: formatConductivity,
          },
          {
            id: "insulation_reflective",
            label: "Insulation Reflective",
            getValue: metaField("insulation_reflective"),
            format: formatBoolean,
          },
          {
            id: "insulation_quality",
            label: "Insulation Quality",
            getValue: metaField("insulation_quality"),
          },
          {
            id: "water_temp_c",
            label: "Water Temp",
            getValue: metaField("water_temp_c"),
            format: formatTemperature,
          },
          {
            id: "daily_period",
            label: "Daily Period",
            getValue: metaField("daily_period"),
            format: formatHours,
          },
          {
            id: "length",
            label: "Length",
            getValue: metaField("length"),
            format: formatMetersAsLength,
          },
          { id: "material_value", label: "Material", getValue: metaField("material_value") },
        ],
      },
    ],
  },
  ductSegmentLine: {
    title: "Duct",
    sections: [
      {
        fields: [
          { id: "identifier", label: "ID", getValue: (meta) => meta.identifier },
          { id: "display_name", label: "Name", getValue: (meta) => meta.display_name },
          {
            id: "duct_type",
            label: "Duct Type",
            getValue: metaField("duct_type"),
            format: formatDuctType,
          },
          {
            id: "diameter_m",
            label: "Diameter",
            getValue: metaField("diameter_m"),
            format: formatMetersAsLength,
          },
          {
            id: "insulation_thickness_m",
            label: "Insulation Thickness",
            getValue: metaField("insulation_thickness_m"),
            format: formatMetersAsLength,
          },
        ],
      },
    ],
  },
};

export function fieldValue(
  meta: ModelObjectMeta,
  field: InspectorField,
  unitSystem: UnitSystem,
): string {
  const value = field.getValue(meta);
  if (field.format) return field.format(value, unitSystem);
  if (value === null || value === undefined || value === "") return "--";
  return String(value);
}

export function configForMeta(meta: ModelObjectMeta | null): InspectorConfig {
  if (!meta) return genericConfig("Element");
  return inspectorConfigs[meta.type] ?? genericConfig("Element");
}

function genericConfig(title: string): InspectorConfig {
  return {
    title,
    sections: [
      {
        fields: [
          { id: "type", label: "Type", getValue: (meta) => meta.type },
          { id: "identifier", label: "ID", getValue: (meta) => meta.identifier },
        ],
      },
    ],
  };
}

function commonElementFields(): InspectorField[] {
  return [
    { id: "display_name", label: "Name", getValue: (meta) => meta.display_name },
    { id: "identifier", label: "ID", getValue: (meta) => meta.identifier },
    { id: "face_type", label: "Face Type", getValue: (meta) => meta.face_type },
    {
      id: "boundary_condition",
      label: "Boundary",
      getValue: (meta) => meta.boundary_condition?.type,
    },
    { id: "area", label: "Area", getValue: (meta) => meta.area, format: formatArea },
  ];
}

function constructionFields({ includeRValues }: { includeRValues: boolean }): InspectorField[] {
  const fields: InspectorField[] = [
    {
      id: "construction_name",
      label: "Name",
      getValue: (meta) => construction(meta)?.identifier,
    },
    {
      id: "construction_type",
      label: "Type",
      getValue: (meta) => construction(meta)?.type,
    },
    {
      id: "u_factor",
      label: "U-Factor",
      tooltip:
        "Includes interior + exterior air-film resistances (EN673/ISO10292). Honeybee u_factor.",
      getValue: (meta) => construction(meta)?.u_factor,
      format: formatUValue,
    },
    {
      id: "u_value",
      label: "U-Value",
      tooltip: "Excludes air-film resistances. Honeybee u_value.",
      getValue: (meta) => construction(meta)?.u_value,
      format: formatUValue,
    },
  ];
  if (includeRValues) {
    fields.push(
      {
        id: "r_factor",
        label: "R-Factor",
        tooltip:
          "Includes interior + exterior air-film resistances (EN673/ISO10292). Honeybee r_factor.",
        getValue: (meta) => construction(meta)?.r_factor,
        format: formatRValue,
      },
      {
        id: "r_value",
        label: "R-Value",
        tooltip: "Excludes air-film resistances. Honeybee r_value.",
        getValue: (meta) => construction(meta)?.r_value,
        format: formatRValue,
      },
    );
  }
  return fields;
}

function airflowFields({ terse = false }: { terse?: boolean } = {}): InspectorField[] {
  return [
    {
      id: "v_sup",
      label: terse ? "Supply" : "Supply Air",
      getValue: airflowField("_v_sup"),
      format: formatAirflow,
    },
    {
      id: "v_eta",
      label: terse ? "Extract" : "Extract Air",
      getValue: airflowField("_v_eta"),
      format: formatAirflow,
    },
    {
      id: "v_tran",
      label: terse ? "Transfer" : "Transfer Air",
      getValue: airflowField("_v_tran"),
      format: formatAirflow,
    },
  ];
}

function metaField(key: string): (meta: ModelObjectMeta) => unknown {
  return (meta) => (key in meta ? (meta as unknown as Record<string, unknown>)[key] : undefined);
}

function airflowField(key: "_v_sup" | "_v_eta" | "_v_tran"): (meta: ModelObjectMeta) => unknown {
  return (meta) => ("airflow" in meta && meta.airflow ? meta.airflow[key] : undefined);
}

function construction(meta: ModelObjectMeta) {
  return "energy" in meta.properties ? meta.properties.energy.construction : null;
}

function numericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatArea(value: unknown, unitSystem: UnitSystem): string {
  return formatAreaFromM2(numericValue(value), { unitSystem, empty: "--" });
}

function formatVolume(value: unknown, unitSystem: UnitSystem): string {
  return formatVolumeFromM3(numericValue(value), { unitSystem, empty: "--" });
}

function formatMillimeters(value: unknown, unitSystem: UnitSystem): string {
  return formatLengthFromMm(numericValue(value), { unitSystem, empty: "--" });
}

export function formatMetersAsLength(value: unknown, unitSystem: UnitSystem): string {
  const number = numericValue(value);
  return formatLengthFromMm(number === null ? null : number * 1000, { unitSystem, empty: "--" });
}

function formatConductivity(value: unknown, unitSystem: UnitSystem): string {
  return formatConductivityFromWmK(numericValue(value), { unitSystem, empty: "--" });
}

function formatTemperature(value: unknown, unitSystem: UnitSystem): string {
  return formatTemperatureFromC(numericValue(value), { unitSystem, empty: "--" });
}

function formatAirflow(value: unknown, unitSystem: UnitSystem): string {
  return formatAirflowFromM3S(numericValue(value), { unitSystem, empty: "--" });
}

function formatRatio(value: unknown): string {
  const number = numericValue(value);
  return number === null ? "--" : stripTrailingZeros(number.toFixed(2));
}

function formatBoolean(value: unknown): string {
  if (value === null || value === undefined) return "--";
  return value ? "yes" : "no";
}

function formatDuctType(value: unknown): string {
  if (value === 1) return "Supply";
  if (value === 2) return "Exhaust";
  return "--";
}

function formatHours(value: unknown): string {
  const number = numericValue(value);
  return number === null ? "--" : `${stripTrailingZeros(number.toFixed(1))} h`;
}

function formatUValue(value: unknown, unitSystem: UnitSystem): string {
  return formatUValueFromWm2K(numericValue(value), { unitSystem, empty: "--" });
}

function formatRValue(value: unknown, unitSystem: UnitSystem): string {
  return formatRValueFromM2KPerW(numericValue(value), { unitSystem, empty: "--" });
}
