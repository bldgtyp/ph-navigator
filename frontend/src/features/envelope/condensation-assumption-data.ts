import { cToF, fToC, type UnitSystem } from "../../lib/units";
import type { AssemblyCondensationResponse, CondensationSettings } from "./condensation-types";
import { materialById } from "./lib";
import type { Assembly, ProjectMaterial } from "./types";

export type SettingsDraft = {
  model: CondensationSettings["interior_climate_model"];
  occupancyClass: CondensationSettings["occupancy_class"];
  humidityClass: string;
  setpointTemperature: string;
  setpointRhPercent: string;
  maLimit: string;
};

export function settingsDraft(
  settings: CondensationSettings,
  unitSystem: UnitSystem,
): SettingsDraft {
  const temperature =
    settings.setpoint_temp_c === null
      ? ""
      : unitSystem === "IP"
        ? cToF(settings.setpoint_temp_c)
        : settings.setpoint_temp_c;
  return {
    model: settings.interior_climate_model,
    occupancyClass: settings.occupancy_class,
    humidityClass: String(settings.humidity_class),
    setpointTemperature: temperature === "" ? "" : String(Number(temperature.toFixed(2))),
    setpointRhPercent:
      settings.setpoint_rh === null ? "" : String(Number((settings.setpoint_rh * 100).toFixed(1))),
    maLimit: String(settings.ma_limit_g_m2),
  };
}

export function changeModel(
  draft: SettingsDraft,
  model: SettingsDraft["model"],
  unitSystem: UnitSystem,
): SettingsDraft {
  const defaultTemperature = unitSystem === "IP" ? String(cToF(20)) : "20";
  return {
    ...draft,
    model,
    setpointTemperature:
      model === "iso13788_continental" ? "" : draft.setpointTemperature || defaultTemperature,
    setpointRhPercent: model === "fixed_setpoint" ? draft.setpointRhPercent || "50" : "",
  };
}

export function parseSettingsDraft(
  draft: SettingsDraft,
  unitSystem: UnitSystem,
): { settings: CondensationSettings | null; error: string } {
  const maLimit = Number(draft.maLimit);
  if (!Number.isFinite(maLimit) || maLimit <= 0) {
    return { settings: null, error: "Enter an accumulated-moisture limit greater than zero." };
  }
  let setpointTempC: number | null = null;
  let setpointRh: number | null = null;
  if (draft.model !== "iso13788_continental") {
    if (draft.setpointTemperature.trim() === "") {
      return { settings: null, error: "Enter an interior setpoint temperature." };
    }
    const temperature = Number(draft.setpointTemperature);
    if (!Number.isFinite(temperature)) {
      return { settings: null, error: "Enter an interior setpoint temperature." };
    }
    setpointTempC = unitSystem === "IP" ? fToC(temperature) : temperature;
  }
  if (draft.model === "fixed_setpoint") {
    if (draft.setpointRhPercent.trim() === "") {
      return { settings: null, error: "Enter relative humidity from 0 to 100%." };
    }
    const relativeHumidity = Number(draft.setpointRhPercent);
    if (!Number.isFinite(relativeHumidity) || relativeHumidity < 0 || relativeHumidity > 100) {
      return { settings: null, error: "Enter relative humidity from 0 to 100%." };
    }
    setpointRh = relativeHumidity / 100;
  }
  return {
    settings: {
      interior_climate_model: draft.model,
      occupancy_class: draft.occupancyClass,
      humidity_class: Number(draft.humidityClass),
      setpoint_temp_c: setpointTempC,
      setpoint_rh: setpointRh,
      ma_limit_g_m2: maLimit,
    },
    error: "",
  };
}

export function materialsForAssembly(
  assembly: Assembly,
  materials: ProjectMaterial[],
): ProjectMaterial[] {
  const byId = materialById(materials);
  const ids = new Set(
    assembly.layers.flatMap((layer) =>
      layer.segments.flatMap((segment) =>
        segment.project_material_id ? [segment.project_material_id] : [],
      ),
    ),
  );
  return [...ids].flatMap((id) => {
    const material = byId.get(id);
    return material ? [material] : [];
  });
}

export function provenanceLabel(material: ProjectMaterial): string {
  if (!material.catalog_origin) return "Project entry";
  const overridden = material.catalog_origin.local_overrides.some((field) =>
    ["vapor_diffusion_resistance_mu", "vapor_sd_equivalent_m"].includes(field),
  );
  return overridden ? "Catalog copy · project vapour override" : "Catalog copy";
}

export function climateSourceLabel(result: AssemblyCondensationResponse): string {
  if (!result.climate_source) return "No climate source";
  const kind = { custom: "Custom", phi: "PHI", phius: "Phius" }[result.climate_source.kind];
  return result.climate_source.label ? `${kind}: ${result.climate_source.label}` : kind;
}

export function modelLabel(model: CondensationSettings["interior_climate_model"]): string {
  if (model === "iso13788_continental") return "ISO 13788 continental / tropical";
  if (model === "iso13788_humidity_class") return "ISO 13788 humidity class";
  return "Fixed temperature and RH";
}
