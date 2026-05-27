// Converts the document's persisted table FieldDef stream into the
// renderer's FieldDef[] shape. One call per table.
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
  default?: unknown;
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
  customFields: TableFieldDef[];
  // Hex digest matching backend `compute_table_schema_fingerprint`.
  // Persisted view-state records carry this alongside their state so
  // opening a version with a different schema does not overwrite a
  // saved record under another fingerprint.
  schemaFingerprint: string;
  mintCustomFieldId: () => string;
};

export type UseTableSchemaArgs = {
  tableKey: string;
  fieldDefs: TableFieldDef[] | null | undefined;
  fieldOverlay?: Record<string, Partial<FieldDef>> | null;
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
  const { fieldDefs, fieldOverlay, singleSelectOptions, tableKey } = args;
  const persistedFieldDefs = useMemo(() => fieldDefs ?? [], [fieldDefs]);

  const optionsByFieldKey = useMemo<Record<string, readonly FieldOption[]>>(() => {
    if (!singleSelectOptions) return {};
    const out: Record<string, readonly FieldOption[]> = {};
    for (const fieldDef of persistedFieldDefs) {
      const namespacedKey = `${tableKey}.${fieldDef.field_key}`;
      const options = singleSelectOptions[fieldDef.field_key] ?? singleSelectOptions[namespacedKey];
      if (options) out[fieldDef.field_key] = options;
    }
    return out;
  }, [persistedFieldDefs, singleSelectOptions, tableKey]);

  const renderedFieldDefs = useMemo<FieldDef[]>(
    () =>
      persistedFieldDefs.map((fieldDef) =>
        tableFieldToFieldDef(fieldDef, optionsByFieldKey, fieldOverlay?.[fieldDef.field_key]),
      ),
    [fieldOverlay, optionsByFieldKey, persistedFieldDefs],
  );

  const coreFieldKeys = useMemo(
    () =>
      new Set(
        persistedFieldDefs
          .filter((fieldDef) => fieldDef.origin === "built_in")
          .map((fieldDef) => fieldDef.field_key),
      ),
    [persistedFieldDefs],
  );

  const customList = useMemo(
    () => persistedFieldDefs.filter((fieldDef) => fieldDef.origin === "custom"),
    [persistedFieldDefs],
  );

  const schemaFingerprint = useMemo(
    () => computeTableSchemaFingerprint(persistedFieldDefs),
    [persistedFieldDefs],
  );

  return useMemo(
    () => ({
      fieldDefs: renderedFieldDefs,
      coreFieldKeys,
      customFields: customList,
      schemaFingerprint,
      mintCustomFieldId,
    }),
    [coreFieldKeys, customList, renderedFieldDefs, schemaFingerprint],
  );
}

export function mintCustomFieldId(): string {
  return generatedId("cf");
}

function tableFieldToFieldDef(
  persisted: TableFieldDef,
  optionsByFieldKey: Record<string, readonly FieldOption[]>,
  overlay: Partial<FieldDef> | undefined,
): FieldDef {
  const fieldDef: FieldDef = {
    field_key: persisted.field_key,
    field_type: CUSTOM_FIELD_TYPE_TO_FIELD_TYPE[persisted.field_type],
    custom_field_type: persisted.field_type,
    display_name: persisted.display_name,
    description: persisted.description ?? undefined,
    default: persisted.default,
    built_in: persisted.origin === "built_in" ? true : undefined,
  };
  if (persisted.field_type === "single_select") {
    fieldDef.options = [...(optionsByFieldKey[persisted.field_key] ?? EMPTY_OPTIONS)];
    const defaultOptionId = persisted.config.default_option_id;
    fieldDef.defaultOptionId = typeof defaultOptionId === "string" ? defaultOptionId : null;
    fieldDef.colorCodeOptions = persisted.config.color_code_options !== false;
  }
  if (persisted.field_type === "number") {
    fieldDef.numberPrecision = clampNumberPrecision(persisted.config.precision);
  }
  if (persisted.field_type === "formula") {
    const config = persisted.config ?? {};
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
  return { ...fieldDef, ...overlay, display_name: persisted.display_name };
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
