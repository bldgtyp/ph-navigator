// Merges per-table core column defs with the document's user-defined
// custom fields into a single ordered FieldDef[]. One call per table.
import { useMemo } from "react";
import { generatedId } from "../../../lib/ids";
import { sha256Hex } from "../../../lib/sha256";
import { clampNumberPrecision } from "../lib/numberPrecision";
import type { CustomFieldType, FieldDef, FieldOption, FieldType } from "../types";

// Re-export so existing imports from this module keep working.
export type { CustomFieldType };

// Mirror of backend `TableFieldDef` (custom_fields.py:93). Phase 1b
// unified identity on `field_key` for both built-in and custom fields —
// writes, view state, and formula refs all key off `field_key`. `origin`
// records whether the entry was declared by the feature seed
// (`"built_in"`) or created by a user (`"custom"`).
export type TableFieldDef = {
  field_key: string;
  display_name: string;
  field_type: CustomFieldType;
  config: Record<string, unknown>;
  description: string | null;
  origin: "built_in" | "custom";
  created_at: string;
  created_by: string | null;
};

// Back-compat alias for callers still importing `CustomFieldDef`.
// Remove once every callsite migrates to `TableFieldDef`.
export type CustomFieldDef = TableFieldDef;

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

  const optionsByFieldKey = useMemo<Record<string, readonly FieldOption[]>>(() => {
    if (!singleSelectOptions) return {};
    const prefix = `${tableKey}.`;
    const out: Record<string, readonly FieldOption[]> = {};
    for (const [key, value] of Object.entries(singleSelectOptions)) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
    }
    return out;
  }, [singleSelectOptions, tableKey]);

  const synthesizedFieldDefs = useMemo<FieldDef[]>(
    () => customList.map((custom) => customFieldToFieldDef(custom, optionsByFieldKey)),
    [customList, optionsByFieldKey],
  );

  const fieldDefs = useMemo<FieldDef[]>(
    () => [...coreFieldDefs, ...synthesizedFieldDefs],
    [coreFieldDefs, synthesizedFieldDefs],
  );

  const coreFieldKeys = useMemo(
    () => new Set(fingerprintCoreFieldKeys ?? coreFieldDefs.map((fieldDef) => fieldDef.field_key)),
    [coreFieldDefs, fingerprintCoreFieldKeys],
  );

  // Backend fingerprint v2 walks every persisted FieldDef (built-in +
  // custom) as one stream of `(field_key, field_type)`. Until the
  // frontend collapses the `coreFieldDefs / customFields` split (task
  // #28), synthesize the built-in side from `coreFieldDefs` and concat
  // the custom side. `coreFieldDef.custom_field_type` is the backend
  // `CustomFieldType` slug; falls back to `short_text` for the few
  // built-ins (e.g. attachment, computed pinned identifier) that don't
  // declare one.
  const fingerprintInput = useMemo<TableFieldDef[]>(
    () => [
      ...coreFieldDefs.map<TableFieldDef>((field) => ({
        field_key: field.field_key,
        display_name: field.display_name,
        field_type: field.custom_field_type ?? "short_text",
        config: {},
        description: field.description ?? null,
        origin: "built_in",
        created_at: "",
        created_by: null,
      })),
      ...customList,
    ],
    [coreFieldDefs, customList],
  );

  const schemaFingerprint = useMemo(
    () => computeTableSchemaFingerprint(fingerprintInput),
    [fingerprintInput],
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
  custom: TableFieldDef,
  optionsByFieldKey: Record<string, readonly FieldOption[]>,
): FieldDef {
  const fieldDef: FieldDef = {
    field_key: custom.field_key,
    field_type: CUSTOM_FIELD_TYPE_TO_FIELD_TYPE[custom.field_type],
    custom_field_type: custom.field_type,
    display_name: custom.display_name,
    description: custom.description ?? undefined,
  };
  if (custom.field_type === "single_select") {
    fieldDef.options = [...(optionsByFieldKey[custom.field_key] ?? EMPTY_OPTIONS)];
    const defaultOptionId = custom.config.default_option_id;
    fieldDef.defaultOptionId = typeof defaultOptionId === "string" ? defaultOptionId : null;
    fieldDef.colorCodeOptions = custom.config.color_code_options !== false;
  }
  if (custom.field_type === "number") {
    fieldDef.numberPrecision = clampNumberPrecision(custom.config.precision);
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

// Must agree to the byte with backend `compute_table_schema_fingerprint`
// (backend/.../tables/_fingerprint.py). The digest is the matchkey for
// persisted view state across schema switches. Phase 1b bumped this to
// v2 — the payload now covers every persisted FieldDef (built-in +
// custom) keyed by `(field_key, field_type)`.
export const FINGERPRINT_ALGORITHM_VERSION = "v2";

export function computeTableSchemaFingerprint(fieldDefs: Iterable<TableFieldDef>): string {
  const payload = {
    version: FINGERPRINT_ALGORITHM_VERSION,
    fields: Array.from(fieldDefs).map((field) => ({
      field_key: field.field_key,
      field_type: field.field_type,
    })),
  };
  return sha256Hex(JSON.stringify(payload));
}
