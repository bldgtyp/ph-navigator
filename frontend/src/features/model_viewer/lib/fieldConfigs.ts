import {
  formatAreaFromM2,
  formatRValueFromM2KPerW,
  formatUValueFromWm2K,
  type UnitSystem,
} from "../../../lib/units";
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
      getValue: (meta) => meta.boundary_condition.type,
    },
    { id: "area", label: "Area", getValue: (meta) => meta.area, format: formatArea },
  ];
}

function constructionFields({ includeRValues }: { includeRValues: boolean }): InspectorField[] {
  const fields: InspectorField[] = [
    {
      id: "construction_name",
      label: "Name",
      getValue: (meta) => meta.properties.energy.construction?.identifier,
    },
    {
      id: "construction_type",
      label: "Type",
      getValue: (meta) => meta.properties.energy.construction?.type,
    },
    {
      id: "u_factor",
      label: "U-Factor",
      tooltip:
        "Includes interior + exterior air-film resistances (EN673/ISO10292). Honeybee u_factor.",
      getValue: (meta) => meta.properties.energy.construction?.u_factor,
      format: formatUValue,
    },
    {
      id: "u_value",
      label: "U-Value",
      tooltip: "Excludes air-film resistances. Honeybee u_value.",
      getValue: (meta) => meta.properties.energy.construction?.u_value,
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
        getValue: (meta) => meta.properties.energy.construction?.r_factor,
        format: formatRValue,
      },
      {
        id: "r_value",
        label: "R-Value",
        tooltip: "Excludes air-film resistances. Honeybee r_value.",
        getValue: (meta) => meta.properties.energy.construction?.r_value,
        format: formatRValue,
      },
    );
  }
  return fields;
}

function numericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatArea(value: unknown, unitSystem: UnitSystem): string {
  return formatAreaFromM2(numericValue(value), { unitSystem, empty: "--" });
}

function formatUValue(value: unknown, unitSystem: UnitSystem): string {
  return formatUValueFromWm2K(numericValue(value), { unitSystem, empty: "--" });
}

function formatRValue(value: unknown, unitSystem: UnitSystem): string {
  return formatRValueFromM2KPerW(numericValue(value), { unitSystem, empty: "--" });
}
