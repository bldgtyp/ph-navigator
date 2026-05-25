// Merges per-table core column defs with the document's user-defined
// custom fields into a single ordered FieldDef[]. One call per table.
import { useMemo } from "react";
import { generatedId } from "../../../lib/ids";
import { sha256Hex } from "../../../lib/sha256";
import type { CustomFieldType, FieldDef, FieldOption, FieldType } from "../types";

// Re-export so existing imports from this module keep working.
export type { CustomFieldType };

// Mirror of backend `CustomFieldDef`. `id` is the immutable identity —
// writes, view state, and formula refs always key off `id`, never
// `field_key` (advisory export slug) or `display_name` (user-editable).
export type CustomFieldDef = {
  id: string;
  field_key: string | null;
  display_name: string;
  field_type: CustomFieldType;
  config: Record<string, unknown>;
  description: string | null;
  created_at: string;
  created_by: string | null;
};

export type TableSchema = {
  fieldDefs: FieldDef[];
  coreFieldKeys: Set<string>;
  customFields: CustomFieldDef[];
  // Hex digest matching backend `compute_table_schema_fingerprint`.
  // Persisted view-state records carry this alongside their state so
  // opening a version with a different schema does not overwrite a
  // saved record under another fingerprint.
  schemaFingerprint: string;
  mintCustomFieldId: () => string;
};

export type UseTableSchemaArgs = {
  tableKey: string;
  coreFieldDefs: FieldDef[];
  // Optional backend registry order for schema fingerprints. Some
  // tables intentionally hide core document fields from the grid, but
  // the schema-editor fingerprint must still match the backend's
  // full table capability.
  fingerprintCoreFieldKeys?: readonly string[];
  customFields: CustomFieldDef[] | null | undefined;
  // Namespaced single_select option lists keyed by their
  // `<table_path>.<field_id>` namespace key (e.g. `rooms.cf_abc123`).
  // When supplied, attached to custom single_select FieldDef entries.
  singleSelectOptions?: Record<string, FieldOption[]> | null;
};

const EMPTY_OPTIONS: readonly FieldOption[] = [];

const CUSTOM_FIELD_TYPE_TO_FIELD_TYPE: Record<CustomFieldType, FieldType> = {
  short_text: "text",
  long_text: "text",
  number: "number",
  url: "text",
  single_select: "single_select",
  formula: "computed",
};

export function useTableSchema(args: UseTableSchemaArgs): TableSchema {
  const { coreFieldDefs, customFields, fingerprintCoreFieldKeys, singleSelectOptions, tableKey } =
    args;
  const customList = useMemo(() => customFields ?? [], [customFields]);

  const optionsByFieldId = useMemo<Record<string, readonly FieldOption[]>>(() => {
    if (!singleSelectOptions) return {};
    const prefix = `${tableKey}.`;
    const out: Record<string, readonly FieldOption[]> = {};
    for (const [key, value] of Object.entries(singleSelectOptions)) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
    }
    return out;
  }, [singleSelectOptions, tableKey]);

  const synthesizedFieldDefs = useMemo<FieldDef[]>(
    () => customList.map((custom) => customFieldToFieldDef(custom, optionsByFieldId)),
    [customList, optionsByFieldId],
  );

  const fieldDefs = useMemo<FieldDef[]>(() => {
    const coreWithFlag = coreFieldDefs.map((fieldDef) => ({
      ...fieldDef,
      read_only_schema: true,
    }));
    return [...coreWithFlag, ...synthesizedFieldDefs];
  }, [coreFieldDefs, synthesizedFieldDefs]);

  const coreFieldKeys = useMemo(
    () => new Set(fingerprintCoreFieldKeys ?? coreFieldDefs.map((fieldDef) => fieldDef.field_key)),
    [coreFieldDefs, fingerprintCoreFieldKeys],
  );

  const schemaFingerprint = useMemo(
    () => computeTableSchemaFingerprint(coreFieldKeys, customList),
    [coreFieldKeys, customList],
  );

  return useMemo(
    () => ({
      fieldDefs,
      coreFieldKeys,
      customFields: customList,
      schemaFingerprint,
      mintCustomFieldId,
    }),
    [fieldDefs, coreFieldKeys, customList, schemaFingerprint],
  );
}

export function mintCustomFieldId(): string {
  return generatedId("cf");
}

function customFieldToFieldDef(
  custom: CustomFieldDef,
  optionsByFieldId: Record<string, readonly FieldOption[]>,
): FieldDef {
  // `read_only_schema` is intentionally absent for custom fields — the
  // header context menu reads its absence to enable schema-mutation items.
  const fieldDef: FieldDef = {
    field_key: custom.id,
    field_type: CUSTOM_FIELD_TYPE_TO_FIELD_TYPE[custom.field_type],
    custom_field_type: custom.field_type,
    display_name: custom.display_name,
    description: custom.description ?? undefined,
  };
  if (custom.field_type === "single_select") {
    fieldDef.options = [...(optionsByFieldId[custom.id] ?? EMPTY_OPTIONS)];
  }
  if (custom.field_type === "formula") {
    const config = custom.config ?? {};
    const source = typeof config.source === "string" ? config.source : "";
    const deps = Array.isArray(config.deps)
      ? (config.deps as unknown[]).filter((entry): entry is string => typeof entry === "string")
      : [];
    const resultType = typeof config.result_type === "string" ? config.result_type : undefined;
    fieldDef.formula_config = {
      source,
      ast: config.ast ?? null,
      deps,
      result_type: resultType,
    };
    // Route filter / sort / aggregation through the existing computed
    // catalogue: number-typed formulas use the number operator set,
    // every other formula falls back to text.
    fieldDef.computed_type = resultType === "number" ? "number" : "text";
  }
  return fieldDef;
}

// Must agree to the byte with backend `compute_table_schema_fingerprint`.
// The digest is the matchkey for persisted view state across schema switches.
export const FINGERPRINT_ALGORITHM_VERSION = "v1";

export function computeTableSchemaFingerprint(
  coreFieldKeys: Iterable<string>,
  customFields: Iterable<CustomFieldDef>,
): string {
  const payload = {
    version: FINGERPRINT_ALGORITHM_VERSION,
    core: Array.from(coreFieldKeys),
    custom: Array.from(customFields).map((field) => ({
      id: field.id,
      field_type: field.field_type,
    })),
  };
  return sha256Hex(JSON.stringify(payload));
}
