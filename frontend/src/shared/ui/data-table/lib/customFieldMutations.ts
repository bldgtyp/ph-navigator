// Builders are the single chokepoint where the wire shape is
// constructed and inline preflight runs. The union mirrors
// `backend/features/project_document/schema_mutations.py` — fields
// added to one side must land on the other in lockstep.

import type { CustomFieldDef } from "../hooks/useTableSchema";
import type { FieldOption } from "../types";
import { CUSTOM_FIELD_KEY_PREFIX, isCustomFieldKey } from "./customFieldAccessor";

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
  config: Record<string, unknown>;
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
  | SetFormulaMutation;

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
  assertCustomFieldId(field.id, `${role} id`);
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
  if (args.newField.id === args.sourceFieldId) {
    throw new SchemaMutationBuildError("duplicateField target id must differ from the source id.");
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

export function buildChangeTypeMutation(args: BuildChangeTypeArgs): ChangeTypeMutation {
  assertCustomFieldId(args.fieldId, "changeType.fieldId");
  if (args.after.id !== args.fieldId) {
    throw new SchemaMutationBuildError(
      "changeType.after.id must equal fieldId (identity is preserved).",
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
