// Builders are the single chokepoint where the wire shape is
// constructed and inline preflight runs. The union mirrors
// `backend/features/project_document/schema_mutations.py` — fields
// added to one side must land on the other in lockstep.

import type { CustomFieldDef } from "../hooks/useTableSchema";
import type { CellWrite } from "../types";
import { CUSTOM_FIELD_KEY_PREFIX, isCustomFieldKey } from "./customFieldAccessor";

export type AddFieldMutation = {
  kind: "addField";
  tableKey: string;
  after: CustomFieldDef;
  insertAfterFieldId?: string;
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

// Declared up front so the discriminator is closed; deferred
// implementations land in later phases.
export type ChangeTypeMutation = {
  kind: "changeType";
  tableKey: string;
  fieldId: string;
  after: CustomFieldDef;
  cellWrites: CellWrite[];
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

const MAX_DISPLAY_NAME = 120;
const MAX_DESCRIPTION = 280;

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
  return op;
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
    throw new SchemaMutationBuildError(
      "duplicateField target id must differ from the source id.",
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
