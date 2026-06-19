import type { FieldDef } from "../../types";

/**
 * Merge feature render metadata into persisted schema FieldDefs without
 * discarding schema-owned identity. Use this when a table needs richer
 * cell/header rendering than the stored FieldDef can express directly.
 */
export function fieldDefsWithRenderOverrides(
  schemaFieldDefs: readonly FieldDef[],
  renderOverrides: readonly FieldDef[],
): FieldDef[] {
  const overridesByKey = new Map(renderOverrides.map((fieldDef) => [fieldDef.field_key, fieldDef]));
  const emitted = new Set<string>();
  const merged = schemaFieldDefs.map((schemaFieldDef) => {
    const override = overridesByKey.get(schemaFieldDef.field_key);
    if (!override) return schemaFieldDef;
    emitted.add(override.field_key);
    return mergeFieldDefRenderOverride(schemaFieldDef, override);
  });
  for (const override of renderOverrides) {
    if (!emitted.has(override.field_key)) merged.push(override);
  }
  return merged;
}

function mergeFieldDefRenderOverride(schemaFieldDef: FieldDef, override: FieldDef): FieldDef {
  return {
    ...schemaFieldDef,
    ...override,
    built_in: override.built_in ?? schemaFieldDef.built_in,
    custom_field_type: override.custom_field_type ?? schemaFieldDef.custom_field_type,
    locked: override.locked ?? schemaFieldDef.locked,
  };
}
