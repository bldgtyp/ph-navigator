#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PHASE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(PHASE_DIR, "../../../..");
const CATALOG_PATH = resolve(
  REPO_ROOT,
  "backend/seeds/catalogs/materials.v1.json",
);
const ASSEMBLY_SEED_PATH = resolve(
  REPO_ROOT,
  "backend/seeds/project/assemblies.json",
);

const AIR_CATEGORIES = new Set([
  "air_downward_heat_flow",
  "air_horizontal_heat_flow",
  "air_upward_heat_flow",
]);

function result(treatment, entry) {
  return { treatment, entry };
}

function classifyCatalogRow(row) {
  const name = row.name;
  const category = row.category;
  const comments = row.comments ?? "";

  if (AIR_CATEGORIES.has(category)) {
    return result("air_exempt", "ISO 13788 air layer");
  }

  if (category.startsWith("stud_layers_")) {
    if (comments.includes("No Insulation")) {
      return result("composite_seed", "air cavity sd-direct");
    }
    if (comments.includes("Fiberglass")) {
      return result("composite_seed", "glass-fibre insulation");
    }
    if (comments.includes("Min. Wool")) {
      return result("composite_seed", "mineral-wool insulation");
    }
    if (comments.includes("XPS")) {
      return result("composite_seed", "extruded-polystyrene insulation");
    }
    if (comments.includes("Spray")) {
      return result("composite_seed", "rigid polyurethane spray foam");
    }
    throw new Error(`Unclassified stud-layer row: ${row.id} ${name}`);
  }

  if (category === "doors") {
    return result("product_entry", "manufacturer door assembly");
  }

  if (category === "finishes") {
    if (/^GWB \(Typ\)|^Gypsum Board/.test(name)) {
      return result("seed", "gypsum plasterboard");
    }
    if (/Durock Cement Board|Fiber Cement Board/.test(name)) {
      return result("seed", "fibre-cement board");
    }
    if (name === "Fiberglass") {
      return result("seed", "glass-fibre insulation");
    }
    if (name === "Stucco") {
      return result("seed", "cement render");
    }
    if (name === "Vinyl Siding") {
      return result("seed", "PVC cladding");
    }
    return result("product_entry", "proprietary sheet/finish");
  }

  if (category === "masonry") {
    if (name === "Stone") {
      return result("unmappable", "natural stone subtype/density required");
    }
    if (/Mortar/.test(name)) {
      return result("seed", "cement/lime mortar");
    }
    if (/Brick/.test(name)) {
      return result("seed", "clay/concrete brick");
    }
    return result("seed", "concrete/masonry unit");
  }

  if (category === "metals") {
    return result("sd_direct", "vapour-tight sheet/layer");
  }

  if (category === "woods") {
    if (/OSB|Zip R/.test(name)) {
      return result("seed", "OSB");
    }
    if (/Plywood/.test(name)) {
      return result("seed", "plywood");
    }
    if (/CLT/.test(name)) {
      return result("seed", "cross-laminated timber");
    }
    if (/Hardwood|Deciduous/.test(name)) {
      return result("seed", "hardwood");
    }
    return result("seed", "softwood");
  }

  if (category === "rainscreen_insulation") {
    return /^XPS/.test(name)
      ? result("composite_seed", "extruded-polystyrene insulation")
      : result("composite_seed", "mineral-wool insulation");
  }

  if (category === "insulation") {
    if (/AAC|Aerated Concrete/.test(name)) {
      return result("seed", "autoclaved aerated concrete");
    }
    if (/EPS|STO-GPS/.test(name)) {
      return result("seed", "expanded-polystyrene insulation");
    }
    if (/XPS/.test(name)) {
      return result("seed", "extruded-polystyrene insulation");
    }
    if (/polyiso|thermax|paratherm/i.test(name)) {
      return result("seed", "polyisocyanurate insulation");
    }
    if (/Polyurethane|PU Block|ccSPF|Huntsman|Nexseal|Icynene/.test(name)) {
      return result("seed", "rigid polyurethane foam");
    }
    if (
      /Rockwool|Roxul|Mineral Wool|ThermaFiber|CAFCO|Amer\. Rockwool/.test(name)
    ) {
      return result("seed", "mineral-wool insulation");
    }
    if (/Fiberglass|Glass Fibre/.test(name) && !/Pultrusion/.test(name)) {
      return result("seed", "glass-fibre insulation");
    }
    if (/Cellulose/.test(name)) {
      return result("seed", "cellulose-fibre insulation");
    }
    if (/Wood-Fibre|Gutex|TimberBatt/.test(name)) {
      return result("seed", "wood-fibre insulation board");
    }
    if (/Cork|Syncork/.test(name)) {
      return result("seed", "expanded-cork insulation");
    }
    if (/Foamglas/.test(name)) {
      return result("sd_direct", "cellular-glass vapour-tight layer");
    }
    if (/Purinet/.test(name)) {
      return result("seed", "rigid polyurethane foam");
    }
    return result("product_entry", "proprietary/composite insulation");
  }

  throw new Error(`Unclassified catalog row: ${row.id} ${category} ${name}`);
}

function increment(counts, key) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function catalogProbe() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const classified = catalog.rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    ...classifyCatalogRow(row),
  }));
  const counts = {};
  for (const row of classified) {
    increment(counts, row.treatment);
  }
  const targetTreatments = new Set(["seed", "sd_direct", "composite_seed"]);
  const targetRoster = classified.filter((row) =>
    targetTreatments.has(row.treatment),
  );
  const excluded = classified.filter((row) =>
    new Set(["product_entry", "unmappable"]).has(row.treatment),
  );
  return {
    catalogRows: classified.length,
    counts,
    resolvedWithoutProductEntry:
      counts.air_exempt +
      counts.seed +
      counts.sd_direct +
      counts.composite_seed,
    targetRoster,
    excluded,
    classified,
  };
}

const ASSEMBLY_PROXY_SOURCE = "backend/seeds/project/assemblies.json";
const SCREENED_EXTERIOR_CONDITIONS = new Set(["outdoor_air", "ventilated"]);
const RESOLVED_CATALOG_TREATMENTS = new Set([
  "air_exempt",
  "seed",
  "sd_direct",
  "composite_seed",
]);
const LOCAL_PROXY_FAMILY_MATCHES = new Map([
  ["fiber-cement siding", "fibre-cement board"],
  ["osb sheathing", "OSB"],
  ["fiberglass batt insulation", "glass-fibre insulation"],
  ["softwood framing", "softwood"],
  ["gypsum wallboard", "gypsum plasterboard"],
  ["normal-weight concrete", "concrete/masonry unit"],
]);

function resolveProjectMaterial(material, catalogById) {
  if (material === null) {
    return result("unresolved", "project material not found");
  }
  if (
    material.vapor_sd_equivalent_m !== null &&
    material.vapor_sd_equivalent_m !== undefined
  ) {
    return result("resolved", "project sd value");
  }
  if (
    material.vapor_diffusion_resistance_mu !== null &&
    material.vapor_diffusion_resistance_mu !== undefined
  ) {
    return result("resolved", "project mu value");
  }
  if (material.category?.toLowerCase() === "membrane") {
    return result("resolved", "assumed per-product membrane sd entry");
  }
  const catalogId = material.catalog_origin?.catalog_record_id;
  if (catalogId !== undefined && catalogId !== null) {
    const catalogRow = catalogById.get(catalogId);
    if (catalogRow === undefined) {
      return result(
        "unresolved",
        `catalog row ${catalogId} not in seed roster`,
      );
    }
    return RESOLVED_CATALOG_TREATMENTS.has(catalogRow.treatment)
      ? result("resolved", `catalog ${catalogRow.entry}`)
      : result("unresolved", `catalog ${catalogRow.treatment}`);
  }
  const family = LOCAL_PROXY_FAMILY_MATCHES.get(material.name?.toLowerCase());
  return family === undefined
    ? result("unresolved", "no catalog origin or explicit seed-family match")
    : result("resolved", `seed fixture ${family}`);
}

function assemblyProxyProbe(catalogRows) {
  const seed = JSON.parse(readFileSync(ASSEMBLY_SEED_PATH, "utf8"));
  const materialsById = new Map(
    seed.project_materials.map((material) => [material.id, material]),
  );
  const segments = [];
  for (const assembly of seed.assemblies) {
    const exteriorCondition = assembly.exterior_condition ?? "outdoor_air";
    if (!SCREENED_EXTERIOR_CONDITIONS.has(exteriorCondition)) {
      continue;
    }
    for (const layer of assembly.layers) {
      for (const segment of layer.segments) {
        segments.push({
          project_name: ASSEMBLY_PROXY_SOURCE,
          assembly_id: assembly.id,
          assembly_name: assembly.name,
          exterior_condition: exteriorCondition,
          layer_id: layer.id,
          segment_id: segment.id,
          material_id: segment.project_material_id,
          material: materialsById.get(segment.project_material_id) ?? null,
        });
      }
    }
  }
  if (segments.length === 0) {
    throw new Error(`No screened assemblies found in ${ASSEMBLY_PROXY_SOURCE}`);
  }

  const catalogById = new Map(catalogRows.map((row) => [row.id, row]));
  const layers = new Map();
  for (const segment of segments) {
    if (!SCREENED_EXTERIOR_CONDITIONS.has(segment.exterior_condition)) {
      throw new Error(
        `Unexpected proxy exterior condition: ${segment.exterior_condition}`,
      );
    }
    const resolution = resolveProjectMaterial(segment.material, catalogById);
    const layerKey = [
      segment.project_name,
      segment.assembly_id,
      segment.layer_id,
    ].join("|");
    const layer = layers.get(layerKey) ?? {
      projectName: segment.project_name,
      assemblyId: segment.assembly_id,
      assemblyName: segment.assembly_name,
      exteriorCondition: segment.exterior_condition,
      layerId: segment.layer_id,
      resolves: true,
      segments: [],
    };
    layer.resolves &&= resolution.treatment === "resolved";
    layer.segments.push({
      segmentId: segment.segment_id,
      materialId: segment.material_id,
      materialName: segment.material?.name ?? null,
      resolution,
    });
    layers.set(layerKey, layer);
  }

  const assemblies = new Map();
  for (const layer of layers.values()) {
    const assemblyKey = [layer.projectName, layer.assemblyId].join("|");
    const assembly = assemblies.get(assemblyKey) ?? {
      projectName: layer.projectName,
      assemblyId: layer.assemblyId,
      assemblyName: layer.assemblyName,
      exteriorCondition: layer.exteriorCondition,
      computes: true,
      layers: [],
    };
    assembly.computes &&= layer.resolves;
    assembly.layers.push(layer);
    assemblies.set(assemblyKey, assembly);
  }

  const layerList = [...layers.values()];
  const assemblyList = [...assemblies.values()];
  return {
    fixtureSource: ASSEMBLY_PROXY_SOURCE,
    exteriorConditions: [...SCREENED_EXTERIOR_CONDITIONS],
    totalLayers: layerList.length,
    resolvedLayers: layerList.filter((layer) => layer.resolves).length,
    assemblies: assemblyList.length,
    computableAssemblies: assemblyList.filter((assembly) => assembly.computes)
      .length,
    details: assemblyList,
  };
}

const args = new Set(process.argv.slice(2));
const catalog = catalogProbe();
const output = {
  catalog: args.has("--roster")
    ? {
        catalogRows: catalog.catalogRows,
        counts: catalog.counts,
        resolvedWithoutProductEntry: catalog.resolvedWithoutProductEntry,
        targetRoster: catalog.targetRoster,
        excluded: catalog.excluded,
      }
    : {
        catalogRows: catalog.catalogRows,
        counts: catalog.counts,
        resolvedWithoutProductEntry: catalog.resolvedWithoutProductEntry,
        targetRosterRows: catalog.targetRoster.length,
        excludedRows: catalog.excluded.length,
      },
};
if (args.has("--assembly-proxy")) {
  output.assemblyProxy = assemblyProxyProbe(catalog.classified);
}

console.log(JSON.stringify(output, null, 2));
