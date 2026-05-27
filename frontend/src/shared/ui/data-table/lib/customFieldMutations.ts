// Builders are the single chokepoint where the wire shape is
// constructed and inline preflight runs. The union mirrors
// `backend/features/project_document/schema_mutations.py` — fields
// added to one side must land on the other in lockstep.

import type { CustomFieldDef } from "../hooks/useTableSchema";
import type { EditCustomFieldBundleRequest, FieldOption } from "../types";
import { CUSTOM_FIELD_KEY_PREFIX, isCustomFieldKey } from "./customFieldAccessor";
import { SOURCE_LENGTH_MAX } from "./formula";
import { clampNumberPrecision } from "./numberPrecision";

export type AddFieldMutation = {
  kind: "addField";
  tableKey: string;
  after: CustomFieldDef;
  insertAfterFieldId?: string;
  initialOptions?: FieldOption[];
  expectedSchemaFingerprint: string;
};

export type RenameFieldMutation = {
  kind: "renameField";
  tableKey: string;
  fieldId: string;
  displayName: string;
  expectedSchemaFingerprint: string;
};

export type DeleteFieldMutation = {
  kind: "deleteField";
  tableKey: string;
  fieldId: string;
  clearValues: true;
  expectedSchemaFingerprint: string;
};

export type DuplicateFieldMutation = {
  kind: "duplicateField";
  tableKey: string;
  sourceFieldId: string;
  after: CustomFieldDef;
  expectedSchemaFingerprint: string;
};

export type SetDescriptionMutation = {
  kind: "setDescription";
  tableKey: string;
  fieldId: string;
  description: string | null;
  expectedSchemaFingerprint: string;
};

// Cell clears are derived server-side, not supplied by the client.
export type ChangeTypeMutation = {
  kind: "changeType";
  tableKey: string;
  fieldId: string;
  after: CustomFieldDef;
  acknowledgeDestructive?: boolean;
  expectedSchemaFingerprint: string;
};

// One mutation covers add / rename / reorder / recolor / delete on a
// single_select field's option list.
export type EditOptionsMutation = {
  kind: "editOptions";
  tableKey: string;
  fieldId: string;
  nextOptions: FieldOption[];
  replacements?: Record<string, string>;
  expectedSchemaFingerprint: string;
};

export type SetFormulaMutation = {
  kind: "setFormula";
  tableKey: string;
  fieldId: string;
  // User-typed expression source. Backend re-parses, resolves refs,
  // and cycle-checks on commit — the client does not ship an AST.
  source: string;
  expectedSchemaFingerprint: string;
};

// Single-WriteOp save for the plan-21 field config modal. The backend
// diffs `after` against the stored FieldDef and applies rename,
// description, options, type-change, formula source, and single-select
// `config.default_option_id` in one transactional step.
export type EditFieldBundleMutation = {
  kind: "editFieldBundle";
  tableKey: string;
  fieldId: string;
  after: CustomFieldDef;
  // Required when the bundle edits the option list of a single_select
  // field, or when changing TYPE *into* single_select with an explicit
  // list (rather than relying on text→materialize).
  nextOptions?: FieldOption[];
  acknowledgeDestructive?: boolean;
  // Mirror of `EditOptionsMutation.replacements` — required-core
  // delete replacements; always empty for custom single-selects.
  optionReplacements?: Record<string, string>;
  // Set when target field_type is "formula" AND the source changed.
  formulaSource?: string;
  expectedSchemaFingerprint: string;
};

export type FieldSchemaMutation =
  | AddFieldMutation
  | RenameFieldMutation
  | DeleteFieldMutation
  | DuplicateFieldMutation
  | SetDescriptionMutation
  | EditOptionsMutation
  | ChangeTypeMutation
  | SetFormulaMutation
  | EditFieldBundleMutation;

// Popovers catch this and surface the message inline rather than
// shipping a doomed POST.
export class SchemaMutationBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaMutationBuildError";
  }
}

export const MAX_DISPLAY_NAME = 120;
export const MAX_DESCRIPTION = 280;

function assertCustomFieldId(fieldId: string, label: string): void {
  if (!isCustomFieldKey(fieldId) || fieldId.length <= CUSTOM_FIELD_KEY_PREFIX.length) {
    throw new SchemaMutationBuildError(
      `${label} must be a ${CUSTOM_FIELD_KEY_PREFIX}* id (got '${fieldId}').`,
    );
  }
}

function assertDisplayName(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new SchemaMutationBuildError(`${label} cannot be empty.`);
  }
  if (trimmed.length > MAX_DISPLAY_NAME) {
    throw new SchemaMutationBuildError(
      `${label} must be ${MAX_DISPLAY_NAME} characters or fewer (got ${trimmed.length}).`,
    );
  }
  return trimmed;
}

function clampDescription(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_DESCRIPTION);
}

function assertCustomFieldDef(field: CustomFieldDef, role: string): void {
  assertCustomFieldId(field.field_key, `${role} field_key`);
  assertDisplayName(field.display_name, `${role} display_name`);
}

export type BuildAddFieldArgs = {
  tableKey: string;
  newField: CustomFieldDef;
  insertAfterFieldId: string | null;
  initialOptions?: FieldOption[];
  schemaFingerprint: string;
};

export function buildAddFieldMutation(args: BuildAddFieldArgs): AddFieldMutation {
  assertCustomFieldDef(args.newField, "addField.after");
  const op: AddFieldMutation = {
    kind: "addField",
    tableKey: args.tableKey,
    after: args.newField,
    expectedSchemaFingerprint: args.schemaFingerprint,
  };
  if (args.insertAfterFieldId !== null) {
    assertCustomFieldId(args.insertAfterFieldId, "addField.insertAfterFieldId");
    op.insertAfterFieldId = args.insertAfterFieldId;
  }
  if (args.initialOptions !== undefined) {
    if (args.newField.field_type !== "single_select") {
      throw new SchemaMutationBuildError("initialOptions is only valid for single_select fields.");
    }
    validateOptionList(args.initialOptions);
    op.initialOptions = args.initialOptions.map((option) => ({ ...option }));
  }
  return op;
}

function validateOptionList(options: ReadonlyArray<FieldOption>): void {
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const option of options) {
    if (ids.has(option.id)) {
      throw new SchemaMutationBuildError(`Duplicate option id: ${option.id}`);
    }
    ids.add(option.id);
    const normalized = option.label.trim().toLowerCase();
    if (!normalized) {
      throw new SchemaMutationBuildError("Option label cannot be empty.");
    }
    if (labels.has(normalized)) {
      throw new SchemaMutationBuildError(`Duplicate option label: ${option.label}`);
    }
    labels.add(normalized);
    if (!/^#[0-9A-Fa-f]{6}$/.test(option.color)) {
      throw new SchemaMutationBuildError(`Option color must be a 6-digit hex: ${option.color}`);
    }
  }
}

export type BuildRenameFieldArgs = {
  tableKey: string;
  fieldId: string;
  displayName: string;
  schemaFingerprint: string;
};

export function buildRenameFieldMutation(args: BuildRenameFieldArgs): RenameFieldMutation {
  assertCustomFieldId(args.fieldId, "renameField.fieldId");
  return {
    kind: "renameField",
    tableKey: args.tableKey,
    fieldId: args.fieldId,
    displayName: assertDisplayName(args.displayName, "renameField.displayName"),
    expectedSchemaFingerprint: args.schemaFingerprint,
  };
}

export type BuildDeleteFieldArgs = {
  tableKey: string;
  fieldId: string;
  schemaFingerprint: string;
};

export function buildDeleteFieldMutation(args: BuildDeleteFieldArgs): DeleteFieldMutation {
  assertCustomFieldId(args.fieldId, "deleteField.fieldId");
  return {
    kind: "deleteField",
    tableKey: args.tableKey,
    fieldId: args.fieldId,
    clearValues: true,
    expectedSchemaFingerprint: args.schemaFingerprint,
  };
}

export type BuildDuplicateFieldArgs = {
  tableKey: string;
  sourceFieldId: string;
  newField: CustomFieldDef;
  schemaFingerprint: string;
};

export function buildDuplicateFieldMutation(args: BuildDuplicateFieldArgs): DuplicateFieldMutation {
  assertCustomFieldId(args.sourceFieldId, "duplicateField.sourceFieldId");
  assertCustomFieldDef(args.newField, "duplicateField.after");
  if (args.newField.field_key === args.sourceFieldId) {
    throw new SchemaMutationBuildError(
      "duplicateField target field_key must differ from the source id.",
    );
  }
  return {
    kind: "duplicateField",
    tableKey: args.tableKey,
    sourceFieldId: args.sourceFieldId,
    after: args.newField,
    expectedSchemaFingerprint: args.schemaFingerprint,
  };
}

export type BuildSetDescriptionArgs = {
  tableKey: string;
  fieldId: string;
  description: string | null;
  schemaFingerprint: string;
};

export function buildSetDescriptionMutation(args: BuildSetDescriptionArgs): SetDescriptionMutation {
  assertCustomFieldId(args.fieldId, "setDescription.fieldId");
  return {
    kind: "setDescription",
    tableKey: args.tableKey,
    fieldId: args.fieldId,
    description: clampDescription(args.description),
    expectedSchemaFingerprint: args.schemaFingerprint,
  };
}

export type BuildEditOptionsArgs = {
  tableKey: string;
  // `fieldId` is the cf_* id for custom single-selects, or the core key
  // (e.g. `floor_level`) for core single-selects — both share the same
  // wire shape and apply path on the backend.
  fieldId: string;
  nextOptions: FieldOption[];
  replacements?: Record<string, string>;
  schemaFingerprint: string;
};

export function buildEditOptionsMutation(args: BuildEditOptionsArgs): EditOptionsMutation {
  validateOptionList(args.nextOptions);
  const op: EditOptionsMutation = {
    kind: "editOptions",
    tableKey: args.tableKey,
    fieldId: args.fieldId,
    nextOptions: args.nextOptions.map((option) => ({ ...option })),
    expectedSchemaFingerprint: args.schemaFingerprint,
  };
  if (args.replacements && Object.keys(args.replacements).length > 0) {
    op.replacements = { ...args.replacements };
  }
  return op;
}

export type BuildChangeTypeArgs = {
  tableKey: string;
  fieldId: string;
  after: CustomFieldDef;
  acknowledgeDestructive?: boolean;
  schemaFingerprint: string;
};

export type BuildSetFormulaArgs = {
  tableKey: string;
  fieldId: string;
  source: string;
  schemaFingerprint: string;
};

export function buildSetFormulaMutation(args: BuildSetFormulaArgs): SetFormulaMutation {
  assertCustomFieldId(args.fieldId, "setFormula.fieldId");
  const source = args.source;
  if (source.trim() === "") {
    throw new SchemaMutationBuildError("setFormula.source cannot be empty.");
  }
  if (source.length > SOURCE_LENGTH_MAX) {
    throw new SchemaMutationBuildError(
      `setFormula.source must be ${SOURCE_LENGTH_MAX} characters or fewer (got ${source.length}).`,
    );
  }
  return {
    kind: "setFormula",
    tableKey: args.tableKey,
    fieldId: args.fieldId,
    source,
    expectedSchemaFingerprint: args.schemaFingerprint,
  };
}

export type BuildEditFieldBundleArgs = {
  tableKey: string;
  fieldId: string;
  after: CustomFieldDef;
  nextOptions?: FieldOption[];
  acknowledgeDestructive?: boolean;
  optionReplacements?: Record<string, string>;
  formulaSource?: string;
  schemaFingerprint: string;
};

export function buildEditFieldBundleMutation(
  args: BuildEditFieldBundleArgs,
): EditFieldBundleMutation {
  assertCustomFieldId(args.fieldId, "editFieldBundle.fieldId");
  assertCustomFieldDef(args.after, "editFieldBundle.after");
  if (args.after.field_key !== args.fieldId) {
    throw new SchemaMutationBuildError(
      "editFieldBundle.after.field_key must equal fieldId (identity is preserved).",
    );
  }
  if (args.after.description !== null && args.after.description !== undefined) {
    if (args.after.description.length > MAX_DESCRIPTION) {
      throw new SchemaMutationBuildError(
        `editFieldBundle.after.description must be ${MAX_DESCRIPTION} characters or fewer.`,
      );
    }
  }
  if (args.nextOptions !== undefined) {
    validateOptionList(args.nextOptions);
  }
  if (args.formulaSource !== undefined) {
    if (args.formulaSource.trim() === "") {
      throw new SchemaMutationBuildError("editFieldBundle.formulaSource cannot be empty.");
    }
    if (args.formulaSource.length > SOURCE_LENGTH_MAX) {
      throw new SchemaMutationBuildError(
        `editFieldBundle.formulaSource must be ${SOURCE_LENGTH_MAX} characters or fewer.`,
      );
    }
  }
  const op: EditFieldBundleMutation = {
    kind: "editFieldBundle",
    tableKey: args.tableKey,
    fieldId: args.fieldId,
    after: args.after,
    expectedSchemaFingerprint: args.schemaFingerprint,
  };
  if (args.nextOptions !== undefined) {
    op.nextOptions = args.nextOptions.map((option) => ({ ...option }));
  }
  if (args.acknowledgeDestructive) {
    op.acknowledgeDestructive = true;
  }
  if (args.optionReplacements && Object.keys(args.optionReplacements).length > 0) {
    op.optionReplacements = { ...args.optionReplacements };
  }
  if (args.formulaSource !== undefined) {
    op.formulaSource = args.formulaSource;
  }
  return op;
}

// Diff a CustomFieldDef's `config` against a bundle edit request,
// producing the next `config` blob that the route would pass to
// buildEditFieldBundleMutation. Type changes reset the config to an
// empty bag and re-add only the keys the new field_type owns;
// non-type edits preserve the source config and patch in the changed
// keys. Centralized so every feature-tab route can reuse it without
// re-implementing the per-key delete/preserve ceremony.
export function buildNextConfigForFieldTypeChange(
  source: CustomFieldDef,
  request: EditCustomFieldBundleRequest,
): Record<string, unknown> {
  const nextFieldType = request.fieldType ?? source.field_type;
  const typeChanged = nextFieldType !== source.field_type;
  let nextConfig: Record<string, unknown> = typeChanged ? {} : structuredClone(source.config);
  if (nextFieldType !== "single_select") {
    delete nextConfig.default_option_id;
    delete nextConfig.color_code_options;
  } else {
    nextConfig = {
      ...nextConfig,
      default_option_id: request.defaultOptionId ?? null,
      color_code_options: request.colorCodeOptions ?? true,
    };
  }
  if (nextFieldType === "number" && (request.numberPrecision !== undefined || typeChanged)) {
    nextConfig.precision = clampNumberPrecision(request.numberPrecision);
  } else if (nextFieldType !== "number") {
    delete nextConfig.precision;
  }
  if (nextFieldType !== "formula") {
    delete nextConfig.source;
    delete nextConfig.ast;
    delete nextConfig.deps;
    delete nextConfig.result_type;
  } else if (request.formulaSource !== undefined) {
    nextConfig.source = request.formulaSource;
  }
  return nextConfig;
}

export function buildChangeTypeMutation(args: BuildChangeTypeArgs): ChangeTypeMutation {
  assertCustomFieldId(args.fieldId, "changeType.fieldId");
  if (args.after.field_key !== args.fieldId) {
    throw new SchemaMutationBuildError(
      "changeType.after.field_key must equal fieldId (identity is preserved).",
    );
  }
  return {
    kind: "changeType",
    tableKey: args.tableKey,
    fieldId: args.fieldId,
    after: args.after,
    acknowledgeDestructive: args.acknowledgeDestructive ?? false,
    expectedSchemaFingerprint: args.schemaFingerprint,
  };
}
